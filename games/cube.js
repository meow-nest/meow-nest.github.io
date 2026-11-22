// 遊戲：喵喵方塊島（3D 方塊世界，搖桿到處走；引擎在 games/cube3d.js）
// 第 1 階段：走路、跳、轉鏡頭、摸島上的小貓。之後：放方塊蓋房子、看得到另一半、探索撿東西。
(function(){
App.registerGame({
  id: "cube",
  name: "喵喵方塊島",
  desc: "搖桿到處走的 3D 方塊小島",
  solo: true,
  icon: () => Pix.sprite("orange","happy"),
  mount(el, ctx){
    const { sprite, esc, SFX } = ctx;
    let game = null;
    const p = ctx.partner && ctx.partner();
    // 造型 { pj:睡衣, hs:髮型, hc:髮色 } 存在自己的手機
    const C3 = window.Cube3D;
    let av = { pj: ({ orange:"orange", white:"white", black:"black", gray:"gray", calico:"calico" })[ctx.me.cat] || "orange", hs: "short" };
    try{ const raw = localStorage.getItem("mw_cube_av"); if(raw) av = raw[0] === "{" ? Object.assign(av, JSON.parse(raw)) : Object.assign(av, { pj: raw }); }catch(e){}
    const save = () => { try{ localStorage.setItem("mw_cube_av", JSON.stringify(av)); }catch(e){} };
    el.innerHTML = `<div class="box card cbStart">
      <h3>喵喵方塊島</h3>
      <p class="k">穿上貓咪睡衣，在飄在白雲上的方塊小島到處走走：<br>左下搖桿走路、右邊拖曳轉鏡頭、按「跳」跳起來，<br>家裡養的貓會跟著你一起生活：追毛線球、玩鬼抓人，<br>走過去可以摸摸、丟毛線球，晚上在你旁邊睡覺。</p>
      <div class="cbMe" id="cbMe"></div>
      <div class="cbPickT">貓咪睡衣</div><div class="cbPick" id="cbPick"></div>
      <div class="cbPickT">髮型</div><div class="cbPick hs" id="cbHair"></div>
      <div class="cbPickT">髮色</div><div class="cbHc" id="cbHc"></div>
      <div class="cbFam" id="cbFam"></div>
      <div class="cbPickT">模式</div>
      <div class="cbMode" id="cbMode">
        <button data-m="s"><b>生存模式</b><small>方塊要自己挖、放一個少一個<br>家具要慢慢收集</small></button>
        <button data-m="c"><b>創造模式</b><small>方塊、家具隨便用<br>可以飛、一下就拆</small></button>
      </div>
      <p class="k cbModeN">兩個模式是不同的島，蓋的東西分開存</p>
      <button class="btn" id="cbGo">開始</button>
      <p class="k cbNote">按「蓋房子」可以放方塊、擺家具、採小花；之後會加上：看得到${p ? esc(p.name) : "一起玩的人"}、旅行貓擺攤換家具</p>
    </div>`;
    function paint(){
      if(!C3) return; const cur = C3.avOf(av);
      el.querySelector("#cbMe").innerHTML = C3.portrait(av);
      el.querySelector("#cbPick").innerHTML = C3.AVATARS.map(a => `<button data-pj="${a.id}" class="${a.id===cur.id?"on":""}">${C3.portrait(Object.assign({}, av, { pj:a.id }))}<i>${esc(a.name)}</i></button>`).join("");
      el.querySelector("#cbHair").innerHTML = C3.HAIRS.map(h => `<button data-hs="${h.id}" class="${h.id===cur.hs?"on":""}">${C3.portrait(Object.assign({}, av, { hs:h.id }))}<i>${esc(h.name)}</i></button>`).join("");
      el.querySelector("#cbHc").innerHTML = C3.HAIR_COLORS.map(c => `<button data-hc="${c}" class="${c===cur.hair?"on":""}" style="background:${c}" aria-label="髮色"></button>`).join("");
      el.querySelectorAll("[data-pj]").forEach(b => b.addEventListener("click", () => { SFX.tap && SFX.tap(); av.pj = b.dataset.pj; save(); paint(); }));
      el.querySelectorAll("[data-hs]").forEach(b => b.addEventListener("click", () => { SFX.tap && SFX.tap(); av.hs = b.dataset.hs; save(); paint(); }));
      el.querySelectorAll("[data-hc]").forEach(b => b.addEventListener("click", () => { SFX.tap && SFX.tap(); av.hc = b.dataset.hc; save(); paint(); }));
    }
    paint();
    // 模式：生存 s／創造 c（記在手機 mw_cube_mode）
    let mode = "s"; try{ mode = localStorage.getItem("mw_cube_mode") === "c" ? "c" : "s"; }catch(e){}
    const paintMode = () => el.querySelectorAll("[data-m]").forEach(b => b.classList.toggle("on", b.dataset.m === mode));
    el.querySelectorAll("[data-m]").forEach(b => b.addEventListener("click", () => { SFX.tap && SFX.tap(); mode = b.dataset.m; try{ localStorage.setItem("mw_cube_mode", mode); }catch(e){} paintMode(); }));
    paintMode();
    // 我們家的貓（「我們的貓」養的）也一起來島上玩
    let fam = [];
    const PL = window.PetLogic, stg = c => PL ? PL.stage(c) : (() => { const e = c.exp || 0, S = [[0,"小奶貓",.5],[8,"小貓",.62],[25,"大貓",.74],[60,"胖胖貓",.86],[120,"貓咪大王",.9]]; let i = 0; while(i+1 < S.length && e >= S[i+1][0]) i++; return { name:S[i][1], scale:S[i][2] }; })();
    function paintFam(){
      const f = el.querySelector("#cbFam"); if(!f) return;
      f.innerHTML = fam.length ? `<div class="cbPickT">一起來玩的貓咪</div><div class="cbFamL">${fam.map(c => `<div>${sprite(c.color, "happy")}<b>${esc(c.name)}</b><small>${esc(c.stage)}</small>${c.wearArt.length ? `<span class="cbWear">${c.wearArt.map(id => `<i title="${esc(window.PetDeco.BY[id].n)}">${window.PetDeco.art(id)}</i>`).join("")}</span>` : ""}</div>`).join("")}</div>`
        : `<p class="k cbFamNo">在「我們的貓」領養貓咪之後，牠也會跟你一起來島上玩喔</p>`;
    }
    (async () => { try{
      const r = ctx.getState ? await ctx.getState("pet") : null, st = r && r.state, cats = st ? (st.v === 2 ? st.cats : [st]) : [];
      const WR = (st && st.deco && st.deco.wear) || {}, PD = window.PetDeco;
      const wearOf = i => PD && PD.rows ? ["hat","neck","face"].map(sl => { const id = (WR[i] || {})[sl], x = id && PD.BY[id], r = x && PD.rows(id); return r ? { slot:sl, id, base:x.fam || id, side:!!x.side, pal:r.pal } : null; }).filter(Boolean) : [];
      fam = (cats || []).filter(c => c && c.name).slice(0, 2).map((c, i) => { const g = stg(c);
        return { id:"fam" + i, fam:true, p:"fam", name:c.name, color:c.color || "orange", scale:g.scale, stage:g.name, full:PL && PL.fullness ? PL.fullness(c) : null, pitch:1.15 - i*.1, wear:wearOf(i), wearArt:(WR[i] && PD) ? ["hat","neck","face"].map(sl => (WR[i] || {})[sl]).filter(id => id && PD.BY[id]) : [] }; });
    }catch(e){} paintFam(); })();
    el.querySelector("#cbGo").addEventListener("click", () => {
      if(!window.Cube3D) return;
      SFX.tap && SFX.tap();
      const npcs = [];   // 站長不要村民：島上只有自己養的貓
      game = window.Cube3D.open({ mode, avatar: Object.assign({}, av), meName: ctx.me.name, partnerName: p ? p.name : "", npcs: npcs.concat(fam), sfx: SFX, icon: ctx.icon, esc, toast: ctx.toast, onClose: () => { game = null; } });
    });
  },
  unmount(){ const g = document.querySelector(".p3d"); if(g){ const x = g.querySelector("#p3dX"); if(x) x.click(); } },
});
})();

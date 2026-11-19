// 遊戲：等你的星星罐（ta 在忙的時候自己玩）
// 一步一步摺一顆紙星星（選紙 → 打結 → 繞繞繞 → 塞尾巴 → 捏五個角），可以在裡面藏一句話，放進罐子。
// 對方忙完打開遊戲，會看到你摺給 ta 的星星罐，一顆一顆拆開看裡面的話。
(function(){
const O = "#5a3b2e";
const PAPERS = [["#ffb3c6","草莓"],["#ffd59e","蜜桃"],["#fff09a","檸檬"],["#c6f0c2","抹茶"],["#b8e2ff","汽水"],["#d9c8ff","薰衣草"],["#ffffff","牛奶"],["#ffc9a8","奶茶"]];
const WRAPS = 6;
const IDEAS = ["想你了","等你忙完～","今天也辛苦了","愛你 (♡˙︶˙♡)","記得吃飯喔","好想抱抱","我在這裡等你","你是最棒的","晚上要陪我喔","乖乖工作，我等你"];
const hash = n => { let x = Math.sin(n*9301 + 49297) * 233280; return x - Math.floor(x); };
const star = (c, cls) => `<span class="srStar ${cls||""}">${Pix.icon("star", { Y: c, O })}</span>`;
function pent(c, puffed){
  // a flat pentagon knot that gets puffier
  const R = ["....OOO....","..OOYYYOO..",".OYYYYYYYO.","OYYYYYYYYYO","OYYYYYYYYYO",".OYYYYYYYO.",".OYYYYYYYO.","..OYYYYYO..","..OOOOOOO.."];
  let r = ""; R.forEach((row,y)=>[...row].forEach((ch,x)=>{ if(ch==="O") r += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${O}"/>`; else if(ch==="Y") r += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${c}"/>`; }));
  for(let i=0;i<puffed;i++){ const pts = [[5,0],[10,3],[8,8],[2,8],[0,3]][i]; r += `<rect x="${pts[0]}" y="${pts[1]}" width="1.02" height="1.02" fill="#fff" opacity=".9"/>`; }
  return `<svg viewBox="0 0 11 9" shape-rendering="crispEdges">${pxC(r)}</svg>`;
}

App.registerGame({
  id: "stars",
  name: "等你的星星罐",
  desc: "ta 忙的時候，摺星星藏悄悄話",
  icon: () => Pix.icon("star"),
  mount(el, ctx){
    const { esc, SFX } = ctx;
    // 星星存在資料庫的 star_jar 表格（一顆一列，沒有數量上限）；遊戲存檔 "stars" 只拿來通知對方「有新星星」
    let J = null, err = null, step = 0, paper = null, wraps = 0, puff = 0, busy = false, alive = true, loading = null;
    const me = () => ctx.me.uid;
    const p = () => ctx.partner();
    const mine = () => (J && J.mine) || [];
    const theirs = () => (J && J.theirs) || [];
    const today = () => new Date().toDateString();
    const rpc = (fn, a) => ctx.rpc(fn, a);
    const noDb = e => /star_|function|schema cache/i.test(String(e && (e.message || e)));
    async function load(){
      if(loading) return loading;
      loading = (async () => { try{ J = await rpc("star_jar_get", { p_with: p() ? p().user_id : null }); err = null; }
        catch(e){ console.error(e); err = noDb(e) ? "db" : "net"; } loading = null; if(alive && !step) lobby(); })();
      return loading;
    }
    // 舊版 App 還是可能把星星寫進存檔，看到就搬進表格
    async function absorb(st){ if(st && st.s && typeof st.s === "object" && Object.keys(st.s).length){ try{ await rpc("star_import"); }catch(e){ console.error(e); } } }
    const ping = () => ctx.update("stars", () => ({ v: 2, ping: Date.now() })).catch(()=>{});
    function jar(list, cls, label){
      const show = list.slice(-50);
      const stars = show.map((x, k) => { const row = Math.floor(k / 5), col = k % 5;
        const left = 4 + col*17 + (hash(k)*6 - 3) + (row % 2 ? 7 : 0), bottom = 3 + row*10 + hash(k+7)*4;
        return `<i style="left:${Math.min(84, Math.max(4, left))}%;bottom:${Math.min(88, bottom)}%;transform:rotate(${(hash(k+3)*70-35)|0}deg)" class="${x.seen === false && cls === "theirs" ? "new" : ""}">${star(x.c)}</i>`; }).join("");
      return `<div class="srJar ${cls}"><div class="srLid"></div><div class="srGlass">${stars}</div><div class="srLabel">${label}</div></div>`;
    }
    function lobby(){
      if(!J){ el.innerHTML = `<div class="box srBox"><div class="k" style="text-align:center;padding:24px 8px">${err === "db" ? "星星罐正在升級中，請站長更新資料庫（更新 63）🙏" : err ? "讀不到星星罐，網路不太穩<br><button class='btn sub' id='srRe' style='margin-top:10px'>再試一次</button>" : "打開星星罐中…"}</div></div>`;
        const re = el.querySelector("#srRe"); if(re) re.addEventListener("click", () => { err = null; lobby(); load(); }); return; }
      const pp = p(), unread = J.unread || 0, todayN = J.today || 0, mN = J.mineN || 0, tN = J.theirN || 0, cap = J.cap || 3000, full = mN >= cap;
      const pbusy = pp && ctx.isBusy && ctx.isBusy(pp.user_id);
      el.innerHTML = `<div class="box srBox">
        <div class="srTop"><div class="srCat">${ctx.sprite(ctx.me.cat || "orange", pbusy ? "normal" : "happy")}</div>
          <p class="srIntro">${pbusy ? `${esc(pp.name)} 在忙…<br>摺幾顆星星，等 ta 忙完吧 ⭐` : pp ? `摺一顆星星，在裡面藏一句話，<br>放進要送給 ${esc(pp.name)} 的罐子裡 ⭐` : "摺一顆星星放進罐子裡吧 ⭐"}</p></div>
        <div class="srJars">${jar(mine(), "mine", `給 ${esc(pp ? pp.name : "ta")}<b>${mN}</b>顆`)}${pp ? jar(theirs(), "theirs", `${esc(pp.name)} 給你<b>${tN}</b>顆`) : ""}</div>
        ${unread ? `<button class="btn srOpen" id="srOpen">💌 拆一顆 ${esc(pp.name)} 的星星（還有 ${unread} 顆沒拆）</button>` : tN ? `<button class="btn sub" id="srRead" style="width:100%">📖 看 ${esc(pp.name)} 摺給你的星星</button>` : ""}
        ${full ? `<div class="srFull">罐子滿了（${mN}/${cap} 顆）<br>刪掉一些舊星星，就能再摺新的</div><button class="btn" id="srGo">🧹 整理我的罐子</button>` : `<button class="btn" id="srGo">⭐ 摺一顆星星</button>${cap - mN <= 100 ? `<div class="k" style="text-align:center;color:var(--pinkT)">罐子快滿了，還可以放 ${cap - mN} 顆</div>` : ""}`}
        ${mN ? `<button class="btn sub" id="srMine" style="width:100%">📝 看我摺給 ${esc(pp ? pp.name : "ta")} 的星星</button>` : ""}
        <div class="k" style="text-align:center">今天摺了 ${todayN} 顆・每天前 10 顆各送 1 個貓幣 🪙</div></div>`;
      el.querySelector("#srGo").addEventListener("click", () => { SFX.tap(); if(full){ listView(true); return; } step = 1; paper = null; wraps = 0; puff = 0; fold(); });
      const op = el.querySelector("#srOpen"); if(op) op.addEventListener("click", openOne);
      const rd = el.querySelector("#srRead"); if(rd) rd.addEventListener("click", () => { SFX.tap(); listView(false); });
      const mn = el.querySelector("#srMine"); if(mn) mn.addEventListener("click", () => { SFX.tap(); listView(true); });
    }
    // ---------- folding ----------
    function fold(){
      const c = paper ? paper[0] : "#ffb3c6";
      const steps = ["選一張紙", "打個結", "繞繞繞", "塞尾巴", "捏五個角", "藏一句話"];
      let stage = "", hint = "", ctl = "";
      if(step === 1){ stage = `<div class="srPapers">${PAPERS.map((x,i)=>`<button data-p="${i}"><span class="srStrip" style="background:${x[0]}"></span>${x[1]}</button>`).join("")}</div>`; hint = "喜歡哪個顏色？"; }
      else if(step === 2){ stage = `<button class="srTap" id="srT"><span class="srStrip long" style="background:${c}"></span></button>`; hint = "點紙條，打一個小小的結"; }
      else if(step === 3){ stage = `<button class="srTap" id="srT"><span class="srKnot" style="--w:${1 + wraps*0.12}">${pent(c, 0)}</span><span class="srStrip tail" style="background:${c};width:${Math.max(8, 70 - wraps*11)}%"></span></button>`; hint = `點一下繞一圈（${wraps}/${WRAPS}）`; }
      else if(step === 4){ stage = `<button class="srTap" id="srT"><span class="srKnot" style="--w:1.7">${pent(c, 0)}</span><span class="srStrip tail" style="background:${c};width:8%"></span></button>`; hint = "點一下把尾巴塞進去"; }
      else if(step === 5){ stage = `<div class="srPuff">${puff >= 5 ? `<span class="srDone">${star(c, "big")}</span>` : `<span class="srKnot" style="--w:1.7">${pent(c, puff)}</span>${[0,1,2,3,4].map(i=>`<button class="srCorner c${i} ${i < puff ? "done" : ""}" data-c="${i}"></button>`).join("")}`}</div>`; hint = puff >= 5 ? "鼓起來了！" : `用指甲捏一下五個角（${puff}/5）`; }
      else if(step === 6){ stage = `<div class="srDoneWrap">${star(c, "big")}</div>`; hint = `想藏一句話給 ${p() ? esc(p().name) : "ta"} 嗎？`;
        ctl = `<input id="srMsg" maxlength="40" placeholder="悄悄話（可以不寫）" autocomplete="off"><div class="srIdeas">${IDEAS.sort(()=>Math.random()-.5).slice(0,4).map(x=>`<button data-i="${esc(x)}">${esc(x)}</button>`).join("")}</div>
          <div class="srBtns"><button class="btn sub" id="srSkip">不寫，直接放</button><button class="btn" id="srPut">放進罐子 ⭐</button></div>`; }
      el.innerHTML = `<div class="box srBox srFold"><div class="srSteps">${steps.map((x,i)=>`<span class="${i+1 < step ? "ok" : i+1 === step ? "on" : ""}">${x}</span>`).join("")}</div>
        <div class="srStage">${stage}</div><div class="srHint">${hint}</div>${ctl}
        <button class="btn sub srBack" id="srBack">◀ 不摺了</button></div>`;
      el.querySelector("#srBack").addEventListener("click", () => { SFX.tap(); step = 0; lobby(); });
      el.querySelectorAll("[data-p]").forEach(b => b.addEventListener("click", () => { paper = PAPERS[+b.dataset.p]; SFX.select(); step = 2; fold(); }));
      const T = el.querySelector("#srT");
      if(T) T.addEventListener("click", () => {
        if(step === 2){ SFX.tap(); step = 3; fold(); }
        else if(step === 3){ wraps++; SFX.key(); if(wraps >= WRAPS){ step = 4; } fold(); }
        else if(step === 4){ SFX.place(); step = 5; fold(); }
      });
      el.querySelectorAll("[data-c]").forEach(b => b.addEventListener("click", () => { if(b.classList.contains("done")) return; puff++; SFX.key(); if(navigator.vibrate) try{ navigator.vibrate(15); }catch(e){}
        if(puff >= 5){ SFX.match(); fold(); setTimeout(() => { step = 6; fold(); }, 700); } else fold(); }));
      el.querySelectorAll("[data-i]").forEach(b => b.addEventListener("click", () => { el.querySelector("#srMsg").value = b.dataset.i; SFX.tap(); }));
      const put = el.querySelector("#srPut"), skip = el.querySelector("#srSkip");
      if(put) put.addEventListener("click", () => save(el.querySelector("#srMsg").value.trim()));
      if(skip) skip.addEventListener("click", () => save(""));
    }
    async function save(msg){
      if(busy) return; busy = true;
      const c = paper ? paper[0] : "#ffb3c6";
      const d = el.querySelector(".srDoneWrap"); if(d) d.classList.add("fly");
      SFX.heart();
      let r = null, e1 = null;
      try{ r = await rpc("star_send", { p_c: c, p_m: String(msg).slice(0, 40) }); }catch(e){ e1 = e; console.error(e); }
      busy = false;
      if(!r){ setTimeout(() => { step = 6; fold(); const mi = el.querySelector("#srMsg"); if(mi) mi.value = msg;
          const t = String(e1 && (e1.message || e1));
          ctx.toast(/jar_full/.test(t) ? "罐子滿了！回到罐子按「整理我的罐子」刪掉一些舊星星，就能放進去了" : /too_many_today/.test(t) ? "今天摺太多顆了，明天再繼續吧 ⭐" : noDb(e1) ? "星星罐正在升級中，請站長更新資料庫（更新 63）🙏" : "沒有放進去，網路不太穩，再按一次「放進罐子」試試", 4000); }, 300); return; }
      if((r.today || 0) < 10) ctx.update("pet", pt => { if(!pt || !window.PetLogic) return undefined; pt = window.PetLogic.norm(JSON.parse(JSON.stringify(pt))); pt.coins = (pt.coins||0) + 1; return pt; }).catch(()=>{});
      const last = +(localStorage.getItem("mw_starsNote") || 0);
      if(Date.now() - last > 3*3600e3 && p()){ localStorage.setItem("mw_starsNote", String(Date.now())); ctx.notifyPartner(`${ctx.me.name} 在等你的時候摺了星星給你 ⭐ 忙完打開「等你的星星罐」看看`); }
      ping();
      if(J){ J.mine = mine().concat([{ c, seen: false }]).slice(-50); J.mineN = (J.mineN || 0) + 1; J.today = (J.today || 0) + 1; }
      setTimeout(() => { step = 0; lobby(); const j = el.querySelector(".srJar.mine"); if(j){ j.classList.add("got"); } ctx.toast(`${star(c)} 放進罐子了！`); load(); }, 550);
    }
    // ---------- reading ----------
    async function openOne(){
      if(busy || !p()) return; busy = true; SFX.select();
      let x = null; try{ x = await rpc("star_open", { p_with: p().user_id }); }catch(e){ console.error(e); }
      busy = false;
      if(!x){ ctx.toast("沒有拆開，網路不太穩，再試一次"); load(); return; }
      showStar(x, true); ping(); load();
    }
    function showStar(x, unfold){
      const o = document.createElement("div"); o.className = "srModal";
      o.innerHTML = `<div class="srCard ${unfold ? "unfold" : ""}"><div class="srBig">${star(x.c, "big")}</div>
        <div class="srPaper" style="--pc:${x.c}">${x.m ? esc(x.m) : `<span class="srNo">（這顆沒有寫字，是滿滿的想念 ⭐）</span>`}</div>
        <div class="srWhen">${new Date(x.at).getMonth()+1}/${new Date(x.at).getDate()} ${String(new Date(x.at).getHours()).padStart(2,"0")}:${String(new Date(x.at).getMinutes()).padStart(2,"0")} 摺的</div>
        <button class="btn" id="srOk">收好 💛</button></div>`;
      document.body.appendChild(o);
      o.querySelector("#srOk").addEventListener("click", () => { SFX.tap(); o.remove(); lobby(); });
      o.addEventListener("click", e => { if(e.target === o){ o.remove(); lobby(); } });
    }
    // 看全部星星：一次 100 顆，可以往前翻；自己摺的可以選起來刪掉（罐子滿了騰空間）
    async function listView(isMine, delMode){
      const pp = p(), from = isMine ? me() : pp && pp.user_id; if(!from) return;
      const o = document.createElement("div"); o.className = "srModal";
      let tot = isMine ? (J && J.mineN) || 0 : (J && J.theirN) || 0, opened = (J && J.mineSeen) || 0; const cap = (J && J.cap) || 3000;
      const sel = new Set(); let del = !!delMode, before = null, first = true, arm = false;
      o.innerHTML = `<div class="srCard list"><h3>${isMine ? `我摺給 ${esc(pp ? pp.name : "ta")} 的星星` : `${esc(pp.name)} 摺給你的星星`}</h3>
        <div class="k srSum" style="text-align:center"></div>
        ${isMine ? `<div class="srDelBar"></div>` : ""}
        <div class="srList"><div class="k" style="text-align:center;padding:10px">讀取中…</div></div>
        <button class="btn" id="srOk">關掉</button></div>`;
      document.body.appendChild(o);
      const L = o.querySelector(".srList"), bar = o.querySelector(".srDelBar"), sum = o.querySelector(".srSum");
      const paintSum = () => { sum.innerHTML = isMine ? `共 ${tot} 顆・${pp ? `${esc(pp.name)} 拆了 ${opened} 顆` : "還沒有人可以拆"}<br>罐子可以放 ${cap} 顆${tot >= cap ? "，<b style='color:var(--pinkT)'>已經滿了</b>" : `，還有 ${cap - tot} 顆空位`}` : `共 ${tot} 顆`; };
      function paintBar(){
        if(!bar) return; arm = false;
        bar.innerHTML = del ? `<span>已選 <b>${sel.size}</b> 顆</span><button class="btn sub" data-b="all">全選</button><button class="btn sub" data-b="no">取消</button><button class="btn srDelGo" data-b="go" ${sel.size ? "" : "disabled"}>刪掉</button>`
          : `<button class="btn sub" data-b="on">🧹 自己選要刪的</button><button class="btn sub" data-b="old">刪最舊的 100 顆（已拆的）</button>`;
        bar.querySelectorAll("[data-b]").forEach(x => x.addEventListener("click", async () => { const k = x.dataset.b; SFX.tap();
          if(k === "on"){ del = true; L.classList.add("pick"); paintBar(); }
          else if(k === "no"){ del = false; sel.clear(); L.classList.remove("pick"); L.querySelectorAll(".on").forEach(r => r.classList.remove("on")); paintBar(); }
          else if(k === "all"){ L.querySelectorAll("[data-id]").forEach(r => { sel.add(+r.dataset.id); r.classList.add("on"); }); paintBar(); }
          else if(k === "old"){
            if(!arm){ arm = true; x.textContent = "確定要刪嗎？再按一次"; setTimeout(() => { if(x.isConnected && arm){ arm = false; x.textContent = "刪最舊的 100 顆（已拆的）"; } }, 3000); return; }
            x.disabled = true; x.textContent = "刪除中…"; let n = null;
            try{ n = await rpc("star_del_old", { p_n: 100 }); }catch(e){ console.error(e); }
            ctx.toast(n == null ? "沒刪掉，網路不太穩，再試一次" : n ? `刪掉最舊的 ${n} 顆了，罐子多了 ${n} 個空位 ⭐` : "沒有已經拆過的星星可以刪，自己選要刪的吧");
            if(n){ ping(); await load(); if(J){ tot = J.mineN || 0; opened = J.mineSeen || 0; } before = null; first = true; L.innerHTML = ""; more(); }
            paintSum(); paintBar();
          }
          else if(k === "go"){
            if(!arm){ arm = true; x.textContent = `確定刪掉 ${sel.size} 顆？`; setTimeout(() => { if(x.isConnected && arm){ arm = false; x.textContent = "刪掉"; } }, 3000); return; }
            x.disabled = true; x.textContent = "刪除中…";
            const ids = [...sel]; let n = 0, bad = false;
            for(let i = 0; i < ids.length; i += 500){ try{ n += await rpc("star_del", { p_ids: ids.slice(i, i + 500) }) || 0; }catch(e){ console.error(e); bad = true; break; } }
            ids.forEach(id => { const r = L.querySelector(`[data-id="${id}"]`); if(r) r.remove(); }); sel.clear();
            tot = Math.max(0, tot - n); paintSum(); paintBar();
            ctx.toast(bad ? "有些沒刪掉，網路不太穩，再試一次" : `刪掉 ${n} 顆了，罐子多了 ${n} 個空位 ⭐`);
            ping(); await load(); if(J){ tot = J.mineN || 0; opened = J.mineSeen || 0; paintSum(); }
          }
        }));
      }
      const row = x => `<div data-id="${x.id}">${isMine ? `<b class="srChk"></b>` : ""}${star(x.c)}<span>${x.m ? esc(x.m) : isMine ? `<span class="srNo">（沒寫字）</span>` : "⭐"}</span><i>${new Date(+x.at).getMonth()+1}/${new Date(+x.at).getDate()}${isMine ? `<br><b class="srSeen ${x.seen ? "y" : ""}">${x.seen ? "已拆" : "還沒拆"}</b>` : ""}</i></div>`;
      L.addEventListener("click", e => { if(!del) return; const r = e.target.closest("[data-id]"); if(!r) return; const id = +r.dataset.id;
        if(sel.has(id)){ sel.delete(id); r.classList.remove("on"); } else { sel.add(id); r.classList.add("on"); } SFX.tap(); paintBar(); });
      async function more(){
        const mb = L.querySelector(".srMore"); if(mb){ mb.disabled = true; mb.textContent = "讀取中…"; }
        let xs = null; try{ xs = await rpc("star_list", { p_from: from, p_before: before, p_lim: 100 }); }catch(e){ console.error(e); }
        if(!o.isConnected) return;
        if(first){ L.innerHTML = ""; first = false; }
        if(mb) mb.remove();
        if(!xs){ L.insertAdjacentHTML("beforeend", `<button class="btn sub srMore" style="width:100%">讀不到，再試一次</button>`); }
        else {
          const raw = xs.length; if(raw) before = Math.min(...xs.map(x => +x.id));
          if(!isMine) xs = xs.filter(x => x.seen);   // 還沒拆的先藏起來，要一顆一顆拆
          L.insertAdjacentHTML("beforeend", xs.map(row).join(""));
          if(raw === 100) L.insertAdjacentHTML("beforeend", `<button class="btn sub srMore" style="width:100%;margin-top:6px">再看更早的星星</button>`);
          if(!L.querySelector("[data-id]")) L.insertAdjacentHTML("afterbegin", `<div class="k" style="text-align:center;padding:10px">${isMine ? "罐子是空的" : "還沒有拆開的星星"}</div>`);
        }
        const nb = L.querySelector(".srMore"); if(nb) nb.addEventListener("click", e => { e.stopPropagation(); more(); });
      }
      paintSum(); paintBar(); if(del) L.classList.add("pick");
      more();
      o.querySelector("#srOk").addEventListener("click", () => { o.remove(); lobby(); });
      o.addEventListener("click", e => { if(e.target === o){ o.remove(); lobby(); } });
    }
    this._u = ctx.onState("stars", async st => { await absorb(st); load(); });
    this._alive = () => { alive = false; };
    lobby();
    (async () => { const cur = await ctx.getState("stars").catch(()=>null); await absorb(cur && cur.state); load(); })();
    if(window.__mock) window.__sr = { J: () => J };
  },
  unmount(){ if(this._u) this._u(); if(this._alive) this._alive(); document.querySelectorAll(".srModal").forEach(m => m.remove()); },
});

if(window.GameArt) window.GameArt.stars = () => `<span class="gaL srArt" style="left:22%;top:6%;width:56%;height:88%"><span class="srLidA"></span>${[["#ffb3c6",18,10],["#fff09a",50,8],["#b8e2ff",30,34],["#c6f0c2",58,30],["#d9c8ff",14,54],["#ffd59e",44,56]].map(([c,l,b])=>`<i style="left:${l}%;bottom:${b}%">${Pix.icon("star",{Y:c})}</i>`).join("")}</span>`;
})();

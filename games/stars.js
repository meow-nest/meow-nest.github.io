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
    let s = null, step = 0, paper = null, wraps = 0, puff = 0, busy = false;
    const me = () => ctx.me.uid;
    const p = () => ctx.partner();
    const mine = () => (s && s.s && s.s[me()]) || [];
    const theirs = () => (s && s.s && p() && s.s[p().user_id]) || [];
    const today = () => new Date().toDateString();
    function jar(list, cls, label){
      const n = list.length, show = list.slice(-50);
      const stars = show.map((x, i) => { const k = n - show.length + i, row = Math.floor(k / 5), col = k % 5;
        const left = 4 + col*17 + (hash(k)*6 - 3) + (row % 2 ? 7 : 0), bottom = 3 + row*10 + hash(k+7)*4;
        return `<i style="left:${Math.min(84, Math.max(4, left))}%;bottom:${Math.min(88, bottom)}%;transform:rotate(${(hash(k+3)*70-35)|0}deg)" class="${x.seen === false && cls === "theirs" ? "new" : ""}">${star(x.c)}</i>`; }).join("");
      return `<div class="srJar ${cls}"><div class="srLid"></div><div class="srGlass">${stars}</div><div class="srLabel">${label}</div></div>`;
    }
    function lobby(){
      const pp = p(), t = theirs(), unread = t.filter(x => !x.seen).length, todayN = mine().filter(x => new Date(x.at).toDateString() === today()).length;
      const pbusy = pp && ctx.isBusy && ctx.isBusy(pp.user_id);
      el.innerHTML = `<div class="box srBox">
        <div class="srTop"><div class="srCat">${ctx.sprite(ctx.me.cat || "orange", pbusy ? "normal" : "happy")}</div>
          <p class="srIntro">${pbusy ? `${esc(pp.name)} 在忙…<br>摺幾顆星星，等 ta 忙完吧 ⭐` : pp ? `摺一顆星星，在裡面藏一句話，<br>放進要送給 ${esc(pp.name)} 的罐子裡 ⭐` : "摺一顆星星放進罐子裡吧 ⭐"}</p></div>
        <div class="srJars">${jar(mine(), "mine", `給 ${esc(pp ? pp.name : "ta")}<b>${mine().length}</b>顆`)}${pp ? jar(t, "theirs", `${esc(pp.name)} 給你<b>${t.length}</b>顆`) : ""}</div>
        ${unread ? `<button class="btn srOpen" id="srOpen">💌 拆一顆 ${esc(pp.name)} 的星星（還有 ${unread} 顆沒拆）</button>` : t.length ? `<button class="btn sub" id="srRead" style="width:100%">📖 看 ${esc(pp.name)} 摺給你的星星</button>` : ""}
        <button class="btn" id="srGo">⭐ 摺一顆星星</button>
        <div class="k" style="text-align:center">今天摺了 ${todayN} 顆・每天前 10 顆各送 1 個貓幣 🪙</div></div>`;
      el.querySelector("#srGo").addEventListener("click", () => { SFX.tap(); step = 1; paper = null; wraps = 0; puff = 0; fold(); });
      const op = el.querySelector("#srOpen"); if(op) op.addEventListener("click", openOne);
      const rd = el.querySelector("#srRead"); if(rd) rd.addEventListener("click", readAll);
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
      const c = paper ? paper[0] : "#ffb3c6", at = Date.now();
      const todayN = mine().filter(x => new Date(x.at).toDateString() === today()).length;
      // fly into the jar
      const d = el.querySelector(".srDoneWrap"); if(d) d.classList.add("fly");
      SFX.heart();
      const ns = await ctx.update("stars", st => { st = st || {}; st.s = st.s || {}; const a = (st.s[me()] = st.s[me()] || []); a.push({ c, m: String(msg).slice(0, 40), at, seen: false }); if(a.length > 300) a.splice(0, a.length - 300); return st; });
      busy = false;
      if(ns){ s = ns;
        if(todayN < 10) ctx.update("pet", pt => { if(!pt || !window.PetLogic) return undefined; pt = window.PetLogic.norm(JSON.parse(JSON.stringify(pt))); pt.coins = (pt.coins||0) + 1; return pt; }).catch(()=>{});
        const last = +(localStorage.getItem("mw_starsNote") || 0);
        if(Date.now() - last > 3*3600e3 && p()){ localStorage.setItem("mw_starsNote", String(Date.now())); ctx.notifyPartner(`${ctx.me.name} 在等你的時候摺了星星給你 ⭐ 忙完打開「等你的星星罐」看看`); }
      }
      setTimeout(() => { step = 0; lobby(); const j = el.querySelector(".srJar.mine"); if(j){ j.classList.add("got"); } ctx.toast(`${star(c)} 放進罐子了！`); }, 550);
    }
    // ---------- reading ----------
    async function openOne(){
      const t = theirs(), i = t.findIndex(x => !x.seen); if(i < 0) return;
      const x = t[i]; SFX.select();
      showStar(x, true);
      await ctx.update("stars", st => { const a = st && st.s && st.s[p().user_id]; if(!a) return undefined; const y = a.find(z => z.at === x.at); if(!y || y.seen) return undefined; y.seen = true; return st; });
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
    function readAll(){
      const t = theirs().slice().reverse();
      const o = document.createElement("div"); o.className = "srModal";
      o.innerHTML = `<div class="srCard list"><h3>${esc(p().name)} 摺給你的星星</h3><div class="srList">${t.map(x => `<div>${star(x.c)}<span>${x.m ? esc(x.m) : "⭐"}</span><i>${new Date(x.at).getMonth()+1}/${new Date(x.at).getDate()}</i></div>`).join("")}</div><button class="btn" id="srOk">關掉</button></div>`;
      document.body.appendChild(o);
      o.querySelector("#srOk").addEventListener("click", () => o.remove());
      o.addEventListener("click", e => { if(e.target === o) o.remove(); });
    }
    this._u = ctx.onState("stars", st => { s = st; if(!step) lobby(); });
    (async () => { const cur = await ctx.getState("stars").catch(()=>null); s = cur ? cur.state : null; lobby(); })();
    if(window.__mock) window.__sr = { s: () => s };
  },
  unmount(){ if(this._u) this._u(); document.querySelectorAll(".srModal").forEach(m => m.remove()); },
});

if(window.GameArt) window.GameArt.stars = () => `<span class="gaL srArt" style="left:22%;top:6%;width:56%;height:88%"><span class="srLidA"></span>${[["#ffb3c6",18,10],["#fff09a",50,8],["#b8e2ff",30,34],["#c6f0c2",58,30],["#d9c8ff",14,54],["#ffd59e",44,56]].map(([c,l,b])=>`<i style="left:${l}%;bottom:${b}%">${Pix.icon("star",{Y:c})}</i>`).join("")}</span>`;
})();

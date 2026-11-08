// 遊戲：貓貓翻牌配對
// 自己玩：16 張牌，看幾步能全部配對。兩個人：20 張牌輪流翻，翻到一對可以再翻一次，配對多的人贏。
(function(){
const FACES = [["orange","happy"],["black","surprised"],["white","love"],["calico","happy"],["gray","sleep"],
  ["orange","cry"],["black","love"],["white","angry"],["calico","sleep"],["gray","surprised"]];
const face = i => Pix.sprite(FACES[i][0], FACES[i][1]);
const shuffle = a => { for(let i=a.length-1;i>0;i--){ const j = (Math.random()*(i+1))|0; [a[i],a[j]] = [a[j],a[i]]; } return a; };
const deck = pairs => shuffle(Array.from({ length: pairs*2 }, (_, i) => i % pairs));

App.registerGame({
  id: "memory",
  solo: true,
  name: "貓貓翻牌配對",
  desc: "翻出兩張一樣的貓咪，考考記憶力",
  icon: () => Pix.sprite("calico","happy"),
  mount(el, ctx){
    const { esc, SFX } = ctx, K = window.MiniKit;
    let s = null, d = null, view = "lobby", alive = true, missT = 0, fallT = 0, soloStop = () => {};
    const me = () => ctx.me.uid, partner = () => ctx.partner();
    const cardsHtml = (n, cols, isUp, isGot) => `<div class="mmG" style="grid-template-columns:repeat(${cols},1fr)">${Array.from({ length: n }, (_, i) =>
      `<button class="mmC ${isUp(i) ? "up" : ""} ${isGot(i) ? "got" : ""}" data-i="${i}"><span class="mmIn"><span class="mmBk">${Pix.icon("paw")}</span><span class="mmFr" data-f="${i}"></span></span></button>`).join("")}</div>`;
    const fillFaces = (root, deckArr, isUp) => root.querySelectorAll(".mmFr").forEach(f => { const i = +f.dataset.f; f.innerHTML = isUp(i) ? face(deckArr[i]) : ""; });
    function render(){
      if(!alive) return;
      if(view === "solo") return;
      if(view === "duo" && d && d.deck) return drawDuo();
      view = "lobby";
      const p = partner();
      el.innerHTML = `<div class="box skLobby">
        <div class="mmHero">${[0,2,4].map(i => `<i>${face(i)}</i>`).join("")}<i class="bk">${Pix.icon("paw")}</i></div>
        <p class="skIntro">翻開兩張牌，<b>一樣的貓咪</b>就配對成功 🐾<br>不一樣就會蓋回去，記住牠們在哪裡吧！</p>
        ${K.bestRows(ctx, s, v => `${v} 步`)}
        <button class="btn" id="mmSolo">🧠 自己玩（16 張）</button>
        ${p ? `<button class="btn mint" id="mmDuo">🐾 跟 ${esc(p.name)} 輪流翻（20 張）</button>` : ""}
        ${p && d && d.deck && !d.over ? `<button class="btn sub" id="mmCont">繼續剛剛那局</button>` : ""}
        <div class="k" style="text-align:center">自己玩：越少步越厲害，最多得 3 個貓幣 🪙${p ? "<br>兩個人：翻到一對可以再翻一次，配對多的人贏" : ""}</div></div>`;
      el.querySelector("#mmSolo").addEventListener("click", solo);
      const bd = el.querySelector("#mmDuo"); if(bd) bd.addEventListener("click", newDuo);
      const bc = el.querySelector("#mmCont"); if(bc) bc.addEventListener("click", () => { view = "duo"; drawDuo(); });
    }
    // ---------- 自己玩 ----------
    function solo(){
      SFX.tap(); view = "solo";
      const dk = deck(8), got = new Set(); let open = [], moves = 0, lock = false, t0 = performance.now(), done = false;
      el.innerHTML = `<div class="box mm"><div class="m3Hud"><div><span>步數</span><b id="mmMv">0</b></div><div class="m3T"><span>時間</span><b id="mmTm">0:00</b></div></div>
        ${cardsHtml(16, 4, () => false, () => false)}<div style="text-align:center;margin-top:8px"><button class="btn sub" id="mmQuit">回到大廳</button></div></div>`;
      const G = el.querySelector(".mmG");
      const tm = setInterval(() => { const sec = Math.floor((performance.now()-t0)/1000); const e = el.querySelector("#mmTm"); if(e) e.textContent = `${(sec/60)|0}:${String(sec%60).padStart(2,"0")}`; }, 500);
      soloStop = () => clearInterval(tm);
      el.querySelector("#mmQuit").addEventListener("click", () => { soloStop(); view = "lobby"; render(); });
      const flip = (i, up) => { const c = G.children[i]; if(up) c.querySelector(".mmFr").innerHTML = face(dk[i]); c.classList.toggle("up", up); };
      G.addEventListener("click", async e => {
        const c = e.target.closest(".mmC"); if(!c || lock || done) return; const i = +c.dataset.i;
        if(got.has(i) || open.includes(i)) return;
        SFX.key(.9); flip(i, true); open.push(i);
        if(open.length < 2) return;
        moves++; el.querySelector("#mmMv").textContent = moves;
        const [a, b] = open; open = [];
        if(dk[a] === dk[b]){ got.add(a); got.add(b); SFX.match(); [a,b].forEach(j => G.children[j].classList.add("got"));
          if(got.size === 16){ done = true; soloStop(); finishSolo(moves, Math.round((performance.now()-t0)/1000)); } }
        else { lock = true; await K.wait(750); SFX.miss(); flip(a, false); flip(b, false); lock = false; }
      });
    }
    async function finishSolo(moves, sec){
      SFX.level(); ctx.burst();
      const coins = moves <= 10 ? 3 : moves <= 14 ? 2 : 1, foe = K.foeBest(ctx, s), p = partner();
      let rec = false; try{ rec = await K.saveBest(ctx, "memory", moves, true, { sec }); await K.giveCoins(ctx, coins, "memory"); }catch(e){ console.error(e); }
      if(rec && p) ctx.notifyPartner(`${ctx.me.name} 在「貓貓翻牌配對」只用 ${moves} 步就全部配對，新紀錄！${foe != null && moves < foe ? "比你還厲害喔 😼" : ""}`);
      if(!alive || view !== "solo") return;
      const end = document.createElement("div"); end.className = "m3End";
      end.innerHTML = `<div class="m3EndBox">${Pix.sprite(ctx.me.cat || "orange", rec ? "love" : "happy")}<h3>${rec ? "🎉 新紀錄！" : "全部配對完成！"}</h3><div class="m3Big2">${moves} 步</div>
        <div class="k">花了 ${(sec/60)|0} 分 ${sec%60} 秒</div>${foe != null ? `<div class="k">${esc(p.name)} 的最佳：${foe} 步</div>` : ""}<div class="k">得到 ${coins} 個貓幣 🪙</div>
        <button class="btn" id="mmAgain">再玩一次</button><button class="btn sub" id="mmLob">回到大廳</button></div>`;
      el.querySelector(".mm").appendChild(end);
      end.querySelector("#mmAgain").addEventListener("click", solo);
      end.querySelector("#mmLob").addEventListener("click", () => { view = "lobby"; render(); });
    }
    // ---------- 兩個人輪流 ----------
    async function newDuo(){
      const p = partner(); if(!p) return; SFX.tap();
      await ctx.update("memoryduo", () => ({ deck: deck(10), got: {}, open: [], turn: me(), sc: { [me()]: 0, [p.user_id]: 0 }, miss: 0, over: false, by: me(), at: Date.now() }));
      ctx.notifyPartner(`${ctx.me.name} 想跟你玩「貓貓翻牌配對」，輪到 ${ctx.me.name} 先翻 🐾`);
      view = "duo"; drawDuo();
    }
    function drawDuo(){
      if(!d || !d.deck) { view = "lobby"; return render(); }
      const p = partner(), myT = d.turn === me() && !d.over, other = p ? p.user_id : null;
      const name = uid => uid === me() ? "你" : esc(ctx.nameOf(uid) || (p && p.name) || "ta");
      const sc = d.sc || {}, total = Object.keys(d.got || {}).length / 2;
      let msg;
      if(d.over){ const a = sc[me()]||0, b = sc[other]||0; msg = a > b ? "🎉 你贏了！" : a < b ? `${name(other)} 贏了！下次加油 🐾` : "平手！默契滿分 💕"; }
      else msg = myT ? (d.miss ? "沒有配對到…" : d.open.length === 1 ? "再翻一張！" : "輪到你翻牌") : `等 ${name(d.turn)} 翻牌中…`;
      el.innerHTML = `<div class="box mm"><div class="mmScore">
          <div class="${d.turn===me()&&!d.over?"on":""}">${Pix.sprite(ctx.me.cat||"orange","happy")}<b>你</b><span>${sc[me()]||0}</span></div>
          <div class="mmMsg">${msg}<i>${total} / 10 對</i></div>
          <div class="${d.turn===other&&!d.over?"on":""}">${Pix.sprite(p ? ctx.catOf(other) || p.cat : "white","happy")}<b>${p ? esc(p.name) : "ta"}</b><span>${sc[other]||0}</span></div></div>
        ${cardsHtml(20, 5, i => d.open.includes(i) || d.got[i] != null, i => d.got[i] != null)}
        <div style="text-align:center;margin-top:8px;display:flex;gap:8px;justify-content:center">${d.over ? `<button class="btn" id="mmRe">再來一局</button>` : ""}<button class="btn sub" id="mmBack">回到大廳</button></div></div>`;
      const G = el.querySelector(".mmG");
      fillFaces(G, d.deck, i => d.open.includes(i) || d.got[i] != null);
      G.querySelectorAll(".mmC").forEach(c => { const g = d.got[+c.dataset.i]; if(g != null) c.classList.add(g === me() ? "mine" : "theirs"); });
      el.querySelector("#mmBack").addEventListener("click", () => { view = "lobby"; render(); });
      const re = el.querySelector("#mmRe"); if(re) re.addEventListener("click", newDuo);
      G.addEventListener("click", e => { const c = e.target.closest(".mmC"); if(c) flipDuo(+c.dataset.i); });
      // 沒配對到：翻牌的人 1 秒後蓋回去換人；萬一對方斷線，另一個人 3 秒後幫忙
      clearTimeout(missT); clearTimeout(fallT);
      if(d.miss && !d.over){ const at = d.miss;
        const resolve = () => ctx.update("memoryduo", st => { if(!st || st.miss !== at) return undefined; st.open = []; st.miss = 0; st.turn = Object.keys(st.sc).find(u => u !== st.turn) || st.turn; return st; });
        if(d.turn === me()) missT = setTimeout(resolve, 1100); else fallT = setTimeout(resolve, 3200); }
    }
    let flipping = false;
    async function flipDuo(i){
      if(!d || d.over || d.turn !== me() || d.miss || flipping) return;
      if(d.got[i] != null || d.open.includes(i)) return;
      flipping = true; SFX.key(.9);
      let res = null;
      try{
        await ctx.update("memoryduo", st => {
          if(!st || st.over || st.turn !== me() || st.miss || st.got[i] != null || st.open.includes(i) || st.open.length >= 2) return undefined;
          st.open.push(i); res = "open";
          if(st.open.length === 2){ const [a, b] = st.open;
            if(st.deck[a] === st.deck[b]){ st.got[a] = st.got[b] = me(); st.sc[me()] = (st.sc[me()]||0) + 1; st.open = []; res = "match";
              if(Object.keys(st.got).length === st.deck.length){ st.over = true; res = "over"; } }
            else { st.miss = Date.now(); res = "miss"; } }
          st.at = Date.now(); return st; });
      }finally{ flipping = false; }
      if(res === "match") SFX.match(); else if(res === "miss") setTimeout(() => SFX.miss(), 700);
      else if(res === "over"){ SFX.level(); const st = d, p = partner(); const a = (st.sc||{})[me()]||0, b = p ? (st.sc||{})[p.user_id]||0 : 0;
        if(a > b) ctx.burst();
        ctx.notifyPartner(`「貓貓翻牌配對」結束了：${ctx.me.name} ${a} 對、你 ${b} 對${a>b?"，下次贏回來吧 😼":a<b?"，你贏了 🎉":"，平手！"}`);
        await K.giveCoins(ctx, a > b ? 2 : 1, "memory"); }
    }
    this._u1 = ctx.onState("memory", st => { s = st; if(view === "lobby") render(); });
    this._u2 = ctx.onState("memoryduo", st => {
      d = st;
      if(view === "duo" || (view === "lobby" && st && st.by !== me() && !st.over && Date.now() - (st.at||0) < 15000)){ view = "duo"; drawDuo(); }
      else if(view === "lobby") render(); });
    this._stop = () => { alive = false; soloStop(); clearTimeout(missT); clearTimeout(fallT); };
    (async () => {
      const [a, b] = await Promise.all([ctx.getState("memory").catch(() => null), ctx.getState("memoryduo").catch(() => null)]);
      s = a ? a.state : null; d = b ? b.state : null; render(); })();
  },
  unmount(){ if(this._u1) this._u1(); if(this._u2) this._u2(); if(this._stop) this._stop(); },
});
if(window.GameArt) window.GameArt.memory = () => `<span class="gaL mmArt" style="left:4%;top:8%;width:42%"><i>${Pix.sprite("calico","happy")}</i></span><span class="gaL mmArt bk" style="right:4%;top:20%;width:42%"><i>${Pix.icon("paw")}</i></span>`;
})();

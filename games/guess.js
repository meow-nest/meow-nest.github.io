// 遊戲：終極密碼（兩個人）
// 💣 炸彈模式：系統偷偷想一個 1～100 的數字，兩個人輪流猜，範圍越縮越小，猜中的人就爆炸輸了！
// 🔐 出題模式：一個人出題、另一個人猜，看幾次猜中；換人再來一次，次數少的人贏。
(function(){
const O = "#5a3b2e";
const P = (rows, pal) => { pal = Object.assign({ O }, pal); const w = Math.max(...rows.map(r=>r.length)), h = rows.length; let r = "";
  rows.forEach((row,y)=>[...row].forEach((c,x)=>{ if(pal[c]) r += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${pal[c]}"/>`; }));
  return `<svg viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg">${pxC(r)}</svg>`; };
const BOMB = ["........YR..",".......Y.R..","......OOO...",".....OKKO...","...OOOOOOO..","..OBBBBBBBO.",".OBWWBBBBBBO",".OBWBBBBBBBO","OBBBBBBBBBBBO".slice(0,12),".OBBBBBBBBBO",".OBBBBBBBBBO","..OBBBBBBBO.","...OOOOOOO.."];
const bomb = () => P(BOMB, { B: "#3a3542", W: "#8a8494", K: "#8a8494", Y: "#ffcf4a", R: "#ff7a3a" });
const LOCK = ["...OOOO...","..O....O..",".O......O.",".O......O.","OOOOOOOOOO","OYYYYYYYYO","OYYYOOYYYO","OYYYOOYYYO","OYYYYOYYYO","OYYYYYYYYO","OOOOOOOOOO"];
const lock = () => P(LOCK, { Y: "#ffcf4a" });

App.registerGame({
  id: "guess",
  name: "終極密碼",
  desc: "1～100 猜數字，猜中炸彈的人輸",
  icon: bomb,
  mount(el, ctx){
    const { esc, SFX } = ctx;
    let s = null, inp = "", alive = true, sending = false, boomShown = null;
    const me = () => ctx.me.uid, partner = () => ctx.partner();
    const other = st => Object.keys((st && st.sc) || {}).find(u => u !== me()) || (partner() && partner().user_id);
    const nm = uid => uid === me() ? "你" : esc(ctx.nameOf(uid) || (partner() && partner().name) || "ta");
    async function start(mode){
      const p = partner(); if(!p){ ctx.toast("要等 ta 加入小窩才能一起玩喔"); return; } SFX.tap();
      const prev = s || {}; view = "game";
      await ctx.update("guess", () => {
        const base = { mode, lo: 1, hi: 100, guesses: [], over: false, by: me(), at: Date.now(), sc: prev.sc || { [me()]: 0, [p.user_id]: 0 }, rounds: {} };
        if(mode === "bomb") return Object.assign(base, { secret: 1 + ((Math.random()*100)|0), turn: me() });
        return Object.assign(base, { secret: null, setter: me(), guesser: p.user_id, turn: me() });
      });
      ctx.notifyPartner(mode === "bomb" ? `${ctx.me.name} 開了一局「終極密碼」💣 範圍 1～100，猜中的人輸！` : `${ctx.me.name} 在「終極密碼」出了一個 1～100 的數字給你猜 🔐`);
      inp = "";
    }
    function lobby(){
      const p = partner(), sc = (s && s.sc) || {};
      el.innerHTML = `<div class="box skLobby">
        <div class="gsHero"><i>${Pix.sprite("orange","surprised")}</i><b>${bomb()}</b><i>${Pix.sprite("white","happy")}</i></div>
        <p class="skIntro">終極密碼就是猜 <b>1～100</b> 的數字！<br>每猜一次，範圍就會縮小 🐾</p>
        <div class="gsModes">
          <button class="gsMode" data-m="bomb">${bomb()}<b>💣 炸彈模式</b><span>系統出題，兩個人輪流猜，<br>猜中密碼的人就爆炸輸了！</span></button>
          <button class="gsMode" data-m="set">${lock()}<b>🔐 出題模式</b><span>你出題給 ta 猜，看幾次猜中，<br>再換 ta 出題，次數少的人贏</span></button>
        </div>
        ${p ? `<div class="k" style="text-align:center">總成績：你 ${sc[me()]||0} 勝・${esc(p.name)} ${sc[p.user_id]||0} 勝</div>` : `<div class="k" style="text-align:center">要等 ta 加入小窩才能一起玩喔</div>`}
        ${s && !s.over && s.mode ? `<button class="btn sub" id="gsCont">繼續剛剛那局</button>` : ""}</div>`;
      el.querySelectorAll(".gsMode").forEach(b => b.addEventListener("click", () => start(b.dataset.m)));
      const c = el.querySelector("#gsCont"); if(c) c.addEventListener("click", () => { view = "game"; draw(); });
    }
    let view = "lobby";
    function draw(){
      if(!alive) return;
      if(view === "lobby" || !s || !s.mode) { view = "lobby"; return lobby(); }
      const st = s, o = other(st), bombM = st.mode === "bomb";
      const setting = !bombM && st.secret == null;
      const canGuess = !st.over && !setting && (bombM ? st.turn === me() : st.guesser === me());
      const canSet = setting && st.setter === me();
      let msg;
      if(st.over){
        if(bombM) msg = st.loser === me() ? `💥 你猜中了 ${st.secret}…爆炸！${nm(o)} 贏了` : `💥 ${nm(st.loser)} 猜中了 ${st.secret}，爆炸！你贏了 🎉`;
        else { const r = st.rounds || {}, a = r[me()], b = r[o];
          msg = a != null && b != null ? (a < b ? `🎉 你只用 ${a} 次，${nm(o)} 用了 ${b} 次，你贏了！` : a > b ? `${nm(o)} 用 ${b} 次，你用 ${a} 次，${nm(o)} 贏了！` : `都用了 ${a} 次，平手 💕`)
            : `${nm(st.guesser)} 用了 ${st.guesses.length} 次猜中 ${st.secret}！`; }
      }
      else if(setting) msg = canSet ? "想一個 1～100 的數字當密碼" : `等 ${nm(st.setter)} 出題中…`;
      else if(bombM) msg = canGuess ? "輪到你猜！小心別猜中 💣" : `等 ${nm(st.turn)} 猜…`;
      else msg = canGuess ? `猜猜看 ${nm(st.setter)} 的密碼！` : `${nm(st.guesser)} 正在猜你的密碼（${st.secret}）`;
      const swapNext = !bombM && st.over && (st.rounds || {})[st.setter] == null;
      el.innerHTML = `<div class="box gs">
        <div class="gsTop">${bombM ? bomb() : lock()}<div class="gsMsg">${msg}</div></div>
        <div class="gsRange ${st.over ? "over" : ""}">${st.over ? `<span>密碼是</span><b>${st.secret}</b>` : setting ? `<b>？</b>` : `<b>${st.lo}</b><i>～</i><b>${st.hi}</b>`}</div>
        <div class="gsHist">${st.guesses.slice(-8).map(g => `<span class="${g.res}">${nm(g.by)}：${g.n}${g.res === "lo" ? " ⬆ 太小" : g.res === "hi" ? " ⬇ 太大" : " 💥"}</span>`).join("") || `<span class="k">${bombM ? `${nm(st.turn)} 先猜` : setting ? "" : "還沒有人猜"}</span>`}</div>
        ${canGuess || canSet ? `<div class="gsInp" id="gsInp">${inp || "<i>輸入數字</i>"}</div>
          <div class="gsPad">${[1,2,3,4,5,6,7,8,9].map(n => `<button data-k="${n}">${n}</button>`).join("")}<button data-k="del">⌫</button><button data-k="0">0</button><button data-k="ok" class="ok">${canSet ? "出題" : "猜！"}</button></div>` : ""}
        <div class="gsBtns">${st.over ? (swapNext ? `<button class="btn" id="gsSwap">換${st.guesser === me() ? "你" : ` ${nm(st.guesser)} `}出題</button>` : `<button class="btn" id="gsRe">再玩一次</button>`) : ""}<button class="btn sub" id="gsBack">回到大廳</button></div></div>`;
      el.querySelector("#gsBack").addEventListener("click", () => { view = "lobby"; lobby(); });
      const re = el.querySelector("#gsRe"); if(re) re.addEventListener("click", () => start(st.mode));
      const sw = el.querySelector("#gsSwap"); if(sw) sw.addEventListener("click", swapRole);
      el.querySelectorAll(".gsPad button").forEach(b => b.addEventListener("click", () => key(b.dataset.k, canSet)));
      if(st.over && bombM && boomShown !== st.at){ boomShown = st.at; const box = el.querySelector(".gsRange"); box.classList.add("boom"); SFX.boom && SFX.boom(true); if(st.loser !== me()) ctx.burst(); }
    }
    function key(k, setMode){
      if(sending) return;
      if(k === "del"){ inp = inp.slice(0, -1); SFX.del(); }
      else if(k === "ok") return submit(setMode);
      else if(inp.length < 3){ inp = (inp + k).replace(/^0+/, ""); SFX.key(.9); }
      const box = el.querySelector("#gsInp"); if(box) box.innerHTML = inp || "<i>輸入數字</i>";
    }
    async function submit(setMode){
      const n = parseInt(inp, 10), st = s;
      if(!n){ ctx.toast("先輸入一個數字喔"); return; }
      if(setMode){ if(n < 1 || n > 100){ ctx.toast("密碼要在 1～100 之間"); return; } }
      else if(n < st.lo || n > st.hi){ ctx.toast(`要猜 ${st.lo}～${st.hi} 之間的數字喔`); return; }
      sending = true; inp = "";
      try{
        await ctx.update("guess", g => {
          if(!g || g.over) return undefined;
          if(setMode){ if(g.secret != null || g.setter !== me()) return undefined; g.secret = n; return g; }
          const bombM = g.mode === "bomb";
          if(bombM ? g.turn !== me() : g.guesser !== me()) return undefined;
          if(n < g.lo || n > g.hi) return undefined;
          const res = n === g.secret ? "hit" : n < g.secret ? "lo" : "hi";
          g.guesses.push({ by: me(), n, res });
          if(res === "lo") g.lo = n + 1; else if(res === "hi") g.hi = n - 1;
          if(res === "hit"){ g.over = true; g.at = Date.now();
            const o = Object.keys(g.sc).find(u => u !== me());
            if(bombM){ g.loser = me(); g.sc[o] = (g.sc[o]||0) + 1; }
            else { g.rounds = g.rounds || {}; g.rounds[me()] = g.guesses.length;
              const a = g.rounds[me()], b = g.rounds[o]; if(a != null && b != null){ if(a < b) g.sc[me()] = (g.sc[me()]||0) + 1; else if(b < a) g.sc[o] = (g.sc[o]||0) + 1; } } }
          else if(bombM) g.turn = Object.keys(g.sc).find(u => u !== me());
          return g; });
        const g = s; const last = g && g.guesses[g.guesses.length-1];
        if(setMode) SFX.select(); else if(last && last.res === "hit"){ if(g.mode !== "bomb") { SFX.level(); ctx.burst(); } }
        else SFX.place();
      }finally{ sending = false; }
    }
    async function swapRole(){
      const st = s, p = partner(); if(!st || !p) return; SFX.tap();
      view = "game";
      await ctx.update("guess", g => { if(!g || !g.over || g.mode !== "set") return undefined;
        const ns = { mode: "set", lo: 1, hi: 100, guesses: [], over: false, by: me(), at: Date.now(), sc: g.sc, rounds: g.rounds || {}, secret: null, setter: g.guesser, guesser: g.setter, turn: g.guesser };
        return ns; });
      inp = "";
    }
    this._u = ctx.onState("guess", st => { const fresh = st && (!s || st.at !== s.at) && st.by !== me() && !st.over; s = st;
      if(fresh) view = "game"; if(view === "game" || fresh) draw(); else lobby(); });
    this._stop = () => { alive = false; };
    (async () => { const cur = await ctx.getState("guess").catch(() => null); s = cur ? cur.state : null;
      view = s && s.mode && !s.over ? "game" : "lobby"; draw(); })();
  },
  unmount(){ if(this._u) this._u(); if(this._stop) this._stop(); },
});
if(window.GameArt) window.GameArt.guess = () => `<span class="gaL" style="left:2%;bottom:0;width:48%">${Pix.sprite("orange","surprised")}</span><span class="gaL" style="right:6%;top:8%;width:44%">${bomb()}</span>`;
})();

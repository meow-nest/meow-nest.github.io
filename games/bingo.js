// 遊戲：喵喵賓果（兩人對戰數字賓果）
// 開局先選幾條線算贏（3／4／5），兩個人各自把 1～25 排進 5×5 的格子（看不到對方的）。
// 輪流喊號碼，兩邊有這個號碼的格子都會蓋上貓掌章，先連成指定條數的線就贏！
// 沒有另一半的時候可以跟「喵喵電腦」練習。
(function(){
const O = "#5a3b2e";
const PX = (rows, pal) => { pal = Object.assign({ O }, pal); const w = Math.max(...rows.map(r => r.length)), h = rows.length; let r = "";
  rows.forEach((row, y) => [...row].forEach((c, x) => { if(pal[c]) r += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${pal[c]}"/>`; }));
  return `<svg viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg">${r}</svg>`; };
const PAW = PX(["..OO..OO..",".OPPOOPPO.",".OPPOOPPO.","..OO..OO..","...OOOO...","..OPPPPO..",".OPPPPPPO.",".OPPPPPPO.","..OOOOOO.."], { O: "#ffffff", P: "#ffffff" });
const PAWC = PX(["..OO..OO..",".OPPOOPPO.",".OPPOOPPO.","..OO..OO..","...OOOO...","..OPPPPO..",".OPPPPPPO.",".OPPPPPPO.","..OOOOOO.."], { O: "#c2405c", P: "#f0708d" });
const DICE = PX(["OOOOOOOO","OWWWWWWO","OWDWWDWO","OWWWWWWO","OWWDDWWO","OWWWWWWO","OWDWWDWO","OOOOOOOO"], { W: "#fff8ec", D: "#f0708d" });
const STAR = PX(["...O...","..OYO..","OOOYOOO","OYYYYYO",".OYYYO.","OYO.OYO","OO...OO"], { Y: "#ffd36b" });
const CROWN = PX(["O...O...O","OYO.OYO.O","OYYOYYOYO","OYYYRYYYO","OOOOOOOOO"], { Y: "#f6c45f", R: "#e5484d" });
const LINES = [];
for(let r = 0; r < 5; r++) LINES.push([0, 1, 2, 3, 4].map(c => r*5 + c));
for(let c = 0; c < 5; c++) LINES.push([0, 1, 2, 3, 4].map(r => r*5 + c));
LINES.push([0, 6, 12, 18, 24], [4, 8, 12, 16, 20]);
const doneLines = (board, called) => board ? LINES.map((L, i) => L.every(k => called.has(board[k])) ? i : -1).filter(i => i >= 0) : [];
const shuffle = () => { const a = Array.from({ length: 25 }, (_, i) => i + 1); for(let i = 24; i > 0; i--){ const j = (Math.random()*(i + 1))|0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const CPU = "__cpu";
const LETTERS = "BINGO";

App.registerGame({
  id: "bingo",
  solo: true,
  name: "喵喵賓果",
  desc: "排好 1～25，輪流喊號碼，先連線的贏！",
  icon: () => `<span style="display:block;width:100%">${PAWC}</span>`,
  mount(el, ctx){
    const { esc, SFX } = ctx;
    let s = null, alive = true, cpuG = null, mode = null, draft = Array(25).fill(0), lastSeenCalls = -1, lastLines = 0, shownEnd = null, cpuTimer = 0;
    const me = () => ctx.me.uid;
    const pt = () => ctx.partner();
    const G = () => mode === "cpu" ? cpuG : s && s.g;
    const oppId = g => g.players.find(u => u !== me());
    const oppName = g => oppId(g) === CPU ? "喵喵電腦" : (pt() ? pt().name : "ta");
    const oppCat = g => oppId(g) === CPU ? { cat: "black" } : (pt() || { cat: "white" });
    const cat = (u, mood, cls) => `<span class="bgCat ${cls || ""}">${ctx.sprite((u && u.cat) || "orange", mood || "normal")}</span>`;
    const meObj = () => ({ cat: ctx.me.cat, name: ctx.me.name });

    // 改遊戲狀態：跟電腦玩只存在這支手機，跟 ta 玩存到伺服器
    async function mutate(fn){
      if(mode === "cpu"){ const r = fn(cpuG); if(r !== undefined) cpuG = r; render(); cpuMaybe(); return true; }
      let ok = false;
      await ctx.update("bingo", st => { st = st ? JSON.parse(JSON.stringify(st)) : {}; const r = fn(st.g || null, st); if(r === undefined) return undefined; st.g = r; ok = true; return st; });
      render(); return ok;
    }
    function newGame(target, vsCpu){
      const p = vsCpu ? CPU : pt().user_id, players = [me(), p];
      return { id: Date.now().toString(36), target, phase: "setup", players, boards: vsCpu ? { [CPU]: shuffle() } : {}, ready: vsCpu ? { [CPU]: true } : {}, calls: [], by: [], turn: players[(Math.random()*2)|0], winner: null, at: Date.now() };
    }
    function afterCall(g){
      const called = new Set(g.calls); const win = g.players.filter(u => doneLines(g.boards[u], called).length >= g.target);
      if(win.length){ g.phase = "end"; g.winner = win.length === 2 ? "tie" : win[0]; g.endAt = Date.now(); }
      else g.turn = g.players.find(u => u !== g.turn);
      return g;
    }
    async function call(n){
      const g = G(); if(!g || g.phase !== "play" || g.turn !== me() || g.calls.includes(n)) return;
      SFX.key(1.2);
      const ok = await mutate((gg, st) => { if(!gg || gg.phase !== "play" || gg.turn !== me() || gg.calls.includes(n)) return undefined; gg.calls.push(n); gg.by.push(me()); afterCall(gg);
        if(gg.phase === "end" && st){ st.wins = st.wins || {}; if(gg.winner !== "tie") st.wins[gg.winner] = (st.wins[gg.winner] || 0) + 1; } return gg; });
      if(ok && mode !== "cpu"){ const g2 = G(); if(g2.phase === "end") ctx.notifyPartner(g2.winner === me() ? `${ctx.me.name} 賓果連線贏了！快去看看` : `賓果結束了！快去看看結果`); else ctx.notifyPartner(`${ctx.me.name} 喊了 ${n} 號，換你喊號碼囉！（喵喵賓果）`); }
    }
    // 喵喵電腦：挑一個最能讓自己連線的號碼
    function cpuMaybe(){
      clearTimeout(cpuTimer); const g = cpuG; if(!g || g.phase !== "play" || g.turn !== CPU) return;
      cpuTimer = setTimeout(() => { if(!alive || cpuG !== g) return; const b = g.boards[CPU], called = new Set(g.calls); let best = null, bs = -1;
        for(let k = 0; k < 25; k++){ const n = b[k]; if(called.has(n)) continue; let sc = Math.random()*.5; for(const L of LINES) if(L.includes(k)){ const m = L.filter(j => called.has(b[j])).length; sc += m*m + (m === 4 ? 20 : 0); } if(sc > bs){ bs = sc; best = n; } }
        g.calls.push(best); g.by.push(CPU); afterCall(g); SFX.key(.9); render(); }, 1100);
    }
    async function ready(){
      if(draft.some(x => !x)) return;
      const arr = draft.slice();
      await mutate(g => { if(!g || g.phase !== "setup") return undefined; g.boards[me()] = arr; g.ready[me()] = true; if(g.players.every(u => g.ready[u])) g.phase = "play"; return g; });
      SFX.select(); if(mode !== "cpu"){ const g = G(); ctx.notifyPartner(g.phase === "play" ? `賓果開始了！${g.turn === pt().user_id ? "你先喊號碼" : `${ctx.me.name} 先喊`}` : `${ctx.me.name} 排好賓果了，換你排囉！`); }
    }

    // ---------- 畫面 ----------
    function lobby(){
      const p = pt(), g = s && s.g, wins = (s && s.wins) || {};
      const going = g && g.phase !== "end";
      el.innerHTML = `<div class="box bgBox">
        <div class="bgTitle">${LETTERS.split("").map((c, i) => `<span style="--i:${i}">${c}</span>`).join("")}</div>
        <div class="bgSub">喵喵賓果</div>
        <p class="bgHint">兩個人各自把 1～25 排進格子裡，<br>輪流喊號碼，先連成指定條數的線就贏！</p>
        ${going && p ? `<button class="btn bgBig" id="bgBack">${I(PAWC)} 回到和 ${esc(p.name)} 的這一局</button>` : ""}
        <div class="bgPick"><div class="bgPickH">幾條線算贏？</div><div class="bgSeg">${[3, 4, 5].map(n => `<button data-n="${n}" class="${n === 5 ? "on" : ""}">${n} 條</button>`).join("")}</div></div>
        ${p ? `<button class="btn bgBig" id="bgVs">${going ? "重新開一局" : `和 ${esc(p.name)} 對戰`}</button>` : `<div class="bgHint small">等 ta 加入小窩，就可以兩個人對戰喔</div>`}
        <button class="btn sub bgBig" id="bgCpu">跟喵喵電腦練習</button>
        ${p ? `<div class="bgScore">${cat(meObj(), "happy")}<b>${wins[me()] || 0}</b><span>勝</span><i>：</i><span>勝</span><b>${wins[p.user_id] || 0}</b>${cat(p, "happy")}</div>` : ""}
      </div>`;
      let target = 5;
      el.querySelectorAll(".bgSeg button").forEach(b => b.addEventListener("click", () => { target = +b.dataset.n; el.querySelectorAll(".bgSeg button").forEach(x => x.classList.toggle("on", x === b)); SFX.tap(); }));
      const back = el.querySelector("#bgBack"); if(back) back.addEventListener("click", () => { mode = "vs"; render(); });
      const vs = el.querySelector("#bgVs"); if(vs) vs.addEventListener("click", async () => {
        if(going && !vs.dataset.ok){ vs.dataset.ok = 1; vs.textContent = "目前這局會不見喔，再按一次"; return; }
        mode = "vs"; draft = Array(25).fill(0); lastSeenCalls = -1; lastLines = 0; shownEnd = null;
        await mutate(() => newGame(target, false)); ctx.notifyPartner(`${ctx.me.name} 開了一局賓果（${target} 條線），快來排號碼！`); });
      el.querySelector("#bgCpu").addEventListener("click", () => { mode = "cpu"; draft = Array(25).fill(0); lastSeenCalls = -1; lastLines = 0; shownEnd = null; cpuG = newGame(target, true); SFX.select(); render(); });
    }
    const I = svg => `<span class="bgI">${svg}</span>`;
    function header(g){
      const o = { cat: oppCat(g).cat };
      const myL = doneLines(g.boards[me()], new Set(g.calls)).length, opL = doneLines(g.boards[oppId(g)], new Set(g.calls)).length;
      const slots = n => Array.from({ length: g.target }, (_, i) => `<span class="${i < n ? "on" : ""}">${g.target === 5 ? LETTERS[i] : i + 1}</span>`).join("");
      return `<div class="bgTop">
        <button class="btn sub bgMenu" id="bgMenu">◀ 選單</button><span class="bgGoal">${g.target} 條線獲勝</span></div>
        <div class="bgVsRow">
          <div class="bgSide ${g.turn === me() && g.phase === "play" ? "turn" : ""}">${cat(meObj(), myL >= g.target ? "happy" : "normal")}<b>你</b><div class="bgSlots">${slots(myL)}</div></div>
          <div class="bgSide r ${g.turn !== me() && g.phase === "play" ? "turn" : ""}">${cat(o, opL >= g.target ? "happy" : "normal")}<b>${esc(oppName(g))}</b><div class="bgSlots">${slots(opL)}</div></div>
        </div>`;
    }
    function setup(g){
      const mineReady = g.ready[me()];
      const next = (() => { for(let n = 1; n <= 25; n++) if(!draft.includes(n)) return n; return 0; })();
      el.innerHTML = `<div class="box bgBox play">${header(g)}
        ${mineReady ? `<div class="bgBanner">${cat(oppCat(g), "normal")}<span>你排好了！等 ${esc(oppName(g))} 排完就開始</span></div>`
          : `<div class="bgBanner"><span>把 1～25 排進格子裡<br><small>點空格放下一個號碼，點已經放的可以拿掉</small></span></div>`}
        <div class="bgNext">${mineReady ? "" : next ? `下一個要放：<b>${next}</b>` : `排好了！按「準備好了」`}</div>
        <div class="bgCard setup">${(mineReady ? g.boards[me()] : draft).map((n, k) => `<button class="bgCell ${n ? "fill" : ""}" data-k="${k}" ${mineReady ? "disabled" : ""}><span>${n || ""}</span></button>`).join("")}</div>
        ${mineReady ? "" : `<div class="bgRow"><button class="btn sub" id="bgRand">${I(DICE)} 隨機排</button><button class="btn sub" id="bgClear">清空</button></div>
          <button class="btn bgBig" id="bgReady" ${draft.some(x => !x) ? "disabled" : ""}>準備好了！</button>`}
      </div>`;
      bindMenu();
      if(mineReady) return;
      el.querySelectorAll(".bgCell").forEach(b => b.addEventListener("click", () => { const k = +b.dataset.k;
        if(draft[k]) draft[k] = 0; else { if(!next) return; draft[k] = next; } SFX.tap(); setup(g); }));
      el.querySelector("#bgRand").addEventListener("click", () => { draft = shuffle(); SFX.select(); setup(g); });
      el.querySelector("#bgClear").addEventListener("click", () => { draft = Array(25).fill(0); SFX.tap(); setup(g); });
      el.querySelector("#bgReady").addEventListener("click", ready);
    }
    function play(g){
      const board = g.boards[me()], called = new Set(g.calls), lines = doneLines(board, called);
      const myTurn = g.phase === "play" && g.turn === me();
      const lastN = g.calls[g.calls.length - 1], lastBy = g.by[g.by.length - 1];
      const fresh = g.calls.length !== lastSeenCalls; const newLines = lines.length > lastLines;
      const opB = g.boards[oppId(g)], opMarks = opB ? opB.map(n => called.has(n)) : [];
      const showOpp = g.phase === "end";
      el.innerHTML = `<div class="box bgBox play">${header(g)}
        <div class="bgBallRow">
          <div class="bgBall ${fresh ? "roll" : ""}">${lastN ? `<b>${lastN}</b>` : `<small>還沒喊</small>`}</div>
          <div class="bgBallTxt">${g.phase === "end" ? "" : myTurn ? `<b class="bgYour">輪到你喊號碼！</b><small>點你格子裡還沒蓋章的號碼</small>` : `<b>等 ${esc(oppName(g))} 喊號碼…</b><small>${lastN ? `${lastBy === me() ? "你" : esc(oppName(g))} 剛剛喊了 ${lastN}` : `${esc(oppName(g))} 先喊`}</small>`}</div>
        </div>
        <div class="bgCard ${myTurn ? "myturn" : ""}">${board.map((n, k) => { const m = called.has(n), isLast = n === lastN;
            return `<button class="bgCell ${m ? "mark" : ""} ${isLast && fresh ? "stampNow" : ""} ${lines.some(li => LINES[li].includes(k)) ? "inLine" : ""}" data-n="${n}" ${myTurn && !m ? "" : "disabled"}><span>${n}</span>${m ? `<i class="bgStamp">${PAW}</i>` : ""}</button>`; }).join("")}
          <svg class="bgLines" viewBox="0 0 5 5">${lines.map((li, j) => { const L = LINES[li], a = L[0], b = L[4], x1 = a % 5 + .5, y1 = ((a/5)|0) + .5, x2 = b % 5 + .5, y2 = ((b/5)|0) + .5, dx = (x2 - x1)*.08, dy = (y2 - y1)*.08;
            return `<line x1="${x1 - dx}" y1="${y1 - dy}" x2="${x2 + dx}" y2="${y2 + dy}" class="${j >= lastLines && newLines ? "new" : ""}"/>`; }).join("")}</svg>
        </div>
        <div class="bgOpp"><div class="bgOppH">${esc(oppName(g))} 的格子${showOpp ? "" : "（只看得到蓋了幾格）"}</div>
          <div class="bgMini ${showOpp ? "show" : ""}">${opB ? opB.map((n, k) => `<span class="${opMarks[k] ? "on" : ""} ${showOpp && doneLines(opB, called).some(li => LINES[li].includes(k)) ? "ln" : ""}">${showOpp ? n : ""}</span>`).join("") : ""}</div></div>
        <div class="bgCalls">${g.calls.map((n, i) => `<span class="${g.by[i] === me() ? "me" : ""}">${n}</span>`).join("")}</div>
      </div>`;
      bindMenu();
      el.querySelectorAll(".bgCell:not([disabled])").forEach(b => b.addEventListener("click", () => call(+b.dataset.n)));
      if(fresh && lastSeenCalls >= 0 && lastBy !== me()) SFX.select();
      if(newLines && lastLines >= 0 && g.calls.length){ SFX.combo && SFX.combo(); }
      lastSeenCalls = g.calls.length; lastLines = lines.length;
      if(g.phase === "end" && shownEnd !== g.id + g.calls.length) { shownEnd = g.id + g.calls.length; setTimeout(() => endModal(g), 900); }
    }
    function endModal(g){
      if(!alive) return;
      const win = g.winner === me(), tie = g.winner === "tie";
      document.querySelectorAll(".bgEnd").forEach(x => x.remove());
      const o = document.createElement("div"); o.className = "careModal bgEnd";
      o.innerHTML = `<div class="cmBox"><div class="bgEndTitle ${win ? "win" : ""}">${tie ? "平手！" : win ? LETTERS.split("").map((c, i) => `<span style="--i:${i}">${c}</span>`).join("") + "<em>!</em>" : "差一點點～"}</div>
        <div class="bgEndCats">${cat(meObj(), win || tie ? "happy" : "normal")}${win ? `<span class="bgI big">${CROWN}</span>` : `<span class="bgI big">${STAR}</span>`}${cat(oppCat(g), !win ? "happy" : "normal")}</div>
        <h3>${tie ? "兩個人同時連成了！" : win ? `你先連成 ${g.target} 條線，贏了！` : `${esc(oppName(g))} 先連成 ${g.target} 條線`}</h3>
        <div class="k">一共喊了 ${g.calls.length} 個號碼</div>
        <div class="bgRow"><button class="btn sub" id="bgLook">看看格子</button><button class="btn" id="bgAgain">再玩一局</button></div></div>`;
      document.body.appendChild(o);
      if(win || tie){ SFX.level(); ctx.burst(); } else SFX.miss && SFX.miss();
      o.querySelector("#bgLook").addEventListener("click", () => o.remove());
      o.querySelector("#bgAgain").addEventListener("click", () => { o.remove(); mode = null; render(); });
    }
    function bindMenu(){ const m = el.querySelector("#bgMenu"); if(m) m.addEventListener("click", () => { clearTimeout(cpuTimer); if(mode === "cpu") cpuG = null; mode = null; render(); }); }
    function render(){
      if(!alive) return;
      if(mode === "vs" && !pt()) mode = null;
      const g = mode ? G() : null;
      if(!g){ mode = null; return lobby(); }
      if(g.phase === "setup") return setup(g);
      return play(g);
    }

    ctx.getState("bingo").catch(() => null).then(c => { s = c ? c.state : null;
      const g = s && s.g; if(g && g.phase !== "end" && pt() && g.players.includes(me())){ mode = "vs"; lastSeenCalls = g.calls.length; lastLines = doneLines(g.boards[me()], new Set(g.calls)).length; shownEnd = null; } render(); });
    this._u = ctx.onState("bingo", st => { const prev = s && s.g; s = st;
      if(mode === "vs"){ const g = s.g; if(g && prev && g.id !== prev.id){ draft = Array(25).fill(0); lastSeenCalls = -1; lastLines = 0; } render(); }
      else if(!mode){ const g = s.g; if(g && g.phase !== "end" && pt() && g.players.includes(me()) && (!prev || prev.id !== g.id)){ mode = "vs"; draft = Array(25).fill(0); lastSeenCalls = -1; lastLines = 0; } render(); } });
    this._stop = () => { alive = false; clearTimeout(cpuTimer); document.querySelectorAll(".bgEnd").forEach(x => x.remove()); };
  },
  unmount(){ if(this._u) this._u(); if(this._stop) this._stop(); },
});
if(window.GameArt) window.GameArt.bingo = () => { const cells = Array.from({ length: 9 }, (_, i) => `<i class="${[0, 4, 8, 2].includes(i) ? "on" : ""}">${[7, 12, 3, 21, 9, 15, 4, 18, 25][i]}</i>`).join("");
  return `<span class="gaL bgArt" style="left:18%;top:10%;width:64%">${cells}</span><span class="gaL" style="right:2%;bottom:0;width:34%">${Pix.sprite("calico", "happy")}</span>`; };
})();

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

// ---------- 印章（玩家自己選，開始之後這局就不能換） ----------
const HEAD = "M50 92 C24 92 10 78 10 60 C10 50 13 43 18 37 L16 10 L38 26 C42 25 46 24 50 24 C54 24 58 25 62 26 L84 10 L82 37 C87 43 90 50 90 60 C90 78 76 92 50 92 Z";
const LOAF = "M14 88 C8 88 6 80 8 72 C10 62 16 56 22 54 L20 34 L34 44 C40 42 46 42 52 43 L64 32 L64 48 C76 52 88 60 92 70 C96 80 92 88 84 88 Z";
const V = (body, st) => `<svg viewBox="0 0 100 100" ${st || ""}>${body}</svg>`;
const PXC = (() => { const rows = ["..O.........O..",".OPO.......OPO.",".OPPO.....OPPO.",".OPPPOOOOOPPPO.","OPPPPPPPPPPPPPO","OPPPPPPPPPPPPPO","OPPPPPPPPPPPPPO","OPPPPPPPPPPPPPO","OPPPPPPPPPPPPPO",".OPPPPPPPPPPPO.","..OPPPPPPPPPO..","...OOOOOOOOO..."]; let r = "";
  rows.forEach((row, y) => [...row].forEach((c, x) => { if(c !== ".") r += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${c === "O" ? "#c2405c" : "#f0708d"}"/>`; }));
  return `<svg viewBox="0 0 15 12" shape-rendering="crispEdges">${r}</svg>`; })();
const PAST = ["#f0708d", "#7cc9a0", "#a993e6", "#f6b84f", "#6fb3ee"];
const STAMPS = [
  ["A", "粉紅貓頭", () => V(`<path d="${HEAD}" fill="#f0708d" stroke="#c2405c" stroke-width="4"/><circle cx="34" cy="70" r="5" fill="#ffb3c6"/><circle cx="66" cy="70" r="5" fill="#ffb3c6"/>`)],
  ["B", "紅色印泥", () => V(`<path d="${HEAD}" fill="none" stroke="#d83a5a" stroke-width="7"/><path d="M30 64 q4 -6 8 0 M62 64 q4 -6 8 0" fill="none" stroke="#d83a5a" stroke-width="5" stroke-linecap="round"/><path d="M44 78 q6 6 12 0" fill="none" stroke="#d83a5a" stroke-width="4" stroke-linecap="round"/>`, `style="filter:url(#bgInk)"`)],
  ["C", "印泥貓頭", () => V(`<path d="${HEAD}" fill="#e2506f"/>`, `style="filter:url(#bgInk)"`)],
  ["D", "貓耳圓章", () => V(`<path d="M20 30 L22 6 L40 20 Z M80 30 L78 6 L60 20 Z" fill="#f0708d" stroke="#fff" stroke-width="3"/><circle cx="50" cy="56" r="38" fill="#f0708d" stroke="#fff" stroke-width="4"/><circle cx="50" cy="56" r="31" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="4 4"/><path d="M8 58 h14 M8 66 l14 -3 M92 58 h-14 M92 66 l-14 -3" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`)],
  ["E", "吐司貓", () => V(`<path d="${LOAF}" fill="#f0708d" stroke="#c2405c" stroke-width="4"/><path d="M84 74 q8 -2 10 -10" fill="none" stroke="#c2405c" stroke-width="4" stroke-linecap="round"/>`)],
  ["F", "貓頭貼紙", () => V(`<path d="${HEAD}" fill="#fff" stroke="#f0708d" stroke-width="7"/><ellipse cx="22" cy="72" rx="7" ry="4" fill="#ffc2d1"/><ellipse cx="78" cy="72" rx="7" ry="4" fill="#ffc2d1"/>`)],
  ["G", "像素貓頭", () => PXC],
  ["H", "三花貓頭", () => V(`<g clip-path="url(#bgHc)"><rect width="100" height="100" fill="#fffaf3"/><ellipse cx="22" cy="30" rx="22" ry="20" fill="#f2a65a"/><ellipse cx="80" cy="26" rx="18" ry="16" fill="#3f3542"/><ellipse cx="86" cy="84" rx="14" ry="10" fill="#f2a65a"/></g><path d="${HEAD}" fill="none" stroke="#5a3b2e" stroke-width="5"/>`)],
  ["I", "笑臉貓頭", () => V(`<path d="${HEAD}" fill="#f0708d" stroke="#c2405c" stroke-width="4"/><ellipse cx="36" cy="56" rx="4" ry="5" fill="#5a3b2e"/><ellipse cx="64" cy="56" rx="4" ry="5" fill="#5a3b2e"/><path d="M42 66 q4 5 8 0 q4 5 8 0" fill="none" stroke="#5a3b2e" stroke-width="3" stroke-linecap="round"/><ellipse cx="26" cy="68" rx="6" ry="4" fill="#ffc2d1"/><ellipse cx="74" cy="68" rx="6" ry="4" fill="#ffc2d1"/>`)],
  ["J", "大肉球", () => V(`<ellipse cx="50" cy="66" rx="30" ry="25" fill="#f0708d"/><ellipse cx="20" cy="38" rx="11" ry="13" fill="#f0708d"/><ellipse cx="40" cy="22" rx="11" ry="13" fill="#f0708d"/><ellipse cx="60" cy="22" rx="11" ry="13" fill="#f0708d"/><ellipse cx="80" cy="38" rx="11" ry="13" fill="#f0708d"/>`)],
  ["K", "金色貓頭", () => V(`<path d="${HEAD}" fill="url(#bgGold)" stroke="#a8721a" stroke-width="4"/><path d="M26 44 q6 -10 16 -12" stroke="#fffbe0" stroke-width="5" fill="none" stroke-linecap="round" opacity=".9"/>`)],
  ["L", "紅色印鑑", () => V(`<circle cx="50" cy="50" r="44" fill="none" stroke="#d83a5a" stroke-width="6"/><circle cx="50" cy="50" r="36" fill="none" stroke="#d83a5a" stroke-width="2"/><path transform="translate(26 14) scale(.48)" d="${HEAD}" fill="#d83a5a"/>`, `style="filter:url(#bgInk)"`)],
  ["N", "彩色貓頭", k => V(`<path d="${HEAD}" fill="${PAST[k % PAST.length]}" stroke="#5a3b2e" stroke-width="4"/>`)],
  ["O", "睡覺捲捲貓", () => V(`<circle cx="50" cy="54" r="40" fill="#f0708d" stroke="#c2405c" stroke-width="4"/><circle cx="50" cy="54" r="20" fill="#ffe3ea" stroke="#c2405c" stroke-width="3"/><path d="M22 30 L20 12 L34 22 Z M40 18 L44 4 L52 16 Z" fill="#f0708d" stroke="#c2405c" stroke-width="3" stroke-linejoin="round"/><path d="M24 36 q4 3 8 0 M36 30 q4 3 8 0" stroke="#5a3b2e" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M80 78 q12 -6 8 -22" stroke="#c2405c" stroke-width="7" fill="none" stroke-linecap="round"/>`)],
];
const STAMP = Object.fromEntries(STAMPS.map(x => [x[0], x]));
const stampSvg = (id, k) => (STAMP[id] || STAMP.A)[2](k || 0);
function stampDefs(){ if(document.getElementById("bgDefs")) return; const d = document.createElement("div"); d.id = "bgDefs"; d.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
  d.innerHTML = `<svg width="0" height="0"><defs><filter id="bgInk" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="3" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="4" result="d"/><feTurbulence type="fractalNoise" baseFrequency="2.2" numOctaves="1" seed="8" result="m"/><feColorMatrix in="m" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.2 1.9" result="mm"/><feComposite in="d" in2="mm" operator="in"/></filter>
  <linearGradient id="bgGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff2b0"/><stop offset=".45" stop-color="#f6c45f"/><stop offset=".55" stop-color="#ffe49a"/><stop offset="1" stop-color="#d99a1e"/></linearGradient><clipPath id="bgHc"><path d="${HEAD}"/></clipPath></defs></svg>`;
  document.body.appendChild(d); }
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
    stampDefs();
    const SK = () => "bg_stamp_" + me();
    let myStamp = (() => { try{ const v = localStorage.getItem(SK()); return STAMP[v] ? v : "A"; }catch(e){ return "A"; } })();
    const setStamp = v => { myStamp = v; try{ localStorage.setItem(SK(), v); }catch(e){} };
    const stampOf = g => (g && g.stamps && g.stamps[me()]) || myStamp;
    const stampPrev = (id, n) => `<span class="bgCell mark st-${id} bgPrevCell"><i class="bgSt">${stampSvg(id, 2)}</i><span>${n || 7}</span></span>`;
    function stampPicker(after){
      document.querySelectorAll(".bgPick2").forEach(x => x.remove());
      const o = document.createElement("div"); o.className = "careModal bgPick2";
      o.innerHTML = `<div class="cmBox"><h3>選一個你喜歡的印章</h3><div class="k">被喊到的號碼會蓋上這個章，開始玩之後這一局就不能換了喔</div>
        <div class="bgStGrid">${STAMPS.map(x => `<button data-id="${x[0]}" class="${x[0] === myStamp ? "on" : ""}">${stampPrev(x[0], 7)}<small>${x[1]}</small></button>`).join("")}</div>
        <button class="btn sub" style="width:100%" id="bgPX">好了</button></div>`;
      document.body.appendChild(o);
      o.querySelectorAll(".bgStGrid button").forEach(b => b.addEventListener("click", () => { setStamp(b.dataset.id); SFX.tap(); o.querySelectorAll(".bgStGrid button").forEach(x => x.classList.toggle("on", x === b)); }));
      o.querySelector("#bgPX").addEventListener("click", () => { o.remove(); if(after) after(); });
    }

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
      await mutate(g => { if(!g || g.phase !== "setup") return undefined; g.boards[me()] = arr; g.ready[me()] = true; g.stamps = g.stamps || {}; g.stamps[me()] = myStamp; if(g.players.every(u => g.ready[u])) g.phase = "play"; return g; });
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
        <button class="bgMyStamp" id="bgStampBtn">${stampPrev(myStamp, 7)}<span>我的印章：<b>${STAMP[myStamp][1]}</b><small>點這裡換一個</small></span></button>
        ${p ? `<button class="btn bgBig" id="bgVs">${going ? "重新開一局" : `和 ${esc(p.name)} 對戰`}</button>` : `<div class="bgHint small">等 ta 加入小窩，就可以兩個人對戰喔</div>`}
        <button class="btn sub bgBig" id="bgCpu">跟喵喵電腦練習</button>
        ${p ? `<div class="bgScore">${cat(meObj(), "happy")}<b>${wins[me()] || 0}</b><span>勝</span><i>：</i><span>勝</span><b>${wins[p.user_id] || 0}</b>${cat(p, "happy")}</div>` : ""}
      </div>`;
      let target = 5;
      el.querySelectorAll(".bgSeg button").forEach(b => b.addEventListener("click", () => { target = +b.dataset.n; el.querySelectorAll(".bgSeg button").forEach(x => x.classList.toggle("on", x === b)); SFX.tap(); }));
      el.querySelector("#bgStampBtn").addEventListener("click", () => stampPicker(() => lobby()));
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
        ${mineReady ? "" : `<button class="bgMyStamp small" id="bgStampBtn">${stampPrev(myStamp, 7)}<span>這局的印章：<b>${STAMP[myStamp][1]}</b><small>按「準備好了」之後就不能換囉</small></span></button>
          <div class="bgRow"><button class="btn sub" id="bgRand">${I(DICE)} 隨機排</button><button class="btn sub" id="bgClear">清空</button></div>
          <button class="btn bgBig" id="bgReady" ${draft.some(x => !x) ? "disabled" : ""}>準備好了！</button>`}
      </div>`;
      bindMenu();
      if(mineReady) return;
      el.querySelectorAll(".bgCell").forEach(b => b.addEventListener("click", () => { const k = +b.dataset.k;
        if(draft[k]) draft[k] = 0; else { if(!next) return; draft[k] = next; } SFX.tap(); setup(g); }));
      el.querySelector("#bgStampBtn").addEventListener("click", () => stampPicker(() => setup(g)));
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
      const showOpp = g.phase === "end", myS = stampOf(g);
      el.innerHTML = `<div class="box bgBox play">${header(g)}
        <div class="bgBallRow">
          <div class="bgBall ${fresh ? "roll" : ""}">${lastN ? `<b>${lastN}</b>` : `<small>還沒喊</small>`}</div>
          <div class="bgBallTxt">${g.phase === "end" ? "" : myTurn ? `<b class="bgYour">輪到你喊號碼！</b><small>點你格子裡還沒蓋章的號碼</small>` : `<b>等 ${esc(oppName(g))} 喊號碼…</b><small>${lastN ? `${lastBy === me() ? "你" : esc(oppName(g))} 剛剛喊了 ${lastN}` : `${esc(oppName(g))} 先喊`}</small>`}</div>
        </div>
        <div class="bgCard ${myTurn ? "myturn" : ""}">${board.map((n, k) => { const m = called.has(n), isLast = n === lastN;
            return `<button class="bgCell ${m ? `mark st-${myS}` : ""} ${isLast && fresh ? "stampNow" : ""} ${lines.some(li => LINES[li].includes(k)) ? "inLine" : ""}" data-n="${n}" ${myTurn && !m ? "" : "disabled"}>${m ? `<i class="bgSt">${stampSvg(myS, k)}</i>` : ""}<span>${n}</span></button>`; }).join("")}
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
    this._stop = () => { alive = false; clearTimeout(cpuTimer); document.querySelectorAll(".bgEnd,.bgPick2").forEach(x => x.remove()); };
  },
  unmount(){ if(this._u) this._u(); if(this._stop) this._stop(); },
});
if(window.GameArt) window.GameArt.bingo = () => { const cells = Array.from({ length: 9 }, (_, i) => `<i class="${[0, 4, 8, 2].includes(i) ? "on" : ""}">${[7, 12, 3, 21, 9, 15, 4, 18, 25][i]}</i>`).join("");
  return `<span class="gaL bgArt" style="left:18%;top:10%;width:64%">${cells}</span><span class="gaL" style="right:2%;bottom:0;width:34%">${Pix.sprite("calico", "happy")}</span>`; };
})();

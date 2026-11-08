// 遊戲：喵喵方塊（把方塊拖進格子，排滿一行或一列就消掉）
// 8×8 的格子，下面每次給 3 個貓貓方塊，拖到格子上放好；排滿一整行或一整列就會「喵～」爆掉。
// 方塊不能旋轉。連續消除有 Combo，一次消越多分數越高。3 個都放不下就結束。
// 沒玩完離開會幫你存著（存在這支手機）。
(function(){
const N = 8;
const O = "#5a3b2e";
const FURS = ["#f7a7c0","#f6a95c","#a9cdee","#9ed9b4","#c9b6f0","#ffe08a","#3b3140","#ff9f8f"];
const HEAD = [
  "OO........OO",
  "OKO......OKO",
  "OFFOOOOOOFFO",
  "OFLFFFFFFFFO",
  "OFFFFFFFFFFO",
  "OFFEFFFFEFFO",
  "OFFEFFFFEFFO",
  "OBFFFNNFFFBO",
  "OFFFMFFMFFFO",
  "OFFFFMMFFFFO",
  "ODDDDDDDDDDO",
  "OOOOOOOOOOOO"];
const hex = h => [1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
const shade = (h, a) => "#" + hex(h).map(v=>Math.max(0,Math.min(255,Math.round(a<0 ? v*(1+a) : v+(255-v)*a))).toString(16).padStart(2,"0")).join("");
const urls = {};
function cellUrl(ci, mode){
  const key = ci + (mode||""); if(urls[key]) return urls[key];
  const fur = FURS[ci], dark = ci === 6, happy = mode === "happy";
  const pal = { O, F:fur, L:shade(fur, .45), D:shade(fur, -.16), K:"#f7a7b8", E: dark ? "#ffd84d" : "#2b1d18", B:"#f59ab0", N:"#f0708d", M: dark ? "#f7d6dc" : "#2b1d18" };
  const cv = document.createElement("canvas"); cv.width = 12; cv.height = 12; const g = cv.getContext("2d");
  HEAD.forEach((row, y) => [...row].forEach((ch, x) => { const c = pal[ch]; if(c){ g.fillStyle = c; g.fillRect(x, y, 1, 1); } }));
  if(happy){ // ^ ^ eyes when they're about to blast
    g.fillStyle = pal.F; g.fillRect(3,6,1,1); g.fillRect(8,6,1,1);
    g.fillStyle = pal.E; [[2,6],[4,6],[7,6],[9,6]].forEach(([x,y]) => g.fillRect(x, y, 1, 1)); }
  return urls[key] = cv.toDataURL();
}
// shapes as [x,y] cells
const S = (rows) => { const c = []; rows.forEach((r, y) => [...r].forEach((ch, x) => { if(ch === "#") c.push([x, y]); })); return c; };
const SHAPES = [
  [S(["#"]), 3],
  [S(["##"]), 5], [S(["#","#"]), 5],
  [S(["###"]), 5], [S(["#","#","#"]), 5],
  [S(["####"]), 4], [S(["#","#","#","#"]), 4],
  [S(["#####"]), 2], [S(["#","#","#","#","#"]), 2],
  [S(["##","##"]), 6],
  [S(["###","###","###"]), 2],
  [S(["##","##","##"]), 2], [S(["###","###"]), 2],
  [S(["#.","##"]), 3], [S([".#","##"]), 3], [S(["##","#."]), 3], [S(["##",".#"]), 3],
  [S(["#..","#..","###"]), 2], [S(["..#","..#","###"]), 2], [S(["###","#..","#.."]), 2], [S(["###","..#","..#"]), 2],
  [S(["#.","#.","##"]), 3], [S([".#",".#","##"]), 3], [S(["##","#.","#."]), 3], [S(["##",".#",".#"]), 3],
  [S(["###","#.."]), 3], [S(["###","..#"]), 3], [S(["#..","###"]), 3], [S(["..#","###"]), 3],
  [S(["###",".#."]), 3], [S([".#.","###"]), 3], [S(["#.","##","#."]), 3], [S([".#","##",".#"]), 3],
  [S(["##.",".##"]), 3], [S([".##","##."]), 3], [S(["#.","##",".#"]), 3], [S([".#","##","#."]), 3],
  [S(["#.",".#"]), 1], [S([".#","#."]), 1],
];
const TOTALW = SHAPES.reduce((a, s) => a + s[1], 0);
function randShape(){ let r = Math.random()*TOTALW; for(let i=0;i<SHAPES.length;i++){ r -= SHAPES[i][1]; if(r < 0) return i; } return 0; }
const dims = cells => [Math.max(...cells.map(c=>c[0]))+1, Math.max(...cells.map(c=>c[1]))+1];
const fits = (board, cells, x, y) => cells.every(([cx, cy]) => { const X = x+cx, Y = y+cy; return X>=0 && Y>=0 && X<N && Y<N && board[Y*N+X] < 0; });
function canPlaceAnywhere(board, cells){ for(let y=0;y<N;y++) for(let x=0;x<N;x++) if(fits(board, cells, x, y)) return true; return false; }
function fullLines(board){ const rows = [], cols = []; for(let i=0;i<N;i++){ let r = true, c = true; for(let j=0;j<N;j++){ if(board[i*N+j] < 0) r = false; if(board[j*N+i] < 0) c = false; } if(r) rows.push(i); if(c) cols.push(i); } return { rows, cols }; }
// a new tray that is not instantly dead (try a few times to give at least one piece that fits)
function newTray(board){
  for(let t=0;t<12;t++){ const tray = [0,1,2].map(() => ({ s: randShape(), c: (Math.random()*FURS.length)|0 })); if(!board || tray.some(p => canPlaceAnywhere(board, SHAPES[p.s][0]))) return tray; }
  return [{ s:0, c:0 }, { s:1, c:1 }, { s:3, c:2 }];
}
const pieceHtml = (p, cell) => { const cells = SHAPES[p.s][0], [w, h] = dims(cells), u = cellUrl(p.c);
  return `<span class="bbPiece" style="width:${w*cell}px;height:${h*cell}px">${cells.map(([x,y])=>`<img src="${u}" style="left:${x*cell}px;top:${y*cell}px;width:${cell}px;height:${cell}px">`).join("")}</span>`; };

function play(opts){
  return new Promise(resolve => {
    const SFX = opts.sfx || {}; const snd = (k, ...a) => { try{ SFX[k] && SFX[k](...a); }catch(e){} };
    const KEY = "mw_blast";
    let g = null; try{ g = JSON.parse(localStorage.getItem(KEY) || "null"); }catch(e){}
    if(!g || !g.board || g.board.length !== N*N || opts.fresh) g = { board: Array(N*N).fill(-1), tray: null, score: 0, combo: 0, miss: 0, lines: 0 };
    if(!g.tray || !g.tray.length) g.tray = newTray(g.board);
    const save = () => { try{ localStorage.setItem(KEY, JSON.stringify(g)); }catch(e){} };
    const ov = document.createElement("div"); ov.className = "bbGame";
    ov.innerHTML = `<div class="bbHud"><button class="bbQuit" id="bbX">◀ 離開</button><div class="bbBest">${Pix.icon("crown")}<span id="bbBest">${opts.best||0}</span></div><button class="bbQuit" id="bbRe">↻ 重來</button></div>
      <div class="bbScore" id="bbSc">${g.score}</div><div class="bbCombo" id="bbCombo"></div>
      <div class="bbWrap"><div class="bbBoard" id="bbB">${Array.from({length:N*N}, (_, i) => `<i data-i="${i}"></i>`).join("")}</div><div class="bbPop" id="bbPop"></div></div>
      <div class="bbTray" id="bbT"></div>
      <div class="bbEnd hidden" id="bbEnd"></div>`;
    document.body.appendChild(ov);
    const $ = s => ov.querySelector(s), B = $("#bbB"), cellsEl = [...B.children];
    let cell = 40, drag = null, done = false, quitArm = 0, reArm = 0, blasting = false;
    function size(){
      const w = Math.min(window.innerWidth - 24, 440), h = window.innerHeight - 330;
      cell = Math.floor(Math.max(28, Math.min(w, h) - 12) / N);
      B.style.setProperty("--cell", cell + "px"); drawTray();
    }
    function drawBoard(preview, clearSet){
      cellsEl.forEach((el, i) => {
        const v = g.board[i], pv = preview && preview.has(i), cl = clearSet && clearSet.has(i);
        el.className = (v >= 0 ? "on" : "") + (pv ? " pv" : "") + (cl ? " cl" : "");
        el.style.backgroundImage = v >= 0 ? `url(${cellUrl(v, cl ? "happy" : "")})` : pv ? `url(${cellUrl(preview.c, cl ? "happy" : "")})` : "";
      });
    }
    function drawTray(){
      const tc = Math.max(16, Math.floor(cell * 0.52));
      $("#bbT").innerHTML = [0,1,2].map(k => { const p = g.tray[k];
        if(!p) return `<div class="bbSlot"></div>`;
        const ok = canPlaceAnywhere(g.board, SHAPES[p.s][0]);
        return `<div class="bbSlot ${ok ? "" : "no"}" data-k="${k}">${pieceHtml(p, tc)}</div>`; }).join("");
      $("#bbT").querySelectorAll("[data-k]").forEach(sl => sl.addEventListener("pointerdown", e => startDrag(e, +sl.dataset.k, sl)));
    }
    function pop(text, big){ const P = $("#bbPop"); P.textContent = text; P.className = "bbPop on" + (big ? " big" : ""); void P.offsetWidth; clearTimeout(pop.t); pop.t = setTimeout(() => { P.className = "bbPop"; }, 1100); }
    // ---------- dragging ----------
    function startDrag(e, k, slot){
      if(done || drag || blasting) return; e.preventDefault();
      const p = g.tray[k]; if(!p) return;
      const cells = SHAPES[p.s][0], [w, h] = dims(cells);
      const fl = document.createElement("div"); fl.className = "bbFloat"; fl.innerHTML = pieceHtml(p, cell); document.body.appendChild(fl);
      drag = { k, p, cells, w, h, fl, slot, x: -9, y: -9, ok: false, lift: Math.max(70, cell * 1.6) };
      slot.classList.add("lift"); snd("tap");
      try{ slot.setPointerCapture(e.pointerId); }catch(_){}
      move(e);
      slot.addEventListener("pointermove", move); slot.addEventListener("pointerup", end); slot.addEventListener("pointercancel", cancel);
    }
    function move(e){
      if(!drag) return;
      const left = e.clientX - drag.w*cell/2, top = e.clientY - drag.h*cell - drag.lift + cell*0.5;
      drag.fl.style.transform = `translate(${left}px,${top}px)`;
      const r = B.getBoundingClientRect(), x = Math.round((left - r.left - 6) / cell), y = Math.round((top - r.top - 6) / cell);
      if(x === drag.x && y === drag.y) return; drag.x = x; drag.y = y;
      drag.ok = fits(g.board, drag.cells, x, y);
      if(drag.ok){
        const pv = new Set(drag.cells.map(([cx, cy]) => (y+cy)*N + x+cx)); pv.c = drag.p.c;
        const tmp = g.board.slice(); pv.forEach(i => tmp[i] = drag.p.c); const fl = fullLines(tmp), cs = new Set();
        fl.rows.forEach(r2 => { for(let j=0;j<N;j++) cs.add(r2*N+j); }); fl.cols.forEach(c2 => { for(let j=0;j<N;j++) cs.add(j*N+c2); });
        drawBoard(pv, cs);
      } else drawBoard();
    }
    function cleanup(){ const d = drag; drag = null; if(!d) return d; d.slot.removeEventListener("pointermove", move); d.slot.removeEventListener("pointerup", end); d.slot.removeEventListener("pointercancel", cancel); return d; }
    function cancel(){ const d = cleanup(); if(!d) return; d.fl.remove(); d.slot.classList.remove("lift"); drawBoard(); }
    function end(){
      const d = cleanup(); if(!d) return;
      if(!d.ok){ d.fl.classList.add("back"); setTimeout(() => d.fl.remove(), 160); d.slot.classList.remove("lift"); drawBoard(); snd("miss"); return; }
      d.fl.remove(); place(d);
    }
    // ---------- placing + blasting ----------
    function place(d){
      d.cells.forEach(([cx, cy]) => g.board[(d.y+cy)*N + d.x+cx] = d.p.c);
      g.tray[d.k] = null; g.score += d.cells.length; snd("place");
      if(navigator.vibrate) try{ navigator.vibrate(12); }catch(e){}
      const fl = fullLines(g.board), n = fl.rows.length + fl.cols.length;
      if(n){
        g.combo++; g.miss = 0; g.lines += n;
        const pts = Math.round((n*10 + (n > 1 ? n*n*10 : 0)) * (1 + (g.combo-1)*0.5));
        g.score += pts;
        const cs = new Set(); fl.rows.forEach(r => { for(let j=0;j<N;j++) cs.add(r*N+j); }); fl.cols.forEach(c => { for(let j=0;j<N;j++) cs.add(j*N+c); });
        drawBoard(null, cs); blasting = true;
        const blast = [...cs];
        blast.forEach((i, k2) => { const el = cellsEl[i]; const order = fl.rows.length ? (i % N) : Math.floor(i / N); el.style.animationDelay = (order * 0.03) + "s"; el.classList.add("boom"); });
        snd(n >= 3 ? "level" : "combo", Math.min(g.combo, 8));
        if(g.combo >= 2){ const C = $("#bbCombo"); C.innerHTML = `Combo <b>${g.combo}</b>`; C.className = "bbCombo on"; void C.offsetWidth; }
        pop(n >= 4 ? "喵喵大爆破！🎉" : n === 3 ? "太厲害了！" : n === 2 ? "好棒！" : g.combo >= 3 ? `連續 ${g.combo} 次！` : "喵～", n >= 3);
        setTimeout(() => { blast.forEach(i => { g.board[i] = -1; cellsEl[i].classList.remove("boom"); cellsEl[i].style.animationDelay = ""; });
          if(g.board.every(v => v < 0)){ g.score += 300; pop("全部清空！+300 ✨", true); snd("level"); }
          blasting = false; after(); }, 380 + 8*30);
      } else {
        g.miss++; if(g.miss >= 3 && g.combo){ g.combo = 0; $("#bbCombo").className = "bbCombo"; }
        after();
      }
    }
    function after(){
      if(g.tray.every(x => !x)) g.tray = newTray(g.board);
      $("#bbSc").textContent = g.score; if(g.score > (opts.best||0)) $("#bbBest").textContent = g.score;
      drawBoard(); drawTray(); save();
      if(!g.tray.some(p => p && canPlaceAnywhere(g.board, SHAPES[p.s][0]))) setTimeout(over, 500);
    }
    function over(){
      if(done) return; done = true; snd("miss");
      cellsEl.forEach((el, i) => { if(g.board[i] >= 0){ el.style.animationDelay = (Math.floor(i/N)*0.05) + "s"; el.classList.add("grey"); } });
      const score = g.score, lines = g.lines, best = Math.max(opts.best||0, score), rec = score > (opts.best||0) && score > 0, coins = Math.min(60, lines);
      try{ localStorage.removeItem(KEY); }catch(e){}
      setTimeout(() => {
        const E = $("#bbEnd"); E.classList.remove("hidden");
        E.innerHTML = `<div class="bbCard"><div class="bbCats">${[0,1,6,2].map(c=>`<img src="${cellUrl(c, "happy")}">`).join("")}</div><h3>${rec ? "🎉 新紀錄！" : "放不下了～"}</h3>
          <p class="bbBig">${score}</p><p>消了 <b>${lines}</b> 行${rec ? "" : `<br>最高紀錄 ${best}`}${coins && opts.hasPet ? `<br>${coins} 個貓幣送進養貓房間了 🪙` : ""}</p>
          <div class="bbBtns"><button class="btn sub" id="bbBack">回去</button><button class="btn" id="bbAgain">再玩一次</button></div></div>`;
        Promise.resolve(opts.onEnd && opts.onEnd({ score, lines, coins, rec })).catch(()=>{});
        $("#bbBack").addEventListener("click", () => close("back"));
        $("#bbAgain").addEventListener("click", () => close("again"));
      }, 900);
    }
    function close(r){ if(ov.__closed) return; ov.__closed = true; window.removeEventListener("resize", size); if(drag){ drag.fl.remove(); drag = null; } ov.remove(); resolve(r); }
    ov.__close = () => { if(!done) save(); close("back"); };
    $("#bbX").addEventListener("click", () => { snd("tap"); if(!done) save(); close("back"); });
    $("#bbRe").addEventListener("click", () => { if(done) return; const t = Date.now(); if(t - reArm < 2500){ snd("tap"); try{ localStorage.removeItem(KEY); }catch(e){} close("again"); return; } reArm = t; const b = $("#bbRe"); b.textContent = "再按一次重來"; setTimeout(() => { if(b.isConnected) b.textContent = "↻ 重來"; }, 2500); });
    window.addEventListener("resize", size);
    size(); drawBoard();
    if(!g.tray.some(p => p && canPlaceAnywhere(g.board, SHAPES[p.s][0]))) setTimeout(over, 400);
    if(window.__mock) window.__bb = { g: () => g, place: (k, x, y) => { const p = g.tray[k]; if(!p || blasting) return false; const cells = SHAPES[p.s][0]; if(!fits(g.board, cells, x, y)) return false; place({ k, p, cells, x, y }); return true; }, busy: () => blasting, fits: (k, x, y) => g.tray[k] && fits(g.board, SHAPES[g.tray[k].s][0], x, y), set: (b, tray) => { g.board = b; if(tray) g.tray = tray; drawBoard(); drawTray(); }, over };
  });
}

window.CatBlocks = { play, cellUrl };
if(window.GameArt) window.GameArt.tetris = () => `<span class="gaL bbArt" style="left:6%;top:6%;width:88%;height:88%">${[[0,0,0],[1,0,0],[2,0,1],[0,1,3],[2,1,1],[3,1,1],[0,2,3],[1,2,3],[3,2,6],[0,3,5],[1,3,5],[2,3,2],[3,3,6]].map(([x,y,c])=>`<img src="${cellUrl(c)}" style="left:${x*25}%;top:${y*25}%">`).join("")}</span>`;

App.registerGame({
  id: "tetris",
  solo: true,
  name: "喵喵方塊",
  desc: "拖方塊排滿一行，喵～爆掉！",
  icon: () => Pix.sprite("orange","happy"),
  mount(el, ctx){
    const { esc, SFX } = ctx;
    let s = null;
    const me = () => ctx.me.uid;
    function lobby(){
      const p = ctx.partner(), best = (s && s.best) || {}, ln = (s && s.lines) || {};
      let saved = null; try{ saved = JSON.parse(localStorage.getItem("mw_blast") || "null"); }catch(e){}
      const row = (name, uid) => `<div><b>${esc(name)}</b><span>${best[uid]||0} 分</span><em>${ln[uid] ? `一局最多消 ${ln[uid]} 行` : "還沒玩過"}</em></div>`;
      el.innerHTML = `<div class="box tsLobby">
        <div class="bbDemo">${[[0,0,0],[1,0,0],[2,0,0],[3,0,0],[4,0,2],[5,0,2],[0,1,3],[1,1,3],[4,1,2],[5,1,2],[0,2,3],[1,2,6],[2,2,6],[3,2,6],[4,2,6],[5,2,1]].map(([x,y,c])=>`<img src="${cellUrl(c, y===2 ? "happy" : "")}" style="left:${x*16.66}%;top:${y*33.3}%">`).join("")}</div>
        <p class="tsIntro">把下面的貓貓方塊<b>拖進格子裡</b>，<br>排滿一整行或一整列就會「喵～」爆掉！</p>
        <div class="tsHow"><span>方塊不能轉</span><span>連續消除有 Combo</span><span>一次消越多分數越高</span><span>3 個都放不下就結束</span></div>
        <div class="tsBest">${row(ctx.me.name, me())}${p ? row(p.name, p.user_id) : ""}</div>
        <button class="btn" id="tsGo">${saved && saved.score ? `🐾 繼續上一局（${saved.score} 分）` : "🧱 開始玩！"}</button>
        <div class="k" style="text-align:center">每消一行得 1 個貓幣，會送進養貓房間 🪙・沒玩完離開會幫你存著</div></div>`;
      el.querySelector("#tsGo").addEventListener("click", go);
    }
    async function go(){
      if(document.querySelector(".bbGame")) return;
      SFX.tap();
      let again = true;
      while(again){
        const opts = { sfx: SFX, best: (s && s.best && s.best[me()]) || 0, hasPet: true };
        ctx.getState("pet").then(pet=>{ opts.hasPet = !!(pet && pet.state); }).catch(()=>{});
        const r = await play(Object.assign(opts, { onEnd: async r => {
          await ctx.update("blast", st=>{ st = st || {}; st.best = st.best||{}; st.lines = st.lines||{}; st.plays = st.plays||{};
            st.plays[me()] = (st.plays[me()]||0) + 1; if(r.score > (st.best[me()]||0)) st.best[me()] = r.score; if(r.lines > (st.lines[me()]||0)) st.lines[me()] = r.lines;
            st.last = { by:me(), score:r.score, at:Date.now() }; return st; });
          if(r.rec) ctx.notifyPartner(`${ctx.me.name} 在「喵喵方塊」拿到新紀錄：${r.score} 分！`);
          if(r.coins > 0) await ctx.update("pet", st=>{ if(!st || !window.PetLogic) return undefined; st = window.PetLogic.norm(JSON.parse(JSON.stringify(st)));
            st.coins = (st.coins||0) + r.coins; st.log = (st.log||[]).concat([{ by:me(), a:"tetris", n:r.coins, at:Date.now() }]).slice(-24); return st; });
        } }));
        again = r === "again";
      }
      lobby();
    }
    this._u = ctx.onState("blast", st=>{ s = st; if(!document.querySelector(".bbGame")) lobby(); });
    (async()=>{ const cur = await ctx.getState("blast").catch(()=>null); s = cur ? cur.state : null; lobby(); })();
  },
  unmount(){ if(this._u) this._u(); const g = document.querySelector(".bbGame"); if(g && g.__close) g.__close(); },
});
})();

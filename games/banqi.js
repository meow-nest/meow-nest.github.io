// 遊戲：喵喵暗棋（台灣翻翻棋）
// 32 顆貓頭棋子全部蓋著。輪到你可以「翻一顆」或「走一步／吃子」。第一個翻開的顏色就是你的隊伍。
// 大小：帥(貓王) > 仕 > 相 > 俥 > 傌 > 炮 > 兵(小奶貓)，一樣大可以互吃，小奶貓可以吃貓王、貓王不能吃小奶貓。
// 炮(砲砲貓)要隔一顆棋子跳過去吃，什麼都能吃。把對方吃光或讓對方沒棋可走就贏了。
(function(){
const ROWS = 8, COLS = 4;
const CH = { o:["","帥","仕","相","俥","傌","炮","兵"], b:["","將","士","象","車","馬","包","卒"] };
const CAT = ["","貓王","侍衛貓","軍師貓","戰車貓","騎士貓","砲砲貓","小奶貓"];
const TEAM = { o:"橘貓隊", b:"黑貓隊" };
const COUNT = [0,1,2,2,2,2,2,5];
const at = (r,c) => r*COLS + c, rc = i => [Math.floor(i/COLS), i%COLS];
const DIRS = [[1,0],[-1,0],[0,1],[0,-1]];

function fresh(p, sc){
  const pcs = []; for(const t of ["o","b"]) for(let k=1;k<=7;k++) for(let n=0;n<COUNT[k];n++) pcs.push({ t, k, up:false });
  for(let i=pcs.length-1;i>0;i--){ const j = (Math.random()*(i+1))|0; [pcs[i],pcs[j]] = [pcs[j],pcs[i]]; }
  return { v:1, board:pcs, p, turn:p[0], color:null, n:0, quiet:0, last:null, win:null, dead:{ o:[], b:[] }, sc: sc || {} };
}
const canEat = (a, b) => a === 7 && b === 1 ? true : a === 1 && b === 7 ? false : a <= b;
function moves(st, i){
  const pc = st.board[i]; if(!pc || !pc.up) return [];
  const [r, c] = rc(i), out = [];
  for(const [dr, dc] of DIRS){
    const R = r+dr, C = c+dc; if(R<0||C<0||R>=ROWS||C>=COLS) continue;
    const q = st.board[at(R,C)];
    if(!q) out.push({ to: at(R,C), eat:false });
    else if(pc.k !== 6 && q.up && q.t !== pc.t && canEat(pc.k, q.k)) out.push({ to: at(R,C), eat:true });
    if(pc.k === 6){ // cannon: jump exactly one piece
      let R2 = R, C2 = C, screen = false;
      while(R2>=0 && C2>=0 && R2<ROWS && C2<COLS){ const x = st.board[at(R2,C2)];
        if(x){ if(!screen) screen = true; else { if(x.up && x.t !== pc.t) out.push({ to: at(R2,C2), eat:true }); break; } }
        R2 += dr; C2 += dc; }
    }
  }
  return out;
}
// hidden piece: a cat hiding in a cardboard box, only ears + eyes peeking out
let boxSvg = null;
function hiddenArt(){
  if(boxSvg) return boxSvg;
  const W = 18, H = 18, g = Array.from({length:H}, () => Array(W).fill("."));
  const P = { O:"#5a3b2e", B:"#dba36b", D:"#b97f48", T:"#f3d7a6", G:"#c9bdb5", K:"#f7a7b8", E:"#2b1d18", L:"#e9b77f" };
  // head peeking (rows 1-8)
  for(let y=2;y<=8;y++) for(let x=3;x<=14;x++){ const dx = (x+.5-9)/6.2, dy = (y+.5-8)/6; if(dx*dx+dy*dy <= 1) g[y][x] = "G"; }
  [[4,1],[5,1],[4,2],[5,2],[6,2],[3,2]].forEach(([x,y])=>{ g[y][x] = "G"; g[y][17-x] = "G"; });
  g[2][4] = g[2][13] = "K"; g[3][5] = g[3][12] = "K";
  g[6][6] = g[6][11] = g[7][6] = g[7][11] = "E";
  // box (rows 8-17)
  for(let y=8;y<H;y++) for(let x=1;x<W-1;x++) g[y][x] = y < 10 ? "L" : "B";
  for(let x=1;x<W-1;x++) g[10][x] = "D";
  for(let y=10;y<H;y++){ g[y][8] = "T"; g[y][9] = "T"; }
  for(let x=2;x<W-2;x+=3) g[14][x] = "D";
  // outline
  const o = g.map(r=>r.slice());
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){ if(g[y][x] !== ".") continue; if((x>0&&g[y][x-1]!==".")||(x<W-1&&g[y][x+1]!==".")||(y>0&&g[y-1][x]!==".")||(y<H-1&&g[y+1][x]!==".")) o[y][x] = "O"; }
  for(let x=1;x<W-1;x++) o[8][x] = o[8][x] === "." ? "." : (o[8][x] === "G" ? "O" : o[8][x]);
  let r = ""; o.forEach((row,y)=>row.forEach((c,x)=>{ if(P[c]) r += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${P[c]}"/>`; }));
  return boxSvg = `<svg viewBox="0 0 ${W} ${H}" shape-rendering="crispEdges">${pxC(r)}</svg>`;
}
const POSE = ["", "happy", "angry", "normal", "surprised", "wave", "angry", "happy"];
function pieceArt(pc, extra){
  if(!pc) return "";
  if(!pc.up) return `<span class="bqP down ${extra||""}">${hiddenArt()}</span>`;
  const cat = Pix.sprite(pc.t === "o" ? "orange" : "black", POSE[pc.k]);
  const hat = pc.k === 1 ? `<i class="bqHat">${Pix.icon("crown")}</i>` : pc.k === 6 ? `<i class="bqFire">${Pix.icon("flame", { R:"#ff7a3a", Y:"#ffd36b" })}</i>` : "";
  return `<span class="bqP up ${pc.t} k${pc.k} ${extra||""}" title="${TEAM[pc.t]}・${CAT[pc.k]}"><span class="bqCat">${cat}</span>${hat}<b>${CH[pc.t][pc.k]}</b></span>`;
}
const alive = (st, t) => st.board.some(x => x && x.t === t);
function canAct(st, t){ if(st.board.some(x => x && !x.up)) return true; return st.board.some((x, i) => x && x.t === t && moves(st, i).length); }

App.registerGame({
  id: "banqi",
  name: "喵喵暗棋",
  desc: "翻翻棋！小奶貓可以吃貓王",
  icon: () => Pix.sprite("orange","surprised"),
  mount(el, ctx){
    const { esc, SFX } = ctx;
    let s = null, sel = -1, fx = null, busy = false;
    const me = () => ctx.me.uid;
    const myTeam = () => s && s.color ? s.color[me()] : null;
    const myTurn = () => s && !s.win && s.turn === me();
    const nm = u => u === me() ? "你" : ctx.nameOf(u);
    const piece = (pc, extra) => (extra === "sm" && pc) ? `<span class="bqTok ${pc.t}">${CH[pc.t][pc.k]}</span>` : pieceArt(pc, extra);
    el.innerHTML = `<div class="box bq"><div class="bqPl" id="bqPl"></div><div class="bqSt" id="bqSt"></div>
      <div class="bqDead" id="bqD1"></div><div class="bqBoard" id="bqB"></div><div class="bqDead" id="bqD2"></div>
      <details class="bqHelp"><summary>📖 大小規則</summary><div class="bqRank">${[1,2,3,4,5,6,7].map(k=>`<div>${piece({t:"o",k,up:true})}${piece({t:"b",k,up:true})}<span>${CAT[k]}</span></div>`).join("")}</div>
        <p>大的吃小的，一樣大可以互吃。<b>小奶貓（兵卒）可以吃貓王</b>，貓王不能吃小奶貓。<br><b>砲砲貓</b>要隔一顆棋子跳過去吃，什麼都能吃。<br>每次可以翻一顆，或走一格（上下左右）。連續 50 步都沒翻棋也沒吃子就算平手。</p></details>
      <div style="text-align:center;margin-top:8px"><button class="btn sub" id="bqNew">重新開一局</button></div></div>`;
    const $ = q => el.querySelector(q);
    function ui(){
      if(!s){ $("#bqSt").textContent = ctx.partner() ? "準備中…" : `等${ctx.pw ? ctx.pw() : "另一半"}加入就可以玩了`; $("#bqB").innerHTML = ""; return; }
      const team = u => s.color ? s.color[u] : null;
      $("#bqPl").innerHTML = s.p.map(u => `<div class="${s.turn===u && !s.win ? "on" : ""} ${team(u)||""}"><b>${esc(nm(u))}</b><span>${team(u) ? TEAM[team(u)] : "還沒翻"}</span><em>${(s.sc && s.sc[u]) || 0} 勝</em></div>`).join(`<i>vs</i>`);
      const St = $("#bqSt");
      if(s.win) St.innerHTML = s.win === "draw" ? "平手 🤝" : s.win === me() ? `<b>你贏了！</b> 🏆` : `${esc(nm(s.win))} 贏了～`;
      else if(myTurn()) St.innerHTML = `<b>輪到你了！</b>${s.color ? "翻一顆或走一步" : "翻開一顆決定你的隊伍"}`;
      else St.textContent = `等 ${nm(s.turn)} 下棋…`;
      const mv = sel >= 0 ? moves(s, sel) : [], tgt = new Map(mv.map(m => [m.to, m]));
      const L = s.last || {};
      $("#bqB").innerHTML = s.board.map((pc, i) => { const cls = ["bqC"]; if(i === sel) cls.push("sel"); if(tgt.has(i)) cls.push(tgt.get(i).eat ? "eat" : "go"); if(i === L.to || i === L.from) cls.push("last");
        const ex = fx && fx.i === i ? fx.k : ""; return `<button class="${cls.join(" ")}" data-i="${i}">${piece(pc, ex)}</button>`; }).join("");
      $("#bqB").querySelectorAll("[data-i]").forEach(b => b.addEventListener("click", () => tap(+b.dataset.i)));
      const my = myTeam() || "o", op = my === "o" ? "b" : "o";
      $("#bqD1").innerHTML = s.dead[my].length ? `<span>被吃掉：</span>${s.dead[my].map(k=>piece({t:my,k,up:true},"sm")).join("")}` : "";
      $("#bqD2").innerHTML = s.dead[op].length ? `<span>吃到：</span>${s.dead[op].map(k=>piece({t:op,k,up:true},"sm")).join("")}` : "";
      fx = null;
    }
    async function act(fn){
      if(busy) return; busy = true;
      const ns = await ctx.update("banqi", st => { if(!st || st.win || st.turn !== me()) return undefined; st = JSON.parse(JSON.stringify(st)); return fn(st) === false ? undefined : st; });
      busy = false;
      if(ns){ s = ns; sel = -1; ui(); if(!ns.win) ctx.notifyPartner(`${ctx.me.name} 在「喵喵暗棋」下了一步，輪到你囉！`);
        else ctx.notifyPartner(ns.win === me() ? `${ctx.me.name} 在「喵喵暗棋」贏了這局 🏆` : ns.win === "draw" ? `「喵喵暗棋」這局平手 🤝` : `你在「喵喵暗棋」贏了！🎉`); }
    }
    function endTurn(st){
      const other = st.p[0] === me() ? st.p[1] : st.p[0];
      st.n++; st.turn = other;
      if(st.color){ const ot = st.color[other], mt = st.color[me()];
        if(!alive(st, ot) || !canAct(st, ot)) { st.win = me(); st.sc[me()] = (st.sc[me()]||0) + 1; }
        else if(!alive(st, mt)) { st.win = other; st.sc[other] = (st.sc[other]||0) + 1; }
        else if(st.quiet >= 50) st.win = "draw"; }
    }
    function tap(i){
      if(!myTurn()) { if(s && !s.win) ctx.toast(`現在是 ${esc(nm(s.turn))} 的回合喔`); return; }
      const pc = s.board[i];
      if(pc && !pc.up){ SFX.tap(); fx = { i, k:"flip" }; act(st => { const q = st.board[i]; if(!q || q.up) return false; q.up = true;
          if(!st.color){ const other = st.p[0] === me() ? st.p[1] : st.p[0]; st.color = { [me()]: q.t, [other]: q.t === "o" ? "b" : "o" }; }
          st.quiet = 0; st.last = { to:i, type:"flip" }; endTurn(st); }).then(()=>{ SFX.select(); }); return; }
      if(sel >= 0){ const m = moves(s, sel).find(x => x.to === i);
        if(m){ const from = sel; act(st => { const a = st.board[from]; if(!a || !a.up || a.t !== myTeam()) return false; const ok = moves(st, from).find(x => x.to === i); if(!ok) return false;
            const b = st.board[i]; if(b){ st.dead[b.t].push(b.k); st.quiet = 0; } else st.quiet++;
            st.board[i] = a; st.board[from] = null; st.last = { from, to:i, type: b ? "eat" : "move" }; endTurn(st); }).then(()=>{ if(m.eat){ SFX.match(); ctx.burst && ctx.burst(); } else SFX.place(); }); return; }
      }
      if(pc && pc.up && pc.t === myTeam()){ sel = sel === i ? -1 : i; SFX.tap(); if(sel >= 0 && !moves(s, sel).length) ctx.toast("這隻貓現在走不了喔"); ui(); return; }
      if(pc && pc.up && myTeam() && pc.t !== myTeam() && sel < 0) { ctx.toast("先點自己隊伍的貓，再點要吃的貓"); return; }
      sel = -1; ui();
    }
    async function newGame(){
      const ids = ctx.players(); if(ids.length < 2) return;
      const ns = await ctx.update("banqi", st => { const first = st && st.p ? (st.win && st.win !== "draw" ? (st.win === st.p[0] ? st.p[1] : st.p[0]) : st.p[1]) : ids[0]; return fresh([first, ids.find(i => i !== first)], st && st.sc); });
      if(ns){ s = ns; sel = -1; ui(); ctx.notifyPartner(`${ctx.me.name} 開了一局「喵喵暗棋」，快來翻棋！`); }
    }
    this._rs = ctx.restartable("banqi", { title:"喵喵暗棋", done: ()=>!s || !!s.win || !s.n, run: newGame });
    $("#bqNew").addEventListener("click", () => ctx.askRestart("banqi"));
    this._u = ctx.onState("banqi", st => { if(!st) return; const prev = s; s = st; if(prev && st.n > prev.n && st.last && st.turn === me()){ fx = { i: st.last.to, k: st.last.type === "flip" ? "flip" : st.last.type === "eat" ? "pop" : "" }; if(st.last.type === "eat") SFX.miss(); else SFX.place(); } sel = -1; ui(); });
    this._p = ctx.onPresence ? ctx.onPresence(ui) : null;
    (async () => {
      let cur = await ctx.getState("banqi").catch(()=>null);
      const ids = ctx.players();
      if(!cur && ids.length >= 2){ await ctx.update("banqi", st => st ? undefined : fresh(ids, {})); cur = await ctx.getState("banqi").catch(()=>null); }
      s = cur ? cur.state : null; ui();
    })();
    if(window.__mock) window.__bq = { s: () => s, tap, moves: i => moves(s, i) };
  },
  unmount(){ if(this._rs) this._rs(); if(this._u) this._u(); if(this._p) this._p(); },
});

if(window.GameArt) window.GameArt.banqi = () => `<span class="gaL bqArt" style="left:4%;top:6%;width:92%;height:88%">${[{t:"o",k:1,up:true},{up:false},{t:"b",k:7,up:true},{up:false},{t:"b",k:6,up:true},{t:"o",k:2,up:true}].map(p=>pieceArt(p)).join("")}</span>`;
})();

// 遊戲：喵喵五子棋（黑貓 vs 白貓）
(function(){
const N = 15;
function checkWin(board, idx, c){
  const x=idx%N, y=(idx/N)|0;
  for(const [dx,dy] of [[1,0],[0,1],[1,1],[1,-1]]){
    const line=[idx];
    for(const s of [1,-1]){ let nx=x+dx*s, ny=y+dy*s; while(nx>=0&&ny>=0&&nx<N&&ny<N&&board[ny*N+nx]===c){ line.push(ny*N+nx); nx+=dx*s; ny+=dy*s; } }
    if(line.length>=5) return line;
  }
  return null;
}
const fresh = (b, w, sc) => ({ board: ".".repeat(N*N), turn:"b", last:-1, win:null, sc: sc||{}, b, w, n:0 });

// pixel cat-head stones
const HEAD = [
  ".O.......O.",
  "OKO.....OKO",
  "OKPO...OPKO",
  "OKKKOOOKKKO",
  "OKKKKKKKKKO",
  "OKEEKKKEEKO",
  "OKEHKKKEHKO",
  "OBKKKNKKKBO",
  ".OKKMKMKKO.",
  "..OOOOOOO..",
];
const STONE = {
  b: { O:"#14111a", K:"#3a3542", E:"#f5d36b", H:"#fff6c8", P:"#e89aa8", N:"#e8798a", M:"#14111a", B:"#6b4a5a" },
  w: { O:"#5b5566", K:"#fffaf4", E:"#2b2630", H:"#ffffff", P:"#f2a1ae", N:"#e8798a", M:"#5b5566", B:"#f7c0c9" },
};
const HEART = [".OO.OO.","OKKOKKO","OKKKKKO",".OKKKO.","..OKO..","...O..."];
const PAW = [".O.O.",".....","O.O.O","..O..",".OOO."];
function px(g, rows, pal, x, y, size){
  const h=rows.length, w=rows[0].length, u=size/Math.max(w,h);
  const ox=x-w*u/2, oy=y-h*u/2;
  for(let j=0;j<h;j++) for(let i=0;i<w;i++){ const c=pal[rows[j][i]]; if(c){ g.fillStyle=c; g.fillRect(Math.floor(ox+i*u), Math.floor(oy+j*u), Math.ceil(u), Math.ceil(u)); } }
}

App.registerGame({
  id: "gomoku",
  name: "五子棋",
  desc: "黑貓白貓，先連成五顆就贏",
  icon: () => Pix.sprite("black","happy"),
  badge: null,
  mount(el, ctx){
    const { sprite, esc, SFX } = ctx;
    let s = null, aim = -1, shownWin = -1, dragging = false;
    el.innerHTML = `<div class="box gm">
      <div class="gmP" id="gmP"></div>
      <div class="gmS" id="gmS"></div>
      <div class="gmBoard"><canvas id="gmC"></canvas><div class="loupe hidden" id="gmL"><canvas width="240" height="240"></canvas></div></div>
      <div class="gmCtl" id="gmCtl">
        <div class="pad"><button data-d="0,-1">▲</button><button data-d="-1,0">◀</button><button data-d="1,0">▶</button><button data-d="0,1">▼</button></div>
        <button class="btn place" id="gmPlace">放這裡！</button>
      </div>
      <div class="gmHint">手指按住棋盤會出現放大鏡，拖到想下的位置放開，<br>再按「放這裡！」。方向鍵可以微調。</div>
      <div style="text-align:center;margin-top:8px"><button class="btn sub" id="gmNew">重新開一局</button></div></div>`;
    const cv = el.querySelector("#gmC"), g = cv.getContext("2d");
    const loupe = el.querySelector("#gmL"), lc = loupe.querySelector("canvas"), lg = lc.getContext("2d");
    let size=0, cell=0, pad=0;
    function resize(){ const r=cv.getBoundingClientRect(); if(!r.width) return; const d=window.devicePixelRatio||1; cv.width=r.width*d; cv.height=r.width*d; g.setTransform(d,0,0,d,0,0); g.imageSmoothingEnabled=false; size=r.width; cell=size/N; pad=cell/2; draw(); }
    const xy = i => [pad+(i%N)*cell, pad+((i/N)|0)*cell];
    const myColor = () => !s ? null : s.b===ctx.me.uid ? "b" : s.w===ctx.me.uid ? "w" : null;
    const myTurn = () => s && !s.win && myColor()===s.turn;
    function draw(){
      if(!size) return;
      // board
      g.fillStyle="#f4d7a1"; g.fillRect(0,0,size,size);
      g.fillStyle="rgba(214,160,96,.18)";
      for(let j=0;j<N;j++) for(let i=0;i<N;i++) if((i+j)%2===0) g.fillRect(i*cell, j*cell, cell, cell);
      g.fillStyle="#a7713f";
      const lw = Math.max(1, Math.round(cell/14));
      for(let i=0;i<N;i++){ g.fillRect(pad, pad+i*cell-lw/2, (N-1)*cell, lw); g.fillRect(pad+i*cell-lw/2, pad, lw, (N-1)*cell); }
      for(const [a,b] of [[3,3],[3,11],[11,3],[11,11],[7,7]]) px(g, PAW, {O:"#a7713f"}, pad+a*cell, pad+b*cell, cell*.6);
      if(!s) return;
      // win glow
      const longCat = s.win && s.win.line && s.win.line.length>=5 ? new Set(s.win.line) : null;
      if(longCat) for(const i of s.win.line){ const [x,y]=xy(i); g.fillStyle="rgba(255,138,163,.35)"; g.fillRect(x-cell*.5, y-cell*.5, cell, cell); }
      // aim
      if(aim>=0 && s.board[aim]==="."){
        const [x,y]=xy(aim); g.globalAlpha=.5; px(g, HEAD, STONE[myColor()||"b"], x, y, cell*1.02); g.globalAlpha=1;
        g.strokeStyle="#f08aa0"; g.lineWidth=Math.max(2,cell/10); g.setLineDash([cell/5,cell/7]); g.strokeRect(x-cell*.5+1, y-cell*.5+1, cell-2, cell-2); g.setLineDash([]);
      }
      // stones
      for(let i=0;i<N*N;i++){ const c=s.board[i]; if(c!=="." && !(longCat && longCat.has(i))){ const [x,y]=xy(i); px(g, HEAD, STONE[c], x, y+cell*.03, cell*1.02); } }
      if(longCat) drawLongCat();
      else if(s.last>=0){ const [x,y]=xy(s.last); px(g, HEART, {O:"#7a3a4a",K:"#ff6f8e"}, x+cell*.36, y-cell*.38, cell*.46); }
    }
    // ---------- 長條貓：連成一線的五顆貓頭變成一隻長長的貓 ----------
    let catT0 = -1e9, catRaf = 0, catTimer = 0, alive = true;
    const BELLY = { b:"#5a5363", w:"#fff1df" };
    function drawLongCat(){
      const c = s.win.c, pal = STONE[c], now = performance.now();
      const pts = s.win.line.map(i=>({ i, x:i%N, y:(i/N)|0 })).sort((a,b)=>a.y-b.y || a.x-b.x);
      const [hx,hy] = xy(pts[0].i), [ex,ey] = xy(pts[pts.length-1].i);
      const full = Math.hypot(ex-hx, ey-hy), ang = Math.atan2(ey-hy, ex-hx);
      const t = Math.min(1, (now - catT0)/1100), p = 1 - Math.pow(1-t, 3);           // stretch out
      const L = full * p, h = cell*.74, u = Math.max(1.5, cell/12);
      g.save(); g.translate(hx, hy); g.rotate(ang);
      // tail (wagging) beyond the end of the body
      const tx0 = L + cell*.28;
      for(let k=0;k<7;k++){ const sz = cell*(.2 - k*.014), tx = tx0 + k*cell*.13, ty = Math.sin(k*.8 + now/170)*cell*.09*(k/3) - k*cell*.035;
        g.fillStyle = pal.O; g.fillRect(tx-sz/2-u, ty-sz/2-u, sz+2*u, sz+2*u); g.fillStyle = pal.K; g.fillRect(tx-sz/2, ty-sz/2, sz, sz); }
      // body
      const bx = -cell*.1, bw = L + cell*.45;
      g.fillStyle = pal.O; g.fillRect(bx-u, -h/2-u, bw+2*u, h+2*u);
      g.fillStyle = pal.K; g.fillRect(bx, -h/2, bw, h);
      g.fillStyle = BELLY[c]; g.fillRect(bx+cell*.3, h*.12, Math.max(0, bw-cell*.6), h*.3);
      // little back stripes every cell
      g.fillStyle = c==="b" ? "#2c2833" : "#e9ded2";
      for(let x = cell*.9; x < bw - cell*.4; x += cell*.75) g.fillRect(x, -h/2, cell*.12, h*.32);
      // paws: front pair near the head, back pair near the tail
      const paw = x => { const pw = cell*.2; for(const dx of [-pw*.7, pw*.7]){ g.fillStyle = pal.O; g.fillRect(x+dx-pw/2-u, h/2-u, pw+2*u, pw*.9+2*u); g.fillStyle = pal.K; g.fillRect(x+dx-pw/2, h/2, pw, pw*.9); } };
      paw(cell*.55); if(L > cell*.8) paw(L - cell*.05);
      g.restore();
      // head stays upright at the top end, a bit bigger
      px(g, HEAD, pal, hx, hy - cell*.12, cell*1.4);
      if(t >= 1){ g.font = `${Math.round(cell*.55)}px Cubic11, sans-serif`; g.textAlign = "center"; g.fillStyle = "#e5486a";
        const bob = Math.sin(now/300)*cell*.06; g.fillText("喵～", hx + cell*.15, hy - cell*.85 + bob); }
    }
    function animateCat(){
      cancelAnimationFrame(catRaf); clearTimeout(catTimer);
      const step = () => { if(!alive || !s || !s.win || !s.win.line || s.win.line.length<5) return; draw();
        if(performance.now() - catT0 < 1200) catRaf = requestAnimationFrame(step); else catTimer = setTimeout(step, 110); };
      step();
    }
    this._stopCat = () => { alive = false; cancelAnimationFrame(catRaf); clearTimeout(catTimer); };
    function drawLoupe(clientX, clientY){
      const r=cv.getBoundingClientRect(), B=el.querySelector(".gmBoard").getBoundingClientRect();
      const d=window.devicePixelRatio||1, span=cell*5;   // show 5x5 cells
      const [ax,ay] = aim>=0 ? xy(aim) : [clientX-r.left, clientY-r.top];
      lg.imageSmoothingEnabled=false; lg.fillStyle="#f4d7a1"; lg.fillRect(0,0,240,240);
      lg.drawImage(cv, (ax-span/2)*d, (ay-span/2)*d, span*d, span*d, 0, 0, 240, 240);
      lg.strokeStyle="#f08aa0"; lg.lineWidth=4; lg.strokeRect(120-24,120-24,48,48);
      let lx = clientX-B.left-60, ly = clientY-B.top-150;
      if(ly < -40) ly = clientY-B.top+40;
      loupe.style.left = Math.max(-10, Math.min(B.width-110, lx))+"px"; loupe.style.top = ly+"px";
    }
    function idxAt(clientX, clientY){
      const r=cv.getBoundingClientRect();
      const gx=Math.round((clientX-r.left-pad)/cell), gy=Math.round((clientY-r.top-pad)/cell);
      if(gx<0||gy<0||gx>=N||gy>=N) return -1; return gy*N+gx;
    }
    function setAim(i){ if(i===aim) return; aim=i; draw(); if(i>=0) SFX.key(.8); updCtl(); }
    cv.addEventListener("pointerdown", e=>{ if(!myTurn()) return; dragging=true; cv.setPointerCapture(e.pointerId); const i=idxAt(e.clientX,e.clientY); if(i>=0 && s.board[i]===".") setAim(i); loupe.classList.remove("hidden"); drawLoupe(e.clientX,e.clientY); e.preventDefault(); });
    cv.addEventListener("pointermove", e=>{ if(!dragging) return; const i=idxAt(e.clientX,e.clientY); if(i>=0 && s.board[i]===".") setAim(i); drawLoupe(e.clientX,e.clientY); e.preventDefault(); });
    const end = ()=>{ if(!dragging) return; dragging=false; loupe.classList.add("hidden"); };
    cv.addEventListener("pointerup", end); cv.addEventListener("pointercancel", end);
    el.querySelectorAll(".pad button").forEach(b=>b.addEventListener("click", ()=>{
      if(!myTurn()) return;
      const [dx,dy]=b.dataset.d.split(",").map(Number);
      let x = aim>=0 ? aim%N : 7, y = aim>=0 ? (aim/N)|0 : 7;
      if(aim>=0){ x=Math.max(0,Math.min(N-1,x+dx)); y=Math.max(0,Math.min(N-1,y+dy)); }
      setAim(y*N+x);
    }));
    function updCtl(){
      const btn = el.querySelector("#gmPlace");
      const ok = myTurn() && aim>=0 && s.board[aim]===".";
      btn.disabled = !ok;
      el.querySelector("#gmCtl").classList.toggle("off", !myTurn());
    }
    el.querySelector("#gmPlace").addEventListener("click", async ()=>{
      if(!myTurn() || aim<0 || s.board[aim]!==".") return;
      const idx = aim, me = ctx.me.uid; aim = -1;
      SFX.place();
      const ns = await ctx.update("gomoku", st=>{
        if(!st||st.win) return undefined;
        const c = st.b===me?"b":st.w===me?"w":null; if(c!==st.turn||st.board[idx]!==".") return undefined;
        st.board = st.board.slice(0,idx)+c+st.board.slice(idx+1); st.last=idx; st.n++; st.turn = c==="b"?"w":"b";
        const line = checkWin(st.board, idx, c);
        if(line){ st.win={c,line}; st.sc[me]=(st.sc[me]||0)+1; } else if(st.n>=N*N) st.win={c:"draw",line:[]};
        return st;
      });
      if(ns){ s=ns; ui(); const [x,y]=xy(idx); stampFx(x,y); if(!ns.win) ctx.notifyPartner(`${ctx.me.name} 在「五子棋」下了一步，輪到你囉！`); }
    });
    function stampFx(x,y){
      const r=cv.getBoundingClientRect();
      for(let i=0;i<6;i++){ const d=document.createElement("div"); d.style.cssText=`position:fixed;left:${r.left+x-8}px;top:${r.top+y-8}px;width:16px;height:16px;pointer-events:none;z-index:40`; d.innerHTML=ctx.icon(i%2?"heart":"star"); document.body.appendChild(d);
        const a=Math.PI*2*i/6, dist=26; d.animate([{transform:"scale(.3)",opacity:1},{transform:`translate(${Math.cos(a)*dist}px,${Math.sin(a)*dist}px) scale(1)`,opacity:1,offset:.6},{transform:`translate(${Math.cos(a)*dist*1.3}px,${Math.sin(a)*dist*1.3}px) scale(.5)`,opacity:0}],{duration:520,easing:"ease-out",fill:"forwards"}); setTimeout(()=>d.remove(),560); }
    }
    function ui(){
      const p = ctx.partner();
      const P = el.querySelector("#gmP"), S = el.querySelector("#gmS");
      if(!p){ P.innerHTML=""; S.textContent=`等${ctx.pw()}加入小窩…`; draw(); updCtl(); return; }
      if(!s){ S.textContent="準備棋盤中…"; return; }
      const head = c => { const cnv=document.createElement("canvas"); cnv.width=44; cnv.height=40; const x=cnv.getContext("2d"); x.imageSmoothingEnabled=false; px(x, HEAD, STONE[c], 22, 20, 40); return cnv.toDataURL(); };
      const card = (uid,c)=>`<div class="gmCard ${!s.win&&s.turn===c?"turn":""}"><img src="${head(c)}" alt=""><span class="nm"><b>${esc(ctx.nameOf(uid))}</b><i>${c==="b"?"黑貓・先手":"白貓"}</i></span><span class="sc">${s.sc[uid]||0}</span></div>`;
      P.innerHTML = card(s.b,"b") + `<span class="vs">VS</span>` + card(s.w,"w");
      const mc = myColor();
      if(s.win){ const wid = s.win.c==="b"?s.b:s.w;
        S.innerHTML = s.win.c==="draw" ? "平手！" : wid===ctx.me.uid ? `你贏了！🎉` : `${esc(ctx.nameOf(wid))} 贏了～`;
        if(shownWin!==s.n){ shownWin=s.n; catT0 = performance.now(); if(wid===ctx.me.uid){ SFX.match(); ctx.burst(); } else SFX.miss(); setTimeout(()=>SFX.meow(.85), 500); }
        animateCat(); }
      else if(mc===s.turn){ S.innerHTML = `<span style="color:var(--pinkT)">輪到你了！</span>`; }
      else S.textContent = `等 ${ctx.nameOf(s.turn==="b"?s.b:s.w)} 下棋…`;
      draw(); updCtl();
    }
    this._rs = ctx.restartable("gomoku", { title:"五子棋", done: ()=>!s || !!s.win || !s.n, run: async()=>{
      const ids = ctx.players(); if(ids.length<2) return;
      const ns = await ctx.update("gomoku", st=> st ? fresh(st.w, st.b, st.sc) : fresh(ids[0], ids[1], {}));
      if(ns){ s=ns; aim=-1; ui(); }
    } });
    el.querySelector("#gmNew").addEventListener("click", ()=>ctx.askRestart("gomoku"));
    this._ro = new ResizeObserver(resize); this._ro.observe(cv);
    this._unsub = ctx.onState("gomoku", st=>{ if(!st) return; if(s && st.n>s.n && st.last>=0 && st.board[st.last] !== myColor()){ SFX.place(); } if(aim>=0 && st.board[aim]!==".") aim=-1; s=st; ui(); });
    this._unp = ctx.onPresence(ui);
    (async()=>{
      let cur = await ctx.getState("gomoku");
      const ids = ctx.players();
      if(!cur && ids.length>=2){ await ctx.update("gomoku", st=> st ? undefined : fresh(ids[0], ids[1], {})); cur = await ctx.getState("gomoku"); }
      if(cur && ids.length>=2 && (!ids.includes(cur.state.b) || !ids.includes(cur.state.w))){
        await ctx.update("gomoku", st=>{ if(!st) return undefined; const free = ids.filter(i=>i!==st.b && i!==st.w); if(!ids.includes(st.b)) st.b = free.shift(); if(!ids.includes(st.w)) st.w = free.shift(); return st; });
        cur = await ctx.getState("gomoku");
      }
      if(cur){ s = JSON.parse(JSON.stringify(cur.state)); shownWin = s.win ? s.n : -1; }
      ui(); resize();
    })();
  },
  unmount(){ if(this._rs) this._rs(); if(this._stopCat) this._stopCat(); if(this._ro) this._ro.disconnect(); if(this._unsub) this._unsub(); if(this._unp) this._unp(); },
});
})();

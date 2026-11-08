// 遊戲：喵喵撞球（8 號球，兩個人輪流打，不用同時在線）
// 球都是圓滾滾的貓頭：1~7 是「素色貓」、9~15 是「條紋貓」、8 號是小黑貓、母球是白貓。
// 在球桌上拖曳瞄準，下面的逗貓棒往右拉決定力道，放開就打出去。
// 每一桿由打的人在自己手機上模擬，結果（球的位置）存進 state；對方手機重播同一桿的動畫，最後對齊到存下來的位置。
(function(){
const TW = 200, TH = 360, R = 7, RAIL = 14, SC = 2;        // felt size (units), ball radius, rail, internal canvas scale
const CW = TW + RAIL*2, CH = TH + RAIL*2;
const O = "#5a3b2e";
const COLORS = ["#fff", "#ffd36b", "#8fbfef", "#f0708d", "#b9a0ec", "#f6a95c", "#8fd3a8", "#b07a52", "#3b3140"];
const NAMES = ["白貓", "黃黃貓", "藍藍貓", "粉粉貓", "紫紫貓", "橘貓", "薄荷貓", "可可貓", "小黑貓"];
const colOf = n => COLORS[n === 0 ? 0 : n === 8 ? 8 : n > 8 ? n - 8 : n];
const ballName = n => n === 0 ? "白貓" : n === 8 ? "8 號小黑貓" : `${n > 8 ? "條紋" : ""}${NAMES[n > 8 ? n-8 : n]}`;
const typeOf = n => n === 0 ? "cue" : n === 8 ? "eight" : n < 8 ? "solid" : "stripe";
const GNAME = { solid:"素色貓", stripe:"條紋貓" };
const POCKETS = [[-3,-3,14],[TW+3,-3,14],[-5,TH/2,12],[TW+5,TH/2,12],[-3,TH+3,14],[TW+3,TH+3,14]];
const HEADY = TH*0.75, SPOT = [TW/2, TH*0.8], FOOT = [TW/2, TH*0.27];
const MAXV = 820;

// ---------- sprites ----------
const hex = h => h.length === 4 ? [1,2,3].map(i=>parseInt(h[i]+h[i],16)) : [1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
const shade = (h, a) => "#" + hex(h).map(v=>Math.max(0,Math.min(255,Math.round(a<0 ? v*(1+a) : v+(255-v)*a))).toString(16).padStart(2,"0")).join("");
const sprC = {};
function ballSprite(n){
  if(sprC[n]) return sprC[n];
  const w = 16, h = 17, cx = 8, cy = 9.5, fur = colOf(n), stripe = n > 8, dark = n === 8;
  const cv = document.createElement("canvas"); cv.width = w; cv.height = h; const g = cv.getContext("2d");
  const px = [];
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){
    const dx = x+.5-cx, dy = y+.5-cy, d = Math.hypot(dx, dy);
    let c = null;
    if(d <= R){ c = fur; if(stripe && Math.abs(dy) > 3.2) c = "#fffaf2"; if(d > R-1.6 && dy > 1.5) c = shade(c === "#fffaf2" ? "#fffaf2" : fur, -.14); if(dx < -2 && dy < -2 && d < R-2.5 && !dark) c = shade(c, .4); }
    else { // ears
      const ex = Math.abs(dx); if(dy < -4 && dy > -8.6 && ex > 2.2 && ex < 6.6 && (ex - 2.2) + (-4 - dy)*0.55 < 4.4 && (6.6 - ex) + (-4 - dy)*0.55 < 4.6) c = (ex > 3.4 && ex < 5.4 && dy > -6.6) ? "#f7a7b8" : (stripe ? "#fffaf2" : fur);
    }
    px.push(c);
  }
  const out = px.slice();
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){ if(px[y*w+x]) continue; if((x>0&&px[y*w+x-1])||(x<w-1&&px[y*w+x+1])||(y>0&&px[(y-1)*w+x])||(y<h-1&&px[(y+1)*w+x])) out[y*w+x] = O; }
  const eye = dark ? "#ffd84d" : "#2b1d18";
  [[5,9],[10,9]].forEach(([x,y]) => { out[y*w+x] = eye; out[(y+1)*w+x] = eye; });
  out[12*w+7] = out[12*w+8] = dark ? "#f7d6dc" : "#f0708d";
  if(!dark){ out[11*w+3] = out[11*w+12] = "#f59ab0"; }
  px.length = 0;
  out.forEach((c, i) => { if(!c) return; g.fillStyle = c; g.fillRect(i % w, (i / w)|0, 1, 1); });
  return sprC[n] = cv;
}
const ballUrl = n => ballSprite(n).toDataURL();
const ballImg = (n, cls) => `<img class="${cls||"plBi"}" src="${ballUrl(n)}" alt="${ballName(n)}">`;

// ---------- physics (deterministic for the same input) ----------
function makeSim(start, ang, pw){
  const balls = start.map(([n,x,y]) => ({ n, x, y, vx:0, vy:0, in:false }));
  const cue = balls.find(b => b.n === 0);
  const v0 = 30 + Math.pow(pw, 1.25) * (MAXV - 30);
  if(cue){ cue.vx = Math.cos(ang) * v0; cue.vy = Math.sin(ang) * v0; }
  const ev = { first: null, pocketed: [], rails: 0, hits: [] };
  const DT = 1/240; let t = 0, moving = true;
  function step(){
    if(!moving) return false;
    t += DT;
    for(const b of balls){ if(b.in) continue;
      const sp = Math.hypot(b.vx, b.vy); if(sp === 0) continue;
      const ns = Math.max(0, sp - (95 + 0.42*sp)*DT); if(ns < 2.5){ b.vx = b.vy = 0; continue; }
      b.vx *= ns/sp; b.vy *= ns/sp; b.x += b.vx*DT; b.y += b.vy*DT; }
    // ball-ball
    for(let i=0;i<balls.length;i++){ const a = balls[i]; if(a.in) continue;
      for(let j=i+1;j<balls.length;j++){ const b = balls[j]; if(b.in) continue;
        const dx = b.x-a.x, dy = b.y-a.y, d2 = dx*dx+dy*dy; if(d2 >= 4*R*R) continue;
        const d = Math.sqrt(d2) || 0.001, nx = dx/d, ny = dy/d, ov = 2*R - d;
        a.x -= nx*ov/2; a.y -= ny*ov/2; b.x += nx*ov/2; b.y += ny*ov/2;
        const vn = (a.vx-b.vx)*nx + (a.vy-b.vy)*ny;
        if(vn > 0){ const j2 = vn * (1 + 0.95) / 2; a.vx -= j2*nx; a.vy -= j2*ny; b.vx += j2*nx; b.vy += j2*ny;
          if(ev.hits.length < 40) ev.hits.push(Math.min(1, vn/500));
          if(ev.first == null){ if(a.n === 0) ev.first = b.n; else if(b.n === 0) ev.first = a.n; } }
      } }
    // pockets + cushions
    for(const b of balls){ if(b.in) continue;
      for(const [px, py, pr] of POCKETS){ if((b.x-px)*(b.x-px) + (b.y-py)*(b.y-py) < pr*pr){ b.in = true; b.vx = b.vy = 0; b.px = px; b.py = py; ev.pocketed.push(b.n); break; } }
      if(b.in) continue;
      const inMouth = (b.x < 20 || b.x > TW-20) && (b.y < 20 || b.y > TH-20 || Math.abs(b.y - TH/2) < 12);
      if(!inMouth){
        if(b.x < R){ b.x = R; if(b.vx < 0){ b.vx = -b.vx*0.78; ev.rails++; } }
        if(b.x > TW-R){ b.x = TW-R; if(b.vx > 0){ b.vx = -b.vx*0.78; ev.rails++; } }
        if(b.y < R){ b.y = R; if(b.vy < 0){ b.vy = -b.vy*0.78; ev.rails++; } }
        if(b.y > TH-R){ b.y = TH-R; if(b.vy > 0){ b.vy = -b.vy*0.78; ev.rails++; } }
      } else if(b.x < -R || b.x > TW+R || b.y < -R || b.y > TH+R){ b.in = true; b.vx = b.vy = 0; b.px = Math.max(-4, Math.min(TW+4, b.x)); b.py = Math.max(-4, Math.min(TH+4, b.y)); ev.pocketed.push(b.n); }
    }
    moving = balls.some(b => !b.in && (b.vx || b.vy)) && t < 20;
    return moving;
  }
  return { balls, ev, step, get moving(){ return moving; }, get t(){ return t; } };
}
function runAll(start, ang, pw){ const s = makeSim(start, ang, pw); while(s.step()); return s; }

// ---------- rules ----------
function rack(){
  const order = [1, 9, 2, 10, 8, 3, 11, 4, 12, 5, 13, 6, 14, 7, 15];
  // keep 8 in the middle of row 3 and one solid + one stripe in the back corners; shuffle the rest
  const rest = [1,2,3,4,5,6,7,9,10,11,12,13,14,15]; for(let i=rest.length-1;i>0;i--){ const j = (Math.random()*(i+1))|0; [rest[i],rest[j]] = [rest[j],rest[i]]; }
  const slots = []; const out = [];
  for(let row=0; row<5; row++) for(let k=0;k<=row;k++) slots.push([FOOT[0] + (k - row/2)*(2*R+0.3), FOOT[1] - row*(2*R*0.866+0.3)]);
  const s = rest.filter(n=>n<8), t = rest.filter(n=>n>8);
  const pick = []; for(let i=0;i<15;i++) pick.push(null);
  pick[4] = 8; pick[10] = s.pop(); pick[14] = t.pop();
  const left = s.concat(t); for(let i=left.length-1;i>0;i--){ const j = (Math.random()*(i+1))|0; [left[i],left[j]] = [left[j],left[i]]; }
  for(let i=0;i<15;i++) if(pick[i] == null) pick[i] = left.pop();
  void order;
  slots.forEach(([x,y], i) => out.push([pick[i], Math.round(x*100)/100, Math.round(y*100)/100]));
  out.unshift([0, SPOT[0], SPOT[1]]);
  return out;
}
function fresh(p, sc){ return { v:1, seq:0, p, turn:p[0], groups:null, balls:rack(), hand:"head", broke:false, last:null, win:null, sc: sc || {} }; }
const freeSpot = (balls, x, y) => balls.every(([n,bx,by]) => n === 0 || (bx-x)*(bx-x)+(by-y)*(by-y) >= 4*R*R + 1);
function respot8(balls){ let [x, y] = FOOT; while(!freeSpot(balls, x, y)) y -= 1; balls.push([8, x, y]); }
// judge a finished shot. st = state before, sim = finished simulation, by = shooter
function judge(st, sim, by, practice){
  const ev = sim.ev, other = st.p[0] === by ? st.p[1] : st.p[0];
  const balls = sim.balls.filter(b => !b.in).map(b => [b.n, Math.round(b.x*100)/100, Math.round(b.y*100)/100]);
  const ns = JSON.parse(JSON.stringify(st)); ns.balls = balls; ns.hand = false; ns.broke = true;
  const pk = ev.pocketed, cueIn = pk.includes(0), eightIn = pk.includes(8);
  const left = t => st.balls.filter(([n]) => typeOf(n) === t).length;
  let my = st.groups ? st.groups[by] : null;
  let foul = null, msg = "";
  if(practice){
    if(cueIn){ ns.balls = balls.filter(b=>b[0]!==0); ns.balls.unshift([0, SPOT[0], SPOT[1]]); ns.hand = "any"; msg = "白貓掉進洞了，可以自己擺位置"; }
    if(eightIn && ns.balls.some(([n]) => n !== 0 && n !== 8)){ respot8(ns.balls); msg = "小黑貓先回到原位喔"; }
    const got = pk.filter(n => n !== 0); if(got.length && !msg) msg = `${got.map(ballName).join("、")} 進洞了！`;
    if(!ns.balls.some(([n]) => n !== 0)){ ns.win = by; msg = "全部清檯了！🎉"; }
    ns.turn = by; ns.seq = st.seq + 1; ns.last = { by, msg, seq: ns.seq }; return ns;
  }
  if(ev.first == null) foul = "白貓沒有碰到任何球";
  else if(my){ const need = left(my) > 0 ? my : "eight"; if(typeOf(ev.first) !== need) foul = need === "eight" ? "要先碰小黑貓喔" : `先碰到了${typeOf(ev.first) === "eight" ? "小黑貓" : "對方的貓"}`; }
  else if(ev.first === 8 && st.broke) foul = "還沒分組不能先碰小黑貓";
  if(cueIn) foul = "白貓掉進洞了";
  if(eightIn){
    if(!st.broke){ // break: just put it back
      ns.balls = ns.balls.filter(b=>b[0]!==8); respot8(ns.balls); msg = "開球打進小黑貓，放回原位～ ";
    } else {
      const cleared = my && left(my) === 0;
      ns.win = (!foul && cleared) ? by : other;
      ns.sc = ns.sc || {}; ns.sc[ns.win] = (ns.sc[ns.win]||0) + 1;
      ns.seq = st.seq + 1; ns.last = { by, msg: ns.win === by ? "打進 8 號小黑貓，贏了！🎉" : (foul ? `犯規還打進小黑貓（${foul}），輸了 😿` : "還沒清完自己的貓就打進小黑貓，輸了 😿"), seq: ns.seq, pk };
      return ns;
    }
  }
  // assign groups on the first clean pocket after the break
  const mine = pk.filter(n => n !== 0 && n !== 8);
  if(!ns.groups && !foul && mine.length && st.broke){ my = typeOf(mine[0]); ns.groups = { [by]: my, [other]: my === "solid" ? "stripe" : "solid" }; }
  const scored = mine.some(n => !my ? true : typeOf(n) === my);
  if(foul){
    ns.turn = other; ns.hand = "any";
    if(cueIn){ ns.balls = ns.balls.filter(b=>b[0]!==0); let [x,y] = SPOT; while(!freeSpot(ns.balls, x, y)) y -= 2; ns.balls.unshift([0, x, y]); }
    msg = `犯規：${foul}，換對方自由擺白貓`;
  } else if(scored){
    msg = `${mine.map(ballName).join("、")} 進洞了！繼續打 ` + (ns.groups && !st.groups ? `（${GNAME[ns.groups[by]]}）` : "");
    ns.turn = by;
  } else { ns.turn = other; msg = mine.length ? `${mine.map(ballName).join("、")} 進洞了，但不是自己的貓，換人` : (!st.broke ? "開球完成，換人" : "沒有進球，換人"); }
  ns.seq = st.seq + 1; ns.last = { by, msg, seq: ns.seq, pk };
  return ns;
}

// ---------- the table (fullscreen) ----------
function table(o){
  // o: { ctx, getS, practice, me, onShot(newState) -> Promise, nameOf, sfx }
  const SFX = o.sfx || {}; const snd = (k, ...a) => { try{ SFX[k] && SFX[k](...a); }catch(e){} };
  const ov = document.createElement("div"); ov.className = "plGame";
  ov.innerHTML = `<div class="plHud"><button class="plQuit" id="plX">◀ 離開</button><div class="plTurn" id="plTurn"></div></div>
    <div class="plGroups" id="plG"></div>
    <div class="plWrap" id="plWrap"><canvas id="plCv" width="${CW*SC}" height="${CH*SC}"></canvas><div class="plMsg" id="plMsg"></div></div>
    <div class="plCtl"><button class="plFine" data-d="-1">↺</button>
      <div class="plPow" id="plPow"><div class="plTrack"><i id="plFill"></i></div><span class="plWand" id="plWand"></span><b id="plPowT">往右拉逗貓棒 → 放開打</b></div>
      <button class="plFine" data-d="1">↻</button></div>`;
  document.body.appendChild(ov);
  const $ = s => ov.querySelector(s);
  const cv = $("#plCv"), g = cv.getContext("2d"); g.imageSmoothingEnabled = false;
  // static table
  const tb = document.createElement("canvas"); tb.width = CW*SC; tb.height = CH*SC; { const b = tb.getContext("2d"); b.scale(SC, SC);
    b.fillStyle = O; b.fillRect(0, 0, CW, CH);
    b.fillStyle = "#c08a5e"; b.fillRect(2, 2, CW-4, CH-4); b.fillStyle = "#d9a57a"; b.fillRect(2, 2, CW-4, 3); b.fillRect(2, 2, 3, CH-4); b.fillStyle = "#9c6a44"; b.fillRect(2, CH-5, CW-4, 3); b.fillRect(CW-5, 2, 3, CH-4);
    b.fillStyle = "#6fbf9b"; b.fillRect(RAIL-3, RAIL-3, TW+6, TH+6);
    b.fillStyle = "#8fd3b6"; b.fillRect(RAIL, RAIL, TW, TH);
    b.fillStyle = "rgba(255,255,255,.13)"; for(let y=10;y<TH;y+=28) for(let x=((y/28)|0)%2?10:24;x<TW;x+=28){ const X = RAIL+x, Y = RAIL+y; b.fillRect(X, Y, 3, 3); b.fillRect(X-2, Y-3, 1.5, 1.5); b.fillRect(X+1, Y-4, 1.5, 1.5); b.fillRect(X+4, Y-3, 1.5, 1.5); }
    b.fillStyle = "rgba(255,255,255,.35)"; b.fillRect(RAIL, RAIL+HEADY, TW, 0.7);
    b.fillStyle = "rgba(255,255,255,.5)"; b.beginPath(); b.arc(RAIL+FOOT[0], RAIL+FOOT[1], 1.2, 0, 7); b.fill();
    // rail paw dots
    b.fillStyle = "#fff3e0"; for(const f of [.25,.5,.75]){ for(const [x,y] of [[RAIL+TW*f, RAIL/2],[RAIL+TW*f, CH-RAIL/2]]) { b.fillRect(x-1, y-1, 2, 2); } }
    for(const f of [.125,.25,.375,.625,.75,.875]) for(const x of [RAIL/2, CW-RAIL/2]) b.fillRect(x-1, RAIL+TH*f-1, 2, 2);
    for(const [px, py, pr] of POCKETS){ b.fillStyle = O; b.beginPath(); b.arc(RAIL+px, RAIL+py, pr-1, 0, 7); b.fill(); b.fillStyle = "#2b1d18"; b.beginPath(); b.arc(RAIL+px, RAIL+py, pr-3, 0, 7); b.fill(); }
  }
  let S = o.getS(), view = S.balls.map(b => b.slice()), anim = null, aim = -Math.PI/2, pow = 0, dragging = null, done = false, raf = 0, busy = false, fade = [];
  const me = o.me;
  const myTurn = () => !S.win && S.turn === me && !anim && !busy;
  const cueOf = () => view.find(b => b[0] === 0);
  function size(){ const w = $("#plWrap"), aw = w.clientWidth || innerWidth - 16, ah = w.clientHeight || innerHeight - 220; const k = Math.min(aw / CW, ah / CH); cv.style.width = Math.floor(CW*k) + "px"; cv.style.height = Math.floor(CH*k) + "px"; }
  function hud(){
    const nm = u => u === me ? "你" : o.nameOf(u);
    $("#plTurn").innerHTML = S.win ? (S.win === me ? (o.practice ? "全部清檯了！🎉" : "你贏了！🎉") : `${esc(nm(S.win))} 贏了這局`) : anim ? (anim.who === me ? "球在滾～" : `看 ${esc(nm(anim.who))} 打的這一桿…`) : S.turn === me ? `<b>輪到你了！</b>${S.hand ? (S.hand === "head" ? "（先把白貓擺在白線下面開球）" : "（可以拖白貓換位置）") : ""}` : `等 ${esc(nm(S.turn))} 打…`;
    const row = u => { const t = S.groups && S.groups[u]; const left = t ? S.balls.filter(([n]) => typeOf(n) === t).map(([n]) => n) : [];
      return `<div class="${S.turn === u && !S.win ? "on" : ""}"><b>${esc(nm(u))}</b>${t ? `<span>${GNAME[t]}</span><i>${left.length ? left.map(n=>ballImg(n)).join("") : ballImg(8)}</i>` : `<span>${S.broke ? "還沒分組" : "等開球"}</span>`}</div>`; };
    $("#plG").innerHTML = o.practice ? `<div class="on"><b>練習模式</b><span>剩 ${S.balls.length - 1} 顆</span></div>` : S.p.map(row).join("");
    ov.classList.toggle("myTurn", myTurn());
  }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[c]);
  function msg(t){ const m = $("#plMsg"); m.textContent = t || ""; m.classList.remove("on"); if(!t) return; void m.offsetWidth; m.classList.add("on"); }
  // aim helpers
  function rayHit(cx, cy, a){
    const dx = Math.cos(a), dy = Math.sin(a); let best = Infinity, hit = null;
    for(const [n, x, y] of view){ if(n === 0) continue; const fx = x - cx, fy = y - cy, t = fx*dx + fy*dy; if(t <= 0) continue; const d2 = fx*fx + fy*fy - t*t, rr = 4*R*R; if(d2 > rr) continue; const tt = t - Math.sqrt(rr - d2); if(tt < best){ best = tt; hit = [n, x, y]; } }
    let tw = Infinity; if(dx > 0) tw = Math.min(tw, (TW - R - cx)/dx); if(dx < 0) tw = Math.min(tw, (R - cx)/dx); if(dy > 0) tw = Math.min(tw, (TH - R - cy)/dy); if(dy < 0) tw = Math.min(tw, (R - cy)/dy);
    if(best < tw) return { t: best, ball: hit }; return { t: tw, ball: null };
  }
  function draw(){
    g.setTransform(1,0,0,1,0,0); g.drawImage(tb, 0, 0); g.setTransform(SC,0,0,SC,RAIL*SC,RAIL*SC); g.imageSmoothingEnabled = false;
    const cue = cueOf();
    // aim line
    if(cue && myTurn() && !dragging?.ball){
      const h = rayHit(cue[1], cue[2], aim), ex = cue[1] + Math.cos(aim)*h.t, ey = cue[2] + Math.sin(aim)*h.t;
      g.fillStyle = "rgba(255,255,255,.85)"; const L = Math.min(h.t, 260); for(let s=R+3; s<L; s+=5){ g.fillRect(cue[1] + Math.cos(aim)*s - .6, cue[2] + Math.sin(aim)*s - .6, 1.2, 1.2); }
      if(h.ball && h.t < 260){ g.strokeStyle = "rgba(255,255,255,.9)"; g.lineWidth = 0.8; g.beginPath(); g.arc(ex, ey, R, 0, 7); g.stroke();
        const nx = h.ball[1] - ex, ny = h.ball[2] - ey, nl = Math.hypot(nx, ny) || 1; g.strokeStyle = "rgba(255,240,150,.95)"; g.beginPath(); g.moveTo(h.ball[1], h.ball[2]); g.lineTo(h.ball[1] + nx/nl*24, h.ball[2] + ny/nl*24); g.stroke(); }
    }
    // balls
    for(const b of view){ const s = ballSprite(b[0]); g.drawImage(s, Math.round((b[1]-8)*2)/2, Math.round((b[2]-9.5)*2)/2); }
    for(const f of fade){ const k = Math.max(0, f.life/0.3), s = ballSprite(f.n); g.globalAlpha = k; g.drawImage(s, f.x - 8*k, f.y - 9.5*k, 16*k, 17*k); g.globalAlpha = 1; }
    // hand marker
    if(cue && myTurn() && S.hand){ g.strokeStyle = "rgba(255,255,255,.9)"; g.setLineDash([2,2]); g.lineWidth = 0.8; g.beginPath(); g.arc(cue[1], cue[2], R+4, 0, 7); g.stroke(); g.setLineDash([]); }
    // wand (cue stick)
    if(cue && myTurn() && !(dragging && dragging.ball)){
      const back = R + 3 + pow*26, ux = -Math.cos(aim), uy = -Math.sin(aim), x0 = cue[1] + ux*back, y0 = cue[2] + uy*back, len = 150;
      g.lineCap = "round"; g.strokeStyle = O; g.lineWidth = 4.2; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + ux*len, y0 + uy*len); g.stroke();
      g.strokeStyle = "#f3d3a4"; g.lineWidth = 2.4; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + ux*len, y0 + uy*len); g.stroke();
      g.strokeStyle = "#e5486a"; g.beginPath(); g.moveTo(x0 + ux*len*0.55, y0 + uy*len*0.55); g.lineTo(x0 + ux*len*0.62, y0 + uy*len*0.62); g.stroke();
      g.fillStyle = "#f7a7b8"; g.strokeStyle = O; g.lineWidth = 0.8; g.beginPath(); g.arc(x0, y0, 2.6, 0, 7); g.fill(); g.stroke();
    }
  }
  function loop(){
    if(done) return;
    if(anim){
      for(let i=0;i<4 && anim.sim.moving;i++){ const before = anim.sim.ev.pocketed.length, hb = anim.sim.ev.hits.length; anim.sim.step();
        if(anim.sim.ev.pocketed.length > before){ for(const n of anim.sim.ev.pocketed.slice(before)){ const b = anim.sim.balls.find(x => x.n === n); fade.push({ n, x: b.px - 8, y: b.py - 9.5, life: 0.3 }); } snd("match"); }
        if(anim.sim.ev.hits.length > hb && anim.sim.ev.hits[anim.sim.ev.hits.length-1] > 0.08) snd("key"); }
      view = anim.sim.balls.filter(b => !b.in).map(b => [b.n, b.x, b.y]);
      if(!anim.sim.moving){ const a = anim; anim = null; a.end(); }
    }
    for(const f of fade) f.life -= 1/60; fade = fade.filter(f => f.life > 0);
    try{ draw(); }catch(e){}
    raf = requestAnimationFrame(loop);
  }
  function play(start, ang, p, who){ return new Promise(res => { view = start.map(b => b.slice()); anim = { sim: makeSim(start, ang, p), who, end: () => res(anim) }; const a = anim; a.end = () => res(a.sim); hud(); }); }
  async function shoot(){
    if(!myTurn() || pow < 0.04) { pow = 0; paintPow(); return; }
    const p = pow, a = aim; pow = 0; paintPow(); busy = true; snd("shoot");
    const start = view.map(([n,x,y]) => [n, Math.round(x*100)/100, Math.round(y*100)/100]);
    const st0 = JSON.parse(JSON.stringify(S)); st0.balls = start;
    busy = false; const sim = await play(start, a, p, me); busy = true;
    const ns = judge(st0, sim, me, o.practice); ns.last = Object.assign(ns.last || {}, { a, pw: p, start });
    msg(ns.last.msg); if(ns.win) snd(ns.win === me ? "level" : "miss");
    const saved = await o.onShot(ns, st0);
    busy = false;
    if(saved){ S = saved; } else { S = o.getS(); }
    view = S.balls.map(b => b.slice()); hud();
  }
  // partner's shot arrives
  async function external(ns){
    if(!ns || (S && ns.seq <= S.seq)) { if(ns && !anim && !busy){ S = ns; view = S.balls.map(b=>b.slice()); hud(); } return; }
    const L = ns.last;
    if(L && L.start && L.by !== me && ns.seq === S.seq + 1 && !anim && !busy){ S = Object.assign({}, S, { turn: null }); hud(); await play(L.start, L.a, L.pw, L.by); msg(L.msg); }
    S = ns; view = S.balls.map(b => b.slice()); hud();
    if(S.win) snd(S.win === me ? "level" : "miss"); else if(S.turn === me) snd("select");
  }
  // input
  const toTable = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * CW - RAIL, (e.clientY - r.top) / r.height * CH - RAIL]; };
  const wrap = $("#plWrap");
  wrap.addEventListener("pointerdown", e => { if(!myTurn()) return; const [x, y] = toTable(e), c = cueOf(); try{ wrap.setPointerCapture(e.pointerId); }catch(_){}
    if(S.hand && c && Math.hypot(x - c[1], y - c[2]) < R*2.6){ dragging = { ball: true }; return; }
    dragging = { ball: false }; if(c) aim = Math.atan2(y - c[2], x - c[1]); });
  wrap.addEventListener("pointermove", e => { if(!dragging || !myTurn()) return; const [x, y] = toTable(e), c = cueOf(); if(!c) return;
    if(dragging.ball){ let nx = Math.max(R, Math.min(TW-R, x)), ny = Math.max(S.hand === "head" ? HEADY + R : R, Math.min(TH-R, y)); if(freeSpot(view, nx, ny)){ c[1] = nx; c[2] = ny; } return; }
    aim = Math.atan2(y - c[2], x - c[1]); });
  const endDrag = () => { if(dragging && dragging.ball){ S.balls = view.map(b => b.slice()); } dragging = null; };
  wrap.addEventListener("pointerup", endDrag); wrap.addEventListener("pointercancel", endDrag);
  ov.querySelectorAll(".plFine").forEach(b => { let rep = 0, rep2 = 0; const act = () => { aim += (+b.dataset.d) * 0.004; };
    b.addEventListener("pointerdown", e => { e.preventDefault(); act(); rep = setTimeout(() => { rep2 = setInterval(act, 40); }, 260); });
    const up = () => { clearTimeout(rep); clearInterval(rep2); }; b.addEventListener("pointerup", up); b.addEventListener("pointerleave", up); b.addEventListener("pointercancel", up); });
  // power wand
  const PW = $("#plPow"); let pd = null;
  function paintPow(){ $("#plFill").style.width = (pow*100) + "%"; $("#plWand").style.left = `calc(${pow*100}% - ${pow*36}px)`; $("#plPowT").textContent = pd ? `力道 ${Math.round(pow*100)}%` : "往右拉逗貓棒 → 放開打"; }
  PW.addEventListener("pointerdown", e => { if(!myTurn()) return; pd = { x: e.clientX, w: PW.getBoundingClientRect().width }; try{ PW.setPointerCapture(e.pointerId); }catch(_){} paintPow(); });
  PW.addEventListener("pointermove", e => { if(!pd) return; pow = Math.max(0, Math.min(1, (e.clientX - pd.x) / (pd.w*0.85))); paintPow(); });
  PW.addEventListener("pointerup", () => { if(!pd) return; pd = null; shoot(); });
  PW.addEventListener("pointercancel", () => { pd = null; pow = 0; paintPow(); });
  function close(){ if(done) return; done = true; cancelAnimationFrame(raf); window.removeEventListener("resize", size); ov.remove(); if(o.onClose) o.onClose(); }
  $("#plX").addEventListener("click", () => { snd("tap"); close(); });
  window.addEventListener("resize", size);
  hud(); paintPow();
  if(S.last && S.last.msg && S.last.by !== me) msg(S.last.msg);
  requestAnimationFrame(() => { size(); raf = requestAnimationFrame(loop); });
  const api = { external, close, el: ov, practice: !!o.practice, get S(){ return S; } };
  if(window.__mock) window.__pl = { api, set aim(v){ aim = v; }, get aim(){ return aim; }, shootWith: (a, p) => { aim = a; pow = p; return shoot(); }, view: () => view, cue: (x, y) => { const c = cueOf(); c[1] = x; c[2] = y; S.balls = view.map(b=>b.slice()); } };
  return api;
}

if(window.GameArt) window.GameArt.pool = () => `<span class="gaL plArt" style="left:4%;top:8%;width:92%;height:84%"><i></i>${[[3,30,40],[9,48,30],[8,48,52],[12,64,40],[0,22,78]].map(([n,x,y])=>`<img src="${ballUrl(n)}" style="left:${x}%;top:${y}%">`).join("")}</span>`;

App.registerGame({
  id: "pool",
  name: "喵喵撞球",
  desc: "貓貓 8 號球，輪流打不用同時在線",
  icon: () => Pix.sprite("black","happy"),
  mount(el, ctx){
    const { esc, SFX } = ctx;
    let s = null, tbl = null, practice = null;
    const me = () => ctx.me.uid;
    function lobby(){
      const p = ctx.partner(), ids = ctx.players();
      const st = s, nm = u => u === me() ? "你" : ctx.nameOf(u);
      const status = !st ? "" : st.win ? `上一局：${esc(nm(st.win))} 贏了 🏆` : st.turn === me() ? `<b style="color:var(--pinkT);font-weight:400">輪到你打了！</b>` : `等 ${esc(nm(st.turn))} 打…`;
      el.innerHTML = `<div class="box plLobby">
        <div class="plRack">${[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15].map(n=>ballImg(n)).join("")}</div>
        <p class="plIntro">把<b>自己那組的貓</b>全部打進洞，最後打進 <b>8 號小黑貓</b> 就贏了！<br>${ballImg(1,"plIn")}素色貓 vs ${ballImg(9,"plIn")}條紋貓，第一顆進洞的決定分組</p>
        <div class="plHow"><span>拖曳球桌：瞄準</span><span>往右拉逗貓棒：力道</span><span>放開：打出去</span><span>犯規換對方自由擺白貓</span></div>
        ${p && st ? `<div class="plScore">${(st.p||ids).map(u => `<div><b>${esc(nm(u))}</b><span>${(st.sc && st.sc[u]) || 0} 勝</span></div>`).join("")}</div><div class="plStatus">${status}</div>` : ""}
        ${p ? `<button class="btn" id="plGo">🎱 ${st && !st.win ? "進入球桌" : "開新的一局"}</button>${st && !st.win ? `<button class="btn sub" id="plNew" style="width:100%">重新開一局</button>` : ""}` : `<div class="k" style="text-align:center">${ctx.pw ? ctx.pw() : "另一半"}加入後就可以一起打了</div>`}
        <button class="btn sub" id="plPr" style="width:100%">🐾 自己練習</button></div>`;
      const go = el.querySelector("#plGo"); if(go) go.addEventListener("click", async () => { SFX.tap(); if(!s || s.win){ await newGame(); } openTable(false); });
      const nw = el.querySelector("#plNew"); if(nw) nw.addEventListener("click", () => { SFX.tap(); ctx.askRestart("pool"); });
      el.querySelector("#plPr").addEventListener("click", () => { SFX.tap(); practice = fresh([me(), me()]); practice.hand = "head"; openTable(true); });
    }
    async function newGame(){
      const ids = ctx.players(); if(ids.length < 2) return;
      const ns = await ctx.update("pool", st => { const sc = st && st.sc; const first = st && st.p ? (st.win ? (st.win === st.p[0] ? st.p[1] : st.p[0]) : st.p[0]) : ids[0]; const pp = [first, ids.find(i => i !== first)]; return fresh(pp, sc); });
      if(ns) s = ns;
    }
    function openTable(prac){
      if(tbl) return;
      tbl = table({ me: me(), practice: prac, sfx: SFX, nameOf: ctx.nameOf,
        getS: () => prac ? practice : s,
        onShot: async (ns, st0) => {
          if(prac){ practice = ns; return ns; }
          const saved = await ctx.update("pool", st => { if(!st || st.seq !== st0.seq) return undefined; return ns; });
          if(saved){ s = saved;
            if(saved.win){ ctx.notifyPartner(saved.win === me() ? `${ctx.me.name} 在「喵喵撞球」贏了這局 🎱` : `${ctx.me.name} 在「喵喵撞球」打進小黑貓輸了，你贏了！🎉`);
              if(saved.win === me()) ctx.update("pet", pt=>{ if(!pt || !window.PetLogic) return undefined; pt = window.PetLogic.norm(JSON.parse(JSON.stringify(pt))); pt.coins = (pt.coins||0) + 5; pt.log = (pt.log||[]).concat([{ by:me(), a:"pool", n:5, at:Date.now() }]).slice(-24); return pt; }).catch(()=>{}); }
            else if(saved.turn !== me()) ctx.notifyPartner(`${ctx.me.name} 打完一桿了，輪到你打撞球囉 🎱`);
            return saved; }
          const cur = await ctx.getState("pool").catch(()=>null); s = cur ? cur.state : s; return null;
        },
        onClose: () => { tbl = null; lobby(); } });
    }
    this._close = () => { if(tbl) tbl.close(); };
    this._rs = ctx.restartable("pool", { title:"喵喵撞球", done: ()=>!s || !!s.win || !s.seq, run: async ()=>{ await newGame(); if(tbl && !tbl.practice){ tbl.close(); } lobby(); } });
    this._u = ctx.onState("pool", st => { s = st; if(tbl && !tbl.el.isConnected) tbl = null; if(tbl && !tbl.practice) tbl.external(st); else if(!tbl) lobby(); });
    (async()=>{ const cur = await ctx.getState("pool").catch(()=>null); s = cur ? cur.state : null; lobby(); })();
  },
  unmount(){ if(this._rs) this._rs(); if(this._u) this._u(); if(this._close) this._close(); },
});
})();

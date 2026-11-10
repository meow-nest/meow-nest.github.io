// 遊戲：喵喵夾娃娃機（像真的娃娃機：前後左右移動、30 秒倒數、娃娃有物理）
// 投幣後用十字鍵移動爪子，按「夾！」或時間到就下爪。娃娃會滾、會疊、會卡在出口擋板上，也可以把娃娃推進出口。
// 每天 10 次免費，之後 1 次 1 個貓幣。連續沒夾到 8 次，下一次一定夾得到（幸運值）。
// 夾到的娃娃收進「收藏」，有重複的可以送給 ta。
(function(){
const O = "#5a3b2e";
const PX = (rows, pal) => { pal = Object.assign({ O }, pal); const w = Math.max(...rows.map(r => r.length)), h = rows.length; let r = "";
  rows.forEach((row, y) => [...row].forEach((c, x) => { if(pal[c]) r += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${pal[c]}"/>`; }));
  return `<svg viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg">${r}</svg>`; };
const CLAW_OPEN = PX(["....OOOOO....","....OGGGO....","..OOOGGGOOO..",".OGGGHGGGGGO.","OGO.......OGO","OGO.......OGO","OGO.......OGO",".OGO.....OGO.","..OO.....OO.."], { O: "#5b6b8c", G: "#c9d3e3", H: "#ffffff" });
const CLAW_SHUT = PX(["....OOOOO....","....OGGGO....","..OOOGGGOOO..",".OGGGHGGGGGO.","..OGO...OGO..","...OGO.OGO...","....OGOGO....",".....OOO....."], { O: "#5b6b8c", G: "#c9d3e3", H: "#ffffff" });
const MOUSE = PX([".OOO.......OOO.","OGPGO.....OGPGO","OGPGOOOOOOOGPGO",".OGGGGGGGGGGGO.","..OGEHGGGEHGO..","..OGEEGGGEEGO..","WW.OGGGNGGGO.WW","..WWOGGGGGOWW..","....OOGGGOO....","......OOO......"], { G: "#b8bfd2", P: "#f7a7b8", N: "#f0708d", E: "#2b1d18", H: "#fff", W: "#fff" });
const CROWN = PX(["O...O...O","OYO.OYO.OYO".slice(0, 9),"OYYOYYOYO","OYYYRYYYO","OOOOOOOOO"], { Y: "#f6c45f", R: "#e5484d" });
const HALO = PX(["..OOOOO..",".OY...YO.","..OOOOO.."], { Y: "#fff07a", O: "#e8a400" });

// 娃娃：[名字, 稀有度 0 普通 1 稀有 2 超稀有, 畫法, 特效 class]
const PRIZES = [
  ["橘貓娃娃", 0, () => Pix.sprite("orange", "happy")],
  ["白貓娃娃", 0, () => Pix.sprite("white", "normal")],
  ["灰貓娃娃", 0, () => Pix.sprite("gray", "happy")],
  ["吐司貓", 0, () => Pix.sprite("orange", "loaf")],
  ["小魚抱枕", 0, () => Pix.icon("fish")],
  ["愛心抱枕", 0, () => Pix.icon("heart")],
  ["貓掌抱枕", 0, () => Pix.icon("paw")],
  ["老鼠玩偶", 0, () => MOUSE],
  ["黑貓娃娃", 1, () => Pix.sprite("black", "love")],
  ["三花貓娃娃", 1, () => Pix.sprite("calico", "happy")],
  ["捲捲貓", 1, () => Pix.sprite("gray", "curl")],
  ["星星抱枕", 1, () => Pix.icon("star")],
  ["粉紅小魚", 1, () => Pix.icon("fish", { B: "#f7a7b8" })],
  ["金色招財貓", 2, () => Pix.sprite("orange", "wave"), "gold"],
  ["彩虹貓", 2, () => Pix.sprite("white", "happy"), "rainbow"],
  ["皇冠貓", 2, () => `<span class="cwCrown">${CROWN}</span>${Pix.sprite("calico", "love")}`],
  ["天使貓", 2, () => `<span class="cwHalo">${HALO}</span>${Pix.sprite("white", "sleep")}`],
];
const RAR = [["普通", "#9aa3bd"], ["稀有", "#5e9de6"], ["超稀有", "#e8a400"]];
const FREE = 10, PITY = 8;
const today = () => new Date().toDateString();
const pick = () => { const r = Math.random(), tier = r < .07 ? 2 : r < .32 ? 1 : 0; const L = PRIZES.map((p, i) => [p, i]).filter(([p]) => p[1] === tier); return L[(Math.random()*L.length)|0][1]; };
const art = i => `<span class="cwArt ${PRIZES[i][3] || ""}">${PRIZES[i][2]()}</span>`;


// ---------- 3D 機台（地板座標 x 左→右、z 前→後，0～1；y 是高度） ----------
const R = .082, HX = .27, HZ = .29, RIM = .085, YTOP = .86, CR = .045, G3 = 3.4, SPEED = .34, TIME = 30;
const HOME = { x: HX/2, z: HZ/2 };

App.registerGame({
  id: "claw",
  solo: true,
  wip: true,   // 站長測試中：一般使用者先看不到
  name: "喵喵夾娃娃機",
  desc: "像真的娃娃機！前後左右對準，夾娃娃收集貓咪玩偶",
  icon: () => Pix.sprite("orange", "wave"),
  mount(el, ctx){
    const { esc, SFX } = ctx, K = window.MiniKit;
    let s = null, alive = true, raf = 0;
    const me = () => ctx.me.uid, partner = () => ctx.partner();
    const myCol = () => ((s && s.col) || {})[me()] || {};
    const triesLeft = () => { const t = ((s && s.tries) || {})[me()]; return t && t.day === today() ? Math.max(0, FREE - t.n) : FREE; };
    const luck = () => ((s && s.luck) || {})[me()] || 0;
    const owned = c => Object.keys(c).filter(k => c[k] > 0).length;

    document.body.classList.add("cwOn");
    el.innerHTML = `<div class="box cw">
      <div class="cwTop"><div class="cwInfo" id="cwInfo"></div><button class="btn sub cwColBtn" id="cwCol">🎁 收藏</button></div>
      <div class="cwM"><div class="cwMarq"><span class="cwLights"></span><b>喵喵夾娃娃機</b><span class="cwLights"></span></div>
        <div class="cw3" id="cw3"><svg class="cwBg" id="cwBg"></svg><svg class="cwRimB" id="cwRimB"></svg><svg class="cwRimA" id="cwRimA"></svg>
          <div class="cwGantry" id="cwGantry"></div><div class="cwShadow" id="cwShadow"></div><div class="cwRope3" id="cwRope"></div><svg class="cwClawL" id="cwClawB"></svg><svg class="cwClawL" id="cwClawF"></svg>
          <div class="cwFront"><span>⬇ 出口</span></div><div class="cwShine"></div><div class="cwTimer hidden" id="cwTimer">30</div></div>
        <div class="cwMsg" id="cwMsg">按「投幣」開始，30 秒內用十字鍵把爪子移到娃娃正上方</div>
        <div class="cwPanel3"><div class="cwPad"><button data-d="up" class="u">▲</button><button data-d="left" class="l">◀</button><button data-d="right" class="r">▶</button><button data-d="down" class="d">▼</button><i></i></div>
          <button class="cwGo" id="cwGo">投幣</button></div></div></div>`;
    const V = el.querySelector("#cw3"), clawB = el.querySelector("#cwClawB"), clawF = el.querySelector("#cwClawF"), rope = el.querySelector("#cwRope"), gantry = el.querySelector("#cwGantry"), shadow = el.querySelector("#cwShadow"),
      timerEl = el.querySelector("#cwTimer"), msgEl = el.querySelector("#cwMsg"), goBtn = el.querySelector("#cwGo");
    const msg = (h, cls) => { msgEl.innerHTML = h; msgEl.className = "cwMsg " + (cls || ""); };

    // ---- 投影 ----
    let W = 300, H = 320, Wf = 270, FY = 280, BY = 140;
    const sz = z => 1 - .36*z;
    const PX = (x, z) => W/2 + (x - .5)*Wf*sz(z);
    const PY = (z, y) => FY + (BY - FY)*z - y*Wf*sz(z)*.56;
    function sizes(){ W = V.clientWidth;
      // 機台高度：盡量大，但十字鍵和按鈕要留在畫面裡
      const room = window.innerHeight - 270; V.style.height = Math.round(Math.max(250, Math.min(W*1.1, room))) + "px";
      H = V.clientHeight; Wf = W*.94; FY = H*.8; BY = H*.36; drawMachine(); }
    function drawMachine(){
      const P = (x, z, y) => `${PX(x, z).toFixed(1)},${PY(z, y || 0).toFixed(1)}`;
      const top = 1.0;
      el.querySelector("#cwBg").innerHTML =
        `<defs><pattern id="cwChk" width="22" height="22" patternUnits="userSpaceOnUse"><rect width="22" height="22" fill="#ffd9e3"/><rect width="11" height="11" fill="#ffc8d6"/><rect x="11" y="11" width="11" height="11" fill="#ffc8d6"/></pattern>
          <pattern id="cwHaz" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="12" height="12" fill="#ffd34d"/><rect width="5" height="12" fill="#5a3b2e"/></pattern></defs>
        <linearGradient id="cwWallL" x1="0" x2="1"><stop offset="0" stop-color="#bcd6f2"/><stop offset="1" stop-color="#e3f0ff"/></linearGradient><linearGradient id="cwWallR" x1="1" x2="0"><stop offset="0" stop-color="#bcd6f2"/><stop offset="1" stop-color="#e3f0ff"/></linearGradient><linearGradient id="cwFloorF" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a3b5e" stop-opacity=".28"/><stop offset=".55" stop-color="#5a3b5e" stop-opacity="0"/></linearGradient><linearGradient id="cwBack" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfe3fa"/><stop offset="1" stop-color="#b7cfeb"/></linearGradient>
        <polygon points="${P(0,1,0)} ${P(1,1,0)} ${P(1,1,top)} ${P(0,1,top)}" fill="url(#cwBack)"/>
        <polygon points="${P(0,0,0)} ${P(0,1,0)} ${P(0,1,top)} ${P(0,0,top)}" fill="url(#cwWallL)"/>
        <polygon points="${P(1,0,0)} ${P(1,1,0)} ${P(1,1,top)} ${P(1,0,top)}" fill="url(#cwWallR)"/>
        <polygon points="${P(0,0,0)} ${P(1,0,0)} ${P(1,1,0)} ${P(0,1,0)}" fill="url(#cwChk)" stroke="#5a3b2e" stroke-width="2"/><polygon points="${P(0,0,0)} ${P(1,0,0)} ${P(1,1,0)} ${P(0,1,0)}" fill="url(#cwFloorF)"/>
        <polygon points="${P(0,0,0)} ${P(HX,0,0)} ${P(HX,HZ,0)} ${P(0,HZ,0)}" fill="#2e2240"/>
        <polygon points="${P(.02,.02,0)} ${P(HX-.02,.02,0)} ${P(HX-.02,HZ-.02,0)} ${P(.02,HZ-.02,0)}" fill="#1b1428"/>
        <line x1="${PX(0,1)}" y1="${PY(1,top)}" x2="${PX(1,1)}" y2="${PY(1,top)}" stroke="#9aa6bd" stroke-width="5"/>
        <line x1="${PX(0,0)}" y1="${PY(0,top)}" x2="${PX(0,1)}" y2="${PY(1,top)}" stroke="#9aa6bd" stroke-width="5"/><line x1="${PX(1,0)}" y1="${PY(0,top)}" x2="${PX(1,1)}" y2="${PY(1,top)}" stroke="#9aa6bd" stroke-width="5"/>`;
      // 出口旁邊的透明擋板（娃娃要越過它才會掉進去）
      const rim = (a, b) => `<polygon points="${P(a[0],a[1],0)} ${P(b[0],b[1],0)} ${P(b[0],b[1],RIM)} ${P(a[0],a[1],RIM)}" fill="rgba(170,215,255,.45)" stroke="#6f8fb8" stroke-width="2"/>`;
      el.querySelector("#cwRimB").innerHTML = rim([0, HZ], [HX, HZ]);
      el.querySelector("#cwRimA").innerHTML = rim([HX, 0], [HX, HZ]);
      el.querySelectorAll(".cwBg,.cwRimA,.cwRimB,.cwClawL").forEach(x => x.setAttribute("viewBox", `0 0 ${W} ${H}`));
    }

    // ---- 娃娃（物理球） ----
    let prizes = [];
    const inHole = (x, z) => x < HX && z < HZ;
    function mk(kind, x, y, z){ const p = { kind, x, y, z, vx: 0, vy: 0, vz: 0, r: R, rot: (Math.random() - .5)*40, held: false, el: document.createElement("div") };
      p.el.className = "cwP3"; p.el.innerHTML = art(kind); p.sh = document.createElement("div"); p.sh.className = "cwPSh"; V.appendChild(p.sh); V.appendChild(p.el); p.sq = 0; p.fz = -1; prizes.push(p); return p; }
    function spawn(n){ for(let i = 0; i < n; i++){ let x, z; do{ x = .08 + Math.random()*.84; z = .08 + Math.random()*.84; } while(x < HX + R*2 && z < HZ + R*2); mk(pick(), x, .35 + Math.random()*.5, z); } }
    // 爪子：三根爪腳，每根都是會真的碰到娃娃的小球（kinematic）
    const OPEN = .128, CLOSED = .022, CRR = .017;
    const claw = { x: HOME.x, z: HOME.z, tip: YTOP, r: OPEN, rT: OPEN, vx: 0, vz: 0, swing: 0, contact: false };
    const ANG = [Math.PI/2, Math.PI/2 + 2*Math.PI/3, Math.PI/2 + 4*Math.PI/3];
    function prongs(c){ return ANG.map(a => { const ca = Math.cos(a), sa = Math.sin(a), hy = c.tip + .16, ey = c.tip + .085;
      const pt = (rad, y) => [c.x + ca*rad, y, c.z + sa*rad];
      return { front: sa < 0, pts: [pt(.024, hy), pt(c.r*.85 + .04, ey), pt(c.r, c.tip), pt(Math.max(0, c.r - .022), c.tip + .012)] }; }); }
    function colliders(c){ const L = [[c.x, c.tip + .155, c.z, .032, 1]]; prongs(c).forEach(pr => { const [h, e, t, k] = pr.pts; L.push(e, [(e[0] + t[0])/2, (e[1] + t[1])/2, (e[2] + t[2])/2], t, k); }); return L; }
    let captured = [];

    function physics(dt, C0, C1){
      const n = prizes.length;
      for(const p of prizes){
        p.vy -= G3*dt; p.x += p.vx*dt; p.y += p.vy*dt; p.z += p.vz*dt;
        const hole = inHole(p.x, p.z);
        if(!hole && p.y < p.r){ p.y = p.r; if(p.vy < -.6) p.sq = Math.min(.25, -p.vy*.08); if(p.vy < 0) p.vy *= -.18; p.vx *= Math.max(0, 1 - 4.5*dt); p.vz *= Math.max(0, 1 - 4.5*dt); p.rot += p.vx*dt*500; }
        // 牆
        if(p.x < p.r){ p.x = p.r; p.vx = Math.abs(p.vx)*.3; } if(p.x > 1 - p.r){ p.x = 1 - p.r; p.vx = -Math.abs(p.vx)*.3; }
        if(p.z < p.r && !hole){ p.z = p.r; p.vz = Math.abs(p.vz)*.3; } if(p.z > 1 - p.r){ p.z = 1 - p.r; p.vz = -Math.abs(p.vz)*.3; }
        if(hole){ if(p.z < p.r*.6) { p.z = p.r*.6; p.vz = Math.abs(p.vz)*.2; } if(p.x < p.r*.6){ p.x = p.r*.6; p.vx = Math.abs(p.vx)*.2; } }
        // 出口擋板（兩片薄牆，上緣是圓的，可以滾過去）
        for(const [ax, az, bx, bz] of [[0, HZ, HX, HZ], [HX, 0, HX, HZ]]){
          const qx = Math.max(Math.min(ax, bx), Math.min(Math.max(ax, bx), p.x)), qz = Math.max(Math.min(az, bz), Math.min(Math.max(az, bz), p.z)), qy = Math.max(0, Math.min(RIM, p.y));
          const dx = p.x - qx, dy = p.y - qy, dz = p.z - qz, d = Math.hypot(dx, dy, dz);
          if(d < p.r && d > 1e-6){ const k = (p.r - d)/d; p.x += dx*k; p.y += dy*k; p.z += dz*k; const vn = (p.vx*dx + p.vy*dy + p.vz*dz)/d; if(vn < 0){ p.vx -= 1.3*vn*dx/d; p.vy -= 1.3*vn*dy/d; p.vz -= 1.3*vn*dz/d; } }
        }
        p.vx *= 1 - .4*dt; p.vz *= 1 - .4*dt;
      }
      // 娃娃互相推擠
      for(let i = 0; i < n; i++) for(let j = i + 1; j < n; j++){
        const a = prizes[i], b = prizes[j], dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, d = Math.hypot(dx, dy, dz), m = a.r + b.r;
        if(d >= m || d < 1e-6) continue;
        const nx = dx/d, ny = dy/d, nz = dz/d, ov = m - d, wa = a.held ? 0 : b.held ? 1 : .5, wb = 1 - wa;
        a.x -= nx*ov*wa; a.y -= ny*ov*wa; a.z -= nz*ov*wa; b.x += nx*ov*wb; b.y += ny*ov*wb; b.z += nz*ov*wb;
        const vn = (b.vx - a.vx)*nx + (b.vy - a.vy)*ny + (b.vz - a.vz)*nz;
        if(vn < 0){ const jv = -1.2*vn; if(!a.held){ a.vx -= jv*nx*wa*2; a.vy -= jv*ny*wa*2; a.vz -= jv*nz*wa*2; } if(!b.held){ b.vx += jv*nx*wb*2; b.vy += jv*ny*wb*2; b.vz += jv*nz*wb*2; } }
        // 疊在上面的娃娃會慢慢往旁邊滑（像真的娃娃堆）
        if(Math.abs(ny) > .6 && !a.held && !b.held){ const top = ny > 0 ? b : a; top.vx += (ny > 0 ? nx : -nx)*.35*dt*10; top.vz += (ny > 0 ? nz : -nz)*.35*dt*10; }
      }
      // 爪腳：真的碰撞。娃娃被推開、被撐住、被帶著走，都是碰撞算出來的
      if(C1){ const A = colliders(C0), B = colliders(C1);
        // 每隻娃娃把所有爪腳的推力加起來一次算（三根同時夾，才不會被擠飛）
        for(const p of prizes){ let fx = 0, fy = 0, fz = 0, n = 0, vx = 0, vy = 0, vz = 0;
          for(let ci = 0; ci < B.length; ci++){ const c = B[ci], dx = p.x - c[0], dy = p.y - c[1], dz = p.z - c[2], d = Math.hypot(dx, dy, dz), m = p.r + (c[3] || CRR);
            if(d >= m || d < 1e-6) continue; const nx = dx/d, ny = dy/d, nz = dz/d, ov = m - d; n++;
            fx += nx*ov; fy += ny*ov; fz += nz*ov;
            const cv = [(c[0] - A[ci][0])/dt, (c[1] - A[ci][1])/dt, (c[2] - A[ci][2])/dt];
            const rvx = p.vx - cv[0], rvy = p.vy - cv[1], rvz = p.vz - cv[2], vn = rvx*nx + rvy*ny + rvz*nz;
            if(vn < 0){ vx -= vn*nx; vy -= vn*ny; vz -= vn*nz; }
            const tx = rvx - vn*nx, ty = rvy - vn*ny, tz = rvz - vn*nz; vx -= tx*.3; vy -= ty*.3; vz -= tz*.3;
            if(c[4] && ny < -.3) claw.contact = true;
            if(!c[4] && state === "close") claw.grip = true; }
          if(n){ p.x += fx; p.y += fy; p.z += fz; p.vx += vx/n*Math.min(n, 1.5); p.vy += vy/n*Math.min(n, 1.5); p.vz += vz/n*Math.min(n, 1.5); } } }
      // 幸運值滿了：爪子會把娃娃穩穩抱住
      if(lucky() && (state === "rise" || state === "top" || state === "back")) for(const p of prizes){ const h = Math.hypot(p.x - claw.x, p.z - claw.z);
        if(h < .13 && p.y > claw.tip - .06 && p.y < claw.tip + .2){ p.vx += (claw.x - p.x)*40*dt + (claw.vx - p.vx)*8*dt; p.vz += (claw.z - p.z)*40*dt + (claw.vz - p.vz)*8*dt; p.vy += (claw.tip + .075 - p.y)*40*dt; } }
      // 掉進出口
      for(const p of prizes.slice()) if(p.y < -.32){ captured.push(p.kind); p.el.remove(); p.sh.remove(); prizes = prizes.filter(x => x !== p); SFX.coin && SFX.coin(); }
    }
    function draw(){
      for(const p of prizes){ const k = sz(p.z), size = 2*p.r*Wf*k*1.45, X = PX(p.x, p.z), Y = PY(p.z, p.y);
        p.sq *= .82; const sx = 1 + p.sq*.6, sy = 1 - p.sq;
        p.el.style.width = size + "px"; p.el.style.transform = `translate(${X - size/2}px, ${Y - size*.62}px) rotate(${(p.rot % 360).toFixed(1)}deg) scale(${sx.toFixed(3)},${sy.toFixed(3)})`;
        // 地上的影子：離地越高越小越淡
        const h = Math.max(0, p.y - p.r), sw = size*.9*Math.max(.35, 1 - h*1.6), inH = inHole(p.x, p.z);
        p.sh.style.width = sw + "px"; p.sh.style.height = (sw*.32) + "px"; p.sh.style.transform = `translate(${X - sw/2}px, ${PY(p.z, 0) - sw*.16}px)`; p.sh.style.opacity = inH ? 0 : Math.max(0, .55 - h*1.2).toFixed(2);
        // 越後面越暗一點（有景深）
        const fz = Math.round(p.z*20); if(fz !== p.fz){ p.fz = fz; p.el.style.filter = `brightness(${(1 - p.z*.16).toFixed(2)}) saturate(${(1 - p.z*.12).toFixed(2)})`; }
        p.el.style.zIndex = Math.round(2000 - p.z*1000 + p.y*60);
        p.el.style.opacity = p.y < -.12 ? Math.max(0, 1 + (p.y + .12)*6) : 1; }
      const k = sz(claw.z), cx = PX(claw.x, claw.z), topY = PY(claw.z, 1.0), hubY = PY(claw.z, claw.tip + .16), base = Math.round(2000 - claw.z*1000 + claw.tip*60);
      gantry.style.left = PX(0, claw.z) + "px"; gantry.style.width = (PX(1, claw.z) - PX(0, claw.z)) + "px"; gantry.style.top = (topY - 3) + "px"; gantry.style.zIndex = base + 150;
      rope.style.left = (cx - 1.5) + "px"; rope.style.top = topY + "px"; rope.style.height = Math.max(0, hubY - topY) + "px"; rope.style.zIndex = base + 150;
      // 三根爪腳：後面那根畫在娃娃後面，前面兩根畫在娃娃前面
      const sw = claw.swing*.0025, P2 = q => `${(PX(q[0] + sw*(q[1] - claw.tip - .16)*-1, q[2])).toFixed(1)},${PY(q[2], q[1]).toFixed(1)}`;
      let back = "", front = ""; const lw = Math.max(3, 6*k);
      prongs(claw).forEach(pr => { const pts = pr.pts.map(P2).join(" ");
        const g = `<polyline points="${pts}" fill="none" stroke="#4a5878" stroke-width="${lw}" stroke-linejoin="round" stroke-linecap="round"/><polyline points="${pts}" fill="none" stroke="#c9d3e3" stroke-width="${lw*.4}" stroke-linejoin="round" stroke-linecap="round"/>`;
        if(pr.front) front += g; else back += g; });
      const hubW = 16*k, hub = `<rect x="${cx - hubW/2}" y="${hubY - hubW*.55}" width="${hubW}" height="${hubW*.75}" rx="${hubW*.2}" fill="#9aa6bd" stroke="#4a5878" stroke-width="2"/><rect x="${cx - hubW*.3}" y="${hubY - hubW*.45}" width="${hubW*.25}" height="${hubW*.2}" fill="#fff" opacity=".7"/>`;
      clawB.innerHTML = back; clawF.innerHTML = front + hub; clawB.style.zIndex = base - 90; clawF.style.zIndex = base + 120;
      shadow.style.width = (34*k) + "px"; shadow.style.height = (10*k) + "px"; shadow.style.transform = `translate(${cx - 17*k}px, ${PY(claw.z, 0) - 5*k}px)`;
      shadow.style.opacity = state === "aim" ? .5 : .25;
    }

    // ---- 流程 ----
    let state = "idle", tLeft = TIME, dir = { x: 0, z: 0 }, lastPlay = -1e9;
    function info(){
      const tl = triesLeft(), l = luck(), c = myCol();
      el.querySelector("#cwInfo").innerHTML = `<div>今天免費 <b>${tl}</b> / ${FREE} 次</div><div class="cwLuck">幸運值 <i>${Array.from({ length: PITY }, (_, i) => `<span class="${i < l ? "on" : ""}"></span>`).join("")}</i></div>`;
      el.querySelector("#cwCol").textContent = `🎁 收藏 ${owned(c)}/${PRIZES.length}`;
      if(state === "idle"){ goBtn.textContent = tl > 0 ? "投幣" : "1🪙 投幣"; goBtn.classList.toggle("paid", tl <= 0); goBtn.classList.remove("grab"); }
    }
    async function pay(){
      if(triesLeft() > 0){ let ok = false; await ctx.update("claw", st => { st = st || {}; st.tries = st.tries || {}; const t = st.tries[me()];
          const cur = t && t.day === today() ? t : { day: today(), n: 0 }; if(cur.n >= FREE) return undefined; cur.n++; st.tries[me()] = cur; ok = true; return st; }); return ok; }
      let ok = false;
      await ctx.update("pet", st => { if(!st || !(st.coins >= 1)) return undefined; st = JSON.parse(JSON.stringify(st)); st.coins -= 1; ok = true; return st; });
      if(!ok) ctx.toast("今天的免費次數用完了，貓幣也不夠～<br>明天再來，或玩其他遊戲賺貓幣吧 🪙", 4000);
      return ok;
    }
    goBtn.addEventListener("click", async () => {
      if(state === "idle"){ state = "paying"; if(!(await pay())){ state = "idle"; return; }
        SFX.coin ? SFX.coin() : SFX.select(); state = "aim"; tLeft = TIME; timerEl.classList.remove("hidden"); goBtn.textContent = "夾！"; goBtn.classList.add("grab"); goBtn.classList.remove("paid");
        msg("用十字鍵移動爪子 🕹 看地上的影子對準，按「夾！」"); info(); }
      else if(state === "aim") startDrop();
    });
    let seq = null, holdSet = new Set();   // 自動流程的計時、被爪子撐起來的娃娃
    function startDrop(){ if(state !== "aim") return; state = "drop"; dir = { x: 0, z: 0 }; timerEl.classList.add("hidden"); goBtn.textContent = "…"; goBtn.classList.remove("grab"); SFX.tap(); msg("爪子下去囉…"); seq = { t: 0 }; claw.contact = false; }
    const lucky = () => luck() >= PITY;
    // 現在被爪子撐在空中的娃娃
    const lifted = () => prizes.filter(p => Math.hypot(p.x - claw.x, p.z - claw.z) < .12 && p.y > p.r + .05 && p.y > claw.tip - .08 && p.y < claw.tip + .22);
    function watchHold(){
      const now = new Set(lifted());
      if(!holdSet.size && now.size && (state === "rise" || state === "top")){ msg("夾起來了！撐住…撐住… 😼", "good2"); SFX.select(); }
      if(holdSet.size && [...holdSet].some(p => !now.has(p))){ const where = state === "rise" ? "才剛拉起來就<b>掉了</b>…😿" : state === "top" ? "爪子在最上面<b>鬆了一下</b>，娃娃掉下去了 😹" : "啊！半路<b>滑掉了</b>…差一點點 😿";
        if(!now.size){ msg(where, "bad"); SFX.miss(); } }
      holdSet = now;
    }
    function step(dt){
      if(state === "aim"){
        tLeft -= dt; timerEl.textContent = Math.max(0, Math.ceil(tLeft)); timerEl.classList.toggle("low", tLeft < 6);
        claw.vx = dir.x*SPEED; claw.vz = dir.z*SPEED;
        claw.x = Math.max(.06, Math.min(.94, claw.x + claw.vx*dt)); claw.z = Math.max(.06, Math.min(.94, claw.z + claw.vz*dt));
        if(tLeft <= 0){ msg("時間到！自動下爪～"); startDrop(); }
      } else { claw.vx = claw.vz = 0; }
      // 爪腳慢慢張開／合起來
      claw.r += Math.max(-.26*dt, Math.min(.3*dt, claw.rT - claw.r));
      if(state === "drop"){
        if(claw.tip > .018 && !claw.contact) claw.tip = Math.max(.018, claw.tip - .5*dt);
        else { seq.t += dt; if(seq.t > .2){ state = "close"; seq.t = 0; seq.stall = false; claw.grip = false; claw.rT = lucky() ? CLOSED*.8 : CLOSED; SFX.key(1.2); } }
      } else if(state === "close"){ seq.t += dt; if(claw.grip && !seq.stall){ seq.stall = true; claw.rT = Math.max(CLOSED, claw.r - .01); }   // 夾到東西了：馬達停住（再多夾緊一點）
        if(seq.t > .6){ state = "rise"; seq.t = 0; holdSet = new Set(); } }
      else if(state === "rise"){ claw.tip = Math.min(YTOP, claw.tip + .36*dt); seq.t += dt; watchHold(); if(claw.tip >= YTOP){ state = "top"; seq.t = 0; seq.loose = false; } }
      else if(state === "top"){ seq.t += dt; claw.swing = Math.sin(seq.t*28)*3*(1 - seq.t/.6);
        // 真的娃娃機：到最上面爪子會鬆一點（越稀有的娃娃越鬆）
        if(seq.t > .15 && !lucky() && !seq.loose){ seq.loose = true; const rar = Math.max(0, ...lifted().map(p => PRIZES[p.kind][1])); claw.rT = claw.r + (Math.random() < .3 ? 0 : .003 + Math.random()*.009) + rar*.004; }
        watchHold(); if(seq.t > .6){ state = "back"; seq.t = 0; } }
      else if(state === "back"){ const dx = HOME.x - claw.x, dz = HOME.z - claw.z, d = Math.hypot(dx, dz);
        if(d < .004){ claw.x = HOME.x; claw.z = HOME.z; state = "release"; seq.t = 0; }
        else { const v = Math.min(d, .26*dt); claw.vx = dx/d*.26; claw.vz = dz/d*.26; claw.x += dx/d*v; claw.z += dz/d*v; }
        watchHold(); }
      else if(state === "release"){ if(seq.t === 0){ claw.rT = OPEN; SFX.key(.9); } seq.t += dt; if(seq.t > 1.8) finish(); }
      if(state !== "top") claw.swing += (Math.sin(performance.now()/240)*(holdSet.size ? 3 : 1) - claw.swing)*Math.min(1, dt*3);
    }
    async function finish(){
      state = "done";
      const won = captured.splice(0);
      if(won.length){ for(const k of won) await win(k); }
      else { msg(msgEl.classList.contains("bad") ? msgEl.innerHTML : "沒有夾到～再對準一點！", "bad");
        await ctx.update("claw", st => { st = st || {}; st.luck = st.luck || {}; st.luck[me()] = Math.min(PITY, (st.luck[me()] || 0) + 1); return st; }); }
      if(prizes.length < 15) spawn(15 - prizes.length);
      state = "idle"; claw.rT = OPEN; lastPlay = performance.now(); info();
      if(triesLeft() <= 0 && !won.length && !msgEl.classList.contains("bad")) msg("今天的免費次數用完了，可以用 1 個貓幣再玩一次 🪙");
    }
    async function win(kind){
      const P = PRIZES[kind], wasNew = !(myCol()[kind] > 0);
      await ctx.update("claw", st => { st = st || {}; st.col = st.col || {}; const c = st.col[me()] = st.col[me()] || {}; c[kind] = (c[kind] || 0) + 1; st.luck = st.luck || {}; st.luck[me()] = 0;
        st.last = { by: me(), kind, at: Date.now() }; return st; });
      SFX.level(); ctx.burst(); if(P[1] >= 1) SFX.combo();
      msg(`🎉 夾到了 <b>${esc(P[0])}</b>！`, "good");
      if(P[1] === 2 && partner()) ctx.notifyPartner(`${ctx.me.name} 在夾娃娃機夾到超稀有的「${P[0]}」！✨`);
      await new Promise(res => { const o = document.createElement("div"); o.className = "careModal cwReveal";
        o.innerHTML = `<div class="cmBox"><div class="cwRay r${P[1]}"></div><div class="cwBig">${art(kind)}</div>${wasNew ? `<div class="cwNew">NEW!</div>` : ""}
          <h3>${esc(P[0])}</h3><div class="cwRar" style="background:${RAR[P[1]][1]}">${"★".repeat(P[1] + 1)} ${RAR[P[1]][0]}</div>
          <div class="k">${wasNew ? "第一次夾到！已經收進收藏 🎁" : `收藏裡有 ${(myCol()[kind] || 1)} 個了`}</div><button class="btn" style="width:100%">好耶！</button></div>`;
        document.body.appendChild(o); o.querySelector("button").addEventListener("click", () => { o.remove(); res(); }); });
    }

    function openCol(){
      SFX.tap(); const c = myCol(), p = partner(), pc = p ? (((s && s.col) || {})[p.user_id] || {}) : null;
      const o = document.createElement("div"); o.className = "careModal cwColM";
      o.innerHTML = `<div class="cmBox"><h3>🎁 我的收藏 ${owned(c)}/${PRIZES.length}</h3>${p ? `<div class="k" style="text-align:center">${esc(p.name)} 收集了 ${owned(pc)}/${PRIZES.length}</div>` : ""}
        <div class="cwGrid">${PRIZES.map((P, i) => c[i] > 0 ? `<button class="cwSlot r${P[1]}" data-i="${i}">${art(i)}<b>${esc(P[0])}</b>${c[i] > 1 ? `<i>×${c[i]}</i>` : ""}</button>`
          : `<div class="cwSlot r${P[1]} no"><span class="cwArt">${P[2]()}</span><b>？？？</b></div>`).join("")}</div>
        <div class="k" style="text-align:center;margin:6px 0">${p ? "有重複的娃娃，點一下可以送 1 個給 ta 🎁" : "超稀有的娃娃很難夾，加油！"}</div><button class="btn sub" style="width:100%" id="cwX">關閉</button></div>`;
      document.body.appendChild(o);
      o.querySelector("#cwX").addEventListener("click", () => o.remove());
      o.querySelectorAll(".cwSlot[data-i]").forEach(b => b.addEventListener("click", async () => {
        const i = +b.dataset.i; if(!p) return; if(!(myCol()[i] > 1)){ ctx.toast("只有 1 個的捨不得送啦～有重複的才能送喔"); return; }
        if(!b.dataset.ok){ o.querySelectorAll(".cwSlot").forEach(x => { delete x.dataset.ok; x.classList.remove("ask"); }); b.dataset.ok = 1; b.classList.add("ask"); ctx.toast(`再點一次，把 1 個「${PRIZES[i][0]}」送給 ${esc(p.name)}`); return; }
        let ok = false;
        await ctx.update("claw", st => { const c2 = st && st.col && st.col[me()]; if(!c2 || !(c2[i] > 1)) return undefined; c2[i]--; const pc2 = st.col[p.user_id] = st.col[p.user_id] || {}; pc2[i] = (pc2[i] || 0) + 1; ok = true; return st; });
        if(ok){ SFX.select(); ctx.burst(); ctx.toast(`送出了 🎁 ${esc(p.name)} 收到 1 個「${PRIZES[i][0]}」`); ctx.notifyPartner(`${ctx.me.name} 送你 1 個「${PRIZES[i][0]}」娃娃 🎁 快去夾娃娃機的收藏看看！`); o.remove(); openCol(); }
      }));
    }

    // ---- 十字鍵：按住移動（只看手指放開，安卓長按不會中斷） ----
    const DIRS = { up: [0, 1], down: [0, -1], left: [-1, 0], right: [1, 0] };
    el.querySelectorAll(".cwPad [data-d]").forEach(btn => {
      const [dx, dz] = DIRS[btn.dataset.d];
      const up = () => { if(dir.x === dx && dir.z === dz) dir = { x: 0, z: 0 }; btn.classList.remove("on"); ["pointerup","touchend","mouseup"].forEach(t => window.removeEventListener(t, up)); };
      const down = e => { if(e.cancelable) e.preventDefault(); if(state !== "aim") { if(state === "idle") msg("先按「投幣」才能移動爪子喔 🪙"); return; } dir = { x: dx, z: dz }; btn.classList.add("on"); SFX.key(.8);
        ["pointerup","touchend","mouseup"].forEach(t => window.addEventListener(t, up)); };
      btn.addEventListener("pointerdown", down); btn.addEventListener("touchstart", down, { passive: false }); btn.addEventListener("contextmenu", e => e.preventDefault());
    });
    el.querySelector("#cwCol").addEventListener("click", openCol);

    let last = performance.now();
    const loop = now => {
      if(!alive) return; const dt = Math.min(.04, (now - last)/1000); last = now;
      const c0 = { x: claw.x, z: claw.z, tip: claw.tip, r: claw.r }; step(dt);
      const S = 4, lerp = (a, b, t) => a + (b - a)*t, at = t => ({ x: lerp(c0.x, claw.x, t), z: lerp(c0.z, claw.z, t), tip: lerp(c0.tip, claw.tip, t), r: lerp(c0.r, claw.r, t) });
      for(let i = 0; i < S; i++) physics(dt/S, at(i/S), at((i + 1)/S)); draw();
      // 玩完後幾秒內滾進出口的也算；沒在玩的時候自己滾進去的不算（放回機台裡）
      if(state === "idle" && captured.length){ if(performance.now() - lastPlay < 4000) finish(); else { const ks = captured.splice(0); ks.forEach(k => mk(k, .5 + Math.random()*.4, .9, .5 + Math.random()*.4)); } }
      raf = requestAnimationFrame(loop);
    };
    requestAnimationFrame(() => { try{ el.querySelector(".cw").scrollIntoView({ block: "start" }); }catch(e){} sizes(); spawn(16); for(let i = 0; i < 240; i++) physics(1/60); captured.forEach(k => mk(k, .6, .9, .6)); captured = []; for(let i = 0; i < 120; i++) physics(1/60); captured = []; draw(); info(); raf = requestAnimationFrame(loop); });
    const onR = () => { if(alive) sizes(); }; window.addEventListener("resize", onR);
    this._u = ctx.onState("claw", st => { s = st; if(alive) info(); });
    this._stop = () => { alive = false; window.removeEventListener("resize", onR); document.body.classList.remove("cwOn"); cancelAnimationFrame(raf); document.querySelectorAll(".cwReveal,.cwColM").forEach(x => x.remove()); };
    (async () => { const cur = await ctx.getState("claw").catch(() => null); s = cur ? cur.state : null; if(alive) info(); })();
    // 測試用
    if(window.__mock) window.__cw = { claw, prizes: () => prizes, state: () => state, HOME, lifted: () => lifted() };
  },
  unmount(){ if(this._u) this._u(); if(this._stop) this._stop(); },
});
if(window.GameArt) window.GameArt.claw = () => `<span class="gaL" style="left:30%;top:0;width:40%">${CLAW_SHUT}</span><span class="gaL" style="left:6%;bottom:0;width:40%">${Pix.sprite("orange","happy")}</span><span class="gaL" style="right:6%;bottom:0;width:38%">${Pix.sprite("calico","love")}</span>`;
})();

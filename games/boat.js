// 遊戲：喵喵划龍舟（兩個人各划一邊的槳，一起划才會直直往前衝）
// 主划手 = players()[0]（左槳），負責算船的位置；另一隻貓（右槳）把每一下划槳傳過去。
(function(){
const RW = 240, RH = 400, U = 16;          // low-res canvas, px per world unit
const COURSES = [
  { id:0, n:"櫻花河", desc:"河道寬寬的，適合練習", len:520, hw:4.6, rocks:.5, theme:"sakura" },
  { id:1, n:"螢火蟲夜河", desc:"晚上的河，有點彎彎的", len:680, hw:4.0, rocks:.8, theme:"night" },
  { id:2, n:"瀑布溪谷", desc:"石頭很多，要很有默契", len:820, hw:3.5, rocks:1.2, theme:"canyon" },
];
const THEME = {
  sakura: { bank:["#9ddb9a","#8fd18f"], water:["#7cc6f2","#8fd0f5"], ripple:"#d6efff", tree:["#f7b6c8","#ffe1ea","#e889a5"], sky:null },
  night:  { bank:["#3f6b55","#376049"], water:["#2f4f8a","#35589a"], ripple:"#6f8fd0", tree:["#2f5a44","#3f7a5a","#244a36"], sky:"night" },
  canyon: { bank:["#c9a46a","#b8935c"], water:["#5fb3d9","#6cbde0"], ripple:"#e0f4ff", tree:["#7fbf6a","#a8dc8f","#5a9a4f"], sky:null },
};
const O = "#5a3b2e";
function rng(seed){ let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
// the river: centre line wiggles, width depends on the course
function river(c, seed){
  const r = rng(seed * 7 + c.id * 101), p1 = r()*6, p2 = r()*6, amp1 = 2 + c.id*1.2, amp2 = 1.5 + c.id*.8;
  const cx = y => Math.sin(y*.021 + p1)*amp1 + Math.sin(y*.0063 + p2)*amp2;
  const hw = y => c.hw + Math.sin(y*.013 + p2)*.6 - (y > c.len - 40 ? 0 : 0);
  const rocks = [], fish = [], deco = [], logs = [];
  for(let y = 40; y < c.len - 30; y += 9 + r()*10/c.rocks){
    const w = hw(y), x = cx(y) + (r()*2 - 1)*(w - 1.2);
    if(r() < .82) rocks.push({ x, y, r: .55 + r()*.45 }); else logs.push({ x, y, w: 1.6 + r()*1.2 });
  }
  for(let y = 25; y < c.len - 10; y += 6 + r()*8){ const w = hw(y); const x = cx(y) + (r()*2 - 1)*(w - 1); const n = r() < .3 ? 3 : 1; for(let i=0;i<n;i++) fish.push({ id: fish.length, x, y: y + i*1.4, gold: r() < .08 }); }
  for(let y = -10; y < c.len + 40; y += 2.2 + r()*3){ deco.push({ y, side: r() < .5 ? -1 : 1, off: 1 + r()*3, k: r() < .6 ? "tree" : r() < .5 ? "flower" : "bush" }); }
  return { cx, hw, rocks, fish, logs, deco, len: c.len };
}
const svgImg = svg => { const im = new Image(); im.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg); return im; };

App.registerGame({
  id: "boat",
  name: "喵喵划龍舟",
  desc: "一人一邊槳，一起划才會直直衝",
  icon: () => Pix.sprite("orange","happy"),
  mount(el, ctx){
    const { sprite, esc, SFX } = ctx;
    let s = null, G = null, raf = 0, alive = true;
    const me = () => ctx.me.uid;
    const side = () => ctx.players()[0] === me() ? "L" : "R";
    const isHost = () => side() === "L";
    const partnerOn = () => { const p = ctx.partner(); return p && ctx.isOnline(p.user_id); };
    const fmt = t => `${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,"0")}.${String(Math.floor((t%1)*10))}`;

    function lobby(){
      if(G) stop();
      const best = (s && s.best) || {}, open = i => i===0 || best[i-1] != null;
      el.innerHTML = `<div class="box btLobby">
        <div class="btHero"><canvas id="btHero" width="200" height="90"></canvas></div>
        <p class="btIntro">兩隻貓坐上同一條龍舟！<b>${side()==="L" ? "你划左邊" : "你划右邊"}</b>，${esc(ctx.partner() ? ctx.partner().name : "ta")} 划另一邊。<br>只划一邊船會轉彎，<b>兩個人一起划</b>才會直直往前衝！</p>
        <div class="btHow"><span>點「划！」划一下槳</span><span>兩個人差不多同時划：同步加速</span><span>撞到石頭和河岸會變慢</span><span>撿小魚乾：每 2 條換 1 個貓幣</span></div>
        <div class="cpOn">${ctx.partner() ? (partnerOn() ? `🟢 ${esc(ctx.partner().name)} 在線上，可以出發！` : `⚪ ${esc(ctx.partner().name)} 不在線上，要兩個人一起划`) : "等 ta 加入小窩"}</div>
        <div class="btCourses">${COURSES.map((c,i)=>`<button data-c="${i}" ${open(i)?"":"disabled"} class="th-${c.theme}"><b>${esc(c.n)}</b><span>${esc(c.desc)}</span><i>${best[i]!=null ? `最快 ${fmt(best[i])}` : open(i) ? "▶ 出發" : "🔒 先划完上一條"}</i></button>`).join("")}</div></div>`;
      // little boat picture
      const hc = el.querySelector("#btHero"); if(hc){ const g = hc.getContext("2d"); g.imageSmoothingEnabled = false; g.fillStyle = "#8fd0f5"; g.fillRect(0, 50, 200, 40); g.fillStyle = "#d6efff"; for(let i=0;i<8;i++) g.fillRect(i*26 + 6, 60 + (i%2)*12, 12, 2);
        g.save(); g.translate(100, 56); g.rotate(-Math.PI/2); drawBoat(g, 0, 0, 1.4, ctx.players().map(id=>ctx.catOf(id)), 0, 0, 0); g.restore(); }
      el.querySelectorAll("[data-c]").forEach(b=>b.addEventListener("click", async ()=>{
        if(!partnerOn()){ ctx.toast(`要等 ${esc(ctx.partner() ? ctx.partner().name : "ta")} 也在線上才能一起划喔`); SFX.miss(); return; }
        SFX.select(); const c = +b.dataset.c;
        await ctx.update("boat", st=>{ st = st || {}; st.run = Date.now(); st.course = c; st.seed = (Math.random()*1e9)|0; st.live = true; return st; });
      }));
    }

    // ---------- the dragon boat (drawn pointing up, centre at 0,0) ----------
    const catImgs = {};
    const catImg = col => catImgs[col] || (catImgs[col] = svgImg(Pix.sprite(col || "orange","happy")));
    function drawBoat(g, x, y, sc, cols, oarL, oarR, bob){
      g.save(); g.translate(x, y); g.scale(sc, sc);
      // oars (behind the hull)
      const oar = (sx, ph) => { const sw = Math.sin(ph*Math.PI)*.9; g.save(); g.translate(sx*9, 2); g.rotate(sx*(.5 - sw)); g.fillStyle = O; g.fillRect(-1, -1, sx*16, 3); g.fillStyle = "#c98b4f"; g.fillRect(sx > 0 ? 0 : sx*16 + 1, 0, 15, 1); g.fillStyle = "#e9b872"; g.fillRect(sx > 0 ? 13 : -18, -3, 5, 7); g.restore(); };
      oar(-1, oarL); oar(1, oarR);
      // hull
      g.fillStyle = O; g.fillRect(-9, -26, 18, 52); g.fillRect(-7, -30, 14, 4); g.fillRect(-6, 26, 12, 4);
      g.fillStyle = "#e5486a"; g.fillRect(-8, -25, 16, 50); g.fillStyle = "#ffcf4a"; for(let i=-22;i<24;i+=6) g.fillRect(-8, i, 16, 2);
      g.fillStyle = "#f0708d"; g.fillRect(-6, -28, 12, 4);
      // dragon head + tail
      g.fillStyle = O; g.fillRect(-5, -40, 10, 12); g.fillStyle = "#5cb87a"; g.fillRect(-4, -39, 8, 10); g.fillStyle = "#ffffff"; g.fillRect(-3, -37, 2, 2); g.fillRect(1, -37, 2, 2); g.fillStyle = O; g.fillRect(-2, -36, 1, 1); g.fillRect(2, -36, 1, 1);
      g.fillStyle = "#ffcf4a"; g.fillRect(-6, -42, 3, 3); g.fillRect(3, -42, 3, 3); g.fillStyle = "#e5486a"; g.fillRect(-1, -31, 2, 3);
      g.fillStyle = O; g.fillRect(-3, 29, 6, 7); g.fillStyle = "#5cb87a"; g.fillRect(-2, 30, 4, 5);
      // the two cats, side by side
      [-1, 1].forEach((sx, i)=>{ const im = catImg(cols[i]); if(im.complete) g.drawImage(im, sx*5 - 7, -8 + (i ? Math.sin(bob + 1)*.6 : Math.sin(bob)*.6), 14, 14); });
      g.restore();
    }

    // ---------- a run ----------
    function start(){
      if(G) stop();
      const c = COURSES[s.course] || COURSES[0], th = THEME[c.theme];
      el.innerHTML = `<div class="box btPlay"><div class="btTop"><span id="btT">0:00.0</span><span id="btM">0 m</span><span id="btF">🐟 0</span><button class="btn sub" id="btOut">上岸</button></div>
        <div class="btStage"><canvas id="btC"></canvas><div class="btMsg hidden" id="btMsg"></div><div class="btSync" id="btSync"></div></div>
        <div class="btPad ${side()}"><button id="btRow" class="btRow">划！<small>${side()==="L"?"左槳":"右槳"}</small></button><div class="btPart" id="btPart">${esc(ctx.partner() ? ctx.partner().name : "ta")} 的槳</div></div></div>`;
      const cv = el.querySelector("#btC"), out = cv.getContext("2d");
      const lc = document.createElement("canvas"); lc.width = RW; lc.height = RH; const g = lc.getContext("2d"); g.imageSmoothingEnabled = false;
      const R = river(c, s.seed);
      G = { run: s.run, c, th, R, g, lc, cv, out, last: performance.now(), frame: 0, ended: false, cols: ctx.players().map(id=>ctx.catOf(id)),
            B: { x: R.cx(0), y: 0, a: 0, v: 0, t: 0, fish: 0, got: [], bump: 0, sync: 0, syncN: 0, lastL: -9, lastR: -9, oarL: 0, oarR: 0 }, sent: 0, petals: [], cooldown: 0, countdown: 3 };
      const size = () => { const r = cv.getBoundingClientRect(); cv.width = Math.max(1, Math.round(r.width)); cv.height = Math.max(1, Math.round(r.height)); out.imageSmoothingEnabled = false; };
      size(); G.size = size; window.addEventListener("resize", size);
      const row = el.querySelector("#btRow");
      row.addEventListener("pointerdown", e=>{ e.preventDefault(); row.classList.add("on"); stroke(); });
      ["pointerup","pointercancel","pointerleave"].forEach(ev=>row.addEventListener(ev, ()=>row.classList.remove("on")));
      row.addEventListener("contextmenu", e=>e.preventDefault());
      G.keyH = e => { if((e.key===" " || e.key==="ArrowUp") && !e.repeat){ e.preventDefault(); stroke(); } };
      window.addEventListener("keydown", G.keyH);
      el.querySelector("#btOut").addEventListener("click", ()=>{ SFX.tap(); ctx.update("boat", st=>{ if(!st) return undefined; st.live = false; return st; }); });
      raf = requestAnimationFrame(loop);
      if(window.__mock) window.__bt = { G:()=>G, stroke };   // tests only
    }
    function stop(){ cancelAnimationFrame(raf); if(G){ window.removeEventListener("keydown", G.keyH); window.removeEventListener("resize", G.size); } G = null; }

    // a stroke: local oar animation right away; the host applies it to the boat
    function stroke(){
      if(!G || G.ended || G.countdown > 0) return;
      const now = performance.now(); if(now - (G.myLast||0) < 220) return; G.myLast = now;
      SFX.splash ? SFX.splash() : SFX.tap(); if(navigator.vibrate) navigator.vibrate(15);
      if(side()==="L") G.B.oarL = 1; else G.B.oarR = 1;
      if(isHost()) applyStroke("L"); else ctx.broadcast({ g:"boat", k:"row", run:G.run });
    }
    function applyStroke(sd){
      const B = G.B, t = B.t;
      if(sd==="L"){ B.lastL = t; B.oarL = 1; } else { B.lastR = t; B.oarR = 1; }
      B.v = Math.min(9.5, B.v + 1.5);
      B.a += sd==="L" ? .13 : -.13;          // rowing on the left turns the boat to the right
      if(Math.abs(B.lastL - B.lastR) < .3 && t - Math.min(B.lastL, B.lastR) < .35){ B.v = Math.min(11, B.v + 1.3); B.a *= .55; B.sync = 1; B.syncN++; B.lastL = B.lastR = -9; }
    }
    function hostStep(dt){
      const B = G.B, R = G.R;
      if(G.countdown > 0) return;
      B.t += dt;
      B.v *= Math.exp(-.55*dt); B.a *= Math.exp(-.35*dt); B.a = Math.max(-.9, Math.min(.9, B.a));
      B.y += B.v*Math.cos(B.a)*dt; B.x += B.v*Math.sin(B.a)*dt;
      // banks
      const cx = R.cx(B.y), hw = R.hw(B.y), off = B.x - cx;
      if(Math.abs(off) > hw - .7){ B.x = cx + Math.sign(off)*(hw - .7); B.v *= .55; B.a = -B.a*.4 - Math.sign(off)*.1; B.bump = 1; }
      for(const k of R.rocks){ const d = Math.hypot(B.x - k.x, (B.y - k.y)*.8); if(d < k.r + .55){ const nx = (B.x - k.x)/(d||1); B.x = k.x + nx*(k.r + .56); B.v *= .45; B.bump = 1; B.a += nx*.15; } }
      for(const l of R.logs){ if(Math.abs(B.y - l.y) < .5 && Math.abs(B.x - l.x) < l.w/2 + .4){ B.y = l.y - .5; B.v *= .3; B.bump = 1; } }
      for(const f of R.fish){ if(!B.got.includes(f.id) && Math.hypot(B.x - f.x, B.y - f.y) < 1){ B.got.push(f.id); B.fish += f.gold ? 5 : 1; B.ding = 1; } }
      if(B.y >= R.len && !G.ended) finish();
    }
    async function finish(){
      if(!G || G.ended) return; G.ended = true;
      const B = G.B, t = Math.round(B.t*10)/10, ci = G.c.id, coins = Math.floor(B.fish/2);
      ctx.broadcast({ g:"boat", k:"end", run:G.run, t, fish:B.fish, sync:B.syncN });
      showEnd(t, B.fish, B.syncN);
      await ctx.update("boat", st=>{ st = st || {}; st.live = false; st.best = st.best || {}; st.last = { course:ci, t, fish:B.fish }; if(st.best[ci]==null || t < st.best[ci]) st.best[ci] = t; return st; });
      if(coins > 0) await ctx.update("pet", st=>{ if(!st || !window.PetLogic) return undefined; st = window.PetLogic.norm(JSON.parse(JSON.stringify(st)));
        st.coins = (st.coins||0) + coins; st.log = (st.log||[]).concat([{ by:me(), a:"boat", n:coins, at:Date.now() }]).slice(-24); return st; });
    }
    function showEnd(t, fish, sync){
      if(!G) return; G.ended = true; const m = el.querySelector("#btMsg"); if(!m) return; m.classList.remove("hidden");
      const best = s && s.best && s.best[G.c.id];
      m.innerHTML = `<b>🏁 抵達終點！</b><p class="btBig">${fmt(t)}</p><p>同步划了 ${sync} 次・撿到 🐟 ${fish}${Math.floor(fish/2) ? `<br>${Math.floor(fish/2)} 個貓幣送進養貓房間 🪙` : ""}</p>${best==null || t <= best ? "<p>🎉 新紀錄！</p>" : `<p>最快 ${fmt(best)}</p>`}
        <button class="btn" id="btAgain">再划一次</button><button class="btn sub" id="btHome">回大廳</button>`;
      SFX.match(); ctx.burst();
      el.querySelector("#btAgain").addEventListener("click", ()=>{ if(!partnerOn()){ ctx.toast("對方不在線上了"); return; } ctx.update("boat", st=>{ st = st || {}; st.run = Date.now(); st.seed = (Math.random()*1e9)|0; st.live = true; return st; }); });
      el.querySelector("#btHome").addEventListener("click", ()=>{ stop(); lobby(); });
    }

    // ---------- drawing ----------
    function draw(){
      const g = G.g, B = G.B, R = G.R, th = G.th; G.frame += 1/60;
      const camY = B.y + (RH*.32)/U, toS = (x, y) => [RW/2 + (x - B.x*.35 - R.cx(B.y)*.65)*U, RH - (y - (camY - RH/U))*U];
      // water + banks, row by row
      for(let sy=0; sy<RH; sy+=2){
        const y = (camY - RH/U) + (RH - sy)/U, cx = R.cx(y), hw = R.hw(y), [lx] = toS(cx - hw, y), [rx] = toS(cx + hw, y), band = Math.floor((y + 1000)/2)%2;
        g.fillStyle = th.bank[band]; g.fillRect(0, sy, RW, 2);
        g.fillStyle = th.water[Math.floor((y*1.3 + 1000))%2]; g.fillRect(Math.round(lx), sy, Math.round(rx - lx), 2);
        g.fillStyle = O; g.fillRect(Math.round(lx) - 2, sy, 2, 2); g.fillRect(Math.round(rx), sy, 2, 2);
        if(((Math.floor(y*3) * 7) % 13) === 0){ g.fillStyle = th.ripple; const w = 6 + (Math.floor(y*5)%5)*2; g.fillRect(Math.round(lx + ((Math.floor(y*11)%97)/97)*(rx - lx - w)), sy, w, 1); }
      }
      // finish line
      { const [, fy] = toS(0, R.len); if(fy > -10 && fy < RH){ for(let i=0;i<RW;i+=8){ g.fillStyle = ((i/8)|0)%2 ? "#ffffff" : "#2b1d18"; g.fillRect(i, fy, 8, 4); g.fillStyle = ((i/8)|0)%2 ? "#2b1d18" : "#ffffff"; g.fillRect(i, fy + 4, 8, 4); }
        g.font = "14px Cubic11, sans-serif"; g.textAlign = "center"; g.fillStyle = "#ffffff"; g.fillText("終點", RW/2, fy - 6); } }
      // bank decorations
      for(const d of R.deco){ const [px0, py0] = toS(R.cx(d.y) + d.side*(R.hw(d.y) + d.off), d.y); if(py0 < -40 || py0 > RH + 10) continue;
        g.save(); g.translate(Math.round(px0), Math.round(py0)); g.scale(1.6, 1.6); const sx = 0, sy = 0;
        if(d.k==="tree"){ g.fillStyle = O; g.fillRect(sx - 9, sy - 18, 18, 16); g.fillStyle = th.tree[0]; g.fillRect(sx - 8, sy - 17, 16, 14); g.fillStyle = th.tree[1]; g.fillRect(sx - 6, sy - 15, 6, 4); g.fillStyle = th.tree[2]; g.fillRect(sx + 2, sy - 8, 5, 4); g.fillStyle = "#8a5a3e"; g.fillRect(sx - 2, sy - 3, 4, 5); }
        else if(d.k==="bush"){ g.fillStyle = O; g.fillRect(sx - 6, sy - 6, 12, 7); g.fillStyle = th.tree[2]; g.fillRect(sx - 5, sy - 5, 10, 5); }
        else { g.fillStyle = ["#f0708d","#ffd36b","#cdb4f0"][Math.floor(d.y)%3]; g.fillRect(sx - 2, sy - 4, 4, 4); g.fillStyle = "#fff"; g.fillRect(sx - 1, sy - 3, 2, 2); }
        g.restore(); }
      // rocks, logs, fish
      for(const k of R.rocks){ const [sx, sy] = toS(k.x, k.y); if(sy < -20 || sy > RH + 20) continue; const r = k.r*U;
        g.fillStyle = "rgba(255,255,255,.35)"; g.fillRect(sx - r - 3, sy + r*.4, r*2 + 6, 3);
        g.fillStyle = O; g.fillRect(sx - r, sy - r*.8, r*2, r*1.6); g.fillStyle = "#9aa1ab"; g.fillRect(sx - r + 2, sy - r*.8 + 2, r*2 - 4, r*1.6 - 4); g.fillStyle = "#c9ced6"; g.fillRect(sx - r + 3, sy - r*.8 + 3, r*.8, r*.5); }
      for(const l of R.logs){ const [sx, sy] = toS(l.x, l.y); if(sy < -20 || sy > RH + 20) continue; const w = l.w*U;
        g.fillStyle = O; g.fillRect(sx - w/2, sy - 5, w, 10); g.fillStyle = "#a0703c"; g.fillRect(sx - w/2 + 2, sy - 3, w - 4, 6); g.fillStyle = "#c98b4f"; g.fillRect(sx - w/2 + 2, sy - 3, w - 4, 2); g.fillStyle = "#e9b872"; g.fillRect(sx + w/2 - 6, sy - 3, 4, 6); }
      for(const f of R.fish){ if(B.got.includes(f.id)) continue; const [sx, sy] = toS(f.x, f.y); if(sy < -10 || sy > RH + 10) continue; const bob = Math.sin(G.frame*4 + f.id)*1.5;
        g.fillStyle = O; g.fillRect(sx - 6, sy - 3 + bob, 10, 7); g.fillRect(sx + 3, sy - 4 + bob, 4, 9); g.fillStyle = f.gold ? "#ffcf4a" : "#f2a65a"; g.fillRect(sx - 5, sy - 2 + bob, 8, 5); g.fillRect(sx + 4, sy - 3 + bob, 2, 7); g.fillStyle = "#2b1d18"; g.fillRect(sx - 4, sy - 1 + bob, 1, 1); }
      // the boat
      const [bx, by] = toS(B.x, B.y);
      g.fillStyle = "rgba(255,255,255,.5)"; for(let i=1;i<5;i++) g.fillRect(bx - 9 - i*3 + Math.sin(G.frame*8 + i)*1, by + 44 + i*8, 18 + i*6, 2);
      g.save(); g.translate(bx, by); g.rotate(B.a); drawBoat(g, 0, 0, 1.5, G.cols, B.oarL, B.oarR, G.frame*6); g.restore();
      // night fireflies / sakura petals
      if(G.c.theme==="night"){ for(let i=0;i<14;i++){ const x = (i*53 + Math.sin(G.frame + i)*20) % RW, y = (i*97 + G.frame*8) % RH; g.fillStyle = (Math.floor(G.frame*3 + i)%3) ? "rgba(255,240,140,.85)" : "rgba(255,240,140,.3)"; g.fillRect(Math.round(x), Math.round(y), 2, 2); } }
      if(G.c.theme==="sakura"){ for(let i=0;i<12;i++){ const x = ((i*61 + G.frame*12 + Math.sin(G.frame*2 + i)*10) % RW + RW) % RW, y = (i*89 + G.frame*20) % RH; g.fillStyle = "#ffd0dc"; g.fillRect(Math.round(x), Math.round(y), 3, 2); } }
      if(B.bump > .5){ g.fillStyle = `rgba(255,255,255,${(B.bump-.5)})`; g.fillRect(0, 0, RW, RH); }
      if(G.countdown > 0){ g.font = "48px Cubic11, sans-serif"; g.textAlign = "center"; g.fillStyle = "#ffffff"; g.fillText(Math.ceil(G.countdown), RW/2 + 2, RH*.4 + 2); g.fillStyle = "#e5486a"; g.fillText(Math.ceil(G.countdown), RW/2, RH*.4); }
      // blit
      const W = G.cv.width, H = G.cv.height, sc = Math.max(W/RW, H/RH);
      G.out.imageSmoothingEnabled = false; G.out.drawImage(G.lc, Math.round((W - RW*sc)/2), Math.round((H - RH*sc)/2), Math.round(RW*sc), Math.round(RH*sc));
    }
    function hud(){
      const B = G.B;
      el.querySelector("#btT").textContent = fmt(B.t); el.querySelector("#btM").textContent = `${Math.max(0, Math.floor(G.R.len - B.y))} m`; el.querySelector("#btF").textContent = `🐟 ${B.fish}`;
      const sy = el.querySelector("#btSync"); if(B.sync > .6){ sy.textContent = "同步！加速～"; sy.classList.add("on"); } else sy.classList.remove("on");
      const part = el.querySelector("#btPart"); if(part) part.classList.toggle("on", (side()==="L" ? B.oarR : B.oarL) > .5);
    }
    function loop(t){
      if(!alive || !G) return;
      const dt = Math.min(.05, (t - G.last)/1000 || 0); G.last = t;
      if(G.countdown > 0){ const before = Math.ceil(G.countdown); G.countdown -= dt; if(Math.ceil(G.countdown) !== before) G.countdown > 0 ? SFX.beep(false) : SFX.beep(true); }
      const B = G.B;
      B.oarL = Math.max(0, B.oarL - dt*2.6); B.oarR = Math.max(0, B.oarR - dt*2.6); B.sync = Math.max(0, B.sync - dt*1.2); B.bump = Math.max(0, B.bump - dt*3);
      if(isHost()){ if(!G.ended) hostStep(dt); if(B.ding){ B.ding = 0; SFX.coin(); }
        if(t - G.sent > 66){ G.sent = t; ctx.broadcast({ g:"boat", k:"s", run:G.run, x:+B.x.toFixed(3), y:+B.y.toFixed(3), a:+B.a.toFixed(3), v:+B.v.toFixed(2), tt:+B.t.toFixed(2), fish:B.fish, got:B.got.slice(-6), n:B.got.length, sync:B.sync > .8 ? 1 : 0, bump:B.bump > .8 ? 1 : 0, oL:B.oarL > .8 ? 1 : 0, cd:G.countdown }); } }
      else if(!G.ended && G.tgt){ // smooth towards the host's boat, and keep moving with its speed in between
        const k = Math.min(1, dt*10), T2 = G.tgt; B.v = T2.v; B.x += (T2.x - B.x)*k + B.v*Math.sin(B.a)*dt*.5; B.y += (T2.y - B.y)*k + B.v*Math.cos(B.a)*dt*.5; B.a += (T2.a - B.a)*k; B.t = Math.max(B.t + dt*(G.countdown > 0 ? 0 : 1), T2.tt); }
      try{ draw(); hud(); }catch(e){}
      raf = requestAnimationFrame(loop);
    }

    // ---------- network ----------
    const offBc = ctx.onBroadcast(p=>{
      if(!p || p.g!=="boat" || !G || p.run!==G.run) return;
      if(p.k==="row" && isHost() && !G.ended && G.countdown <= 0){ applyStroke("R"); }
      if(p.k==="s" && !isHost()){ G.tgt = p; const B = G.B; B.fish = p.fish; p.got.forEach(id=>{ if(!B.got.includes(id)){ B.got.push(id); SFX.coin(); } }); if(p.sync) B.sync = 1; if(p.bump) B.bump = 1; if(p.oL) B.oarL = 1; G.countdown = Math.min(G.countdown, p.cd); }
      if(p.k==="end" && !isHost()){ G.ended = true; showEnd(p.t, p.fish, p.sync); }
    });
    this._u = ctx.onState("boat", st=>{
      s = st;
      if(st && st.live && (!G || G.run !== st.run)){ start(); return; }
      if(st && !st.live && G && !G.ended){ stop(); lobby(); return; }
      if(!G) lobby();
    });
    this._p = ctx.onPresence(()=>{ if(!G) lobby(); });
    this._b = offBc;
    this._stop = () => { alive = false; stop(); };
    (async()=>{ const cur = await ctx.getState("boat").catch(()=>null); s = cur ? cur.state : null; lobby(); })();
  },
  unmount(){ if(this._u) this._u(); if(this._p) this._p(); if(this._b) this._b(); if(this._stop) this._stop(); },
});
})();

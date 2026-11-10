// 遊戲：疊貓貓
// 你的貓站在塔頂，睡成吐司形的貓咪會從左邊或右邊滑過來。
// 點一下跳起來，剛好落在牠身上就疊高一層；落在正中間是「完美」，分數加倍還會翻跟斗。
// 跳太早、太晚被撞到就掉下去了。看你們誰疊得比較高！
(function(){
const LOAF = [
"...............O....O..",
"..............OPO..OPO.",
"..............OPPOOPPO.",
"....OOOOOOOOOOYYYYYYYYO",
"...OYYSYYSYYSYYYYYYYYYYO",
"..OYYYSYYSYYSYYYEHYYEHYO",
"..OYYYYYYYYYYYYYEEYYEEYO",
".OYYYYYYYYYYYYYBBYNNYBBO",
".OYYYYYYYYYYYYYYYYMMYYYO",
"OYYYYYYYYYYYYYYYYYYYYYO.",
"OSYYYYYYYYYYYYYYWWWWWYO.",
"OSSYYYYYYYYYYYYWWOWWOWO.",
".OOOOOOOOOOOOOOOO.OO.O..",
];
// sleeping version for the stack (eyes closed)
const LOAF_Z = LOAF.map((r, y) => y === 5 ? r.replace("EHYYEH", "YYYYYY") : y === 6 ? r.replace("EEYYEE", "EEYYEE") : r);
const S = 2;                       // loaf drawn at 2× its pixel size
const LW = 24 * S, LH = 10 * S;    // loaf width / body height (ears stick out above)
const EARS = 3 * S;
const PW = 15, PH = 26;            // player hit box width, sprite size
const COLORS = ["orange","white","calico","black","gray"];
const loafCache = {};
function loafCv(c, flip, sleep){
  const key = c + (flip ? "f" : "") + (sleep ? "z" : ""); if(loafCache[key]) return loafCache[key];
  const pal = Pix.palOf(c), rows = sleep ? LOAF_Z : LOAF;
  const cv = document.createElement("canvas"); cv.width = 24; cv.height = 13; const g = cv.getContext("2d");
  rows.forEach((row, y) => [...row].forEach((ch, x) => { const col = pal[ch]; if(!col || ch === ".") return; g.fillStyle = col; g.fillRect(flip ? 23 - x : x, y, 1, 1); }));
  if(sleep){ g.fillStyle = pal.E; [[16,6],[17,6],[20,6],[21,6]].forEach(([x,y]) => g.fillRect(flip ? 23 - x : x, y, 1, 1)); }
  return loafCache[key] = cv;
}
const svgImg = svg => { const im = new Image(); im.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg); return im; };
const SKY = [   // [floor, top colour, bottom colour]
  [0,  "#9fd8ff", "#e6f6ff"],
  [25, "#ffc4dd", "#fff0d6"],
  [50, "#f7a98a", "#ffd9c9"],
  [80, "#8d78c9", "#f0b6d0"],
  [120,"#2b2756", "#5d4b8e"],
  [170,"#0f0c24", "#2b2756"],
];
const mix = (a, b, t) => { const p = h => [1,3,5].map(i => parseInt(h.slice(i, i+2), 16)); const A = p(a), B = p(b); return "#" + A.map((v, i) => Math.round(v + (B[i]-v)*t).toString(16).padStart(2, "0")).join(""); };
function skyAt(f){ for(let i=SKY.length-1;i>=0;i--) if(f >= SKY[i][0]){ const n = SKY[i+1]; if(!n) return [SKY[i][1], SKY[i][2]]; const t = (f - SKY[i][0]) / (n[0] - SKY[i][0]); return [mix(SKY[i][1], n[1], t), mix(SKY[i][2], n[2], t)]; } return [SKY[0][1], SKY[0][2]]; }

function play(opts){
  return new Promise(resolve => {
    const SFX = opts.sfx || {}; const snd = (k, ...a) => { try{ SFX[k] && SFX[k](...a); }catch(e){} };
    const ov = document.createElement("div"); ov.className = "skGame";
    ov.innerHTML = `<div class="skHud"><button class="skQuit" id="skQuit">🏳️ 退出</button><div class="skSc"><b id="skSc">0</b><span id="skFl">0 層</span></div><div class="skStreak" id="skSt"></div></div>
      <canvas id="skCv"></canvas><div class="skPop" id="skPop"></div><div class="skTap" id="skTap">點一下跳起來 🐾</div><div class="skEnd hidden" id="skEnd"></div>`;
    document.body.appendChild(ov);
    const $ = s => ov.querySelector(s);
    const cv = $("#skCv"), g = cv.getContext("2d");
    const me = svgImg(Pix.sprite(opts.cat || "orange", "happy")), meOw = svgImg(Pix.sprite(opts.cat || "orange", "cry")), meWow = svgImg(Pix.sprite(opts.cat || "orange", "love"));
    const VW = 150; let VH = 260, k = 2, dpr = 1;
    function size(){ dpr = Math.min(2, window.devicePixelRatio || 1); const r = cv.getBoundingClientRect(); cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); k = cv.width / VW; VH = cv.height / k; }
    // ---- game state ----
    const stack = [{ x: 0, c: opts.cat === "orange" ? "white" : "orange", flip: false }];   // floor 0 = the first cat on the ground
    let score = 0, perfects = 0, streak = 0, over = false, done = false, started = false;
    const P = { y: LH, vy: 0, air: false, rot: 0, spin: 0, x: 0, vx: 0, face: "happy", fall: false };
    let mover = null, wait = 0.5, camY = 0, t = 0, parts = [], ring = null, last = performance.now(), raf = 0;
    const topH = () => stack.length * LH;
    const clouds = Array.from({ length: 9 }, (_, i) => ({ x: Math.random() * 190 - 20, y: 40 + i * 70 + Math.random() * 40, w: 18 + Math.random() * 22, sp: 3 + Math.random() * 5 }));
    const stars = Array.from({ length: 70 }, () => ({ x: Math.random() * VW, y: Math.random() * 400, s: Math.random() < .2 ? 2 : 1, tw: Math.random() * 6 }));
    function spawn(){
      const n = stack.length, side = Math.random() < .5 ? -1 : 1;
      let sp = 82 + Math.min(110, n * 2.1);
      sp *= .82 + Math.random() * .36;
      if(n > 12 && Math.random() < .14) sp *= 1.45;       // a sudden fast one
      const c = COLORS[(Math.random() * COLORS.length) | 0];
      mover = { x: side * (VW / 2 + LW / 2 - 4), dir: -side, sp, c, flip: side > 0 };
    }
    function jump(){
      if(over) return;
      if(!started){ started = true; $("#skTap").classList.add("hide"); }
      if(P.air) return;
      P.air = true; P.vy = 205; snd("tap");
      P.spin = streak >= 2 ? (Math.random() < .5 ? -1 : 1) : 0; P.rot = 0;
    }
    function pop(t, cls){ const p = $("#skPop"); p.textContent = t; p.className = "skPop"; void p.offsetWidth; p.className = "skPop on " + (cls || ""); }
    function puff(x, y, cols, n, sp, up){ for(let i=0;i<n;i++){ const a = up ? -Math.PI/2 + (Math.random()-.5)*2.6 : Math.random()*Math.PI*2, v = sp * (.4 + Math.random()*.8);
      parts.push({ x, y, vx: Math.cos(a) * v, vy: -Math.sin(a) * v, t: 0, max: .45 + Math.random() * .4, c: cols[(Math.random()*cols.length)|0], s: 1.5 + Math.random()*2, h: Math.random() < .2 }); } }
    function land(){
      const off = P.x - mover.x, perfect = Math.abs(off) < 4 + mover.sp * .015;
      stack.push({ x: mover.x, c: mover.c, flip: mover.flip }); mover = null;
      P.air = false; P.vy = 0; P.y = topH(); P.rot = 0; P.spin = 0;
      if(perfect){ streak++; perfects++; score += 2; snd("combo", Math.min(5, streak)); ring = { t: 0, y: P.y };
        pop(streak >= 3 ? `完美 ×${streak}！` : "完美！", "skPf"); puff(P.x, P.y, ["#ffe08a","#ffffff","#f7a7c0"], 14, 70, true); }
      else { streak = 0; score += 1; snd("place"); puff(P.x + (off > 0 ? -6 : 6), P.y, ["#ffffff","#f3e6d6"], 6, 30, true); }
      if(stack.length % 25 === 1 && stack.length > 1) setTimeout(() => pop(`${stack.length - 1} 層了！好高 ✨`, "skLv"), 500);
      wait = .1 + Math.random() * .3; hud();
    }
    function hit(){
      if(over) return; over = true; snd("miss"); streak = 0;
      P.fall = true; P.air = true; P.vx = mover.dir * 70; P.vy = 150; P.spin = mover.dir; P.face = "cry";
      puff(P.x, P.y + PH/2, ["#ffe08a","#ffffff"], 10, 60);
      pop("被撞到了～", "skHit");
      setTimeout(finish, 1300);
    }
    function hud(){ $("#skSc").textContent = score; $("#skFl").textContent = `${stack.length - 1} 層`; const s = $("#skSt"); s.textContent = streak >= 2 ? `完美連續 ×${streak}` : ""; }
    function update(dt){
      t += dt;
      for(const c of clouds){ c.x += c.sp * dt; if(c.x > VW + 30) c.x = -40; }
      parts = parts.filter(p => (p.t += dt) < p.max); for(const p of parts){ p.vy -= 120 * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
      if(ring){ ring.t += dt; if(ring.t > .5) ring = null; }
      // camera follows the top of the tower
      const target = Math.max(0, topH() - VH * .42);
      camY += (target - camY) * Math.min(1, dt * 5);
      if(!started) return;
      // player physics
      if(P.air){
        const prev = P.y; P.vy -= 560 * dt; P.y += P.vy * dt; P.x += P.vx * dt;
        if(P.spin) P.rot += P.spin * dt * 13;
        if(!P.fall){
          if(mover && P.vy < 0){ const mt = topH() + LH;
            if(prev >= mt && P.y <= mt && Math.abs(P.x - mover.x) < LW/2 + 2) land(); }
          if(P.air && P.y <= topH()){ P.y = topH(); P.air = false; P.vy = 0; P.rot = 0; P.spin = 0; }
        }
      }
      if(over) return;
      // the sliding cat
      if(!mover){ wait -= dt; if(wait <= 0) spawn(); }
      else {
        mover.x += mover.dir * mover.sp * dt;
        const overlapX = Math.abs(mover.x - P.x) < LW/2 + PW/2 - 2;
        if(overlapX && P.y < topH() + LH - 3) return hit();
        if(Math.abs(mover.x) > VW/2 + LW/2 + 6 && Math.sign(mover.x) === mover.dir){ mover = null; wait = .2; }   // it slid right past
      }
    }
    // ---- drawing ----
    const sy = y => VH * .78 - (y - camY);          // world height → screen y (in view units)
    function draw(){
      g.setTransform(1, 0, 0, 1, 0, 0); g.imageSmoothingEnabled = false;
      const [top, bot] = skyAt(stack.length - 1);
      const gr = g.createLinearGradient(0, 0, 0, cv.height); gr.addColorStop(0, top); gr.addColorStop(1, bot); g.fillStyle = gr; g.fillRect(0, 0, cv.width, cv.height);
      g.setTransform(k, 0, 0, k, 0, 0);
      // stars at night
      const night = Math.max(0, Math.min(1, (stack.length - 90) / 40));
      if(night > 0) for(const s of stars){ const y = ((s.y + camY * .15) % (VH + 20)) - 10; g.globalAlpha = night * (.5 + .5 * Math.sin(t * 2 + s.tw)); g.fillStyle = "#fff8d6"; g.fillRect(s.x, VH - y, s.s, s.s); }
      g.globalAlpha = 1;
      // clouds (parallax)
      g.fillStyle = night > .5 ? "rgba(255,255,255,.25)" : "rgba(255,255,255,.85)";
      for(const c of clouds){ const y = sy(c.y * 1.0 + camY * .55) ; const yy = ((y % (VH + 60)) + VH + 60) % (VH + 60) - 30; const w = c.w; g.fillRect(c.x, yy, w, 5); g.fillRect(c.x + 4, yy - 3, w - 10, 3); g.fillRect(c.x + w*.4, yy - 6, w*.35, 3); }
      // ground
      const gy = sy(0);
      if(gy < VH + 10){ g.fillStyle = "#9ed98a"; g.fillRect(0, gy, VW, VH - gy + 2); g.fillStyle = "#7cc46a"; for(let x=0;x<VW;x+=8) g.fillRect(x + ((x/8)%2)*3, gy, 3, 2); g.fillStyle = "#c98b4f"; g.fillRect(0, gy + 8, VW, VH); g.fillStyle = "#b37740"; for(let x=0;x<VW;x+=12) g.fillRect(x, gy + 14, 6, 2); }
      // partner / own best markers
      const mark = (fl, name, col, side) => { if(!fl) return; const y = sy(fl * LH + LH); if(y < -10 || y > VH + 10) return;
        g.fillStyle = col; g.globalAlpha = .55; for(let x = 0; x < VW; x += 6) g.fillRect(x, y, 3, 1); g.globalAlpha = 1;
        g.font = "7px Cubic11, monospace"; g.textAlign = side < 0 ? "left" : "right"; g.fillStyle = col; g.fillText(name, side < 0 ? 3 : VW - 3, y - 2); };
      mark(opts.foeBest, `${opts.foe || "ta"} ${opts.foeBest} 層`, "#e5486a", -1);
      mark(opts.myBest, `我的紀錄 ${opts.myBest} 層`, "#3f8fd0", 1);
      // the tower
      const cx = VW / 2;
      for(let i=0;i<stack.length;i++){ const s = stack[i], y = sy((i + 1) * LH); if(y - EARS > VH + 4 || y + LH < -30) continue;
        g.drawImage(loafCv(s.c, s.flip, true), cx + s.x - LW/2, y - EARS, LW, 13 * S); }
      // the sliding cat
      if(mover){ const y = sy(topH() + LH); g.drawImage(loafCv(mover.c, mover.flip, false), cx + mover.x - LW/2, y - EARS, LW, 13 * S); }
      // perfect ring
      if(ring){ const a = 1 - ring.t / .5, r = 8 + ring.t * 60; g.strokeStyle = `rgba(255,224,138,${a})`; g.lineWidth = 2; g.beginPath(); g.ellipse(cx + P.x, sy(ring.y), r, r * .35, 0, 0, 7); g.stroke(); }
      // the player cat
      const img = P.face === "cry" ? meOw : streak >= 2 && P.air ? meWow : me;
      if(img.complete){ g.save(); g.translate(cx + P.x, sy(P.y) - PH/2 + 2); g.rotate(P.rot); g.drawImage(img, -PH/2, -PH/2, PH, PH); g.restore(); }
      // particles
      for(const p of parts){ g.globalAlpha = Math.min(1, (1 - p.t/p.max) * 1.5); g.fillStyle = p.c; const x = cx + p.x, y = sy(p.y);
        if(p.h){ [[1,0],[3,0],[0,1],[1,1],[2,1],[3,1],[4,1],[1,2],[2,2],[3,2],[2,3]].forEach(([a,b]) => g.fillRect(x + (a-2)*.8, y + (b-1.5)*.8, .9, .9)); } else g.fillRect(x - p.s/2, y - p.s/2, p.s, p.s); }
      g.globalAlpha = 1;
    }
    function loop(now){ if(done) return; let dt = Math.max(0, (now - last) / 1000); last = now; if(dt > .05) dt = .05; update(dt); try{ draw(); }catch(e){} raf = requestAnimationFrame(loop); }
    function finish(){
      if(done || $("#skEnd").classList.contains("hidden") === false) return;
      const floors = stack.length - 1;
      const coins = Math.min(40, Math.floor(floors / 5) + Math.floor(perfects / 4));
      const rec = score > (opts.best || 0) && score > 0;
      const r = { score, floors, perfects, coins, rec };
      const E = $("#skEnd"); E.classList.remove("hidden");
      E.innerHTML = `<div class="skCard"><div class="skCardCats">${["orange","calico","gray"].map(c=>`<span>${Pix.sprite(c, "loaf")}</span>`).join("")}</div>
        <h3>${rec ? "🎉 新紀錄！" : "掉下去了～"}</h3><p class="skBig">${score} 分</p>
        <p>疊了 <b>${floors}</b> 層・完美 <b>${perfects}</b> 次${!rec && opts.best ? `<br>最高紀錄 ${opts.best} 分` : ""}${coins && opts.hasPet ? `<br>${coins} 個貓幣送進養貓房間了 🪙` : ""}</p>
        <div class="skBtns"><button class="btn sub" id="skBack">回去</button><button class="btn" id="skAgain">再玩一次</button></div></div>`;
      if(rec) snd("level");
      Promise.resolve(opts.onEnd && opts.onEnd(r)).catch(()=>{});
      $("#skBack").addEventListener("click", () => close(false));
      $("#skAgain").addEventListener("click", () => close(true));
    }
    let quitArm = 0;
    $("#skQuit").addEventListener("click", e => { e.stopPropagation(); if(over) return; const n = Date.now(); if(n - quitArm < 2500){ snd("tap"); close(false); return; } quitArm = n; const q = $("#skQuit"); q.textContent = "再按一次退出"; setTimeout(() => { if(q.isConnected) q.textContent = "🏳️ 退出"; }, 2500); });
    cv.addEventListener("pointerdown", e => { e.preventDefault(); jump(); });
    $("#skTap").addEventListener("pointerdown", e => { e.preventDefault(); jump(); });
    const onKey = e => { if(e.key === " " || e.key === "ArrowUp"){ e.preventDefault(); if(!e.repeat) jump(); } };
    document.addEventListener("keydown", onKey);
    function close(again){ if(done) return; done = true; cancelAnimationFrame(raf); window.removeEventListener("resize", size); document.removeEventListener("keydown", onKey); ov.remove(); resolve(again ? "again" : "back"); }
    ov.__close = () => close(false);
    window.addEventListener("resize", size);
    if(window.__mock) window.__sk = { P, stack, mover: () => mover, jump, start(){ started = true; }, score: () => score, setMover(m){ mover = m; }, topH, LH, LW, over: () => over, update, perfects: () => perfects };
    hud();
    requestAnimationFrame(() => { size(); last = performance.now(); raf = requestAnimationFrame(loop); });
  });
}

window.CatStack = { play };
if(window.GameArt) window.GameArt.catstack = () => `<span class="gaL skArt" style="left:4%;bottom:0;width:92%;height:100%">
  <i style="bottom:-14%;left:16%">${Pix.sprite("orange","loaf")}</i><i style="bottom:5%;left:8%">${Pix.sprite("gray","loaf")}</i><i style="bottom:24%;left:20%">${Pix.sprite("calico","loaf")}</i>
  <b style="bottom:56%;left:36%">${Pix.sprite("white","happy")}</b></span>`;

App.registerGame({
  id: "catstack",
  solo: true,
  name: "疊貓貓",
  desc: "跳上滑過來的貓咪，越疊越高",
  icon: () => Pix.sprite("orange","loaf"),
  mount(el, ctx){
    const { esc, SFX } = ctx;
    let s = null;
    const me = () => ctx.me.uid;
    function lobby(){
      const p = ctx.partner(), best = (s && s.best) || {}, fl = (s && s.floors) || {};
      const row = (name, uid) => `<div><b>${esc(name)}</b><span>${best[uid]||0} 分</span><em>${fl[uid] ? `最高 ${fl[uid]} 層` : "還沒玩過"}</em></div>`;
      el.innerHTML = `<div class="box skLobby">
        <div class="skHero">${["calico","gray","white"].map((c,i)=>`<i style="left:${[34,24,38][i]}%;bottom:${11 + i*22}px">${Pix.sprite(c,"loaf")}</i>`).join("")}<b>${Pix.sprite(ctx.me.cat || "orange","happy")}</b></div>
        <p class="skIntro">睡成吐司的貓咪會從旁邊<b>滑過來</b>！<br>點一下<b>跳起來</b>，落在牠身上就疊高一層 🐾<br>剛好落在<b>正中間</b>是「完美」，分數加倍還會翻跟斗！</p>
        <div class="skHow"><span>點畫面任何地方都能跳</span><span>被撞到就輸了</span><span>越高滑得越快</span></div>
        <div class="tsBest">${row(ctx.me.name, me())}${p ? row(p.name, p.user_id) : ""}</div>
        <button class="btn" id="skGo">🐱 開始疊！</button>
        <div class="k" style="text-align:center">每疊 5 層得 1 個貓幣，完美 4 次再多 1 個 🪙</div></div>`;
      el.querySelector("#skGo").addEventListener("click", go);
    }
    async function go(){
      if(document.querySelector(".skGame")) return;
      SFX.tap();
      let again = true;
      while(again){
        const p = ctx.partner(), fl = (s && s.floors) || {};
        const opts = { sfx: SFX, cat: ctx.me.cat || "orange", best: (s && s.best && s.best[me()]) || 0, myBest: fl[me()] || 0, foeBest: p ? fl[p.user_id] || 0 : 0, foe: p ? p.name : "", hasPet: true };
        ctx.getState("pet").then(pet => { opts.hasPet = !!(pet && pet.state); }).catch(()=>{});
        const r = await play(Object.assign(opts, { onEnd: async r => {
          await ctx.update("catstack", st => { st = st || {}; st.best = st.best || {}; st.floors = st.floors || {}; st.plays = st.plays || {};
            st.plays[me()] = (st.plays[me()]||0) + 1; if(r.score > (st.best[me()]||0)) st.best[me()] = r.score; if(r.floors > (st.floors[me()]||0)) st.floors[me()] = r.floors;
            st.last = { by: me(), score: r.score, floors: r.floors, at: Date.now() }; return st; });
          const pb = opts.foeBest;
          if(r.rec) ctx.notifyPartner(`${ctx.me.name} 在「疊貓貓」疊了 ${r.floors} 層，拿到新紀錄 ${r.score} 分！${pb && r.floors > pb ? "比你還高喔 😼" : ""}`);
          if(r.coins > 0) await ctx.update("pet", st => { if(!st || !window.PetLogic) return undefined; st = window.PetLogic.norm(JSON.parse(JSON.stringify(st)));
            st.coins = (st.coins||0) + r.coins; st.log = (st.log||[]).concat([{ by: me(), a: "catstack", n: r.coins, at: Date.now() }]).slice(-24); return st; });
        } }));
        again = r === "again";
      }
      lobby();
    }
    this._u = ctx.onState("catstack", st => { s = st; if(!document.querySelector(".skGame")) lobby(); });
    (async()=>{ const cur = await ctx.getState("catstack").catch(()=>null); s = cur ? cur.state : null; lobby(); })();
  },
  unmount(){ if(this._u) this._u(); const g = document.querySelector(".skGame"); if(g && g.__close) g.__close(); },
});
})();

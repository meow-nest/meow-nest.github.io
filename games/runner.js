// 遊戲：跳跳貓每日挑戰（橫向跑酷；每天兩個人的關卡一模一樣，比誰跑得遠）
(function(){
let W = 360; const H = 200, GROUND = 34, GRAV = 1700, JUMP = 560, JUMP2 = 470;
function rng(seed){ let s = seed>>>0 || 1; return ()=> (s = (s*1664525 + 1013904223)>>>0) / 4294967296; }
function hash(str){ let h=2166136261; for(const c of str){ h^=c.charCodeAt(0); h=Math.imul(h,16777619); } return h>>>0; }
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
const yesterday = () => { const d = new Date(Date.now()-864e5); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
// the course for a day: obstacles & fish placed by distance (same for everyone that day)
function course(day){
  const r = rng(hash("meow-run-"+day)), items = [];
  let x = 420;
  while(x < 60000){
    const lvl = Math.min(1, x/9000);
    const t = r();
    if(t < .42) items.push({ x, k:"box", w:18, h:18+(r()<.3*lvl?14:0) });
    else if(t < .62) items.push({ x, k:"yarn", w:20, h:16 });
    else if(t < .78 && x > 1500) items.push({ x, k:"bird", w:22, h:14, y: 30 + (r()<.5?0:22) });
    else if(t < .88 && x > 2500){ items.push({ x, k:"box", w:18, h:18 }); items.push({ x:x+20, k:"box", w:18, h:18 }); }
    else { const n = 3+((r()*4)|0); for(let i=0;i<n;i++) items.push({ x:x+i*22, k:"fish", w:12, h:9, y: 24 + Math.sin(i/(n-1||1)*Math.PI)*44 }); }
    // fish sprinkled above some obstacles
    if(r() < .35) items.push({ x:x+6, k:"fish", w:12, h:9, y: 78 });
    x += 150 + r()*170 - lvl*40;
  }
  return items;
}

App.registerGame({
  id: "runner",
  solo: true,
  name: "跳跳貓",
  desc: "每日同一關，比誰跑得遠",
  icon: () => Pix.sprite("white","happy"),
  mount(el, ctx){
    const { sprite, icon, esc, SFX } = ctx;
    let s = null, run = null, raf = 0;
    el.innerHTML = `<div class="box rn"><div class="rnBoard" id="rnBoard"></div>
      <div class="rnPreview" id="rnPrev">${sprite(ctx.me.cat,"happy")}<div class="rnGround"></div></div>
      <button class="btn rnStart" id="rnStart">🏃 橫向全螢幕開始！</button>
      <div class="rnHint">把手機橫過來玩・點畫面跳躍，在空中可以再跳一次（二段跳）</div></div>`;
    const $ = q => el.querySelector(q) || document.querySelector(q);
    const full = document.createElement("div"); full.className = "rnFull hidden";
    full.innerHTML = `<div class="rnStage" id="rnStage"><canvas id="rnC"></canvas><div class="rnOver" id="rnOver"></div><button class="rnX" id="rnX">✕</button></div>`;
    document.body.appendChild(full);
    const cv = full.querySelector("#rnC"), g = cv.getContext("2d"), stage = full.querySelector("#rnStage");
    const me = () => ctx.me.uid;
    let scale = 1;
    const img = (svg, w, h) => { const i = new Image(); i.src = "data:image/svg+xml;charset=utf-8,"+encodeURIComponent(svg.replace("<svg ", `<svg width="${w}" height="${h}" `)); return i; };
    const IM = { run1: img(sprite(ctx.me.cat,"happy"),80,80), run2: img(sprite(ctx.me.cat,"normal"),80,80), hurt: img(sprite(ctx.me.cat,"surprised"),80,80), fish: img(icon("fish"),48,32), heart: img(icon("heart"),40,40) };
    function layout(){
      if(full.classList.contains("hidden")) return;
      const vw = window.innerWidth, vh = window.innerHeight, portrait = vh > vw;
      const long = portrait ? vh : vw, short = portrait ? vw : vh;
      stage.classList.toggle("rot", portrait);
      stage.style.width = long+"px"; stage.style.height = short+"px";
      const d = window.devicePixelRatio||1;
      W = Math.round(H * long / short);
      cv.style.width = long+"px"; cv.style.height = short+"px";
      cv.width = long*d; cv.height = short*d; scale = short/H;
      g.setTransform(d*scale,0,0,d*scale,0,0); g.imageSmoothingEnabled=false;
      if(!run) drawIdle(); else draw();
    }
    function resize(){ layout(); }
    async function openFull(){
      full.classList.remove("hidden"); document.body.classList.add("rnLock");
      try{ if(document.documentElement.requestFullscreen && !document.fullscreenElement) await document.documentElement.requestFullscreen({ navigationUI:"hide" }); }catch(e){}
      try{ if(screen.orientation && screen.orientation.lock) await screen.orientation.lock("landscape"); }catch(e){}
      setTimeout(layout, 60); setTimeout(layout, 400);
    }
    async function closeFull(){
      if(run){ cancelAnimationFrame(raf); run = null; }
      full.classList.add("hidden"); document.body.classList.remove("rnLock");
      try{ if(screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); }catch(e){}
      try{ if(document.fullscreenElement) await document.exitFullscreen(); }catch(e){}
    }
    window.addEventListener("resize", layout);
    full.querySelector("#rnX").addEventListener("click", e=>{ e.stopPropagation(); closeFull(); });
    $("#rnStart").addEventListener("click", async ()=>{ await openFull(); menu(); });
    const sy = y => H - GROUND - y;

    function board(){
      const p = ctx.partner(), d = (s && s.daily) || {}, t = d[today()]||{}, y = d[yesterday()]||{};
      const champ = (o) => { const e = Object.entries(o); if(!e.length) return null; e.sort((a,b)=>b[1]-a[1]); return e[0]; };
      const yc = champ(y), wins = {}; for(const [day,o] of Object.entries(d)){ if(day===today()) continue; const c = champ(o); if(c && Object.keys(o).length>1) wins[c[0]]=(wins[c[0]]||0)+1; }
      $("#rnBoard").innerHTML = `<div class="rnDay">📅 今日關卡 ${today().slice(5).replace("-","/")}</div>
        <div class="rnRows"><div><b>${esc(ctx.me.name)}</b><span>${t[me()]!=null?t[me()]+" 公尺":"還沒跑"}</span><i>🏆${wins[me()]||0}</i></div>
        ${p?`<div><b>${esc(p.name)}</b><span>${t[p.user_id]!=null?t[p.user_id]+" 公尺":"還沒跑"}</span><i>🏆${wins[p.user_id]||0}</i></div>`:""}</div>
        ${yc?`<div class="rnY">昨天冠軍：${esc(ctx.nameOf(yc[0]))}（${yc[1]} 公尺）</div>`:""}`;
    }
    function overlay(html){ const o=$("#rnOver"); o.innerHTML = html; o.classList.toggle("hidden", !html); }
    function menu(){
      const t = ((s && s.daily) || {})[today()]||{}, mine = t[me()];
      overlay(`<div class="rnMenu"><div class="rnCatBig">${sprite(ctx.me.cat,"wave")}</div><button class="btn" id="rnGo">${mine!=null?"再挑戰一次":"開始跑！"}</button>${mine!=null?`<div class="rnSmall">今天最佳：${mine} 公尺</div>`:""}<div class="rnSmall">點畫面跳躍・空中可以再跳一次</div></div>`);
      $("#rnGo").addEventListener("click", e=>{ e.stopPropagation(); start(); });
    }
    function drawBg(dist){
      const sk = g.createLinearGradient(0,0,0,H); sk.addColorStop(0,"#bfe3ff"); sk.addColorStop(1,"#ffe9f0"); g.fillStyle = sk; g.fillRect(0,0,W,H);
      // far hills
      g.fillStyle = "#cfe8c8";
      for(let i=-1;i<6;i++){ const x = i*90 - (dist*.15 % 90); g.beginPath(); g.ellipse(x+45, H-GROUND, 60, 40, 0, Math.PI, 0); g.fill(); }
      // clouds
      g.fillStyle = "rgba(255,255,255,.9)";
      for(let i=0;i<4;i++){ const x = ((i*130 - dist*.3) % 520 + 520) % 520 - 60, y = 24 + (i%2)*18; g.fillRect(x,y,34,10); g.fillRect(x+8,y-7,18,8); }
      // ground
      g.fillStyle = "#c9925c"; g.fillRect(0, H-GROUND, W, GROUND);
      g.fillStyle = "#86cf88"; g.fillRect(0, H-GROUND, W, 6);
      g.fillStyle = "rgba(120,70,30,.25)"; for(let i=-1;i<20;i++){ const x = i*24 - (dist % 24); g.fillRect(x, H-GROUND+14, 10, 4); }
    }
    function drawIdle(){ if(run) return; drawBg(0); if(IM.run1.complete) g.drawImage(IM.run1, 44, sy(0)-34, 34, 34); }
    function drawItem(it, sx){
      const y = it.y||0;
      if(it.k==="box"){ g.fillStyle="#d9a066"; g.fillRect(sx, sy(it.h), it.w, it.h); g.fillStyle="#b07a44"; g.fillRect(sx, sy(it.h), it.w, 3); g.fillRect(sx+it.w/2-1, sy(it.h), 2, it.h); g.strokeStyle="#5a3b2e"; g.lineWidth=1.5; g.strokeRect(sx, sy(it.h), it.w, it.h); }
      else if(it.k==="yarn"){ g.fillStyle="#f08aa0"; g.beginPath(); g.arc(sx+it.w/2, sy(it.h/2), it.h/2+1, 0, 6.29); g.fill(); g.strokeStyle="#c85a74"; g.lineWidth=1.2; g.beginPath(); g.arc(sx+it.w/2, sy(it.h/2), it.h/3, .5, 4); g.stroke(); g.beginPath(); g.moveTo(sx+it.w/2, sy(it.h/2)); g.lineTo(sx+it.w+6, sy(0)); g.stroke(); }
      else if(it.k==="bird"){ const flap = Math.sin(performance.now()/90)>0; g.fillStyle="#7a8aa0"; g.fillRect(sx, sy(y+8), it.w, 7); g.fillRect(sx+4, sy(y+(flap?14:4)), 10, 5); g.fillStyle="#ffcf66"; g.fillRect(sx-4, sy(y+6), 5, 3); g.fillStyle="#222"; g.fillRect(sx+3, sy(y+12), 2, 2); }
      else if(it.k==="fish" && !it.got){ if(IM.fish.complete) g.drawImage(IM.fish, sx, sy(y+9), 14, 9); }
    }
    function start(){
      overlay("");
      const items = course(today()).map(i=>Object.assign({}, i));
      run = { dist:0, speed:170, y:0, vy:0, jumps:0, fish:0, items, over:false, t:0, frame:0, hurt:0 };
      SFX.jump();
      cancelAnimationFrame(raf);
      let last = performance.now(), acc = 0;
      const step = (now) => {
        if(!run) return;
        acc += Math.max(0, Math.min(.05, (now-last)/1000)); last = now;
        while(acc >= 1/120 && !run.over){ tick(1/120); acc -= 1/120; }
        draw();
        if(!run.over) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }
    function tick(dt){
      const r = run;
      r.t += dt; r.speed = Math.min(380, 170 + r.t*5.5);
      r.dist += r.speed*dt;
      r.vy -= GRAV*dt; r.y += r.vy*dt;
      if(r.y <= 0){ r.y = 0; r.vy = 0; r.jumps = 0; }
      // collisions (cat box: x 50..72, y r.y..r.y+22)
      const cx0 = 52, cx1 = 70, cy0 = r.y+2, cy1 = r.y+20;
      for(const it of r.items){
        const sx = it.x - r.dist + 60;
        if(sx > 140) break;
        if(sx + it.w < 40) continue;
        const y0 = it.y||0, y1 = y0 + it.h;
        if(sx < cx1 && sx+it.w > cx0 && y0 < cy1 && y1 > cy0){
          if(it.k==="fish"){ if(!it.got){ it.got = true; r.fish++; SFX.coin(); } }
          else { r.over = true; r.hurt = 1; end(); return; }
        }
      }
    }
    function draw(){
      const r = run; if(!r) return;
      drawBg(r.dist);
      for(const it of r.items){ const sx = it.x - r.dist + 60; if(sx > W+30) break; if(sx < -40) continue; drawItem(it, sx); }
      r.frame++;
      const im = r.over ? IM.hurt : (r.y>0 || (r.frame>>3)%2 ? IM.run1 : IM.run2);
      if(im.complete){ g.save(); g.translate(61, sy(r.y)-15); if(r.y>0) g.rotate(-.12); g.drawImage(im, -17, -17 + ((r.frame>>3)%2 && !r.y ? -1 : 0), 34, 34); g.restore(); }
      // HUD
      g.fillStyle="rgba(255,255,255,.85)"; g.fillRect(6,6,118,20); g.fillStyle="#5a3b2e"; g.font="13px DotGothic16, monospace"; g.textAlign="left";
      g.fillText(`${Math.floor(r.dist/10)} 公尺`, 12, 21);
      if(IM.fish.complete) g.drawImage(IM.fish, 76, 10, 16, 11); g.fillText(`${r.fish}`, 96, 21);
    }
    function jump(){
      if(!run || run.over) return;
      if(run.jumps===0 && run.y<=0){ run.vy = JUMP; run.jumps = 1; SFX.jump(); }
      else if(run.jumps<2){ run.vy = JUMP2; run.jumps = 2; SFX.jump(); }
    }
    stage.addEventListener("pointerdown", e=>{ if(e.target.closest("button")) return; if(run && !run.over){ e.preventDefault(); jump(); } });
    async function end(){
      SFX.hit(); setTimeout(()=>SFX.miss(), 150);
      const meters = Math.floor(run.dist/10) + run.fish*10, day = today();
      const prev = ((s && s.daily && s.daily[day]) || {})[me()];
      const rec = prev==null || meters > prev;
      const ns = await ctx.update("runner", st=>{
        st = st || { daily:{} };
        const d = st.daily[day] = st.daily[day] || {};
        if(d[me()]==null || meters > d[me()]) d[me()] = meters;
        const keys = Object.keys(st.daily).sort(); while(keys.length > 40) delete st.daily[keys.shift()];
        return st;
      });
      if(ns) s = ns;
      board();
      const p = ctx.partner(), theirs = p ? (((s.daily||{})[day]||{})[p.user_id]) : null;
      const beat = theirs!=null && meters > theirs;
      if(rec && p && theirs!=null && beat) ctx.notifyPartner(`${ctx.me.name} 在「跳跳貓」跑了 ${meters} 公尺，超過你了！`);
      overlay(`<div class="rnMenu"><div class="rnScore">${meters} 公尺</div><div class="rnSmall">距離 ${Math.floor(run.dist/10)} ＋ 小魚乾 ${run.fish}×10</div>
        ${rec?`<div class="rnRec">今日新紀錄！</div>`:""}${theirs!=null?`<div class="rnSmall">${esc(p.name)} 今天：${theirs} 公尺${beat?"・<b>你領先！</b>":""}</div>`:""}
        <div style="display:flex;gap:8px"><button class="btn sub" id="rnQuit" style="flex:1">離開</button><button class="btn" id="rnGo" style="flex:2">再跑一次</button></div></div>`);
      $("#rnQuit").addEventListener("click", e=>{ e.stopPropagation(); closeFull(); });
      $("#rnGo").addEventListener("click", e=>{ e.stopPropagation(); start(); });
      if(rec) { ctx.burst(); SFX.level(); }
      run = null;
    }
    this._u = ctx.onState("runner", st=>{ s = st; board(); });

    this._stop = () => { cancelAnimationFrame(raf); run = null; };
    this._full = () => { closeFull(); window.removeEventListener("resize", layout); full.remove(); };
    (async()=>{ const cur = await ctx.getState("runner"); s = cur ? JSON.parse(JSON.stringify(cur.state)) : null; board(); })();
  },
  unmount(){ if(this._u) this._u(); if(this._ro) this._ro.disconnect(); if(this._stop) this._stop(); if(this._full) this._full(); },
});
})();

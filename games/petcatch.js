// 接小魚乾：貓咪左右移動接掉下來的東西，接到的分數 = 貓幣（兩個人共用，拿去買家具和飾品）
(function(){
const PX = (rows, pal) => window.PetDeco.px(rows, pal);
const ART = {
  fish:  [["....O....","...OYO..O",".OOYYYOOO","OYEYYYYYO",".OOYYYOOO","...OYO..O","....O...."], { Y:"#e9a35a", E:"#2b1d18" }],
  gold:  [["....OO....","...OYYO..O",".OOYYYYOOO","OYEYWYYYYO",".OOYYYYOOO","...OYYO..O","....OO...."], { Y:"#ffcf4a", W:"#fff6c8", E:"#2b1d18" }],
  heart: [[".OO.OO.","OKKOKKO","OKWKKKO","OKKKKKO",".OKKKO.","..OKO..","...O..."], { K:"#f0708d", W:"#ffd0dc" }],
  clock: [["..OOO..",".OWWWO.","OWWOWWO","OWWOOWO","OWWWWWO",".OWWWO.","..OOO.."], { W:"#e9f6ff" }],
  drop:  [["...O...","..OBO..","..OBO..",".OBBBO.","OBWBBBO","OBBBBBO",".OBBBO.","..OOO.."], { B:"#6fb7e8", W:"#d6efff" }],
  yarn:  [["..OOO..",".OKKKO.","OKOKOKO","OKKOKKO","OKOKOKO",".OKKKO.","..OOO.O"], { K:"#9b6fd6" }],
};
const TYPES = {
  fish:  { pts:1,  w:60, size:26 },
  gold:  { pts:5,  w:9,  size:30 },
  heart: { pts:3,  w:10, size:24 },
  clock: { pts:0,  w:3,  size:24, time:5 },
  drop:  { pts:0,  w:16, size:24, bad:1 },
  yarn:  { pts:0,  w:6,  size:24, bad:1 },
};
const svgImg = svg => { const im = new Image(); im.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg); return im; };

// opts: { color, sfx, best } → Promise<number|null>  (score, or null if quit before the end)
function play(opts){
  return new Promise(resolve=>{
    const SFX = opts.sfx || {}; const snd = (k, ...a) => { try{ SFX[k] && SFX[k](...a); }catch(e){} };
    const ov = document.createElement("div"); ov.className = "pcGame";
    ov.innerHTML = `<div class="pcgBox">
      <div class="pcgHud"><span id="pcgS">0</span><span id="pcgL"></span><span id="pcgT">45</span><button id="pcgX">✕</button></div>
      <canvas id="pcgC"></canvas>
      <div class="pcgMsg" id="pcgM"><b>🐟 接小魚乾</b><p>手指左右滑動，讓貓咪接住掉下來的東西！<br>小魚乾 +1・金魚 +5・愛心 +3・時鐘 +5 秒<br>小心水滴和毛線球，碰到 3 次就結束</p><p class="pcgSm">接到幾分就拿到幾個貓幣 🪙（兩個人共用）</p><button class="btn" id="pcgGo">開始！</button></div>
    </div>`;
    document.body.appendChild(ov);
    const cv = ov.querySelector("#pcgC"), g = cv.getContext("2d"), $ = q => ov.querySelector(q);
    const imgs = Object.fromEntries(Object.entries(ART).map(([k,[r,p]])=>[k, svgImg(PX(r,p))]));
    const catImg = { normal: svgImg(Pix.sprite(opts.color||"orange","normal")), happy: svgImg(Pix.sprite(opts.color||"orange","happy")), cry: svgImg(Pix.sprite(opts.color||"orange","cry")) };
    let W = 0, H = 0, dpr = 1, raf = 0, last = 0, running = false, done = false;
    let catX = 0, target = 0, items = [], pops = [], score = 0, lives = 3, timeLeft = 45, spawnT = 0, elapsed = 0, faceT = 0, face = "normal", combo = 0;
    function size(){ const r = cv.getBoundingClientRect(); dpr = Math.min(2, window.devicePixelRatio||1); W = r.width; H = r.height; cv.width = W*dpr; cv.height = H*dpr; g.setTransform(dpr,0,0,dpr,0,0); g.imageSmoothingEnabled = false; if(!catX){ catX = target = W/2; } }
    const catW = () => Math.min(96, W*0.26);
    function hud(){ $("#pcgS").textContent = `🪙 ${score}`; $("#pcgL").textContent = "❤️".repeat(lives) + "🤍".repeat(3-lives); $("#pcgT").textContent = `⏱ ${Math.ceil(timeLeft)}`; }
    function pick(){ const bad = Math.min(1.8, 1 + elapsed/30); let tot = 0; const ws = Object.entries(TYPES).map(([k,t])=>{ const w = t.bad ? t.w*bad : t.w; tot += w; return [k,w]; });
      let r = Math.random()*tot; for(const [k,w] of ws){ if((r -= w) < 0) return k; } return "fish"; }
    function spawn(){ const k = pick(), t = TYPES[k], s = t.size*(W/300+.5);
      items.push({ k, x: s/2 + Math.random()*(W - s), y: -s, s, vy: (H*0.32 + elapsed*H*0.012) * (0.85 + Math.random()*0.35), rot: (Math.random()-.5)*.6 }); }
    function pop(text, x, y, col){ pops.push({ text, x, y, t:0, col }); }
    function step(dt){
      elapsed += dt; timeLeft -= dt; spawnT -= dt;
      if(spawnT <= 0){ spawn(); spawnT = Math.max(0.32, 0.78 - elapsed*0.011) * (0.7 + Math.random()*0.6); }
      catX += (target - catX) * Math.min(1, dt*14);
      const cw = catW(), cy = H - cw*0.95;
      for(const it of items){ it.y += it.vy*dt;
        if(!it.gone && it.y + it.s*0.3 > cy && it.y < cy + cw*0.45 && Math.abs(it.x - catX) < cw*0.45){
          it.gone = true; const t = TYPES[it.k];
          if(t.bad){ lives--; combo = 0; face = "cry"; faceT = .7; snd("miss"); if(navigator.vibrate) navigator.vibrate(60); pop(it.k==="drop"?"好冰！":"纏住了！", it.x, cy, "#4a90d6"); }
          else if(t.time){ timeLeft += t.time; face = "happy"; faceT = .4; snd("combo"); pop("+5 秒", it.x, cy, "#3fae74"); }
          else { combo++; const bonus = combo>0 && combo%10===0 ? 5 : 0; score += t.pts + bonus; face = "happy"; faceT = .35; snd(it.k==="fish"?"coin":"heart");
            pop(`+${t.pts+bonus}${bonus?" 連擊!":""}`, it.x, cy, it.k==="gold"?"#e8a920":"#e5486a"); }
        }
      }
      items = items.filter(it => !it.gone && it.y < H + 40);
      pops.forEach(p=>p.t+=dt); pops = pops.filter(p=>p.t<0.8);
      if(faceT > 0){ faceT -= dt; if(faceT<=0) face = "normal"; }
      if(lives <= 0 || timeLeft <= 0) end();
    }
    function draw(){
      g.clearRect(0,0,W,H);
      g.fillStyle = "#fde9d6"; g.fillRect(0,0,W,H);
      g.fillStyle = "#fbe0c8"; for(let x=0;x<W;x+=48) g.fillRect(x,0,24,H);
      const fy = H - catW()*0.35; g.fillStyle = "#d9a877"; g.fillRect(0,fy,W,H-fy); g.fillStyle = "#5a3b2e"; g.fillRect(0,fy,W,3);
      for(const it of items){ g.save(); g.translate(it.x, it.y); g.rotate(it.rot); g.drawImage(imgs[it.k], -it.s/2, -it.s/2, it.s, it.s*(ART[it.k][0].length/Math.max(...ART[it.k][0].map(r=>r.length)))); g.restore(); }
      const cw = catW(); g.drawImage(catImg[face], catX - cw/2, H - cw*1.02, cw, cw);
      g.textAlign = "center"; g.font = `16px Cubic11, sans-serif`;
      for(const p of pops){ g.globalAlpha = 1 - p.t/0.8; g.fillStyle = p.col; g.fillText(p.text, p.x, p.y - 30 - p.t*40); } g.globalAlpha = 1;
    }
    function loop(t){ if(!running) return; const dt = Math.min(0.05, (t - last)/1000 || 0); last = t; step(dt); draw(); hud(); if(running) raf = requestAnimationFrame(loop); }
    function start(){ score = 0; lives = 3; timeLeft = 45; elapsed = 0; items = []; pops = []; spawnT = 0.4; combo = 0; face = "normal"; catX = target = W/2;
      $("#pcgM").style.display = "none"; running = true; last = performance.now(); hud(); snd("select"); raf = requestAnimationFrame(loop); }
    function end(){
      running = false; cancelAnimationFrame(raf); draw(); hud(); snd(score>0?"level":"miss");
      const best = Math.max(opts.best||0, score);
      $("#pcgM").innerHTML = `<b>${lives<=0?"喵嗚～被打到 3 次了":"時間到！"}</b><p class="pcgBig">🪙 ${score}</p><p>拿到 ${score} 個貓幣${score>(opts.best||0)&&score>0?"・🎉 新紀錄！":`・最高紀錄 ${best}`}</p><button class="btn" id="pcgAgain">再玩一次</button><button class="btn sub" id="pcgDone">回房間</button>`;
      $("#pcgM").style.display = "";
      const give = score; opts.best = best;
      Promise.resolve(opts.onScore && opts.onScore(give)).catch(()=>{});
      $("#pcgAgain").addEventListener("click", ()=>{ start(); });
      $("#pcgDone").addEventListener("click", close);
    }
    function close(){ if(done) return; done = true; running = false; cancelAnimationFrame(raf); window.removeEventListener("resize", size); window.removeEventListener("keydown", key); ov.remove(); resolve(); }
    const toX = e => { const r = cv.getBoundingClientRect(); target = Math.max(catW()*0.4, Math.min(W - catW()*0.4, e.clientX - r.left)); };
    cv.addEventListener("pointerdown", e=>{ toX(e); try{ cv.setPointerCapture(e.pointerId); }catch(_){} });
    cv.addEventListener("pointermove", e=>{ if(e.pointerType==="mouse" && !e.buttons) return; toX(e); });
    const key = e => { if(e.key==="ArrowLeft") target = Math.max(0, target - W*0.12); if(e.key==="ArrowRight") target = Math.min(W, target + W*0.12); };
    window.addEventListener("keydown", key); window.addEventListener("resize", size);
    $("#pcgX").addEventListener("click", ()=>{ snd("tap"); close(); });
    $("#pcgGo").addEventListener("click", start);
    requestAnimationFrame(()=>{ size(); draw(); hud(); });
  });
}
window.PetCatch = { play };
})();

// 遊戲：守護罐罐大作戰（兩個人一起擺貓咪守衛，擋住來偷罐罐的老鼠）
// 主守衛 = players()[0]：負責算老鼠、子彈和金幣；另一個人蓋塔、升級都傳過去。左半邊歸 players()[0]，右半邊歸另一個人，金幣共用。
(function(){
const T = 32, COLS = 9, ROWS = 13, WAVES = 15;
const MAP = [
  "....S....",
  "....P....",
  ".PPPP....",
  ".P.......",
  ".PPPPPPP.",
  ".......P.",
  ".PPPPPPP.",
  ".P.......",
  ".PPPPPPP.",
  ".......P.",
  "....PPPP.",
  "....P....",
  "....E....",
];
// walk the path from S to E
const PATH = (()=>{ let p = null; MAP.forEach((r,y)=>[...r].forEach((c,x)=>{ if(c==="S") p = [x,y]; }));
  const out = [p], seen = new Set([p.join()]);
  for(;;){ const [x,y] = out[out.length-1]; if(MAP[y][x]==="E") break;
    const n = [[x+1,y],[x-1,y],[x,y+1],[x,y-1]].find(([a,b])=>MAP[b] && "PE".includes(MAP[b][a]) && !seen.has(a+","+b)); if(!n) break; out.push(n); seen.add(n.join()); }
  return out; })();
const PLEN = PATH.length - 1;
const posAt = d => { d = Math.max(0, Math.min(PLEN, d)); const i = Math.floor(d), f = d - i, a = PATH[i], b = PATH[Math.min(PLEN, i+1)]; return [a[0] + (b[0]-a[0])*f + .5, a[1] + (b[1]-a[1])*f + .5]; };
const isPath = (x, y) => MAP[y] && MAP[y][x] !== ".";
const zoneOf = x => x <= 3 ? "a" : x >= 5 ? "b" : "both";

const TOWERS = {
  yarn:  { n:"毛線貓", cat:"orange", face:"happy", cost:40, range:2.6, rate:.7, dmg:1.3, desc:"丟毛線球，打一隻" },
  paw:   { n:"拍拍貓", cat:"calico", face:"angry", cost:60, range:1.4, rate:1.0, dmg:2.2, aoe:true, desc:"拍旁邊所有老鼠" },
  sleep: { n:"睡覺貓", cat:"gray", face:"sleep", cost:50, range:1.9, rate:.4, dmg:.25, slow:.5, desc:"讓老鼠變慢" },
  can:   { n:"罐頭砲貓", cat:"black", face:"surprised", cost:90, range:3.6, rate:1.8, dmg:5, splash:.9, desc:"射得遠、會爆炸" },
};
const MICE = {
  mouse: { n:"小老鼠", hp:4, sp:1.25, gold:5, steal:1, sz:.55, col:"#a7aec2" },
  fast:  { n:"快快鼠", hp:3, sp:2.3, gold:6, steal:1, sz:.48, col:"#c9a46a" },
  fat:   { n:"胖胖鼠", hp:15, sp:.8, gold:12, steal:2, sz:.75, col:"#8a8aa0" },
  boss:  { n:"老鼠王", hp:150, sp:.55, gold:80, steal:5, sz:1.05, col:"#6a6474" },
};
const lvMul = lv => [1, 1.7, 2.6][lv-1];
const upCost = (k, lv) => Math.round(TOWERS[k].cost * (lv===1 ? .8 : 1.3));
const O = "#5a3b2e";
const svgImg = svg => { const im = new Image(); im.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg); return im; };
function waveList(n){ // which mice come in wave n (1-based)
  const list = [], cnt = 6 + n*2;
  for(let i=0;i<cnt;i++){ let k = "mouse"; if(n >= 3 && i % 3 === 1) k = "fast"; if(n >= 5 && i % 5 === 3) k = "fat"; if(n >= 9 && i % 4 === 2) k = "fat"; list.push(k); }
  if(n === 10 || n === 15) list.push("boss");
  if(n >= 12) for(let i=0;i<n-10;i++) list.splice(i*3, 0, "fast");
  return list;
}

App.registerGame({
  id: "defense",
  name: "守護罐罐大作戰",
  desc: "一起擺貓咪守衛，擋住老鼠",
  icon: () => Pix.sprite("calico","angry"),
  mount(el, ctx){
    const { sprite, esc, SFX } = ctx;
    let s = null, G = null, raf = 0, alive = true;
    const me = () => ctx.me.uid;
    const side = () => ctx.players()[0] === me() ? "a" : "b";
    const isHost = () => side() === "a";
    const partnerOn = () => { const p = ctx.partner(); return p && ctx.isOnline(p.user_id); };
    const pname = () => ctx.partner() ? ctx.partner().name : "ta";

    function lobby(){
      if(G) stop();
      const best = s && s.best;
      el.innerHTML = `<div class="box tdLobby">
        <div class="tdHero"><span class="tdCan">${canSvg()}</span>${sprite("orange","happy")}${sprite("calico","angry")}${sprite("gray","sleep")}${sprite("black","surprised")}</div>
        <p class="tdIntro">一群老鼠要來偷你們的<b>罐罐</b>！<br>${side()==="a" ? "你守<b>左半邊</b>" : "你守<b>右半邊</b>"}，${esc(pname())} 守另一邊，金幣兩個人共用。<br>撐過 ${WAVES} 波就贏了～</p>
        <div class="tdTw">${Object.entries(TOWERS).map(([k,t])=>`<div>${sprite(t.cat, t.face)}<b>${t.n}</b><span>${t.desc}</span><i>💰 ${t.cost}</i></div>`).join("")}</div>
        <div class="tdHow"><span>點自己那半邊的草地：蓋守衛</span><span>點守衛：升級（最多 3 級）或賣掉</span><span>老鼠跑到罐罐就會偷走罐罐</span><span>第 10、15 波有老鼠王！</span></div>
        <div class="cpOn">${ctx.partner() ? (partnerOn() ? `🟢 ${esc(pname())} 在線上，可以開始！` : `⚪ ${esc(pname())} 不在線上，要兩個人一起守`) : "等 ta 加入小窩"}</div>
        <button class="btn tdGo" id="tdGo">🛡️ 開始守護！</button>
        <div class="k" style="text-align:center">${best ? `最好成績：撐到第 ${best} 波${s.won ? "・🏆 守住過！" : ""}` : "還沒有紀錄"}</div></div>`;
      el.querySelector("#tdGo").addEventListener("click", async ()=>{
        if(!partnerOn()){ ctx.toast(`要等 ${esc(pname())} 也在線上才能一起守喔`); SFX.miss(); return; }
        SFX.select(); await ctx.update("defense", st=>{ st = st || {}; st.run = Date.now(); st.live = true; return st; });
      });
    }
    function canSvg(){ const rows = [".OOOOOO.","OWWWWWWO","OOOOOOOO","OKKKKKKO","OKWKKWKO","OKKKKKKO","OKKKKKKO","OOOOOOOO"], pal = { O, W:"#d6dbe3", K:"#f0708d" };
      let r = ""; rows.forEach((row,y)=>[...row].forEach((c,x)=>{ if(pal[c]) r += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${pal[c]}"/>`; })); return `<svg viewBox="0 0 8 8" shape-rendering="crispEdges">${r}</svg>`; }

    // ---------- a game ----------
    function start(){
      if(G) stop();
      el.innerHTML = `<div class="box tdPlay"><div class="tdTop"><span id="tdWave">第 0/${WAVES} 波</span><span id="tdLives"></span><span id="tdCoins"></span><button class="btn sub" id="tdOut">放棄</button></div>
        <div class="tdStage"><canvas id="tdC" width="${COLS*T*2}" height="${ROWS*T*2}"></canvas><div class="tdMsg hidden" id="tdMsg"></div></div>
        <div class="tdBar" id="tdBar"></div></div>`;
      const cv = el.querySelector("#tdC"), g = cv.getContext("2d"); g.imageSmoothingEnabled = false; g.setTransform(2,0,0,2,0,0);
      const img = {}; for(const k in TOWERS){ img[k] = svgImg(Pix.sprite(TOWERS[k].cat, TOWERS[k].face)); }
      G = { run: s.run, g, cv, img, frame: 0, last: performance.now(), sel: null, sent: 0, fx: [], ended: false,
            W: { coins: 120, lives: 15, wave: 0, phase: "build", cd: 20, towers: [], mice: [], next: 0, queue: [], seq: 1, ver: 1, shots: [] } };
      cv.addEventListener("pointerdown", e=>{ const r = cv.getBoundingClientRect(); const x = Math.floor((e.clientX - r.left)/r.width*COLS), y = Math.floor((e.clientY - r.top)/r.height*ROWS); tap(x, y); });
      const out = el.querySelector("#tdOut");
      out.addEventListener("click", ()=>{ if(!out.classList.contains("ask")){ out.classList.add("ask"); out.textContent = "確定？"; setTimeout(()=>{ out.classList.remove("ask"); out.textContent = "放棄"; }, 2500); return; }
        SFX.tap(); ctx.update("defense", st=>{ if(!st) return undefined; st.live = false; return st; }); });
      bar();
      raf = requestAnimationFrame(loop);
      if(window.__mock) window.__td = { G:()=>G, req };   // tests only
    }
    function stop(){ cancelAnimationFrame(raf); G = null; }

    // ---------- requests (host applies them) ----------
    function req(r){ if(!G || G.ended) return; if(isHost()){ const m = apply("a", r); feedback(m); push(); } else ctx.broadcast(Object.assign({ g:"td", k:"req", run:G.run }, r)); }
    function apply(sd, r){
      const W = G.W;
      if(r.a==="build"){ const t = TOWERS[r.t]; if(!t || isPath(r.x, r.y) || W.towers.some(o=>o.x===r.x && o.y===r.y)) return "nope:這裡不能蓋";
        const z = zoneOf(r.x); if(z!=="both" && z!==sd) return "nope:這是 ta 的地盤喔";
        if(W.coins < t.cost) return "nope:金幣不夠 (｡•́︿•̀｡)"; W.coins -= t.cost; W.towers.push({ x:r.x, y:r.y, k:r.t, lv:1, cd:0, spent:t.cost, by:sd }); W.ver++; return "build"; }
      if(r.a==="wave"){ if(W.phase==="build"){ W.cd = 0; return "wave"; } return null; }
      const tw = W.towers.find(o=>o.x===r.x && o.y===r.y); if(!tw) return null;
      if(r.a==="up"){ if(tw.lv >= 3) return "nope:已經是最高級了"; const c = upCost(tw.k, tw.lv); if(W.coins < c) return "nope:金幣不夠 (｡•́︿•̀｡)"; W.coins -= c; tw.lv++; tw.spent += c; W.ver++; return "up"; }
      if(r.a==="sell"){ W.coins += Math.round(tw.spent*.6); W.towers = W.towers.filter(o=>o!==tw); W.ver++; return "sell"; }
      return null;
    }
    function feedback(m){ if(!m) return; if(m==="build" || m==="up") SFX.place ? SFX.place() : SFX.select(); else if(m==="sell") SFX.coin(); else if(m.startsWith("nope:")){ SFX.miss(); ctx.toast(m.slice(5)); } }

    // ---------- host simulation ----------
    function hostStep(dt){
      const W = G.W;
      if(W.phase==="build"){ W.cd -= dt; if(W.cd <= 0){ W.wave++; W.phase = "wave"; W.queue = waveList(W.wave); W.next = 0; W.ver++; SFX.beep(true); } }
      if(W.phase==="wave"){
        W.next -= dt; if(W.next <= 0 && W.queue.length){ const k = W.queue.shift(), m = MICE[k], hp = m.hp*(1 + (W.wave-1)*.2); W.mice.push({ id:W.seq++, k, d:0, hp, max:hp, slow:0 }); W.next = k==="boss" ? 2 : .75; }
        if(!W.queue.length && !W.mice.length){ W.phase = W.wave >= WAVES ? "win" : "build"; W.cd = 14; W.coins += 20 + W.wave*3; W.ver++; if(W.phase==="win") return end(true); }
      }
      // mice walk
      for(const m of W.mice){ const sp = MICE[m.k].sp * (m.slow > 0 ? .5 : 1); m.slow = Math.max(0, m.slow - dt); m.d += sp*dt;
        if(m.d >= PLEN){ m.gone = true; W.lives -= MICE[m.k].steal; W.ver++; W.stolen = (W.stolen||0) + 1; } }
      // towers act
      for(const tw of W.towers){ const t = TOWERS[tw.k], mul = lvMul(tw.lv), range = t.range + (tw.lv-1)*.3; tw.cd -= dt; if(tw.cd > 0) continue;
        const cx = tw.x + .5, cy = tw.y + .5, inR = W.mice.filter(m=>!m.gone && m.hp > 0 && (([x,y])=>Math.hypot(x-cx, y-cy))(posAt(m.d)) <= range);
        if(!inR.length) continue;
        tw.cd = t.rate * (tw.lv===3 ? .8 : 1);
        if(t.aoe){ inR.forEach(m=>hit(m, t.dmg*mul)); W.shots.push([tw.x, tw.y, tw.x, tw.y, "paw"]); }
        else if(t.slow){ inR.forEach(m=>{ m.slow = .6; hit(m, t.dmg*mul); }); W.shots.push([tw.x, tw.y, tw.x, tw.y, "zz"]); }
        else { const tg = inR.reduce((a,b)=>a.d > b.d ? a : b), [tx, ty] = posAt(tg.d); hit(tg, t.dmg*mul);
          if(t.splash) W.mice.forEach(m=>{ if(m!==tg && !m.gone){ const [x,y] = posAt(m.d); if(Math.hypot(x-tx, y-ty) < t.splash) hit(m, t.dmg*mul*.5); } });
          W.shots.push([tw.x, tw.y, +(tx-.5).toFixed(2), +(ty-.5).toFixed(2), tw.k]); }
      }
      W.mice = W.mice.filter(m=>{ if(m.hp <= 0 && !m.gone){ W.coins += MICE[m.k].gold; W.ver++; return false; } return !m.gone; });
      if(W.lives <= 0){ W.lives = 0; end(false); }
    }
    function hit(m, d){ m.hp -= d; }
    function push(){ if(!G) return; const W = G.W;
      ctx.broadcast({ g:"td", k:"w", run:G.run, W:{ coins:W.coins, lives:W.lives, wave:W.wave, phase:W.phase, cd:+W.cd.toFixed(1), ver:W.ver, towers:W.towers.map(t=>[t.x,t.y,t.k,t.lv,t.by]), mice:W.mice.map(m=>[m.id,m.k,+m.d.toFixed(2),+(m.hp/m.max).toFixed(2),m.slow>0?1:0]), shots:W.shots } });
      G.fx.push(...W.shots.map(s=>({ s, t:0 }))); W.shots = []; }
    async function end(won){
      if(!G || G.ended) return; G.ended = true; const W = G.W;
      push(); ctx.broadcast({ g:"td", k:"end", run:G.run, won, wave:W.wave });
      showEnd(won, W.wave);
      await ctx.update("defense", st=>{ st = st || {}; st.live = false; st.last = W.wave; if(!st.best || W.wave > st.best) st.best = W.wave; if(won) st.won = true; return st; });
      const coins = W.wave * 3 + (won ? 30 : 0);
      await ctx.update("pet", st=>{ if(!st || !window.PetLogic) return undefined; st = window.PetLogic.norm(JSON.parse(JSON.stringify(st)));
        st.coins = (st.coins||0) + coins; st.log = (st.log||[]).concat([{ by:me(), a:"td", n:coins, at:Date.now() }]).slice(-24); return st; });
    }
    function showEnd(won, wave){
      if(!G) return; G.ended = true; const m = el.querySelector("#tdMsg"); if(!m) return; m.classList.remove("hidden");
      m.innerHTML = won ? `<b>🏆 守住罐罐了！</b><p>撐過全部 ${WAVES} 波，老鼠王也被打跑了</p><p>${wave*3 + 30} 個貓幣送進養貓房間 🪙</p>` : `<b>罐罐被偷光了 (´；ω；\`)</b><p>撐到第 ${wave} 波</p><p>${wave*3} 個貓幣送進養貓房間 🪙</p>`;
      m.innerHTML += `<button class="btn" id="tdAgain">再守一次</button><button class="btn sub" id="tdHome">回大廳</button>`;
      won ? (SFX.match(), ctx.burst()) : SFX.miss();
      el.querySelector("#tdAgain").addEventListener("click", ()=>{ if(!partnerOn()){ ctx.toast("對方不在線上了"); return; } ctx.update("defense", st=>{ st = st || {}; st.run = Date.now(); st.live = true; return st; }); });
      el.querySelector("#tdHome").addEventListener("click", ()=>{ stop(); lobby(); });
    }

    // ---------- UI ----------
    function tap(x, y){
      if(!G || G.ended || x < 0 || y < 0 || x >= COLS || y >= ROWS) return;
      const tw = G.W.towers.find(o=>o.x===x && o.y===y);
      if(tw){ G.sel = { x, y, tower:true }; SFX.tap(); bar(); return; }
      if(isPath(x, y)){ G.sel = null; bar(); return; }
      const z = zoneOf(x); if(z!=="both" && z!==side()){ ctx.toast(`這邊是 ${esc(pname())} 的地盤，請 ta 來蓋～`); SFX.miss(); G.sel = null; bar(); return; }
      G.sel = { x, y, tower:false }; SFX.tap(); bar();
    }
    function bar(){
      const b = el.querySelector("#tdBar"); if(!b || !G) return; const W = G.W, sel = G.sel;
      if(sel && !sel.tower){ b.innerHTML = `<div class="tdPick">${Object.entries(TOWERS).map(([k,t])=>`<button data-b="${k}" ${W.coins < t.cost ? "class=poor" : ""}>${sprite(t.cat, t.face)}<b>${t.n}</b><i>💰${t.cost}</i></button>`).join("")}</div><button class="btn sub tdX" data-x>取消</button>`; }
      else if(sel && sel.tower){ const tw = W.towers.find(o=>o.x===sel.x && o.y===sel.y); if(!tw){ G.sel = null; return bar(); } const t = TOWERS[tw.k], mine = zoneOf(tw.x)==="both" || zoneOf(tw.x)===side();
        b.innerHTML = `<div class="tdInfo">${sprite(t.cat, t.face)}<div><b>${t.n} Lv.${tw.lv}</b><span>${esc(t.desc)}</span></div></div>
          ${mine ? `<button class="btn" data-up ${tw.lv>=3?"disabled":""}>${tw.lv>=3 ? "最高級" : `升級 💰${upCost(tw.k, tw.lv)}`}</button><button class="btn sub" data-sell>賣掉 +${Math.round(tw.spent*.6)}</button>` : `<span class="tdNote">${esc(pname())} 的守衛</span>`}<button class="btn sub tdX" data-x>關閉</button>`; }
      else b.innerHTML = W.phase==="build" ? `<button class="btn tdWaveB" data-wave>🐭 讓下一波老鼠來！<small>${Math.ceil(Math.max(0, W.cd))} 秒後自動開始</small></button>` : `<div class="tdHint">點自己那半邊的草地蓋守衛・左邊 ${esc(side()==="a" ? "你" : pname())}／右邊 ${esc(side()==="b" ? "你" : pname())}</div>`;
      b.querySelectorAll("[data-b]").forEach(x=>x.addEventListener("click", ()=>{ req({ a:"build", x:sel.x, y:sel.y, t:x.dataset.b }); G.sel = null; bar(); }));
      const up = b.querySelector("[data-up]"); if(up) up.addEventListener("click", ()=>{ req({ a:"up", x:sel.x, y:sel.y }); setTimeout(bar, 150); });
      const sl = b.querySelector("[data-sell]"); if(sl) sl.addEventListener("click", ()=>{ req({ a:"sell", x:sel.x, y:sel.y }); G.sel = null; setTimeout(bar, 150); });
      const wv = b.querySelector("[data-wave]"); if(wv) wv.addEventListener("click", ()=>{ SFX.select(); req({ a:"wave" }); });
      b.querySelectorAll("[data-x]").forEach(x=>x.addEventListener("click", ()=>{ G.sel = null; bar(); }));
    }
    function hud(){
      const W = G.W;
      el.querySelector("#tdWave").textContent = `第 ${W.wave}/${WAVES} 波`;
      el.querySelector("#tdLives").innerHTML = `<span class="tdCanI">${canSvg()}</span>${W.lives}`;
      el.querySelector("#tdCoins").textContent = `💰 ${W.coins}`;
      const sig = W.phase + (W.phase==="build" ? Math.ceil(W.cd) : "") + "|" + W.coins + "|" + W.towers.length + "|" + (G.sel ? JSON.stringify(G.sel) : "");
      if(G.barSig !== sig){ G.barSig = sig; bar(); }
    }

    // ---------- drawing ----------
    function draw(){
      const g = G.g, W = G.W; G.frame += 1/60;
      for(let y=0;y<ROWS;y++) for(let x=0;x<COLS;x++){ const X = x*T, Y = y*T, c = MAP[y][x];
        if(c===".") { const z = zoneOf(x); g.fillStyle = (x+y)%2 ? "#9ddb9a" : "#93d490"; g.fillRect(X, Y, T, T);
          if(z==="a"){ g.fillStyle = "rgba(240,112,141,.07)"; g.fillRect(X, Y, T, T); } if(z==="b"){ g.fillStyle = "rgba(111,183,232,.08)"; g.fillRect(X, Y, T, T); }
          if((x*7 + y*13) % 5 === 0){ g.fillStyle = "#7cc47f"; g.fillRect(X + 6, Y + 20, 2, 4); g.fillRect(X + 9, Y + 18, 2, 6); }
          if((x*11 + y*3) % 9 === 0){ g.fillStyle = ["#f0708d","#ffd36b","#ffffff"][(x+y)%3]; g.fillRect(X + 22, Y + 8, 4, 4); g.fillStyle = "#ffd36b"; g.fillRect(X + 23, Y + 9, 2, 2); } }
        else { g.fillStyle = "#e9c79a"; g.fillRect(X, Y, T, T); g.fillStyle = "#dcb683"; if((x+y)%2) g.fillRect(X + 4, Y + 6, 6, 3); else g.fillRect(X + 18, Y + 20, 7, 3);
          g.fillStyle = "#c9a46a"; if(!isPath(x, y-1)) g.fillRect(X, Y, T, 2); if(!isPath(x, y+1)) g.fillRect(X, Y + T - 2, T, 2); if(!isPath(x-1, y)) g.fillRect(X, Y, 2, T); if(!isPath(x+1, y)) g.fillRect(X + T - 2, Y, 2, T); } }
      // zone divider
      g.strokeStyle = "rgba(90,59,46,.25)"; g.setLineDash([4,4]); g.beginPath(); g.moveTo(4*T, 0); g.lineTo(4*T, ROWS*T); g.moveTo(5*T, 0); g.lineTo(5*T, ROWS*T); g.stroke(); g.setLineDash([]);
      // mouse hole + the can
      { const [sx, sy] = PATH[0]; g.fillStyle = O; g.fillRect(sx*T + 6, sy*T + 2, T - 12, 14); g.fillStyle = "#2b1d18"; g.fillRect(sx*T + 8, sy*T + 4, T - 16, 12); }
      { const [ex, ey] = PATH[PATH.length-1], X = ex*T, Y = ey*T, sh = Math.sin(G.frame*3)*1;
        g.fillStyle = O; g.fillRect(X + 4, Y + 2 + sh, 24, 26); g.fillStyle = "#d6dbe3"; g.fillRect(X + 5, Y + 3 + sh, 22, 5); g.fillStyle = "#f0708d"; g.fillRect(X + 5, Y + 9 + sh, 22, 18); g.fillStyle = "#fff"; g.fillRect(X + 9, Y + 13 + sh, 4, 4); g.fillRect(X + 19, Y + 13 + sh, 4, 4); g.fillStyle = O; g.fillRect(X + 14, Y + 19 + sh, 4, 2); }
      // selection
      if(G.sel){ const tw = G.sel.tower && W.towers.find(o=>o.x===G.sel.x && o.y===G.sel.y);
        if(tw){ const r = (TOWERS[tw.k].range + (tw.lv-1)*.3)*T; g.fillStyle = "rgba(255,255,255,.18)"; g.beginPath(); g.arc(tw.x*T + T/2, tw.y*T + T/2, r, 0, Math.PI*2); g.fill(); g.strokeStyle = "rgba(255,255,255,.7)"; g.stroke(); }
        g.strokeStyle = "#f0708d"; g.lineWidth = 2; g.strokeRect(G.sel.x*T + 1, G.sel.y*T + 1, T - 2, T - 2); g.lineWidth = 1; }
      // towers
      for(const tw of W.towers){ const im = G.img[tw.k], X = tw.x*T, Y = tw.y*T;
        g.fillStyle = "rgba(90,59,46,.25)"; g.fillRect(X + 6, Y + T - 6, T - 12, 4);
        g.fillStyle = tw.by==="a" ? "#f7a7b8" : "#9fd0f5"; g.fillRect(X + 4, Y + T - 8, T - 8, 4);
        if(im.complete) g.drawImage(im, X - 2, Y - 6, T + 4, T + 4);
        for(let i=0;i<tw.lv-1;i++){ g.fillStyle = O; g.fillRect(X + 2 + i*7, Y + 1, 6, 6); g.fillStyle = "#ffcf4a"; g.fillRect(X + 3 + i*7, Y + 2, 4, 4); } }
      // mice
      for(const m of W.mice){ const k = MICE[m.k], [x, y] = posAt(m.dd != null ? m.dd : m.d), X = x*T, Y = y*T, sz = k.sz*T, wob = Math.sin(G.frame*16 + m.id)*1.2;
        g.fillStyle = "rgba(90,59,46,.25)"; g.fillRect(X - sz*.45, Y + sz*.35, sz*.9, 3);
        g.fillStyle = O; g.fillRect(X - sz*.5, Y - sz*.35 + wob, sz, sz*.7); g.fillStyle = k.col; g.fillRect(X - sz*.45, Y - sz*.3 + wob, sz*.9, sz*.6);
        g.fillStyle = O; g.fillRect(X - sz*.45, Y - sz*.55 + wob, sz*.3, sz*.3); g.fillRect(X + sz*.15, Y - sz*.55 + wob, sz*.3, sz*.3); g.fillStyle = "#f7a7b8"; g.fillRect(X - sz*.4, Y - sz*.5 + wob, sz*.2, sz*.2); g.fillRect(X + sz*.2, Y - sz*.5 + wob, sz*.2, sz*.2);
        g.fillStyle = "#2b1d18"; g.fillRect(X - sz*.2, Y - sz*.12 + wob, 2, 2); g.fillRect(X + sz*.12, Y - sz*.12 + wob, 2, 2); g.fillStyle = "#f0708d"; g.fillRect(X - 1, Y + sz*.02 + wob, 3, 2);
        g.fillStyle = O; g.fillRect(X + sz*.45, Y + sz*.1, sz*.4, 2);
        if(m.k==="boss"){ g.fillStyle = "#ffcf4a"; g.fillRect(X - 6, Y - sz*.75 + wob, 12, 5); g.fillRect(X - 6, Y - sz*.85 + wob, 2, 3); g.fillRect(X - 1, Y - sz*.85 + wob, 2, 3); g.fillRect(X + 4, Y - sz*.85 + wob, 2, 3); }
        if(m.slow){ g.fillStyle = "#cdb4f0"; g.font = "8px Cubic11, sans-serif"; g.fillText("z", X + sz*.4, Y - sz*.4); }
        const hp = m.hpr != null ? m.hpr : m.hp/m.max; if(hp < 1){ g.fillStyle = O; g.fillRect(X - 9, Y - sz*.7 - 4 + wob, 18, 4); g.fillStyle = hp > .5 ? "#5cb87a" : hp > .25 ? "#ffcf4a" : "#e5486a"; g.fillRect(X - 8, Y - sz*.7 - 3 + wob, 16*Math.max(0, hp), 2); } }
      // shots
      G.fx = G.fx.filter(f=>{ f.t += 1/60; const [x1, y1, x2, y2, k] = f.s, p = Math.min(1, f.t/.25), X1 = x1*T + T/2, Y1 = y1*T + T/2, X2 = x2*T + T/2, Y2 = y2*T + T/2;
        if(k==="paw"){ g.strokeStyle = `rgba(255,255,255,${1-p})`; g.lineWidth = 3; g.beginPath(); g.arc(X1, Y1, 10 + p*30, 0, Math.PI*2); g.stroke(); g.lineWidth = 1; }
        else if(k==="zz"){ g.fillStyle = `rgba(205,180,240,${1-p})`; g.font = "10px Cubic11, sans-serif"; g.fillText("z", X1 + 8, Y1 - 10 - p*10); g.fillText("Z", X1 + 14, Y1 - 16 - p*12); }
        else { const x = X1 + (X2 - X1)*p, y = Y1 + (Y2 - Y1)*p - Math.sin(p*Math.PI)*10;
          if(k==="yarn"){ g.fillStyle = O; g.fillRect(x - 4, y - 4, 8, 8); g.fillStyle = "#f0708d"; g.fillRect(x - 3, y - 3, 6, 6); }
          else { g.fillStyle = O; g.fillRect(x - 5, y - 4, 10, 8); g.fillStyle = "#d6dbe3"; g.fillRect(x - 4, y - 3, 8, 6); if(p >= 1){ g.fillStyle = "rgba(255,180,80,.6)"; g.beginPath(); g.arc(X2, Y2, 18, 0, Math.PI*2); g.fill(); } } }
        return f.t < .35; });
      if(W.phase==="build" && !G.ended){ g.font = "11px Cubic11, sans-serif"; g.textAlign = "center"; g.fillStyle = "#ffffff"; g.fillText(`下一波：第 ${W.wave+1} 波`, COLS*T/2 + 1, ROWS*T - 8 + 1); g.fillStyle = O; g.fillText(`下一波：第 ${W.wave+1} 波`, COLS*T/2, ROWS*T - 8); }
    }
    function loop(t){
      if(!alive || !G) return;
      const dt = Math.min(.05, (t - G.last)/1000 || 0); G.last = t;
      if(isHost() && !G.ended){ hostStep(dt); if(t - G.sent > 100){ G.sent = t; push(); } }
      else if(!isHost()){ const W = G.W; if(W.phase==="build") W.cd -= dt; for(const m of W.mice){ m.dd = m.dd == null ? m.d : m.dd + (m.d - m.dd)*Math.min(1, dt*10) + MICE[m.k].sp*(m.slow?.5:1)*dt*.6; } }
      try{ draw(); hud(); }catch(e){}
      raf = requestAnimationFrame(loop);
    }

    // ---------- network ----------
    const offBc = ctx.onBroadcast(p=>{
      if(!p || p.g!=="td" || !G || p.run!==G.run) return;
      if(p.k==="req" && isHost() && !G.ended){ const m = apply("b", p); if(m) ctx.broadcast({ g:"td", k:"fb", run:G.run, m }); push(); }
      if(p.k==="fb" && !isHost()) feedback(p.m);
      if(p.k==="w" && !isHost()){ const w = p.W, old = {}; G.W.mice.forEach(m=>old[m.id] = m);
        G.W = { coins:w.coins, lives:w.lives, wave:w.wave, phase:w.phase, cd:w.cd, ver:w.ver, towers:w.towers.map(([x,y,k,lv,by])=>({ x, y, k, lv, by, spent: TOWERS[k].cost + (lv>1 ? upCost(k,1) : 0) + (lv>2 ? upCost(k,2) : 0) })),
                mice:w.mice.map(([id,k,d,hpr,slow])=>({ id, k, d, hpr, slow, dd: old[id] ? old[id].dd : d })) };
        G.fx.push(...(w.shots||[]).map(s=>({ s, t:0 }))); }
      if(p.k==="end" && !isHost()) showEnd(p.won, p.wave);
    });
    this._u = ctx.onState("defense", st=>{
      s = st;
      if(st && st.live && (!G || G.run !== st.run)){ start(); return; }
      if(st && !st.live && G && !G.ended){ stop(); lobby(); return; }
      if(!G) lobby();
    });
    this._p = ctx.onPresence(()=>{ if(!G) lobby(); });
    this._b = offBc;
    this._stop = () => { alive = false; stop(); };
    (async()=>{ const cur = await ctx.getState("defense").catch(()=>null); s = cur ? cur.state : null; lobby(); })();
  },
  unmount(){ if(this._u) this._u(); if(this._p) this._p(); if(this._b) this._b(); if(this._stop) this._stop(); },
});
})();

// 遊戲：喵喵廚房（兩個人各用手機，一起在同一間廚房做菜出餐）
// 一隻貓的手機當「主廚」(players()[0])：負責整間廚房的狀態，另一隻貓把動作傳過去。兩隻貓的位置都即時互傳。
(function(){
const T = 32, COLS = 11, ROWS = 7, ROUND = 180;
const MAP = [
  "CFCCCCCRCMC",
  "C....C....C",
  "B....C....S",
  "B....C....S",
  "C.........C",
  "C.........C",
  "CPPCTOOCCCC",
];
const RECIPES = [
  { id:"sashimi", n:"生魚片", need:["fishC"], life:55, pts:20 },
  { id:"sushi", n:"鮭魚壽司", need:["fishC","riceC"], life:70, pts:30 },
  { id:"milk", n:"熱牛奶", need:["milkC"], life:50, pts:20 },
  { id:"set", n:"貓咪定食", need:["fishC","milkC","riceC"], life:90, pts:45 },
];
const STEP = { fishC:["fish","🔪","切"], riceC:["rice","🔥","煮"], milkC:["milk","🔥","熱"] };
const STATION = { F:"生魚", R:"生米", M:"牛奶", B:"砧板", S:"爐子", P:"盤子", T:"垃圾桶", O:"出餐" };
const IN = { fish:"生魚", fishC:"切好的魚", rice:"生米", riceC:"白飯", milk:"牛奶", milkC:"熱牛奶", burnt:"燒焦的東西", plate:"盤子" };
const O = "#5a3b2e";
const key = (x, y) => x + "," + y;
const tileAt = (x, y) => (MAP[y] && MAP[y][x]) || "C";
const walk = (x, y) => tileAt(x, y) === ".";
const svgImg = svg => { const im = new Image(); im.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg); return im; };

// ---------- pixel art (drawn straight onto the canvas) ----------
const SPR = {
  fish:  [["..OOOO...O",".OKKKKO.OO","OEKWKKKOKO","OKKKKKKOKO",".OKKKKO.OO","..OOOO...O"], { K:"#f59a8a", W:"#fff", E:"#2b1d18" }],
  fishC: [["OOOO.OOOO.","OKWO.OKWO.","OKKO.OKKO.","OOOO.OOOO.",".OOOO.....",".OKWO.....",".OKKO.....",".OOOO....."], { K:"#ff8f7a", W:"#ffd2c8" }],
  rice:  [["..OOOO..",".OWWWWO.","OWWWWWWO","OWYYYYWO","OWYWWYWO","OWWWWWWO","OOOOOOOO"], { W:"#f6efe3", Y:"#c9a46a" }],
  riceC: [["..W.W...",".OOOOOO.","OWWWWWWO","OWWWWWWO","OUUUUUUO",".OUUUUO.","..OOOO.."], { W:"#ffffff", U:"#6fb7e8" }],
  milk:  [["..OO..","..OO..",".OWWO.","OWWWWO","OUUUUO","OWWWWO","OWWWWO","OOOOOO"], { W:"#ffffff", U:"#6fb7e8" }],
  milkC: [[".W..W.","..W..W","OOOOOO.","OWWWWOO","OWWWWO.O","OWWWWOO","OKKKKO.",".OOOO.."], { W:"#fff6e6", K:"#f0708d" }],
  burnt: [["..OOO...",".ODDDO..","ODDGDDO.","ODDDDDDO",".ODDDDO.","..OOOO.."], { D:"#3a3542", G:"#6a6474" }],
};
function blit(g, rows, pal, x, y, s){ for(let j=0;j<rows.length;j++){ const r = rows[j]; for(let i=0;i<r.length;i++){ const c = r[i]==="O" ? O : pal[r[i]]; if(c){ g.fillStyle = c; g.fillRect(x + i*s, y + j*s, s, s); } } } }
const itemUrl = (() => { const c = {}; return (t, w, h) => { const k = t + (w||40); if(c[k]) return c[k]; const cv = document.createElement("canvas"); cv.width = w||40; cv.height = h||40; const g = cv.getContext("2d"); g.imageSmoothingEnabled = false; drawItem(g, typeof t === "string" ? { t } : t, cv.width/2, cv.height/2, Math.min(cv.width, cv.height)*.8); return c[k] = cv.toDataURL(); }; })();
const recipeHtml = (r, esc) => `<span class="ktSteps">${r.need.map(k => `<span class="ktSt"><img src="${itemUrl(STEP[k][0])}"><em>${STEP[k][1]}</em></span>`).join(`<i>＋</i>`)}<i>→</i><span class="ktSt"><img src="${itemUrl({ t:"plate", on:[] })}"><em>🍽</em></span></span>`;
function drawItem(g, it, cx, cy, sz){
  if(!it) return;
  if(it.t==="plate"){ g.fillStyle = O; g.fillRect(cx - sz*.5, cy - sz*.12, sz, sz*.34); g.fillStyle = "#ffffff"; g.fillRect(cx - sz*.46, cy - sz*.1, sz*.92, sz*.26); g.fillStyle = "#e3ddd6"; g.fillRect(cx - sz*.3, cy, sz*.6, sz*.08);
    (it.on||[]).forEach((k,i)=>{ const sp = SPR[k], s = sz/22, w = sp[0][0].length*s; blit(g, sp[0], sp[1], cx - w/2 + (i - ((it.on.length-1)/2))*sz*.32, cy - sz*.42, s); }); return; }
  const sp = SPR[it.t]; if(!sp) return; const s = sz/12, w = sp[0][0].length*s, h = sp[0].length*s; blit(g, sp[0], sp[1], cx - w/2, cy - h/2, s);
}

App.registerGame({
  id: "kitchen",
  name: "喵喵廚房",
  desc: "兩人一起切、煮、裝盤出餐",
  icon: () => Pix.sprite("white","happy"),
  mount(el, ctx){
    const { sprite, esc, SFX } = ctx;
    let s = null, G = null, raf = 0, alive = true;
    const me = () => ctx.me.uid;
    const side = () => ctx.players()[0] === me() ? "a" : "b";
    const isHost = () => side() === "a";
    const partnerOn = () => { const p = ctx.partner(); return p && ctx.isOnline(p.user_id); };

    function lobby(){
      if(G) stop();
      const best = (s && s.best) || 0, last = s && s.last;
      el.innerHTML = `<div class="box ktLobby">
        <div class="ktHero">${sprite(ctx.catOf(ctx.players()[0])||"orange","happy")}<span class="ktPan">${(()=>{ const c = document.createElement("canvas"); c.width = 48; c.height = 32; const g = c.getContext("2d"); drawItem(g, { t:"plate", on:["fishC","riceC"] }, 24, 18, 40); return `<img src="${c.toDataURL()}">`; })()}</span>${sprite(ctx.catOf(ctx.players()[1])||"white","happy")}</div>
        <p class="ktIntro">兩隻貓開了一間小餐館！<br>客人點了菜，要<b>拿食材、切魚、煮飯熱牛奶、裝盤、出餐</b>。<br>一個人忙不過來，要分工合作喔～</p>
        <div class="ktRec">${RECIPES.map(r=>`<div><b>${esc(r.n)}</b>${recipeHtml(r)}<span>${r.need.map(k=>`${esc(IN[STEP[k][0]])}${STEP[k][2]}`).join("、")}，裝盤出餐</span></div>`).join("")}</div>
        <div class="ktHow"><span>🕹 左下搖桿：走路</span><span>✋ 右下大按鈕：拿 / 放 / 裝盤 / 出餐（按鈕會告訴你現在會做什麼）</span><span>🔪 按住「切」：在砧板切魚</span><span>🔥 米和牛奶放上爐子會自己煮，太久會燒焦！</span><span>📋 上面會提示「下一步」</span><span>📱 會變成橫向全螢幕</span></div>
        <div class="cpOn">${ctx.partner() ? (partnerOn() ? `🟢 ${esc(ctx.partner().name)} 在線上，可以開店！` : `⚪ ${esc(ctx.partner().name)} 不在線上，要兩個人一起才能開店`) : "等 ta 加入小窩"}</div>
        <button class="btn ktGo" id="ktGo">🍳 開店！（3 分鐘）</button>
        <div class="k" style="text-align:center">${best ? `最高營業額 ${best} 元` : "還沒有紀錄"}${last ? `・上一次 ${last} 元` : ""}</div></div>`;
      el.querySelector("#ktGo").addEventListener("click", async ()=>{
        if(!partnerOn()){ ctx.toast(`要等 ${esc(ctx.partner() ? ctx.partner().name : "ta")} 也在線上才能開店喔`); SFX.miss(); return; }
        SFX.select(); await ctx.update("kitchen", st=>{ st = st || {}; st.run = Date.now(); st.live = true; return st; });
      });
    }

    // ---------- a round ----------
    let R = null;   // the fullscreen overlay while a round is running
    function start(){
      if(G) stop();
      R = document.createElement("div"); R.className = "ktFull";
      R.innerHTML = `<div class="ktStageL" id="ktStageL">
        <div class="ktTopL"><button class="ktOutB" id="ktOut">🏁 打烊</button><span class="ktTimeL" id="ktTime">3:00</span>
          <div class="ktOrders" id="ktOrders"></div><span class="ktScoreL" id="ktScore">💰 0</span></div>
        <div class="ktHint" id="ktHint"></div>
        <div class="ktMidL">
          <div class="ktJoy" id="ktJoy"><i></i></div>
          <div class="ktStage"><canvas id="ktC" width="${COLS*T*2}" height="${ROWS*T*2}"></canvas><div class="ktMsg hidden" id="ktMsg"></div></div>
          <div class="ktBtns"><button class="ktB grab" id="ktGrab"><span class="ktBi" id="ktGrabI">✋</span><b id="ktGrabL">拿／放</b></button><button class="ktB chop" id="ktChop"><span class="ktBi">🔪</span><b>按住切</b></button></div>
        </div></div>`;
      document.body.appendChild(R);
      const fit = () => { if(!R) return; const st = R.querySelector("#ktStageL"), vw = window.innerWidth, vh = window.innerHeight, portrait = vh > vw, long = portrait ? vh : vw, short = portrait ? vw : vh;
        st.classList.toggle("rot", portrait); st.style.width = long + "px"; st.style.height = short + "px";
        const topH = 64, hintH = 26, avH = short - topH - hintH - 14, avW = long - 2*Math.min(170, long*.2) - 24;
        const h = Math.max(140, Math.min(avH, avW * ROWS / COLS)); const c = R.querySelector("#ktC"); c.style.height = h + "px"; c.style.width = (h * COLS / ROWS) + "px"; };
      fit(); window.addEventListener("resize", fit); R._fit = fit;
      const cv = R.querySelector("#ktC"), g = cv.getContext("2d"); g.imageSmoothingEnabled = false; g.setTransform(2,0,0,2,0,0);
      const ids = ctx.players();
      const cat = (sd, x, y) => ({ x, y, fx:0, fy:1, moving:false, img: { n: svgImg(Pix.sprite(ctx.catOf(ids[sd==="a"?0:1])||"orange","normal")), h: svgImg(Pix.sprite(ctx.catOf(ids[sd==="a"?0:1])||"white","happy")) } });
      G = { run: s.run, g, cv, cats: { a: cat("a", 2.5, 4.5), b: cat("b", 7.5, 4.5) }, joy:{x:0,y:0}, chop:false, last: performance.now(), sent:0, snapT:0, frame:0, ended:false,
            W: { items:{}, held:{ a:null, b:null }, orders:[], score:0, served:0, t:ROUND, next:2, ver:0 } };
      // the host seeds the first order
      if(isHost()) newOrder();
      bindControls();
      let outArm = 0;
      R.querySelector("#ktOut").addEventListener("click", ()=>{ const t = Date.now(); if(t - outArm > 2500){ outArm = t; ctx.toast("再按一次就打烊結算"); return; } SFX.tap(); if(isHost()) finish(); else ctx.update("kitchen", st=>{ if(!st) return undefined; st.live = false; return st; }); });
      raf = requestAnimationFrame(loop);
      if(window.__mock) window.__kt = { G:()=>G, act:(a)=>doAct(a) };   // tests only
    }
    function stop(){ cancelAnimationFrame(raf); if(G && G.keyH){ window.removeEventListener("keydown", G.keyH); window.removeEventListener("keyup", G.keyH); } G = null;
      if(R){ window.removeEventListener("resize", R._fit); R.remove(); R = null; } }
    function bindControls(){
      const joy = R.querySelector("#ktJoy"), knob = joy.querySelector("i"), rotd = () => R && R.querySelector("#ktStageL").classList.contains("rot");
      let jid = null, jc = null;
      const setJ = e => { const r = joy.getBoundingClientRect(), cx = r.left + r.width/2, cy = r.top + r.height/2; let dx = e.clientX - cx, dy = e.clientY - cy;
        if(rotd()){ const t = dx; dx = dy; dy = -t; }   // the stage is turned 90° when the phone is held upright
        const m = Math.hypot(dx, dy), Rr = joy.offsetWidth*.38;
        if(m > Rr){ dx = dx/m*Rr; dy = dy/m*Rr; } knob.style.transform = `translate(${dx}px,${dy}px)`; G.joy = { x: dx/Rr, y: dy/Rr }; };
      joy.addEventListener("pointerdown", e=>{ e.preventDefault(); jid = e.pointerId; try{ joy.setPointerCapture(jid); }catch(_){} setJ(e); });
      joy.addEventListener("pointermove", e=>{ if(e.pointerId===jid) setJ(e); });
      const end = e=>{ if(e.pointerId!==jid) return; jid = null; knob.style.transform = ""; if(G) G.joy = { x:0, y:0 }; };
      joy.addEventListener("pointerup", end); joy.addEventListener("pointercancel", end);
      const grab = R.querySelector("#ktGrab"), chop = R.querySelector("#ktChop");
      grab.addEventListener("pointerdown", e=>{ e.preventDefault(); grab.classList.add("on"); doAct("grab"); });
      ["pointerup","pointercancel","pointerleave"].forEach(ev=>grab.addEventListener(ev, ()=>grab.classList.remove("on")));
      chop.addEventListener("pointerdown", e=>{ e.preventDefault(); try{ chop.setPointerCapture(e.pointerId); }catch(_){} chop.classList.add("on"); if(G) G.chop = true; });
      ["pointerup","pointercancel","lostpointercapture"].forEach(ev=>chop.addEventListener(ev, ()=>{ chop.classList.remove("on"); if(G) G.chop = false; }));
      [grab, chop, joy].forEach(b=>b.addEventListener("contextmenu", e=>e.preventDefault()));
      const keys = {};
      G.keyH = e => { const down = e.type==="keydown";
        if(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(e.key)){ e.preventDefault(); keys[e.key] = down; G.joy = { x:(keys.ArrowRight?1:0)-(keys.ArrowLeft?1:0), y:(keys.ArrowDown?1:0)-(keys.ArrowUp?1:0) }; }
        if(e.key===" " && down && !e.repeat){ e.preventDefault(); doAct("grab"); }
        if(e.key==="x" || e.key==="Control"){ G.chop = down; } };
      window.addEventListener("keydown", G.keyH); window.addEventListener("keyup", G.keyH);
    }
    const facing = c => { const tx = Math.floor(c.x + c.fx*.7), ty = Math.floor(c.y + c.fy*.7); return [tx, ty]; };

    // ---------- world rules (run by the host) ----------
    function newOrder(){
      const W = G.W, el2 = ROUND - W.t, pool = el2 < 30 ? [0,2] : el2 < 70 ? [0,1,2] : [0,1,2,3,1];
      const r = RECIPES[pool[(Math.random()*pool.length)|0]];
      W.orders.push({ r: r.id, t: r.life, max: r.life }); W.ver++;
    }
    function act(sd, a, tx, ty){
      const W = G.W, k = key(tx, ty), tile = tileAt(tx, ty), hold = W.held[sd], it = W.items[k];
      let msg = null;
      if(a==="chop"){ if(tile==="B" && it && it.t==="fish"){ it.p = Math.min(1, (it.p||0) + .06); if(it.p >= 1){ W.items[k] = { t:"fishC" }; } W.ver++; return "chop"; } return null; }
      // grab / place
      if(!hold){
        if(tile==="F"){ W.held[sd] = { t:"fish" }; }
        else if(tile==="R"){ W.held[sd] = { t:"rice" }; }
        else if(tile==="M"){ W.held[sd] = { t:"milk" }; }
        else if(tile==="P"){ W.held[sd] = { t:"plate", on:[] }; }
        else if(it){ const got = Object.assign({}, it); if(tile==="S" && (it.p||0) < 1){ got.p = 0; } if(tile!=="S") delete got.p; else if(got.t!=="rice" && got.t!=="milk") delete got.p; W.held[sd] = got; delete W.items[k]; }
        else return null;
        W.ver++; return "pick";
      }
      // holding something
      if(tile==="T"){ W.held[sd] = hold.t==="plate" ? { t:"plate", on:[] } : null; W.ver++; return "trash"; }
      if(tile==="O"){
        if(hold.t!=="plate" || !hold.on.length) return "nope:要先裝盤才能出餐喔";
        const have = hold.on.slice().sort().join("+"), i = W.orders.findIndex(o=>RECIPES.find(r=>r.id===o.r).need.slice().sort().join("+")===have);
        if(i < 0) return "nope:沒有客人點這個 (・_・;)";
        const o = W.orders.splice(i, 1)[0], r = RECIPES.find(x=>x.id===o.r), pts = r.pts + Math.ceil(o.t/5);
        W.score += pts; W.served++; W.held[sd] = null; W.ver++; W.flash = { t:`+${pts} 元・${r.n}`, at: Date.now() };
        if(W.orders.length < 2) W.next = Math.min(W.next, 3);
        return "serve";
      }
      const cooked = x => x==="fishC" || x==="riceC" || x==="milkC";
      // plate + cooked thing on the counter / board / stove → onto the plate
      if(hold.t==="plate" && it && cooked(it.t)){ if(hold.on.includes(it.t) || hold.on.length >= 3) return "nope:盤子上已經有了"; hold.on.push(it.t); delete W.items[k]; W.ver++; return "plate"; }
      // cooked thing in hand + plate sitting on a counter
      if(cooked(hold.t) && it && it.t==="plate"){ if(it.on.includes(hold.t) || it.on.length >= 3) return "nope:盤子上已經有了"; it.on.push(hold.t); W.held[sd] = null; W.ver++; return "plate"; }
      if(it) return "nope:這裡已經有東西了";
      if(tile==="B"){ if(hold.t!=="fish") return "nope:砧板是用來切魚的"; W.items[k] = { t:"fish", p:0 }; W.held[sd] = null; W.ver++; return "put"; }
      if(tile==="S"){ if(hold.t!=="rice" && hold.t!=="milk") return "nope:爐子是用來煮飯、熱牛奶的"; W.items[k] = { t:hold.t, p:0 }; W.held[sd] = null; W.ver++; return "put"; }
      if(tile==="C" || tile==="F" || tile==="R" || tile==="M"){ if(tile!=="C") return "nope:放到旁邊的桌子上吧"; W.items[k] = Object.assign({}, hold); W.held[sd] = null; W.ver++; return "put"; }
      if(tile==="P"){ return "nope:盤子拿著就好"; }
      return null;
    }
    function feedback(r){
      if(!r) return; if(r==="pick") SFX.tap(); else if(r==="put" || r==="plate") SFX.key(); else if(r==="trash") SFX.del ? SFX.del() : SFX.tap(); else if(r==="serve"){ SFX.coin(); }
      else if(r.startsWith("nope:")){ SFX.miss(); ctx.toast(r.slice(5)); }
    }
    function doAct(a){
      if(!G || G.ended) return;
      const c = G.cats[side()], [tx, ty] = facing(c);
      if(isHost()){ const r = act("a", a, tx, ty); feedback(r); snapshot(); }
      else { ctx.broadcast({ g:"kit", k:"act", run:G.run, a, tx, ty }); }
    }
    function hostTick(dt){
      const W = G.W;
      W.t = Math.max(0, W.t - dt);
      for(const k in W.items){ const it = W.items[k]; const [x, y] = k.split(",").map(Number);
        if(tileAt(x, y)==="S" && it && (it.t==="rice" || it.t==="milk" || it.t==="riceC" || it.t==="milkC")){ it.p = (it.p||0) + dt/6;
          if(it.p >= 1 && (it.t==="rice" || it.t==="milk")){ it.t += "C"; W.ver++; }
          if(it.p >= 2.4){ W.items[k] = { t:"burnt" }; W.ver++; W.flash = { t:"燒焦了！快丟進垃圾桶", at: Date.now(), bad:1 }; } } }
      for(const o of W.orders) o.t -= dt;
      const before = W.orders.length; W.orders = W.orders.filter(o=>o.t > 0); if(W.orders.length < before){ W.score = Math.max(0, W.score - 5); W.ver++; W.flash = { t:"客人等太久走掉了 (´；ω；`)", at: Date.now(), bad:1 }; }
      W.next -= dt; if(W.next <= 0){ if(W.orders.length < 4) newOrder(); W.next = Math.max(9, 17 - (ROUND - W.t)/20); }
      if(W.t <= 0) finish();
    }
    function snapshot(){ if(!G) return; G.snapT = performance.now(); ctx.broadcast({ g:"kit", k:"w", run:G.run, W:G.W }); }
    async function finish(){
      if(!G || G.ended) return; G.ended = true;
      const W = G.W; snapshot(); ctx.broadcast({ g:"kit", k:"end", run:G.run, score:W.score, served:W.served });
      await ctx.update("kitchen", st=>{ st = st || {}; if(st.run!==G.run && G) return undefined; st.live = false; st.last = W.score; st.lastServed = W.served; if(!st.best || W.score > st.best) st.best = W.score; return st; });
    }
    function showEnd(score, served){
      const m = R && R.querySelector("#ktMsg"); if(!m) return; m.classList.remove("hidden");
      m.innerHTML = `<b>打烊囉！</b><p class="ktBig">💰 ${score} 元</p><p>出了 ${served} 道菜${s && s.best && score >= s.best ? "・🎉 新紀錄！" : ""}</p><button class="btn" id="ktAgain">再開一次店</button><button class="btn sub" id="ktHome">回大廳</button>`;
      SFX.match(); ctx.burst();
      R.querySelector("#ktAgain").addEventListener("click", async ()=>{ if(!partnerOn()){ ctx.toast("對方不在線上了"); return; } await ctx.update("kitchen", st=>{ st = st || {}; st.run = Date.now(); st.live = true; return st; }); });
      R.querySelector("#ktHome").addEventListener("click", ()=>{ stop(); lobby(); });
    }

    // ---------- movement ----------
    function moveMe(dt){
      const c = G.cats[side()], j = G.joy, m = Math.hypot(j.x, j.y);
      c.moving = m > .2;
      if(!c.moving) return;
      const sp = 4.2 * Math.min(1, m), vx = j.x/m*sp, vy = j.y/m*sp;
      if(Math.abs(j.x) > Math.abs(j.y)){ c.fx = Math.sign(j.x); c.fy = 0; } else { c.fx = 0; c.fy = Math.sign(j.y); }
      const R = .3, free = (x, y) => walk(Math.floor(x - R), Math.floor(y - R)) && walk(Math.floor(x + R), Math.floor(y - R)) && walk(Math.floor(x - R), Math.floor(y + R)) && walk(Math.floor(x + R), Math.floor(y + R));
      const nx = c.x + vx*dt; if(free(nx, c.y)) c.x = nx;
      const ny = c.y + vy*dt; if(free(c.x, ny)) c.y = ny;
    }

    // ---------- drawing ----------
    function drawTile(g, x, y, ch){
      const X = x*T, Y = y*T;
      if(ch==="."){ g.fillStyle = (x+y)%2 ? "#f3e4c8" : "#ead8b8"; g.fillRect(X, Y, T, T); return; }
      // every station sits on a wooden counter
      g.fillStyle = O; g.fillRect(X, Y, T, T); g.fillStyle = "#d9a066"; g.fillRect(X+1, Y+1, T-2, T-2); g.fillStyle = "#e9b878"; g.fillRect(X+1, Y+1, T-2, 6); g.fillStyle = "#b07d45"; g.fillRect(X+1, Y+T-5, T-2, 4);
      const mid = (it) => drawItem(g, it, X + T/2, Y + T/2 + 1, 24);
      if(ch==="F"||ch==="R"||ch==="M"){ g.fillStyle = O; g.fillRect(X+3, Y+5, T-6, T-9); g.fillStyle = "#b07d45"; g.fillRect(X+4, Y+6, T-8, T-11); mid({ t: ch==="F" ? "fish" : ch==="R" ? "rice" : "milk" }); }
      if(ch==="B"){ g.fillStyle = O; g.fillRect(X+3, Y+6, T-6, T-11); g.fillStyle = "#f3d9a8"; g.fillRect(X+4, Y+7, T-8, T-13); g.fillStyle = "#8a8aa0"; g.fillRect(X+T-10, Y+4, 3, 10); g.fillStyle = O; g.fillRect(X+T-10, Y+14, 3, 5); }
      if(ch==="S"){ g.fillStyle = O; g.fillRect(X+2, Y+3, T-4, T-6); g.fillStyle = "#4a4552"; g.fillRect(X+3, Y+4, T-6, T-8); const it = G.W.items[key(x,y)];
        if(it && (it.t==="rice"||it.t==="milk"||it.t==="riceC"||it.t==="milkC")){ const f = Math.floor(G.frame*10)%2; g.fillStyle = f ? "#ff7a3a" : "#ffcf4a"; g.fillRect(X+8, Y+T-9, 4, 3); g.fillRect(X+15, Y+T-10, 4, 4); g.fillRect(X+22, Y+T-9, 3, 3); }
        g.fillStyle = O; g.fillRect(X+6, Y+8, T-12, T-17); g.fillStyle = "#8a8aa0"; g.fillRect(X+7, Y+9, T-14, T-19); }
      if(ch==="P"){ for(let i=0;i<3;i++){ g.fillStyle = O; g.fillRect(X+5, Y+18 - i*4, T-10, 4); g.fillStyle = "#ffffff"; g.fillRect(X+6, Y+19 - i*4, T-12, 2); } }
      if(ch==="T"){ g.fillStyle = O; g.fillRect(X+7, Y+6, T-14, T-10); g.fillStyle = "#8a9aa8"; g.fillRect(X+8, Y+7, T-16, T-12); g.fillStyle = O; g.fillRect(X+5, Y+5, T-10, 3); g.fillRect(X+13, Y+2, 6, 3); }
      if(ch==="O"){ g.fillStyle = "#f0708d"; g.fillRect(X+1, Y+1, T-2, 8); g.fillStyle = "#ffffff"; for(let i=0;i<4;i++) g.fillRect(X+3 + i*8, Y+3, 4, 4); g.fillStyle = "#ffcf4a"; g.fillRect(X+12, Y+14, 8, 6); g.fillStyle = O; g.fillRect(X+15, Y+12, 2, 2); }
      if(STATION[ch]){ g.font = "7px Cubic11, sans-serif"; g.textAlign = "center"; const tw = g.measureText(STATION[ch]).width + 4;
        g.fillStyle = ch==="O" ? "#e5486a" : "rgba(90,59,46,.82)"; g.fillRect(X + T/2 - tw/2, Y + T - 9, tw, 9); g.fillStyle = "#fff"; g.fillText(STATION[ch], X + T/2, Y + T - 2); }
      const it = G.W.items[key(x,y)];
      if(it){ drawItem(g, it, X + T/2, Y + T/2 - 2, ch==="S" ? 22 : 26);
        if(it.p != null && (ch==="B" || ch==="S")){ const p = Math.min(1, it.p), burnWarn = ch==="S" && it.p > 1.5;
          g.fillStyle = O; g.fillRect(X+3, Y-5, T-6, 6); g.fillStyle = "#fff"; g.fillRect(X+4, Y-4, T-8, 4);
          g.fillStyle = burnWarn ? "#e5486a" : p >= 1 ? "#5cb87a" : "#ffcf4a"; g.fillRect(X+4, Y-4, (T-8)*(burnWarn ? Math.min(1,(it.p-1.5)/.9) : p), 4);
          if(burnWarn && Math.floor(G.frame*6)%2){ g.fillStyle = "#e5486a"; g.font = "bold 14px Cubic11, sans-serif"; g.textAlign = "center"; g.fillText("!", X + T/2, Y - 7); } } }
    }
    function drawCat(g, sd){
      const c = G.cats[sd], im = c.moving ? c.img.h : c.img.n, sz = T*1.25, hop = c.moving ? Math.abs(Math.sin(G.frame*14))*2 : 0;
      const cx = c.x*T, cy = c.y*T;
      g.fillStyle = "rgba(90,59,46,.2)"; g.fillRect(cx - 10, cy + 10, 20, 4);
      g.save(); g.translate(cx, cy - hop); if(c.fx < 0) g.scale(-1, 1); if(im.complete) g.drawImage(im, -sz/2, -sz/2 - 6, sz, sz); g.restore();
      const h = G.W.held[sd]; if(h){ const by = cy - sz*.62 - hop; g.fillStyle = "#fff"; g.strokeStyle = O; g.lineWidth = 1.5; g.beginPath(); g.ellipse(cx, by, 15, 12, 0, 0, Math.PI*2); g.fill(); g.stroke(); drawItem(g, h, cx, by, 22); }
      // a little arrow showing which tile you're facing
      if(sd===side()){ const [tx, ty] = facing(c); const pulse = .55 + .45*Math.abs(Math.sin(G.frame*5)); g.strokeStyle = `rgba(240,112,141,${pulse})`; g.lineWidth = 3; g.strokeRect(tx*T + 1.5, ty*T + 1.5, T - 3, T - 3); }
      if(sd!==side()){ g.font = "9px Cubic11, sans-serif"; g.textAlign = "center"; g.fillStyle = "#5a3b2e"; g.fillText(ctx.nameOf(ctx.players()[sd==="a"?0:1])||"", cx, cy + 22); }
    }
    function draw(){
      const g = G.g; G.frame += 1/60;
      for(let y=0;y<ROWS;y++) for(let x=0;x<COLS;x++) drawTile(g, x, y, tileAt(x, y));
      const order = ["a","b"].sort((p,q)=>G.cats[p].y - G.cats[q].y); order.forEach(sd=>drawCat(g, sd));
      const f = G.W.flash; if(f && Date.now() - f.at < 1600){ g.font = "12px Cubic11, sans-serif"; g.textAlign = "center"; const y = ROWS*T/2 - (Date.now()-f.at)/80; g.fillStyle = "#ffffff"; g.fillText(f.t, COLS*T/2 + 1, y + 1); g.fillStyle = f.bad ? "#e5486a" : "#3a8a55"; g.fillText(f.t, COLS*T/2, y); }
    }
    // what the big button would do right now (same rules as act(), without changing anything)
    function preview(sd, tx, ty){
      const W = G.W, tile = tileAt(tx, ty), hold = W.held[sd], it = W.items[key(tx, ty)], cooked = x => x==="fishC" || x==="riceC" || x==="milkC";
      if(!hold){
        if(tile==="F") return ["🐟","拿生魚"]; if(tile==="R") return ["🍚","拿生米"]; if(tile==="M") return ["🥛","拿牛奶"]; if(tile==="P") return ["🍽","拿盤子"];
        if(it) return ["✋", "拿起" + (it.t==="plate" ? "盤子" : IN[it.t])]; return ["✋", "拿／放", true]; }
      if(tile==="T") return ["🗑","丟掉"];
      if(tile==="O") return hold.t==="plate" && hold.on.length ? ["🔔","出餐！"] : ["🔔","要先裝盤", true];
      if(hold.t==="plate" && it && cooked(it.t)) return ["🍽","裝到盤子"];
      if(cooked(hold.t) && it && it.t==="plate") return ["🍽","放上盤子"];
      if(it) return ["✋","這裡有東西了", true];
      if(tile==="B") return hold.t==="fish" ? ["🔪","放上砧板"] : ["✋","只能放魚", true];
      if(tile==="S") return hold.t==="rice" || hold.t==="milk" ? ["🔥","放上爐子"] : ["✋","只能煮米、牛奶", true];
      if(tile==="C") return ["⬇","放下"];
      return ["✋","放到桌上吧", true];
    }
    // the "next step" tip for the oldest order
    function hint(){
      const W = G.W, o = W.orders[0]; if(!o) return "等客人點菜中… 可以先切魚、煮飯備料 🐾";
      const r = RECIPES.find(x=>x.id===o.r), held = Object.values(W.held).filter(Boolean), items = Object.entries(W.items).map(([k, v]) => [k, v]);
      const all = held.concat(items.map(x=>x[1]));
      const plates = all.filter(x=>x.t==="plate"), want = r.need.slice().sort().join("+");
      if(plates.some(p2 => p2.on.slice().sort().join("+") === want)) return `「${r.n}」裝好了！拿去下面的「出餐」台 🔔`;
      for(const k of r.need){
        const onPlate = plates.some(p2 => p2.on.includes(k)); if(onPlate) continue;
        const raw = STEP[k][0];
        if(all.some(x=>x.t===k)) continue;
        if(raw==="fish"){ const onBoard = items.find(([kk, v]) => v.t==="fish" && tileAt(...kk.split(",").map(Number))==="B"); if(onBoard) return "砧板上有魚 → 面對砧板，按住「🔪 切」"; return held.some(x=>x.t==="fish") ? "把魚放到砧板上（左邊的木板）" : "去上面的魚箱拿生魚 🐟"; }
        const onStove = items.find(([kk, v]) => v.t===raw && tileAt(...kk.split(",").map(Number))==="S"); if(onStove) return `${IN[raw]}在爐子上煮了，等它變好（綠色條滿）`;
        return held.some(x=>x.t===raw) ? `把${IN[raw]}放到右邊的爐子上 🔥` : `去上面拿${IN[raw]}`;
      }
      return `材料都好了！拿盤子把「${r.n}」裝起來 🍽`;
    }
    function hud(){
      const W = G.W, t = Math.ceil(W.t);
      const te = R.querySelector("#ktTime"); if(te){ te.textContent = `⏱ ${Math.floor(t/60)}:${String(t%60).padStart(2,"0")}`; te.classList.toggle("low", t <= 20); }
      const sc = R.querySelector("#ktScore"); if(sc) sc.textContent = `💰 ${W.score}`;
      const c = G.cats[side()], [tx, ty] = facing(c), pv = preview(side(), tx, ty);
      const gl = R.querySelector("#ktGrabL"), gi = R.querySelector("#ktGrabI"), gb = R.querySelector("#ktGrab");
      if(gl && gl.textContent !== pv[1]){ gl.textContent = pv[1]; gi.textContent = pv[0]; }
      if(gb) gb.classList.toggle("dim", !!pv[2]);
      const it = W.items[key(tx, ty)], cb = R.querySelector("#ktChop"); if(cb) cb.classList.toggle("ready", tileAt(tx, ty)==="B" && !!it && it.t==="fish");
      const hn = R.querySelector("#ktHint"), ht = "📋 下一步：" + hint(); if(hn && hn.textContent !== ht) hn.textContent = ht;
      const oe = R.querySelector("#ktOrders"); if(!oe) return;
      const sig = W.orders.map(o=>o.r).join(",");
      if(oe.dataset.sig !== sig){ oe.dataset.sig = sig; oe.innerHTML = W.orders.map((o, i)=>{ const r = RECIPES.find(x=>x.id===o.r);
        return `<div class="ktOrd ${i===0?"first":""}"><div class="ktOrdH"><img src="${itemUrl({ t:"plate", on:r.need }, 56, 34)}"><b>${esc(r.n)}</b></div>${recipeHtml(r)}<i><u></u></i></div>`; }).join("") || `<div class="ktNo">等客人點菜中…</div>`; }
      oe.querySelectorAll(".ktOrd u").forEach((u,i)=>{ const o = W.orders[i]; if(o){ const p = Math.max(0, o.t/o.max); u.style.width = (p*100)+"%"; u.style.background = p < .3 ? "#e5486a" : p < .6 ? "#ffcf4a" : "#5cb87a"; u.parentNode.parentNode.classList.toggle("hurry", p < .3); } });
    }
    function loop(t){
      if(!alive || !G) return;
      const dt = Math.min(.05, (t - G.last)/1000 || 0); G.last = t;
      if(!G.ended){
        moveMe(dt);
        if(G.chop){ G.chopT = (G.chopT||0) - dt; if(G.chopT <= 0){ G.chopT = .1; const c = G.cats[side()], [tx, ty] = facing(c);
          if(tileAt(tx, ty)==="B"){ if(isHost()){ const r = act("a", "chop", tx, ty); if(r) SFX.key(); } else { SFX.key(); ctx.broadcast({ g:"kit", k:"act", run:G.run, a:"chop", tx, ty }); } } } }
        if(isHost()){ hostTick(dt); if(t - G.snapT > 220) snapshot(); }
        else G.W.t = Math.max(0, G.W.t - dt);
      }
      // other cat follows its last reported position
      const o = G.cats[side()==="a" ? "b" : "a"]; if(o.tx != null){ const k = Math.min(1, dt*14); o.x += (o.tx - o.x)*k; o.y += (o.ty - o.y)*k; }
      if(t - G.sent > 80){ G.sent = t; const c = G.cats[side()]; ctx.broadcast({ g:"kit", k:"p", run:G.run, x:+c.x.toFixed(2), y:+c.y.toFixed(2), fx:c.fx, fy:c.fy, m:c.moving?1:0 }); }
      try{ draw(); hud(); }catch(e){}
      raf = requestAnimationFrame(loop);
    }

    // ---------- network ----------
    const offBc = ctx.onBroadcast(p=>{
      if(!p || p.g!=="kit" || !G || p.run!==G.run) return;
      const other = side()==="a" ? "b" : "a";
      if(p.k==="p"){ const c = G.cats[other]; c.tx = p.x; c.ty = p.y; c.fx = p.fx; c.fy = p.fy; c.moving = !!p.m; }
      if(p.k==="act" && isHost() && !G.ended){ const r = act("b", p.a, p.tx, p.ty); if(r && r!=="chop") ctx.broadcast({ g:"kit", k:"fb", run:G.run, r }); snapshot(); }
      if(p.k==="fb" && !isHost()) feedback(p.r);
      if(p.k==="w" && !isHost()){ const before = G.W.score; G.W = p.W; if(p.W.score > before) SFX.coin(); }
      if(p.k==="end" && !isHost()){ G.ended = true; G.W.score = p.score; showEnd(p.score, p.served); }
    });
    this._u = ctx.onState("kitchen", st=>{
      const prev = s; s = st;
      if(st && st.live && (!G || G.run !== st.run)){ start(); return; }
      if(st && !st.live && G && !G.ended && isHost()){ finish(); }
      if(st && !st.live && G && G.ended && isHost()){ showEnd(G.W.score, G.W.served); return; }
      if(st && !st.live && G && !isHost() && !G.ended){ G.ended = true; showEnd(st.last||0, st.lastServed||0); return; }
      if(!G) lobby();
    });
    this._p = ctx.onPresence(()=>{ if(!G) lobby(); });
    this._b = offBc;
    this._stop = () => { alive = false; stop(); };
    (async()=>{ const cur = await ctx.getState("kitchen").catch(()=>null); s = cur ? cur.state : null; lobby(); })();
  },
  unmount(){ if(this._u) this._u(); if(this._p) this._p(); if(this._b) this._b(); if(this._stop) this._stop(); },
});
})();

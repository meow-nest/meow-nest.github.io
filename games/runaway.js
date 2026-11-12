// 遊戲：喵喵大逃亡（三條跑道的 3D 無限跑酷）
// 偷吃了狗狗的零食，被可愛的狗狗追！左右滑換跑道、到路口往箭頭方向滑轉彎、上滑跳、下滑滑過去。撿到的小魚乾每 2 條換 1 個貓幣（養貓用）
(function(){
const RW = 240, RH = 426;                 // low-res pixel canvas, scaled up crisp
const HOR = 160, F = 400, CAMH = 1.6, CATZ = 3.2;
const LW = 0.55, HALF = 0.86;             // lane width, road half width
const laneX = l => (l-1)*LW;
const O = "#5a3b2e";
const SP = {"BACK": ["....O..............O....", "...OYO............OYO...", "...OPYO..........OYPO...", "..OPPYYOOOOOOOOOOYYPPO..", "..OYYYYYLLLLLLLLYYYYYO..", ".OYYYYYSYYYSSYYYSYYYYYO.", ".OYYYYYYSYYSSYYSYYYYYYO.", ".OYYYYYYYYYYYYYYYYYYYYO.", ".ODYYYYYYYYYYYYYYYYYYDO.", "..ODDYYYYYYYYYYYYYYDDO..", "...OODYYYYYYYYYYYYDOO...", "....OYYYYYYYYYYYYYYO....", "...OYYYSYYYYYYYYSYYYO...", "..OYYYYYSYYYYYYSYYYYYO..", "..OYYYYYYSYYYYSYYYYYYO..", "..ODYYYYYYYYYYYYYYYYDO..", "..ODYYYYYYYYYYYYYYYYDO..", "..ODDYYYYYYYYYYYYYYDDO..", "...ODDDYYYYYYYYYYDDDO...", "....OOOOOOOOOOOOOOOO...."], "LEGA": [".....OWWWO.....OO.......", ".....OOOOO.............."], "LEGB": [".......OO.....OWWWO.....", "..............OOOOO....."], "LEGJ": [".....OWWO......OWWO.....", ".....OOOO......OOOO....."], "TAIL": ["..OO..", ".OYYO.", ".OYYO.", "..OYYO", "..OYYO", "..OYYO", ".OYYO.", ".OYSO.", "OYYO..", "OYYO..", "OYSO..", "OYYO.."], "DOG": ["....OOOO..........OOOO....", "...OBBBBOOOOOOOOOOBBBBO...", "..OBBBBOYYYYYYYYYYOBBBBO..", "..OBBBOYYYYYYYYYYYYOBBBO..", "..OBBOYYLLYYYYYYLLYYOBBO..", "..OBBOYYEEYYYYYYEEYYOBBO..", "..OBBOYYEHYYYYYYEHYYOBBO..", "...OOYYYYYYWWWWYYYYYYOO...", "....OYYCYYWWNNWWYYCYYO....", "....OYYYYWWWNNWWWYYYYO....", "....OYYYWWWWWWWWWWYYYO....", ".....OYYWWWWOOWWWWYYO.....", "......OYWWWOKKOWWWYO......", ".......OOWWWKKWWWOO.......", ".........OOOKKOOO.........", "......OORRRRRRRRRROO......", ".....OYYYYYYGGYYYYYYO.....", "....OYYYYYYYGGYYYYYYYO....", "....OYWWYYYYYYYYYYWWYO....", "....OWWWOYYYYYYYYOWWWO....", "....OOOOO........OOOOO...."], "BOX": ["OOOOOOOOOOOOOOOOOOOOOO", "OHHHHHHHHHTTHHHHHHHHHO", "OHHHHHHHHHTTHHHHHHHHHO", "OOOOOOOOOOTTOOOOOOOOOO", "OYYYYYYYYYTTYYYYYYYYDO", "OYYYYYYYYYTTYYYYYYYYDO", "OYYYYYYYYYTTYYKKYKKYDO", "OYYYYYYYYYTTYYKKKKKYDO", "OYYYYYYYYYTTYYYKKKYYDO", "OYYYYYYYYYTTYYYYKYYYDO", "OYYYYYYYYYTTYYYYYYYYDO", "OYYYYYYYYYTTYYYYYYYYDO", "OYYYYYYYYYTTYYYYYYYYDO", "ODDDDDDDDDDDDDDDDDDDDO", "OOOOOOOOOOOOOOOOOOOOOO"], "YARN": ["...OOOO...", ".OOAAAAOO.", ".OAWAABAO.", "OAWAABAABO", "OABAABAAAO", "OAABAAABAO", "OABAAABAAO", ".OAABAABO.", ".OOAAAAOO.", "...OOOO.OO"], "SHIRT": ["OOO...OOO", "OAAOOOAAO", "OAAAAAAAO", ".OOAKAOO.", ".OAKKKAO.", ".OAAKAAO.", ".OAAAAAO.", ".OOOOOOO."], "SOCK": ["OOOO.", "OWWO.", "OAAO.", "OAAO.", "OAAOO", "OAAAO", ".OOOO"], "FISH": ["..OOOO...O", ".OYYYYO.OO", "OEYHYYYOYO", "OYYYYYYOYO", ".OYYYYO.OO", "..OOOO...O"], "TREE": ["......OOOOOO......", "....OOGGGGGGOO....", "...OGGLLGGGGGGO...", "..OGGLLGGGGGGGGO..", ".OGGGGGGGGGGDGGGO.", ".OGGGGGGGGGGGGGGO.", "OGGGKGGGGGGGGGDGGO", "OGGGGGGGGDGGGGGGGO", "OGDGGGGGGGGGKGGGGO", ".OGGGGGGGGGGGGGDO.", ".OGGGDGGGGGGGGGGO.", "..OGGGGGGGDGGGGO..", "...OOGGGGGGGGOO...", ".....OOOTTOOO.....", ".......OTTO.......", ".......OTTO.......", ".......OTTO.......", "......OTTTTO......", "......OOOOOO......"], "BUSH": ["...OOOOOO...", ".OOGGKGGGOO.", "OGGLGGGGYGGO", "OGGGGGKGGGGO", "OGYGGGGGGLGO", ".OOOOOOOOOO."], "FLOWER": [".O.O.", "OKOKO", ".OYO.", "OKOKO", ".OGO.", "..G..", "..G.."], "POST": [".O.", "OWO", "OWO", "OWO", "OWO", "OWO", "OOO"], "ARROW": ["....O.....", "...OKO....", "..OKKOOOOO", ".OKKKKKKKO", "OKKKKKKKKO", ".OKKKKKKKO", "..OKKOOOOO", "...OKO....", "....O....."]};
const VAC = SP.DOG;
const VPAL = { O, Y:"#f5e2c4", B:"#b0784a", W:"#ffffff", E:"#2b1d18", H:"#ffffff", N:"#2b1d18", K:"#f0708d", R:"#e5486a", G:"#ffcf4a", L:"#fff6e6", C:"#f7b0bb" };  // 追在後面的狗狗
const FOG = [226,242,240];
const hex = h => [1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
const mix = (h, t, a) => { const c = hex(h); return `rgb(${c.map((v,i)=>Math.round(v+(t[i]-v)*a)).join(",")})`; };
const lighten = (h, a) => mix(h, [255,255,255], a);
// fog-tinted colour lookup (no string building inside the per-row loop)
const fogTab = {};
const fogc = (h, a) => { let t = fogTab[h]; if(!t){ t = fogTab[h] = []; for(let i=0;i<=16;i++) t.push(mix(h, FOG, i/16)); } return t[Math.max(0, Math.min(16, Math.round(a*16)))]; };
// pre-rendered sprite canvases
const sprCache = {};
function spr(name, rows, pal){
  const k = name + JSON.stringify(pal); if(sprCache[k]) return sprCache[k];
  const c = document.createElement("canvas"); c.width = rows[0].length; c.height = rows.length; const x = c.getContext("2d");
  rows.forEach((r,j)=>[...r].forEach((ch,i)=>{ const col = pal[ch]; if(col){ x.fillStyle = col; x.fillRect(i,j,1,1); } }));
  return sprCache[k] = c;
}
const mirror = rows => rows.map(r=>[...r].reverse().join(""));
const pr = (x, y, z) => [RW/2 + x*F/z, HOR + (CAMH - y)*F/z];   // world → screen
// a sprite standing on the ground at world (x, y, z), w = world width
function bill(g, c, x, y, z, w){ const k = F/z, pw = w*k, ph = pw*c.height/c.width, [sx, sy] = pr(x, y, z); g.drawImage(c, Math.round(sx - pw/2), Math.round(sy - ph), Math.round(pw), Math.round(ph)); return [sx, sy, pw, ph]; }
function shadow(g, x, z, w, a){ const [sx, sy] = pr(x, 0, z), pw = w*F/z; g.fillStyle = `rgba(70,50,40,${a||.22})`; g.fillRect(Math.round(sx - pw/2), Math.round(sy - Math.max(1,pw*.08)), Math.round(pw), Math.max(1, Math.round(pw*.12))); }
// far scenery, generated once
const MTN = [...Array(RW*2)].map((_,x)=> 26 + Math.sin(x*.031)*12 + Math.sin(x*.083+1)*6 + Math.sin(x*.17)*2);
const HILL = [...Array(RW*2)].map((_,x)=> 12 + Math.sin(x*.05+2)*5 + Math.sin(x*.12)*3);

// ---------- one run ----------
function play(opts){
  return new Promise(resolve=>{
    const SFX = opts.sfx || {}; const snd = (k, ...a) => { try{ SFX[k] && SFX[k](...a); }catch(e){} };
    const base = Pix.palOf(opts.color || "orange");
    const cpal = Object.assign({}, base, { O: base.O, L: lighten(base.Y, .35), W: base.W || "#ffffff" });
    const fishI = spr("fish", SP.FISH, { O, Y:"#f2a65a", H:"#fff3d6", E:"#2b1d18" }), goldI = spr("gold", SP.FISH, { O, Y:"#ffcf4a", H:"#fffbe0", E:"#2b1d18" });
    const boxI = spr("box", SP.BOX, { O, Y:"#e0a96b", H:"#f0c48c", T:"#f6e3b8", D:"#b9824a", K:"#f0708d" });
    const YC = [["#f0708d","#c94a68"],["#9b6fd6","#6e48a8"],["#6fb7e8","#3f86bd"],["#ffcf4a","#d9a520"],["#5cb87a","#3a8a55"]];
    const yarnI = YC.map(([a,b],i)=>spr("yarn"+i, SP.YARN, { O, A:a, B:b, W:"#ffffff" }));
    const CL = ["#f0708d","#6fb7e8","#ffcf4a","#5cb87a","#cdb4f0","#ffffff"];
    const shirtI = CL.map((c,i)=>spr("sh"+i, SP.SHIRT, { O, A:c, K: c==="#f0708d" ? "#ffffff" : "#f0708d" })), sockI = CL.map((c,i)=>spr("so"+i, SP.SOCK, { O, A:c, W:"#ffffff" }));
    const treeI = [spr("tree", SP.TREE, { O, G:"#5cb87a", L:"#8fd89a", D:"#3f9a5a", K:"#f7a7b8", T:"#a0703c" }), spr("sakura", SP.TREE, { O, G:"#f7b6c8", L:"#ffe1ea", D:"#e889a5", K:"#ffffff", T:"#8a5a3e" })];
    const bushI = spr("bush", SP.BUSH, { O, G:"#5cb87a", L:"#8fd89a", K:"#f0708d", Y:"#ffd36b" });
    const flowerI = ["#f0708d","#cdb4f0","#6fb7e8"].map((k,i)=>spr("fl"+i, SP.FLOWER, { O, K:k, Y:"#ffd36b", G:"#5cb87a" }));
    const postI = spr("post", SP.POST, { O, W:"#ffffff" });
    const arrowL = [spr("arL", SP.ARROW, { O, K:"#e5486a" }), spr("arL2", SP.ARROW, { O, K:"#ffffff" })], arrowR = [spr("arR", mirror(SP.ARROW), { O, K:"#e5486a" }), spr("arR2", mirror(SP.ARROW), { O, K:"#ffffff" })];
    const dogI = spr("dog", VAC, VPAL);
    const catI = ["LEGA","LEGB","LEGJ"].map(l=>spr("cat"+l+opts.color, SP.BACK.concat(SP[l]), cpal));
    const slideI = spr("catS"+opts.color, SP.BACK.filter((_,i)=>i<4 || i%2===0), cpal);
    const tailI = [spr("tail"+opts.color, SP.TAIL, cpal), spr("tail2"+opts.color, mirror(SP.TAIL), cpal)];

    const ov = document.createElement("div"); ov.className = "raGame";
    ov.innerHTML = `<div class="raBox"><div class="raHud"><span class="raPill" id="raD">0 m</span><span class="raPill" id="raF"><i>${fishSvg()}</i><b>0</b></span><button id="raX">✕</button></div>
      <canvas id="raC"></canvas><div class="raMsg hidden" id="raM"></div><div class="raTip" id="raTip">左右滑：換跑道・上滑：跳・下滑：滑過去<br>看到箭頭的路口：往箭頭方向滑就會轉彎</div></div>`;
    document.body.appendChild(ov);
    const cv = ov.querySelector("#raC"), out = cv.getContext("2d"), $ = q => ov.querySelector(q);
    const lc = document.createElement("canvas"); lc.width = RW; lc.height = RH; const g = lc.getContext("2d"); g.imageSmoothingEnabled = false;
    let raf = 0, last = 0, done = false, R = null;

    function newSeg(first){
      const len = 70 + Math.random()*60 + (first ? 30 : 0), lvl = R ? Math.min(1, R.t/90) : 0;
      const dirs = Math.random() < .3 ? "LR" : Math.random() < .5 ? "L" : "R";
      const obs = [], fish = [], deco = [];
      let p = first ? 22 : 12;
      while(p < len - 10){
        const t = Math.random(), lane = (Math.random()*3)|0;
        if(t < .30) obs.push({ k:"box", p, lanes:[lane] });
        else if(t < .42){ const free = (Math.random()*3)|0; obs.push({ k:"box", p, lanes:[0,1,2].filter(l=>l!==free) }); }
        else if(t < .60){ obs.push({ k:"yarn", p, lanes:[0,1,2], c:(Math.random()*5)|0 }); for(let i=-2;i<=2;i++) fish.push({ p:p+i*.7, lane, h:.22 + (.62-.12*i*i) * .9 }); }
        else if(t < .76) obs.push({ k:"bar", p, lanes:[0,1,2], c:(Math.random()*6)|0 });
        else if(t < .88) obs.push({ k:"puddle", p, lanes:[0,1,2] });
        else { for(let i=0;i<6;i++) fish.push({ p:p+i*.8, lane, h:.2 }); p += 3; }
        if(Math.random() < .5 && obs.length && obs[obs.length-1].k==="box"){ const ol = [0,1,2].find(l=>!obs[obs.length-1].lanes.includes(l)); if(ol!=null) for(let i=1;i<=4;i++) fish.push({ p:p-5+i*.8, lane:ol, h:.2 }); }
        if(Math.random() < .06) fish.push({ p:p+3, lane:(Math.random()*3)|0, h:.25, gold:1 });
        p += Math.max(5.2, 9.5 - lvl*3.5) + Math.random()*4;
      }
      const theme = Math.random() < .35 ? 1 : 0;   // some stretches are cherry-blossom lanes
      for(let q=1; q<len+8; q += 2 + Math.random()*2.6){ const r = Math.random();
        deco.push({ p:q, side: Math.random()<.5?-1:1, k: r<.5 ? "tree" : r<.75 ? "bush" : "flower", off: .55 + Math.random()*1.1, t: theme && r<.5 ? 1 : 0, c:(Math.random()*3)|0 }); }
      for(let q=.8; q<len; q += 1.6){ deco.push({ p:q, side:-1, k:"post" }); deco.push({ p:q, side:1, k:"post" }); }
      return { len, dirs, obs, fish, deco };
    }
    function reset(){
      R = { t:0, pos:0, v:7, dist:0, fish:0, gold:0, lane:1, lx:1, jump:0, slide:0, seg:null, dead:false, deadT:0, turnT:1, turnDir:0, chase:1, frame:0, msg:"", parts:[], dustT:0, shake:0 };
      R.seg = newSeg(true);
    }
    function size(){ const r = cv.getBoundingClientRect();
      const w = r.width || ov.clientWidth || window.innerWidth, h = r.height || ov.clientHeight || window.innerHeight;
      cv.width = Math.max(1, Math.round(w)); cv.height = Math.max(1, Math.round(h)); out.imageSmoothingEnabled = false; }

    // ---------- controls ----------
    let sx = 0, sy = 0, swiped = true;
    function input(dir){
      if(!R || R.dead) return;
      const cp = R.pos + CATZ, nearCorner = cp > R.seg.len - 4.5 && cp < R.seg.len + 1.7;
      if((dir==="L" || dir==="R") && nearCorner && R.seg.dirs.includes(dir)){ turn(dir); return; }
      if(dir==="L" && R.lane > 0){ R.lane--; snd("key", .9); }
      else if(dir==="R" && R.lane < 2){ R.lane++; snd("key", .9); }
      else if(dir==="U" && R.jump <= 0){ R.jump = 1e-6; R.slide = 0; snd("jump"); puff(6); }
      else if(dir==="D"){ R.slide = 1e-6; if(R.jump > 0) R.jump = Math.max(R.jump, .8); snd("tap"); puff(4); }
    }
    function turn(dir){
      const cp = R.pos + CATZ, over = cp - R.seg.len;
      R.seg = newSeg(false); R.pos = Math.max(0, over) + .85 - CATZ; R.turnT = 0; R.turnDir = dir==="L" ? -1 : 1; snd("select");
    }
    cv.addEventListener("pointerdown", e=>{ sx = e.clientX; sy = e.clientY; swiped = false; try{ cv.setPointerCapture(e.pointerId); }catch(_){} });
    cv.addEventListener("pointermove", e=>{ if(swiped) return; const dx = e.clientX - sx, dy = e.clientY - sy; if(Math.max(Math.abs(dx), Math.abs(dy)) < 26) return;
      swiped = true; input(Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? "L" : "R") : (dy < 0 ? "U" : "D")); });
    cv.addEventListener("pointerup", ()=>{ swiped = true; });
    const key = e => { const m = { ArrowLeft:"L", ArrowRight:"R", ArrowUp:"U", ArrowDown:"D", a:"L", d:"R", w:"U", s:"D", " ":"U" }[e.key]; if(m){ e.preventDefault(); input(m); } };
    window.addEventListener("keydown", key); window.addEventListener("resize", size);

    // ---------- particles (screen space) ----------
    function catScreen(){ const [x, y] = pr(laneX(R.lx), 0, CATZ); return [x, y]; }
    function puff(n){ const [x, y] = catScreen(); for(let i=0;i<n;i++) R.parts.push({ x:x + (Math.random()-.5)*30, y:y - 2, vx:(Math.random()-.5)*30, vy:-10 - Math.random()*20, life:.45, max:.45, c:"#f6e4c4", s:2 + (Math.random()*2|0) }); }
    function sparkle(x, y, gold){ for(let i=0;i<8;i++){ const a = i/8*Math.PI*2; R.parts.push({ x, y, vx:Math.cos(a)*50, vy:Math.sin(a)*50, life:.4, max:.4, c: gold ? "#ffcf4a" : (i%2 ? "#fff3a0" : "#ffffff"), s:2 }); }
      R.parts.push({ x, y:y-6, vx:0, vy:-30, life:.7, max:.7, text: gold ? "+5" : "+1", c: gold ? "#e8a920" : "#e5486a" }); }

    // ---------- simulation ----------
    function crash(why){ R.dead = true; R.deadT = 0; R.msg = why; R.shake = .35; snd("hit"); if(navigator.vibrate) navigator.vibrate([60,40,90]); puff(10); }
    function step(dt){
      R.frame += dt;
      if(R.turnT < 1) R.turnT = Math.min(1, R.turnT + dt/.3);
      R.shake = Math.max(0, R.shake - dt);
      for(const p of R.parts){ p.x += p.vx*dt; p.y += p.vy*dt; p.vy += 40*dt; p.life -= dt; } R.parts = R.parts.filter(p=>p.life>0);
      if(R.dead){ R.deadT += dt; if(R.deadT > 1.5 && !R.ended){ R.ended = true; end(); } return; }
      R.t += dt; R.v = Math.min(16.5, 7 + R.t*.11);
      const d = R.v*dt; R.pos += d; R.dist += d;
      R.lx += (R.lane - R.lx) * Math.min(1, dt*16);
      if(R.jump > 0){ R.jump += dt/.62; if(R.jump >= 1){ R.jump = 0; puff(5); } }
      if(R.slide > 0){ R.slide += dt/.62; if(R.slide >= 1) R.slide = 0; }
      R.chase = Math.max(0, R.chase - dt*.45);
      R.dustT -= dt; if(R.dustT <= 0 && R.jump <= 0){ R.dustT = .09; puff(1); }
      const cp = R.pos + CATZ, jh = R.jump > 0 ? 4*.58*R.jump*(1-R.jump) : 0, ln = Math.round(R.lx);
      if(cp > R.seg.len + 1.5){ crash("撞到樹叢了！"); return; }
      for(const o of R.seg.obs){ const L = o.k==="puddle" ? .9 : o.k==="bar" ? .18 : .4;
        if(cp+.15 < o.p || cp-.15 > o.p+L) continue;
        if(!o.lanes.includes(ln)) continue;
        if(o.k==="box"){ crash("撞到紙箱了！"); return; }
        if(o.k==="yarn" && jh < .22){ crash("被毛線纏住了！"); return; }
        if(o.k==="puddle" && jh < .1){ crash("踩到水坑，嚇一跳！"); return; }
        if(o.k==="bar" && !(R.slide > 0)){ crash("撞到曬衣繩了！"); return; }
      }
      for(const f of R.seg.fish){ if(f.got) continue; if(Math.abs(f.p - cp) < .38 && f.lane===ln && Math.abs(f.h - (jh + .2)) < .38){ f.got = 1; R.fish += f.gold ? 5 : 1; if(f.gold) R.gold++; snd(f.gold ? "heart" : "coin");
        const [x, y] = pr(laneX(f.lane), f.h, CATZ); sparkle(x, y - 10, f.gold); } }
    }

    // ---------- drawing ----------
    // static sky + the two parallax strips are drawn once into their own canvases
    const skyC = document.createElement("canvas"); skyC.width = RW; skyC.height = HOR+1;
    { const x = skyC.getContext("2d"), sky = x.createLinearGradient(0,0,0,HOR); sky.addColorStop(0,"#7cc6f2"); sky.addColorStop(.65,"#bfe6f7"); sky.addColorStop(1,"#f6e8ee"); x.fillStyle = sky; x.fillRect(0,0,RW,HOR+1);
      x.fillStyle = "rgba(255,246,200,.35)"; x.fillRect(178,22,36,36); x.fillStyle = "rgba(255,240,170,.6)"; x.fillRect(184,28,24,24); x.fillStyle = "#fff4b8"; x.fillRect(188,32,16,16); x.fillStyle = "#ffffff"; x.fillRect(190,34,5,5); }
    const strip = (heights, fn) => { const c = document.createElement("canvas"); c.width = RW*2; c.height = 60; const x = c.getContext("2d"); for(let i=0;i<RW*2;i++) fn(x, i, heights[i]); return c; };
    const mtnC = strip(MTN, (x, i, h) => { x.fillStyle = "#b7c9e8"; x.fillRect(i, 60-h, 1, h); if(h > 34){ x.fillStyle = "#ffffff"; x.fillRect(i, 60-h, 1, Math.min(4, h-34)); } });
    const hillC = strip(HILL, (x, i, h) => { x.fillStyle = "#9fd6a6"; x.fillRect(i, 60-h, 1, h); if(i % 14 === 3){ const hh = h; x.fillStyle = "#7fc48d"; x.fillRect(i, 60-hh-4, 4, 5); x.fillRect(i+1, 60-hh-6, 2, 2); } });
    const scrollStrip = (c, off) => { const o = ((off % (RW*2)) + RW*2) % (RW*2); g.drawImage(c, -o, HOR-60); if(o > RW) g.drawImage(c, RW*2 - o, HOR-60); };
    function drawSky(){
      g.drawImage(skyC, 0, 0);
      // clouds
      const scroll = R.dist*.5 + R.turnDir*0;
      for(const [cx,cy,w] of [[20,30,34],[110,18,44],[200,62,28],[300,40,38]]){ const x = Math.round(((cx - scroll) % (RW+60) + RW+60) % (RW+60) - 30);
        g.fillStyle = "#ffffff"; g.fillRect(x, cy, w, 8); g.fillRect(x+5, cy-5, w-14, 5); g.fillRect(x+w*.45, cy-9, w*.3, 4); g.fillStyle = "#dceef8"; g.fillRect(x+2, cy+6, w-4, 2); }
      scrollStrip(mtnC, Math.floor(R.dist*.15)); scrollStrip(hillC, Math.floor(R.dist*.4));
    }
    function drawGround(){
      const s = R.seg, puds = s.obs.filter(o=>o.k==="puddle" && o.p > R.pos && o.p < R.pos + 70);
      for(let y=HOR+1; y<RH; y++){
        const z = CAMH*F/(y-HOR), p = R.pos + z, cx = RW/2, k = F/z, hw = HALF*k;
        const fog = Math.max(0, Math.min(1, (z-5)/50));
        const band = Math.floor((p + 1000)/1.6) % 2;
        g.fillStyle = fogc(band ? "#8fd08c" : "#9cd998", fog*.8); g.fillRect(0,y,RW,1);
        // grass tufts
        if(z < 14 && ((Math.floor((p+1000)*4) * 7) % 11) === 0){ g.fillStyle = fogc("#6dbb75", fog); for(const sd of [-1,1]){ const tx = cx + sd*(hw + k*(.25 + ((Math.floor(p*4)*13)%7)*.08)); g.fillRect(Math.round(tx), y, Math.max(1, k*.03), 1); } }
        const brick = (l, r) => {
          const fr = ((p + 1000)/.32), row = Math.floor(fr), jointH = fr - row < .14;
          g.fillStyle = fogc(jointH ? "#cfa97a" : row % 3 === 0 ? "#efd6ac" : row % 3 === 1 ? "#ead0a2" : "#f2dbb4", fog*.8); g.fillRect(Math.round(l), y, Math.round(r-l), 1);
          if(!jointH && k > 18){ g.fillStyle = fogc("#cfa97a", fog*.8); const off = (row % 2) * .145, bw = Math.max(1, Math.round(k*.02)); for(let u = -HALF + off; u < HALF; u += .29){ const x = cx + u*k; if(x > l && x < r) g.fillRect(Math.round(x), y, bw, 1); } }
        };
        if(p < s.len){
          const pud = puds.length ? puds.find(o=>p>=o.p && p<=o.p+.9) : null;
          if(pud){ const f = (p - pud.p)/.9, w = Math.sin(f*Math.PI); brick(cx-hw, cx+hw);
            g.fillStyle = fogc(((Math.floor(p*6 + R.frame*4))%4===0) ? "#bfe3fb" : "#78bde9", fog*.6); g.fillRect(Math.round(cx - hw*.95*w - 1), y, Math.round(hw*1.9*w + 2), 1); }
          else brick(cx-hw, cx+hw);
          const cw = Math.max(1, Math.round(k*.07)); g.fillStyle = fogc((Math.floor((p+1000)/.6))%2 ? "#c9b49a" : "#b9a48a", fog*.8);
          g.fillRect(Math.round(cx-hw-cw), y, cw, 1); g.fillRect(Math.round(cx+hw), y, cw, 1);
        } else if(p < s.len + 1.7){
          brick(s.dirs.includes("L") ? 0 : cx-hw, s.dirs.includes("R") ? RW : cx+hw);
        }
      }
    }
    function drawObs(o, z){
      if(o.k==="box") for(const ln of o.lanes){ shadow(g, laneX(ln), z, LW*.9); bill(g, boxI, laneX(ln), 0, z, LW*.8); }
      if(o.k==="yarn"){ shadow(g, 0, z, HALF*2, .18); for(let i=0;i<5;i++) bill(g, yarnI[(i + o.c)%5], -HALF + .17 + i*.34, 0, z, .3); }
      if(o.k==="bar"){
        const k = F/z, [l, ry] = pr(-HALF-.08, .58, z), [r] = pr(HALF+.08, .58, z), [, gy] = pr(0, 0, z);
        g.fillStyle = O; for(const px of [l, r]){ g.fillRect(Math.round(px - k*.04), Math.round(ry - k*.06), Math.max(2, Math.round(k*.08)), Math.round(gy - ry + k*.06)); }
        g.fillStyle = "#c08a50"; for(const px of [l, r]) g.fillRect(Math.round(px - k*.025), Math.round(ry - k*.05), Math.max(1, Math.round(k*.05)), Math.round(gy - ry + k*.04));
        g.fillStyle = O; g.fillRect(Math.round(l), Math.round(ry), Math.round(r-l), Math.max(1, Math.round(k*.02)));
        for(let i=0;i<6;i++){ const x = -HALF + .12 + i*.3, sw = Math.sin(R.frame*3 + i)*.01; const im = i%2 ? sockI[(i + o.c)%6] : shirtI[(i + o.c)%6]; const w = i%2 ? .1 : .2;
          const pw = w*k, ph = pw*im.height/im.width, [sx2, sy2] = pr(x + sw, .58, z); g.drawImage(im, Math.round(sx2 - pw/2), Math.round(sy2), Math.round(pw), Math.round(ph)); }
      }
    }
    function drawFish(f, z){ const bob = Math.sin(R.frame*5 + f.p)*.03; shadow(g, laneX(f.lane), z, .14, .12);
      const [sx2, sy2, pw, ph] = bill(g, f.gold ? goldI : fishI, laneX(f.lane), f.h + bob, z, .22);
      if(z < 14 && Math.floor(R.frame*6 + f.p*3) % 6 === 0){ g.fillStyle = "#ffffff"; g.fillRect(Math.round(sx2 + pw*.3), Math.round(sy2 - ph - 2), 2, 2); } }
    function drawDeco(d, z){
      if(d.k==="post"){ bill(g, postI, d.side*(HALF + .14), 0, z, .05);
        // rail to the next post
        const z2 = z + 1.6; if(z2 < 32){ const k1 = F/z, [x1, y1] = pr(d.side*(HALF+.14), .2, z), [x2, y2] = pr(d.side*(HALF+.14), .2, z2), [, y1b] = pr(0, .14, z), [, y2b] = pr(0, .14, z2);
          g.fillStyle = "#ffffff"; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.lineTo(x2, y2b); g.lineTo(x1, y1b); g.closePath(); g.fill(); }
        return; }
      const x = d.side*(HALF + d.off);
      if(d.k==="tree"){ shadow(g, x, z, .7, .15); bill(g, treeI[d.t], x, 0, z, .8); }
      else if(d.k==="bush"){ bill(g, bushI, x, 0, z, .45); }
      else bill(g, flowerI[d.c], x, 0, z, .12);
    }
    function drawHedge(z, s){ const [l, t] = pr(-8, .85, z), [r, b] = pr(8, 0, z), k = F/z;
      g.fillStyle = "#3f8f55"; g.fillRect(Math.round(l), Math.round(t), Math.round(r-l), Math.round(b-t));
      g.fillStyle = "#4fae6a"; const st = Math.max(3, k*.22); for(let x=l; x<r; x+=st){ g.fillRect(Math.round(x), Math.round(t - st*.3), Math.round(st*.8), Math.round(st*.6)); }
      g.fillStyle = "#6cc47f"; for(let x=l+st*.3; x<r; x+=st*1.7) g.fillRect(Math.round(x), Math.round(t + (b-t)*.25), Math.max(1,Math.round(st*.3)), Math.max(1,Math.round(st*.3)));
      g.fillStyle = "#f0708d"; for(let x=l+st*.8; x<r; x+=st*2.3) g.fillRect(Math.round(x), Math.round(t + (b-t)*.5), Math.max(1,Math.round(st*.25)), Math.max(1,Math.round(st*.25))); }
    function drawArrow(z, dirs){ const bob = Math.sin(R.frame*6)*.05, bl = Math.floor(R.frame*5)%2;
      if(dirs.includes("L")) bill(g, arrowL[bl], dirs==="LR" ? -.3 : 0, 1 + bob, z, .5);
      if(dirs.includes("R")) bill(g, arrowR[bl], dirs==="LR" ? .3 : 0, 1 + bob, z, .5); }
    function drawCat(){
      const jh = R.jump > 0 ? 4*.58*R.jump*(1-R.jump) : 0, x = laneX(R.lx);
      shadow(g, x, CATZ, .42 * (1 - jh*.6), .25);
      let ox = R.dead && R.deadT < .4 ? Math.sin(R.deadT*50)*.03 : 0;
      if(R.slide > 0){ bill(g, slideI, x + ox, 0, CATZ, .5); return; }
      const ph = jh > .05 ? 2 : Math.floor(R.frame*10)%2, w = .5;
      const [sx2, sy2, pw, ph2] = bill(g, catI[ph], x + ox, jh, CATZ, w);
      const ti = tailI[Math.floor(R.frame*6)%2], u = pw/24; g.drawImage(ti, Math.round(sx2 - pw/2 + 9*u), Math.round(sy2 - ph2 + 7*u), Math.round(6*u), Math.round(12*u));
      if(R.dead){ g.font = "16px Cubic11, sans-serif"; g.textAlign = "center"; g.fillStyle = "#ffffff"; g.fillText("碰！", sx2+1, sy2 - ph2 - 5); g.fillStyle = "#e5486a"; g.fillText("碰！", sx2, sy2 - ph2 - 6); }
    }
    function drawDog(){
      let k = R.dead ? Math.min(1, R.deadT/.8) : R.chase; if(k <= 0) return;
      const w = 104, h = w*dogI.height/dogI.width, hop = Math.abs(Math.sin(R.frame*11))*5;
      const x = RW/2 - w/2 + Math.sin(R.frame*6)*4, y = RH - h*k*.85 + (1-k)*14 - hop;
      g.drawImage(dogI, Math.round(x), Math.round(y), w, Math.round(h));
      if(k > .6){ g.font = "12px Cubic11, sans-serif"; g.textAlign = "center"; g.fillStyle = "#ffffff"; g.fillRect(Math.round(x + w - 8), Math.round(y - 4), 28, 14); g.fillStyle = O; g.fillText(R.dead ? "舔舔" : "汪！", Math.round(x + w + 6), Math.round(y + 7)); }
    }
    function drawParts(){ for(const p of R.parts){ const a = Math.max(0, p.life/p.max); if(p.text){ g.globalAlpha = a; g.font = "11px Cubic11, sans-serif"; g.textAlign = "center"; g.fillStyle = "#ffffff"; g.fillText(p.text, Math.round(p.x)+1, Math.round(p.y)+1); g.fillStyle = p.c; g.fillText(p.text, Math.round(p.x), Math.round(p.y)); g.globalAlpha = 1; continue; }
      g.globalAlpha = a; g.fillStyle = p.c; g.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s); g.globalAlpha = 1; } }
    function draw(){
      const s = R.seg;
      drawSky(); drawGround();
      const items = [];
      for(const o of s.obs){ const z = o.p - R.pos; if(z > .6 && z < 60 && o.k!=="puddle") items.push({ z, f:()=>drawObs(o, z) }); }
      for(const f of s.fish){ const z = f.p - R.pos; if(!f.got && z > .6 && z < 45) items.push({ z, f:()=>drawFish(f, z) }); }
      for(const d of s.deco){ const z = d.p - R.pos; if(z > .5 && z < 60) items.push({ z, f:()=>drawDeco(d, z) }); }
      const hz = s.len + 1.7 - R.pos; if(hz > .6 && hz < 70) items.push({ z:hz, f:()=>drawHedge(hz, s) });
      const az = s.len - 6 - R.pos; if(az > 2 && az < 40) items.push({ z:az, f:()=>drawArrow(az, s.dirs) });
      items.push({ z:CATZ, f:drawCat });
      items.sort((a,b)=>b.z-a.z).forEach(it=>it.f());
      drawParts(); drawDog();
      // vignette + effects
      g.fillStyle = "rgba(90,59,46,.08)"; g.fillRect(0,0,RW,3); g.fillRect(0,RH-3,RW,3); g.fillRect(0,0,3,RH); g.fillRect(RW-3,0,3,RH);
      if(R.turnT < 1){ g.fillStyle = `rgba(255,255,255,${(1-R.turnT)*.5})`; g.fillRect(0,0,RW,RH); }
      if(R.dead && R.deadT < .25){ g.fillStyle = `rgba(240,112,141,${(.25-R.deadT)*1.6})`; g.fillRect(0,0,RW,RH); }
    }
    function render(){
      draw();
      const W = cv.width, H = cv.height, sc = Math.max(W/RW, H/RH), dw = RW*sc, dh = RH*sc;
      let off = 0; if(R.turnT < 1) off = R.turnDir * Math.pow(1 - R.turnT, 2) * W * .7;
      const sh = R.shake > 0 ? (Math.random()-.5)*R.shake*30 : 0;
      out.imageSmoothingEnabled = false; out.fillStyle = "#9cd998"; out.fillRect(0,0,W,H);
      out.drawImage(lc, Math.round((W-dw)/2 - off + sh), Math.round((H-dh)/2 + sh*.5), Math.round(dw), Math.round(dh));
      $("#raD").textContent = `${Math.floor(R.dist)} m`; $("#raF b").textContent = R.fish;
    }
    function loop(t){ if(done) return; const dt = Math.max(0, Math.min(.05, (t - last)/1000 || 0)); last = t;
      try{
        if(cv.width < 4 || cv.height < 4 || Math.abs(cv.width - cv.clientWidth) > 2) size();
        if(R) step(dt); if(R) render();
      }catch(e){ console.error(e); }   // keep running even if one frame fails
      raf = requestAnimationFrame(loop); }

    function start(){ reset(); $("#raM").classList.add("hidden"); $("#raTip").classList.remove("hidden"); setTimeout(()=>{ const tp = $("#raTip"); if(tp) tp.classList.add("hidden"); }, 5000); snd("select"); last = performance.now(); }
    function end(){
      const score = Math.floor(R.dist) + R.fish*10, coins = Math.floor(R.fish/2), best = Math.max(opts.best||0, score), rec = score > (opts.best||0);
      $("#raM").innerHTML = `<div class="raEndDog">${dogSvg()}</div><b>${R.msg}</b><p>狗狗追上來舔你了 🐶💦</p><p class="raSc">${score} 分</p><p>跑了 ${Math.floor(R.dist)} m・撿到 🐟 ${R.fish}${R.gold?`（金魚 ${R.gold}）`:""}</p>
        <p>${rec ? "🎉 新紀錄！" : `最高紀錄 ${best} 分`}${coins && opts.hasPet ? `<br>${coins} 個貓幣送進養貓房間了 🪙` : ""}</p>
        <button class="btn" id="raAgain">再跑一次</button><button class="btn sub" id="raHome">回大廳</button>`;
      $("#raM").classList.remove("hidden"); opts.best = best; snd(rec ? "level" : "miss");
      Promise.resolve(opts.onEnd && opts.onEnd({ score, dist:Math.floor(R.dist), fish:R.fish, coins, rec })).catch(()=>{});
      $("#raAgain").addEventListener("click", start); $("#raHome").addEventListener("click", close);
    }
    function close(){ if(done) return; done = true; cancelAnimationFrame(raf); window.removeEventListener("keydown", key); window.removeEventListener("resize", size); ov.remove(); resolve(); }
    $("#raX").addEventListener("click", ()=>{ snd("tap"); close(); });
    ov.__close = close;
    requestAnimationFrame(()=>{ size(); start(); raf = requestAnimationFrame(loop); });
  });
}
const svgOf = (rows, pal) => { let r = ""; rows.forEach((row,y)=>[...row].forEach((c,x)=>{ if(pal[c]) r += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${pal[c]}"/>`; })); return `<svg viewBox="0 0 ${rows[0].length} ${rows.length}" shape-rendering="crispEdges">${pxC(r)}</svg>`; };
const dogSvg = () => svgOf(VAC, VPAL);
const fishSvg = () => svgOf(SP.FISH, { O, Y:"#f2a65a", H:"#fff3d6", E:"#2b1d18" });

App.registerGame({
  id: "runaway",
  solo: true,
  name: "喵喵大逃亡",
  desc: "被狗狗追！滑動閃開障礙",
  icon: () => Pix.sprite("orange","surprised"),
  mount(el, ctx){
    const { sprite, esc, SFX } = ctx;
    let s = null;
    const me = () => ctx.me.uid;
    function lobby(){
      const p = ctx.partner(), best = (s && s.best) || {};
      el.innerHTML = `<div class="box raLobby">
        <div class="raStory"><span class="raVac">${dogSvg()}</span>
          <span class="raMe">${sprite(ctx.me.cat,"surprised")}</span></div>
        <p class="raIntro">偷吃了狗狗的零食，被<b>狗狗</b>追著跑！<br>能跑多遠就跑多遠～</p>
        <div class="raHow"><span>左右滑：換跑道</span><span>上滑：跳過毛線、水坑</span><span>下滑：滑過曬衣繩</span><span>路口：往箭頭方向滑</span></div>
        <div class="raBest"><div><b>${esc(ctx.me.name)}</b><span>${best[me()]||0} 分</span></div>${p?`<div><b>${esc(p.name)}</b><span>${best[p.user_id]||0} 分</span></div>`:""}</div>
        <button class="btn raGo" id="raGo">🏃 開始逃跑！</button>
        <div class="k" style="text-align:center">撿到的小魚乾每 2 條換 1 個貓幣，會送進養貓房間 🪙</div></div>`;
      el.querySelector("#raGo").addEventListener("click", go);
    }
    async function go(){
      if(document.querySelector(".raGame")) return;   // already running (double tap)
      SFX.tap();
      // don't wait on the network before the run starts
      const opts = { color: ctx.me.cat, sfx: SFX, best: (s && s.best && s.best[me()]) || 0, hasPet: true };
      ctx.getState("pet").then(pet=>{ opts.hasPet = !!(pet && pet.state); }).catch(()=>{});
      await play(Object.assign(opts, {
        onEnd: async r => {
          await ctx.update("runaway", st=>{ st = st || { best:{}, runs:{} }; st.best = st.best||{}; st.runs = st.runs||{};
            st.runs[me()] = (st.runs[me()]||0) + 1; if(r.score > (st.best[me()]||0)) st.best[me()] = r.score; st.last = { by:me(), score:r.score, at:Date.now() }; return st; });
          if(r.rec && r.score > 0) ctx.notifyPartner(`${ctx.me.name} 在「喵喵大逃亡」跑出新紀錄：${r.score} 分！`);
          if(r.coins > 0) await ctx.update("pet", st=>{ if(!st || !window.PetLogic) return undefined; st = window.PetLogic.norm(JSON.parse(JSON.stringify(st)));
            st.coins = (st.coins||0) + r.coins; st.log = (st.log||[]).concat([{ by:me(), a:"run", n:r.coins, at:Date.now() }]).slice(-24); return st; });
        } }));
      lobby();
    }
    this._u = ctx.onState("runaway", st=>{ s = st; if(!document.querySelector(".raGame")) lobby(); });
    (async()=>{ const cur = await ctx.getState("runaway").catch(()=>null); s = cur ? cur.state : null; lobby(); })();
  },
  unmount(){ if(this._u) this._u(); const g = document.querySelector(".raGame"); if(g){ if(g.__close) g.__close(); else g.remove(); } },
});
})();

// 遊戲：喵喵海戰（擺好貓咪艦隊，輪流猜座標開砲；打中可以再打一次）
(function(){
const N = 8;
const SHIPS = [{ len:4 }, { len:3 }, { len:3 }, { len:2 }];

/* ---------- 艦隊貓貓：每艘船是一隻趴著／站著的長長貓，毛色＋配件＋名字每局隨機 ---------- */
const COATS = {
  orange: { n:"橘虎斑", M:"#f2b06a", D:"#d98546", W:"#fff1df", O:"#5a3b2e", E:"#2b1d18", pat:"tabby" },
  white:  { n:"白雪", M:"#fbf8f4", D:"#e3ddd6", W:"#ffffff", O:"#5b5566", E:"#2b2630" },
  black:  { n:"小黑", M:"#3a3542", D:"#2c2833", W:"#5a5363", O:"#1d1a22", E:"#f5d36b", H:"#fff6c8", N:"#c9707f" },
  calico: { n:"三花", M:"#fffaf2", D:"#e59a4f", C:"#3e3434", W:"#ffffff", O:"#5a3b2e", E:"#2b1d18", pat:"patch" },
  gray:   { n:"灰虎斑", M:"#a7aec2", D:"#868da3", W:"#e9ecf3", O:"#4a4f60", E:"#232631", pat:"tabby" },
  tux:    { n:"賓士", M:"#3a3542", D:"#2c2833", W:"#ffffff", O:"#1d1a22", E:"#9be38f", H:"#ffffff", N:"#e8798a", pat:"tux" },
  siam:   { n:"暹羅", M:"#f3e3c8", D:"#6b4a3a", W:"#fff7ea", O:"#4a3428", E:"#4a90d6", pat:"points" },
  cream:  { n:"奶油", M:"#f7e2b8", D:"#e8c690", W:"#fff8e8", O:"#7a5636", E:"#2b1d18", pat:"tabby" },
  brown:  { n:"咖啡虎斑", M:"#b08560", D:"#7a5636", W:"#f0dcc4", O:"#3e2a1c", E:"#2b1d18", pat:"tabby" },
  pink:   { n:"草莓", M:"#f7c6d2", D:"#ee9fb3", W:"#fff0f4", O:"#7a3a4a", E:"#5a2a3a", pat:"tabby" },
  blue:   { n:"藍灰", M:"#8d9bb5", D:"#7685a0", W:"#cfd7e6", O:"#3a4256", E:"#7fd18a" },
  mint:   { n:"薄荷", M:"#bfe9d2", D:"#93d3b2", W:"#f0fff6", O:"#2f6b50", E:"#2b1d18", pat:"tabby" },
  cow:    { n:"乳牛", M:"#ffffff", D:"#e3ddd6", C:"#2c2833", W:"#ffffff", O:"#3a3542", E:"#2b1d18", pat:"cow" },
  ginger: { n:"橘白", M:"#f2b06a", D:"#d98546", W:"#ffffff", O:"#5a3b2e", E:"#2b1d18", pat:"tux" },
  tortie: { n:"玳瑁", M:"#3e3434", D:"#e59a4f", C:"#b06a3a", W:"#5a4a44", O:"#1d1a22", E:"#f5d36b", H:"#fff6c8", pat:"patch" },
  bengal: { n:"豹貓", M:"#e9b872", D:"#7a5636", W:"#fff1df", O:"#4a3020", E:"#3fae74", pat:"spots" },
  ragdoll:{ n:"布偶", M:"#f7efe2", D:"#9a8a7a", W:"#ffffff", O:"#5a4a3e", E:"#4a90d6", pat:"points" },
  maine:  { n:"緬因", M:"#9a7656", D:"#5e4430", W:"#f0dcc4", O:"#3a281a", E:"#e8a920", pat:"tabby", tuft:1 },
  silver: { n:"美短", M:"#d8dce6", D:"#5e6478", W:"#f2f4f8", O:"#3a3f50", E:"#3fae74", pat:"tiger" },
  chin:   { n:"金吉拉", M:"#fdf6ee", D:"#efe2d2", W:"#ffffff", O:"#7a6a5a", E:"#3fae74" },
  fold:   { n:"折耳", M:"#b9c2d4", D:"#9aa4b9", W:"#eef1f6", O:"#454b5e", E:"#e8a920", pat:"tabby", fold:1 },
  foldc:  { n:"奶茶折耳", M:"#f0d6b4", D:"#ddb98e", W:"#fff6ea", O:"#6a4a32", E:"#2b1d18", fold:1 },
  sphynx: { n:"無毛", M:"#f2c9b8", D:"#e0a993", W:"#f8dccf", O:"#7a4a3a", E:"#4a90d6", pat:"wrinkle" },
  choco:  { n:"巧克力", M:"#6b4a3a", D:"#553a2d", W:"#8a6a58", O:"#2c1d16", E:"#f5d36b", H:"#fff6c8" },
  van:    { n:"土耳其梵", M:"#ffffff", D:"#f0a35a", W:"#ffffff", O:"#5a3b2e", E:"#e8a920", pat:"van" },
  aby:    { n:"阿比西尼亞", M:"#d6955a", D:"#a8693a", W:"#f3d2ae", O:"#4a2a18", E:"#3fae74", pat:"ticked" },
  tiger:  { n:"小老虎", M:"#f6a54f", D:"#3a2a28", W:"#fff1df", O:"#3a2418", E:"#2b1d18", pat:"tiger" },
  panda:  { n:"熊貓", M:"#ffffff", D:"#e3ddd6", C:"#2c2833", W:"#ffffff", O:"#2c2833", E:"#ffffff", H:"#2c2833", pat:"panda" },
  rainbow:{ n:"彩虹", M:"#ffffff", D:"#f0f0f0", W:"#ffffff", O:"#5b5566", E:"#2b2630", pat:"rainbow" },
  galaxy: { n:"星空", M:"#2f3a6e", D:"#4b4f8c", W:"#5c6aa8", O:"#141a38", E:"#ffd36b", H:"#ffffff", N:"#f0a0c8", pat:"stars" },
  lav:    { n:"薰衣草", M:"#d8c4f0", D:"#b9a0e0", W:"#f6f0ff", O:"#4a3a6a", E:"#2b1d18", pat:"tabby" },
  sky:    { n:"天空", M:"#bfe0fb", D:"#95c8f0", W:"#f2f9ff", O:"#2f4f7a", E:"#2b1d18", pat:"tabby" },
  lemon:  { n:"檸檬", M:"#ffe58f", D:"#f5cc55", W:"#fffbe8", O:"#7a5a1a", E:"#2b1d18", pat:"tabby" },
  snow:   { n:"雪豹", M:"#e6e8ee", D:"#5e6478", W:"#ffffff", O:"#3a3f50", E:"#7fc4ff", pat:"spots" },
  tabbyw: { n:"虎斑白", M:"#a7aec2", D:"#6e7487", W:"#ffffff", O:"#3a3f50", E:"#e8a920", pat:"tabbytux" },
};
const ACCS = ["none","none","bow","sailor","pirate","scarf","flower","crown","captain","glasses","bandana","bell"];
const ACC_N = { none:"", bow:"蝴蝶結", sailor:"水手帽", pirate:"海盜眼罩", scarf:"小圍巾", flower:"小花", crown:"皇冠", captain:"船長帽", glasses:"眼鏡", bandana:"頭巾", bell:"鈴鐺" };
const NAMES = ["麻糬","布丁","湯圓","奶茶","芋圓","豆花","可可","吐司","黑糖","芝麻","奶酪","鬆餅","珍珠","雪球","栗子","南瓜","饅頭","泡芙","年糕","米香","蛋捲","QQ","丸子","肉圓"];
const shuffle = a => { a = a.slice(); for(let i=a.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; [a[i],a[j]]=[a[j],a[i]]; } return a; };
function randomCats(n){
  const coats = shuffle(Object.keys(COATS)), names = shuffle(NAMES);
  return [...Array(n)].map((_,i)=>({ coat:coats[i], acc:ACCS[(Math.random()*ACCS.length)|0], name:names[i]+"號" }));
}
const CELL = 14;
// head interior (x 0..13, y 0..10); M coat, P inner ear, E eye, H shine, N nose, B blush, W mouth
const HEADM = [
  "..............",
  "..M.......M...",
  ".MPM.....MPM..",
  ".MPPMMMMMPPM..",
  ".MMMMMMMMMMM..",
  ".MMMMMMMMMMM..",
  ".MMEHMMMEHMM..",
  ".MMEEMMMEEMM..",
  ".MBMMMNMMMBM..",
  "..MMMWMWMMM...",
  "...MMMMMMM....",
];
function catSVG(cat, len, vert, cry){
  const C = COATS[cat.coat] || COATS.orange, W = vert ? CELL : CELL*len, H = vert ? CELL*len : CELL;
  const g = [...Array(H)].map(()=>Array(W).fill("."));
  const set = (x,y,c) => { if(x>=0&&y>=0&&x<W&&y<H) g[y][x] = c; };
  const isBody = c => c!=="." && c!=="O";
  // body + legs + tail (painted first, head goes on top)
  if(!vert){
    for(let y=5;y<=10;y++) for(let x=7;x<=W-6;x++) set(x,y,"M");
    set(W-6,5,"."); set(W-6,10,".");
    for(const lx of [9, 12, W-10, W-7]) for(let y=11;y<=12;y++){ set(lx,y,"L"); set(lx+1,y,"L"); }
    for(let x=10;x<=W-9;x++){ set(x,9,"W"); set(x,10,"W"); }
    [[W-5,7],[W-4,7],[W-4,6],[W-3,5],[W-3,4],[W-3,3],[W-2,2]].forEach(([x,y])=>set(x,y,"T"));
  } else {
    for(let y=8;y<=H-4;y++) for(let x=2;x<=10;x++) set(x,y,"M");
    set(2,H-4,"."); set(10,H-4,".");
    for(let y=11;y<=H-6;y++) for(let x=5;x<=7;x++) set(x,y,"W");
    for(const lx of [3, 8]) for(let y=H-3;y<=H-2;y++){ set(lx,y,"L"); set(lx+1,y,"L"); }
    for(const lx of [3, 8]) { set(lx,11,"L"); set(lx+1,11,"L"); }          // front paws tucked on the chest
    [[11,H-6],[12,H-7],[12,H-8],[12,H-9],[11,H-10]].forEach(([x,y])=>set(x,y,"T"));
  }
  HEADM.forEach((row,y)=>[...row].forEach((c,x)=>{ if(c===".") return; if(C.fold && y<=3){ if(y===1) return; if(y===2){ if(x===1||x===11) return; c = "M"; } if(y===3) c = "M"; } set(x,y,c); }));
  if(C.fold){ set(2,2,"M"); set(3,2,"M"); set(9,2,"M"); set(10,2,"M"); }
  if(C.tuft){ set(2,0,"D"); set(10,0,"D"); }
  // coat patterns on M/T/L pixels
  const pat = C.pat;
  let seed = [...(cat.name||"喵")].reduce((t,ch)=>t*31+ch.charCodeAt(0), 7) >>> 0;
  const rnd = () => (seed = (seed*1103515245 + 12345) >>> 0) / 4294967296;
  const blobs = pat==="spots" ? [...Array(Math.round(W*H/22))].map(()=>({ x: rnd()*W, y: rnd()*H, r: .7+rnd()*.7, c:"D" }))
    : (pat==="patch"||pat==="cow") ? [...Array(3+len)].map((_,i)=>({ x: i===0 ? 3+rnd()*6 : rnd()*W, y: i===0 ? 2+rnd()*3 : (vert ? rnd()*H : 4+rnd()*7), r: 2.4+rnd()*1.8, c: pat==="cow" ? "C" : (i%2 ? "C" : "D") })) : [];
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){ const c = g[y][x]; if(!"MTL".includes(c)) continue;
    const inHead = y<=10 && x<=12;
    if(pat==="tabby"){ if(inHead ? (y===4 && (x===4||x===6||x===8)) || (y===5 && x===6) : (vert ? (y%3===0 && (x<=3||x>=9)) : (x%3===0 && y<=7)) || (c==="T" && (x+y)%2===0)) g[y][x] = "D"; }
    if(blobs.length && !(inHead && y>=6)){ const bl = blobs.find(b=>Math.hypot(x-b.x, (y-b.y)*1.2) < b.r); if(bl) g[y][x] = bl.c; }
    if(pat==="tiger"){ if(inHead ? (y===4 && (x===3||x===5||x===7||x===9)) || (y===5 && (x===5||x===7)) : (vert ? (y%3===0) : (x%3===0)) || (c==="T" && (x+y)%2===0)) g[y][x] = "D"; }
    if(pat==="tabbytux"){ if(c==="L"||(inHead && y>=8 && x>=4 && x<=8)) g[y][x] = "W"; else if(inHead ? (y===4 && (x===4||x===6||x===8)) : (vert ? (y%3===0 && (x<=3||x>=9)) : (x%3===0 && y<=7)) || (c==="T" && (x+y)%2===0)) g[y][x] = "D"; }
    if(pat==="ticked"){ if(!(inHead && y>=6) && (x+y)%2===0 && (x*3+y)%5<2) g[y][x] = "D"; }
    if(pat==="wrinkle"){ if(inHead && y===4 && x>=4 && x<=8 && x%2===0) g[y][x] = "D"; if(!inHead && (vert ? (y%4===0 && x>=4 && x<=8) : (x%4===0 && y===6))) g[y][x] = "D"; }
    if(pat==="van"){ if((inHead && y<=4) || c==="T") g[y][x] = "D"; }
    if(pat==="panda"){ if(c==="L" || (inHead && y<=3 && c==="M") || (inHead && y>=5 && y<=8 && ((x>=2&&x<=5)||(x>=7&&x<=10)))) g[y][x] = "C"; }
    if(pat==="rainbow" && !inHead){ const k = Math.floor((vert ? y : x)/3) % 6; g[y][x] = "123456"[k]; }
    if(pat==="stars"){ const h = (x*17 + y*31 + len*7) % 23; if(!(inHead && y>=6) && h===0) g[y][x] = "Y"; else if(!(inHead && y>=6) && h===11) g[y][x] = "X"; }
    if(pat==="points"){ if(c==="T"||c==="L"||(inHead && y>=7 && x>=4 && x<=8)) g[y][x] = "D"; }
    if(pat==="tux"){ if(c==="L"||(inHead && y>=8 && x>=4 && x<=8)) g[y][x] = "W"; }
  }
  if(pat==="points"){ set(2,2,"D"); set(10,2,"D"); }
  // outline pass
  const out = [];
  for(let y=0;y<H;y++) for(let x=0;x<W;x++) if(g[y][x]==="." && [[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>{ const r=g[y+dy]; return r && r[x+dx] && isBody(r[x+dx]); })) out.push([x,y]);
  out.forEach(([x,y])=>g[y][x]="O");
  // face
  if(cry){ for(const [x,y] of [[3,6],[4,6],[8,6],[9,6]]) set(x,y, "M"); for(const [x,y] of [[3,7],[4,7],[8,7],[9,7]]) set(x,y,"E"); set(3,8,"U"); set(9,8,"U"); }
  // accessories (on the head)
  const A = cat.acc, put = (rows, x0, y0) => rows.forEach((r,dy)=>[...r].forEach((c,dx)=>{ if(c!==".") set(x0+dx, y0+dy, c); }));
  if(A==="bow") put(["R.R","RRR","R.R"], 9, 0);
  if(A==="flower") put([".K.","KYK",".K."], 1, 0);
  if(A==="sailor") put(["..XXXX..",".XXXXXX.","ZZZZZZZZ"], 2, 0);
  if(A==="captain") put(["..ZZZZ..",".ZZYYZZ.","ZZZZZZZZ","XXXXXXXXX"], 2, 0);
  if(A==="crown") put(["Y.Y.Y","YYYYY","YRYRY"], 4, 0);
  if(A==="bandana") put(["..UUUUU..",".UUUUUUUU","UUXUUUXUU"], 1, 2);
  if(A==="pirate" && !cry){ for(let x=1;x<=11;x++) set(x,5,"Q"); put(["QQ","QQ","QQ"], 3, 5); }
  if(A==="glasses" && !cry) put(["QQQQ.QQQQ","Q..QQQ..Q","QQQQ.QQQQ"], 2, 5);
  if(A==="scarf"){ if(vert) put(["RRRRRRRRR",".......RR",".......RR"], 2, 10); else put(["RR","RR","RR","RR","RR","RR"], 12, 4); }
  if(A==="bell"){ if(vert) put(["RRRRRRRRR","....Y...."], 2, 10); else put(["R","R","R","R","Y"], 12, 5); }
  const PAL = { M:C.M, T:C.M, L:C.M, D:C.D, C:C.C||C.D, W:C.W, O:C.O, E:C.E, H:C.H||"#ffffff", P:"#f2a1ae", N:C.N||"#e8798a", B:"#f59aa6",
    U:"#6fb7e8", R:"#e5486a", K:"#f7a7b8", Y:"#ffcf4a", X:"#ffffff", Z:"#2f437d", Q:"#2b1d18",
    1:"#f7a7b8", 2:"#ffc38a", 3:"#ffe58f", 4:"#a8e6c4", 5:"#9fd0f5", 6:"#cdb4f0" };
  let r = "";
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){ const c = PAL[g[y][x]]; if(c) r += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${c}"/>`; }
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg">${r}</svg>`;
}
const svgCache = {};
const catImg = (cat, len, vert, cry) => { const k = [cat.coat,cat.acc,len,vert?1:0,cry?1:0].join("|"); return svgCache[k] || (svgCache[k] = "data:image/svg+xml;charset=utf-8,"+encodeURIComponent(catSVG(cat,len,vert,cry))); };
const headImg = cat => catImg(cat, 1, true, false);
// older saved fleets had no cats: give them stable ones
const catOfShip = (sh, i) => sh.cat || { coat:Object.keys(COATS)[i % 14], acc:"none", name:sh.n || "喵喵號" };
const ROWS = "ABCDEFGH";
function cellsOf(x, y, len, vert){ const c=[]; for(let k=0;k<len;k++){ const cx=x+(vert?0:k), cy=y+(vert?k:0); if(cx>=N||cy>=N) return null; c.push(cy*N+cx); } return c; }
function valid(fleet, idx, cells){
  const taken = new Set(); fleet.forEach((s,i)=>{ if(i!==idx) s.cells.forEach(c=>taken.add(c)); });
  return cells && cells.every(c=>!taken.has(c));
}
function randomFleet(cats){
  cats = cats || randomCats(SHIPS.length);
  for(let tries=0;tries<200;tries++){
    const fleet = []; let ok = true;
    for(const [k, sh] of SHIPS.entries()){
      let placed = false;
      for(let t=0;t<200 && !placed;t++){
        const vert = Math.random()<.5, x = (Math.random()*N)|0, y = (Math.random()*N)|0, cells = cellsOf(x,y,sh.len,vert);
        if(cells && valid(fleet, -1, cells)){ fleet.push({ len:sh.len, n:cats[k].name, cat:cats[k], cells, vert }); placed = true; }
      }
      if(!placed){ ok=false; break; }
    }
    if(ok) return fleet;
  }
}
const fresh = (ids, sc) => ({ phase:"place", fleets:{}, ready:{}, shots:{[ids[0]]:[],[ids[1]]:[]}, turn: ids[Math.random()<.5?0:1], win:null, sc: sc||{}, last:null });

App.registerGame({
  id: "battleship",
  name: "喵喵海戰",
  desc: "擺好艦隊，猜座標開砲",
  icon: () => Pix.sprite("white","wave"),
  mount(el, ctx){
    const { sprite, esc, SFX } = ctx;
    let s = null, myFleet = null, sel = -1, aim = -1, shownLast = null, busy = false;
    el.innerHTML = `<div class="box bs"><div class="bsMsg" id="bsMsg"></div><div id="bsBody"></div>
      <div style="text-align:center;margin-top:10px"><button class="btn sub" id="bsNew">重新開一局</button></div></div>`;
    const $ = q => el.querySelector(q);
    const ids = () => ctx.players(), me = () => ctx.me.uid, opp = () => ids().find(i=>i!==me());
    const shipAt = (fleet, c) => fleet ? fleet.findIndex(s=>s.cells.includes(c)) : -1;
    const sunk = (ship, shots) => ship.cells.every(c=>shots.includes(c));

    function grid(kind){
      // kind: "place" | "enemy" | "mine"
      const myShots = s.shots[me()]||[], theirShots = s.shots[opp()]||[];
      const fleet = kind==="enemy" ? (s.fleets[opp()]||[]) : (kind==="place" ? myFleet : s.fleets[me()]);
      const shots = kind==="enemy" ? myShots : theirShots;
      let h = `<div class="bsGrid ${kind}"><span></span>${[...Array(N)].map((_,i)=>`<span class="lb">${i+1}</span>`).join("")}`;
      for(let y=0;y<N;y++){
        h += `<span class="lb">${ROWS[y]}</span>`;
        for(let x=0;x<N;x++){
          const c = y*N+x, si = shipAt(fleet, c), shot = shots.includes(c);
          let cls = "c", inner = "";
          const sh = si>=0 ? fleet[si] : null, isSunk = sh && sunk(sh, shots);
          // the whole cat is drawn once, from its first cell, stretched over the ship's cells
          const cat = (show, cry) => { if(!sh || sh.cells[0]!==c || !show) return "";
            const L = sh.len, size = sh.vert ? `width:100%;height:calc(${L*100}% + ${(L-1)*3}px)` : `height:100%;width:calc(${L*100}% + ${(L-1)*3}px)`;
            cls += " head"; return `<img class="bsCat ${kind==="place"&&si===sel?"sel":""}" src="${catImg(catOfShip(sh,si), L, sh.vert, cry)}" style="${size}" alt="">`; };
          if(kind==="enemy"){
            if(shot){ if(si>=0){ cls += isSunk ? " sunk" : " hit"; inner = isSunk ? "" : "<i>💥</i>"; } else { cls += " miss"; inner = "💧"; } }
            inner = cat(isSunk, true) + inner;
            if(c===aim) cls += " aim";
          } else {
            if(si>=0){ cls += " ship"; if(kind==="place" && si===sel) cls += " sel"; }
            if(shot){ cls += si>=0 ? " hit" : " miss"; inner = si>=0 ? "<i>💥</i>" : "·"; }
            inner = cat(true, isSunk) + inner;
          }
          h += `<button class="${cls}" data-c="${c}">${inner}</button>`;
        }
      }
      return h + `</div>`;
    }
    function render(){
      const p = ctx.partner();
      if(!p || ids().length<2){ $("#bsMsg").textContent = `等${ctx.pw()}加入小窩…`; $("#bsBody").innerHTML=""; return; }
      if(!s) return;
      const pn = esc(p.name);
      if(s.phase==="place"){
        const ready = !!s.ready[me()];
        if(!myFleet) myFleet = (s.fleets[me()] && JSON.parse(JSON.stringify(s.fleets[me()]))) || randomFleet();
        $("#bsMsg").innerHTML = ready ? (s.ready[opp()] ? "開戰！" : `已佈陣！等 ${pn} 擺好艦隊…`) : `擺好你的貓貓艦隊 ⚓<br><small>點貓咪選取，再點空格移動；每局的貓貓都是隨機的！</small>`;
        $("#bsBody").innerHTML = grid("place") + (ready ? "" : `<div class="bsTools"><button class="btn sub" id="bsRand">🎲 隨機擺放</button><button class="btn sub" id="bsCats">🐱 換一批貓</button><button class="btn sub" id="bsRot" ${sel<0?"disabled":""}>↻ 旋轉</button></div>
          <div class="bsList">${myFleet.map((sh,i)=>{ const ct = catOfShip(sh,i); return `<span class="${i===sel?"on":""}"><img src="${headImg(ct)}" alt="">${esc(ct.name)}<i>${COATS[ct.coat].n}${ACC_N[ct.acc]?"・"+ACC_N[ct.acc]:""}・${sh.len} 格</i></span>`; }).join("")}</div>
          <button class="btn" id="bsReady">確定佈陣！</button>`) + `<div class="bsOpp">${s.ready[opp()]?`✔ ${pn} 已經擺好了`:`${pn} 還在擺…`}</div>`;
        if(!ready){
          $("#bsBody").querySelectorAll(".bsGrid button").forEach(b=>b.addEventListener("click", ()=>tapPlace(+b.dataset.c)));
          $("#bsRand").addEventListener("click", ()=>{ myFleet = randomFleet(myFleet.map((sh,i)=>catOfShip(sh,i))); sel=-1; SFX.splash(); render(); });
          $("#bsCats").addEventListener("click", ()=>{ const cs = randomCats(myFleet.length); myFleet.forEach((sh,i)=>{ sh.cat = cs[i]; sh.n = cs[i].name; }); SFX.meow(1.1); render(); });
          $("#bsRot").addEventListener("click", rotate);
          $("#bsReady").addEventListener("click", ready_);
        }
        return;
      }
      const myTurn = s.phase==="play" && s.turn===me();
      const enemyFleet = s.fleets[opp()]||[], myShots = s.shots[me()]||[];
      const leftEnemy = enemyFleet.filter(sh=>!sunk(sh, myShots)).length, leftMine = (s.fleets[me()]||[]).filter(sh=>!sunk(sh, s.shots[opp()]||[])).length;
      $("#bsMsg").innerHTML = s.phase==="end" ? (s.win===me() ? "<b>全部擊沉！你贏了 🏆</b>" : `${pn} 贏了～ 你的艦隊沉光了 😿`)
        : myTurn ? `<b>輪到你開砲！</b>${s.last && s.last.by===me() && s.last.hit ? "（打中了，再來一砲！）" : ""}` : `${pn} 正在瞄準你的艦隊…`;
      $("#bsBody").innerHTML = `<div class="bsLabel">🎯 ${pn} 的海域・剩 ${leftEnemy} 艘</div>` + grid("enemy") +
        (s.phase==="play" ? `<button class="btn bsFire" id="bsFire" ${myTurn && aim>=0 ? "" : "disabled"}>${aim>=0 ? `開砲！${ROWS[(aim/N)|0]}${aim%N+1}` : "點上面的海域瞄準"}</button>` : "") +
        `<div class="bsLabel">⚓ 我的艦隊・剩 ${leftMine} 艘</div><div class="bsMine">${grid("mine")}</div>`;
      if(myTurn) $("#bsBody").querySelectorAll(".bsGrid.enemy button").forEach(b=>b.addEventListener("click", ()=>{ const c=+b.dataset.c; if(myShots.includes(c)) return; aim = c; SFX.key(); render(); }));
      const f = $("#bsFire"); if(f) f.addEventListener("click", fire);
    }
    function tapPlace(c){
      const si = shipAt(myFleet, c);
      if(si>=0){ sel = si===sel ? -1 : si; SFX.key(); render(); return; }
      if(sel<0) return;
      const sh = myFleet[sel], cells = cellsOf(c%N, (c/N)|0, sh.len, sh.vert);
      if(valid(myFleet, sel, cells)){ sh.cells = cells; SFX.splash(); render(); } else SFX.miss();
    }
    function rotate(){
      if(sel<0) return; const sh = myFleet[sel], h = sh.cells[0];
      const cells = cellsOf(h%N, (h/N)|0, sh.len, !sh.vert);
      if(valid(myFleet, sel, cells)){ sh.vert = !sh.vert; sh.cells = cells; SFX.select(); render(); } else { SFX.miss(); ctx.toast("這裡轉不過去，先移到空一點的地方"); }
    }
    async function ready_(){
      const fleet = myFleet; SFX.select();
      await ctx.update("battleship", st=>{
        if(!st || st.phase!=="place") return undefined;
        st.fleets[me()] = fleet; st.ready[me()] = true;
        if(ids().every(i=>st.ready[i])) st.phase = "play";
        return st;
      });
      const p = ctx.partner(); if(p && !ctx.isOnline(p.user_id)) ctx.notifyPartner(`${ctx.me.name} 在「喵喵海戰」擺好艦隊了，快來擺你的！`);
    }
    async function fire(){
      if(aim<0 || busy) return; const c = aim; aim = -1;
      SFX.shoot();
      const ns = await ctx.update("battleship", st=>{
        if(!st || st.phase!=="play" || st.turn!==me()) return undefined;
        const shots = st.shots[me()]; if(shots.includes(c)) return undefined;
        shots.push(c);
        const fleet = st.fleets[opp()], si = shipAt(fleet, c), hit = si>=0;
        const sk = hit && sunk(fleet[si], shots);
        st.last = { by: me(), c, hit, sunk: sk ? fleet[si].n : null, n: (st.last ? st.last.n : 0) + 1 };
        if(fleet.every(sh=>sunk(sh, shots))){ st.phase = "end"; st.win = me(); st.sc[me()] = (st.sc[me()]||0)+1; }
        else if(!hit) st.turn = opp();
        return st;
      });
      if(ns && ns.phase==="play" && ns.turn!==me()){ const p = ctx.partner(); if(p && !ctx.isOnline(p.user_id)) ctx.notifyPartner(`${ctx.me.name} 在「喵喵海戰」開砲了，換你！`); }
    }
    function fx(last){
      // splash / boom where the shot landed
      const mine = last.by===me();
      const cell = el.querySelector(`.bsGrid.${mine?"enemy":"mine"} button[data-c="${last.c}"]`);
      if(cell){ cell.animate([{transform:"scale(1.8)",filter:"brightness(1.6)"},{transform:"scale(.9)"},{transform:"scale(1)"}],{duration:420,easing:"ease-out"}); }
      if(last.hit){ SFX.boom(!!last.sunk); if(last.sunk) ctx.toast(`${sprite(mine?ctx.catOf(me()):ctx.catOf(opp()), mine?"love":"surprised")} ${mine?"擊沉了":"被擊沉了"}「${esc(last.sunk)}」！`, 2600); }
      else SFX.splash();
    }
    function onState(st){
      if(!st) return;
      const prev = s; s = st;
      if(st.phase!=="place") myFleet = null;
      render();
      if(st.last && (!shownLast || st.last.n!==shownLast)){ if(prev) fx(st.last); shownLast = st.last.n; }
      if(prev && prev.phase!=="end" && st.phase==="end"){ if(st.win===me()){ SFX.match(); ctx.burst(); } else SFX.miss(); }
      if(prev && prev.phase==="place" && st.phase==="play") SFX.beep(true);
    }
    this._rs = ctx.restartable("battleship", { title:"喵喵海戰", done: ()=>!s || s.phase==="end", run: async ()=>{ const I=ids(); if(I.length<2) return; myFleet=null; sel=-1; aim=-1; await ctx.update("battleship", st=>fresh(I, st?st.sc:{})); } });
    $("#bsNew").addEventListener("click", ()=>ctx.askRestart("battleship"));
    this._u = ctx.onState("battleship", onState);
    this._p = ctx.onPresence(()=>{ if(s) render(); });
    (async()=>{
      const I = ids();
      let cur = await ctx.getState("battleship");
      if(!cur && I.length>=2){ await ctx.update("battleship", st=> st ? undefined : fresh(I, {})); cur = await ctx.getState("battleship"); }
      if(cur && I.length>=2 && !I.every(i=>i in cur.state.shots)){ await ctx.update("battleship", st=>fresh(I, st?st.sc:{})); cur = await ctx.getState("battleship"); }
      if(cur){ s = JSON.parse(JSON.stringify(cur.state)); shownLast = s.last ? s.last.n : null; }
      render();
    })();
  },
  unmount(){ if(this._rs) this._rs(); if(this._u) this._u(); if(this._p) this._p(); },
});
})();

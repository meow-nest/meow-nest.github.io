// 效能：把一格一格的像素方塊合併成「每個顏色一個形狀」，畫面元素少很多、手機比較不會卡（外觀完全一樣）
const pxC = (function(){
  const cache = new Map(), RE = /<rect x="(-?[\d.]+)" y="(-?[\d.]+)" width="1\.02" height="1\.02" fill="([^"]+)"\/>/g;
  return function(r){
    if(!r || r.length < 200) return r;
    const hit = cache.get(r); if(hit) return hit;
    const by = new Map(), seen = new Set(), order = []; let m, dup = false;
    const rest = r.replace(RE, (_, x, y, c) => { const k = x + "," + y; if(seen.has(k)) dup = true; seen.add(k);
      if(!by.has(c)){ by.set(c, new Map()); order.push(c); } const rows = by.get(c); (rows.get(y) || rows.set(y, []).get(y)).push(+x); return ""; });
    if(dup) return r;   // 有重疊的就照原本的畫，保證外觀不變
    let out = "";
    for(const c of order){ let d = ""; for(const [y, xs] of by.get(c)){ xs.sort((a, b) => a - b); let s = xs[0], p = xs[0];
        for(let i = 1; i <= xs.length; i++){ const x = xs[i]; if(x === p + 1){ p = x; continue; } d += `M${s} ${y}h${p - s + 1.02}v1.02h-${p - s + 1.02}z`; s = p = x; } }
      out += `<path d="${d}" fill="${c}"/>`; }
    out += rest;
    if(cache.size > 600) cache.clear(); cache.set(r, out); return out;
  };
})();
// Pixel art engine & sprites (shared by the app and all games)
function pix(rows, pal, opt={}){
  const w = Math.max(...rows.map(r=>r.length)), h = rows.length;
  const pad = opt.pad ?? 2;
  let r = '';
  rows.forEach((row,y)=>[...row].forEach((c,x)=>{ const col = pal[c]; if(col) r += `<rect x="${x+pad}" y="${y+pad}" width="1.02" height="1.02" fill="${col}"/>`; }));
  const W = w+pad*2, H = h+pad*2, S = Math.max(W,H);
  const bg = opt.bg ? `<rect x="${-(S-W)/2}" y="${-(S-H)/2}" width="${S}" height="${S}" fill="${opt.bg}"/>` : '';
  return `<svg viewBox="${-(S-W)/2} ${-(S-H)/2} ${S} ${S}" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg">${bg}${pxC(r)}</svg>`;
}
function setEyes(rows, kind){
  rows = rows.map(r=>[...r]);
  const put=(x,y,c)=>{ rows[y][x]=c; };
  const L=5, R=15, Y=6; // eye left-top corners in SIT sprite (2x2)
  for(const ex of [L,R]){
    for(const [dx,dy] of [[0,0],[1,0],[0,1],[1,1],[2,0],[2,1],[-1,0],[-1,1]]) if(rows[Y+dy][ex+dx]==='E'||rows[Y+dy][ex+dx]==='H') put(ex+dx,Y+dy,'Y');
    if(kind==='normal'){ put(ex,Y,'E'); put(ex+1,Y,'H'); put(ex,Y+1,'E'); put(ex+1,Y+1,'E'); }
    if(kind==='happy'){ put(ex,Y,'E'); put(ex+1,Y,'E'); put(ex-1,Y+1,'E'); put(ex+2,Y+1,'E'); }
    if(kind==='sleep'){ put(ex-1,Y+1,'E'); put(ex,Y+1,'E'); put(ex+1,Y+1,'E'); put(ex+2,Y+1,'E'); }
    if(kind==='love'){ put(ex-1,Y,'K'); put(ex+1,Y,'K'); put(ex-1,Y+1,'K'); put(ex,Y+1,'K'); put(ex+1,Y+1,'K'); put(ex,Y,'Y'); put(ex,Y+2,'K'); }
    if(kind==='angry'){ if(ex===L){ put(ex-1,Y,'E'); put(ex,Y,'E'); put(ex+1,Y+1,'E'); put(ex+2,Y+1,'E'); } else { put(ex-1,Y+1,'E'); put(ex,Y+1,'E'); put(ex+1,Y,'E'); put(ex+2,Y,'E'); } }
    if(kind==='cry'){ put(ex-1,Y,'E'); put(ex,Y+1,'E'); put(ex+1,Y+1,'E'); put(ex+2,Y,'E'); put(ex,Y+2,'T'); put(ex+1,Y+2,'T'); }
    if(kind==='surprised'){ put(ex,Y,'E'); put(ex+1,Y,'E'); put(ex,Y+1,'E'); put(ex+1,Y+1,'E'); put(ex-1,Y,'Y'); }
  }
  return rows.map(r=>r.join(''));
}

// 20-wide sitting cat with shading
const SIT = [
"....O..........O....",
"...OPO........OPO...",
"...OPPO......OPPO...",
"..OYYYYOOOOOOYYYYO..",
"..OYYYYYSYYSYYYYYO..",
".OYYYYYYYSSYYYYYYYO.",
".OYYYEHYYYYYYYYEHYYO",
".OYYYEEYYYYYYYYEEYYO",
".OYBBYYYYYNNYYYYBBYO",
".OYYYYYYYYMMYYYYYYYO",
"..OYYYYYYYYYYYYYYYO.",
"...OOYYYYYYYYYYYOO..",
"....OYYWWWWWWWYYO...",
"...OYYWWWWWWWWWYYO.OO",
"...OSYWWWWWWWWWYSOOYO",
"...OYYWWWWWWWWWYYOSYO",
"...OSYYWWWWWWWYYSOYO.",
"...ODYYYYYYYYYYYDOO..",
"...OWWDOOOOOOODWWO...",
"....OOO.......OOO....",
];
// fix ragged widths
const sit = SIT.map(r=>r.padEnd(21,'.'));

const PAL = {
  orange: {O:'#5a3b2e',Y:'#f2b06a',S:'#d98546',D:'#d99858',P:'#f2a1ae',E:'#2b1d18',H:'#ffffff',B:'#f59aa6',N:'#e8798a',M:'#5a3b2e',W:'#fff1df',K:'#ec5f7e',T:'#7fc4ff'},
  white:  {O:'#5b5566',Y:'#fbf8f4',S:'#a9a4b6',D:'#e3ddd6',P:'#f2a1ae',E:'#2b2630',H:'#ffffff',B:'#f7b0bb',N:'#e8798a',M:'#5b5566',W:'#ffffff',K:'#ec5f7e',T:'#7fc4ff'},
  black:  {O:'#1d1a22',Y:'#3a3542',S:'#2c2833',D:'#2f2a36',P:'#e89aa8',E:'#f5d36b',H:'#fff6c8',B:'#c9707f',N:'#e8798a',M:'#9a92a8',W:'#5a5363',K:'#ec5f7e',T:'#7fc4ff'},
  calico: {O:'#5a3b2e',Y:'#fffaf2',S:'#e59a4f',D:'#3e3434',P:'#f2a1ae',E:'#2b1d18',H:'#ffffff',B:'#f59aa6',N:'#e8798a',M:'#5a3b2e',W:'#ffffff',K:'#ec5f7e',T:'#7fc4ff'},
  star:   {O:'#5a3b2e',Y:'#ead6b8',S:'#b98d62',D:'#d4b994',P:'#f2a1ae',E:'#2b1d18',H:'#ffffff',B:'#f59aa6',N:'#e8798a',M:'#5a3b2e',W:'#fff8ee',K:'#ec5f7e',T:'#7fc4ff',G:'#231c1f',L:'#f4f9ff'},
  pj:     {O:'#5a4a63',Y:'#fff4e6',S:'#f0d9c2',D:'#e9d3bd',P:'#f6b2bf',E:'#2b1d18',H:'#ffffff',B:'#f7a8b8',N:'#e8798a',M:'#5a4a63',W:'#fff8ee',K:'#ec5f7e',T:'#7fc4ff',J:'#a9c6f2',I:'#ffffff',Q:'#ffe27a',U:'#ffd35c'},
  gray:   {O:'#4a4f60',Y:'#a7aec2',S:'#868da3',D:'#9097ab',P:'#f2b1bc',E:'#232631',H:'#ffffff',B:'#f0a5b2',N:'#e8798a',M:'#4a4f60',W:'#e9ecf3',K:'#ec5f7e',T:'#7fc4ff'},
};
const soft = p => Object.assign({}, p, {O: p.D});      // no-outline soft version
const gb = {O:'#0f380f',Y:'#8bac0f',S:'#306230',D:'#306230',P:'#9bbc0f',E:'#0f380f',H:'#9bbc0f',B:'#306230',N:'#0f380f',M:'#0f380f',W:'#9bbc0f',K:'#0f380f',T:'#7fc4ff'};

// calico patches: recolor some Y as S/D in head & body
// 博士貓（id 還是 star）：大大的黑色圓框眼鏡
function starMark(rows){
  rows = rows.map(r=>[...r]);
  const at=(x,y)=>rows[y] && rows[y][x];
  const put=(x,y,c)=>{ if(at(x,y)!==undefined && at(x,y)!=='.' && at(x,y)!=='O') rows[y][x]=c; };
  for(const L of [3,13]){ for(let x=L+1;x<=L+4;x++){ put(x,5,'G'); put(x,9,'G'); } /* 圓框：四個角不畫 */ for(let y=6;y<=8;y++){ put(L,y,'G'); put(L+5,y,'G'); }
    for(let y=6;y<=8;y++) for(let x=L+1;x<=L+4;x++) if(at(x,y)==='Y'||at(x,y)==='B') rows[y][x]='L'; }
  for(let x=9;x<=12;x++) put(x,6,'G');
  put(2,6,'G'); put(19,6,'G');
  // 哭的時候眼淚從眼鏡下面流出來
  for(let x=0;x<rows[8].length;x++) if(rows[8][x]==='T'){ rows[8][x]='L'; put(x,10,'T'); put(x,11,'T'); }
  return rows.map(r=>r.join(''));
}
// 限定「睡衣小貓」：睡帽（尾巴垂下來、掛一顆毛球）＋條紋睡衣
const PJ_CAP = [
"...........OOO.........",
".........OOJJJOO.......",
"....O...OJJJIJJJO......",
"...OPO.OJJJJJJJJJO.....",
"...OPPOJJJJJJJJIJJO....",
"..OYYYOIIIIIIIIIIIOJO..",
".OYYYOIIIIIIIIIIIIIOJO.",
".OYYYYOOOOOOOOOOOOOOJO.",
];
const PJ_POM = [".OO.","OQQO","OQIO",".OO."];
function pjMark(rows){
  const body = rows.slice(5).map((r, i) => { const oy = i + 5; const a = [...r.padEnd(27,'.')];
    a.forEach((c, x) => { if(oy===5 && c==='S') a[x]='Y';
      if(oy>=12 && oy<=17 && x<=17 && 'YSDW'.includes(c) && !(oy===17 && c==='D')) a[x] = oy % 2 ? 'I' : 'J'; });
    if(oy===13 || oy===15) a[10]='U';
    return a; });
  const out = PJ_CAP.map(r=>[...r.padEnd(27,'.')]).concat(body);
  PJ_POM.forEach((ln, dy) => [...ln].forEach((c, dx) => { if(c!=='.') out[8+dy][20+dx] = c; }));
  return out.map(r=>r.join(''));
}
function calicoize(rows){
  return rows.map((r,y)=>[...r].map((c,x)=>{
    if(c!=='Y') return c;
    if(y<=5 && x<=8) return 'S';
    if(y<=4 && x>=12) return 'D';
    if(y>=13 && x>=15) return 'S';
    if(y>=15 && x<=5) return 'D';
    return c;
  }).join(''));
}
const plain = rows => rows.map(r=>r.replace(/S/g,'Y'));

// loaf side view
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
// curled sleeping
const CURL = [
"......O...O..........",
".....OPO.OPO.........",
"....OYYYOYYYOOOOOO...",
"...OYYYYYYYYYYYYYYOO.",
"..OYYYYYYYYYYYYSYYYYO",
"..OYEEYYEEYYYYYYSYYYO",
".OBBYYNYYYBBYYYYYSYYO",
".OYYYYMYYYYYYYYYYYYYO",
".OWWWWYYYYYYYYYYYYYYO",
".OSSSSSSSSOYYYYYYYYO.",
"..OOOOOOOOOOOOOOOOO..",
];
// waving: add raised paw on right of SIT
function wave(rows){
  rows = rows.map(r=>[...r.padEnd(24,'.')]);
  const paw = [
    [17,8,'O'],[18,8,'O'],[19,8,'O'],
    [16,9,'O'],[17,9,'P'],[18,9,'W'],[19,9,'P'],[20,9,'O'],
    [16,10,'O'],[17,10,'W'],[18,10,'P'],[19,10,'W'],[20,10,'O'],
    [16,11,'O'],[17,11,'W'],[18,11,'W'],[19,11,'O'],
    [15,12,'O'],[16,12,'Y'],[17,12,'Y'],[18,12,'O'],
  ];
  paw.forEach(([x,y,c])=>rows[y][x]=c);
  return rows.map(r=>r.join(''));
}


const COLORS = ["orange","white","calico","black","gray"];
// ---- 生日限定「壽星貓」：九種顏色，壽星每年可以挑一隻 ----
const BD_BASE = [".OO.OO.......OVQQ.........", "ORROhRO.....OAVQQ...O.....", "ORRRRRO.....OVAO...OYO....", "ORRRRROO...OAVAO..OYYO....", ".ORRROYYOO.OVAVAOOYYYO....", "..OROYPYYYOAVAVAYYYPYO....", "...OYYPPPYOQQQQQQOPPYYO...", "...OYPPPIIYSYSYSYYPPPYO...", "...OYYIIIIIYYYYYYYYYYYO...", "..OOYYIIIIIYYYYYYYYYYYO...", "..OYYYYYIIYYYYYYYYYYYYYO..", ".OYYYYYYYYYYYYYYYYYYYYYYO.", ".OYYYYYEEYYYYYYYYEEYYYYYO.", ".OYYYYEHEEYYYYYYEHEEYYYSO.", ".OYYYYEEEEYYWWYYEEEEYYYSO.", ".OSYYYEELEWWWWWWEELEYYYSO.", ".OSYBBYEEWWWWWWWWEEYYBBSYO", "..OSYYYYYWWWWWWWWYYYYYSOYO", "..OSSYYYYWWWWWWWWYYYYSSYYO", "...OSSYWWWWWWWWWWWWSSSSYO.", "....OSSWWWWWFWWWWWWSSOOO..", ".....OOWWWWWCWWWWWWOO.....", "......OSWOOOOOOOWWSO......", ".......OOKKKKKKKOWO.......", "........OKQKKQKKOO........", "........ODDDDDDDO.........", "........ODDDDDDDO.........", ".........OOOOOOO.........."];
const BD_DIFF = {"surprised":{"15":".OSYYYEEEEWWWWWWEEEEYYYSO.","17":"..OSYYYYYWWWMMWWWYYYYYSOYO","18":"..OSSYYYYWWWMMWWWYYYYSSYYO"},"happy":{"12":".OYYYYYYYYYYYYYYYYYYYYYYO.","13":".OYYYYYEEYYYYYYYYEEYYYYSO.","14":".OYYYYEYYEYYWWYYEYYEYYYSO.","15":".OSYYYYYYYWWWWWWYYYYYYYSO.","16":".OSYBBYYYWWWWWWWWYYYYBBSYO"},"love":{"12":".OYYYYKYYKYYYYYYKYYKYYYYO.","13":".OYYYYKKKKYYYYYYKKKKYYYSO.","14":".OYYYYKKKKYYWWYYKKKKYYYSO.","15":".OSYYYYKKYWWWWWWYKKYYYYSO.","16":".OSYBBYYYWWWWWWWWYYYYBBSYO"},"sleep":{"12":".OYYYYYYYYYYYYYYYYYYYYYYO.","13":".OYYYYYYYYYYYYYYYYYYYYYSO.","15":".OSYYYYYYYWWWWWWYYYYYYYSO.","16":".OSYBBYYYWWWWWWWWYYYYBBSYO"},"angry":{"12":".OYYYYEYYYYYYYYYYYYEYYYYO.","13":".OYYYYYEEYYYYYYYYEEYYYYSO.","14":".OYYYYYYEEYYWWYYEEYYYYYSO.","15":".OSYYYYYYYWWWWWWYYYYYYYSO.","16":".OSYBBYYYWWWWWWWWYYYYBBSYO"},"cry":{"12":".OYYYYYYYYYYYYYYYYYYYYYYO.","13":".OYYYYEEEEYYYYYYEEEEYYYSO.","14":".OYYYYYYYYYYWWYYYYYYYYYSO.","15":".OSYYYTYYTWWWWWWTYYTYYYSO.","16":".OSYBBTYYTWWWWWWTYYTYBBSYO"}};
const BD_PLAIN = {"0":".............OVQQ.........","1":".....O......OAVQQ...O.....","2":"....OYO.....OVAO...OYO....","3":"....OYYO...OAVAO..OYYO....","4":"....OYYYOO.OVAVAOOYYYO....","5":"....OYPYYYOAVAVAYYYPYO....","9":"...OYYIIIIIYYYYYYYYYYYO...","20":"....OSSWWWWWWWWWWWWSSOOO..","21":".....OOWWWWWWWWWWWWOO.....","22":"......OSWWWWWWWWWWSO......","23":".......OWWWOOOOWWWO.......","24":"........OOO....OOO........","25":"..........................","26":"..........................","27":".........................."};   // 一般貼圖用：拿掉氣球和蛋糕
const BD_PALB = {h:'#ffb3c2',E:'#2e1a14',H:'#ffffff',L:'#7a5a6a',T:'#7fc4ff',K:'#ff6f91',A:'#ff6f91',V:'#fff1a8',Q:'#ffffff',R:'#ff5a7a',G:'#c93a5a',F:'#ffb347',C:'#8fd8f0',D:'#e0a86a',W:'#fffaf2',P:'#ff9eb0',B:'#ff8fa3',N:'#ff7f96'};
const BD_COL = [
  ["蜂蜜奶茶",{O:'#6b3f2a',Y:'#ffd9a8',S:'#f2b47c',I:'#ffeccc'}],
  ["雪白小糰子",{O:'#6b4a5a',Y:'#ffffff',S:'#e9e2ec',I:'#ffffff',W:'#fff3f6',A:'#7fd0f0',V:'#fff3a0'}],
  ["蜜桃粉",{O:'#7a4048',Y:'#ffc9bc',S:'#f4a596',I:'#ffe0d8',A:'#9b7fe0',V:'#ffe680'}],
  ["檸檬奶油",{O:'#6b5230',Y:'#fff0a8',S:'#f5d66e',I:'#fff9d6',A:'#7fd0f0',V:'#ffffff'}],
  ["薄荷牛奶",{O:'#3f6158',Y:'#cdf2e4',S:'#9fdcc6',I:'#e8fbf3',A:'#ff8fb1',V:'#fff1a8'}],
  ["天空藍",{O:'#3f5578',Y:'#cfe6ff',S:'#9fc6ef',I:'#e9f3ff',A:'#ffd36b',V:'#ffffff'}],
  ["薰衣草",{O:'#57457a',Y:'#e3d6ff',S:'#bfa8ef',I:'#f2ecff',A:'#ffd36b',V:'#ff9fb6'}],
  ["灰灰小貓",{O:'#3f4252',Y:'#c9ccd8',S:'#a3a7b9',I:'#e2e4ec',A:'#ff8fb1',V:'#fff1a8'}],
  ["黑糖可可",{O:'#2e1f1a',Y:'#8a5e48',S:'#6e4636',I:'#a8775e',W:'#f5e3d3',P:'#e8899a',E:'#1a100c',H:'#fff3d6',L:'#e0b070',A:'#ffd36b',V:'#ff8fb1'}],
];
const BD_IDS = BD_COL.map((_, i) => "bd" + (i + 1));
const isBd = c => /^bd[1-9]$/.test(c || "");
function bdPal(c){ const p = BD_COL[(+String(c).slice(2) || 1) - 1][1]; return Object.assign({}, BD_PALB, {M: p.O}, p); }
// 嘴巴和鼻子用圓滑線條畫（不是像素），看起來比較軟萌
function bdMouth(face, pal){
  const g = `fill="none" stroke="${pal.M}" stroke-width=".3" stroke-linecap="round" stroke-linejoin="round"`;
  const nose = `<path d="M12.25 16.2Q13 15.95 13.75 16.2Q13.85 16.45 13 17.1Q12.15 16.45 12.25 16.2Z" fill="${pal.N}"/>`;
  let m;
  if(face === "surprised") m = `<ellipse cx="13" cy="17.85" rx=".32" ry=".4" fill="#8a3a3a" stroke="${pal.M}" stroke-width=".22"/>`;
  else if(face === "angry" || face === "cry") m = `<path d="M13 17.05L13 17.4M12.1 18.1Q13 17.35 13.9 18.1" ${g}/>`;
  else m = `<path d="M13 17.05L13 17.55M13 17.55Q12.65 18.15 12 17.95M13 17.55Q13.35 18.15 14 17.95" ${g}/>`;
  return `<g transform="translate(1 1)" shape-rendering="geometricPrecision">${nose}${m}</g>`;
}
function bdSprite(c, kind, plain){
  const face = {wave:"happy", loaf:"sleep", curl:"sleep"}[kind] || (BD_DIFF[kind] || kind === "normal" ? kind : "normal");
  let rows = BD_BASE.map((r, i) => (plain && BD_PLAIN[i]) || (BD_DIFF[face] || {})[i] || r), pal = bdPal(c);
  if(plain) rows = rows.slice(0, 25);
  return pix(rows, pal, {pad: 1}).replace("</svg>", bdMouth(face, pal) + "</svg>");
}
const CNAME = Object.assign({orange:"橘貓",white:"白灰斑貓",calico:"三花貓",black:"黑貓",gray:"灰貓",star:"博士貓",pj:"睡衣小貓"}, Object.fromEntries(BD_IDS.map((id, i) => [id, "壽星貓・" + BD_COL[i][0]])));
const PC_IDS = Array.from({length:12}, (_, i) => "pc" + (i + 1));   // 乞丐貓（poorcat.js）
const PC_N = ["奶油","橘子","灰灰","雪白","可可","黑糖","虎斑","蜜桃","檸檬","薄荷","天空","薰衣草"];
const isPc = c => /^pc([1-9]|1[0-2])$/.test(c || "");
PC_IDS.forEach((id, i) => { CNAME[id] = "乞丐貓・" + PC_N[i]; });
const SPECIAL = ["star","pj"].concat(BD_IDS, PC_IDS);   // 特別的貓：要完成條件才能選（例如填問卷）
const PC_YS = [["#efe3d3","#d7c3a8"],["#ffc68c","#f0a060"],["#c9ccd8","#a3a7b9"],["#ffffff","#e4e0ea"],["#a8775e","#8a5e48"],["#4a4452","#37323e"],["#e8c9a0","#b98d5c"],["#ffd6c8","#f4aa96"],["#fff0b0","#efd36c"],["#cdeedd","#9fd5bc"],["#d2e6fb","#9fc4ec"],["#e2d8f6","#bcaee6"]];
const palOf = c => isPc(c) ? Object.assign({}, PAL.orange, {O:'#4a3428', Y: PC_YS[+c.slice(2)-1][0], S: PC_YS[+c.slice(2)-1][1], D: PC_YS[+c.slice(2)-1][1], M:'#4a3428'}) : isBd(c) ? bdPal(c) : c==="white" ? Object.assign({},PAL.white,{S:'#a9a4b6',D:'#a9a4b6'}) : PAL[c];
function baseSit(c, face){
  let r = setEyes(c==="black"||c==="calico" ? plain(sit) : sit, face);
  if(c==="white"||c==="calico") r = calicoize(r);
  if(c==="star") r = starMark(r);
  return r;
}
const cache = {};
function sprite(c, kind, opts){
  c = COLORS.includes(c) || SPECIAL.includes(c) ? c : "orange";
  const key = c+kind+(opts&&opts.soft?'s':'')+(opts&&opts.plain?'p':'');
  if(cache[key]) return cache[key];
  if(isBd(c)) return cache[key] = bdSprite(c, kind, opts && opts.plain);
  if(isPc(c)) return window.PoorCat ? PoorCat.sprite(c, kind, opts) : sprite("orange", kind, opts);
  let pal = palOf(c);
  if(opts && opts.soft) pal = Object.assign({}, pal, {O: pal.D});
  let rows;
  if(c==="pj" && kind!=="loaf" && kind!=="curl") return cache[key] = pix(pjMark(kind==="wave" ? wave(baseSit(c,"happy")) : baseSit(c, kind==="normal" ? "sleep" : kind)), pal, {pad: 1});
  if(kind==="wave") rows = wave(baseSit(c,"happy"));
  else if(kind==="loaf") rows = LOAF;   // 趴著睡覺時眼鏡拿下來了
  else if(kind==="curl") rows = CURL;
  else rows = baseSit(c, kind);
  return cache[key] = pix(rows, pal, {pad: kind==="loaf"||kind==="curl" ? 3 : 2});
}
// tiny icons
const ICON = {
  heart: ["..OO.OO..",".OKKOKKO.","OKWKKKKKO","OKKKKKKKO",".OKKKKKO.","..OKKKO..","...OKO...","....O...."],
  fish:  ["..........O...",".....OOOO.OO..","...OOBBBBOBO..","..OBBEBBBBBOO.","..OBBBBBBBBOBO",".OOBBBBBBBOO..","..OOOBBBBO.O..","....OOOO......"],
  paw:   ["..OO..OO..",".OPPOOPPO.",".OPPOOPPO.","..OO..OO..","...OOOO...","..OPPPPO..",".OPPPPPPO.",".OPPPPPPO.","..OOOOOO.."],
  star:  ["....O....","...OYO...","OOOOYOOOO","OYYYYYYYO",".OYYYYYO.","..OYYYO..",".OYYOYYO.",".OOO.OOO."],
  sweat: ["..O..",".OBO.","OBBBO","OBWBO",".OOO."],
};
const IPAL = {O:'#5a3b2e',K:'#f0708d',W:'#ffd1dc',B:'#8fc4e8',E:'#2b1d18',P:'#f2a1ae',Y:'#f6c45f'};
function icon(n, pal){ const k='i'+n+(pal?JSON.stringify(pal):''); return cache[k]||(cache[k]=pix(ICON[n], Object.assign({},IPAL,pal||{}), {pad:1})); }


ICON.bigpaw = [
"...OO.OO...",
"..OPPOPPO..",
".OOPPOPPOO.",
"OPPOOFOOPPO",
"OPPOFFFOPPO",
".OOFFFFFOO.",
".OFFPPPFFO.",
"OFFPPPPPFFO",
"OFFPPPPPFFO",
".OFFPPPFFO.",
"..OOOOOOO..",
];
ICON.sq = ["OO","OO"];
ICON.spark = [".O.","OOO",".O."];

ICON.chat = ["OOOOOOOOO","OWWWWWWWO","OWEWEWEWO","OWWWWWWWO","OOOOWOOOO","...OWO...","...OO...."];
ICON.home = ["....O....","...OKO...","..OKKKO..",".OKKKKKO.","OOKKKKKOO",".OKWWWKO.",".OKWOWKO.",".OKWOWKO.",".OOOOOOO."];
ICON.gear = ["...OOO...",".O.OWO.O.","OOOWWWOOO",".OWWOWWO.","OWWO.OWWO",".OWWOWWO.","OOOWWWOOO",".O.OWO.O.","...OOO..."];
ICON.bell = ["....O....","...OYO...","..OYYYO..","..OYYYO..",".OYYYYYO.",".OYYYYYO.","OYYYYYYYO","OOOOOOOOO","...OEO..."];
ICON.camera = ["..OOO....","OOOWOOOOO","OWWWWWWWO","OWWOOOWWO","OWOBBBOWO","OWOBWBOWO","OWOBBBOWO","OWWOOOWWO","OOOOOOOOO"];
ICON.keys = ["OOOOOOOOOOO","OWOWOWOWOWO","OOOOOOOOOOO","OWOWOWOWOWO","OOOOOOOOOOO","OWOOOOOOOWO","OOOOOOOOOOO"];
ICON.play = ["OO.....","OWOO...","OWWWOO.","OWWWWWO","OWWWOO.","OWOO...","OO....."];
ICON.pause = ["OOO.OOO","OWO.OWO","OWO.OWO","OWO.OWO","OWO.OWO","OWO.OWO","OOO.OOO"];
ICON.note = ["...OOOO","...OKKO","...OOOO","...O..O","...O..O",".OOO.OO","OKKOOKO","OKKO.OO",".OO...."];
ICON.sun = ["....O....",".O..O..O.","..OYYYO..",".OYYYYYO.","OOYYYYYOO",".OYYYYYO.","..OYYYO..",".O..O..O.","....O...."];
ICON.moon = ["...OOOO..","..OYYO...",".OYYO....","OYYYO....","OYYYO....","OYYYYO...",".OYYYYOOO","..OOOOOO."];
ICON.board = [".OOOOOOO.","OWWOOOWWO","OWWWWWWWO","OWOOOOOWO","OWWWWWWWO","OWOOOOWWO","OWWWWWWWO","OWOOOWWWO","OWWWWWWWO","OOOOOOOOO"];
ICON.lips = [".OO.OO.","OKKOKKO","OKKKKKO",".OKKKO.","..OOO.."];
ICON.zz = ["OOOO....","...O....","..O.....",".O..OOO.","OOOO..O.",".....O..","....OOO."];
ICON.thumb = ["...OO...","..OYO...","..OYO...","OOOYYOOO","OYOYYYYO","OYOYYYYO","OYOYYYYO","OOOOOOOO"];
ICON.check = [".......OO","......OGO",".....OGO.","OO..OGO..","OGOOGO...",".OGGO....","..OO....."];
ICON.flower = ["..O.O..",".OKOKO.","OKKYKKO",".OKYKO.","OKKYKKO",".OKOKO.","...G...","..GG...","...G..."];
ICON.anger = ["OO.O.OO","OKKOKKO",".OKOKO.","OO...OO",".OKOKO.","OKKOKKO","OO.O.OO"];
ICON.qmark = [".OOOOO.","OKKKKKO","OKOOOKO","OOO.OKO","..OKKO.","..OKO..","..OOO..","..OKO..","..OOO.."];
ICON.excl = ["OOO","OKO","OKO","OKO","OKO","OOO","...","OOO","OKO","OOO"];
ICON.onigiri = ["...OO...","..OWWO..",".OWWWWO.",".OWWWWO.","OWWWWWWO","OWEEEEWO","OWEEEEWO","OOOOOOOO"];
ICON.laptop = [".OOOOOOOO.",".OBBBBBBO.",".OBWBBBBO.",".OBBBBBBO.",".OOOOOOOO.","OWWWWWWWWO","OOOOOOOOOO"];
ICON.hourglass = ["OOOOOOO",".OYYYO.","..OYO..","...O...","..OWO..",".OWYWO.","OOOOOOO"];
ICON.crown = ["O..O..O","OO.O.OO","OYOYOYO","OYYYYYO","OYKYKYO","OOOOOOO"];
ICON.bottle = ["..OO..","..OO..",".OGGO.","OGGGGO","OGWGGO","OGGGGO","OGGGGO","OOOOOO"];
ICON.dots = ["OO.OO.OO","OO.OO.OO"];
ICON.drop = ["..O..",".OBO.","OBBBO","OBWBO",".OOO."];
ICON.headband = ["OOOOOOOOOOOOOO...","ORRRRRRRRRRRRRO.O","ORRRRRWRRRRRRROOO","ORRRRRRRRRRRRRO.O","OOOOOOOOOOOOOO..."];
ICON.flame = ["...O.....","..ORO....","..ORRO.O.",".ORRYRORO",".ORYYRRRO","ORRYYYRRO","ORYYWYYRO",".ORYYYRO.","..OOOOO.."];
ICON.battery = ["OOOOOOOOOO.","ORRWWWWWWOO","ORRWWWWWWOO","OOOOOOOOOO."];
ICON.pin = ["..OOOOO..",".OKKKKKO.",".OKWKKKO.",".OKKKKKO.","OOKKKKKOO","OKKKKKKKO","OOOOOOOOO","....O....","....O....","....O...."];
ICON.phone = ["OOOO........","OKKKO.......","OKKKO.......","OOKKO.......",".OKKO.......",".OKKKO......","..OKKKO.....","...OKKKOOOO.","....OOKKKKKO","......OOKKKO","........OOKO","..........OO"];
ICON.vcam = ["OOOOOOOO....","OKKKKKKO..OO","OKWWKKKOOOKO","OKWKKKKOKKKO","OKKKKKKOKKKO","OKKKKKKOOOKO","OKKKKKKO..OO","OOOOOOOO...."];
ICON.search = ["..OOOO.....",".OBBBBO....","OBWWBBBO...","OBWBBBBO...","OBBBBBBO...","OBBBBBBO...",".OBBBBO....","..OOOOOO...","......OOO..",".......OOO.","........OO."];
ICON.lock = ["...OOOO...","..OO..OO..",".OO....OO.",".O......O.","OOOOOOOOOO","OYYYYYYYYO","OYYYOOYYYO","OYYYOOYYYO","OYYYYOYYYO","OYYYYYYYYO","OOOOOOOOOO"];
ICON.memo = ["..O....O..",".OOOOOOOO.",".OKKKKKKO.",".OWWWWWWO.",".OWBBBBWO.",".OWWWWWWO.",".OWBBBWWO.",".OWWWWWWO.",".OWBBBBWO.",".OWWWWWWO.",".OOOOOOOO."];
ICON.mic = ["...OOO...","..OKKKO..","..OKWKO..","..OKKKO..","..OKWKO..","..OKKKO..","O.OKKKO.O","O..OOO..O",".O.....O.","..OOOOO..","....O....","..OOOOO.."];
// 生日貼圖用的小道具
ICON.twk = ["..O..","..O..","OOOOO","..O..","..O.."];   // 閃閃（稱號特效）
ICON.gift = ["..O...O..",".OKO.OKO.","..OOKOO..","OOOOKOOOO","OYYYKYYYO","OOOOKOOOO",".OYYKYYO.",".OYYKYYO.",".OOOOOOO."];
ICON.conf = ["K...Y..","..B...K",".Y..K..","B....B.","..K.Y..","Y.....B"];
ICON.cup = ["O.....O","OWWWWWO","OKKKKKO","OKWKKKO",".OKKKO.","..OKO..","...O...","..OOO.."];
ICON.horn = ["........OO","......OOKO","....OOYYKO","OOOOYYYYKO","OKKYYYYYKO","OOOOYYYYKO","....OOYYKO","......OOKO","........OO"];
ICON.yarn = ["..OOOOO..",".OKKWKKO.","OKWKKWKKO","OKKWKKWKO","OWKKWKKKO","OKWKKWKWO",".OKKWKKO.","..OOOOOO.","......OOO"];   // 毛線球
const Pix = { COLORS, CNAME, SPECIAL, sprite, icon, palOf, BD_IDS, BD_COL, isBd, PC_IDS, PC_N, isPc };

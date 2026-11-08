// Pixel art engine & sprites (shared by the app and all games)
function pix(rows, pal, opt={}){
  const w = Math.max(...rows.map(r=>r.length)), h = rows.length;
  const pad = opt.pad ?? 2;
  let r = '';
  rows.forEach((row,y)=>[...row].forEach((c,x)=>{ const col = pal[c]; if(col) r += `<rect x="${x+pad}" y="${y+pad}" width="1.02" height="1.02" fill="${col}"/>`; }));
  const W = w+pad*2, H = h+pad*2, S = Math.max(W,H);
  const bg = opt.bg ? `<rect x="${-(S-W)/2}" y="${-(S-H)/2}" width="${S}" height="${S}" fill="${opt.bg}"/>` : '';
  return `<svg viewBox="${-(S-W)/2} ${-(S-H)/2} ${S} ${S}" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg">${bg}${r}</svg>`;
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
  gray:   {O:'#4a4f60',Y:'#a7aec2',S:'#868da3',D:'#9097ab',P:'#f2b1bc',E:'#232631',H:'#ffffff',B:'#f0a5b2',N:'#e8798a',M:'#4a4f60',W:'#e9ecf3',K:'#ec5f7e',T:'#7fc4ff'},
};
const soft = p => Object.assign({}, p, {O: p.D});      // no-outline soft version
const gb = {O:'#0f380f',Y:'#8bac0f',S:'#306230',D:'#306230',P:'#9bbc0f',E:'#0f380f',H:'#9bbc0f',B:'#306230',N:'#0f380f',M:'#0f380f',W:'#9bbc0f',K:'#0f380f',T:'#7fc4ff'};

// calico patches: recolor some Y as S/D in head & body
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
const CNAME = {orange:"橘貓",white:"白灰斑貓",calico:"三花貓",black:"黑貓",gray:"灰貓"};
const palOf = c => c==="white" ? Object.assign({},PAL.white,{S:'#a9a4b6',D:'#a9a4b6'}) : PAL[c];
function baseSit(c, face){
  let r = setEyes(c==="black"||c==="calico" ? plain(sit) : sit, face);
  if(c==="white"||c==="calico") r = calicoize(r);
  return r;
}
const cache = {};
function sprite(c, kind, opts){
  c = COLORS.includes(c) ? c : "orange";
  const key = c+kind+(opts&&opts.soft?'s':'');
  if(cache[key]) return cache[key];
  let pal = palOf(c);
  if(opts && opts.soft) pal = Object.assign({}, pal, {O: pal.D});
  let rows;
  if(kind==="wave") rows = wave(baseSit(c,"happy"));
  else if(kind==="loaf") rows = LOAF;
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
const Pix = { COLORS, CNAME, sprite, icon, palOf };

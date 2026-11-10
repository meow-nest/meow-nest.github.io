// 遊戲：堆雪貓 ☃（冬季限定）
// 按住滾雪球當身體 → 再滾一顆當頭（頭比身體大會掉下來！）→ 用一大堆裝飾打扮雪貓 → 放進「雪貓展示區」給 ta 看，ta 可以按愛心。
(function(){
const VW = 120, VH = 150, GROUND = 134;
const OL = "#5b6b8c", SNOW = "#ffffff", SH1 = "#e6eef9", SH2 = "#cad8ec", SH3 = "#aebfdc", PINK = "#f7a7b8", BLUSH = "#ffb3c6", DARK = "#2d2440";
const COLORS = { red: ["#e5484d","#b52f3c"], pink: ["#f590aa","#d0647f"], orange: ["#f5944a","#cc6c2a"], yellow: ["#f7cc4a","#cf9f22"], green: ["#4fb88a","#2f8a63"],
  blue: ["#5e9de6","#3d72bb"], purple: ["#a785ea","#7a5bc2"], brown: ["#a8754e","#7a5233"], navy: ["#4a5a9a","#323f73"] };
const CNAME = { red: "紅", pink: "粉紅", orange: "橘", yellow: "黃", green: "綠", blue: "藍", purple: "紫", brown: "咖啡", navy: "深藍" };
const OPTS = {
  hat:   [["none","沒有"],["beanie","毛帽"],["santa","聖誕帽"],["muff","耳罩"],["bow","蝴蝶結"],["crown","皇冠"],["antler","麋鹿角"],["tophat","紳士帽"],["bucket","小水桶"],["holly","冬青花圈"],["halo","天使光環"]],
  neck:  [["none","沒有"],["plain","圍巾"],["stripe","條紋圍巾"],["plaid","格紋圍巾"],["hearts","愛心圍巾"],["bowtie","領結"],["bell","鈴鐺項圈"],["fur","毛毛領"]],
  eye:   [["dot","圓眼"],["shine","亮晶晶"],["happy","笑眼"],["wink","眨眼"],["heart","愛心眼"],["star","星星眼"],["sleep","睡覺"],["glasses","圓眼鏡"],["shades","墨鏡"]],
  nose:  [["pink","粉紅鼻"],["carrot","紅蘿蔔"],["red","紅鼻子"]],
  mouth: [["w","ω 嘴"],["smile","微笑"],["o","喔嘴"],["tongue","吐舌"],["fang","小虎牙"],["kiss","親親"]],
  cheek: [["blush","腮紅"],["heart","愛心腮紅"],["none","沒有"]],
  ear:   [["cat","貓耳"],["fold","折耳"],["none","沒有"]],
  hold:  [["none","沒有"],["twig","樹枝手"],["mitten","手套"],["cocoa","熱可可"],["gift","小禮物"],["wand","星星棒"],["balloon","愛心氣球"],["candy","拐杖糖"]],
  body:  [["none","沒有"],["coal","煤炭鈕扣"],["heartbtn","愛心鈕扣"],["sweater","毛衣"],["bellb","大鈴鐺"]],
  prop:  [["none","沒有"],["gifts","禮物堆"],["tree","聖誕樹"],["snowman","小雪人"],["bunny","雪兔"],["bird","小鳥"],["cocoa","熱可可"]],
  bg:    [["day","白天"],["night","夜晚"],["sunset","黃昏"],["aurora","極光"],["xmas","聖誕夜"],["storm","暴風雪"]],
};
// [分類, 名字, 顏色欄位, 這些選項才有顏色]
const TABS = [["draw","✏️ 畫畫"],["sticker","✨ 貼紙"],["hat","帽子","hatC",["beanie","muff","bow","tophat","bucket","santa"]],["neck","脖子","neckC",["plain","stripe","plaid","hearts","bowtie"]],["eye","眼睛"],["nose","鼻子"],["mouth","嘴巴"],["cheek","臉頰"],["ear","耳朵"],
  ["hold","手","holdC",["mitten","balloon","gift"]],["body","身上","bodyC",["sweater"]],["prop","旁邊"],["bg","背景"]];
const DEF = { rb: 26, rh: 18, hat: "beanie", hatC: "red", neck: "plain", neckC: "blue", eye: "dot", nose: "pink", mouth: "w", cheek: "blush", ear: "cat", hold: "twig", holdC: "pink", body: "coal", bodyC: "green", prop: "none", bg: "day", st: [] };

// ---------- 像素貼紙 ----------
const PAL = ["", "#ffffff","#cfd8e6","#2d2440","#e5484d","#f590aa","#f5944a","#f7cc4a","#4fb88a","#2f8a63","#9fd0ff","#5e9de6","#3d4f9a","#a785ea","#a8754e","#6a4a2e","#ffe0bd"];
const PCH = "0123456789abcdefg";
const mkSt = rows => ({ w: Math.max(...rows.map(r => r.length)), h: rows.length, p: rows.map(r => r.padEnd(Math.max(...rows.map(x => x.length)), ".")).join("").replace(/\./g, "0") });
const PRESETS = [
  ["雪花", mkSt(["....b....",".b..b..b.","..b.b.b..","...bbb...","bbbbbbbbb","...bbb...","..b.b.b..",".b..b..b.","....b...."])],
  ["星星", mkSt(["....e....","...e7e...","eeee7eeee","e7777777e",".e77777e.","..e777e..",".e7e.e7e.",".ee...ee."])],
  ["愛心", mkSt([".44...44.","4554.4554","455555554","455555554",".4555554.","..45554..","...454...","....4...."])],
  ["禮物", mkSt(["..77.77..","...777...","333373333","344474443","333373333",".3447443.",".3447443.",".3447443.",".3333333."])],
  ["拐杖糖", mkSt(["..441..",".4..14.",".1...4.",".....1.",".....4.",".....1.",".....4.",".....1.",".....4."])],
  ["鈴鐺", mkSt(["....e....","...e7e...","..e777e..",".e77777e.",".e77777e.","e7777777e","eeeeeeeee","...e7e...","....e...."])],
  ["月亮", mkSt(["..777...",".77.....","77......","77......","77......",".77.....","..777..."])],
  ["小魚", mkSt(["..bbbb..b.",".baaaab.bb","ba3aaaabb.",".baaaab.bb","..bbbb..b."])],
  ["手套", mkSt([".444....","45554...","45554.4.","4555454.","45555554","45555554","41111114","44444444"])],
  ["樹", mkSt(["....7....","...898...","..89998..","...898...","..89998..",".8999998.","..89998..",".8999998.","899999998","....f....","....f...."])],
];
function drawSticker(P, st, sel){
  const s = st.s || 1;
  for(let j = 0; j < st.h; j++) for(let i = 0; i < st.w; i++){ const c = PAL[PCH.indexOf(st.p[j*st.w + i])]; if(c) P.rect(st.x + i*s, st.y + j*s, s, s, c); }
  if(sel){ const w = st.w*s, h = st.h*s; for(let i = -1; i <= w; i += 2){ P.px(st.x + i, st.y - 2, "#ff3d9a"); P.px(st.x + i, st.y + h + 1, "#ff3d9a"); } for(let j = -1; j <= h; j += 2){ P.px(st.x - 2, st.y + j, "#ff3d9a"); P.px(st.x + w + 1, st.y + j, "#ff3d9a"); } }
}
// 把畫好的 16×16 裁成剛好的大小
function cropDrawing(cells){ let x0 = 16, y0 = 16, x1 = -1, y1 = -1;
  for(let y = 0; y < 16; y++) for(let x = 0; x < 16; x++) if(cells[y*16 + x]){ x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  if(x1 < 0) return null; const w = x1 - x0 + 1, h = y1 - y0 + 1; let p = "";
  for(let y = y0; y <= y1; y++) for(let x = x0; x <= x1; x++) p += PCH[cells[y*16 + x]]; return { w, h, p }; }

// ---------- 像素畫筆 ----------
function painter(cv){
  const g = cv.getContext("2d");
  const px = (x, y, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), 1, 1); };
  const rect = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h))); };
  // 橢圓（有描邊和立體陰影）
  const oval = (cx, cy, rx, ry, fill, o = {}) => {
    const ol = o.ol === undefined ? OL : o.ol;
    for(let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) for(let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++){
      const dx = (x + .5 - cx)/rx, dy = (y + .5 - cy)/ry, d = dx*dx + dy*dy; if(d > 1) continue;
      if(o.clip && !o.clip(x, y)) continue;
      const ex = (x + .5 - cx)/(rx - 1.05), ey = (y + .5 - cy)/(ry - 1.05);
      if(ol && ex*ex + ey*ey > 1){ px(x, y, ol); continue; }
      let c = fill;
      if(o.shade){ const s = dx*.5 + dy*.86; const S = o.shade;
        if(s > .78 && S[2]) c = S[2]; else if(s > .45) c = S[1]; else if(s > .05) c = S[0];
        if(o.hi && s < -.5 && d < .55) c = o.hi; }
      px(x, y, c);
    } };
  const disc = (cx, cy, r, fill, o) => oval(cx, cy, r, r, fill, o);
  const poly = (pts, fill, ol) => {
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const inside = (x, y) => { let c = false; for(let i = 0, j = pts.length - 1; i < pts.length; j = i++){ const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if(((yi > y) !== (yj > y)) && (x < (xj - xi)*(y - yi)/(yj - yi) + xi)) c = !c; } return c; };
    for(let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) for(let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x++){
      if(!inside(x + .5, y + .5)) continue;
      const edge = ol && (!inside(x - .5, y + .5) || !inside(x + 1.5, y + .5) || !inside(x + .5, y - .5) || !inside(x + .5, y + 1.5));
      px(x, y, edge ? ol : fill); } };
  const line = (x0, y0, x1, y1, c, w) => { const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
    for(let i = 0; i <= n; i++){ const x = x0 + (x1 - x0)*i/n, y = y0 + (y1 - y0)*i/n; if(w > 1) rect(x - w/2 + .5, y - w/2 + .5, w, w, c); else px(x, y, c); } };
  const heart = (x, y, c, s) => { s = s || 1; [[1,0],[2,0],[4,0],[5,0],[0,1],[1,1],[2,1],[3,1],[4,1],[5,1],[6,1],[0,2],[1,2],[2,2],[3,2],[4,2],[5,2],[6,2],[1,3],[2,3],[3,3],[4,3],[5,3],[2,4],[3,4],[4,4],[3,5]]
    .forEach(([a, b]) => rect(x + a*s - 3*s, y + b*s - 2*s, s, s, c)); };
  const star = (x, y, c, c2) => { px(x, y - 2, c); rect(x - 1, y - 1, 3, 1, c); rect(x - 2, y, 5, 1, c); px(x - 1, y + 1, c); px(x + 1, y + 1, c); px(x - 2, y + 2, c2 || c); px(x + 2, y + 2, c2 || c); };
  return { g, px, rect, oval, disc, poly, line, heart, star };
}
const col = (d, k) => COLORS[d[k]] || COLORS.red;

// ---------- 背景 ----------
const BGC = new Map();
function drawBg(P, bg, t){
  const key = bg + "|" + Math.floor(t*4);
  let c = BGC.get(key);
  if(!c){ c = document.createElement("canvas"); c.width = VW; c.height = VH; paintBg(painter(c), bg, Math.floor(t*4)/4); BGC.set(key, c); if(BGC.size > 6) BGC.delete(BGC.keys().next().value); }
  P.g.drawImage(c, 0, 0);
}
function paintBg(P, bg, t){
  const { rect, px, disc, oval, poly } = P;
  const SK = { day: ["#a9d4ff","#b8dcff","#c7e4ff","#d6ebff","#e4f2ff","#eef7ff"], night: ["#141a3a","#1a2148","#212a57","#283366","#303d75","#384783"],
    sunset: ["#ffb98f","#ffb39a","#ffaea6","#ffa9b2","#f9a6bd","#f2a5c8"], aurora: ["#0f1530","#141c3d","#18244a","#1d2b57","#223364","#283c72"],
    xmas: ["#1a1f45","#1f2650","#252e5c","#2b3668","#323f75","#394882"], storm: ["#b9c4d6","#c2ccdc","#cbd4e2","#d4dce8","#dde3ee","#e5eaf3"] }[bg] || [];
  for(let i = 0; i < 6; i++) rect(0, i*23, VW, 24, SK[i]);
  const dark = bg === "night" || bg === "aurora" || bg === "xmas";
  if(dark){ for(let i = 0; i < 26; i++){ const x = (i*47) % VW, y = (i*29) % 70 + 3, tw = Math.sin(t*2.2 + i*1.7) > -.2; px(x, y, tw ? "#fff7d1" : "#7e88c0"); if(i % 7 === 0 && tw){ px(x - 1, y, "#c9cff0"); px(x + 1, y, "#c9cff0"); px(x, y - 1, "#c9cff0"); px(x, y + 1, "#c9cff0"); } } }
  if(bg === "aurora") for(let x = 0; x < VW; x++){ const y = 26 + Math.sin(x/11 + t*.6)*7 + Math.sin(x/5)*2; for(let k = 0; k < 16; k++){ const a = 1 - k/16; if(((x*31 + k*17) % 100)/100 < a*.55) px(x, y + k, k < 5 ? "#9ff5c8" : k < 10 ? "#6fe0b5" : "#a58cf0"); } }
  if(bg === "night" || bg === "xmas") { disc(96, 20, 9, "#fff3c4", { ol: "#e8d48a" }); disc(100, 17, 8, SK[0], { ol: false }); }
  if(bg === "sunset") { disc(90, 54, 12, "#ffe08a", { ol: "#ffb35c" }); rect(78, 56, 24, 1, "#ffc87a"); }
  if(bg === "day") { disc(20, 18, 8, "#fff6b0", { ol: "#ffd45c" }); [[70,16],[84,14],[94,18]].forEach(([x,y]) => oval(x, y, 9, 4, "#ffffff", { ol: false })); }
  // 遠山
  const H1 = dark ? "#c9d4f0" : bg === "sunset" ? "#fbe9ef" : "#f4f8ff", H2 = dark ? "#a8b6dd" : bg === "sunset" ? "#efd0dc" : "#dce7f7";
  oval(18, 132, 44, 34, H1, { ol: false, shade: [H1, H2] }); oval(104, 136, 46, 38, H1, { ol: false, shade: [H1, H2] });
  // 松樹
  const tree = (x, y, s, lights) => {
    for(let k = 0; k < 3; k++){ const w = (12 - k*3)*s, top = y - (10 + k*8)*s; poly([[x, top - 8*s], [x - w, top + 6*s], [x + w, top + 6*s]], k === 2 ? "#4fa37a" : "#3f8f6a", "#24563f");
      rect(x - w + 2, top + 5*s, w*1.2, 1, "#ffffff"); }
    rect(x - 1, y - 4*s, 3, 6*s, "#7a5232");
    if(lights) [[-4,-9],[3,-14],[-2,-20],[4,-24],[-5,-27],[1,-32]].forEach(([a, b], i) => px(x + a*s, y + b*s, ["#ff6b6b","#ffd34d","#6bd3ff","#ff9df0"][(i + Math.floor(t*3)) % 4]));
    if(lights) P.star(x, y - 46*s, "#ffd34d", "#e8a400"); };
  tree(12, 122, .9, bg === "xmas"); tree(108, 120, 1, bg === "xmas");
  if(bg === "xmas"){ for(let x = 0; x < VW; x += 1){ const y = 44 + Math.sin(x/9)*4; px(x, y, "#5b4a3a"); if(x % 7 === 3) { const c = ["#ff6b6b","#ffd34d","#6bd3ff","#9dff8f"][(x + Math.floor(t*4)) % 4]; rect(x - 1, y + 1, 2, 2, c); } } }
  // 雪地
  const G1 = dark ? "#e3eaf8" : "#fbfdff", G2 = dark ? "#c3cfea" : "#dfe9f6";
  rect(0, GROUND - 6, VW, VH - GROUND + 6, G1); for(let x = 0; x < VW; x++){ const y = GROUND - 6 + Math.round(Math.sin(x/8)*1.5); rect(x, y, 1, 1, G2); }
  for(let i = 0; i < 18; i++){ const x = (i*41) % VW, y = GROUND - 2 + (i*13) % 14; px(x, y, G2); if(i % 3 === 0) px(x + 1, y, Math.sin(t*3 + i) > .6 ? "#ffffff" : G2); }
}

function drawSnow(P, t, n, bg){
  const many = bg === "storm";
  for(let i = 0; i < (n || (many ? 70 : 34)); i++){
    const sp = (many ? 22 : 8) + (i*7 % 11), x = (i*37 + Math.sin(t*1.3 + i)*4 + (many ? t*18 : 0) + 800) % VW, y = ((i*53 + t*sp) % (VH + 8)) - 4;
    P.px(x, y, "#ffffff"); if(i % 3 === 0){ P.px(x + 1, y, "#ffffff"); P.px(x, y + 1, "#ffffff"); P.px(x + 1, y + 1, "#e8f0fa"); }
  }
}

// ---------- 旁邊的小東西 ----------
function drawProp(P, d, t){
  const { rect, px, disc, oval, poly, heart, line } = P;
  const gx = 18, gy = GROUND;
  if(d.prop === "gifts"){ [[6, 12, 12, "red"], [18, 10, 9, "green"], [11, 9, 20, "yellow"]].forEach(([x, w, h, c], i) => { const C = COLORS[c]; const y = gy - h + (i === 2 ? -9 : 0);
      rect(x, y, w, h, C[0]); rect(x, y, w, 1, OL); rect(x, y + h - 1, w, 1, OL); rect(x, y, 1, h, OL); rect(x + w - 1, y, 1, h, OL); rect(x + w/2 - 1, y, 2, h, "#ffffff"); rect(x, y + h/2 - 1, w, 2, "#ffffff");
      px(x + w/2 - 3, y - 2, "#ffffff"); px(x + w/2 - 2, y - 1, "#ffffff"); px(x + w/2 + 2, y - 2, "#ffffff"); px(x + w/2 + 1, y - 1, "#ffffff"); }); }
  if(d.prop === "tree"){ const x = 16; for(let k = 0; k < 3; k++){ const w = 11 - k*3, top = gy - 8 - k*8; poly([[x, top - 8], [x - w, top + 5], [x + w, top + 5]], "#3f9a6a", "#24563f"); }
    rect(x - 1, gy - 6, 3, 6, "#7a5232"); [[-5,-10],[4,-12],[-2,-18],[3,-22],[-3,-27]].forEach(([a, b], i) => disc(x + a, gy + b, 1.4, ["#ff6b6b","#ffd34d","#6bd3ff","#ff9df0","#9dff8f"][i], { ol: false }));
    P.star(x, gy - 38, "#ffd34d", "#e8a400"); }
  if(d.prop === "snowman"){ disc(gx, gy - 6, 6, SNOW, { shade: [SH1, SH2, SH3] }); disc(gx, gy - 15, 4.5, SNOW, { shade: [SH1, SH2, SH3] }); px(gx - 2, gy - 16, DARK); px(gx + 1, gy - 16, DARK); rect(gx, gy - 14, 3, 1, "#f5944a");
    rect(gx - 4, gy - 20, 8, 1, DARK); rect(gx - 3, gy - 24, 6, 4, DARK); rect(gx - 3, gy - 21, 6, 1, "#e5484d"); }
  if(d.prop === "bunny"){ oval(gx, gy - 5, 7, 5, SNOW, { shade: [SH1, SH2, SH3] }); oval(gx + 5, gy - 10, 4.5, 4, SNOW, { shade: [SH1, SH2, SH3] });
    oval(gx + 3, gy - 17, 1.6, 4.5, SNOW); oval(gx + 7, gy - 17, 1.6, 4.5, SNOW); px(gx + 3, gy - 17, PINK); px(gx + 7, gy - 17, PINK); px(gx + 6, gy - 11, "#e5484d"); px(gx + 3, gy - 11, "#e5484d"); px(gx + 5, gy - 9, PINK); disc(gx - 7, gy - 6, 2, SNOW, { ol: OL }); }
  if(d.prop === "bird"){ const y = gy - 8 + Math.round(Math.sin(t*4)); oval(gx, y, 6, 5, "#e5484d", { shade: ["#e5484d","#b52f3c"] }); disc(gx + 4, y - 4, 3.5, "#e5484d", { shade: ["#e5484d","#b52f3c"] });
    px(gx + 5, y - 5, DARK); rect(gx + 8, y - 4, 2, 1, "#f7b733"); oval(gx - 1, y + 1, 3, 2, "#ffd6d6", { ol: false }); line(gx - 2, y + 5, gx - 2, y + 7, "#c08040"); line(gx + 2, y + 5, gx + 2, y + 7, "#c08040"); }
  if(d.prop === "cocoa"){ const x = 12, y = gy - 13; rect(x, y, 12, 13, "#f590aa"); rect(x, y, 12, 1, OL); rect(x, y + 12, 12, 1, OL); rect(x, y, 1, 13, OL); rect(x + 11, y, 1, 13, OL); rect(x + 1, y + 1, 10, 2, "#8a5a3a");
    disc(x + 4, y, 2.5, SNOW, { ol: false }); disc(x + 7, y - 1, 2.5, SNOW, { ol: false }); oval(x + 14, y + 6, 3, 4, "#f590aa", { ol: OL }); oval(x + 14, y + 6, 1, 2, "#f590aa", { ol: false }); heart(x + 6, y + 7, "#ffffff");
    for(let k = 0; k < 3; k++){ const sy = y - 6 - k*3 - ((t*8) % 3); px(x + 4 + Math.sin(t*3 + k)*1.5, sy, "rgba(255,255,255,.8)"); px(x + 8 + Math.cos(t*3 + k)*1.5, sy - 1, "rgba(255,255,255,.7)"); } }
}

// ---------- 雪貓本體 ----------
function drawCat(P, d, o){
  o = o || {}; const { disc, oval, rect, px, poly, line, heart, star } = P; const t = o.t || 0;
  const cx = 60, rb = d.rb, rh = d.rh, deco = o.deco !== false;
  const by = o.by != null ? o.by : GROUND - rb + 3;
  const hy = o.hy != null ? o.hy : by - rb - rh + 7;
  const hx = cx + (o.hdx || 0);
  const SNOWS = [SH1, SH2, SH3];
  if(!o.noBody){
    if(deco && o.prop !== false) drawProp(P, d, t);
    // 尾巴：一圈雪球
    // 尾巴：一條彎彎的貓尾巴（先畫一圈描邊、再填白色，看起來才是連在一起的一條）
    if(!o.noTail){ const pts = []; for(let i = 0; i <= 22; i++){ const u = i/22; pts.push([cx + rb*(.78 + .42*Math.sin(u*Math.PI*.85)) - (u > .82 ? (u - .82)*rb*.9 : 0), by + rb*(.62 - 1.05*u), 4.6 - u*1.8]); }
      pts.forEach(([x, y, r]) => disc(x, y, r, OL, { ol: false }));
      pts.forEach(([x, y, r], i) => disc(x, y, r - 1.1, i > 17 ? SH1 : SNOW, { ol: false }));
      pts.forEach(([x, y, r], i) => { if(i % 3 === 0) px(x + r*.4, y + r*.3, SH2); }); }
    // 手（在身體後面）
    const hold = deco ? d.hold : "none";
    const armEnd = s => [cx + s*(rb*.86 + 13), by - rb*.42 - 10];
    if(hold !== "none"){
      [-1, 1].forEach(s => { const x0 = cx + s*rb*.8, y0 = by - rb*.3, [x1, y1] = armEnd(s);
        line(x0, y0, x1, y1, "#7a5232", 2); line(x0, y0 + 1, x1, y1 + 1, "#5e3d22"); line(x1 - s*5, y1 + 4, x1 - s*8, y1 - 2, "#7a5232", 1); line(x1 - s*1, y1, x1 + s*3, y1 - 3, "#7a5232", 1); });
      const L = armEnd(-1), R = armEnd(1);
      if(hold === "mitten") [L, R].forEach(([x, y], i) => { const c = col(d, "holdC"); oval(x, y - 1, 4.5, 4, c[0], { shade: [c[0], c[1]] }); disc(x + (i ? -3.5 : 3.5), y + 1, 2, c[0], { ol: OL }); rect(x - 3, y + 2, 7, 2, "#ffffff"); });
      if(hold === "cocoa"){ const [x, y] = R; rect(x - 4, y - 9, 9, 10, "#f5f5f5"); rect(x - 4, y - 9, 9, 1, OL); rect(x - 4, y, 9, 1, OL); rect(x - 4, y - 9, 1, 10, OL); rect(x + 4, y - 9, 1, 10, OL); rect(x - 3, y - 8, 7, 2, "#8a5a3a"); heart(x, y - 4, "#e5486a");
        for(let k = 0; k < 2; k++) px(x - 1 + k*3 + Math.sin(t*3 + k), y - 12 - ((t*7) % 3), "#ffffff"); }
      if(hold === "gift"){ const [x, y] = R, c = col(d, "holdC"); rect(x - 5, y - 9, 11, 10, c[0]); rect(x - 5, y - 9, 11, 1, OL); rect(x - 5, y, 11, 1, OL); rect(x - 5, y - 9, 1, 10, OL); rect(x + 5, y - 9, 1, 10, OL); rect(x - 1, y - 9, 2, 10, "#ffffff"); rect(x - 5, y - 5, 11, 2, "#ffffff"); px(x - 2, y - 11, "#ffffff"); px(x + 2, y - 11, "#ffffff"); px(x - 1, y - 10, "#ffffff"); px(x + 1, y - 10, "#ffffff"); }
      if(hold === "wand"){ const [x, y] = R; line(x, y, x + 6, y - 14, "#f7cc4a", 1); const tw = Math.sin(t*5) > 0; star(x + 7, y - 17, tw ? "#fff07a" : "#ffd34d", "#e8a400"); if(tw){ px(x + 12, y - 20, "#fff7d1"); px(x + 2, y - 21, "#fff7d1"); } }
      if(hold === "balloon"){ const [x, y] = R, c = col(d, "holdC"), sway = Math.sin(t*1.6)*2; line(x, y, x + 4 + sway, y - 24, "#8a7a8a", 1); heart(x + 4 + sway, y - 30, c[0], 2); px(x + 1 + sway, y - 33, "#ffffff"); px(x + 2 + sway, y - 34, "#ffffff"); }
      if(hold === "candy"){ const [x, y] = R; for(let k = 0; k < 14; k++) rect(x + 1, y - k, 2, 1, k % 4 < 2 ? "#e5484d" : "#ffffff"); [[2,-14],[3,-15],[4,-16],[6,-16],[7,-15],[7,-14]].forEach(([a, b], i) => rect(x + a, y + b, 2, 1, i % 2 ? "#ffffff" : "#e5484d")); }
    }
    // 身體
    oval(cx, by, rb, rb*.94, SNOW, { shade: SNOWS, hi: "#ffffff" });
    if(deco && d.body === "sweater"){ const c = col(d, "bodyC"); oval(cx, by, rb, rb*.94, c[0], { shade: [c[0], c[0], c[1]], clip: (x, y) => y >= by - rb*.62 && y <= by + rb*.25 });
      for(let x = Math.round(cx - rb); x < cx + rb; x += 4){ const y = by - rb*.15; px(x, y, "#ffffff"); px(x + 1, y - 1, "#ffffff"); px(x + 2, y, "#ffffff"); }
      for(let x = Math.round(cx - rb) + 2; x < cx + rb; x += 6) heart(x, by - rb*.42, "#ffffff"); }
    // 前腳
    [-1, 1].forEach(s => { const x = cx + s*rb*.36, y = GROUND - 1; oval(x, y - 2, rb*.25 + 1, rb*.15 + 1.5, SNOW, { shade: SNOWS }); line(x - 1, y - 3, x - 1, y - 1, SH3); line(x + 2, y - 3, x + 2, y - 1, SH3); });
    if(deco){
      if(d.body === "coal") [-.38, -.02, .34].forEach(k => { const y = by + rb*k; rect(cx - 1, y - 1, 3, 3, DARK); px(cx, y - 1, "#5a5070"); });
      if(d.body === "heartbtn") [-.34, .12].forEach(k => heart(cx + 1, by + rb*k, "#e5486a"));
      if(d.body === "bellb"){ disc(cx, by - rb*.45, 4.5, "#f7cc4a", { shade: ["#f7cc4a","#d9a520"] }); rect(cx - 2, by - rb*.45 + 1, 5, 1, "#8a6a1a"); px(cx - 1, by - rb*.45 - 2, "#fff7d1"); }
    }
  }
  if(o.noHead) return;
  // 耳朵（在頭後面）
  if(d.ear === "cat") [-1, 1].forEach(s => { const a = [hx + s*rh*.95, hy - rh*.22], b = [hx + s*rh*.66, hy - rh - 7], c = [hx + s*rh*.08, hy - rh*.86];
    poly([a, b, c], SNOW, OL); poly([[a[0] - s*3, a[1] - 3.5], [b[0] - s*1, b[1] + 5], [c[0] + s*3.5, c[1] + .5]], PINK); });
  if(d.ear === "fold") [-1, 1].forEach(s => oval(hx + s*rh*.72, hy - rh*.72, rh*.38, rh*.3, SNOW, { shade: SNOWS }));
  // 頭
  oval(hx, hy, rh, rh*.92, SNOW, { shade: SNOWS, hi: "#ffffff" });
  // 臉頰
  const ey = Math.round(hy - rh*.02), ex = Math.max(4, Math.round(rh*.44));
  if(d.cheek !== "none") [-1, 1].forEach(s => { const x = hx + s*(ex + 2.5), y = ey + 4; if(d.cheek === "heart") heart(x + (s > 0 ? 1 : 0), y, "#ff8fab"); else oval(x, y, 2.6, 1.6, BLUSH, { ol: false }); });
  // 眼睛
  const eye = (s, kind) => { const x = Math.round(hx + s*ex), y = ey;
    if(kind === "dot"){ rect(x - 1, y - 2, 3, 4, DARK); px(x - 1, y - 2, "#ffffff"); }
    if(kind === "shine"){ oval(x, y, 2.6, 3.2, DARK, { ol: false }); px(x - 1, y - 2, "#ffffff"); px(x, y - 2, "#ffffff"); px(x - 1, y - 1, "#ffffff"); px(x + 1, y + 1, "#ffffff"); }
    if(kind === "happy"){ px(x - 2, y, DARK); px(x - 1, y - 1, DARK); px(x, y - 2, DARK); px(x + 1, y - 1, DARK); px(x + 2, y, DARK); }
    if(kind === "sleep"){ px(x - 2, y - 1, DARK); px(x - 1, y, DARK); px(x, y, DARK); px(x + 1, y, DARK); px(x + 2, y - 1, DARK); }
    if(kind === "heart") heart(x + (s > 0 ? 1 : 0), y - 1, "#e5486a");
    if(kind === "star") star(x, y, "#f7cc4a", "#e8a400"); };
  const k = d.eye;
  if(k === "wink"){ eye(-1, "shine"); eye(1, "happy"); }
  else if(k === "glasses"){ eye(-1, "dot"); eye(1, "dot"); [-1, 1].forEach(s => { const x = Math.round(hx + s*ex); for(let a = 0; a < 6.3; a += .2) px(x + Math.cos(a)*4.2, ey + Math.sin(a)*4.2, "#6a4a3a"); }); line(hx - ex + 4, ey - 1, hx + ex - 4, ey - 1, "#6a4a3a"); }
  else if(k === "shades"){ [-1, 1].forEach(s => { const x = Math.round(hx + s*ex); rect(x - 4, ey - 3, 8, 5, DARK); px(x - 3, ey - 2, "#7a86b8"); px(x - 2, ey - 2, "#7a86b8"); }); line(hx - ex + 4, ey - 2, hx + ex - 4, ey - 2, DARK); }
  else { eye(-1, k); eye(1, k); }
  // 鼻子、鬍鬚、嘴巴
  const ny = ey + 3, mx = Math.round(hx);
  [-1, 1].forEach(s => { line(hx + s*rh*.58, ny, hx + s*(rh + 3), ny - 2, "#9aa3bd"); line(hx + s*rh*.58, ny + 2, hx + s*(rh + 3), ny + 3, "#9aa3bd"); });
  if(d.nose === "carrot"){ poly([[mx - 1, ny - 1], [mx - 1, ny + 2], [mx + 9, ny + 1]], "#f5944a", "#c4621f"); px(mx + 2, ny, "#c4621f"); px(mx + 5, ny + 1, "#c4621f"); }
  else if(d.nose === "red"){ disc(mx, ny, 2.2, "#e5484d", { ol: "#a82a35" }); px(mx - 1, ny - 1, "#ffb0b0"); }
  else { rect(mx - 1, ny, 3, 1, "#f0708d"); px(mx, ny + 1, "#f0708d"); }
  const my = ny + 3;
  if(d.mouth === "w"){ [[-2,0],[-1,1],[0,0],[1,1],[2,0]].forEach(([a, b]) => px(mx + a, my + b, DARK)); }
  if(d.mouth === "smile"){ [[-3,0],[-2,1],[-1,1],[0,1],[1,1],[2,1],[3,0]].forEach(([a, b]) => px(mx + a, my + b, DARK)); }
  if(d.mouth === "o"){ rect(mx - 1, my, 3, 3, DARK); px(mx, my + 1, "#e5486a"); }
  if(d.mouth === "tongue"){ [[-2,0],[-1,1],[0,0],[1,1],[2,0]].forEach(([a, b]) => px(mx + a, my + b, DARK)); rect(mx - 1, my + 2, 3, 2, "#f0708d"); px(mx, my + 2, "#d94f70"); }
  if(d.mouth === "fang"){ [[-2,0],[-1,1],[0,0],[1,1],[2,0]].forEach(([a, b]) => px(mx + a, my + b, DARK)); px(mx - 1, my + 2, "#ffffff"); px(mx - 2, my + 2, OL); }
  if(d.mouth === "kiss"){ px(mx, my, DARK); px(mx + 1, my + 1, DARK); px(mx, my + 2, DARK); px(mx + 1, my + 3, DARK); px(mx, my + 4, DARK); heart(mx + 6, my - 2, "#ff8fab"); }
  if(!deco) return;
  // 脖子
  const nk = d.neck, nc = col(d, "neckC"), ny0 = Math.round(hy + rh*.72), w = Math.min(rh*1.08, rb*.98);
  if(["plain","stripe","plaid","hearts"].includes(nk)){
    oval(hx, ny0 + 3, w, 4.5, nc[0], { shade: [nc[0], nc[0], nc[1]] });
    if(nk === "stripe") for(let x = Math.round(hx - w) + 2; x < hx + w - 1; x += 5) rect(x, ny0, 2, 7, "#ffffff");
    if(nk === "plaid"){ for(let x = Math.round(hx - w) + 2; x < hx + w - 1; x += 5) rect(x, ny0, 1, 7, nc[1]); rect(hx - w + 1, ny0 + 3, w*2 - 2, 1, "#ffffff"); }
    if(nk === "hearts") for(let x = Math.round(hx - w) + 5; x < hx + w - 3; x += 8) heart(x, ny0 + 3, "#ffffff");
    const tx = Math.round(hx + w*.32); rect(tx, ny0 + 6, 7, 13, nc[0]); rect(tx - 1, ny0 + 6, 1, 13, OL); rect(tx + 7, ny0 + 6, 1, 13, OL); rect(tx, ny0 + 18, 7, 1, nc[1]);
    if(nk === "stripe"){ rect(tx, ny0 + 9, 7, 2, "#ffffff"); rect(tx, ny0 + 14, 7, 2, "#ffffff"); } if(nk === "plaid"){ rect(tx + 3, ny0 + 6, 1, 13, nc[1]); rect(tx, ny0 + 11, 7, 1, "#ffffff"); }
    if(nk === "hearts") heart(tx + 4, ny0 + 11, "#ffffff");
    for(let i = 0; i < 7; i += 2) rect(tx + i, ny0 + 19, 1, 2, nc[1]);
  }
  if(nk === "bowtie"){ const y = ny0 + 2; poly([[hx, y], [hx - 8, y - 5], [hx - 8, y + 5]], nc[0], OL); poly([[hx, y], [hx + 8, y - 5], [hx + 8, y + 5]], nc[0], OL); disc(hx, y, 2.4, nc[1]); }
  if(nk === "bell"){ for(let x = -w*.8; x <= w*.8; x++) rect(hx + x, ny0 + 1 + (x*x)/(w*w)*3, 1, 3, "#e5484d"); disc(hx, ny0 + 7, 3.6, "#f7cc4a", { shade: ["#f7cc4a","#d9a520"] }); rect(hx - 1, ny0 + 8, 3, 1, "#8a6a1a"); px(hx - 1, ny0 + 5, "#fff7d1"); }
  if(nk === "fur"){ for(let x = -w; x <= w; x += 3) disc(hx + x, ny0 + 3 + Math.abs(x)/w*1.5, 3.2, "#fffaf3", { ol: "#c9b8a8", shade: ["#fffaf3","#efe3d6"] }); }
  // 帽子
  const h = d.hat, hc = col(d, "hatC");
  if(h === "beanie"){ const top = hy - rh*.56; oval(hx, hy - rh*.48, rh*.9, rh*.78, hc[0], { shade: [hc[0], hc[0], hc[1]], clip: (x, y) => y <= top });
    rect(hx - rh*.94, top - 1, rh*1.88, 5, hc[1]); rect(hx - rh*.94, top - 1, rh*1.88, 1, OL); rect(hx - rh*.94, top + 4, rh*1.88, 1, OL);
    for(let x = Math.round(hx - rh*.88); x < hx + rh*.88; x += 3) rect(x, top, 1, 4, hc[0]);
    for(let x = Math.round(hx - rh*.55); x < hx + rh*.55; x += 5) px(x, top - rh*.38, "#ffffff");
    disc(hx, hy - rh*1.28, 4.5, SNOW, { shade: [SH1, SH2] }); }
  if(h === "santa"){ const c = d.hatC === "red" || !d.hatC ? COLORS.red : hc; poly([[hx - rh*.95, hy - rh*.38], [hx + rh*.95, hy - rh*.38], [hx + rh*.7, hy - rh*1.2], [hx + rh*1.35, hy - rh*1.55], [hx + rh*.2, hy - rh*1.45]], c[0], OL);
    for(let x = -rh; x <= rh; x += 3) disc(hx + x, hy - rh*.4, 3, "#ffffff", { ol: false }); rect(hx - rh - 1, hy - rh*.4 + 2, rh*2 + 2, 1, SH2);
    disc(hx + rh*1.38, hy - rh*1.55, 4, SNOW, { shade: [SH1, SH2] }); }
  if(h === "muff"){ for(let a = Math.PI*1.06; a <= Math.PI*1.94; a += .03){ const x = hx + Math.cos(a)*(rh + 1.5), y = hy + Math.sin(a)*(rh*.92 + 1.5); rect(x - 1, y - 1, 3, 3, hc[1]); }
    [-1, 1].forEach(s => { disc(hx + s*rh*1.0, hy - rh*.02, rh*.4, hc[0], { shade: [hc[0], hc[0], hc[1]] }); px(hx + s*rh - 2, hy - rh*.2, "#ffffff"); px(hx + s*rh + 1, hy - rh*.12, "#ffffff"); }); }
  if(h === "bow"){ const bx = hx + rh*.55, byy = hy - rh*.86; poly([[bx, byy], [bx - 9, byy - 6], [bx - 9, byy + 5]], hc[0], OL); poly([[bx, byy], [bx + 9, byy - 6], [bx + 9, byy + 5]], hc[0], OL);
    px(bx - 6, byy - 2, "#ffffff"); px(bx + 6, byy - 2, "#ffffff"); disc(bx, byy, 2.8, hc[1]); line(bx - 1, byy + 2, bx - 4, byy + 8, hc[1], 2); line(bx + 1, byy + 2, bx + 4, byy + 8, hc[1], 2); }
  if(h === "crown"){ const y = hy - rh*.86, w2 = rh*.62; poly([[hx - w2, y + 3], [hx - w2, y - 6], [hx - w2*.5, y - 2], [hx, y - 9], [hx + w2*.5, y - 2], [hx + w2, y - 6], [hx + w2, y + 3]], "#f7cc4a", "#b8860b");
    rect(hx - w2 + 1, y + 1, w2*2 - 1, 1, "#d9a520"); px(hx, y - 3, "#e5484d"); px(hx - w2*.6, y - 1, "#5e9de6"); px(hx + w2*.6, y - 1, "#4fb88a"); px(hx - w2 + 2, y - 4, "#fff7d1"); }
  if(h === "antler") [-1, 1].forEach(s => { const x0 = hx + s*rh*.45, y0 = hy - rh*.82; line(x0, y0, x0 + s*5, y0 - 12, "#8a5a32", 2); line(x0 + s*3, y0 - 7, x0 + s*10, y0 - 10, "#8a5a32", 2); line(x0 + s*4, y0 - 10, x0 + s*1, y0 - 17, "#8a5a32", 2); line(x0 + s*8, y0 - 9, x0 + s*11, y0 - 15, "#8a5a32", 2); });
  if(h === "tophat"){ const y = hy - rh*.78; rect(hx - rh*.85, y, rh*1.7, 3, DARK); rect(hx - rh*.55, y - 15, rh*1.1, 16, DARK); rect(hx - rh*.55, y - 5, rh*1.1, 3, hc[0]); px(hx - rh*.45, y - 13, "#5a5070"); px(hx - rh*.45, y - 12, "#5a5070"); }
  if(h === "bucket"){ const y = hy - rh*.78; poly([[hx - rh*.7, y + 2], [hx + rh*.7, y + 2], [hx + rh*.5, y - 13], [hx - rh*.5, y - 13]], hc[0], OL); rect(hx - rh*.72, y, rh*1.44, 2, hc[1]); rect(hx - rh*.5, y - 13, rh, 2, hc[1]);
    line(hx - rh*.4, y - 10, hx - rh*.45, y - 2, "#ffffff"); }
  if(h === "holly"){ for(let a = Math.PI*1.12; a <= Math.PI*1.88; a += .2){ const x = hx + Math.cos(a)*rh*.86, y = hy + Math.sin(a)*rh*.8; oval(x, y, 3.2, 2, "#3f9a6a", { ol: "#24563f" }); }
    [[-.3, -.95], [.05, -1.0], [.38, -.93], [-.62, -.75], [.66, -.72]].forEach(([a, b]) => disc(hx + a*rh, hy + b*rh*.86, 1.8, "#e5484d", { ol: "#a82a35" })); }
  if(h === "halo"){ const y = hy - rh*1.25 + Math.sin(t*2)*1; for(let a = 0; a < 6.3; a += .05){ const x = hx + Math.cos(a)*rh*.62, yy = y + Math.sin(a)*3; rect(x, yy, 2, 1, Math.sin(a) > 0 ? "#f7cc4a" : "#fff07a"); } }
}

function sceneCache(holder, d, o){
  const tq = Math.floor((o.t || 0)*4), key = JSON.stringify([d.rb, d.rh, d.hat, d.hatC, d.neck, d.neckC, d.eye, d.nose, d.mouth, d.cheek, d.ear, d.hold, d.holdC, d.body, d.bodyC, d.prop, d.bg, o.hdx || 0, o.deco, tq]);
  if(!holder.__sc || holder.__sc.key !== key){ const c = (holder.__sc && holder.__sc.c) || document.createElement("canvas"); c.width = VW; c.height = VH;
    const P = painter(c); drawBg(P, d.bg, o.t || 0); drawCat(P, d, Object.assign({}, o, { t: tq/4 })); holder.__sc = { key, c }; }
  return holder.__sc.c; }
function render(cv, d, o){ o = o || {}; const P = painter(cv); P.g.clearRect(0, 0, VW, VH); P.g.drawImage(sceneCache(cv, d, o), 0, 0); (d.st || []).forEach((st, i) => drawSticker(P, st, o.sel === i)); if(o.snow !== false) drawSnow(P, o.t || 0, o.snowN, d.bg); }
function thumb(d){ const c = document.createElement("canvas"); c.width = VW; c.height = VH; render(c, Object.assign({}, DEF, d), { snow: false, t: 2 }); return c; }
function randomLook(d){ const r = a => a[(Math.random()*a.length)|0]; const cs = Object.keys(COLORS);
  ["hat","neck","eye","nose","mouth","cheek","ear","hold","body","prop","bg"].forEach(k => { d[k] = r(OPTS[k])[0]; });
  ["hatC","neckC","holdC","bodyC"].forEach(k => { d[k] = r(cs); }); if(d.eye === "shades" && Math.random() < .6) d.eye = "shine"; return d; }
window.SnowCat = { render, thumb, DEF, VW, VH, OPTS, randomLook, PRESETS, PAL };

// ---------- 遊戲 ----------
App.registerGame({
  id: "snowcat",
  solo: true,
  name: "堆雪貓",
  desc: "冬季限定！滾雪球堆一隻雪貓給 ta 看",
  icon: () => `<img src="${thumb(DEF).toDataURL()}" style="image-rendering:pixelated;width:100%;height:auto;display:block" alt="">`,
  mount(el, ctx){
    const { esc, SFX } = ctx, K = window.MiniKit;
    let s = null, alive = true, view = "lobby", raf = 0;
    const me = () => ctx.me.uid, partner = () => ctx.partner();
    const list = () => ((s && s.list) || []).slice().sort((a, b) => b.at - a.at);
    function lobby(){
      if(!alive || view !== "lobby") return; cancelAnimationFrame(raf); document.body.classList.remove("scBusy");
      const L = list(), p = partner();
      el.innerHTML = `<div class="box skLobby scLobby">
        <div class="scHero"><canvas width="${VW}" height="${VH}" id="scHero"></canvas></div>
        <p class="skIntro"><b>冬季限定</b> ☃<br>按住滾雪球當身體，再滾一顆當頭<br>（頭比身體大會掉下來喔！）<br>帽子、圍巾、熱可可…一大堆裝飾隨你搭～</p>
        <button class="btn" id="scGo">☃ 開始堆雪貓</button>
        <div class="k" style="text-align:center">每天第一隻雪貓送 2 個貓幣 🪙</div></div>
        <div class="box scGal"><h3>❄ 雪貓展示區 <span class="k">${L.length ? `${L.length} 隻` : ""}</span></h3>
        ${L.length ? `<div class="scGrid">${L.map(x => `<button class="scItem" data-id="${x.id}"><span class="scTh" data-d='${esc(JSON.stringify(x.d))}'></span><b>${x.by === me() ? "你" : esc(ctx.nameOf(x.by) || (p && p.name) || "ta")}</b><i>${Object.keys(x.likes || {}).length ? `❤ ${Object.keys(x.likes).length}` : ""}</i></button>`).join("")}</div>`
          : `<div class="k" style="text-align:center;padding:10px">還沒有雪貓，堆第一隻吧！${p ? `<br>堆好的雪貓 ${esc(p.name)} 也看得到 💕` : ""}</div>`}</div>`;
      el.querySelectorAll(".scTh").forEach(t => { try{ t.appendChild(thumb(JSON.parse(t.dataset.d))); }catch(e){} });
      el.querySelector("#scGo").addEventListener("click", build);
      el.querySelectorAll(".scItem").forEach(b => b.addEventListener("click", () => openItem(b.dataset.id)));
      const hero = el.querySelector("#scHero"), hd = Object.assign({}, DEF, L[0] ? L[0].d : { hat: "santa", neck: "stripe", neckC: "green", hold: "mitten", eye: "shine", prop: "gifts", bg: "night" }); const t0 = performance.now();
      const loop = () => { if(!el.contains(hero)) return; render(hero, hd, { t: (performance.now() - t0)/1000 }); raf = requestAnimationFrame(loop); }; loop();
    }
    function openItem(id){
      const x = list().find(i => i.id === id); if(!x) return; SFX.tap();
      const mineIt = x.by === me(), liked = !!(x.likes || {})[me()], n = Object.keys(x.likes || {}).length, xd = Object.assign({}, DEF, x.d);
      const box = document.createElement("div"); box.className = "careModal scView";
      box.innerHTML = `<div class="cmBox"><canvas width="${VW}" height="${VH}" class="scBig"></canvas>
        <div class="scBy">${mineIt ? "你" : esc(ctx.nameOf(x.by) || "ta")} 堆的雪貓・${new Date(x.at).toLocaleDateString("zh-TW", { month: "numeric", day: "numeric" })}</div>
        <div class="scBtns">${!mineIt ? `<button class="btn ${liked ? "sub" : ""}" id="scLike">${liked ? "❤ 已經按愛心了" : "❤ 按愛心"}</button>` : `<div class="k" style="text-align:center">${n ? `收到 ${n} 個愛心 ❤` : "還沒有人按愛心"}</div>`}
        ${mineIt ? `<button class="btn sub" id="scDel">🗑 融化它</button>` : ""}<button class="btn sub" id="scClose">關閉</button></div></div>`;
      document.body.appendChild(box);
      const cv = box.querySelector(".scBig"); const t0 = performance.now(); let r2 = 0;
      const loop = () => { if(!document.body.contains(cv)) return; render(cv, xd, { t: (performance.now() - t0)/1000 }); r2 = requestAnimationFrame(loop); }; loop();
      const close = () => { cancelAnimationFrame(r2); box.remove(); };
      box.querySelector("#scClose").addEventListener("click", close);
      box.addEventListener("click", e => { if(e.target === box) close(); });
      const lk = box.querySelector("#scLike"); if(lk) lk.addEventListener("click", async () => {
        if(liked) return; SFX.select(); ctx.burst();
        await ctx.update("snowcat", st => { const it = st && (st.list || []).find(i => i.id === id); if(!it) return undefined; it.likes = it.likes || {}; it.likes[me()] = Date.now(); return st; });
        ctx.notifyPartner(`${ctx.me.name} 幫你的雪貓按了愛心 ❤`); close(); });
      const dl = box.querySelector("#scDel"); if(dl) dl.addEventListener("click", async () => {
        if(!dl.dataset.ok){ dl.dataset.ok = "1"; dl.textContent = "再按一次就融化"; return; } SFX.miss();
        await ctx.update("snowcat", st => { if(!st) return undefined; st.list = (st.list || []).filter(i => !(i.id === id && i.by === me())); return st; }); close(); });
    }

    // ---------- 堆雪貓 ----------
    function build(){
      SFX.tap(); view = "build"; cancelAnimationFrame(raf); document.body.classList.add("scBusy");
      const d = Object.assign({}, DEF, { rb: 8, rh: 6, hat: "none", neck: "none", hold: "none", body: "none", st: [] });
      let stage = "body", holding = false, t0 = performance.now(), last = t0, drop = null, puffs = [], tab = "hat", shakeT = 0, sel = -1, drag = null;
      el.innerHTML = `<div class="box sc"><div class="scMsg" id="scMsg"></div><div class="scStage"><canvas width="${VW}" height="${VH}" class="scCv" id="scCv"></canvas></div><div id="scCtl"></div></div>`;
      const cv = el.querySelector("#scCv"), msg = el.querySelector("#scMsg"), ctl = el.querySelector("#scCtl");
      const say = h => { msg.innerHTML = `<span>${h}</span>`; msg.classList.remove("pop"); void msg.offsetWidth; msg.classList.add("pop"); };
      const sizeWord = (r, lo, hi) => r < lo + (hi - lo)*.33 ? "小小的" : r < lo + (hi - lo)*.7 ? "剛剛好" : "好大顆！";
      function rollCtl(label){
        ctl.innerHTML = `<button class="scRoll" id="scRoll"><span>${label}</span><i>按住不放</i></button>`;
        const b = ctl.querySelector("#scRoll");
        // 只有「手指離開螢幕」才算放開：安卓長按時瀏覽器會插手（pointercancel），不能把它當成放開
        const up = () => { if(!holding) return; holding = false; b.classList.remove("on"); ["pointerup","touchend","mouseup"].forEach(t => window.removeEventListener(t, up)); release(); };
        const down = e => { if(e.cancelable) e.preventDefault(); if(holding || (stage !== "body" && stage !== "head")) return; holding = true; b.classList.add("on"); SFX.tap();
          ["pointerup","touchend","mouseup"].forEach(t => window.addEventListener(t, up)); };
        b.addEventListener("pointerdown", down); b.addEventListener("touchstart", down, { passive: false });
        b.addEventListener("contextmenu", e => e.preventDefault());
      }
      function release(){
        if(stage === "body"){
          if(d.rb < 17){ say("太小了～再滾大一點！"); SFX.miss(); d.rb = 8; return; }
          SFX.place(); stage = "head"; d.rh = 6; delete msg.dataset.max; say(`身體${sizeWord(d.rb, 17, 34)} ✨<br>再滾一顆當<b>頭</b>（要比身體小喔）`); rollCtl("⛄ 滾頭");
        } else if(stage === "head"){
          if(d.rh < 11){ say("頭太小了～再滾大一點！"); SFX.miss(); d.rh = 6; return; }
          stage = "drop"; ctl.innerHTML = ""; drop = { y: -d.rh, v: 0, fail: d.rh >= d.rb - 1, t: 0, x: 0 };
        }
      }
      const myDraws = () => { try{ return JSON.parse(localStorage.getItem("mw_scDraw") || "[]"); }catch(e){ return []; } };
      const saveDraw = st => { try{ const L = myDraws().filter(x => x.p !== st.p); L.unshift({ w: st.w, h: st.h, p: st.p }); localStorage.setItem("mw_scDraw", JSON.stringify(L.slice(0, 12))); }catch(e){} };
      const stThumb = st => { const c = document.createElement("canvas"); c.width = st.w; c.height = st.h; drawSticker(painter(c), Object.assign({}, st, { x: 0, y: 0, s: 1 })); return c.toDataURL(); };
      function addSticker(base){
        if(d.st.length >= 12){ ctx.toast("貼紙最多 12 個喔"); return; }
        const sc = Math.max(1, Math.min(3, Math.round(18 / Math.max(base.w, base.h)) || 1));
        d.st.push({ w: base.w, h: base.h, p: base.p, s: sc, x: Math.round(60 - base.w*sc/2 + (Math.random() - .5)*30), y: Math.round(36 + Math.random()*30) });
        sel = d.st.length - 1; SFX.select(); decoCtl();
      }
      function selBar(){
        if(sel < 0 || !d.st[sel]) return "";
        return `<div class="scSel"><span>選到貼紙了，拖曳畫面可以移動</span><button data-s="small">➖</button><button data-s="big">➕</button><button data-s="front">⬆ 最上面</button><button data-s="del">🗑</button><button data-s="ok">✔</button></div>`;
      }
      function decoCtl(){
        if(tab === "draw") return drawCtl();
        const T = TABS.find(x => x[0] === tab);
        const tabsH = `<div class="scTabs">${TABS.map(([k, n]) => `<button class="scTab ${tab === k ? "on" : ""} ${k === "draw" || k === "sticker" ? "hot" : ""}" data-t="${k}">${n}</button>`).join("")}</div>`;
        let body = "";
        if(tab === "sticker"){
          const mine = myDraws();
          body = `<div class="k scHint">點一下就會貼到畫面上，再用手指拖曳到想要的位置 ✨</div>
            <div class="scStk">${PRESETS.map(([n, st], i) => `<button class="scSt" data-pre="${i}"><img src="${stThumb(st)}" alt=""><span>${n}</span></button>`).join("")}</div>
            ${mine.length ? `<div class="k scHint">我畫過的</div><div class="scStk">${mine.map((st, i) => `<button class="scSt" data-my="${i}"><img src="${stThumb(st)}" alt=""></button>`).join("")}</div>` : `<div class="k scHint">到「✏️ 畫畫」畫自己的貼紙，也會出現在這裡</div>`}`;
        } else {
          const opts = OPTS[tab], hasCol = T[2] && T[3].includes(d[tab]);
          body = `<div class="scOpts">${opts.map(([v, n]) => `<button class="scOpt ${d[tab] === v ? "on" : ""}" data-v="${v}">${n}</button>`).join("")}</div>
            ${hasCol ? `<div class="scCols">${Object.keys(COLORS).map(c => `<button class="scCol ${d[T[2]] === c ? "on" : ""}" data-c="${c}" style="background:${COLORS[c][0]}" aria-label="${CNAME[c]}"></button>`).join("")}</div>` : ""}`;
        }
        ctl.innerHTML = selBar() + tabsH + body + `<div class="scDone"><button class="btn sub" id="scRand">🎲 隨機</button><button class="btn sub" id="scRe">↩ 重堆</button><button class="btn" id="scOk">✅ 完成！</button></div>`;
        ctl.querySelectorAll(".scTab").forEach(b => b.addEventListener("click", () => { tab = b.dataset.t; SFX.key(.9); decoCtl(); }));
        ctl.querySelectorAll(".scOpt").forEach(b => b.addEventListener("click", () => { d[tab] = b.dataset.v; SFX.select(); shakeT = performance.now(); decoCtl(); }));
        ctl.querySelectorAll(".scCol").forEach(b => b.addEventListener("click", () => { d[T[2]] = b.dataset.c; SFX.key(1.1); shakeT = performance.now(); decoCtl(); }));
        ctl.querySelectorAll("[data-pre]").forEach(b => b.addEventListener("click", () => addSticker(PRESETS[+b.dataset.pre][1])));
        ctl.querySelectorAll("[data-my]").forEach(b => b.addEventListener("click", () => addSticker(myDraws()[+b.dataset.my])));
        ctl.querySelectorAll(".scSel [data-s]").forEach(b => b.addEventListener("click", () => { const st = d.st[sel]; if(!st) return; const k = b.dataset.s;
          if(k === "small" || k === "big"){ const cx0 = st.x + st.w*st.s/2, cy0 = st.y + st.h*st.s/2; st.s = Math.max(1, Math.min(4, st.s + (k === "big" ? 1 : -1))); st.x = Math.round(cx0 - st.w*st.s/2); st.y = Math.round(cy0 - st.h*st.s/2); SFX.key(1); }
          if(k === "front"){ d.st.splice(sel, 1); d.st.push(st); sel = d.st.length - 1; SFX.key(1); }
          if(k === "del"){ d.st.splice(sel, 1); sel = -1; SFX.miss(); }
          if(k === "ok"){ sel = -1; SFX.tap(); }
          decoCtl(); }));
        ctl.querySelector("#scRand").addEventListener("click", () => { randomLook(d); SFX.select(); shakeT = performance.now(); decoCtl(); });
        ctl.querySelector("#scRe").addEventListener("click", () => { SFX.tap(); build(); });
        ctl.querySelector("#scOk").addEventListener("click", () => { sel = -1; finish(); });
      }
      // ---------- 像素畫畫 ----------
      function drawCtl(){
        const N = 16, cells = new Array(N*N).fill(0); let color = 4, tool = "pen", painting = false;
        ctl.innerHTML = `<div class="pxEd"><div class="k scHint">畫一個自己的貼紙（16×16 格）</div>
          <canvas class="pxCv" width="${N*18}" height="${N*18}"></canvas>
          <div class="pxTools"><button data-tool="pen" class="on">✏️ 筆</button><button data-tool="erase">🧽 橡皮擦</button><button data-tool="fill">🪣 油漆桶</button><button id="pxClr">🗑 清空</button></div>
          <div class="pxPal">${PAL.slice(1).map((c, i) => `<button data-c="${i + 1}" class="${i + 1 === color ? "on" : ""}" style="background:${c}"></button>`).join("")}</div>
          <div class="scDone"><button class="btn sub" id="pxNo">取消</button><button class="btn" id="pxOk">✅ 貼到畫面上</button></div></div>`;
        const cv2 = ctl.querySelector(".pxCv"), g = cv2.getContext("2d");
        const paint = () => { for(let y = 0; y < N; y++) for(let x = 0; x < N; x++){ const c = cells[y*N + x]; g.fillStyle = c ? PAL[c] : ((x + y) % 2 ? "#f3f6fb" : "#e9eef6"); g.fillRect(x*18, y*18, 18, 18); }
          g.strokeStyle = "rgba(90,107,140,.25)"; g.lineWidth = 1; for(let i = 0; i <= N; i++){ g.beginPath(); g.moveTo(i*18 + .5, 0); g.lineTo(i*18 + .5, N*18); g.stroke(); g.beginPath(); g.moveTo(0, i*18 + .5); g.lineTo(N*18, i*18 + .5); g.stroke(); }
          g.strokeStyle = "rgba(229,72,106,.35)"; g.beginPath(); g.moveTo(8*18 + .5, 0); g.lineTo(8*18 + .5, N*18); g.moveTo(0, 8*18 + .5); g.lineTo(N*18, 8*18 + .5); g.stroke(); };
        const cellAt = e => { const r = cv2.getBoundingClientRect(); const x = Math.floor((e.clientX - r.left)/r.width*N), y = Math.floor((e.clientY - r.top)/r.height*N); return x >= 0 && y >= 0 && x < N && y < N ? [x, y] : null; };
        const flood = (x, y, to) => { const from = cells[y*N + x]; if(from === to) return; const q = [[x, y]]; while(q.length){ const [a, b] = q.pop(); if(a < 0 || b < 0 || a >= N || b >= N || cells[b*N + a] !== from) continue; cells[b*N + a] = to; q.push([a + 1, b], [a - 1, b], [a, b + 1], [a, b - 1]); } };
        const act = e => { const c = cellAt(e); if(!c) return; const [x, y] = c; if(tool === "fill"){ flood(x, y, color); SFX.key(1.2); } else { const v = tool === "erase" ? 0 : color; if(cells[y*N + x] !== v){ cells[y*N + x] = v; } } paint(); };
        cv2.addEventListener("pointerdown", e => { e.preventDefault(); painting = tool !== "fill"; cv2.setPointerCapture(e.pointerId); act(e); });
        cv2.addEventListener("pointermove", e => { if(painting) act(e); });
        const stop = () => { painting = false; }; cv2.addEventListener("pointerup", stop); cv2.addEventListener("pointercancel", stop);
        ctl.querySelectorAll("[data-tool]").forEach(b => b.addEventListener("click", () => { tool = b.dataset.tool; SFX.tap(); ctl.querySelectorAll("[data-tool]").forEach(x => x.classList.toggle("on", x === b)); }));
        ctl.querySelectorAll(".pxPal [data-c]").forEach(b => b.addEventListener("click", () => { color = +b.dataset.c; if(tool === "erase") { tool = "pen"; ctl.querySelectorAll("[data-tool]").forEach(x => x.classList.toggle("on", x.dataset.tool === "pen")); } SFX.key(1); ctl.querySelectorAll(".pxPal [data-c]").forEach(x => x.classList.toggle("on", x === b)); }));
        ctl.querySelector("#pxClr").addEventListener("click", () => { cells.fill(0); SFX.miss(); paint(); });
        ctl.querySelector("#pxNo").addEventListener("click", () => { tab = "sticker"; decoCtl(); });
        ctl.querySelector("#pxOk").addEventListener("click", () => { const st = cropDrawing(cells); if(!st){ ctx.toast("先畫一點東西喔"); return; } saveDraw(st); tab = "sticker"; addSticker(st); });
        paint();
      }
      // 在畫面上拖曳貼紙
      const scenePt = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left)/r.width*VW, (e.clientY - r.top)/r.height*VH]; };
      cv.addEventListener("pointerdown", e => { if(stage !== "deco") return; const [x, y] = scenePt(e);
        let hit = -1; for(let i = d.st.length - 1; i >= 0; i--){ const st = d.st[i]; if(x >= st.x - 2 && y >= st.y - 2 && x <= st.x + st.w*st.s + 2 && y <= st.y + st.h*st.s + 2){ hit = i; break; } }
        if(hit !== sel){ sel = hit; if(tab === "draw") tab = "sticker"; decoCtl(); }
        if(hit >= 0){ e.preventDefault(); cv.setPointerCapture(e.pointerId); drag = { dx: x - d.st[hit].x, dy: y - d.st[hit].y }; } });
      cv.addEventListener("pointermove", e => { if(!drag || sel < 0) return; const [x, y] = scenePt(e), st = d.st[sel];
        st.x = Math.round(Math.max(-st.w*st.s/2, Math.min(VW - st.w*st.s/2, x - drag.dx))); st.y = Math.round(Math.max(-st.h*st.s/2, Math.min(VH - st.h*st.s/2, y - drag.dy))); });
      const endDrag = () => { if(drag) SFX.place(); drag = null; }; cv.addEventListener("pointerup", endDrag); cv.addEventListener("pointercancel", endDrag);
      async function finish(){
        stage = "done"; SFX.level(); ctx.burst();
        const p = partner(), item = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), by: me(), at: Date.now(), d: Object.assign({}, d), likes: {} };
        let first = false; const day = new Date().toDateString();
        try{
          await ctx.update("snowcat", st => { st = st || {}; st.list = (st.list || []).concat([item]).sort((a, b) => b.at - a.at).slice(0, 24);
            st.day = st.day || {}; first = st.day[me()] !== day; st.day[me()] = day; return st; });
          if(first) await K.giveCoins(ctx, 2, "snowcat");
        }catch(e){ console.error(e); }
        if(p) ctx.notifyPartner(`${ctx.me.name} 堆了一隻雪貓給你看 ☃ 快去「堆雪貓」按愛心！`);
        if(!alive) return;
        say(`☃ 完成！${p ? `已經放進展示區，${esc(p.name)} 也看得到囉` : "已經放進雪貓展示區"}${first ? "<br>得到 2 個貓幣 🪙" : ""}`);
        ctl.innerHTML = `<div class="scDone"><button class="btn sub" id="scAgain">再堆一隻</button><button class="btn" id="scLob">去展示區看看</button></div>`;
        ctl.querySelector("#scAgain").addEventListener("click", build);
        ctl.querySelector("#scLob").addEventListener("click", () => { view = "lobby"; lobby(); });
      }
      say("按住下面的按鈕<br>滾一顆<b>大雪球</b>當身體 ☃"); rollCtl("☃ 滾雪球");
      const loop = now => {
        if(!el.contains(cv)) return;
        const dt = Math.min(.05, (now - last)/1000); last = now; const t = (now - t0)/1000;
        if(holding && stage === "body"){ d.rb = Math.min(34, d.rb + dt*9); if(Math.random() < .6) puffs.push({ x: 60 + (Math.random() - .5)*d.rb*2, y: GROUND - 1, vx: (Math.random() - .5)*26, vy: -12 - Math.random()*18, l: .5 }); if(d.rb >= 34 && !msg.dataset.max){ msg.dataset.max = 1; say("推不動了！放開吧～"); } }
        if(holding && stage === "head"){ d.rh = Math.min(30, d.rh + dt*8); }
        puffs.forEach(p => { p.x += p.vx*dt; p.y += p.vy*dt; p.vy += 50*dt; p.l -= dt; }); puffs = puffs.filter(p => p.l > 0);
        const P = painter(cv); P.g.clearRect(0, 0, VW, VH); drawBg(P, d.bg, t);
        const wob = stage === "deco" && now - shakeT < 300 ? Math.sin((now - shakeT)/30)*(1 - (now - shakeT)/300)*1.5 : 0;
        const bodyOnly = { noHead: true, deco: false, noTail: true, t };
        if(stage === "body") drawCat(P, d, bodyOnly);
        else if(stage === "head"){ drawCat(P, d, bodyOnly); const ry = GROUND - 2*d.rb - d.rh - 8; drawCat(P, d, { noBody: true, deco: false, hy: Math.max(d.rh + 4, ry), t }); }
        else if(stage === "drop"){
          const target = GROUND - d.rb + 3 - d.rb - d.rh + 7;
          if(!drop.landed){ drop.v += 320*dt; drop.y += drop.v*dt; if(drop.y >= target){ drop.y = target; drop.landed = true; drop.t = 0; SFX.place();
            if(!drop.fail){ stage = "deco"; Object.assign(d, { hat: "beanie", neck: "plain", hold: "twig", body: "coal" }); say("站好了！現在來<b>打扮</b>雪貓 🎀"); decoCtl(); } } }
          else if(drop.fail){ drop.t += dt; drop.x += (24 + drop.t*110)*dt; drop.y += drop.t*drop.t*70*dt;
            if(drop.t > .05 && !drop.said){ drop.said = 1; say("頭太大了…<b>掉下來了！</b>😹<br>再滾一顆小一點的頭"); SFX.miss(); }
            if(drop.t > 1.1){ stage = "head"; d.rh = 6; rollCtl("⛄ 再滾一次頭"); } }
          drawCat(P, d, bodyOnly); if(stage === "drop" || stage === "deco") drawCat(P, d, { noBody: true, deco: false, hy: drop.y, hdx: drop.x, t });
        }
        else { P.g.clearRect(0, 0, VW, VH); P.g.drawImage(sceneCache(cv, d, { hdx: Math.round(wob), t }), 0, 0); d.st.forEach((st, i) => drawSticker(P, st, stage === "deco" && i === sel && Math.floor(t*3) % 2 === 0)); }
        puffs.forEach(p => P.px(p.x, p.y, "#ffffff"));
        drawSnow(P, t, null, d.bg);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }
    this._u = ctx.onState("snowcat", st => { s = st; if(view === "lobby") lobby(); });
    this._stop = () => { alive = false; cancelAnimationFrame(raf); document.body.classList.remove("scBusy"); document.querySelectorAll(".scView").forEach(x => x.remove()); };
    (async () => { const cur = await ctx.getState("snowcat").catch(() => null); s = cur ? cur.state : null; lobby(); })();
  },
  unmount(){ if(this._u) this._u(); if(this._stop) this._stop(); },
});
if(window.GameArt) window.GameArt.snowcat = () => `<span class="gaL" style="left:20%;top:0;width:60%"><img src="${thumb({ bg: "night", hat: "santa", neck: "stripe", neckC: "green", eye: "shine", hold: "mitten", prop: "gifts" }).toDataURL()}" style="image-rendering:pixelated;width:100%;display:block;border:2px solid #5a3b2e" alt=""></span>`;
})();

// 貓貓的一生：像素場景（每年畫面的背景、結局相簿的照片）
// ClArt.scene(地方, 季節, 時間) → SVG 字串（80×40 格，crispEdges）
//   地方：home 家、stray 巷子、shop 雜貨店、farm 農場、star 星空（隱藏結局）
//   季節：0 春 1 夏 2 秋 3 冬；時間：morning／day／noon／dusk／night
(function(){
const W = 80, H = 40, cache = {};
const SKY = {
  morning:["#c9ecff","#f2fbff"], day:["#9fd8ff","#e3f5ff"], noon:["#ffd7a8","#fff1dc"],
  dusk:["#f49a8a","#ffd2b8"], night:["#1d1a44","#3b3170"],
};
const mix = (a, b, t) => { const p = h => [1,3,5].map(i => parseInt(h.slice(i, i + 2), 16)); const A = p(a), B = p(b);
  return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0")).join(""); };
// 固定的亂數（同一個場景每次畫出來都一樣）
const rng = seed => () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

function scene(where, season, tod){
  season = ((season | 0) % 4 + 4) % 4; tod = SKY[tod] ? tod : "day";
  const key = where + season + tod; if(cache[key]) return cache[key];
  const g = Array.from({ length: H }, () => Array(W).fill(null)), R = rng(7 + season * 13 + where.length * 31);
  const rect = (x, y, w, h, c) => { for(let j = Math.max(0, y); j < Math.min(H, y + h); j++) for(let i = Math.max(0, x); i < Math.min(W, x + w); i++) g[j][i] = c; };
  const px = (x, y, c) => { if(x >= 0 && x < W && y >= 0 && y < H) g[y][x] = c; };
  const sky = (y0, y1) => { const [a, b] = SKY[tod]; for(let y = y0; y < y1; y++) rect(0, y, W, 1, mix(a, b, (y - y0) / Math.max(1, y1 - y0 - 1))); };
  const ellipse = (cx, cy, rx, ry, c) => { for(let y = -ry; y <= ry; y++) for(let x = -rx; x <= rx; x++) if((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1) px(cx + x, cy + y, c); };
  const sunMoon = (x, y) => { if(tod === "night"){ ellipse(x, y, 3, 3, "#fff6cf"); px(x + 1, y - 1, "#e8dca8"); px(x - 1, y + 1, "#e8dca8"); }
    else if(tod === "dusk") ellipse(x, y, 3, 3, "#ffb36b"); else ellipse(x, y, 3, 3, "#ffe27a"); };
  const stars = (y0, y1, n) => { if(tod !== "night") return; for(let k = 0; k < n; k++){ const x = Math.floor(R() * W), y = y0 + Math.floor(R() * (y1 - y0)); px(x, y, R() < .3 ? "#ffe9a8" : "#ffffff"); } };
  const cloud = (x, y) => { if(tod === "night") return; const c = tod === "dusk" ? "#ffe4d6" : "#ffffff"; rect(x + 1, y, 5, 1, c); rect(x, y + 1, 8, 1, c); rect(x + 2, y + 2, 4, 1, c); };
  // 窗外的季節
  const view = (x, y, w, h) => { const [a, b] = SKY[tod];
    for(let j = 0; j < h; j++) rect(x, y + j, w, 1, mix(a, b, j / Math.max(1, h - 1)));
    if(tod === "night"){ for(let k = 0; k < 6; k++) px(x + 1 + Math.floor(R() * (w - 2)), y + 1 + Math.floor(R() * (h - 4)), "#ffffff"); }
    else if(season === 1){ ellipse(x + w - 4, y + 3, 2, 2, "#ffe27a"); }
    // 遠方的樹
    const tree = season === 0 ? ["#ffb7cf","#ff9fbf"] : season === 1 ? ["#6cc46b","#4fa955"] : season === 2 ? ["#f2994a","#e5703a"] : ["#ffffff","#dfe9f3"];
    rect(x, y + h - 3, w, 3, season === 3 ? "#eef4fa" : "#9ad48e");
    ellipse(x + 4, y + h - 5, 3, 2, tree[0]); ellipse(x + w - 5, y + h - 6, 3, 3, tree[1]); px(x + 4, y + h - 3, "#8a5a3c"); px(x + w - 5, y + h - 3, "#8a5a3c");
    const fx = season === 0 ? "#ffc8da" : season === 2 ? "#f5a35a" : season === 3 ? "#ffffff" : null;
    if(fx) for(let k = 0; k < 7; k++) px(x + Math.floor(R() * w), y + Math.floor(R() * (h - 3)), fx); };

  if(where === "home"){
    rect(0, 0, W, 28, "#f8e1c6"); for(let i = 3; i < W; i += 6) rect(i, 0, 1, 27, "#f2d3b2");
    rect(0, 26, W, 2, "#c58b5f"); rect(0, 28, W, 12, "#dcab7b");
    for(let y = 31; y < H; y += 3) rect(0, y, W, 1, "#c79566"); for(let y = 28; y < H; y += 3) for(let x = (y % 2) * 7; x < W; x += 14) px(x, y + 1, "#c79566");
    rect(5, 3, 20, 17, "#8a5a3c"); view(6, 4, 18, 15); rect(14, 4, 1, 15, "#8a5a3c"); rect(6, 11, 18, 1, "#8a5a3c"); rect(4, 19, 22, 2, "#a8754a");
    if(season === 3) rect(5, 18, 20, 1, "#ffffff");
    rect(3, 2, 2, 20, "#ff9fb8"); rect(25, 2, 2, 20, "#ff9fb8"); rect(3, 2, 24, 1, "#e5748f");
    rect(55, 5, 12, 10, "#a8754a"); rect(56, 6, 10, 8, "#fff6e6"); ellipse(61, 10, 2, 2, "#ff8fab"); px(61, 8, "#fff6e6");
    rect(46, 7, 6, 1, "#a8754a"); rect(47, 5, 2, 2, "#6fb7e8"); rect(49, 4, 2, 3, "#ffd36b");
    ellipse(40, 35, 14, 3, "#ffc2d1"); ellipse(40, 35, 11, 2, "#ffd6e0");
    rect(71, 30, 6, 6, "#c96f4a"); rect(70, 29, 8, 2, "#b45c3a"); ellipse(74, 25, 4, 4, season === 2 ? "#e9a23b" : season === 3 ? "#8dbf8a" : "#6cc46b"); px(72, 23, "#4fa955"); px(76, 26, "#4fa955");
    rect(57, 31, 12, 5, "#8fb8e8"); rect(58, 30, 10, 2, "#b5d3f3"); rect(59, 32, 8, 2, "#dcecff");
    if(tod === "night") for(let y = 0; y < 28; y++) for(let x = 0; x < W; x++) if(g[y][x] && x > 26) g[y][x] = mix(g[y][x], "#3b3170", .35);
  } else if(where === "stray"){
    sky(0, 10); stars(0, 8, 14); sunMoon(66, 4); cloud(10, 2); cloud(40, 4);
    rect(0, 8, W, 22, "#c9785a");
    for(let y = 8; y < 30; y += 3){ rect(0, y, W, 1, "#e3a387"); for(let x = (y / 3 % 2) * 4; x < W; x += 8) rect(x, y + 1, 1, 2, "#e3a387"); }
    rect(0, 8, W, 1, "#a65d43");
    rect(0, 30, W, 10, "#9a9aa6"); for(let x = 0; x < W; x += 10) rect(x, 30, 1, 10, "#8a8a96"); rect(0, 30, W, 1, "#7d7d89");
    rect(8, 23, 16, 10, "#d9a066"); rect(8, 23, 16, 2, "#e8b87e"); rect(15, 23, 2, 10, "#c48a52"); rect(7, 22, 3, 2, "#e8b87e"); rect(22, 22, 3, 2, "#e8b87e");
    rect(61, 20, 9, 13, "#7f8c99"); rect(60, 18, 11, 3, "#95a2ae"); for(let y = 22; y < 33; y += 3) rect(61, y, 9, 1, "#6d7985");
    rect(40, 12, 10, 7, "#3f3a5c"); rect(41, 13, 8, 5, tod === "night" ? "#ffd36b" : "#a8c8e8"); rect(45, 13, 1, 5, "#3f3a5c");
    if(season === 3){ rect(0, 8, W, 2, "#ffffff"); rect(0, 30, W, 2, "#ffffff"); rect(8, 22, 16, 1, "#ffffff"); rect(60, 17, 11, 1, "#ffffff"); }
    if(season === 2) for(let k = 0; k < 10; k++) px(Math.floor(R() * W), 31 + Math.floor(R() * 8), R() < .5 ? "#e5703a" : "#f2994a");
    if(season === 0) for(let k = 0; k < 6; k++){ const x = 28 + Math.floor(R() * 26); px(x, 29, "#6cc46b"); px(x, 28, "#ff9fbf"); }
  } else if(where === "shop"){
    rect(0, 0, W, 30, "#fbe9d0"); for(let i = 0; i < W; i += 4) px(i, 2, "#f3d8b5");
    [5, 13, 21].forEach((y, r) => { rect(3, y + 5, 40, 2, "#a8754a");
      for(let x = 4; x < 42; x += 4){ const c = ["#f0708d","#6fb7e8","#ffd36b","#6cc49d","#c38be0"][(x / 4 + r) % 5]; rect(x, y, 3, 5, c); rect(x, y, 3, 1, mix(c, "#ffffff", .45)); } });
    rect(52, 3, 22, 14, "#8a5a3c"); view(53, 4, 20, 12); rect(62, 4, 1, 12, "#8a5a3c");
    rect(50, 21, 28, 11, "#c98b5a"); rect(49, 20, 30, 2, "#e0a874"); rect(64, 15, 9, 6, "#7f8c99"); rect(65, 16, 7, 2, "#a9e3c2"); rect(66, 19, 5, 1, "#5d6873");
    for(let y = 30; y < H; y += 3) for(let x = 0; x < W; x += 3) rect(x, y, 3, 3, ((x + y) / 3) % 2 ? "#f1e3cc" : "#e2cfb1");
    rect(56, 24, 6, 5, "#fff6e6"); px(58, 26, "#f0708d");
  } else if(where === "farm"){
    sky(0, 22); stars(0, 16, 18); sunMoon(12, 5); cloud(30, 3); cloud(52, 6);
    const hill = season === 3 ? "#e6eef5" : season === 2 ? "#cdbd6b" : "#8fd18b", grass = season === 3 ? "#f4f8fb" : season === 2 ? "#c9b45a" : "#79c46b";
    for(let x = 0; x < W; x++){ const h = 16 + Math.round(3 * Math.sin(x / 9) + 2 * Math.sin(x / 4.3)); rect(x, h, 1, 26 - h, hill); }
    rect(0, 26, W, 14, grass); for(let k = 0; k < 26; k++){ const x = Math.floor(R() * W), y = 27 + Math.floor(R() * 12); px(x, y, mix(grass, "#2f6a35", .35)); }
    rect(56, 12, 20, 15, "#d9534f"); for(let y = 13; y < 27; y += 2) rect(56, y, 20, 1, "#c9433f");
    for(let k = 0; k < 6; k++) rect(55 + k, 11 - k, 22 - k * 2, 1, "#7a3b33"); rect(63, 18, 6, 9, "#7a3b33"); rect(65, 13, 2, 3, "#fff6e6");
    const fc = season === 3 ? "#b98a62" : "#fff6e6"; for(let x = 0; x < 52; x += 6){ rect(x, 25, 2, 7, fc); } rect(0, 27, 52, 1, fc); rect(0, 30, 52, 1, fc);
    rect(10, 31, 12, 6, "#f2c94c"); rect(10, 31, 12, 1, "#ffe08a"); rect(10, 34, 12, 1, "#d9a933");
    if(season === 0) for(let k = 0; k < 12; k++) px(Math.floor(R() * W), 27 + Math.floor(R() * 12), R() < .5 ? "#ff9fbf" : "#ffe27a");
    if(season === 3) rect(55, 10, 22, 1, "#ffffff");
  } else { // star：隱藏結局的星空
    sky(0, H); for(let k = 0; k < 70; k++){ const x = Math.floor(R() * W), y = Math.floor(R() * 30); px(x, y, R() < .25 ? "#ffe9a8" : R() < .5 ? "#cfc3ff" : "#ffffff"); }
    ellipse(62, 9, 5, 5, "#fff6cf"); ellipse(64, 8, 4, 4, mix(SKY.night[0], "#3b3170", .5));
    for(let x = 0; x < W; x++){ const h = 32 + Math.round(2 * Math.sin(x / 7)); rect(x, h, 1, H - h, "#2a2458"); }
    [[14, 6], [30, 12], [46, 4]].forEach(([x, y]) => { px(x, y - 1, "#fff"); px(x - 1, y, "#fff"); px(x, y, "#ffe9a8"); px(x + 1, y, "#fff"); px(x, y + 1, "#fff"); });
  }
  // 一列一列合併成長方形
  let out = "";
  for(let y = 0; y < H; y++){ let x = 0; while(x < W){ const c = g[y][x]; let e = x + 1; while(e < W && g[y][e] === c) e++; if(c) out += `<rect x="${x}" y="${y}" width="${e - x}" height="1" fill="${c}"/>`; x = e; } }
  return cache[key] = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" shape-rendering="crispEdges" preserveAspectRatio="xMidYMid slice">${out}</svg>`;
}
const SEASON = ["春天", "夏天", "秋天", "冬天"];
const TOD = a => a === 0 ? "morning" : a <= 6 ? "day" : a <= 11 ? "noon" : "dusk";
const TAL_IC = { strong:"heart", cheer:"sun", clever:"star", sweet:"flower", appetite:"fish", curious:"spark", napper:"moon", study:"note", social:"bigpaw", sporty:"flame",
  fluffy:"yarn", quiet:"drop", longev:"heart", lucky:"gift", idol:"camera", iron:"check", brave:"flame", worker:"crown", charm:"flower", gourmet:"fish", healer:"heart", wise:"note",
  nine:"paw", magic:"spark", stars:"star", meow:"moon", sage:"crown" };
window.ClArt = { scene, SEASON, TOD, TAL_IC };
})();

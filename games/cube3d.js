// 喵喵方塊島的 3D 引擎：方塊世界、第三人稱、虛擬搖桿到處走，島上有小貓可以摸摸
// 用法：Cube3D.open({ meCat, meName, npcs:[{name,color}], sfx, icon, esc, onClose })
// 方塊和貓都是自己用程式畫的（材質是喵喵島自己的和紙風：淡雅大地色、和紙纖維、梅花、青海波），不使用任何遊戲的素材。
(function(){
  // ---------- 小工具：矩陣 ----------
  const I4 = () => [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
  function mul(a, b){ const o = new Array(16); for(let c = 0; c < 4; c++) for(let r = 0; r < 4; r++){ let v = 0; for(let k = 0; k < 4; k++) v += a[k*4+r]*b[c*4+k]; o[c*4+r] = v; } return o; }
  const T = (x,y,z) => [1,0,0,0,0,1,0,0,0,0,1,0,x,y,z,1];
  const S = (x,y,z) => [x,0,0,0,0,y,0,0,0,0,z,0,0,0,0,1];
  const RY = a => [Math.cos(a),0,-Math.sin(a),0,0,1,0,0,Math.sin(a),0,Math.cos(a),0,0,0,0,1];
  const RX = a => [1,0,0,0,0,Math.cos(a),Math.sin(a),0,0,-Math.sin(a),Math.cos(a),0,0,0,0,1];
  const RZ = a => [Math.cos(a),Math.sin(a),0,0,-Math.sin(a),Math.cos(a),0,0,0,0,1,0,0,0,0,1];
  const mulPt = (m, p) => [m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12], m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13], m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]];
  const chain = (...m) => m.reduce((a, b) => mul(a, b), I4());
  const sub = (a,b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]], dot = (a,b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  const cross = (a,b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]], nrm = a => { const l = Math.hypot(...a) || 1; return a.map(v => v/l); };
  function lookAt(e, c, up){ const z = nrm(sub(e, c)), x = nrm(cross(up, z)), y = cross(z, x); return [x[0],y[0],z[0],0, x[1],y[1],z[1],0, x[2],y[2],z[2],0, -dot(x,e),-dot(y,e),-dot(z,e),1]; }
  function persp(f, a, n, fa){ const t = 1/Math.tan(f/2); return [t/a,0,0,0, 0,t,0,0, 0,0,(fa+n)/(n-fa),-1, 0,0,2*fa*n/(n-fa),0]; }
  const hexc = h => [1,3,5].map(i => parseInt(h.substr(i, 2), 16)/255);
  function rng(seed){ let s = seed >>> 0 || 1; return () => (s = (s*1664525 + 1013904223) >>> 0) / 4294967296; }

  // ---------- 方塊種類和材質 ----------
  // 每種方塊：[上面, 側面, 下面] 用哪一格材質；solid 會擋路；clear 是半透明
  const B = { AIR:0, GRASS:1, DIRT:2, STONE:3, PLANK:4, LOG:5, LEAF:6, WATER:7, ROOF:8, SAND:9, BRICK:10, WOOL:11, GLASS:12, CLOUD:13, CLOUDB:14, SAKURA:15 };
  const BT = {
    1:{ t:[0,1,2], solid:1 }, 2:{ t:[2,2,2], solid:1 }, 3:{ t:[3,3,3], solid:1 }, 4:{ t:[4,4,4], solid:1 }, 5:{ t:[6,5,6], solid:1 },
    6:{ t:[7,7,7], solid:1 }, 7:{ t:[8,8,8], solid:0, clear:1 }, 8:{ t:[9,9,9], solid:1 }, 9:{ t:[10,10,10], solid:1 }, 10:{ t:[11,11,11], solid:1 },
    11:{ t:[12,12,12], solid:1 }, 12:{ t:[13,13,13], solid:1, clear:1 }, 13:{ t:[14,15,16], solid:1 }, 14:{ t:[16,16,16], solid:1 }, 15:{ t:[17,17,17], solid:1 },
  };
  // 材質：和紙風（站長選的第 12 種）——淡雅的大地色、和紙纖維紋路、邊邊像撕過的紙，圖案是圓圓的形狀（不是像素石頭泥土）
  // 0 草地上面 1 草地側面 2 土 3 鵝卵石 4 木板 5 貓抓柱側面 6 貓抓柱上面 7 樹葉 8 水 9 魚鱗瓦 10 星星砂 11 磚 12 毛線毯 13 玻璃 14～16 白雲
  const TILE_N = 22;
  const WASHI = { g:"#b4dca4", f:"#fff0d6", d:"#d8b48a", s:"#c6c3d4", w:"#ecd0a6", r:"#ec97a4", b:"#eca996", m:"#f6eee0", l:"#a4d49a", wt:"#a8d6ee", sa:"#f2e2b8", wo:"#f0b4c0", rp:"#dcbc8c", cu:"#ee9fb0", cl:"#fbf7f0", sk:"#f7bccb" };   // 和紙風，顏色稍微亮一點、粉一點（比較可愛）
  // 30 款樹葉：[名字, 裡面那層顏色(null=沒有), 擺法 face=貼在外面／rand=亂亂的／cross=像草叢交叉／hang=往下垂]
  const FOL_STYLES = [
    ["圓圓葉", "#93c990", "face"], ["楓葉", "#e98a62", "face"], ["銀杏扇", "#f2cf5a", "face"], ["愛心葉", null, "rand"], ["幸運草", "#8fcf86", "face"],
    ["蕨類", null, "cross"], ["松針", null, "cross"], ["龜背芋", null, "rand"], ["櫻花", "#f6c4d2", "face"], ["白梅", null, "rand"],
    ["繡球花", "#b8c8ee", "face"], ["雛菊", "#9fd39a", "face"], ["鬱金香", null, "cross"], ["玫瑰", "#7fbf7a", "face"], ["山茶花", "#5f9a66", "face"],
    ["薰衣草", null, "cross"], ["紅果子", "#8cc68c", "face"], ["柳葉", "#93c990", "hang"], ["竹葉", null, "rand"], ["橄欖葉", "#aabb94", "face"],
    ["蒲公英", null, "rand"], ["星星葉", "#93c990", "face"], ["貓掌葉", "#93c990", "face"], ["雲朵葉", "#d6f0cc", "face"], ["水彩葉", null, "rand"],
    ["線稿葉", "#f4fbf0", "face"], ["扶桑花", "#6fae72", "face"], ["檸檬樹", "#7fbf7a", "face"], ["紫藤", "#93c990", "hang"], ["雪頂葉", "#8cc68c", "face"],
    ["素雅繡球・粉紅", "#efb3c5", "face"], ["素雅繡球・天空藍", "#a3c0ea", "face"], ["素雅繡球・紫色", "#bba0e0", "face"], ["素雅繡球・白綠", "#e6eedc", "face"], ["素雅繡球・和紙淡粉", "#eed8de", "face"], ["素雅繡球・藍紫", "#adb0e6", "face"],
    ["素雅繡球・粉藍紫", "#c9c0e6", "face"], ["花球・粉紅", "#efb3c5", "face"], ["花球・天空藍", "#a3c0ea", "face"], ["花球・紫色", "#bba0e0", "face"], ["花球・白綠", "#e6eedc", "face"],
    ["一大球・粉", "#efb3c5", "face"], ["一大球・藍", "#a3c0ea", "face"], ["兩球・粉白", "#f4d6df", "face"], ["四小球・紫", "#bba0e0", "face"],
    ["白邊・粉", "#efb3c5", "face"], ["白邊・藍", "#a3c0ea", "face"], ["和紙紋・淡粉", "#eed8de", "face"], ["和紙紋・淡藍", "#d3dfee", "face"],
    ["點點・粉", "#efb3c5", "face"], ["點點・紫", "#bba0e0", "face"], ["綠葉襯・粉", "#efb3c5", "face"], ["綠葉襯・藍", "#a3c0ea", "face"],
    ["漸層・粉到白", "#f2c3d1", "face"], ["漸層・藍到紫", "#b2b6e8", "face"], ["蜜桃色", "#f2c0a2", "face"], ["薄荷綠", "#b8e0cb", "face"],
    ["薰衣草淡紫", "#d2c2ec", "face"], ["粉藍兩色", "#cfc0e0", "face"], ["粉紫兩色", "#dcb4d8", "face"], ["奶油黃", "#f2e6c2", "face"],
    ["方塊櫻花", "#f2a7bd", "block"], ["方塊櫻花・淡粉", "#f6bfcf", "block"], ["方塊櫻花・夾綠葉", "#f2a7bd", "block"],
  ];
  const FOL_INNER = [...new Set(FOL_STYLES.map(x => x[1]).filter(Boolean).concat(["#f9dde5", "#e98aa6"]))];
  // 茂密櫻花的樣子：[名字, 花的材質格兩張, 裡面那層顏色, 形狀]
  const SAK_STYLES = [
    ["圓圓大樹", [87, 88], "#f6c4d2", "round"], ["大傘（又寬又扁）", [87, 88], "#f6c4d2", "umbrella"], ["垂枝櫻（花一串串垂下來）", [87, 88], "#f6c4d2", "weep"],
    ["高高橢圓", [87, 88], "#f6c4d2", "oval"], ["雲朵（好幾團）", [87, 88], "#f6c4d2", "cloud"], ["兩層", [87, 88], "#f6c4d2", "tier"],
    ["圓圓大樹・淡白", [89, 88], "#f9dde5", "round"], ["圓圓大樹・深粉", [90, 87], "#e98aa6", "round"], ["垂枝櫻・淡白", [89, 88], "#f9dde5", "weep"], ["雲朵・深粉", [90, 87], "#e98aa6", "cloud"],
    ["圓圓大傘（1+2）", [87, 88], "#f6c4d2", "dome"],
  ];
  const SAK_PICK = 10;   // 站長選的：1 圓圓大樹＋2 大傘的感覺
  const FV_COLS = ["#dcbf96", "#b8946a", "#ead4b0", "#e6cfa6", "#f2a7bd", "#e08aa4", "#fbd3de", "#fff6ea", "#a8c89a", "#8fb582", "#c4ddb8", "#ffd36b", "#fff1b0"];
  const FV_KIND = c => ["#dcbf96", "#b8946a", "#ead4b0"].includes(c) ? "wood" : c === "#e6cfa6" ? "rope" : c === "#ffd36b" || c === "#fff1b0" ? "plain" : "fabric";
  function makeAtlas(){
    const N = 64, COLS = 16, cv = document.createElement("canvas"); cv.width = cv.height = N*COLS; const g = cv.getContext("2d");
    const hx = h => [1,3,5].map(i => parseInt(h.substr(i,2),16)), mix = (a, b, k) => { const x = hx(a), y = hx(b); return "#" + x.map((v,i) => Math.round(v + (y[i]-v)*k).toString(16).padStart(2,"0")).join(""); };
    const lt = (c, k = .3) => mix(c, "#ffffff", k), dk = (c, k = .25) => mix(c, "#3a2a28", k);
    let r = rng(12);
    const rr = (x, y, w, h, q) => { g.beginPath(); g.moveTo(x+q, y); g.arcTo(x+w, y, x+w, y+h, q); g.arcTo(x+w, y+h, x, y+h, q); g.arcTo(x, y+h, x, y, q); g.arcTo(x, y, x+w, y, q); g.closePath(); };
    const el = (x, y, a, b) => { g.beginPath(); g.ellipse(x, y, a, b, 0, 0, Math.PI*2); };
    // 和紙：先塗顏色，再加一絲一絲白白的纖維和一點點深色的小纖維
    const fibers = (n = 40, a = .35) => { g.lineWidth = .7; for(let k = 0; k < n; k++){ const x = r()*N, y = r()*N; g.strokeStyle = r() < .82 ? `rgba(255,255,255,${a})` : "rgba(90,60,40,.12)"; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 6, y + r()*6 - 3, x + 9 + r()*9, y + r()*5 - 2.5); g.stroke(); } };
    const sh = (path, c, n = 14) => { path(); g.fillStyle = c; g.fill(); g.save(); path(); g.clip(); fibers(n, .3); g.restore(); };
    const bg = c => { g.fillStyle = mix(c, WASHI.m, .12); g.fillRect(0, 0, N, N); fibers(60, .32); };
    // 邊邊：像撕過的和紙，有一點點不規則的淡色邊
    const edge = () => { g.lineWidth = 2.2; g.strokeStyle = "rgba(255,250,240,.55)"; g.beginPath(); for(let k = 0; k <= 64; k++){ const t = k/64*4, side = Math.floor(t) % 4, u = t - Math.floor(t), j = 1.6 + r()*1.4;
        const [x, y] = side === 0 ? [u*N, j] : side === 1 ? [N - j, u*N] : side === 2 ? [N - u*N, N - j] : [j, N - u*N]; k ? g.lineTo(x, y) : g.moveTo(x, y); } g.closePath(); g.stroke();
      g.lineWidth = 1.2; g.strokeStyle = "rgba(90,60,50,.16)"; g.strokeRect(.6, .6, N - 1.2, N - 1.2); };
    const plum = (x, y, s, c) => { for(let k = 0; k < 5; k++){ const a = -Math.PI/2 + k*Math.PI*2/5; el(x + Math.cos(a)*s*.55, y + Math.sin(a)*s*.55, s*.42, s*.42); g.fillStyle = c; g.fill(); } el(x, y, s*.22, s*.22); g.fillStyle = "#e8c070"; g.fill(); };   // 小梅花
    const W = WASHI, T = [
      () => { // 0 草地上面：接起來看不出一格一格（沒有邊框、圖案會繞到另一邊），淡淡的深淺＋一根一根的小草
        g.fillStyle = W.g; g.fillRect(0, 0, N, N); const wrap = f => { for(const dx of [-N, 0, N]) for(const dy of [-N, 0, N]) f(dx, dy); };
        for(let k = 0; k < 12; k++){ const x = r()*N, y = r()*N, a = 6 + r()*11, c = r() < .5 ? "rgba(255,255,235,.11)" : "rgba(70,125,60,.08)"; wrap((dx, dy) => { el(x + dx, y + dy, a, a*.7); g.fillStyle = c; g.fill(); }); }
        g.lineCap = "round"; g.lineWidth = 1.1;
        for(let k = 0; k < 110; k++){ const x = r()*N, y = r()*N, l = 2 + r()*3.2, a = -Math.PI/2 + (r() - .5)*.9, c = r() < .55 ? "rgba(255,255,235,.32)" : "rgba(55,115,55,.2)";
          wrap((dx, dy) => { g.strokeStyle = c; g.beginPath(); g.moveTo(x + dx, y + dy); g.lineTo(x + dx + Math.cos(a)*l, y + dy + Math.sin(a)*l); g.stroke(); }); } },
      () => { bg(W.d); sh(() => el(20, 46, 5, 4), dk(W.d, .12)); sh(() => el(46, 54, 4, 3), dk(W.d, .12)); sh(() => { g.beginPath(); g.moveTo(0, 0); g.lineTo(N, 0); for(let x = N; x >= 0; x -= 2) g.lineTo(x, 20 + Math.sin(x/N*Math.PI*3)*4); g.closePath(); }, W.g, 20); edge(); },
      () => { bg(W.d); for(const [x, y, q] of [[16,16,6],[44,20,5],[28,40,7],[50,48,5],[12,52,4]]) sh(() => el(x, y, q, q*.8), dk(W.d, .16), 4); edge(); },
      () => { bg(W.s); for(const [x, y, a, b] of [[18,18,12,9],[46,16,10,8],[30,42,14,10],[54,48,8,7],[10,50,7,6]]) sh(() => el(x, y, a, b), lt(W.s, .2), 6); edge(); },
      () => { bg(dk(W.w, .12)); for(let k = 0; k < 3; k++) sh(() => rr(2, 2 + k*21, N - 4, 18, 5), k % 2 ? dk(W.w, .04) : W.w); plum(9, 11, 3.5, "#efd7d9"); plum(55, 53, 3.5, "#efd7d9"); edge(); },
      () => { bg(W.rp); for(let y = 0; y < N; y += 8) sh(() => rr(0, y + 1, N, 6.5, 3), (y/8) % 2 ? dk(W.rp, .08) : lt(W.rp, .08), 6); g.strokeStyle = "rgba(110,80,40,.22)"; g.lineWidth = 1; for(let y = 0; y < N; y += 8) for(let x = -6; x < N; x += 7){ g.beginPath(); g.moveTo(x, y + 7.5); g.lineTo(x + 6, y + 1); g.stroke(); } edge(); },
      () => { bg(W.rp); sh(() => el(32, 32, 24, 24), W.cu); sh(() => el(32, 32, 16, 16), lt(W.cu, .18)); plum(32, 32, 6, W.f); edge(); },
      () => { bg(dk(W.l, .15)); for(const [x, y, q] of [[14,14,13],[46,14,14],[30,34,15],[10,50,12],[52,50,13]]) sh(() => el(x, y, q, q), q % 2 ? W.l : lt(W.l, .1), 8); edge(); },
      () => { bg(W.wt); g.strokeStyle = "rgba(255,255,255,.55)"; g.lineWidth = 1.4; for(let row = 0; row < 4; row++) for(let k = 0; k < 4; k++){ const x = k*16 + (row % 2 ? 8 : 0), y = row*16 + 16; for(const q of [10, 6.5, 3]){ g.beginPath(); g.arc(x, y, q, Math.PI, 0); g.stroke(); } } g.globalCompositeOperation = "destination-in"; g.fillStyle = "rgba(0,0,0,.75)"; g.fillRect(0, 0, N, N); g.globalCompositeOperation = "source-over"; },   // 青海波（水波紋）
      () => { bg(dk(W.r, .18)); for(let row = 0; row < 5; row++) for(let k = -1; k < 5; k++){ const x = k*16 + (row % 2 ? 8 : 0) + 8, y = row*14 - 4; sh(() => { g.beginPath(); g.arc(x, y, 9, 0, Math.PI); g.closePath(); }, row % 2 ? W.r : lt(W.r, .12), 4); } edge(); },
      () => { bg(W.sa); for(const [x, y] of [[14,16],[44,24],[24,44],[52,52],[34,8]]) plum(x, y, 3.2, "#f3e3c0"); for(let k = 0; k < 14; k++){ el(r()*N, r()*N, .9, .9); g.fillStyle = "rgba(150,120,80,.3)"; g.fill(); } edge(); },
      () => { bg(W.m); for(let row = 0; row < 4; row++) for(let k = -1; k < 3; k++){ const x = k*32 + (row % 2 ? 16 : 0) + 2, y = row*16 + 2; sh(() => rr(x, y, 28, 12, 4), row % 2 ? W.b : lt(W.b, .1), 5); } edge(); },
      () => { bg(W.wo); g.lineCap = "round"; for(let y = 2; y < N; y += 10) for(let x = 0; x < N; x += 12){ g.strokeStyle = lt(W.wo, .3); g.lineWidth = 3; g.beginPath(); g.moveTo(x + 2, y + 1); g.lineTo(x + 6, y + 7); g.lineTo(x + 10, y + 1); g.stroke(); } g.lineCap = "butt"; edge(); },
      () => { g.clearRect(0, 0, N, N); g.fillStyle = "rgba(230,240,240,.4)"; g.fillRect(0, 0, N, N); g.strokeStyle = "rgba(120,90,70,.75)"; g.lineWidth = 4; g.strokeRect(2, 2, N - 4, N - 4); g.lineWidth = 2; g.beginPath(); g.moveTo(N/2, 2); g.lineTo(N/2, N - 2); g.moveTo(2, N/2); g.lineTo(N - 2, N/2); g.stroke(); },   // 障子風格的窗
      () => { bg(W.cl); for(const [x, y, q] of [[18,18,10],[44,40,12]]){ el(x, y, q, q*.7); g.fillStyle = "rgba(255,255,255,.6)"; g.fill(); } },   // 雲朵上面：沒有邊框，接起來軟軟一片
      () => { bg(mix(W.cl, "#dfe4ee", .5)); sh(() => { g.beginPath(); g.moveTo(0, 0); g.lineTo(N, 0); for(let x = N; x >= 0; x -= 2) g.lineTo(x, 14 + Math.sin(x/N*Math.PI*4)*3); g.closePath(); }, W.cl, 10); edge(); },
      () => { bg(mix(W.cl, "#c9d3e4", .6)); edge(); },
      () => { bg(dk(W.sk, .1)); for(const [x, y, q] of [[14,14,13],[46,14,14],[30,34,15],[10,50,12],[52,50,13]]) sh(() => el(x, y, q, q), q % 2 ? W.sk : lt(W.sk, .18), 8); plum(20, 22, 4, "#fff6f8"); plum(46, 44, 4, "#fff6f8"); edge(); },   // 17 櫻花
      () => leafCluster(false),   // 18 一片一片的葉子（背景透明）
      () => leafCluster(true),    // 19 一朵一朵的櫻花（背景透明）
      () => { g.fillStyle = "#93c990"; g.fillRect(0, 0, N, N); },   // 20 樹冠裡面（乾淨的綠）
      () => { g.fillStyle = "#f6c4d2"; g.fillRect(0, 0, N, N); },   // 21 櫻花樹冠裡面
    ];
    // 葉子：水滴形、有葉脈、深淺不同；櫻花：五片花瓣（花瓣尖端有小缺口）、粉紅花心、黃色花蕊
    function leaf(x, y, a, L, c1, c2){ g.save(); g.translate(x, y); g.rotate(a); const W2 = L*.42;
      g.beginPath(); g.moveTo(0, -L/2); g.bezierCurveTo(W2, -L*.25, W2*.9, L*.25, 0, L/2); g.bezierCurveTo(-W2*.9, L*.25, -W2, -L*.25, 0, -L/2); g.closePath();
      const gr = g.createLinearGradient(-W2, 0, W2, 0); gr.addColorStop(0, c1); gr.addColorStop(1, c2); g.fillStyle = gr; g.fill();
      g.strokeStyle = "rgba(40,90,50,.35)"; g.lineWidth = .9; g.stroke();
      g.strokeStyle = "rgba(240,255,230,.55)"; g.lineWidth = 1; g.beginPath(); g.moveTo(0, -L*.42); g.lineTo(0, L*.46); g.stroke();
      g.lineWidth = .6; for(let k = -2; k <= 2; k++){ if(!k) continue; const yy = k*L*.13; g.beginPath(); g.moveTo(0, yy); g.lineTo(Math.sign(k)*W2*.55, yy - L*.1); g.moveTo(0, yy); g.lineTo(-Math.sign(k)*W2*.55, yy - L*.1); g.stroke(); }
      g.restore(); }
    function blossom(x, y, rad, a){ g.save(); g.translate(x, y); g.rotate(a);
      for(let k = 0; k < 5; k++){ g.save(); g.rotate(k*Math.PI*2/5); const L = rad, W2 = rad*.5;
        g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(W2, -L*.25, W2*1.05, -L*.85, W2*.28, -L); g.lineTo(0, -L*.86); g.lineTo(-W2*.28, -L); g.bezierCurveTo(-W2*1.05, -L*.85, -W2, -L*.25, 0, 0); g.closePath();
        const gr = g.createLinearGradient(0, 0, 0, -L); gr.addColorStop(0, "#f39ab4"); gr.addColorStop(.45, "#fcd3df"); gr.addColorStop(1, "#fff4f7"); g.fillStyle = gr; g.fill();
        g.restore(); }
      g.fillStyle = "#e8708f"; g.beginPath(); g.arc(0, 0, rad*.22, 0, Math.PI*2); g.fill();
      for(let k = 0; k < 5; k++){ const a2 = k*1.2566 + .6; g.fillStyle = "#ffd36b"; g.beginPath(); g.arc(Math.cos(a2)*rad*.32, Math.sin(a2)*rad*.32, 1.3, 0, Math.PI*2); g.fill(); }
      g.restore(); }
    // 乾淨版：幾片大葉子排成一小把（不要亂、不要粗黑邊），櫻花是三朵大大的小花
    function leafCluster(sak){ g.clearRect(0, 0, N, N);
      if(sak){ for(const [x, y, q, a] of [[22, 24, 13, .3], [44, 30, 12, 1.1], [30, 46, 11.5, 2.2]]) blossom(x, y, q, a); return; }
      const L = [[32, 34, 0, 34], [20, 36, -.62, 30], [44, 36, .62, 30], [26, 22, -.3, 26], [38, 22, .3, 26]];
      L.forEach(([x, y, a, len], k) => leafSoft(x, y, a, len, k));
    }
    function leafSoft(x, y, a, L, k){ g.save(); g.translate(x, y); g.rotate(a); const W2 = L*.36;
      g.beginPath(); g.moveTo(0, -L/2); g.bezierCurveTo(W2, -L*.22, W2*.85, L*.28, 0, L/2); g.bezierCurveTo(-W2*.85, L*.28, -W2, -L*.22, 0, -L/2); g.closePath();
      g.fillStyle = ["#9fd39a", "#93cb90", "#a9da9f", "#8cc68c", "#b2dfa6"][k % 5]; g.fill();
      g.strokeStyle = "rgba(255,255,255,.45)"; g.lineWidth = 1.2; g.beginPath(); g.moveTo(0, -L*.36); g.lineTo(0, L*.42); g.stroke(); g.restore(); }
    T.forEach((f, k) => { const ox = (k % COLS)*N, oy = Math.floor(k / COLS)*N; r = rng(100 + k); g.save(); g.translate(ox, oy); g.beginPath(); g.rect(0, 0, N, N); g.clip(); f(); g.restore(); });
    // ---------- 樹葉 30 款（給站長挑；材質格 22～51，背景透明） ----------
    const FP = (() => {
      const E = (x, y, rx, ry, a, c) => { g.save(); g.translate(x, y); g.rotate(a || 0); g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, Math.PI*2); g.fillStyle = c; g.fill(); g.restore(); };
      const C = (x, y, rr, c) => { g.beginPath(); g.arc(x, y, rr, 0, Math.PI*2); g.fillStyle = c; g.fill(); };
      const vein = (x, y, a, L, c = "rgba(255,255,255,.45)") => { g.save(); g.translate(x, y); g.rotate(a); g.strokeStyle = c; g.lineWidth = 1.1; g.beginPath(); g.moveTo(0, -L*.4); g.lineTo(0, L*.42); g.stroke(); g.restore(); };
      const drop = (x, y, a, L, w, c) => { g.save(); g.translate(x, y); g.rotate(a); const W2 = L*w; g.beginPath(); g.moveTo(0, -L/2); g.bezierCurveTo(W2, -L*.22, W2*.85, L*.28, 0, L/2); g.bezierCurveTo(-W2*.85, L*.28, -W2, -L*.22, 0, -L/2); g.fillStyle = c; g.fill(); g.restore(); };
      const heartP = (x, y, s, a, c) => { g.save(); g.translate(x, y); g.rotate(a); g.beginPath(); g.moveTo(0, s*.35); g.bezierCurveTo(-s*.65, -s*.05, -s*.32, -s*.6, 0, -s*.2); g.bezierCurveTo(s*.32, -s*.6, s*.65, -s*.05, 0, s*.35); g.fillStyle = c; g.fill(); g.restore(); };
      const starP = (x, y, rr, a, c, n = 5) => { g.save(); g.translate(x, y); g.rotate(a); g.beginPath(); for(let k = 0; k < n*2; k++){ const q2 = k % 2 ? rr*.48 : rr, an = k*Math.PI/n - Math.PI/2; g.lineTo(Math.cos(an)*q2, Math.sin(an)*q2); } g.closePath(); g.fillStyle = c; g.fill(); g.restore(); };
      const petals = (x, y, n, rr, pw, c, mid, a = 0) => { for(let k = 0; k < n; k++){ const an = a + k*Math.PI*2/n; E(x + Math.cos(an)*rr*.55, y + Math.sin(an)*rr*.55, rr*.55, rr*pw, an, c); } if(mid) C(x, y, rr*.28, mid); };
      const G5 = ["#9fd39a", "#93cb90", "#a9da9f", "#8cc68c", "#b2dfa6"];
      return [
        () => { for(const [x, y, rr, k] of [[22, 24, 13, 0], [42, 22, 12, 1], [32, 42, 14, 2], [14, 44, 9, 3], [50, 44, 10, 4]]) C(x, y, rr, G5[k]); },                                         // 0 圓圓葉
        () => { const M = (x, y, s, a, c) => { g.save(); g.translate(x, y); g.rotate(a); g.beginPath(); for(let k = 0; k <= 10; k++){ const an = -Math.PI/2 + k*Math.PI*2/10, q2 = k % 2 ? s*.42 : s*(k === 0 || k === 10 ? 1 : .85); g.lineTo(Math.cos(an)*q2, Math.sin(an)*q2); } g.closePath(); g.fillStyle = c; g.fill(); g.strokeStyle = "rgba(255,240,200,.5)"; g.lineWidth = 1; for(let k = 0; k < 5; k++){ const an = -Math.PI/2 + k*Math.PI*2/5; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(an)*s*.8, Math.sin(an)*s*.8); g.stroke(); } g.restore(); };
                M(22, 22, 16, -.3, "#ec8a5a"); M(44, 28, 15, .4, "#e96a5a"); M(30, 46, 15, .1, "#f2a65a"); },                                                                                   // 1 楓葉
        () => { const F = (x, y, s, a, c) => { g.save(); g.translate(x, y); g.rotate(a); g.beginPath(); g.moveTo(0, s*.5); g.lineTo(-s*.55, -s*.25); g.quadraticCurveTo(0, -s*.75, s*.55, -s*.25); g.closePath(); g.fillStyle = c; g.fill(); g.strokeStyle = "rgba(255,255,255,.4)"; g.beginPath(); g.moveTo(0, s*.5); g.lineTo(0, -s*.3); g.stroke(); g.restore(); };
                F(22, 26, 24, -.5, "#f6d35a"); F(42, 24, 22, .5, "#f2c84a"); F(32, 44, 24, 0, "#f8dc72"); },                                                                                   // 2 銀杏扇
        () => { heartP(22, 24, 24, -.3, "#9fd39a"); heartP(44, 26, 22, .35, "#8cc68c"); heartP(32, 46, 24, 3.14, "#a9da9f"); },                                                                  // 3 愛心葉
        () => { for(const [x, y, a] of [[32, 32, 0], [18, 46, 2], [46, 18, 4]]){ for(let k = 0; k < 4; k++) heartP(x + Math.cos(a + k*1.57)*7, y + Math.sin(a + k*1.57)*7, 15, a + k*1.57 + 1.57, k % 2 ? "#8fcf86" : "#9fd89a"); C(x, y, 2, "#78b874"); } },   // 4 幸運草
        () => { for(const [x0, y0, a0] of [[20, 50, -.5], [44, 52, .5]]){ g.save(); g.translate(x0, y0); g.rotate(a0); g.strokeStyle = "#6ab46e"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -40); g.stroke(); for(let k = 0; k < 9; k++){ const yy = -4 - k*4.2, L = 10 - k*.8; E(-L*.55, yy, L*.55, 2.2, -.5, "#8fcf86"); E(L*.55, yy, L*.55, 2.2, .5, "#9fd89a"); } g.restore(); } },   // 5 蕨類
        () => { for(const [x, y] of [[20, 30], [44, 28], [32, 46]]){ for(let k = 0; k < 14; k++){ const an = -Math.PI/2 + (k - 6.5)*.2; g.strokeStyle = k % 2 ? "#5fa866" : "#78bc78"; g.lineWidth = 2; g.lineCap = "round"; g.beginPath(); g.moveTo(x, y + 8); g.lineTo(x + Math.cos(an)*16, y + 8 + Math.sin(an)*16); g.stroke(); } } g.lineCap = "butt"; },   // 6 松針
        () => { g.save(); g.translate(32, 34); g.beginPath(); g.ellipse(0, 0, 26, 22, 0, 0, Math.PI*2); g.fillStyle = "#6fb57a"; g.fill(); g.globalCompositeOperation = "destination-out"; for(let k = 0; k < 7; k++){ const an = -2.6 + k*.75; g.beginPath(); g.ellipse(Math.cos(an)*18, Math.sin(an)*15, 6, 2.2, an, 0, Math.PI*2); g.fill(); C(Math.cos(an)*9, Math.sin(an)*8, 2, "#000"); } g.restore(); vein(32, 34, 0, 40); },   // 7 龜背芋
        () => { for(const [x, y, rr, a] of [[22, 24, 12, .3], [44, 30, 11.5, 1.1], [30, 46, 11, 2.2]]){ for(let k = 0; k < 5; k++){ const an = a + k*1.2566; E(x + Math.cos(an)*rr*.5, y + Math.sin(an)*rr*.5, rr*.55, rr*.42, an, k % 2 ? "#fbd0dc" : "#f9c2d2"); } C(x, y, rr*.25, "#ef8aa4"); } },   // 8 櫻花
        () => { for(const [x, y, rr] of [[22, 24, 11], [44, 28, 10], [30, 46, 11]]) petals(x, y, 5, rr, .5, "#ffffff", "#ffd36b"); },                                                       // 9 白梅
        () => { for(let k = 0; k < 18; k++){ const an = k*2.4, d = Math.sqrt(k/18)*24; const x = 32 + Math.cos(an)*d, y = 32 + Math.sin(an)*d; for(let j = 0; j < 4; j++) E(x + Math.cos(j*1.57 + .4)*3.2, y + Math.sin(j*1.57 + .4)*3.2, 3.4, 2.4, j*1.57 + .4, ["#a8c8f2", "#b9a8ee", "#c8d8fa"][k % 3]); C(x, y, 1, "#fff"); } },   // 10 繡球花
        () => { for(const [x, y, rr] of [[22, 24, 12], [44, 30, 11], [30, 46, 12]]) petals(x, y, 12, rr, .22, "#ffffff", "#ffd36b"); },                                                     // 11 雛菊
        () => { for(const [x, y, c] of [[20, 28, "#f28b9a"], [44, 26, "#ffd36b"], [32, 46, "#f7a7c8"]]){ g.fillStyle = c; g.beginPath(); g.moveTo(x - 9, y - 6); g.lineTo(x - 5, y - 1); g.lineTo(x, y - 9); g.lineTo(x + 5, y - 1); g.lineTo(x + 9, y - 6); g.quadraticCurveTo(x + 10, y + 10, x, y + 10); g.quadraticCurveTo(x - 10, y + 10, x - 9, y - 6); g.fill(); drop(x + 8, y + 12, .6, 12, .3, "#8fcf86"); } },   // 12 鬱金香
        () => { for(const [x, y, rr, c] of [[22, 24, 12, "#f07a8e"], [44, 30, 11, "#f59ab0"], [30, 46, 12, "#e8607a"]]){ C(x, y, rr, c); g.strokeStyle = "rgba(150,30,60,.35)"; g.lineWidth = 1.2; g.beginPath(); for(let k = 0; k < 40; k++){ const an = k*.45, q2 = rr*(1 - k/44); g.lineTo(x + Math.cos(an)*q2, y + Math.sin(an)*q2); } g.stroke(); } },   // 13 玫瑰
        () => { for(const [x, y, rr] of [[22, 24, 12], [44, 30, 11], [30, 46, 12]]){ petals(x, y, 6, rr, .62, "#e85a6a", null, .3); C(x, y, rr*.32, "#ffd36b"); } },                          // 14 山茶花
        () => { for(const x of [14, 26, 38, 50]){ g.strokeStyle = "#7cb87a"; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x, 60); g.lineTo(x, 10); g.stroke(); for(let k = 0; k < 8; k++){ E(x - 2.2, 14 + k*4.2, 2.6, 2, -.4, "#b892e0"); E(x + 2.2, 14 + k*4.2, 2.6, 2, .4, "#c9a6e8"); } } },   // 15 薰衣草
        () => { for(const [x, y, a] of [[20, 24, -.4], [44, 22, .4], [30, 44, 0]]) drop(x, y, a, 26, .4, "#8fcf86"); for(const [x, y] of [[30, 28], [34, 32], [28, 34], [36, 26], [40, 36], [22, 38]]){ C(x, y, 4, "#e8404e"); C(x - 1.2, y - 1.2, 1.2, "#ffb0b8"); } },   // 16 紅果子
        () => { for(let k = 0; k < 7; k++){ const x = 6 + k*8.5; g.strokeStyle = "#8fcf86"; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, 0); g.quadraticCurveTo(x + 3, 30, x - 1, 62); g.stroke(); for(let j = 0; j < 6; j++) drop(x + 1 + j*.3, 8 + j*9, .2*(j % 2 ? 1 : -1), 9, .28, j % 2 ? "#9fd89a" : "#8cc68c"); } },   // 17 柳葉
        () => { for(let k = 0; k < 7; k++){ const an = -1.2 + k*.4; drop(32 + Math.cos(an)*14, 32 + Math.sin(an)*10, an + 1.57, 34, .14, k % 2 ? "#8fcf86" : "#a6da9a"); } g.strokeStyle = "#7aa860"; g.lineWidth = 2; g.beginPath(); g.moveTo(20, 50); g.lineTo(32, 32); g.stroke(); },   // 18 竹葉
        () => { for(let k = 0; k < 9; k++){ const an = k*.7; drop(32 + Math.cos(an)*14, 32 + Math.sin(an)*14, an + 1.57, 22, .2, k % 2 ? "#a6b88f" : "#b9c9a3"); } },                         // 19 橄欖葉
        () => { for(const [x, y, rr] of [[22, 24, 12], [44, 30, 11], [30, 46, 12]]){ for(let k = 0; k < 16; k++){ const an = k*.3927; g.strokeStyle = "rgba(255,255,255,.95)"; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(an)*rr, y + Math.sin(an)*rr); g.stroke(); C(x + Math.cos(an)*rr, y + Math.sin(an)*rr, 1.6, "#ffffff"); } C(x, y, 2.4, "#e8e2d0"); } },   // 20 蒲公英
        () => { starP(22, 24, 14, .2, "#9fd39a"); starP(44, 26, 13, .7, "#8cc68c"); starP(32, 46, 14, .4, "#b2dfa6"); },                                                                       // 21 星星葉
        () => { for(const [x, y, s, c] of [[22, 26, 1, "#9fd39a"], [44, 28, .9, "#8cc68c"], [32, 46, 1, "#b2dfa6"]]){ E(x, y + 4*s, 9*s, 7.5*s, 0, c); for(const [dx, dy] of [[-8, -6], [-3, -10], [3, -10], [8, -6]]) E(x + dx*s, y + dy*s, 3.4*s, 4*s, 0, c); } },   // 22 貓掌葉
        () => { for(const [x, y, rr] of [[22, 30, 14], [40, 26, 15], [32, 44, 13]]){ C(x, y, rr, "#c8ecbc"); C(x - rr*.25, y - rr*.25, rr*.6, "#e2f6d8"); } },                                     // 23 雲朵葉
        () => { for(const [x, y, rr, c] of [[24, 26, 15, "rgba(140,200,130,.75)"], [40, 30, 14, "rgba(120,190,120,.7)"], [30, 42, 14, "rgba(160,215,140,.7)"]]){ g.beginPath(); for(let k = 0; k <= 24; k++){ const an = k/24*Math.PI*2, q2 = rr*(.85 + .15*Math.sin(an*3 + x)); g.lineTo(x + Math.cos(an)*q2, y + Math.sin(an)*q2); } g.fillStyle = c; g.fill(); } },   // 24 水彩葉
        () => { g.lineWidth = 2; g.strokeStyle = "#5fa866"; for(const [x, y, a] of [[22, 24, -.4], [44, 26, .4], [32, 44, 0]]){ drop(x, y, a, 26, .38, "#ffffff"); g.save(); g.translate(x, y); g.rotate(a); g.beginPath(); g.moveTo(0, -13); g.bezierCurveTo(9.9, -5.7, 8.8, 7.3, 0, 13); g.bezierCurveTo(-8.8, 7.3, -9.9, -5.7, 0, -13); g.stroke(); g.beginPath(); g.moveTo(0, -10); g.lineTo(0, 11); g.stroke(); g.restore(); } },   // 25 線稿葉
        () => { for(const [x, y, rr, c] of [[22, 24, 13, "#f2607a"], [44, 30, 12, "#ff8a5a"], [30, 46, 13, "#f27aa0"]]){ petals(x, y, 5, rr, .58, c, null, .3); g.strokeStyle = "#ffd36b"; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x, y); g.lineTo(x + rr*.5, y - rr*.5); g.stroke(); C(x + rr*.5, y - rr*.5, 1.8, "#ffd36b"); } },   // 26 扶桑花
        () => { for(const [x, y, a] of [[18, 22, -.4], [44, 20, .4], [24, 46, .2], [46, 44, -.3]]) drop(x, y, a, 24, .36, "#7fbf7a"); for(const [x, y] of [[32, 30], [26, 36], [40, 38]]){ E(x, y, 6, 5, .3, "#ffe066"); E(x - 1.5, y - 1.5, 2, 1.4, .3, "#fff6c0"); } },   // 27 檸檬樹
        () => { for(const x of [14, 32, 50]){ for(let k = 0; k < 7; k++){ const w2 = 7 - k*.7; for(let j = -1; j <= 1; j += 2) C(x + j*w2*.5, 8 + k*7, 3.4 - k*.25, ["#b892e0", "#c9a6e8", "#d8c0f2"][k % 3]); } drop(x, 4, 0, 10, .4, "#8fcf86"); } },   // 28 紫藤
        () => { for(const [x, y, a] of [[22, 26, -.3], [44, 28, .3], [32, 44, 0]]){ drop(x, y, a, 26, .4, "#8cc68c"); E(x - 2, y - 8, 9, 5, a, "#ffffff"); } },                                // 29 雪頂葉
      ];
    })();
    FP.forEach((f, k) => { const ox = ((22 + k) % COLS)*N, oy = Math.floor((22 + k) / COLS)*N; g.save(); g.translate(ox, oy); g.beginPath(); g.rect(0, 0, N, N); g.clip(); g.clearRect(0, 0, N, N); f(); g.restore(); });
    // 繡球花的 11 種變化（材質格 52～62）：[花的顏色們, 小花數量, 小花大小, 有沒有葉子, 排法]
    // 素雅版：一團一團圓圓的花球，小花用很淡的顏色畫，遠看是乾淨的一團、近看才看得到小花
    const HYD = [
      [["#f4b9ca"], "calm"], [["#a9c6ef"], "calm"], [["#c1a6e6"], "calm"], [["#eef4e6"], "calm"], [["#f3dde3"], "calm"], [["#b3b6ec"], "calm"],
      [["#f4b9ca", "#a9c6ef", "#c1a6e6"], "calm"], [["#f4b9ca"], "plain"], [["#a9c6ef"], "plain"], [["#c1a6e6"], "plain"], [["#eef4e6"], "plain"],
    ];
    HYD.forEach(([cols, lay], k) => { const ox = ((52 + k) % COLS)*N, oy = Math.floor((52 + k) / COLS)*N; g.save(); g.translate(ox, oy); g.beginPath(); g.rect(0, 0, N, N); g.clip(); g.clearRect(0, 0, N, N);
      const mixC = (a, b, t) => { const p = h => [1,3,5].map(i => parseInt(h.substr(i,2),16)), A = p(a), B2 = p(b); return "#" + A.map((v,i) => Math.round(v + (B2[i]-v)*t).toString(16).padStart(2,"0")).join(""); };
      [[22, 23, 15], [43, 27, 14], [31, 45, 15]].forEach(([cx, cy, rr], h) => { const c = cols[h % cols.length];
        // 花球本體：圓圓的、上面亮一點
        g.beginPath(); for(let j2 = 0; j2 <= 28; j2++){ const an = j2/28*Math.PI*2, q2 = rr*(.94 + .06*Math.sin(an*5 + h)); g.lineTo(cx + Math.cos(an)*q2, cy + Math.sin(an)*q2); } g.closePath();
        const gr = g.createRadialGradient(cx - rr*.35, cy - rr*.4, 1, cx, cy, rr*1.05); gr.addColorStop(0, mixC(c, "#ffffff", .3)); gr.addColorStop(1, mixC(c, "#6a5a88", .06)); g.fillStyle = gr; g.fill();
        if(lay === "calm"){ for(let j2 = 0; j2 < 7; j2++){ const an = j2*2.4 + h, d = Math.sqrt((j2 + .5)/7)*rr*.7, fx = cx + Math.cos(an)*d, fy = cy + Math.sin(an)*d;
          for(let p2 = 0; p2 < 4; p2++){ const a3 = p2*1.5708 + .5 + h; g.save(); g.translate(fx + Math.cos(a3)*2.6, fy + Math.sin(a3)*2.6); g.rotate(a3); g.beginPath(); g.ellipse(0, 0, 2.9, 2.1, 0, 0, Math.PI*2); g.fillStyle = mixC(c, "#ffffff", .22); g.fill(); g.restore(); }
          g.beginPath(); g.arc(fx, fy, .9, 0, Math.PI*2); g.fillStyle = mixC(c, "#ffffff", .5); g.fill(); } } });
      g.restore(); });
    // 更多素雅花球（材質格 63～82）：[顏色們, 花球數 1/2/3/4, 花樣 none/faint/dots/fiber, 白邊, 綠葉襯, 漸層強]
    const CALM = [
      [["#f4b9ca"], 1, "faint"], [["#a9c6ef"], 1, "faint"], [["#f4b9ca", "#fbeef2"], 2, "none"], [["#c1a6e6"], 4, "none"],
      [["#f4b9ca"], 3, "none", 1], [["#a9c6ef"], 3, "none", 1], [["#f3dde3"], 3, "fiber"], [["#d9e4f2"], 3, "fiber"],
      [["#f4b9ca"], 3, "dots"], [["#c1a6e6"], 3, "dots"], [["#f4b9ca"], 3, "none", 0, 1], [["#a9c6ef"], 3, "none", 0, 1],
      [["#f4b9ca"], 3, "none", 0, 0, 1], [["#a9c6ef", "#c1a6e6"], 3, "none", 0, 0, 1], [["#f8c8a8"], 3, "faint"], [["#bfe6d2"], 3, "faint"],
      [["#d9c8f0"], 3, "faint"], [["#f4b9ca", "#a9c6ef"], 3, "none"], [["#f4b9ca", "#c1a6e6"], 3, "none"], [["#f8eecc"], 3, "faint"],
    ];
    CALM.forEach(([cols, n, pat, rim, lv, grd], k) => { const ox = ((63 + k) % COLS)*N, oy = Math.floor((63 + k) / COLS)*N; g.save(); g.translate(ox, oy); g.beginPath(); g.rect(0, 0, N, N); g.clip(); g.clearRect(0, 0, N, N);
      const mixC = (a, b, t) => { const p = h => [1,3,5].map(i => parseInt(h.substr(i,2),16)), A = p(a), B2 = p(b); return "#" + A.map((v,i) => Math.round(v + (B2[i]-v)*t).toString(16).padStart(2,"0")).join(""); };
      const POS = { 1: [[32, 33, 27]], 2: [[22, 28, 17], [42, 38, 17]], 3: [[22, 23, 15], [43, 27, 14], [31, 45, 15]], 4: [[20, 20, 12], [44, 20, 12], [20, 44, 12], [44, 44, 12]] }[n];
      if(lv) for(const [x, y, a] of [[10, 52, -.9], [54, 52, .9], [32, 58, 0]]){ g.save(); g.translate(x, y); g.rotate(a); g.beginPath(); g.ellipse(0, 0, 7, 12, 0, 0, Math.PI*2); g.fillStyle = "#8fc48a"; g.fill(); g.strokeStyle = "rgba(255,255,255,.4)"; g.lineWidth = 1; g.beginPath(); g.moveTo(0, -10); g.lineTo(0, 10); g.stroke(); g.restore(); }
      POS.forEach(([cx, cy, rr], h) => { const c = cols[h % cols.length], rq = rng(k*31 + h);
        g.beginPath(); for(let j2 = 0; j2 <= 32; j2++){ const an = j2/32*Math.PI*2, q2 = rr*(.95 + .05*Math.sin(an*5 + h)); g.lineTo(cx + Math.cos(an)*q2, cy + Math.sin(an)*q2); } g.closePath();
        const gr = g.createRadialGradient(cx - rr*.35, cy - rr*.4, 1, cx, cy, rr*1.05); gr.addColorStop(0, mixC(c, "#ffffff", grd ? .55 : .3)); gr.addColorStop(1, mixC(c, grd ? "#7a6aa0" : "#6a5a88", grd ? .14 : .06)); g.fillStyle = gr; g.fill();
        if(rim){ g.strokeStyle = "rgba(255,255,255,.75)"; g.lineWidth = 1.6; g.stroke(); }
        g.save(); g.clip();
        if(pat === "faint") for(let j2 = 0; j2 < Math.round(rr*.5); j2++){ const an = j2*2.4 + h, d = Math.sqrt((j2 + .5)/(rr*.5))*rr*.72, fx = cx + Math.cos(an)*d, fy = cy + Math.sin(an)*d;
          for(let p2 = 0; p2 < 4; p2++){ const a3 = p2*1.5708 + .5 + h; g.save(); g.translate(fx + Math.cos(a3)*2.5, fy + Math.sin(a3)*2.5); g.rotate(a3); g.beginPath(); g.ellipse(0, 0, 2.7, 2, 0, 0, Math.PI*2); g.fillStyle = mixC(c, "#ffffff", .2); g.fill(); g.restore(); } }
        if(pat === "dots") for(let j2 = 0; j2 < rr; j2++){ g.beginPath(); g.arc(cx + (rq() - .5)*rr*1.6, cy + (rq() - .5)*rr*1.6, .9 + rq()*.7, 0, Math.PI*2); g.fillStyle = "rgba(255,255,255,.75)"; g.fill(); }
        if(pat === "fiber"){ g.lineWidth = .7; for(let j2 = 0; j2 < 26; j2++){ const x = cx + (rq() - .5)*rr*2, y = cy + (rq() - .5)*rr*2; g.strokeStyle = "rgba(255,255,255,.4)"; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 5, y + rq()*5 - 2.5, x + 8 + rq()*6, y + rq()*4 - 2); g.stroke(); } }
        g.restore(); });
      g.restore(); });
    // 方塊型的櫻花（材質格 83～85 樹冠、86 垂下來的花串）：整格粉粉的，有一些小縫看得到裡面、一朵朵小花是自己畫的
    [["#f6b8cb", "#f9cbd8", "#ef9fb7", 0], ["#fad3de", "#fde2ea", "#f4b8c8", 0], ["#f6b8cb", "#f9cbd8", "#ef9fb7", 1]].forEach(([c1, c2, c3, lv], k) => { const ox = ((83 + k) % COLS)*N, oy = Math.floor((83 + k) / COLS)*N, rq = rng(500 + k); g.save(); g.translate(ox, oy); g.beginPath(); g.rect(0, 0, N, N); g.clip(); g.clearRect(0, 0, N, N);
      g.fillStyle = c1; g.fillRect(0, 0, N, N);
      for(let j = 0; j < 26; j++){ const x = rq()*N, y = rq()*N, rr = 4 + rq()*4, cc = [c2, c3, c1][j % 3]; for(let p2 = 0; p2 < 5; p2++){ const a = p2*1.2566 + j; g.beginPath(); g.ellipse(x + Math.cos(a)*rr*.5, y + Math.sin(a)*rr*.5, rr*.48, rr*.34, a, 0, Math.PI*2); g.fillStyle = cc; g.fill(); } g.beginPath(); g.arc(x, y, rr*.18, 0, Math.PI*2); g.fillStyle = "#e57d9a"; g.fill(); }
      if(lv) for(let j = 0; j < 7; j++){ const x = rq()*N, y = rq()*N, a = rq()*6.28; g.save(); g.translate(x, y); g.rotate(a); g.beginPath(); g.ellipse(0, 0, 2.6, 5.5, 0, 0, Math.PI*2); g.fillStyle = "#8fc48a"; g.fill(); g.restore(); }
      g.lineWidth = .7; for(let j = 0; j < 30; j++){ const x = rq()*N, y = rq()*N; g.strokeStyle = "rgba(255,255,255,.35)"; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 5, y + rq()*4 - 2, x + 9, y + rq()*4 - 2); g.stroke(); }
      g.globalCompositeOperation = "destination-out"; for(let j = 0; j < 9; j++){ g.beginPath(); g.ellipse(rq()*N, rq()*N, 2 + rq()*3, 1.5 + rq()*2.5, rq()*3, 0, Math.PI*2); g.fill(); } g.globalCompositeOperation = "source-over";   // 小縫
      g.restore(); });
    { const ox = (86 % COLS)*N, oy = Math.floor(86 / COLS)*N; g.save(); g.translate(ox, oy); g.beginPath(); g.rect(0, 0, N, N); g.clip(); g.clearRect(0, 0, N, N); const rq = rng(77);
      for(let s2 = 0; s2 < 6; s2++){ const x = 6 + s2*10.5, L = 26 + rq()*30; for(let y = 4; y < L; y += 6){ const rr = 4.2 - y/L*1.6; for(let p2 = 0; p2 < 5; p2++){ const a = p2*1.2566 + y; g.beginPath(); g.ellipse(x + Math.cos(a)*rr*.5, y + Math.sin(a)*rr*.5, rr*.5, rr*.36, a, 0, Math.PI*2); g.fillStyle = ["#f6b8cb", "#f9cbd8", "#ef9fb7"][(y + s2) % 3]; g.fill(); } } }
      g.restore(); }
    // 真的櫻花（材質格 87、88）：一叢十幾朵五瓣小花，有正面、側面、花苞，花瓣根部比較粉、尖端白白的，花心深粉、細細的花蕊
    [0, 1, 2, 3].forEach(k => { const ox = ((87 + k) % COLS)*N, oy = Math.floor((87 + k) / COLS)*N, rq = rng(900 + k); g.save(); g.translate(ox, oy); g.beginPath(); g.rect(0, 0, N, N); g.clip(); g.clearRect(0, 0, N, N);
      const flower = (x, y, rr, a, squash, white) => { g.save(); g.translate(x, y); g.rotate(a); g.scale(1, squash);
        for(let p2 = 0; p2 < 5; p2++){ g.save(); g.rotate(p2*1.2566); const L = rr, W2 = rr*.52;
          g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(W2, -L*.2, W2*1.1, -L*.8, W2*.3, -L); g.quadraticCurveTo(0, -L*.86, -W2*.3, -L); g.bezierCurveTo(-W2*1.1, -L*.8, -W2, -L*.2, 0, 0); g.closePath();
          const gr = g.createLinearGradient(0, 0, 0, -L); if(k === 3){ gr.addColorStop(0, "#e2668c"); gr.addColorStop(.5, "#f093ae"); gr.addColorStop(1, "#fbc8d6"); } else { gr.addColorStop(0, white ? "#f7c4d3" : "#f3a5bc"); gr.addColorStop(.5, white ? "#fdeef2" : "#fbd3de"); gr.addColorStop(1, white ? "#fffbfc" : "#fff1f5"); } g.fillStyle = gr; g.fill();
          g.strokeStyle = "rgba(220,140,165,.25)"; g.lineWidth = .5; g.stroke(); g.restore(); }
        g.fillStyle = "#d9637f"; g.beginPath(); g.arc(0, 0, rr*.2, 0, Math.PI*2); g.fill();
        g.strokeStyle = "#f2a0b8"; g.lineWidth = .45; for(let s3 = 0; s3 < 8; s3++){ const an = s3*.785; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(an)*rr*.45, Math.sin(an)*rr*.45); g.stroke(); g.fillStyle = "#f6d06a"; g.beginPath(); g.arc(Math.cos(an)*rr*.47, Math.sin(an)*rr*.47, .65, 0, Math.PI*2); g.fill(); }
        g.restore(); };
      // 細細的小枝
      g.strokeStyle = "rgba(150,110,95,.55)"; g.lineWidth = .9; g.beginPath(); g.moveTo(4, 60); g.quadraticCurveTo(24, 40, 30, 30); g.moveTo(22, 44); g.quadraticCurveTo(40, 42, 54, 46); g.stroke();
      for(let j = 0; j < 4; j++){ const x = 10 + rq()*44, y = 10 + rq()*44; g.save(); g.translate(x, y); g.rotate(rq()*6.28); g.beginPath(); g.ellipse(0, 0, 2.2, 3.6, 0, 0, Math.PI*2); g.fillStyle = "#e0718f"; g.fill(); g.restore(); }   // 花苞
      if(k) for(let j = 0; j < 3; j++){ const x = 8 + rq()*48, y = 8 + rq()*48; g.save(); g.translate(x, y); g.rotate(rq()*6.28); g.beginPath(); g.ellipse(0, 0, 2.5, 5, 0, 0, Math.PI*2); g.fillStyle = "#a86a5a"; g.fill(); g.restore(); }   // 紅紅的嫩葉
      const F = []; for(let j = 0; j < 14; j++) F.push([8 + rq()*48, 8 + rq()*48, 5 + rq()*4.5, rq()*6.28, rq() < .3 ? .45 + rq()*.3 : 1, k === 2 ? true : k === 3 ? false : rq() < .45]);
      F.sort((a, b) => a[2] - b[2]).forEach(f => flower(...f));
      g.restore(); });
    // 家具材質（材質格 128 起）：4 種風格 × 每種顏色一張
    // 風格 0 和紙、1 像素點點、2 手繪木紋布紋、3 粉彩小圖案
    for(let st = 0; st < 9; st++) FV_COLS.forEach((c, ci) => { const k = 128 + st*FV_COLS.length + ci, ox = (k % COLS)*N, oy = Math.floor(k / COLS)*N, kind = FV_KIND(c), rq = rng(k*7);
      g.save(); g.translate(ox, oy); g.beginPath(); g.rect(0, 0, N, N); g.clip();
      const hx = h => [1,3,5].map(i => parseInt(h.substr(i,2),16)), mixc = (a, b2, t2) => { const x = hx(a), y2 = hx(b2); return "#" + x.map((vv,i) => Math.round(vv + (y2[i]-vv)*t2).toString(16).padStart(2,"0")).join(""); };
      const dk2 = (t2 = .15) => mixc(c, "#3a2a28", t2), lt2 = (t2 = .3) => mixc(c, "#ffffff", t2);
      g.fillStyle = c; g.fillRect(0, 0, N, N);
      if(st === 0){   // 和紙：纖維＋撕紙邊
        g.lineWidth = .8; for(let j = 0; j < 55; j++){ const x = rq()*N, y = rq()*N; g.strokeStyle = rq() < .8 ? "rgba(255,255,255,.4)" : "rgba(90,60,40,.12)"; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 6, y + rq()*6 - 3, x + 10 + rq()*8, y + rq()*5 - 2.5); g.stroke(); }
        if(kind === "wood"){ g.strokeStyle = "rgba(120,80,40,.18)"; g.lineWidth = 1.2; for(let y = 8; y < N; y += 16){ g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(20, y + 3, 40, y - 3, 64, y + 1); g.stroke(); } }
        if(kind === "rope"){ g.strokeStyle = "rgba(140,100,60,.3)"; g.lineWidth = 2; for(let y = 0; y < N; y += 6){ g.beginPath(); g.moveTo(0, y); g.lineTo(N, y + 3); g.stroke(); } }
        g.lineWidth = 2; g.strokeStyle = "rgba(255,250,240,.5)"; g.strokeRect(1.5, 1.5, N - 3, N - 3); }
      else if(st === 1){   // 像素點點：8×8 小格子深淺不一
        for(let y = 0; y < 8; y++) for(let x = 0; x < 8; x++){ let t2 = (rq() - .5)*.16; if(kind === "wood" && y % 3 === 2) t2 -= .12; if(kind === "rope" && (x + y) % 3 === 0) t2 -= .14; if(kind === "fabric" && (x + y) % 2) t2 += .04;
          g.fillStyle = t2 < 0 ? mixc(c, "#3a2a28", -t2) : mixc(c, "#ffffff", t2); g.fillRect(x*8, y*8, 8, 8); }
        g.fillStyle = dk2(.12); g.fillRect(0, 0, N, 2); g.fillRect(0, 0, 2, N); g.fillStyle = lt2(.25); g.fillRect(0, N - 2, N, 2); g.fillRect(N - 2, 0, 2, N); }
      else if(st === 2){   // 手繪：木紋、布紋、麻繩
        if(kind === "wood"){ g.strokeStyle = dk2(.18); g.lineWidth = 1.3; for(let y = 4; y < N; y += 7){ g.beginPath(); g.moveTo(0, y); for(let x = 0; x <= N; x += 8) g.lineTo(x, y + Math.sin(x*.12 + y)*1.6); g.stroke(); }
          g.strokeStyle = dk2(.25); g.beginPath(); g.ellipse(40, 30, 5, 3, 0, 0, Math.PI*2); g.stroke(); g.fillStyle = dk2(.2); g.fillRect(0, 31, N, 1.5); }
        else if(kind === "fabric"){ g.strokeStyle = lt2(.28); g.lineWidth = 2; for(let y = 0; y < N; y += 8) for(let x = 0; x < N; x += 8){ g.beginPath(); g.moveTo(x + 1, y + 2); g.lineTo(x + 4, y + 6); g.lineTo(x + 7, y + 2); g.stroke(); }
          g.strokeStyle = dk2(.08); g.lineWidth = 1; g.setLineDash([3, 3]); g.strokeRect(3, 3, N - 6, N - 6); g.setLineDash([]); }
        else if(kind === "rope"){ for(let y = 0; y < N; y += 5){ g.fillStyle = y % 10 ? dk2(.1) : lt2(.15); g.fillRect(0, y, N, 5); g.strokeStyle = dk2(.25); g.lineWidth = .8; for(let x = -4; x < N; x += 5){ g.beginPath(); g.moveTo(x, y + 5); g.lineTo(x + 4, y); g.stroke(); } } }
        else { const gr = g.createLinearGradient(0, 0, 0, N); gr.addColorStop(0, lt2(.3)); gr.addColorStop(1, c); g.fillStyle = gr; g.fillRect(0, 0, N, N); } }
      else if(st === 4){   // 格紋（野餐布那種格子），木頭是刷白的木板
        if(kind === "wood"){ g.fillStyle = lt2(.35); g.fillRect(0, 0, N, N); g.strokeStyle = dk2(.12); g.lineWidth = 1; for(let y = 0; y < N; y += 16){ g.beginPath(); g.moveTo(0, y + .5); g.lineTo(N, y + .5); g.stroke(); } g.fillStyle = "rgba(255,255,255,.35)"; for(let j = 0; j < 30; j++) g.fillRect(rq()*N, rq()*N, 6 + rq()*8, 1); }
        else { g.fillStyle = "rgba(255,255,255,.45)"; for(let x = 0; x < N; x += 16) g.fillRect(x, 0, 8, N); for(let y = 0; y < N; y += 16) g.fillRect(0, y, N, 8); g.fillStyle = "rgba(255,255,255,.25)"; for(let x = 0; x < N; x += 16) for(let y = 0; y < N; y += 16) g.fillRect(x, y, 8, 8); } }
      else if(st === 5){   // 條紋，木頭是深色亮亮的漆木
        if(kind === "wood"){ g.fillStyle = dk2(.2); g.fillRect(0, 0, N, N); g.strokeStyle = "rgba(255,240,220,.22)"; g.lineWidth = 2; for(let y = 6; y < N; y += 12){ g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(20, y + 2, 44, y - 2, 64, y); g.stroke(); } g.fillStyle = "rgba(255,255,255,.18)"; g.fillRect(0, 0, N, 6); }
        else { g.fillStyle = lt2(.5); for(let x = 0; x < N; x += 12) g.fillRect(x, 0, 5, N); g.fillStyle = dk2(.06); for(let x = 8; x < N; x += 12) g.fillRect(x, 0, 1.5, N); } }
      else if(st === 6){   // 小碎花布，木頭上有手繪小花
        if(kind === "wood"){ g.strokeStyle = dk2(.12); g.lineWidth = 1; for(let y = 5; y < N; y += 10){ g.beginPath(); g.moveTo(0, y); g.lineTo(N, y + 1); g.stroke(); } }
        const fl = (x, y, r2, cc) => { g.fillStyle = cc; for(let k2 = 0; k2 < 5; k2++){ const a = k2*1.2566; g.beginPath(); g.arc(x + Math.cos(a)*r2, y + Math.sin(a)*r2, r2*.8, 0, Math.PI*2); g.fill(); } g.fillStyle = "#ffe08a"; g.beginPath(); g.arc(x, y, r2*.6, 0, Math.PI*2); g.fill(); };
        if(kind === "fabric") for(let j = 0; j < 9; j++){ const x = rq()*N, y = rq()*N; fl(x, y, 2.4, ["#ffffff", "#ffd6e0", "#d6e8ff"][j % 3]); g.fillStyle = "#8fc48a"; g.beginPath(); g.ellipse(x + 5, y + 4, 2.6, 1.2, .6, 0, Math.PI*2); g.fill(); }
        else if(kind === "wood"){ fl(16, 20, 2.2, "#f7b6c8"); fl(46, 44, 2.2, "#ffffff"); } }
      else if(st === 7){   // 針織毛線（一排排 V 字），木頭是編織籐
        if(kind === "wood" || kind === "rope"){ for(let y = 0; y < N; y += 8) for(let x = 0; x < N; x += 8){ g.fillStyle = ((x + y)/8) % 2 ? dk2(.12) : lt2(.12); g.fillRect(x, y, 8, 4); g.fillStyle = ((x + y)/8) % 2 ? lt2(.12) : dk2(.12); g.fillRect(x, y + 4, 8, 4); } }
        else { g.lineCap = "round"; for(let y = -4; y < N; y += 7) for(let x = 0; x < N; x += 8){ g.strokeStyle = (y/7 | 0) % 2 ? lt2(.22) : dk2(.06); g.lineWidth = 3.2; g.beginPath(); g.moveTo(x + 1, y); g.lineTo(x + 4, y + 6); g.lineTo(x + 7, y); g.stroke(); } g.lineCap = "butt"; } }
      else if(st === 8){   // 亞麻帆布（細細的織紋），木頭是原木切面
        if(kind === "wood"){ g.strokeStyle = dk2(.1); g.lineWidth = 1; for(let r2 = 6; r2 < 60; r2 += 6){ g.beginPath(); g.ellipse(10, 54, r2, r2*.7, 0, 0, Math.PI*2); g.stroke(); } }
        else { g.globalAlpha = .35; for(let y = 0; y < N; y += 2){ g.fillStyle = y % 4 ? lt2(.3) : dk2(.12); g.fillRect(0, y, N, 1); } for(let x = 0; x < N; x += 2){ g.fillStyle = x % 4 ? lt2(.2) : dk2(.1); g.fillRect(x, 0, 1, N); } g.globalAlpha = 1;
          for(let j = 0; j < 12; j++){ g.fillStyle = "rgba(120,90,60,.12)"; g.fillRect(rq()*N, rq()*N, 1 + rq()*3, 1); } } }
      else {   // 粉彩小圖案：點點、小愛心、條紋
        if(kind === "fabric"){ g.fillStyle = lt2(.45); for(let y = 0; y < 4; y++) for(let x = 0; x < 4; x++){ g.beginPath(); g.arc(8 + x*16 + (y % 2)*8, 8 + y*16, 3, 0, Math.PI*2); g.fill(); } }
        else if(kind === "wood"){ for(let y = 0; y < N; y += 16){ g.fillStyle = (y/16) % 2 ? dk2(.05) : lt2(.08); g.fillRect(0, y, N, 15); g.fillStyle = dk2(.15); g.fillRect(0, y + 15, N, 1); }
          g.fillStyle = "#f7b6c8"; for(const [x, y] of [[12, 8], [44, 40]]){ g.beginPath(); g.moveTo(x, y + 3); g.bezierCurveTo(x - 4, y, x - 2, y - 3, x, y - 1); g.bezierCurveTo(x + 2, y - 3, x + 4, y, x, y + 3); g.fill(); } }
        else if(kind === "rope"){ for(let y = 0; y < N; y += 8){ g.fillStyle = (y/8) % 2 ? "#f7d6df" : lt2(.2); g.fillRect(0, y, N, 8); } }
        else { g.fillStyle = "rgba(255,255,255,.5)"; g.beginPath(); g.ellipse(18, 16, 10, 5, -.5, 0, Math.PI*2); g.fill(); } }
      g.restore(); });

    // 顏色格（材質格 52 切成 8×8 小格，給 30 款樹葉裡面那層用）
    { const ox = (127 % COLS)*N, oy = Math.floor(127 / COLS)*N; FOL_INNER.forEach((c, k) => { g.fillStyle = c; g.fillRect(ox + (k % 8)*8, oy + Math.floor(k / 8)*8, 8, 8); }); }
    // 裂痕（按住「拿」時一格一格裂開）：材質格 246～250，背景透明，越後面裂越多
    { const q = rng(77), segs = []; const walk = (x, y, a, n, d) => { for(let i = 0; i < n; i++){ const L = 5 + q()*6, nx = x + Math.cos(a)*L, ny = y + Math.sin(a)*L; segs.push([x, y, nx, ny, d]); x = nx; y = ny; a += (q() - .5)*1.1; if(q() < .3) walk(x, y, a + (q() < .5 ? 1 : -1)*(.8 + q()*.6), 2 + Math.floor(q()*2), d + 1); } };
      for(let k = 0; k < 6; k++) walk(32 + (q() - .5)*10, 32 + (q() - .5)*10, k/6*Math.PI*2 + q()*.5, 4, 0);
      for(let st = 0; st < 5; st++){ const ox = ((246 + st) % COLS)*N, oy = Math.floor((246 + st)/COLS)*N, lim = Math.ceil(segs.length*(st + 1)/5);
        g.save(); g.translate(ox, oy); g.clearRect(0, 0, N, N); g.lineCap = "round";
        for(const [w, c] of [[3.2, "rgba(255,250,240,.35)"], [1.8, "rgba(60,35,40,.72)"]]){ g.lineWidth = w; g.strokeStyle = c; g.beginPath(); segs.slice(0, lim).forEach(([a, b, c2, d]) => { g.moveTo(a, b); g.lineTo(c2, d); }); g.stroke(); }
        g.restore(); } }
    return { cv, COLS, N };
  }
  void TILE_N;
  // 挖方塊時噴出來的碎屑顏色（跟材質差不多）
  const TILE_COL = [["#a8c99a","#f2e6c8"],["#c9a880","#a8c99a"],["#c9a880","#a88a66"],["#b8b8c0","#d0d0d6"],["#dcc19a","#efd7d9"],["#cfb084","#b8986c"],["#c97f86","#cfb084"],["#93b98c","#a8c99a"],["#9ec3d6","#ffffff"],["#c97f86","#d89aa0"],["#e6d6b0","#f3e3c0"],["#d49a86","#efe6d4"],["#d6a2ac","#e6c2c8"],["#e6f0f0","#a08060"],["#f7f2ea","#ffffff"],["#ece9ec","#f7f2ea"],["#d8dbe4","#c9d3e4"],["#f7bccb","#fff6f8"],["#9fd39a","#b2dfa6"],["#fcd3df","#f39ab4"],["#a8d9a0","#86c286"],["#fbd6e0","#f2b3c6"]];

  // ---------- 世界 ----------
  // 世界：飄在天空的白雲島（主島＋幾塊小雲朵踏腳石），下面是雲海
  const W = 56, H = 28, D = 56, GY = 6;   // GY：主島上面的高度
  function makeWorld(){
    const v = new Uint8Array(W*H*D), at = (x,y,z) => x + W*(z + D*y);
    const set = (x,y,z,b) => { if(x>=0&&x<W&&y>=0&&y<H&&z>=0&&z<D) v[at(x,y,z)] = b; };
    const get = (x,y,z) => (x>=0&&x<W&&y>=0&&y<H&&z>=0&&z<D) ? v[at(x,y,z)] : B.AIR;
    const r = rng(2026), CX = 28, CZ = 28;
    // 一塊雲：上面平平的，下面胖胖圓圓
    const blob = (cx, cz, top, R, seed, grass) => { const q = rng(seed);
      const bumps = Array.from({ length: 6 }, () => [q()*Math.PI*2, .75 + q()*.5]);
      for(let x = Math.floor(cx-R-3); x <= cx+R+3; x++) for(let z = Math.floor(cz-R-3); z <= cz+R+3; z++){
        const ang = Math.atan2(z-cz, x-cx); let rr = R; for(const [ph, k] of bumps) rr += Math.cos(ang*3 - ph)*k*.6;
        const d = Math.hypot(x+.5-cx, z+.5-cz); if(d > rr) continue;
        const depth = 1 + Math.floor((1 - d/rr) * Math.min(5, R*.45)) + (q() < .3 ? 1 : 0);
        for(let y = top - depth; y <= top; y++) set(x, y, z, y === top ? (grass && d < rr - 1.3 ? B.GRASS : B.CLOUD) : B.CLOUDB);   // 主島上面是草地，邊邊一圈軟軟的雲
      } };
    blob(CX, CZ, GY, 14.5, 11, true);
    for(const [x,z,t,R,sd] of [[8,22,GY+1,3,21],[10,40,GY+2,2.6,22],[46,12,GY+1,3.2,23],[48,40,GY+3,2.8,24],[28,7,GY+2,2.4,25],[30,50,GY,3,26]]) blob(x, z, t, R, sd);
    const topY = (x,z) => { for(let y = H-1; y >= 0; y--) if(get(x,y,z) && get(x,y,z) !== B.WATER) return y; return -1; };
    // 貓屋：磚地基、木板牆、玻璃窗、粉紅屋頂、裡面鋪毛毯（材質都是暫時的）
    const hw = 9, hd = 8, hx = CX - 4, hz = CZ - 6, fy = GY + 1;
    for(let x = hx; x < hx+hw; x++) for(let z = hz; z < hz+hd; z++){
      set(x,fy-1,z, B.BRICK); for(let y = fy; y < fy+9; y++) set(x,y,z,B.AIR);
      const edge = x === hx || x === hx+hw-1 || z === hz || z === hz+hd-1;
      if(!edge) set(x,fy,z, B.WOOL);
      if(edge) for(let y = fy; y < fy+4; y++){ const corner = (x === hx || x === hx+hw-1) && (z === hz || z === hz+hd-1); set(x,y,z, corner ? B.LOG : B.PLANK); }
    }
    for(const [x,z] of [[hx+2,hz],[hx+6,hz],[hx,hz+3],[hx+hw-1,hz+4]]){ set(x,fy+1,z,B.GLASS); set(x,fy+2,z,B.GLASS); }
    const dx = hx + 4; for(let y = fy; y < fy+3; y++) set(dx,y,hz+hd-1,B.AIR);   // 門（三格高）
    for(let k = 0; k < 5; k++) for(let x = hx-1+k; x <= hx+hw-k; x++) for(let z = hz-1+k; z <= hz+hd-k; z++){
      const ring = x === hx-1+k || x === hx+hw-k || z === hz-1+k || z === hz+hd-k; if(ring) set(x, fy+4+k, z, B.ROOF); }
    // 幾棵樹
    const tree = (x,z,h,lf = B.LEAF) => { const g = topY(x,z) + 1; if(g < 1) return; for(let y = g; y < g+h; y++) set(x,y,z,B.LOG);
      for(let y = g+h-2; y <= g+h+1; y++){ const rr = y > g+h ? 1 : 2; for(let a = -rr; a <= rr; a++) for(let b = -rr; b <= rr; b++){ if(Math.abs(a)+Math.abs(b) > rr+1) continue; if(!get(x+a,y,z+b)) set(x+a,y,z+b,lf); } } };
    // 大櫻花樹：樹幹高一點、樹冠又寬又圓（像一棵大樹）
    const bigSakura = (x, z) => { const g = topY(x,z) + 1; if(g < 1) return; for(let y = g; y < g+5; y++) set(x,y,z,B.LOG);
      for(let y = g+3; y <= g+7; y++){ const dy = y - (g+5), rr = dy <= 0 ? 3 : dy === 1 ? 3 : 2; for(let a = -rr; a <= rr; a++) for(let b = -rr; b <= rr; b++){ if(a*a + b*b > rr*rr + 1) continue; if(!get(x+a,y,z+b)) set(x+a,y,z+b,B.SAKURA); } } };
    for(const [x,z,h,lf] of [[37,33,5,B.LEAF],[22,37,4,B.LEAF]]) tree(x,z,h,lf);
    bigSakura(18, 22); bigSakura(37, 19);
    // 小花、小蘑菇（裝飾，不會擋路）
    const flowers = [], FC = ["#f7a7b8", "#ffe08a", "#ffffff", "#cdb4f0", "#f28b82", "#a8d8ff"];
    for(let k = 0; k < 150; k++){ const x = CX - 13 + r()*26, z = CZ - 13 + r()*26, ix = Math.floor(x), iz = Math.floor(z), ty = topY(ix, iz);
      if(ty !== GY || (get(ix, ty, iz) !== B.CLOUD && get(ix, ty, iz) !== B.GRASS)) continue; if(x > hx - 2 && x < hx + hw + 1 && z > hz - 2 && z < hz + hd + 4) continue;
      flowers.push({ x, y: ty + 1, z, c: FC[k % FC.length], m: k % 9 === 0, s: .8 + r()*.5, a: r()*6 }); }
    return { v, get, set, topY, flowers, spawn:[dx+.5, fy+1, hz+hd+2.5], house:{ x:hx+hw/2, z:hz+hd/2 }, floor: fy };
  }

  // ---------- 著色器 ----------
  const VS = `attribute vec3 p; attribute vec3 n; attribute vec2 uv; attribute float sh;
  uniform mat4 M, V, P; uniform vec2 fogR; varying vec2 vuv; varying float vsh, vfog; varying vec3 vn, vvn;
  void main(){ vec4 w = M*vec4(p,1.); vec4 e = V*w; vfog = clamp((-e.z - fogR.x)/(fogR.y - fogR.x), 0., 1.); vuv = uv; vsh = sh; vn = normalize(mat3(M)*n); vvn = mat3(V)*vn; gl_Position = P*e; }`;
  const FS = `precision mediump float; varying vec2 vuv; varying float vsh, vfog; varying vec3 vn, vvn;
  uniform sampler2D tex; uniform float mode, alpha, cut; uniform vec3 col, sky, tint; uniform vec4 uvR;
  void main(){
    vec3 c; float a = alpha;
    if(mode < .5){ vec4 t = texture2D(tex, uvR.xy + vuv*uvR.zw); if(t.a < cut) discard; c = t.rgb*vsh; a *= t.a; }
    else if(mode < 1.5){ float d = dot(normalize(vn), normalize(vec3(-.4,.9,.5))); float l = d > .4 ? 1. : d > -.1 ? .86 : .72; c = col*l; }
    else if(mode < 2.5){ vec3 N = normalize(vn); float d = dot(N, normalize(vec3(-.4,.9,.5))); c = col*(.66 + .4*max(d, 0.)) + vec3(.05)*pow(max(d, 0.), 12.); }
    else { vec3 N = normalize(vn); float d = dot(N, normalize(vec3(-.4,.9,.5))); c = col*(.9 + .1*max(d, 0.)); }   // 雲：亮亮白白的，下面不會變灰   // 平滑的光（頭髮）
    gl_FragColor = vec4(mix(c*tint, sky, vfog), a);
  }`;

  // ---------- 貓的樣子（用小方塊拼） ----------
  const CAT = {
    orange:{ b:"#f2a65a", d:"#d9823a", l:"#fff2e0" }, white:{ b:"#f6f2ea", d:"#e2d8c8", l:"#ffffff" }, black:{ b:"#3a3540", d:"#26222c", l:"#5a5560" },
    gray:{ b:"#a8aeb8", d:"#8a909a", l:"#d8dce2" }, calico:{ b:"#f6f2ea", d:"#f2a65a", l:"#3a3540" },
    cream:{ b:"#f4dcb0", d:"#e0bd88", l:"#fff6e6" }, brown:{ b:"#9a6a48", d:"#74492e", l:"#f2e2d0" }, silver:{ b:"#d4d8de", d:"#9aa2ae", l:"#ffffff" },
  };
  const catKey = c => CAT[c] ? c : /bd|star|pj/.test(String(c)) ? "orange" : "orange";

  // ---------- 玩家造型：穿貓咪睡衣的方塊人（一開始就有 6 種可以選） ----------
  // pj 睡衣、lt 肚子和手腳、dk 花紋、ear 耳朵裡面、hair 頭髮、skin 皮膚、mark 花紋種類
  const AVATARS = [
    { id:"orange", name:"橘貓睡衣", pj:"#f2a65a", lt:"#fff2e0", dk:"#d9823a", ear:"#ffb3c6", hair:"#4a3428", skin:"#ffe0c8", mark:"stripe" },
    { id:"white",  name:"白貓睡衣", pj:"#f6f2ea", lt:"#ffffff", dk:"#e2d8c8", ear:"#ffb3c6", hair:"#2b2430", skin:"#ffe4cf", mark:"none" },
    { id:"black",  name:"黑貓睡衣", pj:"#3a3540", lt:"#f6f2ea", dk:"#26222c", ear:"#ff9ab4", hair:"#8a5a3a", skin:"#f6d2b8", mark:"none" },
    { id:"gray",   name:"灰貓睡衣", pj:"#a8aeb8", lt:"#e8ecf0", dk:"#7f8692", ear:"#ffb3c6", hair:"#e8c070", skin:"#ffe0c8", mark:"stripe" },
    { id:"calico", name:"三花睡衣", pj:"#f6f2ea", lt:"#ffffff", dk:"#3a3540", dk2:"#f2a65a", ear:"#ffb3c6", hair:"#6a4030", skin:"#f4cdb0", mark:"calico" },
    { id:"pink",   name:"粉紅貓睡衣", pj:"#ffb3c6", lt:"#fff0f4", dk:"#f28aa8", ear:"#ffffff", hair:"#3a2a30", skin:"#ffe4cf", mark:"none" },
  ];
  const HAIRS = [
    { id:"short", name:"短髮" }, { id:"bangs", name:"齊瀏海" }, { id:"side", name:"斜瀏海" }, { id:"middle", name:"中分" },
    { id:"long", name:"長直髮" }, { id:"twin", name:"雙馬尾" }, { id:"ahoge", name:"呆毛" }, { id:"curly", name:"捲捲頭" },
  ];
  const HAIR_COLORS = ["#2b2430","#4a3428","#8a5a3a","#e8c070","#f4a0b8","#d8dce6"];
  // 造型設定：{ pj:睡衣, hs:髮型, hc:髮色 }；舊版只存睡衣名字也看得懂
  const avOf = cfg => { const c = typeof cfg === "string" ? { pj: cfg } : (cfg || {});
    const base = AVATARS.find(a => a.id === c.pj) || AVATARS[0];
    return Object.assign({}, base, { hs: HAIRS.some(h => h.id === c.hs) ? c.hs : "short", hair: HAIR_COLORS.includes(c.hc) ? c.hc : base.hair }); };
  // 選造型用的小圖（正面像素圖）
  function portrait(cfg){
    const a = avOf(cfg), H = a.hair, g = Array.from({ length: 26 }, () => Array(18).fill(""));
    const R = (x, y, w, h, c) => { x += 1; for(let j = y; j < y+h; j++) for(let i = x; i < x+w; i++) if(g[j] && i >= 0 && i < 18) g[j][i] = c; };
    if(a.hs === "long"){ R(2,6,1,10,H); R(13,6,1,10,H); }                                // 長頭髮從帽子兩邊垂下來
    if(a.hs === "twin"){ R(-1,6,2,2,H); R(-1,8,2,6,H); R(15,6,2,2,H); R(15,8,2,6,H); }    // 雙馬尾
    R(3,1,3,3,a.pj); R(10,1,3,3,a.pj); R(4,2,1,2,a.ear); R(11,2,1,2,a.ear);            // 耳朵
    R(2,3,12,10,a.pj);                                                                 // 帽子
    R(4,5,8,7,a.skin);                                                                 // 臉
    if(a.hs === "short"){ R(4,5,8,2,H); R(4,7,1,2,H); R(11,7,1,2,H); }
    if(a.hs === "bangs"){ R(4,5,8,3,H); R(4,8,1,2,H); R(11,8,1,2,H); }
    if(a.hs === "side"){ R(4,5,8,1,H); R(4,6,6,1,H); R(4,7,3,1,H); R(11,6,1,3,H); }
    if(a.hs === "middle"){ R(4,5,3,2,H); R(9,5,3,2,H); R(4,7,1,3,H); R(11,7,1,3,H); R(7,5,2,1,H); }
    if(a.hs === "long"){ R(4,5,8,2,H); R(4,7,1,5,H); R(11,7,1,5,H); }
    if(a.hs === "twin"){ R(4,5,8,2,H); R(4,7,1,2,H); R(11,7,1,2,H); }
    if(a.hs === "ahoge"){ R(4,5,8,2,H); R(4,7,1,2,H); R(11,7,1,2,H); R(7,0,1,1,H); R(8,-1,1,1,H); R(7,1,1,2,H); }
    if(a.hs === "curly"){ R(4,5,8,2,H); for(const x of [4,6,8,10]) R(x,7,1,1,H); R(3,7,1,3,H); R(12,7,1,3,H); }
    R(6,8,1,2,"#2b2430"); R(9,8,1,2,"#2b2430"); R(5,10,1,1,"#ffb3c6"); R(10,10,1,1,"#ffb3c6"); R(7,11,2,1,"#c0606e");
    R(3,13,10,7,a.pj); R(5,14,6,5,a.lt);                                               // 身體、肚子
    R(1,13,2,6,a.pj); R(13,13,2,6,a.pj); R(1,19,2,1,a.lt); R(13,19,2,1,a.lt);          // 手
    if(a.mark === "stripe"){ R(3,14,2,1,a.dk); R(11,16,2,1,a.dk); R(6,3,4,1,a.dk); }
    if(a.mark === "calico"){ R(3,3,3,3,a.dk2); R(10,3,3,2,a.dk); R(11,15,2,3,a.dk2); }
    R(4,20,3,4,a.pj); R(9,20,3,4,a.pj); R(4,24,3,1,a.lt); R(9,24,3,1,a.lt);            // 腳
    R(14,17,2,1,a.dk); R(15,15,1,2,a.dk);                                              // 尾巴
    let r = ""; g.forEach((row, y) => row.forEach((c, x) => { if(c) r += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${c}"/>`; }));
    return `<svg viewBox="0 0 18 26" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg">${r}</svg>`;
  }

  // ---------- 設定（存在自己手機 localStorage mw_cube_set）----------
  const QUALITY = {
    low:  { scale:.6,  view:40, clouds:false, fps:30 },
    mid:  { scale:.8,  view:60, clouds:true,  fps:60 },
    high: { scale:1,   view:90, clouds:true,  fps:0 },
  };
  const DEF = { time:"real", q:"mid", scale:.8, view:60, clouds:true, fps:60, fog:true, fov:60, showFps:false,
    sens:1, invY:false, joy:"m", autoCam:true, camD:"m", sound:true, names:true };
  function loadCfg(){ let c = {}; try{ c = JSON.parse(localStorage.getItem("mw_cube_set") || "{}") || {}; }catch(e){} return Object.assign({}, DEF, c); }
  function saveCfg(c){ try{ localStorage.setItem("mw_cube_set", JSON.stringify(c)); }catch(e){} }

  let cur = null;   // 同時只能開一個
  // 尾巴的樣子（站長選了 4 垂垂勾勾；其他留著以後可以當造型選項）：c = 身體座標的控制點（往後是 -z），n = 幾節方塊，r(u) = 每節粗細
  const TAILS = {
    1: { name:"彎彎問號", n:7, c:[[0,.6,-.16],[0,.56,-.3],[0,.63,-.45],[0,.8,-.54],[0,1.0,-.55],[0,1.13,-.48],[0,1.19,-.38]], r:u => .1 - u*.015 },
    2: { name:"翹翹直尾巴", n:5, c:[[0,.6,-.16],[0,.68,-.3],[0,.8,-.42],[0,.94,-.52],[0,1.08,-.58],[0,1.2,-.6]], r:u => .1 - u*.01 },
    3: { name:"胖胖短尾巴", n:3, c:[[0,.6,-.16],[0,.62,-.3],[0,.7,-.42],[0,.82,-.48]], r:u => .15 - u*.02 },
    4: { name:"垂垂勾勾", n:6, c:[[0,.6,-.16],[0,.48,-.3],[0,.36,-.42],[0,.3,-.56],[0,.36,-.7],[0,.5,-.76]], r:u => .095 - u*.01 },
  };
  function open(o){
    if(cur) return cur;
    let last = performance.now(), raf = 0, dead = false, t0 = last, offAll = () => {};
    const CFG = loadCfg();
    // 兩種模式：生存（方塊要自己挖、放一個少一個；家具要換）／創造（方塊家具無限、可以飛、一下就拆）。創造模式是另一座島，存檔分開（鍵名後面加 _c），不會影響生存的進度
    const CREATIVE = o.mode === "c", MK = CREATIVE ? "_c" : "";
    // 按鈕上的小圖示（向量圖，不是 emoji）
    const SVG = { jump:'<svg viewBox="0 0 30 30"><path d="M15 5 6.5 14.5h5.5v9h6v-9h5.5z" fill="currentColor"/></svg>',
      put:'<svg viewBox="0 0 30 30"><path d="M15 4 26 10v11l-11 6-11-6V10z" fill="currentColor" opacity=".35"/><path d="M15 4 26 10 15 16 4 10z" fill="currentColor"/></svg>',
      take:'<svg viewBox="0 0 26 26"><path d="M8 13V7.5a1.6 1.6 0 0 1 3.2 0V12m0-5.5a1.6 1.6 0 0 1 3.2 0V12m0-4a1.6 1.6 0 0 1 3.2 0V13m0-2.5a1.6 1.6 0 0 1 3.2 0V15c0 4-2.8 7-6.8 7-3 0-4.6-1.4-6.4-4l-2.6-4a1.7 1.7 0 0 1 2.8-1.9L8 13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      rot:'<svg viewBox="0 0 24 24"><path d="M19 12a7 7 0 1 1-2.1-5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M18.5 3v4.5H14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>' };
    const root = document.createElement("div"); root.className = "p3d " + (CREATIVE ? "modeC" : "modeS");
    root.innerHTML = `<canvas class="p3dC"></canvas><div class="p3dL" id="p3dL"></div>
      <div class="p3dTop"><button class="p3dX" id="p3dX"><span class="p3dBack"></span><span>離開</span></button><span class="p3dT">喵喵方塊島<small class="p3dMode">${CREATIVE ? "創造模式" : "生存模式"}</small></span><span class="p3dF" id="p3dF" hidden></span><span class="p3dFps" id="p3dFps" hidden></span><button class="p3dX p3dBuildT" id="p3dBuildT">${o.icon ? `<span class="p3dIc">${o.icon("home")}</span>` : ""}<span>蓋房子</span></button><button class="p3dX p3dGear" id="p3dGear">${o.icon ? `<span class="p3dIc">${o.icon("gear")}</span>` : ""}<span>設定</span></button></div>
      <div class="p3dSet" id="p3dSet" hidden></div>
      <div class="p3dTalk" id="p3dTalk" hidden></div>
      <div class="p3dBuild" id="p3dBuild" hidden><div class="p3dCross" id="p3dCross"></div><div class="p3dTool" id="p3dTool"><button data-t="put" class="on">方塊</button><button data-t="furn">家具</button></div><div class="p3dActs"><button class="p3dFRot" id="p3dFRot" hidden><i class="p3dSv">${SVG.rot}</i>轉向</button><button class="p3dTake" id="p3dTake"><i class="p3dSv">${SVG.take}</i><span>拿</span></button><button class="p3dPut" id="p3dPut"><i class="p3dSv">${SVG.put}</i><span>放</span></button></div><button class="p3dUndo" id="p3dUndo">復原</button><div class="p3dBar" id="p3dBar"></div><div class="p3dBHint" id="p3dBHint"></div><div class="p3dCnt" id="p3dCnt"></div></div><div class="p3dClock" id="p3dClock"></div>
      <div class="p3dHint" id="p3dHint">左下搖桿走路・右邊拖曳轉鏡頭</div>
      <div class="p3dRot" id="p3dRot"><div class="p3dRotPh"><i></i></div><div>把手機轉橫的玩</div><button id="p3dRotX">直的也沒關係</button></div>
      <div class="p3dJoy" id="p3dJoy"><i></i></div>
      <div class="p3dBtns"><div class="p3dAct" id="p3dAct"></div><button class="p3dFly" id="p3dFly" hidden>飛</button><button class="p3dDown" id="p3dDown" hidden>下</button><button class="p3dJump" id="p3dJump"><i class="p3dSv">${SVG.jump}</i><span>跳</span></button></div>`;
    document.body.appendChild(root); document.body.classList.add("p3dOn");
    // 全螢幕＋轉成橫的（Android 可以鎖橫向；鎖不了的手機就顯示「轉橫的玩」的小提示）
    const lockLand = () => { try{ const so = screen.orientation; if(so && so.lock) return so.lock("landscape").catch(() => {}); }catch(e){} return Promise.resolve(); };
    try{ if(root.requestFullscreen && !document.fullscreenElement) root.requestFullscreen({ navigationUI:"hide" }).then(lockLand).catch(lockLand); else lockLand(); }catch(e){}
    const cv = root.querySelector(".p3dC");
    const gl = cv.getContext("webgl", { antialias:true, alpha:false });
    const fail = msg => { root.innerHTML = `<div class="p3dErr">${msg}<br><button class="btn" id="p3dX">回去</button></div>`; root.querySelector("#p3dX").onclick = close; cur = { close }; return cur; };
    if(!gl) return fail("這支手機不支援 3D 畫面");
    try{ return (cur = build()); }catch(err){ console.error(err); return fail("3D 畫面開不起來，請再試一次"); }
    function build(){
    const shd = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if(!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
    const PR = gl.createProgram(); gl.attachShader(PR, shd(gl.VERTEX_SHADER, VS)); gl.attachShader(PR, shd(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(PR); gl.useProgram(PR);
    const UL = {}, U = n => UL[n] || (UL[n] = gl.getUniformLocation(PR, n));
    // 天空：上面深一點的藍、靠近地平線淡淡的（另外一個很小的著色器，畫在最後面）
    const SPR = gl.createProgram(); gl.attachShader(SPR, shd(gl.VERTEX_SHADER, "attribute vec2 q; varying float vy; void main(){ vy = q.y*.5 + .5; gl_Position = vec4(q, .9999, 1.); }"));
    gl.attachShader(SPR, shd(gl.FRAGMENT_SHADER, "precision mediump float; varying float vy; uniform vec3 a, b; void main(){ gl_FragColor = vec4(mix(b, a, smoothstep(.35, 1.1, vy)), 1.); }")); gl.linkProgram(SPR);
    const SKYQ = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, SKYQ); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    const SA = gl.getAttribLocation(SPR, "q"), SUa = gl.getUniformLocation(SPR, "a"), SUb = gl.getUniformLocation(SPR, "b");
    function drawSky(){ gl.useProgram(SPR); gl.disable(gl.DEPTH_TEST); gl.bindBuffer(gl.ARRAY_BUFFER, SKYQ); for(let i = 0; i < 8; i++) gl.disableVertexAttribArray(i); gl.enableVertexAttribArray(SA); gl.vertexAttribPointer(SA, 2, gl.FLOAT, false, 0, 0);
      gl.uniform3fv(SUb, SKY); gl.uniform3fv(SUa, SKY.map((v, i) => Math.min(1, v*.74 + [.0, .05, .12][i]))); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.disableVertexAttribArray(SA); gl.useProgram(PR); gl.enable(gl.DEPTH_TEST); }
    gl.uniform1f(U("cut"), .08); gl.uniform4f(U("uvR"), 0, 0, 1, 1);
    const AL = { p:gl.getAttribLocation(PR,"p"), n:gl.getAttribLocation(PR,"n"), uv:gl.getAttribLocation(PR,"uv"), sh:gl.getAttribLocation(PR,"sh") };
    const buf = (a, t = gl.ARRAY_BUFFER, A = Float32Array) => { const b = gl.createBuffer(); gl.bindBuffer(t, b); gl.bufferData(t, new A(a), gl.STATIC_DRAW); return b; };
    const mesh = (P, N, UV, SH, I) => ({ p:buf(P), n:buf(N), uv:buf(UV), sh:buf(SH), i:buf(I, gl.ELEMENT_ARRAY_BUFFER, Uint16Array), c:I.length });
    let bind = function(m){ for(const [k, sz] of [["p",3],["n",3],["uv",2],["sh",1]]){ gl.bindBuffer(gl.ARRAY_BUFFER, m[k]); gl.enableVertexAttribArray(AL[k]); gl.vertexAttribPointer(AL[k], sz, gl.FLOAT, false, 0, 0); } gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.i); }

    // 材質
    const atlas = makeAtlas(), tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas.cv);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);   // 軟軟的材質，不要像素感
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const tileUV = k => { const s = 1/atlas.COLS, e = .002, u = (k % atlas.COLS)*s, v = Math.floor(k / atlas.COLS)*s; return [u+e, v+e, u+s-e, v+s-e]; };

    // 世界的網格（不透明一份、半透明一份；超過 65535 個點就分成好幾塊）
    const world = makeWorld();
    // 自己蓋的方塊（存在手機 localStorage mw_cube_edits：{"x,y,z": 方塊種類}）
    // 上限：一座島最多改 MAX_EDITS 格（放或挖都算一格；改回原本的樣子就不算），以後存到伺服器時每座島大約 12 KB 以內
    const MAX_EDITS = 3000, ORIG = makeWorld();
    let EDITS = {}; try{ EDITS = JSON.parse(localStorage.getItem("mw_cube_edits" + MK) || "{}") || {}; }catch(e){}
    let nEdit = 0;
    for(const k in EDITS){ const [x, y, z] = k.split(",").map(Number);
      if(!(y > 0 && y < H) || (ORIG.get(x, y, z) || 0) === EDITS[k] || nEdit >= MAX_EDITS){ delete EDITS[k]; continue; } world.set(x, y, z, EDITS[k]); nEdit++; }
    const saveEdits = () => { try{ localStorage.setItem("mw_cube_edits" + MK, JSON.stringify(EDITS)); }catch(e){} };
    // 記一格的改變：改回原本的就刪掉，回傳 false 代表超過上限
    function editCell(x, y, z, b){ const k = `${x},${y},${z}`, orig = ORIG.get(x, y, z) || 0;
      if(b === orig){ if(k in EDITS){ delete EDITS[k]; nEdit--; } return true; }
      if(!(k in EDITS)){ if(nEdit >= MAX_EDITS) return false; nEdit++; } EDITS[k] = b; return true; }
    // ---------- 家具：背包＋擺在島上（存在手機 mw_cube_furn：{ inv:{id:數量}, placed:[{id,x,y,z,r}] }，x/y/z 是腳下那一格） ----------
    // 之後要跟旅行貓換；現在試玩頁先每件送 1 個
    let FS_ = null; try{ FS_ = JSON.parse(localStorage.getItem("mw_cube_furn" + MK) || "null"); }catch(e){}
    const FSAVE = FS_ && FS_.inv && Array.isArray(FS_.placed) ? FS_ : { inv:null, placed:[] };
    // 島上的小花／小蘑菇可以採（按住「拿」）：今天採過的記在 mw_cube_pick（隔天會再長出來），採到的放進材料背包 mw_cube_mat
    const dayNo = () => { const d = new Date(); return d.getFullYear()*10000 + (d.getMonth()+1)*100 + d.getDate(); };
    let MAT = {}; try{ MAT = JSON.parse(localStorage.getItem("mw_cube_mat" + MK) || "{}") || {}; }catch(e){}
    let PICK = { d:dayNo(), i:[] }; try{ const q = JSON.parse(localStorage.getItem("mw_cube_pick" + MK) || "null"); if(q && q.d === PICK.d && Array.isArray(q.i)) PICK = q; }catch(e){}
    (world.flowers || []).forEach((f, i) => { if(PICK.i.includes(i)) f.gone = true; });
    const savePick = () => { try{ localStorage.setItem("mw_cube_pick" + MK, JSON.stringify(PICK)); localStorage.setItem("mw_cube_mat" + MK, JSON.stringify(MAT)); }catch(e){} };
    // 生存模式的方塊背包（mw_cube_inv：{方塊種類: 數量}）：挖下來的方塊放進來，放一個少一個
    let BINV = {}; try{ BINV = JSON.parse(localStorage.getItem("mw_cube_inv") || "{}") || {}; }catch(e){}
    const saveInv = () => { try{ localStorage.setItem("mw_cube_inv", JSON.stringify(BINV)); }catch(e){} };
    const saveFurn = () => { try{ localStorage.setItem("mw_cube_furn" + MK, JSON.stringify(FSAVE)); }catch(e){} };
    const F_FLAT = new Set(["rug", "pond"]), F_WALK = new Set(["rug", "pond", "cushion", "bowl"]);   // 平平的可以疊在上面放別的；走得過去的不擋路
    let FCAP = null, FSOL = new Set(), FV_A = 1; const FBOX = {}, FEXT = {};
    function furnBoxes(id){ if(!FBOX[id]){ FCAP = []; try{ drawFurnV(id, 0, 0, 0, 0, 0); } finally { FBOX[id] = FCAP; FCAP = null; } } return FBOX[id]; }
    function furnExt(id){ if(FEXT[id]) return FEXT[id]; const a = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9];
      for(const q of furnBoxes(id)){ a[0] = Math.min(a[0], q[0]/16 - .5); a[1] = Math.min(a[1], q[1]/16); a[2] = Math.min(a[2], q[2]/16 - .5); a[3] = Math.max(a[3], q[3]/16 - .5); a[4] = Math.max(a[4], q[4]/16); a[5] = Math.max(a[5], q[5]/16 - .5); }
      return FEXT[id] = a; }
    // 一件家具佔哪幾格、多高、整個外框（世界座標）
    function furnCells(f){ const e = furnExt(f.id), M = RY(f.r || 0); let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
      for(const [lx, lz] of [[e[0], e[2]], [e[3], e[2]], [e[0], e[5]], [e[3], e[5]]]){ const q = mulPt(M, [lx, 0, lz]); x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); z0 = Math.min(z0, q[2]); z1 = Math.max(z1, q[2]); }
      const cells = []; for(let cx = Math.floor(f.x + .5 + x0 + .1); cx <= Math.floor(f.x + .5 + x1 - .1); cx++) for(let cz = Math.floor(f.z + .5 + z0 + .1); cz <= Math.floor(f.z + .5 + z1 - .1); cz++) cells.push([cx, cz]);
      return { cells, h:Math.max(1, Math.ceil(e[4] - .05)), box:[f.x + .5 + x0, f.y + e[1], f.z + .5 + z0, f.x + .5 + x1, f.y + Math.max(e[4], .3), f.z + .5 + z1] }; }
    function furnSolidRebuild(){ FSOL = new Set(); for(const f of FSAVE.placed){ if(F_WALK.has(f.id)) continue; const c = furnCells(f); for(const [x, z] of c.cells) for(let y = f.y; y < f.y + c.h; y++) FSOL.add(`${x},${y},${z}`); } }
    function furnInit(){ if(CREATIVE){ FSAVE.inv = {}; FURN.forEach(([id]) => FSAVE.inv[id] = 99); } else if(!FSAVE.inv){ FSAVE.inv = {}; FURN.forEach(([id]) => FSAVE.inv[id] = 1); } FSAVE.placed = FSAVE.placed.filter(f => FURN.some(q => q[0] === f.id)); furnSolidRebuild(); }
    // 家具小圖示：用小方塊在 2D 畫一個斜斜的立體圖（遠的先畫）
    const shadeHex = (h, k) => { const n = parseInt(h.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.round(v*k)); return `rgb(${c.join(",")})`; };
    function furnIcon(id){ const bx = furnBoxes(id).slice(), c = document.createElement("canvas"), S2 = 96; c.width = c.height = S2; const g = c.getContext("2d");
      const P = (x, y, z) => [(x - z)*.866, (x + z)*.5 - y]; let mnx = 1e9, mny = 1e9, mxx = -1e9, mxy = -1e9;
      for(const q of bx) for(const x of [q[0], q[3]]) for(const y of [q[1], q[4]]) for(const z of [q[2], q[5]]){ const [a, b] = P(x, y, z); mnx = Math.min(mnx, a); mxx = Math.max(mxx, a); mny = Math.min(mny, b); mxy = Math.max(mxy, b); }
      const sc = (S2 - 10)/Math.max(mxx - mnx, mxy - mny), ox = (S2 - (mxx - mnx)*sc)/2 - mnx*sc, oy = (S2 - (mxy - mny)*sc)/2 - mny*sc;
      const poly = (pts, col) => { g.beginPath(); pts.forEach(([x, y, z], k) => { const [a, b] = P(x, y, z); k ? g.lineTo(a*sc + ox, b*sc + oy) : g.moveTo(a*sc + ox, b*sc + oy); }); g.closePath(); g.fillStyle = col; g.fill(); g.strokeStyle = col; g.lineWidth = .6; g.stroke(); };
      bx.sort((a, b) => (a[0] + a[3] + a[2] + a[5] + (a[1] + a[4])*.9) - (b[0] + b[3] + b[2] + b[5] + (b[1] + b[4])*.9));
      for(const [x0, y0, z0, x1, y1, z1, col] of bx){
        poly([[x1,y0,z0],[x1,y1,z0],[x1,y1,z1],[x1,y0,z1]], shadeHex(col, .84)); poly([[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]], shadeHex(col, .72));
        poly([[x0,y1,z0],[x1,y1,z0],[x1,y1,z1],[x0,y1,z1]], shadeHex(col, 1.02)); }
      return c.toDataURL(); }
    const FACES = [ // 法線、四個角、哪一面材質(0上1側2下)、亮度
      { n:[0,1,0], c:[[0,1,1],[1,1,1],[1,1,0],[0,1,0]], t:0, l:1 }, { n:[0,-1,0], c:[[0,0,0],[1,0,0],[1,0,1],[0,0,1]], t:2, l:.55 },
      { n:[1,0,0], c:[[1,0,1],[1,0,0],[1,1,0],[1,1,1]], t:1, l:.8 }, { n:[-1,0,0], c:[[0,0,0],[0,0,1],[0,1,1],[0,1,0]], t:1, l:.8 },
      { n:[0,0,1], c:[[0,0,1],[1,0,1],[1,1,1],[0,1,1]], t:1, l:.9 }, { n:[0,0,-1], c:[[1,0,0],[0,0,0],[0,1,0],[1,1,0]], t:1, l:.7 },
    ];
    let chunks = [], puffs = [], trees = [], puffOK = true;   // 樹葉、櫻花畫成圓圓蓬蓬的一團（太多的時候改回方塊，免得手機卡）
    // ---------- 有形狀的方塊：屋瓦會變成斜斜的屋頂、貓抓柱是圓柱、紙窗是薄薄的一片 ----------
    const isRoof = (x,y,z) => world.get(x,y,z) === B.ROOF;
    const fullAt = (x,y,z) => { const b = world.get(x,y,z); return b && !BT[b].clear && !shaped(x,y,z); };
    // 屋瓦的樣子：上面蓋著東西→一般方塊；旁邊上一層還有屋瓦→往那邊斜上去；只有斜對角有→屋角；都沒有→屋脊或尖尖的屋頂
    function roofShape(x, y, z){
      const up = world.get(x, y+1, z); if(up && !BT[up].clear) return null;
      const D4 = [[1,0],[-1,0],[0,1],[0,-1]], U = D4.filter(([dx,dz]) => isRoof(x+dx, y+1, z+dz));
      if(U.length === 1) return { k:"slope", d:U[0] };
      if(U.length >= 2) return null;
      const DG = [[1,1],[1,-1],[-1,1],[-1,-1]].filter(([dx,dz]) => isRoof(x+dx, y+1, z+dz));
      if(DG.length === 1) return { k:"corner", d:DG[0] };
      if(DG.length > 1) return null;
      const sx = isRoof(x+1,y,z) || isRoof(x-1,y,z), sz = isRoof(x,y,z+1) || isRoof(x,y,z-1);
      if(sx && !sz) return { k:"ridge", ax:"x" }; if(sz && !sx) return { k:"ridge", ax:"z" };
      return { k:"peak" };
    }
    function shaped(x, y, z){ const b = world.get(x,y,z); if(b === B.LOG || b === B.LEAF || b === B.SAKURA) return true; if(b === B.ROOF) return !!roofShape(x,y,z); return false; }
    // 畫一個三角形／四邊形（自己算法線和亮度）
    function tri3(Pp, Nn, UVv, SHh, Ii, a, b, c, ua, ub, uc){
      const n = nrm(cross(sub(b, a), sub(c, a))), base = Pp.length/3, l = Math.max(.5, Math.min(1, .72 + .3*n[1] + .08*n[2] - .04*Math.abs(n[0])));
      for(const q of [a, b, c]){ Pp.push(...q); Nn.push(...n); SHh.push(l); } UVv.push(...ua, ...ub, ...uc); Ii.push(base, base+1, base+2);
    }
    function emitRoof(x, y, z, rs, bt, Pp, Nn, UVv, SHh, Ii){
      const [u0,v0,u1,v1] = tileUV(bt.t[0]), [s0,t0,s1,t1] = tileUV(bt.t[1]), L = .06;
      const T3 = (a, b, c) => tri3(Pp, Nn, UVv, SHh, Ii, a, b, c, [u0 + (u1-u0)*(a[0]-x), v0 + (v1-v0)*(a[2]-z)], [u0 + (u1-u0)*(b[0]-x), v0 + (v1-v0)*(b[2]-z)], [u0 + (u1-u0)*(c[0]-x), v0 + (v1-v0)*(c[2]-z)]);
      const sideUV = (a, k) => [s0 + (s1-s0)*k, t1 - (t1-t0)*(a[1]-y)];
      const P3 = (cx, h, cz) => [x+cx, y+h, z+cz];
      let hf = null, apex = null;
      if(rs.k === "slope"){ const [dx,dz] = rs.d; hf = (cx, cz) => (dx ? (dx > 0 ? cx : 1-cx) : (dz > 0 ? cz : 1-cz)) ? 1 : L; }
      else if(rs.k === "corner"){ const [dx,dz] = rs.d, hx = dx > 0 ? 1 : 0, hz = dz > 0 ? 1 : 0; hf = (cx, cz) => cx === hx && cz === hz ? 1 : L; }
      else if(rs.k === "peak") apex = [.5, .95, .5];
      else if(rs.k === "ridge" || rs.k === "valley") hf = null;
      const C = [[0,0],[1,0],[1,1],[0,1]];
      if(hf){ const h = C.map(([cx,cz]) => hf(cx, cz)), Q = C.map(([cx,cz], i) => P3(cx, h[i], cz));
        // 上面：兩個三角形，屋角的時候沿著高的那個角對切
        const hi = h.indexOf(1), diag02 = rs.k !== "corner" || hi === 0 || hi === 2;
        if(diag02){ T3(Q[0], Q[2], Q[1]); T3(Q[0], Q[3], Q[2]); } else { T3(Q[1], Q[3], Q[2]); T3(Q[1], Q[0], Q[3]); }
        sides(C.map(([cx,cz], i) => [cx, cz, h[i]]));
      } else if(apex){ const A = P3(...apex); for(let i = 0; i < 4; i++){ const [ax,az] = C[i], [bx,bz] = C[(i+1)%4]; T3(P3(bx, L, bz), P3(ax, L, az), A); } sides(C.map(([cx,cz]) => [cx, cz, L])); }
      else { // 屋脊：沿著一個方向的三角形屋頂
        const X = rs.ax === "x", R0 = X ? [P3(0, 1, .5), P3(1, 1, .5)] : [P3(.5, 1, 0), P3(.5, 1, 1)];
        if(X){ T3(P3(0, L, 0), R0[1], P3(1, L, 0)); T3(P3(0, L, 0), R0[0], R0[1]); T3(P3(1, L, 1), R0[0], P3(0, L, 1)); T3(P3(1, L, 1), R0[1], R0[0]); }
        else { T3(P3(0, L, 1), R0[1], R0[0]); T3(P3(0, L, 1), R0[0], P3(0, L, 0)); T3(P3(1, L, 0), R0[0], R0[1]); T3(P3(1, L, 0), R0[1], P3(1, L, 1)); }
        const hh = (cx, cz) => L; sides(C.map(([cx,cz]) => [cx, cz, hh(cx, cz)]), X ? "x" : "z");
      }
      // 底面（從下面看得到的屋簷）
      if(!fullAt(x, y-1, z)){ T3(P3(0,0,0), P3(1,0,0), P3(1,0,1)); T3(P3(0,0,0), P3(1,0,1), P3(0,0,1)); }
      function sides(hc, gable){
        for(let i = 0; i < 4; i++){ const [ax,az,ha] = hc[i], [bx,bz,hb] = hc[(i+1)%4], nx = ax === bx ? (ax ? 1 : -1) : 0, nz = az === bz ? (az ? 1 : -1) : 0;
          if(fullAt(x+nx, y, z+nz)) continue;
          const a0 = P3(ax, 0, az), b0 = P3(bx, 0, bz), a1 = P3(ax, ha, az), b1 = P3(bx, hb, bz);
          // 外側的面（逆時針朝外）
          tri3(Pp, Nn, UVv, SHh, Ii, a0, b1, b0, sideUV(a0, 0), sideUV(b1, 1), sideUV(b0, 1)); tri3(Pp, Nn, UVv, SHh, Ii, a0, a1, b1, sideUV(a0, 0), sideUV(a1, 0), sideUV(b1, 1));
          if(gable && ((gable === "x" && nx) || (gable === "z" && nz))){ const m = P3(gable === "x" ? ax : .5, 1, gable === "x" ? .5 : az); tri3(Pp, Nn, UVv, SHh, Ii, a1, m, b1, sideUV(a1, 0), sideUV(m, .5), sideUV(b1, 1)); }
        }
      }
    }
    // 貓抓柱：八角形的圓柱
    function emitPost(x, y, z, bt, Pp, Nn, UVv, SHh, Ii){
      const [s0,t0,s1,t1] = tileUV(bt.t[1]), [u0,v0,u1,v1] = tileUV(bt.t[0]), R = .42, n8 = 10, cx = x + .5, cz = z + .5;
      for(let k = 0; k < n8; k++){ const a0 = k/n8*Math.PI*2, a1 = (k+1)/n8*Math.PI*2, p0 = [cx + Math.cos(a0)*R, y, cz + Math.sin(a0)*R], p1 = [cx + Math.cos(a1)*R, y, cz + Math.sin(a1)*R];
        const q0 = [p0[0], y+1, p0[2]], q1 = [p1[0], y+1, p1[2]], ua = s0 + (s1-s0)*(k % 2 ? .5 : 0), ub = ua + (s1-s0)*.5;
        tri3(Pp, Nn, UVv, SHh, Ii, p0, q1, p1, [ua, t1], [ub, t0], [ub, t1]); tri3(Pp, Nn, UVv, SHh, Ii, p0, q0, q1, [ua, t1], [ua, t0], [ub, t0]); }
      const cap = (yy, top) => { const c = [cx, yy, cz]; for(let k = 0; k < n8; k++){ const a0 = k/n8*Math.PI*2, a1 = (k+1)/n8*Math.PI*2, p0 = [cx + Math.cos(a0)*R, yy, cz + Math.sin(a0)*R], p1 = [cx + Math.cos(a1)*R, yy, cz + Math.sin(a1)*R];
        const uv = q => [u0 + (u1-u0)*(q[0]-x), v0 + (v1-v0)*(q[2]-z)]; if(top) tri3(Pp, Nn, UVv, SHh, Ii, c, p1, p0, uv(c), uv(p1), uv(p0)); else tri3(Pp, Nn, UVv, SHh, Ii, c, p0, p1, uv(c), uv(p0), uv(p1)); } };
      if(world.get(x, y+1, z) !== B.LOG) cap(y+1, true); if(world.get(x, y-1, z) !== B.LOG && !fullAt(x, y-1, z)) cap(y, false);
    }
    // 紙窗：薄薄的一片，會跟著旁邊的牆轉方向
    function emitPane(x, y, z, bt, Pp, Nn, UVv, SHh, Ii){
      const [u0,v0,u1,v1] = tileUV(bt.t[1]), wall = (a, c) => { const b = world.get(a, y, c); return b && (b === B.GLASS || !BT[b].clear); };
      const alongX = wall(x-1, z) || wall(x+1, z) || !(wall(x, z-1) || wall(x, z+1)), T0 = .44, T1 = .56;
      const bx = alongX ? [0, 1] : [T0, T1], bz = alongX ? [T0, T1] : [0, 1];
      for(const f of FACES){ const big = alongX ? f.n[2] !== 0 : f.n[0] !== 0;
        if(!big){ const nb = world.get(x+f.n[0], y+f.n[1], z+f.n[2]); if(nb && (nb === B.GLASS || !BT[nb].clear)) continue; }
        const q = f.c.map(c => [x + bx[c[0]], y + c[1], z + bz[c[2]]]), uvs = [[u0,v1],[u1,v1],[u1,v0],[u0,v0]];
        tri3(Pp, Nn, UVv, SHh, Ii, q[0], q[1], q[2], uvs[0], uvs[1], uvs[2]); tri3(Pp, Nn, UVv, SHh, Ii, q[0], q[2], q[3], uvs[0], uvs[2], uvs[3]); }
    }
    const AO_L = [.6, .74, .87, 1], occ = (x, y, z) => { const q = world.get(x, y, z); return q && !BT[q].clear && !shaped(x, y, z) ? 1 : 0; };
    const vnoise = (() => { const h = (i, j) => { let n = Math.imul(i, 374761393) ^ Math.imul(j, 668265263); n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0)/4294967295; };
      return (x, z) => { x /= 6; z /= 6; const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j, sx = fx*fx*(3 - 2*fx), sz = fz*fz*(3 - 2*fz);
        return (h(i, j)*(1 - sx) + h(i + 1, j)*sx)*(1 - sz) + (h(i, j + 1)*(1 - sx) + h(i + 1, j + 1)*sx)*sz; }; })();
    function buildWorld(){
      chunks.forEach(c => c.forEach(m => [m.p,m.n,m.uv,m.sh,m.i].forEach(b => gl.deleteBuffer(b)))); chunks = []; puffs = [];
      { let n = 0; for(let i = 0; i < world.v.length; i++) if(world.v[i] === B.LEAF || world.v[i] === B.SAKURA) n++; puffOK = n <= 600; }
      FOL = { P:[], N:[], UV:[], SH:[], I:[], out:[] }; sakList = [];
      for(const pass of [0, 1]){
        let P = [], N = [], UV = [], SH = [], I = []; const out = [];
        const flush = () => { if(I.length) out.push(mesh(P, N, UV, SH, I)); P = []; N = []; UV = []; SH = []; I = []; };
        for(let y = 0; y < H; y++) for(let z = 0; z < D; z++) for(let x = 0; x < W; x++){
          const b = world.get(x,y,z); if(!b) continue; const bt = BT[b]; if(!!bt.clear !== !!pass) continue;
          const em = { P, N, UV, SH, I, push(){} };
          if(b === B.ROOF){ const rs = roofShape(x, y, z); if(rs){ emitRoof(x, y, z, rs, bt, P, N, UV, SH, I); if(P.length/3 > 60000) flush(); continue; } }
          if(b === B.LOG){ emitPost(x, y, z, bt, P, N, UV, SH, I); if(P.length/3 > 60000) flush(); continue; }
          if(b === B.SAKURA){ sakList.push([x, y, z]); continue; }
          if(b === B.LEAF){ emitFoliage(x, y, z, b); continue; }
          if(b === B.GLASS){ emitPane(x, y, z, bt, P, N, UV, SH, I); if(P.length/3 > 60000) flush(); continue; }
          void em;
          for(const f of FACES){
            const nb = world.get(x+f.n[0], y+f.n[1], z+f.n[2]);
            if(nb && (!BT[nb].clear || nb === b) && !shaped(x+f.n[0], y+f.n[1], z+f.n[2])) continue;
            if(b === B.WATER && f.n[1] !== 1 && nb) continue;
            const [u0,v0,u1,v1] = tileUV(bt.t[f.t]), base = P.length/3, yo = b === B.WATER && f.n[1] === 1 ? -.12 : 0;
            // 角落陰影（兩個方塊相接的角落暗一點，看起來比較立體）＋地面一大片一大片的深淺（不會一整片平平的）
            const na = f.n[0] ? 0 : f.n[1] ? 1 : 2, a1 = na === 0 ? 1 : 0, a2 = na === 2 ? 1 : 2, ao = [];
            f.c.forEach((c, k) => { let mul = 1;
              if(!pass){ const o = [x + f.n[0], y + f.n[1], z + f.n[2]], s1 = c[a1] ? 1 : -1, s2 = c[a2] ? 1 : -1;
                const p1 = o.slice(), p2 = o.slice(), p3 = o.slice(); p1[a1] += s1; p2[a2] += s2; p3[a1] += s1; p3[a2] += s2;
                const o1 = occ(...p1), o2 = occ(...p2), o3 = occ(...p3), lv = o1 && o2 ? 0 : 3 - o1 - o2 - o3; ao.push(lv); mul = AO_L[lv];
                if(f.n[1] === 1 && (b === B.GRASS || b === B.CLOUD)) mul *= .93 + .1*vnoise(x + c[0], z + c[2]); }
              P.push(x+c[0], y+c[1]+(c[1] ? yo : 0), z+c[2]); N.push(...f.n); SH.push(f.l * mul * (y < 2 && f.n[1] === 0 ? .9 : 1)); });
            UV.push(u0,v1, u1,v1, u1,v0, u0,v0);
            if(ao.length && ao[0] + ao[2] < ao[1] + ao[3]) I.push(base+1, base+2, base+3, base+1, base+3, base);   // 換對角線，陰影才不會歪
            else I.push(base, base+1, base+2, base, base+2, base+3);
            if(P.length/3 > 60000) flush();
          }
        }
        flush(); chunks.push(out);
      }
      emitSakura();
      if(FOL.I.length) FOL.out.push(mesh(FOL.P, FOL.N, FOL.UV, FOL.SH, FOL.I)); chunks.push(FOL.out);
      groupTrees();
    }
    // 樹葉、櫻花：每一格放幾片「一叢葉子／一叢小花」的透明貼圖，方向亂亂的，疊起來就是蓬蓬的樹冠（不是方塊）
    let FOL = null, sakList = [];
    // ---------- 真的櫻花樹：連在一起的櫻花方塊算一棵樹，長出彎彎的樹枝，枝頭開一叢一叢的花（樹冠不是方塊，會透光） ----------
    function emitSakura(){ const SS = SAK_STYLES[window.__sak != null ? window.__sak : SAK_PICK] || SAK_STYLES[0], [TA, TB] = SS[1], shape = SS[3]; const F = FOL, key = (x,y,z) => x + "," + y + "," + z, at = new Set(sakList.map(p => key(...p))), seen = new Set();
      const quad = (pts, uv, l) => { const base = F.P.length/3, nv = nrm(cross(sub(pts[1], pts[0]), sub(pts[2], pts[0]))); for(const p of pts){ F.P.push(...p); F.N.push(...nv); F.SH.push(l); } F.UV.push(...uv); F.I.push(base, base+1, base+2, base, base+2, base+3); };
      const [b0,b1,b2,b3] = tileUV(5);   // 樹皮
      const branch = (pts, r0, r1) => { const n = 6; for(let i = 0; i < pts.length - 1; i++){ const A = pts[i], Bp = pts[i+1], d = nrm(sub(Bp, A)), u = nrm(cross(Math.abs(d[1]) < .9 ? [0,1,0] : [1,0,0], d)), v = cross(d, u), ra = r0 + (r1 - r0)*i/(pts.length - 1), rb = r0 + (r1 - r0)*(i+1)/(pts.length - 1);
          for(let k = 0; k < n; k++){ const a0 = k/n*Math.PI*2, a1 = (k+1)/n*Math.PI*2, o = (a, rr) => [Math.cos(a)*u[0]*rr + Math.sin(a)*v[0]*rr, Math.cos(a)*u[1]*rr + Math.sin(a)*v[1]*rr, Math.cos(a)*u[2]*rr + Math.sin(a)*v[2]*rr];
            const p00 = A.map((c, j) => c + o(a0, ra)[j]), p01 = A.map((c, j) => c + o(a1, ra)[j]), p10 = Bp.map((c, j) => c + o(a0, rb)[j]), p11 = Bp.map((c, j) => c + o(a1, rb)[j]);
            quad([p00, p01, p11, p10], [b0,b3, b2,b3, b2,b1, b0,b1], .8); } } };
      const clump = (c, rad, n, q, bright) => { for(let k = 0; k < n; k++){ const [u0,v0,u1,v1] = tileUV(q() < .5 ? TA : TB), off = [ (q() - .5)*2*rad, (q() - .35)*1.4*rad, (q() - .5)*2*rad ], cc = c.map((v, j) => v + off[j]);
          const nv = nrm([q()*2 - 1, q()*1.2 - .2, q()*2 - 1]), ex = nrm(cross(Math.abs(nv[1]) < .9 ? [0,1,0] : [1,0,0], nv)), ey = cross(nv, ex), sz = .4 + q()*.26;
          quad([[-1,-1],[1,-1],[1,1],[-1,1]].map(([a, b]) => cc.map((v, j) => v + (ex[j]*a + ey[j]*b)*sz)), [u0,v1, u1,v1, u1,v0, u0,v0], Math.min(1.08, bright + off[1]*.12)); } };
      for(const s0 of sakList){ const k0 = key(...s0); if(seen.has(k0)) continue; const comp = [], st = [s0]; seen.add(k0);
        while(st.length){ const p = st.pop(); comp.push(p); for(const [dx,dy,dz] of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]){ const nk = key(p[0]+dx, p[1]+dy, p[2]+dz); if(at.has(nk) && !seen.has(nk)){ seen.add(nk); st.push([p[0]+dx, p[1]+dy, p[2]+dz]); } } }
        const xs = comp.map(p => p[0]), ys = comp.map(p => p[1]), zs = comp.map(p => p[2]), mn = a => Math.min(...a), mx = a => Math.max(...a);
        const w = mx(xs) - mn(xs) + 1, h = mx(ys) - mn(ys) + 1, d = mx(zs) - mn(zs) + 1, cx = (mn(xs) + mx(xs) + 1)/2, cz = (mn(zs) + mx(zs) + 1)/2, bot = mn(ys);
        if(comp.length < 3 || comp.length > 200 || w > 11 || d > 11){ comp.forEach(p => emitFolClean(p[0], p[1], p[2], B.SAKURA)); continue; }
        const q = rng(((Math.floor(cx)*73856093) ^ (bot*19349663) ^ (Math.floor(cz)*83492791)) >>> 0), Rx = w/2 + .5, Rz = d/2 + .5, top = bot + h;
        const T0 = [cx, bot + .2, cz]; const nb = 5 + Math.floor(q()*2);
        for(let i = 0; i < nb; i++){ const a = i/nb*Math.PI*2 + q()*.6, ca = Math.cos(a), sa = Math.sin(a), rr = .65 + q()*.25;
          const M = [cx + ca*Rx*.35, bot + h*.25 + q()*.3, cz + sa*Rz*.35], E = [cx + ca*Rx*rr, bot + h*(.45 + q()*.35), cz + sa*Rz*rr];
          branch([T0, M, E], .13, .05);
          clump(E, .75, 22, q, .98); clump(M.map((v, j) => (v + E[j])/2 + (j === 1 ? .35 : 0)), .6, 14, q, .92);
          for(let j = 0; j < 2; j++){ const a2 = a + (j ? .6 : -.6) + (q() - .5)*.3, E2 = [E[0] + Math.cos(a2)*(.6 + q()*.5), E[1] + .3 + q()*.6, E[2] + Math.sin(a2)*(.6 + q()*.5)];
            branch([E, E2], .05, .025); clump(E2, .7, 18, q, 1.02); } }
        const Cy = bot + h*.6, Ry = h*.5 + .3;
        const swatch = (() => { const k2 = Math.max(0, FOL_INNER.indexOf(SS[2])), s0 = 1/atlas.COLS, bu = (127 % atlas.COLS)*s0, bv = Math.floor(127 / atlas.COLS)*s0, cu = bu + ((k2 % 8)*8 + 4)/(atlas.N*atlas.COLS), cv2 = bv + (Math.floor(k2 / 8)*8 + 4)/(atlas.N*atlas.COLS); return [cu,cv2, cu,cv2, cu,cv2, cu,cv2]; })();
        const tUV = t => { const [u0,v0,u1,v1] = tileUV(t); return [u0,v1, u1,v1, u1,v0, u0,v0]; }, UA = tUV(TA), UB = tUV(TB);
        // 一團花：裡面實心一層、外面花貼圖一層，再散一些花叢（面數很少，不會卡）
        const ell = (C, sx, sy, sz, uvF, l, sg = 10) => { for(let i = 0; i < sg; i++) for(let j = 0; j < sg/2; j++){ const P4 = [[i, j], [i+1, j], [i+1, j+1], [i, j+1]].map(([a, b]) => { const th = a/sg*Math.PI*2, ph = -Math.PI/2 + b/(sg/2)*Math.PI*.85; return [C[0] + Math.cos(th)*Math.cos(ph)*sx, C[1] + Math.sin(ph)*sy, C[2] + Math.sin(th)*Math.cos(ph)*sz]; });
          quad(P4, uvF(i, j), l*(.9 + .12*(j/(sg/2)))); } };
        const clumpT = (c, rad, n, bright) => { for(let k = 0; k < n; k++){ const uv = q() < .5 ? UA : UB, off = [(q() - .5)*2*rad, (q() - .35)*1.4*rad, (q() - .5)*2*rad], cc = c.map((v, j) => v + off[j]);
          const nv = nrm([q()*2 - 1, q()*1.2 - .2, q()*2 - 1]), ex = nrm(cross(Math.abs(nv[1]) < .9 ? [0,1,0] : [1,0,0], nv)), ey = cross(nv, ex), sz = .4 + q()*.26;
          quad([[-1,-1],[1,-1],[1,1],[-1,1]].map(([a, b]) => cc.map((v, j) => v + (ex[j]*a + ey[j]*b)*sz)), uv, Math.min(1.08, bright + off[1]*.12)); } };
        const lobe = (C, sx, sy, sz, n) => { ell(C, sx*.5, sy*.5, sz*.5, () => swatch, .8); ell(C, sx*.7, sy*.68, sz*.7, (i, j) => (i + j) % 2 ? UB : UA, .86, 10); ell(C, sx*.86, sy*.84, sz*.86, (i, j) => (i + j) % 2 ? UA : UB, 1, 12);
          for(let i = 0; i < n; i++){ const a = q()*Math.PI*2, e = q()*1.6 - .55, rr = .7 + q()*.32, ce = Math.cos(e); clumpT([C[0] + Math.cos(a)*ce*sx*rr, C[1] + Math.sin(e)*sy*rr, C[2] + Math.sin(a)*ce*sz*rr], .6, 12, .96 + Math.sin(e)*.1); } };
        const hangs = (C, sx, sz, yb, n, L) => { const [h0,h1,h2,h3] = tileUV(86); for(let i = 0; i < n; i++){ const a = q()*Math.PI*2, rr = .35 + q()*.6, px = C[0] + Math.cos(a)*sx*rr, pz = C[2] + Math.sin(a)*sz*rr, ln = L*(.6 + q()*.6), a2 = q()*3.14, ex = [Math.cos(a2)*.45, 0, Math.sin(a2)*.45];
          quad([[px - ex[0], yb - ln, pz - ex[2]], [px + ex[0], yb - ln, pz + ex[2]], [px + ex[0], yb + .1, pz + ex[2]], [px - ex[0], yb + .1, pz - ex[2]]], [h0,h3, h2,h3, h2,h1, h0,h1], .96); } };
        const C0 = [cx, Cy, cz];
        if(shape === "round") lobe(C0, Rx, Ry, Rz, 46);
        else if(shape === "umbrella"){ const C = [cx, Cy + Ry*.25, cz]; lobe(C, Rx*1.35, Ry*.62, Rz*1.35, 52); }
        else if(shape === "dome"){ const C = [cx, Cy + Ry*.12, cz]; lobe(C, Rx*1.2, Ry*.8, Rz*1.2, 52); }   // 又圓又寬：上面圓圓蓬蓬、往兩邊撐開
        else if(shape === "oval"){ lobe([cx, Cy + Ry*.2, cz], Rx*.82, Ry*1.3, Rz*.82, 44); }
        else if(shape === "weep"){ lobe(C0, Rx*1.05, Ry*.85, Rz*1.05, 40); hangs(C0, Rx*1.05, Rz*1.05, Cy - Ry*.45, 34, Ry*1.3); }
        else if(shape === "cloud"){ lobe([cx, Cy + Ry*.25, cz], Rx*.7, Ry*.7, Rz*.7, 16); for(let i = 0; i < 4; i++){ const a = i*1.5708 + q()*.5; lobe([cx + Math.cos(a)*Rx*.55, Cy - Ry*.1 + q()*.4, cz + Math.sin(a)*Rz*.55], Rx*.55, Ry*.55, Rz*.55, 10); } }
        else if(shape === "tier"){ lobe([cx, Cy - Ry*.3, cz], Rx*1.15, Ry*.5, Rz*1.15, 26); lobe([cx, Cy + Ry*.55, cz], Rx*.75, Ry*.5, Rz*.75, 20); }
      }
    }
    const FOL_PICK = -1;   // 站長選好的樹葉款式（-1 = 還沒選，用乾淨版）；window.__fol 可以暫時換來看
    function emitFoliage(x, y, z, b){ const sel = window.__fol != null ? window.__fol : FOL_PICK; if(sel >= 0) return emitFol30(x, y, z, b, sel); return emitFolClean(x, y, z, b); }
    function emitFol30(x, y, z, b, sel){ const F = FOL, [nm, inner, mode] = FOL_STYLES[sel], [u0,v0,u1,v1] = tileUV(22 + sel), q = rng(((x*73856093) ^ (y*19349663) ^ (z*83492791)) >>> 0); void nm;
      const isF = (a, b2, c) => { const nb = world.get(a, b2, c); return nb === B.LEAF || nb === B.SAKURA; };
      const quad = (pts, uv, l) => { const base = F.P.length/3, nv = nrm(cross(sub(pts[1], pts[0]), sub(pts[2], pts[0]))); for(const p of pts){ F.P.push(...p); F.N.push(...nv); F.SH.push(l); } F.UV.push(...uv); F.I.push(base, base+1, base+2, base, base+2, base+3); };
      const UVq = [u0,v1, u1,v1, u1,v0, u0,v0];
      const card = (cc, ex, ey, sz, l) => quad([[-1,-1],[1,-1],[1,1],[-1,1]].map(([a, b2]) => [cc[0] + (ex[0]*a + ey[0]*b2)*sz, cc[1] + (ex[1]*a + ey[1]*b2)*sz, cc[2] + (ex[2]*a + ey[2]*b2)*sz]), UVq, l);
      let swUV = null; if(inner){ const k = FOL_INNER.indexOf(inner), s0 = 1/atlas.COLS, bu = (127 % atlas.COLS)*s0, bv = Math.floor(127 / atlas.COLS)*s0, cu = bu + ((k % 8)*8 + 4)/(atlas.N*atlas.COLS), cv2 = bv + (Math.floor(k / 8)*8 + 4)/(atlas.N*atlas.COLS); swUV = [cu,cv2, cu,cv2, cu,cv2, cu,cv2]; }
      const open = FACES.filter(f => !isF(x+f.n[0], y+f.n[1], z+f.n[2]));
      if(mode === "block"){   // 方塊型：外面一層有小縫的花、裡面深一點的一層、下面垂一些花串
        const [h0,h1,h2,h3] = tileUV(86);
        for(const f of open){ const [nx, ny, nz] = f.n; const nb = world.get(x+nx, y+ny, z+nz); if(nb && !BT[nb].clear && !shaped(x+nx, y+ny, z+nz)) continue;
          quad(f.c.map(c => [x + c[0], y + c[1], z + c[2]]), UVq, Math.min(1.05, f.l + .05));
          if(swUV) quad(f.c.map(c => [x + .5 + (c[0] - .5)*.8, y + .5 + (c[1] - .5)*.8, z + .5 + (c[2] - .5)*.8]), swUV, f.l*.92);
          if(ny === -1 && !world.get(x, y - 1, z)) for(let k = 0; k < 2; k++){ const a = q()*3.14, ex = [Math.cos(a), 0, Math.sin(a)], cx2 = x + .5 + (q() - .5)*.5, cz2 = z + .5 + (q() - .5)*.5, L2 = .35 + q()*.3;
            quad([[cx2 - ex[0]*.45, y - L2, cz2 - ex[2]*.45], [cx2 + ex[0]*.45, y - L2, cz2 + ex[2]*.45], [cx2 + ex[0]*.45, y + .02, cz2 + ex[2]*.45], [cx2 - ex[0]*.45, y + .02, cz2 - ex[2]*.45]], [h0,h3, h2,h3, h2,h1, h0,h1], .95); } }
      } else if(mode === "face" || mode === "hang"){
        for(const f of open){ const [nx, ny, nz] = f.n; const nb = world.get(x+nx, y+ny, z+nz); if(nb && !BT[nb].clear && !shaped(x+nx, y+ny, z+nz)) continue;
          if(swUV) quad(f.c.map(c => [x + c[0], y + c[1], z + c[2]]), swUV, Math.min(1.05, f.l + .05));   // 裡面那層貼齊方塊，格子之間不會有縫
          if(mode === "hang" && ny === 1) continue;
          const t1 = nx ? [0, 1, 0] : [1, 0, 0], t2 = cross(f.n, t1), nC = mode === "hang" ? 2 : sel >= 30 ? 3 : 5;
          // 樹冠邊邊：往外斜斜地多放一把，讓輪廓圓一點、不會方方的
          if(mode === "face") for(const tg of [t1, t2, t1.map(v => -v), t2.map(v => -v)]){ if(isF(x + tg[0], y + tg[1], z + tg[2])) continue; const dg = nrm([f.n[0] + tg[0], f.n[1] + tg[1], f.n[2] + tg[2]]), cc = [x + .5 + (f.n[0] + tg[0])*.46, y + .5 + (f.n[1] + tg[1])*.46, z + .5 + (f.n[2] + tg[2])*.46], ex = nrm(cross(dg, tg)), a2 = q()*6.28, ca = Math.cos(a2), sa = Math.sin(a2), ey0 = cross(dg, ex);
            card(cc, ex.map((v, i) => v*ca + ey0[i]*sa), ey0.map((v, i) => v*ca - ex[i]*sa), .42 + q()*.1, Math.min(1.05, f.l + .05)); }
          for(let k = 0; k < nC; k++){ const a = mode === "hang" ? 0 : q()*6.28, ca = Math.cos(a), sa = Math.sin(a), ja = (q() - .5)*.7, jb = (q() - .5)*.7, off = .5 + .03 + q()*.06;
            const ex = mode === "hang" && !ny ? nrm(cross([0,1,0], f.n)) : [t1[0]*ca + t2[0]*sa, t1[1]*ca + t2[1]*sa, t1[2]*ca + t2[2]*sa], ey = mode === "hang" && !ny ? [0, 1, 0] : cross(f.n, ex);
            const cc = [x + .5 + nx*off + t1[0]*ja + t2[0]*jb, y + .5 + ny*off + t1[1]*ja + t2[1]*jb - (mode === "hang" ? .35 : 0), z + .5 + nz*off + t1[2]*ja + t2[2]*jb];
            card(cc, ex, ey, .5 + q()*.14, Math.min(1.05, f.l + .08)); } }
      } else if(mode === "rand"){
        const n = open.length ? 5 : 2; for(let k = 0; k < n; k++){ const cc = [x + .5 + (q() - .5)*.6, y + .5 + (q() - .5)*.6, z + .5 + (q() - .5)*.6], nv = nrm([q()*2 - 1, q()*1.4 - .4, q()*2 - 1]), ex = nrm(cross(Math.abs(nv[1]) < .9 ? [0,1,0] : [1,0,0], nv)), ey = cross(nv, ex);
          card(cc, ex, ey, .62 + q()*.15, Math.min(1.05, .78 + open.length*.05)); }
      } else {   // cross：像草叢一樣交叉的直立貼圖
        for(let k = 0; k < 3; k++){ const a = k*1.047 + q()*.4, ex = [Math.cos(a), 0, Math.sin(a)]; card([x + .5 + (q() - .5)*.2, y + .5, z + .5 + (q() - .5)*.2], ex, [0, 1, 0], .62, .9 + k*.05); }
        if(!isF(x, y+1, z)) card([x + .5, y + .95, z + .5], [1, 0, 0], [0, 0, 1], .55, 1);
      }
      if(F.P.length/3 > 60000){ F.out.push(mesh(F.P, F.N, F.UV, F.SH, F.I)); F.P = []; F.N = []; F.UV = []; F.SH = []; F.I = []; }
    }
    function emitFolClean(x, y, z, b){ const F = FOL, sak = b === B.SAKURA, [u0,v0,u1,v1] = tileUV(sak ? 19 : 18), [c0,d0,c1,d1] = tileUV(sak ? 21 : 20), q = rng(((x*73856093) ^ (y*19349663) ^ (z*83492791)) >>> 0);
      const isF = (a, b2, c) => { const nb = world.get(a, b2, c); return nb === B.LEAF || nb === B.SAKURA; }, IN = .08;
      const quad = (pts, uv, l) => { const base = F.P.length/3, nv = nrm(cross(sub(pts[1], pts[0]), sub(pts[2], pts[0]))); for(const p of pts){ F.P.push(...p); F.N.push(...nv); F.SH.push(l); } F.UV.push(...uv); F.I.push(base, base+1, base+2, base, base+2, base+3); };
      for(const f of FACES){ const [nx, ny, nz] = f.n; if(isF(x+nx, y+ny, z+nz)) continue;
        const nb = world.get(x+nx, y+ny, z+nz); if(nb && !BT[nb].clear && !shaped(x+nx, y+ny, z+nz)) continue;
        // 裡面：一層乾淨的綠（往內縮一點點）
        quad(f.c.map(c => [x + .5 + (c[0] - .5)*(1 - IN*2), y + .5 + (c[1] - .5)*(1 - IN*2), z + .5 + (c[2] - .5)*(1 - IN*2)]), [c0,d1, c1,d1, c1,d0, c0,d0], f.l*.95);
        // 外面：兩小把葉子（或櫻花）貼在這一面，稍微往外、轉一點點角度
        const t1 = nx ? [0, 1, 0] : [1, 0, 0], t2 = cross(f.n, t1);
        for(let k = 0; k < 3; k++){ const a = q()*6.28, ca = Math.cos(a), sa = Math.sin(a), sz = .52 + q()*.16, off = .5 + .02 + q()*.08, tl = (q() - .5)*.5;
          const ex = [t1[0]*ca + t2[0]*sa, t1[1]*ca + t2[1]*sa, t1[2]*ca + t2[2]*sa], ey = cross(f.n, ex).map((v, i) => v + f.n[i]*tl);
          const ja = (q() - .5)*.75, jb = (q() - .5)*.75, cc = [x + .5 + nx*off + t1[0]*ja + t2[0]*jb, y + .5 + ny*off + t1[1]*ja + t2[1]*jb, z + .5 + nz*off + t1[2]*ja + t2[2]*jb];
          const pt = (u, v) => [cc[0] + (ex[0]*u + ey[0]*v)*sz, cc[1] + (ex[1]*u + ey[1]*v)*sz, cc[2] + (ex[2]*u + ey[2]*v)*sz];
          quad([pt(-1,-1), pt(1,-1), pt(1,1), pt(-1,1)], [u0,v1, u1,v1, u1,v0, u0,v0], Math.min(1.05, f.l + .08)); }
      }
      if(F.P.length/3 > 60000){ F.out.push(mesh(F.P, F.N, F.UV, F.SH, F.I)); F.P = []; F.N = []; F.UV = []; F.SH = []; F.I = []; }
    }
    // 連在一起的樹葉算一棵樹（60 格以內），整棵畫成一個可愛的造型（140 格以內）；太大或形狀很怪的照舊一格一顆毛球
    function groupTrees(){ trees = []; const seen = new Set(), key = (x,y,z) => x + ',' + y + ',' + z, rest = [];
      for(const pf of puffs){ const [x0, y0, z0, b] = pf, k0 = key(x0, y0, z0); if(seen.has(k0)) continue; const comp = [], st = [pf]; seen.add(k0);
        const at = new Map(puffs.map(q => [key(q[0], q[1], q[2]), q]));
        while(st.length){ const q = st.pop(); comp.push(q); for(const [dx, dy, dz] of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]){ const kk = key(q[0]+dx, q[1]+dy, q[2]+dz), n = at.get(kk); if(n && n[3] === b && !seen.has(kk)){ seen.add(kk); st.push(n); } } }
        const xs = comp.map(q => q[0]), ys = comp.map(q => q[1]), zs = comp.map(q => q[2]), mn = a => Math.min(...a), mx = a => Math.max(...a);
        const w = mx(xs) - mn(xs) + 1, h = mx(ys) - mn(ys) + 1, d = mx(zs) - mn(zs) + 1;
        if(comp.length >= 4 && comp.length <= 140 && w <= 9 && d <= 9 && h <= 7) trees.push({ b, cx: (mn(xs) + mx(xs) + 1)/2, cy: (mn(ys) + mx(ys) + 1)/2, cz: (mn(zs) + mx(zs) + 1)/2, w, h, d, bot: mn(ys), seed: (x0*31 + z0*17) >>> 0, blocks: comp });
        else rest.push(...comp); }
      puffs = rest; }
    buildWorld();
    // 小方塊（貓、花）
    const cube = (() => { const P = [], N = [], UV = [], SH = [], I = []; FACES.forEach(f => { const b = P.length/3; f.c.forEach(c => { P.push(c[0]-.5, c[1]-.5, c[2]-.5); N.push(...f.n); UV.push(0,0); SH.push(1); }); I.push(b,b+1,b+2,b,b+2,b+3); }); return mesh(P, N, UV, SH, I); })();

    // 圓球（給圓滑的頭髮用，例如雙馬尾）
    const ball = (() => { const P = [], N = [], UV = [], SH = [], I = [], sg = 14;
      for(let y = 0; y <= sg; y++){ const th = y/sg*Math.PI; for(let x = 0; x <= sg; x++){ const ph = x/sg*Math.PI*2, n = [Math.sin(th)*Math.cos(ph), Math.cos(th), Math.sin(th)*Math.sin(ph)]; P.push(n[0]*.5, n[1]*.5, n[2]*.5); N.push(...n); UV.push(0,0); SH.push(1); } }
      for(let y = 0; y < sg; y++) for(let x = 0; x < sg; x++){ const a = y*(sg+1)+x, b = a + sg + 1; I.push(a, b, a+1, b, b+1, a+1); }
      return mesh(P, N, UV, SH, I); })();
    // 圓柱（側面，給管子用）
    const cyl = (() => { const P = [], N = [], UV = [], SH = [], I = [], sg = 14;
      for(let y = 0; y <= 1; y++) for(let x = 0; x <= sg; x++){ const a = x/sg*Math.PI*2; P.push(Math.cos(a)*.5, y - .5, Math.sin(a)*.5); N.push(Math.cos(a), 0, Math.sin(a)); UV.push(0,0); SH.push(1); }
      for(let x = 0; x < sg; x++){ const a = x, b = x + sg + 1; I.push(a, b, a+1, b, b+1, a+1); }
      return mesh(P, N, UV, SH, I); })();
    const tubeMesh = { p:gl.createBuffer(), n:gl.createBuffer(), uv:gl.createBuffer(), sh:gl.createBuffer(), i:gl.createBuffer(), c:0, cap:0 };   // 動態的管子
    // 沿著一串點畫一條圓滑的管子（Catmull-Rom 曲線，圓柱接圓球），rad(0~1) 決定每一段的粗細
    const crs = (p0, p1, p2, p3, t) => p1.map((_, j) => .5*((2*p1[j]) + (-p0[j]+p2[j])*t + (2*p0[j]-5*p1[j]+4*p2[j]-p3[j])*t*t + (-p0[j]+3*p1[j]-3*p2[j]+p3[j])*t*t*t));
    function smooth(pts, sub){ const n = pts.length, out = []; for(let i = 0; i < n-1; i++){ const p0 = pts[Math.max(0,i-1)], p1 = pts[i], p2 = pts[i+1], p3 = pts[Math.min(n-1,i+2)]; for(let k = 0; k < sub; k++) out.push(crs(p0,p1,p2,p3,k/sub)); } out.push(pts[n-1].slice()); return out; }
    function tube(pts, rad, col, already){
      const out = already ? pts : smooth(pts, 8);
      gl.uniform1f(U("mode"), 2);
      const R = out.map((_, k) => rad(k/(out.length-1)));
      bind(ball); out.forEach((q, k) => { if(R[k] > .004 && k === 0) box(chain(T(q[0],q[1],q[2]), S(R[k]*1.96,R[k]*1.96,R[k]*1.96)), col); });
      // 一整條連續的管子（每一圈的頂點都接起來，法線平滑，塑膠感不會有一節一節的紋路）
      const SG = 12, P = [], N = [], I = []; let fx = null;
      for(let k = 0; k < out.length; k++){ const a = out[Math.max(0, k-1)], b = out[Math.min(out.length-1, k+1)], y = nrm(sub(b, a));
        if(!fx) fx = nrm(cross(Math.abs(y[1]) < .95 ? [0,1,0] : [1,0,0], y)); else { const d = fx[0]*y[0]+fx[1]*y[1]+fx[2]*y[2]; fx = nrm([fx[0]-y[0]*d, fx[1]-y[1]*d, fx[2]-y[2]*d]); }
        const z = cross(fx, y), r = R[k], q = out[k];
        for(let m = 0; m <= SG; m++){ const an = m/SG*Math.PI*2, c = Math.cos(an), sn = Math.sin(an), n = [fx[0]*c+z[0]*sn, fx[1]*c+z[1]*sn, fx[2]*c+z[2]*sn];
          P.push(q[0]+n[0]*r, q[1]+n[1]*r, q[2]+n[2]*r); N.push(...n); } }
      for(let k = 0; k < out.length-1; k++) for(let m = 0; m < SG; m++){ const a = k*(SG+1)+m, b = a + SG + 1; I.push(a, b, a+1, b, b+1, a+1); }
      const dm = tubeMesh; gl.bindBuffer(gl.ARRAY_BUFFER, dm.p); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(P), gl.DYNAMIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, dm.n); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(N), gl.DYNAMIC_DRAW);
      const cnt = P.length/3; if(cnt > dm.cap){ dm.cap = cnt; gl.bindBuffer(gl.ARRAY_BUFFER, dm.uv); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(cnt*2), gl.DYNAMIC_DRAW); gl.bindBuffer(gl.ARRAY_BUFFER, dm.sh); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(cnt).fill(1), gl.DYNAMIC_DRAW); }
      dm.c = I.length; bind(dm); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(I), gl.DYNAMIC_DRAW);
      box([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1], col);
      bind(cube); gl.uniform1f(U("mode"), 1);
    }

    // 一束頭髮：沿著中心線分成好幾撮細髮絲，越往髮尾越散開、尖尖的，顏色深淺不一，再加一條亮面
    const shade = (h, k) => "#" + [1,3,5].map(i => Math.max(0, Math.min(255, Math.round(parseInt(h.substr(i,2),16)*k))).toString(16).padStart(2,"0")).join("");
    const tint = (h, k) => "#" + [1,3,5].map(i => { const v = parseInt(h.substr(i,2),16); return Math.round(v + (255 - v)*k).toString(16).padStart(2,"0"); }).join("");
    function hairBundle(pts, col, sx, thick){
      const c = smooth(pts, 3), n = c.length;
      // 每一點的「側邊」和「後面」方向，用來把髮絲排開
      const fr = c.map((q, k) => { const a = c[Math.max(0,k-1)], b = c[Math.min(n-1,k+1)], tg = nrm(sub(b, a)); const side = nrm(cross(tg, [0,0,1].map((v,j)=> j===2 ? 1 : 0))); const back = nrm(cross(side, tg)); return { side, back }; });
      const LOCKS = [ [0,0,1.55,.97,shade(col,.9)], [0,0,1,1,shade(col,.92)], [-.9,.25,.82,.93,col], [.9,.2,.85,.9,col], [-.35,-.75,.72,.84,shade(col,.8)], [.45,-.7,.75,.88,shade(col,.84)], [0,.85,.7,.8,tint(col,.14)] ];
      LOCKS.forEach(([a, b, rk, lk, cc]) => {
        const m = Math.max(3, Math.round(n*lk)), lp = [];
        for(let k = 0; k < m; k++){ const u = k/(n-1), spread = (.18 + u*.55)*thick, q = c[k], f = fr[k], wav = Math.sin(u*7 + a*2)*.012*u;
          lp.push([q[0] + (f.side[0]*a + f.back[0]*b)*spread + f.side[0]*wav, q[1] + (f.side[1]*a + f.back[1]*b)*spread, q[2] + (f.side[2]*a + f.back[2]*b)*spread + f.side[2]*wav]); }
        tube(lp, u => { const w = (u < .12 ? .55 + u*3.7 : 1) * thick * rk; return Math.max(.004, w * (u > .55 ? 1 - (u - .55)*2.1 : 1)); }, cc, true);
      });
      // 亮面：靠外側一條細細亮亮的髮光
      const hl = []; for(let k = 1; k < Math.round(n*.5); k++){ const q = c[k], f = fr[k], u = k/(n-1), spread = (.18 + u*.55)*thick; hl.push([q[0] + (f.back[0]*1.05 + f.side[0]*.2)*spread, q[1] + (f.back[1]*1.05)*spread, q[2] + (f.back[2]*1.05 + f.side[2]*.2)*spread]); }
      if(hl.length > 2) tube(hl, u => thick*.32*(1 - Math.abs(u - .5)*1.6), tint(col,.42), true);
      void sx;
    }

    // ---------- 角色 ----------
    const player = { x:world.spawn[0], y:world.spawn[1], z:world.spawn[2], vy:0, yaw:Math.PI, walk:0, onG:false, av:avOf(o.avatar), s:1 };
    const npc = o.npcs || [];
    // 音效一律限速：同一種聲音 .35 秒內只響一次（不會疊在一起變成雜音）
    if(o.sfx){ const raw = o.sfx, lastS = {}; o = Object.assign({}, o, { sfx: new Proxy(raw, { get(tg, k){ const f = tg[k]; if(typeof f !== "function") return f; return (...a) => { const n = performance.now(); if(n - (lastS[k] || 0) < 350) return; lastS[k] = n; return f.apply(tg, a); }; } }) }); }
    // 小貓村民：每隻在島上有自己的家（繞著貓屋一圈），白天在家附近閒晃，晚上回家睡覺
    const pets = npc.map((c, i) => { const a = i/npc.length*Math.PI*2 + .4, r = 8 + (i % 2)*2.2;
      if(c.fam){ const fa = Math.PI + (i % 2 ? .9 : -.9), fx = world.spawn[0] + Math.sin(fa)*1.6, fz = world.spawn[2] + Math.cos(fa)*1.6;   // 我們家的貓：一開始就在你身邊
        return { i, x:fx, y:world.spawn[1] + .2, z:fz, vy:0, yaw:Math.PI, walk:0, onG:false, col:CAT[catKey(c.color)], s:.55 + (c.scale||.6)*.45, tx:null, tz:null, wait:.5, love:0, home:[fx, world.spawn[1], fz], v:c, sleep:0, fam:true, fs:{ mode:"follow", t:0 } }; }
      let hx = world.house.x + Math.cos(a)*r, hz = world.house.z + Math.sin(a)*r; const ty = world.topY(Math.floor(hx), Math.floor(hz));
      if(ty < world.floor - 2){ hx = world.house.x + Math.cos(a)*5; hz = world.house.z + Math.sin(a)*5; }
      const hy = world.topY(Math.floor(hx), Math.floor(hz)) + 1;
      return { i, x:hx, y:hy, z:hz, vy:0, yaw:a, walk:0, onG:false, col:CAT[catKey(c.color)], s:.55 + (c.scale||.6)*.45, tx:null, tz:null, wait:Math.random()*2, love:0, home:[hx, hy, hz], v:c, sleep:0 }; });
    const fams = pets.filter(p => p.fam);
    // 毛線球：家裡的貓會追著玩、互相搶（你走過去也可以踢一下）
    const yarn = fams.length ? { x:world.spawn[0] + .8, y:world.spawn[1] + 1, z:world.spawn[2] - 2.2, vx:0, vy:0, vz:0, r:.17, roll:0, spin:0 } : null;
    let idleT = 0;
    const cam = { yaw:0, pitch:.38, dist:5 };   // 一開始站在貓屋前面、看著貓屋

    // 方塊碰撞：角色是一個 寬 w、高 h 的盒子
    const solid = (x,y,z) => { const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), b = world.get(ix, iy, iz); return (b && BT[b].solid) || FSOL.has(`${ix},${iy},${iz}`); };
    function hits(px,py,pz,w,h){ for(const dx of [-w,w]) for(const dz of [-w,w]) for(const dy of [0.01, h/2, h-.01]) if(solid(px+dx, py+dy, pz+dz)) return true; return false; }
    function move(e, mx, mz, dt, w = .3, h = .9){   // 切成小步，掉很快或手機很卡時也不會穿過方塊
      const n = Math.ceil(dt/.02); for(let i = 0; i < n; i++) move1(e, mx, mz, dt/n, w, h); }
    function move1(e, mx, mz, dt, w, h){
      const step = (ax, v) => { if(!v) return; const nx = e.x + (ax === 0 ? v : 0), nz = e.z + (ax === 2 ? v : 0);
        if(!hits(nx, e.y, nz, w, h)) { e.x = nx; e.z = nz; return; }
        if(e.onG && !hits(nx, e.y+1.05, nz, w, h) && !hits(e.x, e.y+1.05, e.z, w, h)){ if(e === player && !hits(nx, e.y+1, nz, w, h)){ e.y += 1; e.x = nx; e.z = nz; e.visY = (e.visY || 0) - 1; return; } e.vy = 7; e.onG = false; return; }   // 玩家：直接滑上一格（畫面慢慢跟上，不會一直跳）   // 自動跳上一格（跳高 1.2 格，確定跳得上去）
        // 差一點點對準門口／縫隙時，自動往旁邊滑進去（不用很準也走得進門）
        const px = ax === 0 ? 0 : 1, pz = ax === 0 ? 1 : 0, sp = Math.abs(v);
        for(const off of [.08, .16, .24, .32, .4, .5]) for(const sg of [-1, 1]){ const ox = px*off*sg, oz = pz*off*sg;
          if(!hits(nx + ox, e.y, nz + oz, w, h) && !hits(e.x + ox, e.y, e.z + oz, w, h)){ const m = Math.min(off, sp); e.x += px*m*sg; e.z += pz*m*sg; return; } }
      };
      step(0, mx*dt); step(2, mz*dt);
      if(e === player && FLY) e.vy = (flyUp ? 5.5 : 0) - (flyDn ? 5.5 : 0); else e.vy = Math.max(-22, e.vy - 20*dt); const ny = e.y + e.vy*dt;
      // 上下：腳底剛好碰到地面就算站著（不會一直在地面上下抖、跳不起來）
      const at4 = y => { for(const dx of [-w*.9, w*.9]) for(const dz of [-w*.9, w*.9]) if(solid(e.x+dx, y, e.z+dz)) return true; return false; };
      if(e.vy <= 0 && at4(ny)){ e.y = Math.floor(ny) + 1; e.vy = 0; e.onG = true; e.air = 0; }
      else if(e.vy > 0 && (at4(ny + h) || at4(ny + h*.5))){ e.vy = 0; e.onG = false; e.air = (e.air || 0) + dt; }
      else { e.y = ny; e.onG = false; e.air = (e.air || 0) + dt; }
      if(e.y < -10){ const sp = e.home || world.spawn; e.x = sp[0]; e.y = sp[1]+1.5; e.z = sp[2]; e.vy = 0; e.fell = 1; }   // 從雲上掉下去：飄回原本的地方
      if(hits(e.x, e.y, e.z, w, h)) unstick(e, w, h);
    }

    // 萬一卡進方塊裡：往上找最近的空位
    function unstick(e, w, h){ for(let k = 1; k <= 6; k++) if(!hits(e.x, e.y + k*.5, e.z, w, h)){ e.y += k*.5; e.vy = 0; return; }
      const sp = e.home || world.spawn; e.x = sp[0]; e.y = sp[1]; e.z = sp[2]; e.vy = 0; }
    // 腳下前方是不是空的（小貓不會自己走下雲）
    const ground = (x, z, y) => { for(let d = 0; d <= 2; d++) if(solid(x, y - .5 - d, z)) return true; return false; };

    // ---------- 操作 ----------
    const joy = root.querySelector("#p3dJoy"), knob = joy.querySelector("i"), J = { id:null, x:0, y:0, cx:0, cy:0 }, K = {};
    let dragId = null, lx = 0, ly = 0, hintHid = false;
    const hideHint = () => { if(hintHid) return; hintHid = true; const h = root.querySelector("#p3dHint"); if(h) h.classList.add("hide"); };
    joy.addEventListener("pointerdown", e => { e.preventDefault(); try{ joy.setPointerCapture(e.pointerId); }catch(_){} const r = joy.getBoundingClientRect(); J.id = e.pointerId; J.cx = r.left + r.width/2; J.cy = r.top + r.height/2; J.R = r.width*.37; jm(e); hideHint(); });
    const jm = e => { if(e.pointerId !== J.id) return; let dx = e.clientX - J.cx, dy = e.clientY - J.cy; const R = J.R || 46, l = Math.hypot(dx, dy); if(l > R){ dx *= R/l; dy *= R/l; } J.x = dx/R; J.y = dy/R; knob.style.transform = `translate(${dx}px,${dy}px)`; };
    joy.addEventListener("pointermove", jm);
    const jEnd = e => { if(e.pointerId !== J.id) return; J.id = null; J.x = J.y = 0; knob.style.transform = ""; };
    joy.addEventListener("pointerup", jEnd); joy.addEventListener("pointercancel", jEnd); joy.addEventListener("lostpointercapture", jEnd);
    let tap0 = null;   // 蓋房子模式：快速點一下（沒有拖曳）＝放／挖方塊
    cv.addEventListener("pointerdown", e => { if(dragId !== null) return; dragId = e.pointerId; lx = e.clientX; ly = e.clientY; tap0 = { x:e.clientX, y:e.clientY, t:performance.now(), m:0 }; try{ cv.setPointerCapture(e.pointerId); }catch(_){} hideHint(); });
    cv.addEventListener("pointermove", e => { if(e.pointerId !== dragId) return; if(tap0) tap0.m = Math.max(tap0.m, Math.hypot(e.clientX - tap0.x, e.clientY - tap0.y)); cam.yaw -= (e.clientX - lx)*.0085*CFG.sens; cam.pitch = Math.max(buildOn ? -.95 : .08, Math.min(buildOn ? 1.4 : 1.25, cam.pitch + (e.clientY - ly)*.006*CFG.sens*(CFG.invY ? -1 : 1))); lx = e.clientX; ly = e.clientY; });
    const cEnd = e => { if(e.pointerId !== dragId) return; dragId = null;
      tap0 = null; }; cv.addEventListener("pointerup", cEnd); cv.addEventListener("pointercancel", cEnd); cv.addEventListener("lostpointercapture", cEnd);
    const GK = { w:1, a:1, s:1, d:1, arrowup:1, arrowdown:1, arrowleft:1, arrowright:1, " ":1 };
    const kd = e => { const k = (e.key || "").toLowerCase(); if(!GK[k]) return; e.preventDefault(); if(k === " "){ if(!e.repeat) jump(); } else K[k] = true; hideHint(); },
          ku = e => { const k = (e.key || "").toLowerCase(); if(GK[k]) K[k] = false; };
    // 切到別的 App、通知蓋住：放開所有按鍵和搖桿，回來時不會自己一直走
    const release = () => { for(const k in K) K[k] = false; J.id = null; J.x = J.y = 0; knob.style.transform = ""; dragId = null; jumpBuf = 0; };
    const vis = () => { release(); last = performance.now(); };
    window.addEventListener("keydown", kd); window.addEventListener("keyup", ku); window.addEventListener("blur", release); document.addEventListener("visibilitychange", vis);
    cv.addEventListener("contextmenu", e => e.preventDefault());
    cv.addEventListener("webglcontextlost", e => { e.preventDefault(); o.toast && o.toast("3D 畫面中斷了，請重新開始"); close(); });
    let jumpBuf = 0;   // 按跳的時候還差一點點才落地／剛走出邊緣，也算數
    function jump(){ jumpBuf = .15; }
    function tryJump(dt){ if(jumpBuf <= 0) return; jumpBuf -= dt;
      if(player.onG || (player.air || 0) < .1 && player.vy <= 0){ player.vy = 7.2; player.onG = false; player.air = 1; jumpBuf = 0; CFG.sound && o.sfx && o.sfx.tap && o.sfx.tap(); } }
    // 創造模式可以飛：按「飛」開關；飛的時候按住「跳」往上、按住「下」往下
    let FLY = false, flyUp = false, flyDn = false;
    const flyB = root.querySelector("#p3dFly"), dnB = root.querySelector("#p3dDown"), jB = root.querySelector("#p3dJump");
    flyB.hidden = !CREATIVE;
    flyB.addEventListener("click", () => { FLY = !FLY; flyB.classList.toggle("on", FLY); dnB.hidden = !FLY; jB.querySelector("span").textContent = FLY ? "上" : "跳"; if(FLY){ player.vy = 0; player.y += .3; } CFG.sound && o.sfx && o.sfx.tap && o.sfx.tap(); });
    const hold = (el, set) => { el.addEventListener("pointerdown", e => { e.preventDefault(); try{ el.setPointerCapture(e.pointerId); }catch(_){} set(true); }); for(const ev of ["pointerup", "pointercancel", "lostpointercapture"]) el.addEventListener(ev, () => set(false)); };
    hold(dnB, v => { flyDn = v; });
    jB.addEventListener("pointerdown", e => { e.preventDefault(); if(FLY){ flyUp = true; try{ jB.setPointerCapture(e.pointerId); }catch(_){} } else jump(); });
    for(const ev of ["pointerup", "pointercancel", "lostpointercapture"]) jB.addEventListener(ev, () => { flyUp = false; });
    root.querySelector("#p3dX").addEventListener("click", close);
    root.querySelector("#p3dRotX").addEventListener("click", () => { root.classList.add("rotOk"); });

    // 靠近寵物貓時出現「餵牠／摸摸」
    const act = root.querySelector("#p3dAct"), foodEl = root.querySelector("#p3dF");
    let near = -1, busy = false;
    // ---------- 熟悉度（存在自己手機 mw_cube_vil）：每天第一次聊天、第一次摸摸各 +1 ----------
    const FL = ["陌生", "認識", "朋友", "好朋友"];
    const IC = n => o.icon ? `<span class="p3dIc">${o.icon(n)}</span>` : "";
    const hearts = lv => `<span class="p3dHs" title="${FL[lv]}">${[0,1,2].map(k => `<i class="${k < lv ? "on" : ""}">${o.icon ? o.icon("heart") : ""}</i>`).join("")}</span>`;
    let VIL = {}; try{ VIL = JSON.parse(localStorage.getItem("mw_cube_vil") || "{}") || {}; }catch(e){}
    const today = () => { const d = new Date(); return d.getFullYear()*10000 + (d.getMonth()+1)*100 + d.getDate(); };
    const friendLv = id => { const f = (VIL[id] && VIL[id].f) || 0; return f >= 12 ? 3 : f >= 5 ? 2 : f >= 1 ? 1 : 0; };
    function addFriend(id, kind){ const v = VIL[id] || (VIL[id] = { f:0 }), d = today(); if(v[kind] === d) return; v[kind] = d; v.f = (v.f || 0) + 1; try{ localStorage.setItem("mw_cube_vil", JSON.stringify(VIL)); }catch(e){} act._near = -2; }
    function paintAct(){
      void foodEl;
      if(near < 0){ act.innerHTML = ""; return; }
      const c = npc[near]; if(!c){ act.innerHTML = ""; return; }
      const p = pets[near], lv = FL[friendLv(c.id)];
      if(p && p.fam){ act.innerHTML = `<div class="p3dNm fam"><b>${o.esc(c.name)}</b><small>我們家的貓${c.stage ? "・" + o.esc(c.stage) : ""}</small></div><div class="p3dActB"><button data-a="pet">${IC("paw")}<span>摸摸</span></button><button data-a="ball">${IC("yarn")}<span>丟球</span></button></div>`; return; }
      act.innerHTML = `<div class="p3dNm"><b>${o.esc(c.name)}</b>${hearts(friendLv(c.id))}<small>${lv}</small></div><div class="p3dActB"><button data-a="talk">${IC("chat")}<span>聊天</span></button><button data-a="pet">${IC("paw")}<span>摸摸</span></button></div>`;
      void p;
    }
    // ---------- 聊天：喵喵叫＋翻譯，點一下下一句 ----------
    const talkEl = root.querySelector("#p3dTalk"), TK = window.CubeTalk;
    let talkIdx = -1, talkLines = [], talkK = 0, talkN = 0, talkLv = 0, curHr = 12;
    function showLine(){
      const p = pets[talkIdx], c = p && p.v; if(!c){ endTalk(); return; }
      const line = talkLines[talkK], meow = TK ? TK.meowOf(line, TK.hash(c.id + line)) : "喵～";
      const dots = talkLines.length > 1 ? `<span class="p3dDots">${talkLines.map((_, k) => `<i class="${k === talkK ? "on" : ""}"></i>`).join("")}</span>` : "";
      talkEl.innerHTML = `<div class="p3dTalkIn"><div class="p3dTalkNm"><b>${o.esc(c.name)}</b>${hearts(talkLv)}</div><div class="p3dMeow">${o.esc(meow)}</div><div class="p3dTr">${o.esc(line)}</div><div class="p3dTalkFt">${dots}<span class="p3dNext">${talkK < talkLines.length-1 ? "點一下繼續" : "點一下結束"}</span></div></div>`;
      talkEl.hidden = false; act.style.visibility = "hidden"; p.hop = .6; p.love = Math.max(p.love, .01);
      CFG.sound && o.sfx && o.sfx.meow && o.sfx.meow((c.pitch || 1)*(p.sleep > .5 ? .8 : 1));
    }
    function startTalk(i){
      const p = pets[i], c = p && p.v; if(!c) return; talkLv = friendLv(c.id);
      talkLines = TK && c.fam && TK.famTalk ? TK.famTalk(c, { me:o.meName, partner:o.partnerName, sleeping:p.sleep > .5, hour:curHr, day:today(), n:talkN++ }) : TK ? TK.talk(c, { me:o.meName, friend:friendLv(c.id), sleeping:p.sleep > .5, hour:curHr, day:today(), n:talkN++ }) : ["喵～"];
      if(p.sleep <= .5) addFriend(c.id, "t");
      talkIdx = i; talkK = 0; p.tx = null; p.wait = 4; player.yaw = Math.atan2(p.x - player.x, p.z - player.z); showLine();
    }
    function endTalk(){ talkIdx = -1; talkEl.hidden = true; talkEl.innerHTML = ""; act.style.visibility = ""; }
    talkEl.addEventListener("pointerdown", e => { e.preventDefault(); e.stopPropagation(); if(talkK < talkLines.length-1){ talkK++; showLine(); } else endTalk(); });
    // 摸摸：用 pointerdown 比較靈敏；摸完 .7 秒內再按不會一直叫
    act.addEventListener("pointerdown", e => {
      const b = e.target.closest("button"); if(!b) return; e.preventDefault(); e.stopPropagation();
      const p = pets[near]; if(!p || busy) return; busy = true; setTimeout(() => { busy = false; }, 700);
      if(b.dataset.a === "talk"){ hideHint(); startTalk(near); return; }
      if(b.dataset.a === "ball"){ hideHint(); tossBall(p); return; }
      addFriend(p.v && p.v.id, "p"); p.sleep = 0;
      if(TK && p.v && !p.fam){ talkLv = friendLv(p.v.id); /* 自己養的貓不講話（站長說只有之後賣東西的旅行貓會講話） */ talkLines = [TK.petLine(p.v)]; talkIdx = near; talkK = 0; showLine(); clearTimeout(p._pt); p._pt = setTimeout(() => { if(talkIdx === p.i && talkLines.length === 1) endTalk(); }, 2200); }
      p.love = 2.2; p.hop = .6; p.tx = null; p.wait = 2.5; p.pets = (p.pets || 0) + 1;
      player.yaw = Math.atan2(p.x - player.x, p.z - player.z); player.petT = .5;   // 轉向小貓
      if(!TK || p.fam) CFG.sound && o.sfx && o.sfx.meow && o.sfx.meow((p.v && p.v.pitch || 1)*1.1); hideHint();
    });
    paintAct();

    // ---------- 蓋房子 ----------
    const PALETTE = [B.PLANK, B.LOG, B.BRICK, B.STONE, B.GLASS, B.WOOL, B.ROOF, B.LEAF, B.SAKURA, B.GRASS, B.SAND, B.CLOUD, B.DIRT];
    const BNAME = { [B.PLANK]:"梅花木板", [B.LOG]:"貓抓柱", [B.BRICK]:"紅磚", [B.STONE]:"鵝卵石", [B.GLASS]:"紙窗", [B.WOOL]:"毛線毯", [B.ROOF]:"魚鱗瓦", [B.LEAF]:"樹葉", [B.SAKURA]:"櫻花", [B.GRASS]:"草地", [B.SAND]:"梅花沙", [B.CLOUD]:"雲朵", [B.DIRT]:"泥土" };
    const buildEl = root.querySelector("#p3dBuild"), barEl = root.querySelector("#p3dBar");
    let buildOn = false, tool = "put", pick = B.PLANK, lastCam = null; const undo = [], fx = [];
    // 方塊小圖示：用材質畫一個小小的立體方塊（上面＋左右兩面）
    function blockIcon(b){
      const c = document.createElement("canvas"), N = atlas.N, S2 = 44; c.width = c.height = S2; const g = c.getContext("2d"); g.imageSmoothingEnabled = true;
      const t = BT[b].t, tile = k => [(k % atlas.COLS)*N, Math.floor(k / atlas.COLS)*N];
      const face = (k, m, dark) => { const [sx, sy] = tile(k); g.save(); g.setTransform(...m); g.drawImage(atlas.cv, sx, sy, N, N, 0, 0, N, N); if(dark){ g.fillStyle = `rgba(0,0,0,${dark})`; g.fillRect(0, 0, N, N); } g.restore(); };
      const k = 1/N;
      face(t[0], [20*k, 10*k, -20*k, 10*k, 22, 2], 0);       // 上面
      face(t[1], [20*k, 10*k, 0, 20*k, 2, 12], .16);         // 左面
      face(t[1], [20*k, -10*k, 0, 20*k, 22, 22], .32);       // 右面
      return c.toDataURL();
    }
    // 方塊列：一頁 6 個，用 ◀ ▶ 換頁（不用左右捲動，比較好按）
    let barPg = 0; const PER = 6, ICONS = {};
    // ---------- 準星玩法（像一般方塊遊戲）：畫面中間的準星瞄到哪裡，就看得到要放在哪（半透明的預覽），按「放」／「拿」 ----------
    let fPick = null, fPg = 0, fRot = 0, AIM = null, aimKey = "", tookTip = false; const FICON = {};
    const fName = id => (FURN.find(q => q[0] === id) || [0, id])[1];
    const bHint = root.querySelector("#p3dBHint"), putBtn = root.querySelector("#p3dPut"), takeBtn = root.querySelector("#p3dTake"), rotBtn = root.querySelector("#p3dFRot");
    function paintFurnBar(){
      const own = FURN.filter(([id]) => (FSAVE.inv[id] || 0) > 0), pages = Math.max(1, Math.ceil(own.length/PER));
      if(fPick && !(FSAVE.inv[fPick] > 0)) fPick = null; if(!fPick && own.length) fPick = own[0][0];
      fPg = Math.max(0, Math.min(pages - 1, fPg));
      const nav = (d, on) => `<button class="p3dPg" data-pg="${d}" ${on ? "" : "disabled"}>${d < 0 ? "◀" : "▶"}</button>`;
      barEl.innerHTML = !own.length ? `<div class="p3dEmpty">背包裡沒有家具了<br><small>準星對準島上的家具按「拿」可以收回來</small></div>`
        : nav(-1, fPg > 0) + own.slice(fPg*PER, fPg*PER + PER).map(([id, nm]) => `<button data-f="${id}" class="fu${id === fPick ? " on" : ""}"><img src="${FICON[id] || (FICON[id] = furnIcon(id))}" alt=""><i>${nm}</i>${!CREATIVE && FSAVE.inv[id] > 1 ? `<b>${FSAVE.inv[id]}</b>` : ""}</button>`).join("") + nav(1, fPg < pages - 1);
      barEl.querySelectorAll("[data-pg]").forEach(x => x.addEventListener("click", () => { fPg += +x.dataset.pg; paintFurnBar(); }));
      barEl.querySelectorAll("[data-f]").forEach(x => x.addEventListener("click", () => { fPick = x.dataset.f; fRot = 0; paintFurnBar(); aimKey = ""; CFG.sound && o.sfx && o.sfx.tap && o.sfx.tap(); }));
    }
    rotBtn.addEventListener("click", () => { fRot = (fRot + 1) % 4; aimKey = ""; CFG.sound && o.sfx && o.sfx.tap && o.sfx.tap(); });
    putBtn.addEventListener("click", () => doPut());
    // 「拿」要按住：方塊／家具慢慢裂開，裂完才拿起來；中途放開就停（裂痕也消失）
    let holdTake = false, brk = null;
    const BRK_T = { [B.STONE]:1.1, [B.BRICK]:1.1, [B.ROOF]:1, [B.PLANK]:.8, [B.LOG]:.8, [B.GLASS]:.45 };
    takeBtn.addEventListener("pointerdown", e => { e.preventDefault(); try{ takeBtn.setPointerCapture(e.pointerId); }catch(_){} holdTake = true; brk = null; takeBtn.classList.add("hold");
      const tk = AIM && AIM.take; if(tk && tk.bad) o.toast && o.toast(tk.bad); });
    const takeEnd = () => { holdTake = false; brk = null; takeBtn.classList.remove("hold"); };
    for(const ev of ["pointerup", "pointercancel", "lostpointercapture"]) takeBtn.addEventListener(ev, takeEnd);
    function breakStep(dt){
      if(!holdTake || !buildOn){ brk = null; return; }
      const tk = AIM && AIM.take; if(!tk || tk.bad){ brk = null; return; }
      const key = tk.kind === "furn" ? "f" + tk.i : tk.kind === "flower" ? "fl" + tk.i : tk.x + "," + tk.y + "," + tk.z;
      if(!brk || brk.key !== key) brk = { key, t:0, c:0, dur: (tk.kind === "flower" ? .3 : tk.kind === "furn" ? .7 : (BRK_T[world.get(tk.x, tk.y, tk.z)] || .6))*(CREATIVE ? .2 : 1) };
      if(tk.kind === "flower"){ brk.t += dt; if(brk.t >= brk.dur){ brk = null; holdTake = false; takeBtn.classList.remove("hold"); doTake(); } return; }   // 換了目標就重新開始
      brk.t += dt; brk.c -= dt;
      if(brk.c <= 0){ brk.c = .13;   // 一邊裂一邊掉小碎屑
        const b = tk.kind === "furn" ? furnCells(FSAVE.placed[tk.i]).box : [tk.x, tk.y, tk.z, tk.x + 1, tk.y + 1, tk.z + 1];
        const cols = tk.kind === "furn" ? ["#f2a7bd", "#fbd3de", "#dcbf96"] : TILE_COL[BT[world.get(tk.x, tk.y, tk.z)].t[1]] || ["#ffffff"];
        for(let k = 0; k < 2; k++) fx.push({ x:b[0] + Math.random()*(b[3] - b[0]), y:b[4] - .05, z:b[2] + Math.random()*(b[5] - b[2]), vx:(Math.random() - .5)*1.6, vy:1 + Math.random()*1.5, vz:(Math.random() - .5)*1.6, life:.45, c:cols[k % cols.length] }); }
      if(brk.t >= brk.dur){ brk = null; holdTake = false; takeBtn.classList.remove("hold"); doTake(); }   // 拿完一個就停，要再按一次（不會不小心一路挖下去）
    }
    // 放得下嗎：每一格下面要有地、上面要是空的，不能跟別的家具重疊（平平的地毯、池塘只跟平的比）、不能壓到人和貓
    function furnFits(f, skip){ const c = furnCells(f), flat = F_FLAT.has(f.id);
      for(const [x, z] of c.cells){ const gb = world.get(x, f.y - 1, z); if(!gb || !BT[gb].solid) return "這裡下面沒有地";
        for(let y = f.y; y < f.y + c.h; y++){ const b = world.get(x, y, z); if(b && b !== B.WATER) return "這裡太擠了，放不下"; } }
      for(let i = 0; i < FSAVE.placed.length; i++){ if(i === skip) continue; const g = FSAVE.placed[i]; if(F_FLAT.has(g.id) !== flat || g.y !== f.y) continue;
        const gc = furnCells(g).cells; if(c.cells.some(([x, z]) => gc.some(([x2, z2]) => x === x2 && z === z2))) return "跟別的家具疊在一起了"; }
      const xs = c.cells.map(q => q[0]), zs = c.cells.map(q => q[1]), x0 = Math.min(...xs), x1 = Math.max(...xs) + 1, z0 = Math.min(...zs), z1 = Math.max(...zs) + 1, y0 = f.y, y1 = f.y + c.h, hitB = (e, w, h) => !F_WALK.has(f.id) && e.x + w > x0 && e.x - w < x1 && e.z + w > z0 && e.z - w < z1 && e.y + h > y0 && e.y < y1;
      if(hitB(player, .28, 1.45) || pets.some(p => hitB(p, .25*p.s, .8*p.s))) return "會壓到人或小貓喔";
      return ""; }
    // 從畫面上一點射出去打到的家具（打外框，回傳最近的）
    function furnRay(cx, cy){ if(!lastCam) return null; const r = cv.getBoundingClientRect(), nx = ((cx - r.left)/r.width)*2 - 1, ny = 1 - ((cy - r.top)/r.height)*2;
      const { eye, tgt } = lastCam, f = nrm(sub(tgt, eye)), rt = nrm(cross(f, [0,1,0])), up = cross(rt, f), th = Math.tan(CFG.fov*Math.PI/360), asp = r.width/r.height;
      const d = nrm([f[0] + rt[0]*nx*th*asp + up[0]*ny*th, f[1] + rt[1]*nx*th*asp + up[1]*ny*th, f[2] + rt[2]*nx*th*asp + up[2]*ny*th]); let best = null;
      FSAVE.placed.forEach((g, i) => { const b = furnCells(g).box; let t0 = 0, t1 = 30;
        for(let k = 0; k < 3; k++){ const lo = b[k], hi = b[k + 3] + (k === 1 ? .05 : 0), inv = 1/(d[k] || 1e-9); let a = (lo - eye[k])*inv, c = (hi - eye[k])*inv; if(a > c) [a, c] = [c, a]; t0 = Math.max(t0, a); t1 = Math.min(t1, c); }
        if(t0 <= t1 && (!best || t0 < best.t)) best = { i, t:t0 }; });
      return best; }
    const underFurn = (x, y, z) => FSAVE.placed.some(f => y >= f.y && y < f.y + furnCells(f).h && furnCells(f).cells.some(([cx, cz]) => cx === x && cz === z));
    // 準星（畫面正中間）瞄到什麼：「拿」的目標（家具優先，再來是方塊）和「放」的位置
    function computeAim(){
      if(!lastCam) return null; const r = cv.getBoundingClientRect(), cx = r.left + r.width/2, cy = r.top + r.height/2;
      const fh = furnRay(cx, cy), h = pickRay(cx, cy), fi = fh && (!h || fh.t <= h.dist + .3) ? fh.i : -1;
      { // 小花／小蘑菇：準星射線碰到花的附近（小圓球）就算瞄到，比後面的方塊近就優先
        const { eye, tgt } = lastCam, d = nrm(sub(tgt, eye)); let best = null;
        (world.flowers || []).forEach((f, i) => { if(f.gone) return; const c = [f.x, f.y + .2*f.s, f.z], w = sub(c, eye), tt = w[0]*d[0] + w[1]*d[1] + w[2]*d[2]; if(tt < 0 || tt > 9) return;
          const q = [eye[0] + d[0]*tt - c[0], eye[1] + d[1]*tt - c[1], eye[2] + d[2]*tt - c[2]]; if(q[0]*q[0] + q[1]*q[1] + q[2]*q[2] > .3*.3) return; if(!best || tt < best.t) best = { i, t:tt }; });
        if(best && (!h || best.t <= h.dist + .4) && (!fh || best.t < fh.t)){ const f = world.flowers[best.i];
          const A0 = { take:{ kind:"flower", i:best.i, bad: Math.hypot(f.x - player.x, f.z - player.z) > 6 ? "太遠了，走近一點" : "" }, put:null }; return A0; } }
      const far = (x, y, z) => Math.hypot(x + .5 - player.x, y + .5 - (player.y + .7), z + .5 - player.z) > 7.5;
      const A = { take:null, put:null };
      if(fi >= 0){ const f = FSAVE.placed[fi]; A.take = { kind:"furn", i:fi, bad: far(f.x, f.y, f.z) ? "太遠了，走近一點" : "" }; }
      else if(h){ A.take = { kind:"block", x:h.x, y:h.y, z:h.z, bad: h.y <= 0 ? "最底下的雲不能挖喔" : far(h.x, h.y, h.z) ? "太遠了，走近一點" : FSAVE.placed.some(f => f.y - 1 === h.y && furnCells(f).cells.some(([x, z]) => x === h.x && z === h.z)) ? "上面有家具，先把家具拿起來" : "" }; }
      if(tool === "furn"){
        if(fPick && h && h.face && h.face[1] === 1 && fi < 0){
          const f = { id:fPick, x:h.x, y:h.y + 1, z:h.z, r:0 }, a = Math.atan2(player.x - (f.x + .5), player.z - (f.z + .5));
          f.r = (((Math.round(a/(Math.PI/2)) + fRot) % 4 + 4) % 4)*Math.PI/2;   // 正面朝自己，按「轉向」再轉
          A.put = { kind:"furn", f, bad: far(f.x, f.y, f.z) ? "太遠了，走近一點" : furnFits(f, -1) }; }
      } else if(h && h.face){
        const x = h.x + h.face[0], y = h.y + h.face[1], z = h.z + h.face[2], cur = world.get(x, y, z);
        A.put = { kind:"block", x, y, z, bad: (y <= 0 || y >= H - 1 || x < 0 || z < 0 || x >= W || z >= D || (cur && cur !== B.WATER)) ? "這裡不能放" : far(x, y, z) ? "太遠了，走近一點"
          : underFurn(x, y, z) ? "這裡有家具" : (inBody(player, x, y, z, .28, 1.45) || pets.some(p => inBody(p, x, y, z, .25*p.s, .8*p.s))) ? "會壓到人或小貓喔" : "" };
      }
      return A;
    }
    function paintAim(){
      AIM = buildOn ? computeAim() : null; if(!buildOn) return;
      const put = AIM && AIM.put, take = AIM && AIM.take;
      const tf = take && take.kind === "furn" && !take.bad ? fName(FSAVE.placed[take.i].id) : "", tfl = take && take.kind === "flower" && !take.bad ? (world.flowers[take.i].m ? "小蘑菇" : "小花") : "";
      const txt = tfl ? `按住「拿」採${tfl}` : tf ? `按住「拿」拿起${tf}（可以搬到別的地方）` : tool === "furn" && !fPick ? "背包空了：對準家具按住「拿」可以收回來" : put && put.bad ? put.bad : !put ? (tool === "furn" ? "把準星對準地面" : "把準星對準方塊")
        : tool === "furn" ? `按「放」把${fName(fPick)}放在這裡` : "按「放」蓋方塊，按住「拿」挖掉";
      const k = [txt, !!(put && !put.bad), !!(take && !take.bad), tool].join("|"); if(k === aimKey) return; aimKey = k;
      bHint.textContent = txt; bHint.classList.toggle("bad", !!(put && put.bad));
      putBtn.disabled = !put || !!put.bad; takeBtn.disabled = !take || !!take.bad; rotBtn.hidden = tool !== "furn";
    }
    function doPut(){
      const p = AIM && AIM.put; if(!p) return; if(p.bad){ o.toast && o.toast(p.bad); return; }
      if(p.kind === "furn"){ const f = p.f; FSAVE.placed.push(f); if(!CREATIVE){ FSAVE.inv[f.id]--; if(FSAVE.inv[f.id] <= 0) delete FSAVE.inv[f.id]; }
        saveFurn(); furnSolidRebuild(); paintFurnBar(); Object.assign(flash, { t:.25, x:f.x, y:f.y - 1, z:f.z }); }
      else if(!CREATIVE && !(BINV[pick] > 0)){ o.toast && o.toast("背包裡沒有這種方塊了，先去挖一些吧"); return; }
      else if(!setBlock(p.x, p.y, p.z, pick, true)) return;
      else if(!CREATIVE){ BINV[pick]--; if(BINV[pick] <= 0) delete BINV[pick]; saveInv(); paintBar(); }
      else Object.assign(flash, { t:.25, x:p.x, y:p.y, z:p.z });
      aimKey = ""; CFG.sound && o.sfx && o.sfx.tap && o.sfx.tap();
    }
    function doTake(){
      const p = AIM && AIM.take; if(!p) return; if(p.bad){ o.toast && o.toast(p.bad); return; }
      if(p.kind === "flower"){ const f = world.flowers[p.i]; if(!f || f.gone) return; f.gone = true; PICK.i.push(p.i); const k = f.m ? "mush" : "flower"; MAT[k] = (MAT[k] || 0) + 1; savePick();
        for(let n = 0; n < 6; n++) fx.push({ x:f.x, y:f.y + .25, z:f.z, vx:(Math.random() - .5)*1.5, vy:.8 + Math.random()*1.4, vz:(Math.random() - .5)*1.5, life:.5, c:f.m ? "#ef8a8a" : f.c });
        o.toast && o.toast(f.m ? `採到一朵小蘑菇！（背包裡有 ${MAT.mush} 朵）` : `採到一朵小花！（背包裡有 ${MAT.flower} 朵）`); aimKey = ""; CFG.sound && o.sfx && o.sfx.tap && o.sfx.tap(); return; }
      if(p.kind === "furn"){ const f = FSAVE.placed[p.i]; if(!f) return; FSAVE.placed.splice(p.i, 1); if(!CREATIVE) FSAVE.inv[f.id] = (FSAVE.inv[f.id] || 0) + 1; saveFurn(); furnSolidRebuild();
        fPick = f.id; fRot = 0; if(tool !== "furn"){ tool = "furn"; paintTool(); } paintBar();   // 拿起來就拿在手上，對準別的地方按「放」＝搬家具
        if(!tookTip){ tookTip = true; o.toast && o.toast(`${fName(f.id)}拿起來了，對準別的地方按「放」就能搬過去`); } }
      else { const b = world.get(p.x, p.y, p.z); if(!setBlock(p.x, p.y, p.z, 0, true)) return;
        if(!CREATIVE && b !== B.WATER){ const g = b === B.CLOUDB ? B.CLOUD : b; BINV[g] = (BINV[g] || 0) + 1; saveInv(); if(tool === "put") paintBar(); }   /* 生存：挖下來的放進背包 */ burst(p.x, p.y, p.z, b); Object.assign(flash, { t:.25, x:p.x, y:p.y, z:p.z }); }
      aimKey = ""; CFG.sound && o.sfx && o.sfx.tap && o.sfx.tap();
    }
    function paintBar(){
      if(tool === "furn"){ paintFurnBar(); return; }
      const LIST = CREATIVE ? PALETTE : PALETTE.filter(b => BINV[b] > 0);
      if(!CREATIVE && !LIST.length){ barEl.innerHTML = `<div class="p3dEmpty">背包裡還沒有方塊<br><small>準星對準方塊，按住「拿」挖下來就會放進背包</small></div>`; return; }
      if(!LIST.includes(pick)) pick = LIST[0];
      const pages = Math.ceil(LIST.length/PER); barPg = Math.max(0, Math.min(pages - 1, barPg));
      const nav = (d, on) => `<button class="p3dPg" data-pg="${d}" ${on ? "" : "disabled"}>${d < 0 ? "◀" : "▶"}</button>`;
      barEl.innerHTML = nav(-1, barPg > 0) + LIST.slice(barPg*PER, barPg*PER + PER).map(b => `<button data-b="${b}" class="${b === pick ? "on" : ""}"><img src="${ICONS[b] || (ICONS[b] = blockIcon(b))}" alt=""><i>${BNAME[b]}</i>${!CREATIVE ? `<b class="bq">${BINV[b]}</b>` : ""}</button>`).join("") + nav(1, barPg < pages - 1);
      barEl.querySelectorAll("[data-pg]").forEach(x => x.addEventListener("click", () => { barPg += +x.dataset.pg; paintBar(); }));
      barEl.querySelectorAll("[data-b]").forEach(x => x.addEventListener("click", () => { pick = +x.dataset.b; tool = "put"; paintTool(); paintBar(); CFG.sound && o.sfx && o.sfx.tap && o.sfx.tap(); }));
    }
    function paintCount(){ const el = root.querySelector("#p3dCnt"); if(!el) return; el.textContent = `已經蓋了 ${nEdit} / ${MAX_EDITS} 格`; el.classList.toggle("full", nEdit >= MAX_EDITS*.9); }
    function paintTool(){ buildEl.querySelectorAll("[data-t]").forEach(x => x.classList.toggle("on", x.dataset.t === tool)); root.classList.toggle("furn", tool === "furn"); aimKey = ""; }
    buildEl.querySelectorAll("[data-t]").forEach(x => x.addEventListener("click", () => { tool = x.dataset.t; paintTool(); paintBar(); CFG.sound && o.sfx && o.sfx.tap && o.sfx.tap(); }));
    function setBuild(on){
      buildOn = on; buildEl.hidden = !on; root.classList.toggle("building", on); endTalk && endTalk();
      root.querySelector("#p3dBuildT span:last-child").textContent = on ? "蓋好了" : "蓋房子";
      if(on){ paintBar(); paintTool(); paintCount(); hideHint(); } else AIM = null;
    }
    root.querySelector("#p3dBuildT").addEventListener("click", () => setBuild(!buildOn));
    // 從畫面上的一點射出去，找到第一個碰到的方塊（一格一格走，DDA）
    function pickRay(cx, cy){
      if(!lastCam) return null; const r = cv.getBoundingClientRect(), nx = ((cx - r.left)/r.width)*2 - 1, ny = 1 - ((cy - r.top)/r.height)*2;
      const { eye, tgt } = lastCam, f = nrm(sub(tgt, eye)), rt = nrm(cross(f, [0,1,0])), up = cross(rt, f), th = Math.tan(CFG.fov*Math.PI/360), asp = r.width/r.height;
      const d = nrm([f[0] + rt[0]*nx*th*asp + up[0]*ny*th, f[1] + rt[1]*nx*th*asp + up[1]*ny*th, f[2] + rt[2]*nx*th*asp + up[2]*ny*th]);
      let x = Math.floor(eye[0]), y = Math.floor(eye[1]), z = Math.floor(eye[2]); const st = d.map(v => v > 0 ? 1 : -1);
      const tD = d.map(v => Math.abs(1/(v || 1e-9))); const tM = [0,1,2].map(i => { const p = eye[i], c = [x,y,z][i]; return (d[i] > 0 ? (c + 1 - p) : (p - c))*tD[i]; });
      let face = null, t = 0;
      for(let k = 0; k < 80 && t < 16; k++){
        const b = world.get(x, y, z); if(b && b !== B.WATER) return { x, y, z, face, dist:t };
        const i = tM[0] < tM[1] ? (tM[0] < tM[2] ? 0 : 2) : (tM[1] < tM[2] ? 1 : 2); t = tM[i]; tM[i] += tD[i];
        if(i === 0){ x += st[0]; face = [-st[0],0,0]; } else if(i === 1){ y += st[1]; face = [0,-st[1],0]; } else { z += st[2]; face = [0,0,-st[2]]; }
        if(y < -2 || y > H + 2) break;
      }
      return null;
    }
    const inBody = (e, x, y, z, w, h) => x + 1 > e.x - w && x < e.x + w && z + 1 > e.z - w && z < e.z + w && y + 1 > e.y && y < e.y + h;
    function setBlock(x, y, z, b, rec){
      const prev = world.get(x, y, z) || 0; if(prev === b) return false;
      if(!editCell(x, y, z, b)){ o.toast && o.toast(`這座島已經改了 ${MAX_EDITS} 格，蓋滿了～挖掉一些自己蓋的方塊或按復原，就能再蓋`); return false; }
      world.set(x, y, z, b); paintCount();
      if(rec) undo.push({ x, y, z, prev, b }); if(undo.length > 60) undo.shift();
      saveEdits(); buildWorld(); return true;
    }
    function burst(x, y, z, b){ const c = TILE_COL[BT[b].t[1]]; for(let k = 0; k < 10; k++) fx.push({ x:x + .5, y:y + .5, z:z + .5, vx:(Math.random() - .5)*3, vy:1.5 + Math.random()*2.5, vz:(Math.random() - .5)*3, life:.6 + Math.random()*.3, c:c[k % c.length] }); }
    const flash = { t:0 };
    root.querySelector("#p3dUndo").addEventListener("click", () => { const u = undo.pop(); if(!u){ o.toast && o.toast("沒有可以復原的了"); return; }
      if(!editCell(u.x, u.y, u.z, u.prev)){ undo.push(u); o.toast && o.toast("蓋滿了，不能復原這一步"); return; }
      world.set(u.x, u.y, u.z, u.prev); saveEdits(); paintCount(); buildWorld(); });

    // ---------- 設定畫面 ----------
    const clockEl = root.querySelector("#p3dClock"), fpsEl = root.querySelector("#p3dFps"), setEl = root.querySelector("#p3dSet"); let fpsN = 0, fpsT = performance.now();
    const CAMD = { s:3.6, m:5, l:6.6 };
    function applyCfg(first){
      root.dataset.joy = CFG.joy; root.dataset.ui = "w";   // 11/22 站長從 16 種按鈕選了第 8 種「和紙貼紙」（W）；G 玻璃風、C 精緻像素的樣式還留在 style.css fpsEl.hidden = !CFG.showFps; cam.dist = CAMD[CFG.camD] || 5;
      if(!first){ resize(); saveCfg(CFG); }
    }
    const seg = (k, opts) => `<div class="p3dSeg" data-k="${k}">${opts.map(([v, t]) => `<button data-v="${v}" class="${String(CFG[k]) === String(v) ? "on" : ""}">${t}</button>`).join("")}</div>`;
    const tog = k => seg(k, [["true","開"],["false","關"]]);
    const slider = (k, mn, mx, st, fmt) => `<div class="p3dRng"><input type="range" data-k="${k}" min="${mn}" max="${mx}" step="${st}" value="${CFG[k]}"><b data-f="${k}">${fmt(CFG[k])}</b></div>`;
    const FMT = { scale:v => Math.round(v*100) + "%", view:v => v + " 格", fov:v => v + "°", sens:v => Math.round(v*100) + "%" };
    const row = (t, d, c) => `<div class="p3dRow"><div><div class="p3dRt">${t}</div>${d ? `<div class="p3dRd">${d}</div>` : ""}</div>${c}</div>`;
    function paintSet(){
      setEl.innerHTML = `<div class="p3dSetIn">
        <div class="p3dSetHd"><b>設定</b><button id="p3dSetX">完成</button></div>
        <div class="p3dSec">畫面</div>
        ${row("畫質", "一次調整下面幾項；手機會燙或卡就選「順暢」", seg("q", [["low","順暢"],["mid","平衡"],["high","精緻"],["custom","自訂"]]))}
        ${row("解析度", "越高越清楚，但比較耗電", slider("scale", .5, 1, .05, FMT.scale))}
        ${row("視野距離", "看得多遠", slider("view", 30, 90, 5, FMT.view))}
        ${row("幀率上限", "越高越順，30 比較省電", seg("fps", [["30","30"],["60","60"],["0","不限"]]))}
        ${row("飄浮的雲", "", tog("clouds"))}
        ${row("遠方的霧", "關掉的話遠處會直接切掉", tog("fog"))}
        ${row("視角", "畫面看出去的寬度", slider("fov", 50, 90, 5, FMT.fov))}
        ${row("島上的時間", "跟現實一樣：晚上會變暗、小貓會回家睡覺", seg("time", [["real","跟現實一樣"],["day","永遠白天"]]))}
        ${row("顯示 FPS", "左上角顯示每秒幾張畫面", tog("showFps"))}
        <div class="p3dSec">操作</div>
        ${row("轉鏡頭靈敏度", "", slider("sens", .3, 2, .1, FMT.sens))}
        ${row("鏡頭上下反過來", "", tog("invY"))}
        ${row("鏡頭距離", "", seg("camD", [["s","近"],["m","中"],["l","遠"]]))}
        ${row("鏡頭自動轉到背後", "走路時鏡頭慢慢跟到角色後面", tog("autoCam"))}
        ${row("搖桿大小", "", seg("joy", [["s","小"],["m","中"],["l","大"]]))}
        <div class="p3dSec">聲音和其他</div>
        ${row("音效", "", tog("sound"))}
        ${row("小貓的名字", "", tog("names"))}
        <button class="p3dReset" id="p3dReset">恢復預設</button>
        <button class="p3dReset" id="p3dWipe">把島恢復原狀（清掉自己蓋的方塊）</button>
      </div>`;
      setEl.querySelector("#p3dSetX").onclick = () => { setEl.hidden = true; };
      const wipe = setEl.querySelector("#p3dWipe");
      wipe.onclick = () => { if(!wipe._sure){ wipe._sure = 1; wipe.textContent = "確定嗎？再按一次就會清掉"; setTimeout(() => { if(wipe.isConnected){ wipe._sure = 0; wipe.textContent = "把島恢復原狀（清掉自己蓋的方塊）"; } }, 3000); return; }
        try{ localStorage.removeItem("mw_cube_edits" + MK); }catch(e){} if(!CREATIVE){ BINV = {}; saveInv(); }   // 生存：島恢復原狀，背包裡挖來的方塊也一起清掉 for(const k in EDITS){ const [x, y, z] = k.split(",").map(Number); world.set(x, y, z, ORIG.get(x, y, z) || 0); }
        EDITS = {}; nEdit = 0; undo.length = 0; buildWorld(); wipe._sure = 0; wipe.textContent = "已經恢復原狀了"; };
      setEl.querySelector("#p3dReset").onclick = () => { Object.assign(CFG, DEF); applyCfg(); paintSet(); };
      setEl.querySelectorAll(".p3dSeg").forEach(g => g.querySelectorAll("button").forEach(b => b.onclick = () => {
        const k = g.dataset.k, raw = b.dataset.v, v = raw === "true" ? true : raw === "false" ? false : (/^[\d.]+$/.test(raw) ? +raw : raw);
        if(k === "q"){ CFG.q = v; if(QUALITY[v]) Object.assign(CFG, QUALITY[v]); }
        else { CFG[k] = v; if(["fps","clouds"].includes(k)) CFG.q = "custom"; }
        CFG.sound && o.sfx && o.sfx.tap && o.sfx.tap(); applyCfg(); paintSet(); }));
      setEl.querySelectorAll("input[type=range]").forEach(r => {
        r.oninput = () => { const k = r.dataset.k; CFG[k] = +r.value; setEl.querySelector(`[data-f="${k}"]`).textContent = FMT[k](CFG[k]);
          if(["scale","view"].includes(k)){ CFG.q = "custom"; setEl.querySelectorAll('[data-k="q"] button').forEach(b => b.classList.toggle("on", b.dataset.v === "custom")); }
          applyCfg(); };
      });
    }
    root.querySelector("#p3dGear").addEventListener("click", () => { release(); paintSet(); setEl.hidden = false; hideHint(); });
    setEl.addEventListener("pointerdown", e => e.stopPropagation());

    // ---------- 畫面 ----------
    const labels = root.querySelector("#p3dL");
    function resize(){ const dpr = Math.min(window.devicePixelRatio || 1, 2)*CFG.scale; cv.width = Math.round(root.clientWidth*dpr); cv.height = Math.round(root.clientHeight*dpr); }
    applyCfg(true); resize(); window.addEventListener("resize", resize);
    offAll = () => { window.removeEventListener("resize", resize); window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku); window.removeEventListener("blur", release); document.removeEventListener("visibilitychange", vis); };
    // 天空和光線跟著時間變：早上淡藍、中午亮藍、傍晚橘粉、晚上深藍（有星星）
    let SKY = hexc("#cdeaff"), TINT = [1,1,1], STAR = 0;
    const KEYS = [[0,"#1e2748",[.5,.55,.78],1],[5,"#2a3358",[.55,.6,.8],1],[6.5,"#f6c9b0",[.95,.85,.82],.2],[8,"#cdeaff",[1,1,1],0],[16.5,"#cdeaff",[1,1,1],0],[18,"#f7b8a0",[1,.86,.78],0],[19.3,"#6a5a8c",[.72,.68,.86],.5],[21,"#1e2748",[.5,.55,.78],1],[24,"#1e2748",[.5,.55,.78],1]];
    function dayLight(h){ let k = 0; while(k < KEYS.length-2 && h >= KEYS[k+1][0]) k++; const A = KEYS[k], B = KEYS[k+1], u = Math.max(0, Math.min(1, (h - A[0])/(B[0] - A[0] || 1)));
      const ca = hexc(A[1]), cb = hexc(B[1]); SKY = ca.map((v, i) => v + (cb[i] - v)*u); TINT = A[2].map((v, i) => v + (B[2][i] - v)*u); STAR = A[3] + (B[3] - A[3])*u; }
    const STARS = (() => { const q = rng(99), out = []; for(let k = 0; k < 90; k++){ const a = q()*Math.PI*2, e = .15 + q()*1.2; out.push([Math.cos(a)*Math.cos(e)*70, Math.sin(e)*70, Math.sin(a)*Math.cos(e)*70, .25 + q()*.35]); } return out; })();
    let boundC = 36; const bind0 = bind; bind = m => { boundC = m.c; bind0(m); };
    function box(m, col, a = 1){ gl.uniformMatrix4fv(U("M"), false, m); gl.uniform3fv(U("col"), hexc(col)); gl.uniform1f(U("alpha"), a); gl.drawElements(gl.TRIANGLES, boundC, gl.UNSIGNED_SHORT, 0); }
    // ---------- 我們家的貓：跟著你、一起玩（追毛線球、互相追、繞著你跑、坐下來看你） ----------
    const turnTo = (p, vx, vz, dt, k = 8) => { const want = Math.atan2(vx, vz); let d = want - p.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); p.yaw += d*Math.min(1, dt*k); };
    const okAt = (x, z) => world.topY(Math.floor(x), Math.floor(z)) >= world.floor - 1;
    function famAI(p, dp, dt, night){
      const s = p.fs, others = fams.filter(q => q !== p);
      if(s.cd > 0) s.cd -= dt;   // 剛被抓到、換人當鬼：先讓對方跑一下，不會每一格畫面都互相抓來抓去
      if(dp > 16 || p.fell){ p.fell = 0; const a = player.yaw + Math.PI + (p.i % 2 ? .8 : -.8); p.x = player.x + Math.sin(a)*1.5; p.z = player.z + Math.cos(a)*1.5; p.y = player.y + .3; p.vy = 0; s.t = 0; return [0, 0]; }   // 走太遠：跑回你身邊
      // 晚上你站著不動一陣子，牠們會在你旁邊縮成一團睡
      if(night && idleT > 4 && dp >= 2 && talkIdx !== p.i){ const dx = player.x - p.x, dz = player.z - p.z, l = Math.hypot(dx, dz) || 1; p.sleep = 0; if(ground(p.x + dx/l*.5, p.z + dz/l*.5, p.y)){ turnTo(p, dx, dz, dt); return [dx/l*2.2, dz/l*2.2]; } }   // 晚上你停下來：先走回你旁邊
      if(night && idleT > 6 && dp < 3.5 && talkIdx !== p.i){ p.sleep = Math.min(1, p.sleep + dt*.7); return [0, 0]; }
      p.sleep = Math.max(0, p.sleep - dt*2);
      for(const q of others){ const d = Math.hypot(p.x - q.x, p.z - q.z), m = .3*(p.s + q.s); if(d < m && d > 1e-4){ const k = (m - d)/d*.5, ox = p.x, oz = p.z; p.x += (p.x - q.x)*k; p.z += (p.z - q.z)*k; if(hits(p.x, p.y, p.z, .25*p.s, .8*p.s)){ p.x = ox; p.z = oz; } } }   // 兩隻不會疊在一起
      s.chk = (s.chk || 0) + dt;   // 卡住（被方塊擋住、兩隻擠在一起）超過 1.2 秒：先坐下來，等一下再玩別的
      if(s.chk > 1.2){ if(/chase|flee|zoom|roam/.test(s.mode) && Math.hypot(p.x - (s.px || 0), p.z - (s.pz || 0)) < .15){ if(s.who && s.who.fs.who === p){ s.who.fs.mode = "sit"; s.who.fs.t = 1.2; s.who.fs.who = null; } s.mode = "sit"; s.t = 1.2; s.who = null; } s.chk = 0; s.px = p.x; s.pz = p.z; }
      if(talkIdx === p.i || p.wait > 0){ p.wait -= dt; turnTo(p, player.x - p.x, player.z - p.z, dt); return [0, 0]; }
      let tx, tz, sp;
      if(dp > 5){ tx = player.x; tz = player.z; sp = Math.min(4.8, 2.2 + dp*.5); s.mode = "follow"; s.t = 0; }   // 跟上來
      else {
        s.t -= dt;
        if(s.t <= 0 && s.mode !== "flee"){
          const r = Math.random(), mates = others.filter(q => q.sleep < .5 && q.fs.mode !== "chase");
          s.mode = yarn && r < .38 ? "ball" : mates.length && r < .62 ? "chase" : r < .74 ? "zoom" : r < .88 ? "roam" : "sit";
          s.t = 3 + Math.random()*4; s.ang = Math.atan2(p.x - player.x, p.z - player.z); s.tx = null;
          if(s.mode === "chase"){ const q = mates[Math.floor(Math.random()*mates.length)]; s.who = q; q.fs.mode = "flee"; q.fs.who = p; q.fs.t = s.t; p.hop = .6; }
        }
        if(s.mode === "flee" && s.t <= 0){ s.mode = "sit"; s.t = 1.5; }
        if(s.mode === "ball"){ tx = yarn.x; tz = yarn.z; sp = 3.3;
          const d = Math.hypot(yarn.x - p.x, yarn.z - p.z);
          if(d < .32 + .25*p.s && yarn.y < p.y + .8){ const k = 2.6 + Math.random()*2.2, dx = (yarn.x - p.x)/(d || 1), dz = (yarn.z - p.z)/(d || 1), sd = (Math.random() - .5)*1.6;
            yarn.vx = dx*k + dz*sd; yarn.vz = dz*k - dx*sd; yarn.vy = 2 + Math.random()*1.5; yarn.spin = 8; p.hop = .6; p.pounce = .4; } }
        else if(s.mode === "chase"){ const q = s.who; if(!q || q.fs.who !== p){ s.t = 0; return [0, 0]; } tx = q.x; tz = q.z; sp = 3.5;
          if(!(s.cd > 0) && Math.hypot(q.x - p.x, q.z - p.z) < .62){ p.hop = q.hop = .6; p.love = q.love = 1.2; q.fs.mode = "chase"; q.fs.who = p; q.fs.t = 2.5 + Math.random()*2; q.fs.cd = 1.2; s.mode = "flee"; s.who = q; s.t = q.fs.t; } }   // 抓到了！換人當鬼（不叫，免得一直喵喵叫很吵）
        else if(s.mode === "flee"){ const q = s.who || player, ax = p.x - q.x, az = p.z - q.z, l = Math.hypot(ax, az) || 1;
          tx = p.x + ax/l*2; tz = p.z + az/l*2; if(Math.hypot(tx - player.x, tz - player.z) > 4.2){ const b = Math.atan2(p.x - player.x, p.z - player.z) + 1.2; tx = player.x + Math.sin(b)*3; tz = player.z + Math.cos(b)*3; } sp = 3.1; }
        else if(s.mode === "zoom"){ s.ang += dt*1.9; tx = player.x + Math.sin(s.ang)*2.3; tz = player.z + Math.cos(s.ang)*2.3; sp = 3.8; }
        else if(s.mode === "roam"){ if(s.tx == null){ const a = Math.random()*Math.PI*2, r = 1.2 + Math.random()*2.3; s.tx = player.x + Math.sin(a)*r; s.tz = player.z + Math.cos(a)*r; } tx = s.tx; tz = s.tz; sp = 1.5; }
        else { turnTo(p, player.x - p.x, player.z - p.z, dt, 4); return [0, 0]; }   // 坐下來看你
      }
      if(!okAt(tx, tz)){ s.t = 0; s.tx = null; return [0, 0]; }
      const dx = tx - p.x, dz = tz - p.z, l = Math.hypot(dx, dz);
      if(l < .3){ if(s.mode === "roam"){ s.mode = "sit"; s.t = 1.5 + Math.random()*2; } return [0, 0]; }
      if(!ground(p.x + dx/l*.5, p.z + dz/l*.5, p.y)){ s.t = 0; s.tx = null; return [0, 0]; }   // 前面是雲的邊邊：不跳下去
      if(s.mode === "follow" && l < 1.6) return [0, 0];
      turnTo(p, dx, dz, dt); return [dx/l*sp, dz/l*sp];
    }
    function tossBall(p){
      if(!yarn) return; const a = player.yaw; yarn.x = player.x + Math.sin(a)*.5; yarn.z = player.z + Math.cos(a)*.5; yarn.y = player.y + 1.1;
      const dx = p.x - player.x, dz = p.z - player.z, l = Math.hypot(dx, dz) || 1, k = 3.2 + Math.random();
      yarn.vx = dx/l*k + (Math.random() - .5); yarn.vz = dz/l*k + (Math.random() - .5); yarn.vy = 3.4; yarn.spin = 10;
      fams.forEach(q => { q.fs.mode = "ball"; q.fs.t = 4 + Math.random()*2; q.sleep = 0; q.wait = 0; q.hop = .6; });
      player.petT = .4; CFG.sound && o.sfx && o.sfx.tap && o.sfx.tap();
    }
    function ballStep(dt){
      const b = yarn, ox = b.x, oz = b.z;
      b.vy -= 15*dt; b.x += b.vx*dt; b.z += b.vz*dt; b.y += b.vy*dt;
      if(solid(b.x, b.y, b.z)){ if(solid(b.x, b.y, oz)){ b.x = ox; b.vx *= -.5; } if(solid(ox, b.y, b.z)){ b.z = oz; b.vz *= -.5; } if(solid(b.x, b.y, b.z)){ b.x = ox; b.z = oz; } }
      let gy = -99; for(let y = Math.floor(b.y + .5); y > Math.floor(b.y) - 3; y--) if(solid(b.x, y, b.z)){ gy = y + 1; break; }
      if(b.y - b.r < gy){ b.y = gy + b.r; b.vy = Math.abs(b.vy) > 1.2 ? -b.vy*.35 : 0; const f = Math.max(0, 1 - 2.4*dt); b.vx *= f; b.vz *= f; }
      const v = Math.hypot(b.vx, b.vz); b.roll += v*dt/b.r; if(v > .05) b.dir = Math.atan2(b.vx, b.vz);
      // 你走過去會踢到
      const pd = Math.hypot(b.x - player.x, b.z - player.z);
      if(pd < .45 && player.spd > .2 && b.y < player.y + .6){ const a = player.yaw; b.vx = Math.sin(a)*4.5; b.vz = Math.cos(a)*4.5; b.vy = 2.2; }
      if(b.y < -6 || pd > 22){ const a = player.yaw; b.x = player.x + Math.sin(a)*1.4; b.z = player.z + Math.cos(a)*1.4; b.y = player.y + 1.6; b.vx = b.vz = b.vy = 0; }   // 掉下雲或滾太遠：回到你前面
    }
    function drawBall(){
      const b = yarn, W0 = chain(T(b.x, b.y, b.z), RY(b.dir || 0), RX(b.roll || 0));
      bind(ball); gl.uniform1f(U("mode"), 2); box(chain(W0, S(.34, .34, .34)), "#f28db0"); gl.uniform1f(U("mode"), 1); bind(cube);   // 圓圓的毛線球
      box(chain(W0, S(.36, .035, .2)), "#d9688a"); box(chain(W0, RY(1.1), RX(.6), S(.2, .035, .36)), "#d9688a"); box(chain(W0, RX(1.3), S(.035, .2, .36)), "#e47ea0");
      const tl = chain(T(b.x, b.y - b.r + .02, b.z), RY((b.dir || 0) + Math.PI)); box(chain(tl, T(0, 0, .25), S(.03, .02, .4)), "#e07898");   // 拖在後面的毛線
    }
    // ---------- 飾品：在「我們的貓」幫牠戴的帽子、項圈、眼鏡，做成圓圓的 3D 小物件 ----------
    // 座標是貓頭的中心：x 左右（頭寬 .46）、y 上下（頭頂 .19）、z 前後（臉在 .18）；耳朵在 x ±.14、y .24～.34
    const ACC_C = { gold:"#ffcf4a", goldD:"#e0a92a", white:"#fffaf2", red:"#e5486a", dark:"#3a2a28", green:"#5cb87a", greenD:"#3f9a5c", pink:"#f7a7b8", yellow:"#ffe08a", brown:"#8a5a2e" };
    function drawAcc(M, sc, w, t){
      const pal = w.pal || {}, A = pal.A || "#f7a7b8", Bc = pal.B || shade(A, .75), C = ACC_C;
      const sph = (x,y,z, rx,ry,rz, col, r) => { bind(ball); gl.uniform1f(U("mode"), 2); gl.disable(gl.CULL_FACE); box(chain(M, T(x,y,z), r || I4(), S(rx*1.96, ry*1.96, rz*1.96)), col); gl.enable(gl.CULL_FACE); bind(cube); gl.uniform1f(U("mode"), 1); };
      const tb = (pts, rf, col) => tube(pts.map(p => mulPt(M, p)), u => rf(u)*sc, col, true);
      const line = (a, b, r0, r1, col, n = 6) => tb(Array.from({ length:n }, (_, k) => { const u = k/(n-1); return [a[0]+(b[0]-a[0])*u, a[1]+(b[1]-a[1])*u, a[2]+(b[2]-a[2])*u]; }), u => r0 + (r1 - r0)*u, col);
      const curve = (pts, r0, r1, col) => tb(smooth(pts, 6), u => r0 + (r1 - r0)*u, col);
      // 圓圈：plane "xz" 水平（帽圈、項圈），"xy" 直的（眼鏡框）
      const ring = (cx,cy,cz, rx,rz, th, col, plane = "xz", tilt = 0, n = 22) => tb(Array.from({ length:n+1 }, (_, k) => { const a = k/n*Math.PI*2, c = Math.cos(a)*rx, d = Math.sin(a)*rz;
        return plane === "xz" ? [cx + c, cy + d*Math.sin(tilt), cz + d*Math.cos(tilt)] : [cx + c, cy + d, cz]; }), () => th, col);
      const beads = (cx,cy,cz, rx,rz, r, n, cols, tilt = 0) => { for(let k = 0; k < n; k++){ const a = k/n*Math.PI*2; sph(cx + Math.cos(a)*rx, cy + Math.sin(a)*rz*Math.sin(tilt), cz + Math.sin(a)*rz*Math.cos(tilt), r, r, r, cols[k % cols.length]); } };
      const flower = (x,y,z, r, col, mid = C.yellow, face = "up") => { for(let k = 0; k < 5; k++){ const a = k/5*Math.PI*2, dx = Math.cos(a)*r*.9, dd = Math.sin(a)*r*.9;
        if(face === "up") sph(x + dx, y, z + dd, r*.62, r*.38, r*.62, col); else sph(x + dx, y + dd, z, r*.62, r*.62, r*.38, col); } sph(x, y + (face === "up" ? r*.15 : 0), z + (face === "up" ? 0 : r*.15), r*.45, r*.45, r*.45, mid); };
      const bowAt = (x,y,z, k, col, dk) => { sph(x - .065*k, y, z, .06*k, .045*k, .028*k, col, RZ(.25)); sph(x + .065*k, y, z, .06*k, .045*k, .028*k, col, RZ(-.25)); sph(x, y, z + .01*k, .028*k, .028*k, .028*k, dk); };
      const collar = (col, th = .024) => ring(0, -.17, -.01, .235, .215, th, col, "xz", -.25);
      const bellAt = (x,y,z, col = C.gold) => { sph(x, y, z, .05, .05, .05, col); line([x - .045, y - .006, z + .01], [x + .045, y - .006, z + .01], .006, .006, shade(col, .7), 3); sph(x, y - .025, z + .035, .012, .012, .012, C.dark); };
      const cone = (y0, r0, h, col, bend = 0, tx = 0) => curve([[tx, y0, 0], [tx + bend*.2, y0 + h*.4, -bend*.1], [tx + bend*.6, y0 + h*.75, -bend*.25], [tx + bend, y0 + h, -bend*.2]], r0, .008, col);
      const cyl = (x,y0,z, r, h, col) => line([x, y0, z], [x, y0 + h, z], r, r, col, 3);
      const bob = Math.sin(t*2.2)*.012;
      switch(w.base || w.id){
        // ---- 帽子 ----
        case "straw": sph(0, .205, 0, .33, .022, .31, pal.Y || "#f0cf7a"); sph(0, .26, 0, .16, .1, .15, pal.Y || "#f0cf7a"); ring(0, .23, 0, .158, .148, .02, C.red); break;
        case "crown": case "crown2": {   // 小小的皇冠，戴在兩個耳朵中間，裡面是紅色絨布墊
          const g = C.gold, gd = C.goldD, gem = w.base === "crown2" ? A : C.red, R0 = .1, y0 = .185, y1 = .265;
          line([0, y0, -.01], [0, y1, -.01], R0, R0, g, 3); ring(0, y0 + .006, -.01, R0 + .004, R0 + .004, .014, gd); ring(0, y1, -.01, R0, R0, .01, gd);
          sph(0, y1 - .005, -.01, .085, .055, .085, "#c43a5a");
          for(let k = 0; k < 5; k++){ const a = Math.PI/2 + (k - 2)*Math.PI*2/5, x = Math.cos(a)*R0, z = -.01 + Math.sin(a)*R0;
            line([x, y1 - .01, z], [x*1.08, y1 + .075, z*1.08 - .001], .03, .006, g, 5); sph(x*1.09, y1 + .085, z*1.09, .017, .017, .017, k === 2 ? gem : "#fff3b0"); }
          sph(0, (y0 + y1)/2, R0 - .006, .024, .024, .012, gem); for(const sx of [-1, 1]) sph(sx*.062, (y0 + y1)/2, .07, .015, .015, .009, w.base === "crown2" ? "#ffffff" : "#6fb7e8");
          break; }
        case "wizard": { const v = pal.V || "#9b6fd6"; sph(0, .2, 0, .3, .022, .28, v); cone(.2, .16, .38, v, .12); sph(.05, .33, .12, .03, .03, .015, C.yellow); sph(.12, .5, -.02, .025, .025, .025, C.yellow); break; }
        case "phones": { const k = pal.K || "#f0708d"; curve([[-.25, .02, 0], [-.22, .2, 0], [0, .29, 0], [.22, .2, 0], [.25, .02, 0]], .022, .022, shade(k, .85)); for(const sx of [-1, 1]){ sph(sx*.255, .02, 0, .045, .085, .08, k); sph(sx*.27, .02, 0, .035, .065, .062, shade(k, .7)); } break; }
        case "santa": { cone(.21, .17, .3, C.red, .22); ring(0, .2, 0, .19, .175, .045, C.white); sph(.22, .5, -.05, .05, .05, .05, C.white); break; }
        case "wreath": { ring(0, .2, 0, .18, .165, .025, C.green); const cs = ["#f7a7b8", "#ffe08a", "#ffffff", "#cdb4f0", "#f28b82"];
          for(let k = 0; k < 8; k++){ const a = k/8*Math.PI*2; flower(Math.cos(a)*.18, .215, Math.sin(a)*.165, .04, cs[k % cs.length]); } break; }
        case "beret": sph(.03, .225, -.01, .25, .07, .22, A, RZ(.18)); sph(.06, .29, -.01, .018, .03, .018, Bc); break;
        case "beanie": sph(0, .19, -.01, .25, .19, .22, A); ring(0, .145, -.01, .245, .225, .032, Bc); sph(0, .36, -.02, .055, .055, .055, C.white); break;
        case "clip": bowAt(.17, .21, .06, 1, A, Bc); break;
        case "flowerclip": flower(.17, .2, .08, .055, A, C.yellow, "front"); break;
        case "party": { const x = .05; cone(.18, .11, .3, A, .03, x); ring(x, .23, 0, .085, .085, .014, C.white); ring(x + .01, .3, -.005, .055, .055, .012, C.white); sph(x + .035, .49, -.006, .035, .035, .035, C.yellow); break; }
        case "bunny": for(const sx of [-1, 1]){ const r = RZ(-sx*.12); sph(sx*.1, .38, -.02, .055, .16, .035, A, r); sph(sx*.1, .38, .002, .03, .12, .02, "#ffb3c6", r); } curve([[-.21, .12, 0], [-.14, .21, 0], [0, .24, 0], [.14, .21, 0], [.21, .12, 0]], .016, .016, A); break;
        case "tophat": { sph(0, .205, 0, .27, .02, .25, A); cyl(0, .21, 0, .13, .2, A); sph(0, .41, 0, .13, .012, .13, A); ring(0, .245, 0, .133, .133, .026, Bc); break; }
        case "frog": { sph(0, .19, -.01, .25, .17, .23, A); ring(0, .13, -.01, .245, .225, .026, Bc); for(const sx of [-1, 1]){ sph(sx*.1, .33, .06, .065, .065, .06, A); sph(sx*.1, .34, .105, .045, .045, .03, C.white); sph(sx*.1, .34, .13, .022, .026, .01, C.dark); } sph(0, .29, .175, .06, .012, .02, "#ff8fa8"); break; }
        case "antler": { const b = "#a0703f"; for(const sx of [-1, 1]){ curve([[sx*.09, .18, -.02], [sx*.13, .3, -.03], [sx*.2, .42, -.05], [sx*.24, .5, -.06]], .024, .012, b); curve([[sx*.15, .34, -.035], [sx*.1, .43, -.03], [sx*.09, .48, -.03]], .016, .009, b); curve([[sx*.19, .41, -.05], [sx*.28, .44, -.05]], .013, .008, b); } break; }
        case "halo": ring(0, .42 + bob, -.02, .15, .13, .022, C.gold); ring(0, .42 + bob, -.02, .15, .13, .01, "#fff3b0"); break;
        case "horns": { const k = pal.K || "#c9372c"; for(const sx of [-1, 1]) curve([[sx*.09, .17, .02], [sx*.13, .26, .03], [sx*.13, .33, .0], [sx*.1, .37, -.03]], .04, .006, k); break; }
        case "chef": { cyl(0, .19, 0, .14, .1, C.white); sph(0, .34, 0, .2, .12, .18, C.white); sph(-.1, .33, .04, .1, .1, .1, C.white); sph(.1, .33, .04, .1, .1, .1, C.white); sph(0, .36, -.06, .11, .1, .1, C.white); break; }
        case "sailor": { const b = pal.B || "#2f437d"; cyl(0, .19, 0, .16, .07, C.white); ring(0, .21, 0, .165, .165, .025, b); sph(0, .27, 0, .2, .04, .19, C.white); sph(0, .29, 0, .05, .02, .05, b); break; }
        case "rainhat": { const y = pal.Y || "#ffd36b"; sph(0, .18, -.02, .24, .17, .22, y); sph(0, .15, .03, .32, .025, .3, y, RX(-.18)); break; }
        case "pumpkinhat": { const o = pal.A || "#f29a3c"; for(let k = 0; k < 6; k++){ const a = k/6*Math.PI*2; sph(Math.cos(a)*.08, .2, Math.sin(a)*.07, .13, .13, .12, k % 2 ? o : shade(o, .9)); } sph(0, .22, 0, .14, .15, .13, o); curve([[0, .34, 0], [.02, .39, 0], [.05, .41, 0]], .022, .015, C.greenD); sph(-.06, .36, .02, .05, .012, .03, C.green, RZ(.4)); break; }
        case "sprout": { curve([[0, .18, .02], [0, .25, .02], [.01, .3, .02]], .012, .01, C.greenD); sph(-.05, .31, .02, .055, .02, .03, C.green, RZ(.35)); sph(.06, .32, .02, .055, .02, .03, C.green, RZ(-.35)); break; }
        case "cherry": { for(const [dx, dz] of [[-.03, 0], [.04, .02]]){ curve([[.17 + dx*.3, .3, .04], [.17 + dx, .25, .05 + dz]], .007, .007, C.greenD); sph(.17 + dx, .22, .06 + dz, .04, .04, .04, "#d93a4e"); sph(.165 + dx, .235, .09 + dz, .01, .01, .006, C.white); } sph(.19, .3, .04, .03, .01, .018, C.green, RZ(.4)); break; }
        // ---- 脖子 ----
        case "bow": bowAt(0, -.22, .16, 1.1, pal.K || C.red, shade(pal.K || C.red, .75)); break;
        case "bell": case "bell2": { const c = w.base === "bell2" ? A : (pal.R || C.red); collar(c); bellAt(0, -.27, .17); break; }
        case "scarf": case "scarf2": { const c = w.base === "scarf2" ? A : (pal.B || "#6fb7e8"); collar(c, .048); sph(.1, -.31, .15, .055, .1, .025, c, RZ(.15)); sph(.1, -.39, .15, .056, .02, .026, w.base === "scarf2" ? Bc : C.white, RZ(.15)); break; }
        case "pearls": beads(0, -.17, -.01, .225, .205, .024, 20, ["#fffaf2", "#f4eee6"], -.25); break;
        case "tie": { collar(Bc, .012); sph(0, -.22, .17, .03, .03, .02, A); curve([[0, -.24, .17], [0, -.3, .175], [0, -.36, .17], [0, -.4, .16]], .028, .045, A); break; }
        case "bowtie": collar(shade(A, .6), .012); bowAt(0, -.22, .165, 1, A, Bc); break;
        case "heartN": case "starN": { collar(w.base === "starN" ? C.gold : "#e6c46a", .01); const c = w.base === "starN" ? C.yellow : A;
          if(w.base === "starN"){ for(let k = 0; k < 5; k++){ const a = -Math.PI/2 + k/5*Math.PI*2; sph(Math.cos(a)*.022, -.27 - Math.sin(a)*.022, .18, .022, .012, .012, c, RZ(a)); } sph(0, -.27, .18, .02, .02, .014, c); }
          else { sph(-.017, -.26, .18, .024, .024, .016, c); sph(.017, -.26, .18, .024, .024, .016, c); sph(0, -.285, .18, .025, .025, .014, c, RZ(Math.PI/4)); } break; }
        case "bib": { sph(0, -.24, .15, .17, .1, .035, C.white, RX(-.2)); ring(0, -.24, .15, .17, .1, .012, "#f7a7b8", "xy"); sph(0, -.23, .185, .03, .025, .01, "#f7a7b8"); break; }
        case "lei": { const cs = ["#f7a7b8", "#ffe08a", "#ffffff", "#f28b82", "#cdb4f0"]; for(let k = 0; k < 12; k++){ const a = k/12*Math.PI*2, z = Math.sin(a)*.205; flower(Math.cos(a)*.225, -.17 + Math.sin(a)*.205*Math.sin(-.25), -.01 + z*Math.cos(-.25), .045, cs[k % cs.length]); } break; }
        // ---- 臉 ----
        case "glasses": case "cglass": case "monocle": case "glass3d": case "shades": {
          const fr = w.base === "cglass" ? A : w.base === "monocle" ? C.gold : w.base === "glass3d" ? C.white : C.dark, z = .205, y = .035;
          const eyes = w.base === "monocle" ? [.11] : [-.11, .11];
          eyes.forEach((x, k) => { ring(x, y, z, .068, .062, .012, fr, "xy");
            const lens = w.base === "shades" ? "#2b2430" : w.base === "glass3d" ? (k ? "#6fb7e8" : "#e5486a") : null;
            if(lens) sph(x, y, z - .004, .066, .06, .006, lens); else { gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); bind(ball); gl.uniform1f(U("mode"), 2); box(chain(M, T(x, y, z), S(.13, .12, .012)), pal.S || "#dff2ff", .35); bind(cube); gl.uniform1f(U("mode"), 1); gl.disable(gl.BLEND); }
            sph(x - .028, y + .025, z + .006, .012, .008, .003, "#ffffff"); });
          if(eyes.length > 1){ curve([[-.045, y + .01, z], [0, y + .025, z + .01], [.045, y + .01, z]], .009, .009, fr); for(const sx of [-1, 1]) line([sx*.178, y + .01, z - .01], [sx*.235, y + .03, -.05], .009, .009, fr, 3); }
          else curve([[.11, y - .06, z + .005], [.14, -.08, .19], [.17, -.16, .14]], .005, .005, C.goldD);
          break; }
        case "blush": for(const sx of [-1, 1]) sph(sx*.16, -.075, .188, .055, .035, .008, pal.K || "#ff8fa8"); break;
        case "star_eye": for(const sx of [-1, 1]){ const x = sx*.17; for(let k = 0; k < 5; k++){ const a = -Math.PI/2 + k/5*Math.PI*2; sph(x + Math.cos(a)*.03, -.06 - Math.sin(a)*.03, .19, .03, .016, .006, C.yellow, RZ(a)); } sph(x, -.06, .192, .024, .024, .006, C.yellow); } break;
      }
    }
    function drawCat(e, t){
      const k = e.col, s = e.s, sw = Math.sin(e.walk*10)*.5*Math.min(1, e.spd || 0), hop = e.hop ? Math.sin((.6 - e.hop)/.6*Math.PI)*.35 : 0;
      const sl = e.sleep || 0, W0 = chain(T(e.x, e.y + hop - sl*.12*s, e.z), RY(e.yaw), S(s, s, s));
      const at = (x,y,z, sx,sy,sz, col, r) => box(chain(W0, r || I4(), T(x,y,z), S(sx,sy,sz)), col);
      const wk = e.spd || 0, ph = e.walk*10;
      at(0,.33,0, .42,.3,.74, k.b);                                  // 身體（矮矮長長）
      at(0,.2,0, .34,.05,.56, k.l);                                   // 肚子
      if(k === CAT.calico){ at(.1,.485,.08, .24,.03,.3, "#3a3540"); at(-.1,.485,-.16, .24,.03,.26, "#f2a65a"); }
      else { at(0,.485,.08, .3,.02,.06, k.d); at(0,.485,-.1, .3,.02,.06, k.d); }   // 背上的條紋
      const hd = chain(T(0,.56 - sl*.1,.36), RX(sl > .5 ? .25 : Math.sin(t*1.7 + e.x)*.06));   // 睡覺時頭低低的
      at(0,0,0, .46,.38,.36, k.b, hd);                                // 頭
      at(0,-.1,.16, .26,.14,.08, k.l, hd);                            // 嘴邊白白的
      for(const sx of [-1, 1]){
        at(sx*.14,.24,-.02, .12,.12,.08, k.b, hd); at(sx*.14,.31,-.02, .06,.06,.06, k.b, hd);    // 尖尖的耳朵
        at(sx*.14,.25,.025, .06,.07,.02, "#ffb3c6", hd);                                        // 耳朵裡面
        if(sl > .5) at(sx*.11,.0,.185, .09,.02,.02, "#2b2430", hd); else { at(sx*.11,.03,.185, .08,.1,.02, "#2b2430", hd); at(sx*.09,.06,.196, .03,.03,.01, "#ffffff", hd); }   // 眼睛＋亮點（睡著是一條線）
        for(const wy of [-.08,-.12]) at(sx*.21,wy,.18, .14,.012,.012, "#ffffff", hd);             // 鬍鬚
      }
      at(0,-.05,.205, .06,.04,.02, "#ff8fa8", hd);                    // 鼻子
      if(e.v && e.v.wear && e.v.wear.length){ const HM = chain(W0, hd); e.v.wear.forEach(w => drawAcc(HM, s, w, t)); }   // 在小窩幫牠戴的飾品（圓圓的 3D 小物件）
      for(const [lx, lz, p0] of [[-.13,.24,0],[.13,.24,Math.PI],[-.13,-.24,Math.PI],[.13,-.24,0]])
        at(lx, .1 + Math.max(0, Math.sin(ph+p0))*.05*wk, lz + Math.sin(ph+p0)*.07*wk, .11,.2,.11, k.b);   // 腳
      for(const [lx, lz] of [[-.13,.24],[.13,.24]]) at(lx, .015, lz + .02, .12,.03,.12, k.l);            // 白襪子
      const tw = Math.sin(t*2.4 + e.x)*.25;                                                                // 尾巴往上翹、會搖
      at(0,0,-.17, .08,.08,.34, k.d, chain(T(0,.44,-.34), RY(tw), RX(.8)));
      at(0,0,-.36, .085,.085,.08, k.l, chain(T(0,.44,-.34), RY(tw), RX(.8)));
      void sw;
    }
    // 從 a 到 b 的方塊（給尾巴、頭髮一節一節畫）
    function segBox(a, b, r, col){ const d = sub(b, a), L = Math.hypot(...d) || 1e-6, y = d.map(v => v/L); let x = nrm(cross(Math.abs(y[1]) < .95 ? [0,1,0] : [1,0,0], y)); const z = cross(x, y);
      box([x[0]*r,x[1]*r,x[2]*r,0, y[0]*(L+.02),y[1]*(L+.02),y[2]*(L+.02),0, z[0]*r,z[1]*r,z[2]*r,0, (a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2,1], col); }
    // 一節方塊（尾巴用）：方向跟著身體的左右，不會亂轉；長度多一點點，接頭重疊不會有縫
    function blockSeg(a, b, r, col, side){ const d = sub(b, a), L = Math.hypot(...d) || 1e-6, y = d.map(v => v/L); const z = nrm(cross(side, y)), x = cross(y, z), Lx = L + r*.9;
      box([x[0]*r,x[1]*r,x[2]*r,0, y[0]*Lx,y[1]*Lx,y[2]*Lx,0, z[0]*r,z[1]*r,z[2]*r,0, (a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2,1], col); }
    // 會晃的繩子（尾巴、雙馬尾）：一節一節的點，用慣性＋重力＋「想回到原本形狀」的力，走路、轉身、跳起來都會晃
    const toW = (e, lx, ly, lz) => { const c = Math.cos(e.yaw), s = Math.sin(e.yaw); return [e.x + lx*c + lz*s, e.y + ly, e.z - lx*s + lz*c]; };
    function rope(e, key, n, len, base, dirs, stiff, dt){
      const R = e[key] || (e[key] = { p: [], o: [] }), b = toW(e, ...base);
      if(R.p.length !== n){ R.p = []; let q = b; for(let i = 0; i < n; i++){ R.p.push(q.slice()); const d = toW({ x:0,y:0,z:0,yaw:e.yaw }, ...dirs(i)); q = [q[0]+d[0]*len, q[1]+d[1]*len, q[2]+d[2]*len]; } R.o = R.p.map(v => v.slice()); }
      const k = Math.min(1, dt*60);
      R.p[0] = b; R.o[0] = b.slice();
      for(let i = 1; i < n; i++){
        const p = R.p[i], o = R.o[i], v = [(p[0]-o[0])*.9, (p[1]-o[1])*.9, (p[2]-o[2])*.9];
        R.o[i] = p.slice(); p[0] += v[0]; p[1] += v[1] - 7*dt*dt; p[2] += v[2];
        const prev = R.p[i-1], dl = toW({ x:0,y:0,z:0,yaw:e.yaw }, ...dirs(i-1)), tg = [prev[0]+dl[0]*len, prev[1]+dl[1]*len, prev[2]+dl[2]*len];
        for(let j = 0; j < 3; j++) p[j] += (tg[j] - p[j])*stiff*k;
        const d = sub(p, prev), l = Math.hypot(...d) || 1e-6; for(let j = 0; j < 3; j++) p[j] = prev[j] + d[j]/l*len;
      }
      return R.p;
    }
    // 固定形狀的一串點（不跟著物理晃，跟著身體轉）
    function fixedChain(e, n, len, base, dirs){ let q = toW(e, ...base); const out = [q]; for(let i = 0; i < n-1; i++){ const d0 = dirs(i), l0 = Math.hypot(...d0) || 1, d = toW({ x:0,y:0,z:0,yaw:e.yaw }, d0[0]/l0, d0[1]/l0, d0[2]/l0); q = [q[0]+d[0]*len, q[1]+d[1]*len, q[2]+d[2]*len]; out.push(q); } return out; }
    // 穿貓咪睡衣的方塊人（大概 1.45 格高）
    function drawKid(e, t){
      const a = e.av, wk = e.spd || 0, ph = e.walk*9, sw = Math.sin(ph)*.6*wk, hop = e.onG ? 0 : .04;
      const W0 = chain(T(e.x, e.y + (e.visY || 0) + hop + Math.abs(Math.sin(ph))*.05*wk, e.z), RY(e.yaw), RX(.1*wk), RZ(Math.sin(ph)*.035*wk));   // 走路時身體微微往前傾、左右晃
      const at = (x,y,z, sx,sy,sz, col, r) => box(chain(W0, r || I4(), T(x,y,z), S(sx,sy,sz)), col);
      // 腳（前後擺）＋白色腳掌
      for(const [lx, k] of [[-.12, 1], [.12, -1]]){ const r = chain(T(0,.46,0), RX(sw*k)); at(lx,-.23,0, .2,.44,.22, a.pj, r); at(lx,-.43,.02, .21,.06,.24, a.lt, r); }
      // 身體＋肚子＋花紋
      at(0,.74,0, .52,.56,.32, a.pj); at(0,.72,.162, .32,.4,.01, a.lt);
      if(a.mark === "stripe"){ at(0,.86,-.162, .4,.05,.01, a.dk); at(0,.72,-.162, .4,.05,.01, a.dk); at(-.262,.8,0, .01,.05,.24, a.dk); at(.262,.8,0, .01,.05,.24, a.dk); }
      if(a.mark === "calico"){ at(.14,.86,-.162, .22,.2,.01, a.dk); at(-.12,.66,-.162, .22,.16,.01, a.dk2); at(-.262,.82,.02, .01,.18,.2, a.dk2);
        at(.2,.9,.162, .12,.14,.01, a.dk2); at(-.2,.58,.162, .1,.12,.01, a.dk); at(.262,.66,.04, .01,.14,.16, a.dk); }
      // 手（反方向擺）＋手掌；摸摸時右手往前伸
      for(const [ax, k] of [[-.34, -1], [.34, 1]]){ const reach = k > 0 && e.petT > 0 ? Math.sin(e.petT/.5*Math.PI)*1.3 : 0, r = chain(T(0,.98,0), RX(sw*k*.9*(reach ? 0 : 1) - reach)); at(ax,-.2,0, .16,.46,.18, a.pj, r); at(ax,-.42,0, .17,.07,.19, a.lt, r); }
      // 尾巴
      // 方塊貓尾巴：一格一格的方塊接起來（接頭互相重疊，不會有縫），會跟著走路彈、轉身甩、站著慢慢搖
      { const dt = e._dt || .016, dyaw = Math.atan2(Math.sin(e.yaw - (e._ty ?? e.yaw)), Math.cos(e.yaw - (e._ty ?? e.yaw))); e._ty = e.yaw;
        const want = Math.max(-.9, Math.min(.9, -dyaw/Math.max(dt, .001)*.09)) + Math.sin(t*1.7)*.22 + Math.sin(e.walk*10)*.1*(e.spd || 0);
        e._tv = ((e._tv || 0) + (want - (e._tw || 0))*60*dt)*Math.pow(.02, dt); e._tw = (e._tw || 0) + e._tv*dt;
        const TS = TAILS[o.tail || 4], lift = (e.spd || 0)*.06 + (e.onG ? 0 : .08);
        const pts = TS.c.map(([x, y, z], i) => { const u = i/(TS.c.length-1), sw = e._tw*Math.pow(u, 1.2)*.5; return toW(e, x + sw, y + lift*u, z - Math.abs(sw)*.2*u); });
        const sm = smooth(pts, 8), n = TS.n, q = []; for(let k = 0; k <= n; k++) q.push(sm[Math.round(k/n*(sm.length-1))]);
        const side = [Math.cos(e.yaw), 0, -Math.sin(e.yaw)];
        const base = a.mark === "calico" ? a.dk : a.pj, ring = a.mark === "stripe" ? a.dk : base;   // 尾巴跟睡衣同色（三花是黑尾巴）
        for(let k = 0; k < n; k++){ const r = TS.r(k/(n-1)), col = k === n-1 ? a.lt : (a.mark === "stripe" && k % 2 === 1 ? ring : base);
          blockSeg(q[k], q[k+1], r, col, side); } }
      // 頭：臉、頭髮、貓耳帽子
      const hd = chain(T(0,1.27,0));   // 頭不搖（頭髮是另外畫的，要對齊）
      at(0,0,0, .48,.46,.46, a.skin, hd);
      // 頭髮（方塊瀏海，貼在臉的前面）
      const Hc = a.hair, F = (x,y,w,h) => at(x,y,.236, w,h,.012, Hc, hd);
      if(a.hs === "short"){ F(0,.17,.48,.12); F(-.2,.06,.08,.14); F(.2,.06,.08,.14); }
      if(a.hs === "bangs"){ F(0,.15,.48,.16); F(-.21,.0,.06,.2); F(.21,.0,.06,.2); }
      if(a.hs === "side"){ F(0,.18,.48,.1); F(.06,.11,.36,.06); F(.19,.06,.1,.06); F(-.21,.06,.06,.14); }
      if(a.hs === "middle"){ F(-.13,.17,.22,.12); F(.13,.17,.22,.12); F(-.19,.06,.1,.12); F(.19,.06,.1,.12); F(-.21,-.06,.06,.12); F(.21,-.06,.06,.12); }
      if(a.hs === "long"){ F(0,.17,.48,.12); for(const sx of [-1, 1]) at(sx*.19,-.36,.255, .1,.5,.04, Hc, hd); at(0,-.32,-.25, .46,.5,.04, Hc, hd); }
      if(a.hs === "twin"){ F(0,.17,.48,.12); F(-.2,.06,.08,.14); F(.2,.06,.08,.14);
        // 雙馬尾：從帽子兩側往外鼓、往下彎、髮尾往內勾，用一撮一撮的髮絲畫（固定的，不會甩）
        const bend = [[.55,-.25],[.35,-.75],[.18,-1],[.06,-1],[0,-1],[-.05,-1],[-.1,-1],[-.16,-1],[-.24,-.95],[-.32,-.85]];
        for(const sx of [-1, 1]){ const pts = fixedChain(e, 11, .08, [sx*.27,1.42,-.08], i => { const q = bend[Math.min(i, bend.length-1)]; return [sx*q[0], q[1], -.12]; });
          hairBundle(pts, Hc, sx, .05);
          bind(ball); gl.uniform1f(U("mode"), 2); box(chain(T(...toW(e, sx*.285, 1.42, -.08)), S(.13,.13,.13)), "#ff8fb3"); gl.uniform1f(U("mode"), 1); bind(cube); } }
      if(a.hs === "ahoge"){ F(0,.17,.48,.12); F(-.2,.06,.08,.14); F(.2,.06,.08,.14); at(.02,.3,.1, .03,.1,.03, Hc, hd); at(.05,.36,.12, .03,.04,.06, Hc, hd); }
      if(a.hs === "curly"){ F(0,.18,.48,.1); for(let x = -.18; x <= .19; x += .09) F(x,.1,.07,.06); F(-.21,.02,.06,.16); F(.21,.02,.06,.16); }
      for(const sx of [-1, 1]){ at(sx*.11,-.01,.236, .07,.1,.01, "#2b2430", hd); at(sx*.09,.02,.237, .025,.03,.01, "#ffffff", hd); at(sx*.17,-.1,.236, .07,.04,.01, "#ffb3c6", hd); }
      at(0,-.13,.236, .08,.025,.01, "#c0606e", hd);
      at(0,.27,0, .56,.1,.56, a.pj, hd); at(0,0,-.255, .56,.56,.06, a.pj, hd); at(-.265,0,0, .06,.56,.56, a.pj, hd); at(.265,0,0, .06,.56,.56, a.pj, hd);   // 帽子
      at(0,-.25,.13, .56,.08,.3, a.pj, hd);                                                                   // 帽子下緣（下巴那圈）
      if(a.mark === "stripe") at(0,.325,0, .3,.01,.56, a.dk, hd);
      if(a.mark === "calico"){ at(-.16,.325,-.05, .22,.01,.3, a.dk2, hd); at(.17,.325,.1, .18,.01,.22, a.dk, hd); at(-.2,.12,.236, .1,.12,.01, a.dk2, hd); at(.2,.2,.236, .1,.08,.01, a.dk, hd); }
      for(const sx of [-1, 1]){ at(sx*.17,.38,-.02, .14,.16,.1, a.pj, hd); at(sx*.17,.37,.035, .08,.1,.01, a.ear, hd); }   // 貓耳朵
    }
    function project(x,y,z, V, P){ const v = mul(P, mul(V, T(x,y,z))); const w = v[15]; if(w <= 0) return null; return [(v[12]/w*.5+.5)*root.clientWidth, (1 - (v[13]/w*.5+.5))*root.clientHeight, w]; }

    // 雲：下面一整片雲海、旁邊和上面幾朵慢慢飄（只是裝飾，不能踩）
    const CLOUDS = (() => { const q = rng(99), out = [];
      const puff = (n, R, H0) => Array.from({ length: n }, () => { const sx = R*(.5 + q()*.7), sz = R*(.5 + q()*.7); return [(q()-.5)*R*1.4, (q()-.3)*H0, (q()-.5)*R*1.2, sx, H0*(.7 + q()*.6), sz]; });
      for(let k = 0; k < 30; k++) out.push({ x: q()*140, y: -3 - q()*4, z: -30 + q()*116, v: .25 + q()*.25, a: .95, parts: puff(4, 9 + q()*8, 3) });
      for(let k = 0; k < 9; k++) out.push({ x: q()*140, y: 24 + q()*10, z: -20 + q()*96, v: .5 + q()*.5, a: .8, parts: puff(3, 4 + q()*4, 1.6) });
      return out; })();
    const PETALS = Array.from({ length: 34 }, (_, k) => ({ x: world.spawn[0] + (Math.random() - .5)*20, y: world.spawn[1] + Math.random()*8, z: world.spawn[2] + (Math.random() - .5)*20, r: Math.random()*6, w: .6 + Math.random()*1.4, p: Math.random()*6, c: k % 3 ? "#f9c4d2" : "#ffe3ea" }));
    // ---------- 樹葉的 20 種樣子 ----------
    const LEAF_STYLE = 0, TREE_STYLE = -1;   // TREE_STYLE：整棵樹的造型（-1 = 還沒選，照舊一格一顆毛球）
    function drawLeaf(st, x, y, z, b, top, t, puff){
      const h = ((x*73856093) ^ (y*19349663) ^ (z*83492791)) >>> 0, k = (h % 7)/7, sw = Math.sin(t*1.2 + x*.7 + z*.5)*.03, sak = b === B.SAKURA;
      const cx = x + .5 + sw, cy = y + .5, cz = z + .5, P3 = (c3) => c3[h % c3.length];
      const G = sak ? ["#f7bccb", "#f9c9d5", "#f4adc0"] : ["#a4d49a", "#b0dca6", "#98cc90"], HL = sak ? "#fde4ea" : "#c8ecbc";
      const S3 = (dx, dy, dz, sx, sy, sz, c, r) => puff(chain(T(cx + dx, cy + dy, cz + dz), r || I4(), S(sx, sy, sz)), c);
      const pick = (green, pink) => sak ? pink : green;
      switch(st){
        case 0: S3(0, 0, 0, 1.34 + k*.12, 1.22 + k*.1, 1.34 + k*.12, P3(G)); if(top) S3(-.12, .45, -.1, .62, .5, .62, HL); break;   // 圓毛球
        case 1: for(const [dx, dz, s0] of [[-.22, -.15, .85], [.24, -.1, .8], [0, .22, .82]]) S3(dx, .05 + s0*.05, dz, s0, s0*.9, s0, P3(G)); if(top) S3(0, .45, 0, .6, .5, .6, HL); break;   // 雲朵三球
        case 2: { const c = pick(["#9fd69a", "#8fcf8c", "#aadca2"], ["#f7b6c8", "#f9c2d2", "#f4a8bc"])[h % 3]; S3(-.17, .12, 0, .72, .72, .55, c); S3(.17, .12, 0, .72, .72, .55, c); S3(0, -.15, 0, .6, .7, .5, c, RZ(Math.PI/4)); break; }   // 愛心葉
        case 3: S3(0, 0, 0, 1.12, 1.12, 1.12, P3(G)); for(const [a, c2] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) S3(a*.3, .3, c2*.3, .6, .6, .6, P3(G)); break;   // 軟軟方圓
        case 4: for(let i = 0; i < 4; i++){ const a = h + i*1.7; S3(Math.cos(a)*.22, -.25 + i*.17, Math.sin(a)*.22, .95 - i*.12, .22, .95 - i*.12, i % 2 ? P3(G) : HL, RY(a)); } break;   // 花瓣層層
        case 5: { const c = pick("#7fbf86", "#f2a8bc"); if(top){ tube([[cx, cy - .5, cz], [cx, cy + .7, cz]], u => .62*(1 - u) + .01, c, true); } else S3(0, 0, 0, 1.3, 1.2, 1.3, c); break; }   // 尖尖松樹
        case 6: for(let i = 0; i < 3; i++) S3(0, -.32 + i*.32, 0, 1.4 - i*.32, .38, 1.4 - i*.32, i === 2 ? HL : P3(G)); break;   // 疊疊盤子
        case 7: S3(0, 0, 0, 1.32, 1.2, 1.32, sak ? P3(G) : ["#f2a65a", "#ec8a5a", "#f6c06a"][h % 3]); if(top) S3(-.12, .45, -.1, .6, .48, .6, sak ? HL : "#ffd9a0"); break;   // 秋天楓紅
        case 8: S3(0, 0, 0, 1.28, 1.2, 1.28, P3(G)); S3(-.25, .28, .3, .22, .18, .1, "#ffffff"); break;   // 糖果亮亮
        case 9: for(let i = 0; i < 6; i++){ const a = h*.3 + i*1.05, e = (i % 3 - 1)*.25; S3(Math.cos(a)*.3, e, Math.sin(a)*.3, .55, .1, .32, i % 2 ? P3(G) : HL, chain(RY(a), RZ(.5 + e))); } S3(0, 0, 0, .8, .8, .8, P3(G)); break;   // 葉片翻飛
        case 10: S3(0, -.1, 0, 1.15, 1.05, 1.15, P3(G)); if(top) tube([[cx, cy + .2, cz], [cx + .05, cy + .65, cz], [cx + .12, cy + .9, cz]], u => .38*(1 - u) + .02, P3(G), true); break;   // 水滴
        case 11: for(const [dx, dy, dz] of [[-.25, -.2, -.25], [.25, -.2, .2], [-.2, .2, .25], [.25, .22, -.2], [0, 0, 0]]) S3(dx, dy, dz, .58, .58, .58, P3(G)); break;   // 小球串
        case 12: gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); puff(chain(T(cx, cy, cz), S(1.38, 1.28, 1.38)), P3(G), .72); S3(0, 0, 0, .7, .7, .7, HL); gl.disable(gl.BLEND); break;   // 薄荷霧
        case 13: S3(0, 0, 0, 1.3, 1.2, 1.3, P3(G)); for(let i = 0; i < 4; i++){ const a = h + i*1.6, e = .25 + (i % 2)*.25; S3(Math.cos(a)*.62, e, Math.sin(a)*.62, .16, .1, .16, ["#ffffff", "#ffe08a", "#f7a7b8", "#cdb4f0"][i]); } break;   // 開花樹
        case 14: S3(0, 0, 0, 1.3, 1.2, 1.3, P3(G)); for(let i = 0; i < 3; i++){ const a = h + i*2.1; S3(Math.cos(a)*.6, -.1 + i*.15, Math.sin(a)*.6, .17, .17, .17, sak ? "#ffffff" : "#ef5a6a"); } break;   // 結果子
        case 15: S3(0, .1, 0, 1.25, 1, 1.25, P3(G)); if(!world.get(x, y-1, z)) for(let i = 0; i < 4; i++){ const a = h + i*1.57; for(let j = 0; j < 3; j++) S3(Math.cos(a)*.35, -.45 - j*.18, Math.sin(a)*.35, .18 - j*.03, .2, .18 - j*.03, ["#c9a6e8", "#b892e0", "#dcc0f2"][j]); } break;   // 紫藤垂垂
        case 16: S3(0, .15, 0, 1.2, .9, 1.2, P3(G)); if(!world.get(x, y-1, z)) for(let i = 0; i < 5; i++){ const a = h + i*1.25, rx = Math.cos(a)*.45, rz = Math.sin(a)*.45, sw2 = Math.sin(t*1.5 + i)*.05; tube([[cx + rx, cy - .2, cz + rz], [cx + rx + sw2, cy - .7, cz + rz], [cx + rx + sw2*2, cy - 1.15, cz + rz]], () => .035, P3(G), false); } break;   // 柳條垂垂
        case 17: S3(0, 0, 0, 1.45, .8, 1.45, P3(G)); if(top) S3(0, .32, 0, 1.05, .45, 1.05, HL); break;   // 修剪盆栽
        case 18: S3(0, 0, 0, 1.3, 1.2, 1.3, P3(G)); for(let i = 0; i < 3; i++){ const a = t*.8 + h + i*2.1; S3(Math.cos(a)*.75, .2 + Math.sin(t*2 + i)*.15, Math.sin(a)*.75, .07, .07, .07, "#fff3a0"); } break;   // 螢火點點
        case 19: { const c = sak ? P3(G) : ["#f6d35a", "#f2c84a", "#f8dc72"][h % 3]; for(let i = 0; i < 5; i++){ const a = h + i*1.26; S3(Math.cos(a)*.3, (i % 2)*.2 - .1, Math.sin(a)*.3, .7, .22, .55, c, chain(RY(a), RX(.5))); } S3(0, 0, 0, .9, .85, .9, c); break; }   // 銀杏黃扇
      }
    }
    // ---------- 整棵樹的 20 種可愛造型（drawTree） ----------
    function drawTree(st, tr, t, puff){
      const sak = tr.b === B.SAKURA, R = Math.max(tr.w, tr.d)/2 + .25, Hh = tr.h/2 + .3, cx = tr.cx, cy = tr.cy, cz = tr.cz, sd = tr.seed;
      const sw = Math.sin(t*1.1 + sd)*.04;
      const C = sak ? { a:"#f7bccb", b:"#f4a8bc", c:"#fde4ea", d:"#e88aa4" } : { a:"#a8d89c", b:"#94cc8c", c:"#d2f0c4", d:"#7fbf7a" };
      const ball = (x, y, z, rx, ry, rz, col, r, a) => puff(chain(T(cx + x + sw, cy + y, cz + z), r || I4(), S(rx*2, ry*2, rz*2)), col, a);
      const tb = (pts, rf, col) => tube(pts.map(p => [cx + p[0] + sw, cy + p[1], cz + p[2]]), rf, col, false);
      const ring = (y, r, th, col, n = 24) => tb(Array.from({ length: n + 1 }, (_, k) => [Math.cos(k/n*Math.PI*2)*r, y, Math.sin(k/n*Math.PI*2)*r]), () => th, col);
      const cone = (y0, r0, h, col) => tb([[0, y0 + h, 0], [0, y0 + h*.5, 0], [0, y0, 0]], u => r0*u + .02, col);   // 從尖端往下畫，起點的圓球才會很小
      const shine = (x, y, z, s) => ball(x, y, z, s, s*.75, s, "#ffffff", null, .75);
      const flower = (x, y, z, s, col) => { for(let k = 0; k < 5; k++){ const a = k*1.2566; ball(x + Math.cos(a)*s*.7, y, z + Math.sin(a)*s*.7, s*.55, s*.3, s*.55, col); } ball(x, y + s*.1, z, s*.4, s*.35, s*.4, "#ffd36b"); };
      switch(st){
        case 0: ball(0, 0, 0, R, Hh, R, C.a); shine(-R*.35, Hh*.45, R*.4, R*.22); break;   // 1 棒棒糖
        case 1: ball(0, -.1, 0, R*.8, Hh*.75, R*.8, C.a); for(let k = 0; k < 4; k++){ const a = k*1.5708 + .4; ball(Math.cos(a)*R*.55, -.15 + (k % 2)*.2, Math.sin(a)*R*.55, R*.52, Hh*.55, R*.52, k % 2 ? C.b : C.a); } ball(0, Hh*.55, 0, R*.5, Hh*.45, R*.5, C.c); break;   // 2 棉花糖雲
        case 2: for(let i = 0; i < 3; i++){ const y = -Hh*.6 + i*Hh*.6, r = R*(1 - i*.25); ball(0, y, 0, r, Hh*.28, r, i % 2 ? C.b : C.a); ring(y - Hh*.12, r*.96, .07, C.c); } ball(0, Hh*.55, 0, .22, .22, .22, sak ? "#ffffff" : "#ef5a6a"); break;   // 3 三層蛋糕
        case 3: { const s = R*.62; ball(-s*.55, s*.25, 0, s, s, s*.8, C.a); ball(s*.55, s*.25, 0, s, s, s*.8, C.a); ball(0, -s*.55, 0, s*.95, s*.95, s*.75, C.a, RZ(Math.PI/4)); shine(-s*.75, s*.7, s*.6, s*.25); break; }   // 4 愛心樹
        case 4: cone(-Hh*.2, R*.65, Hh*.2 + .1, sak ? "#e8b07a" : "#e8c07a"); ball(0, Hh*.25, 0, R*.85, Hh*.65, R*.85, C.a); ball(0, Hh*.75, 0, R*.25, R*.25, R*.25, sak ? "#ef5a6a" : "#f7a7b8"); break;   // 5 冰淇淋甜筒
        case 5: ball(0, Hh*.1, 0, R*1.05, Hh*.62, R*1.05, sak ? "#ef8aa0" : "#ef7a7a"); ball(0, -Hh*.25, 0, R*.95, Hh*.2, R*.95, "#fff4e6"); for(let k = 0; k < 6; k++){ const a = k*1.05 + sd; ball(Math.cos(a)*R*.62, Hh*.35 + (k % 2)*.12, Math.sin(a)*R*.62, .18, .1, .18, "#ffffff"); } break;   // 6 蘑菇傘
        case 6: for(let i = 0; i < 3; i++) cone(-Hh + i*Hh*.55, R*(1 - i*.22), Hh*.9, i % 2 ? C.b : C.d); ball(0, Hh*.95, 0, .2, .2, .2, "#ffe066"); break;   // 7 聖誕圓錐
        case 7: for(let k = 0; k < 22; k++){ const a = k*2.4 + sd, e = (k/22)*2 - 1, r = Math.sqrt(1 - e*e); ball(Math.cos(a)*r*R*.72, e*Hh*.72, Math.sin(a)*r*R*.72, R*.32, R*.3, R*.32, k % 3 ? C.a : C.c); } break;   // 8 爆米花
        case 8: ring(0, R*.62, R*.36, C.a, 28); for(let k = 0; k < 8; k++){ const a = k*.785; ball(Math.cos(a)*R*.62, R*.33, Math.sin(a)*R*.62, .1, .04, .05, ["#ff8fb0", "#7fc9ff", "#ffe066", "#ffffff"][k % 4], RY(a)); } break;   // 9 甜甜圈
        case 9: ball(0, 0, 0, R, Hh, R, C.a); for(let i = 0; i < 3; i++) ring(-Hh*.45 + i*Hh*.45, Math.sqrt(Math.max(.05, 1 - Math.pow((-.45 + i*.45), 2)))*R*1.01, .05, C.d, 26); break;   // 10 毛線球
        case 10: ball(0, -Hh*.15, 0, R*.9, Hh*.7, R*.9, C.a); tb([[0, Hh*.2, 0], [.05, Hh*.7, 0], [.15, Hh*1.05, 0]], u => R*.55*(1 - u) + .03, C.a); shine(-R*.3, 0, R*.5, R*.2); break;   // 11 胖水滴
        case 11: ball(0, -Hh*.35, 0, R*.95, Hh*.5, R*.95, C.a); ball(0, Hh*.45, 0, R*.65, Hh*.42, R*.65, C.b); ball(0, Hh*.95, 0, R*.25, R*.18, R*.25, C.c); break;   // 12 葫蘆
        case 12: ball(0, 0, 0, R*.85, Hh*.8, R*.85, C.a); for(let k = 0; k < 7; k++){ const a = k*.8976 + sd*.1; flower(Math.cos(a)*R*.82, Math.sin(k*1.7)*Hh*.3, Math.sin(a)*R*.82, .18, sak ? "#ffffff" : ["#f7a7b8", "#ffffff", "#cdb4f0"][k % 3]); } break;   // 13 開滿小花
        case 13: for(let i = 0; i < 3; i++){ const a = sd + i*2.1; ball(Math.cos(a)*R*.35*(i ? 1 : 0), -Hh*.5 + i*Hh*.5, Math.sin(a)*R*.35*(i ? 1 : 0), R*(1 - i*.2), Hh*.24, R*(1 - i*.2), i % 2 ? C.b : C.a); } break;   // 14 雲朵扁扁
        case 14: gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); ball(0, 0, 0, R*.55, Hh*.55, R*.55, C.d); ball(0, 0, 0, R, Hh, R, C.a, null, .55); gl.disable(gl.BLEND); shine(-R*.35, Hh*.45, R*.45, R*.2); break;   // 15 果凍球
        case 15: ball(0, Hh*.2, 0, R, Hh*.65, R, C.a); for(let k = 0; k < 12; k++){ const a = k*.5236, x = Math.cos(a)*R*.85, z = Math.sin(a)*R*.85, s2 = Math.sin(t*1.4 + k)*.06; tb([[x, Hh*.05, z], [x*1.04 + s2, -Hh*.6, z*1.04], [x*1.06 + s2*1.6, -Hh*1.2, z*1.06]], () => .05, k % 2 ? C.b : C.a); } break;   // 16 柳樹
        case 16: ball(0, -Hh*.2, 0, .28, .28, .28, "#c98a5a"); for(let k = 0; k < 7; k++){ const a = k*.8976 + sd*.1, dx = Math.cos(a), dz = Math.sin(a); tb([[0, -Hh*.1, 0], [dx*R*.6, Hh*.35, dz*R*.6], [dx*R*1.15, -Hh*.05, dz*R*1.15]], u => .2*(1 - u*.7), k % 2 ? C.a : C.d); } break;   // 17 椰子樹
        case 17: ball(0, Hh*.15, 0, R*.95, Hh*.7, R*.95, C.a); ring(-Hh*.3, R*.9, .1, C.d, 28); for(let k = 0; k < 6; k++){ const a = k*1.047; const x = Math.cos(a)*R*.75, z = Math.sin(a)*R*.75; tb([[x, -Hh*.35, z], [x, -Hh*.6, z]], () => .02, C.d); ball(x, -Hh*.7, z, .15, .17, .15, sak ? "#ffffff" : "#ffe066"); } break;   // 18 鈴鐺花
        case 18: ball(0, 0, 0, R, Hh*.95, R, C.a); for(const sx of [-1, 1]){ tb([[sx*R*.45, Hh*.55, 0], [sx*R*.55, Hh*1.05, 0], [sx*R*.62, Hh*1.3, 0]], u => R*.32*(1 - u) + .02, C.a); ball(sx*R*.5, Hh*.8, R*.08, R*.12, R*.16, .05, sak ? "#ffffff" : "#f7b6c8"); } shine(-R*.3, Hh*.3, R*.55, R*.18); break;   // 19 貓耳樹
        case 19: ball(0, -Hh*.2, 0, R*.8, Hh*.62, R*.75, C.a); for(let k = 0; k < 4; k++){ const a = -1.05 + k*.7; ball(Math.sin(a)*R*.78, Hh*.55 + Math.cos(a)*Hh*.08 - Math.abs(a)*.15, 0, R*.3, R*.32, R*.3, C.b); } ball(0, -Hh*.25, R*.62, R*.42, R*.32, .1, sak ? "#ffffff" : "#f7b6c8"); break;   // 20 貓掌樹
      }
    }
    // ---------- 家具（不是方塊做的，用圓角、圓球、管子組起來）：FURN 是清單，drawFurn 畫一件 ----------
    const FURN = [
      ["cattree", "貓跳台", "貓咪用品"], ["catbed", "貓窩", "貓咪用品"], ["bowl", "食盆", "貓咪用品"],
      ["bed", "小床", "臥室"], ["lamp", "檯燈", "臥室"], ["wardrobe", "衣櫃", "臥室"], ["rug", "圓地毯", "臥室"], ["nstand", "床頭櫃", "臥室"],
      ["sofa", "沙發", "客廳"], ["ltable", "矮桌", "客廳"], ["cushion", "坐墊", "客廳"], ["plant", "盆栽", "客廳"], ["tv", "小電視", "客廳"],
      ["swing", "鞦韆", "庭院"], ["bench", "長椅", "庭院"], ["slamp", "路燈", "庭院"], ["frack", "花架", "庭院"], ["pond", "小池塘", "庭院"],
    ];
    function drawFurn(id, x, y, z, rot, t){
      const M0 = chain(T(x, y, z), RY(rot || 0));
      const P = (lx, ly, lz) => mulPt(M0, [lx, ly, lz]);
      const bx = (lx, ly, lz, sx, sy, sz, c, r) => box(chain(M0, T(lx, ly, lz), r || I4(), S(sx, sy, sz)), c);
      const el = (lx, ly, lz, rx, ry, rz, c, r) => { bind(ball); gl.uniform1f(U("mode"), 2); gl.disable(gl.CULL_FACE); box(chain(M0, T(lx, ly, lz), r || I4(), S(rx*2, ry*2, rz*2)), c); gl.enable(gl.CULL_FACE); bind(cube); gl.uniform1f(U("mode"), 1); };
      const tb = (pts, r0, r1, c) => tube(pts.map(p => P(...p)), u => r0 + (r1 - r0)*u, c, true);
      const cyl = (lx, y0, lz, r, h, c) => tb([[lx, y0, lz], [lx, y0 + h*.5, lz], [lx, y0 + h, lz]], r, r, c);
      const disc = (lx, ly, lz, r, th, c) => el(lx, ly, lz, r, th, r, c);
      // 圓角的長方塊：中間一塊、四邊用圓管包起來
      const rbox = (lx, ly, lz, sx, sy, sz, c, rr = .06) => { bx(lx, ly, lz, sx - rr*2, sy, sz, c); bx(lx, ly, lz, sx, sy - rr*2, sz - rr*2, c); bx(lx, ly, lz, sx - rr*2, sy - rr*2, sz, c);
        for(const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]){ tb([[lx + a*(sx/2 - rr), ly - sy/2 + rr, lz + b*(sz/2 - rr)], [lx + a*(sx/2 - rr), ly + sy/2 - rr, lz + b*(sz/2 - rr)]], rr, rr, c);
          tb([[lx - sx/2 + rr, ly + a*(sy/2 - rr), lz + b*(sz/2 - rr)], [lx + sx/2 - rr, ly + a*(sy/2 - rr), lz + b*(sz/2 - rr)]], rr, rr, c);
          tb([[lx + a*(sx/2 - rr), ly + b*(sy/2 - rr), lz - sz/2 + rr], [lx + a*(sx/2 - rr), ly + b*(sy/2 - rr), lz + sz/2 - rr]], rr, rr, c); } };
      const W = "#d9b48a", WD = "#b88a5e", PK = "#f2a7bd", PKL = "#f9cfdb", CR = "#fff4e6", SG = "#a8c89a", SGD = "#86ad7c", BL = "#a9c6ef", GD = "#e8c46a";
      switch(id){
        case "cattree": { for(const [px, pz, h] of [[-.25, -.15, 1.5], [.25, .15, .95]]) cyl(px, 0, pz, .07, h, "#e6cfa6");
          rbox(0, .04, 0, .9, .08, .7, PKL); disc(-.25, 1.52, -.15, .3, .07, PK); disc(.25, .98, .15, .27, .06, PK); el(-.25, 1.6, -.15, .22, .06, .22, CR);
          tb([[-.25, 1.25, -.15], [.05, 1.15, -.1], [.1, 1.02, -.05]], .02, .015, "#f6d06a"); el(.1, .98, -.05, .05, .05, .05, PK); break; }
        case "catbed": el(0, .1, 0, .42, .12, .36, PK); el(0, .16, 0, .32, .06, .26, CR); tb(Array.from({ length: 25 }, (_, k) => [Math.cos(k/24*Math.PI*2)*.38, .2, Math.sin(k/24*Math.PI*2)*.32]), .08, .08, PK); break;
        case "bowl": for(const [px, c, fill] of [[-.17, PK, "#d9a066"], [.17, BL, "#bfe3ff"]]){ tb([[px, .02, 0], [px, .1, 0]], .14, .16, c); disc(px, .1, 0, .13, .015, fill); } el(0, .005, 0, .4, .01, .22, CR); break;
        case "teaser": tb([[0, 0, 0], [0, .3, 0]], .13, .13, "#f6d06a"); disc(0, .3, 0, .12, .01, "#c9935e");
          for(const [a, c] of [[0, PK], [2.1, BL], [4.2, SG]]){ const ex = Math.cos(a)*.35, ez = Math.sin(a)*.35, sw = Math.sin(t*2 + a)*.05; tb([[Math.cos(a)*.05, .25, Math.sin(a)*.05], [ex*.6 + sw, .7, ez*.6], [ex + sw, .9, ez]], .012, .008, "#a0703f"); el(ex + sw, .9, ez, .06, .1, .06, c); } break;
        case "cbox": { const c = "#e2bf86", cd = "#c9a06a"; bx(0, .22, 0, .7, .44, .6, c); bx(0, .44, 0, .64, .02, .54, cd);
          for(const [a, d] of [[0, 1], [0, -1]]){ bx(0, .5, d*.36, .7, .02, .18, c, RX(d*.6)); void a; } bx(0, .26, .301, .2, .08, .01, PK); break; }
        case "bed": { rbox(0, .18, 0, 1, .2, 1.9, W, .05); for(const [px, pz] of [[-.44, -.9], [.44, -.9], [-.44, .9], [.44, .9]]) cyl(px, 0, pz, .05, .1, WD);
          rbox(0, .55, -.95, 1, .9, .1, W, .05); el(0, .36, .05, .48, .1, .9, CR); el(0, .44, -.62, .32, .1, .18, PKL); el(0, .42, .35, .5, .08, .55, PK); break; }
        case "lamp": disc(0, .02, 0, .16, .03, WD); tb([[0, .02, 0], [0, .5, 0]], .025, .025, GD); tb([[0, .45, 0], [0, .72, 0]], .2, .12, CR); el(0, .5, 0, .08, .08, .08, "#fff6c8"); break;
        case "wardrobe": { rbox(0, .85, 0, .9, 1.7, .55, W, .05); bx(-.225, .9, .276, .4, 1.45, .01, "#e4c39a"); bx(.225, .9, .276, .4, 1.45, .01, "#e4c39a");
          for(const sx of [-1, 1]) el(sx*.06, .95, .29, .025, .05, .025, GD); el(0, 1.75, 0, .4, .05, .25, PKL); break; }
        case "rug": el(0, .01, 0, .8, .012, .8, PKL); tb(Array.from({ length: 33 }, (_, k) => [Math.cos(k/32*Math.PI*2)*.62, .02, Math.sin(k/32*Math.PI*2)*.62]), .02, .02, PK); for(let k = 0; k < 5; k++){ const a = k*1.2566; el(Math.cos(a)*.3, .02, Math.sin(a)*.3, .08, .01, .08, CR); } break;
        case "nstand": rbox(0, .28, 0, .5, .5, .42, W, .05); bx(0, .3, .212, .4, .14, .01, "#e4c39a"); el(0, .3, .225, .03, .03, .02, GD); for(const [px, pz] of [[-.2, -.16], [.2, -.16], [-.2, .16], [.2, .16]]) cyl(px, 0, pz, .03, .05, WD); el(.1, .58, 0, .08, .08, .08, BL); break;
        case "sofa": { rbox(0, .25, 0, 1.6, .26, .75, SG, .1); el(0, .45, .05, .75, .1, .3, "#b8d6aa"); rbox(0, .6, -.3, 1.6, .55, .18, SG, .09);
          for(const sx of [-1, 1]) rbox(sx*.74, .45, 0, .16, .44, .75, SG, .07); for(const sx of [-1, 1]) el(sx*.4, .65, -.15, .2, .16, .07, sx < 0 ? PKL : CR);
          for(const [px, pz] of [[-.7, -.3], [.7, -.3], [-.7, .3], [.7, .3]]) cyl(px, 0, pz, .035, .12, WD); break; }
        case "ltable": el(0, .34, 0, .55, .04, .55, W); for(let k = 0; k < 4; k++){ const a = k*1.5708 + .785; tb([[Math.cos(a)*.32, 0, Math.sin(a)*.32], [Math.cos(a)*.3, .32, Math.sin(a)*.3]], .035, .03, WD); }
          tb([[.12, .38, .05], [.12, .5, .05]], .06, .07, CR); disc(-.15, .39, -.1, .12, .015, CR); el(-.15, .42, -.1, .05, .03, .05, PK); break;
        case "cushion": el(0, .1, 0, .38, .12, .38, PKL); el(0, .2, 0, .08, .03, .08, PK); for(let k = 0; k < 4; k++){ const a = k*1.5708 + .785; el(Math.cos(a)*.36, .1, Math.sin(a)*.36, .05, .05, .05, PK); } break;
        case "plant": tb([[0, 0, 0], [0, .4, 0]], .16, .21, "#e8a07a"); disc(0, .4, 0, .19, .02, "#8a5a3a");
          for(let k = 0; k < 7; k++){ const a = k*.8976, h = .7 + (k % 3)*.15, sw = Math.sin(t*1.3 + k)*.03; tb([[0, .4, 0], [Math.cos(a)*.1 + sw, .4 + h*.6, Math.sin(a)*.1], [Math.cos(a)*.3 + sw, .4 + h, Math.sin(a)*.3]], .015, .01, SGD); el(Math.cos(a)*.3 + sw, .4 + h, Math.sin(a)*.3, .09, .04, .13, k % 2 ? SG : "#9ed08f", RY(-a)); } break;
        case "tv": { rbox(0, .25, 0, .9, .5, .4, W, .05); rbox(0, .82, 0, .78, .55, .12, "#e9e1ef", .06); bx(0, .82, .062, .64, .42, .01, "#7fa9c9");
          el(-.15, .9, .07, .06, .02, .01, "#ffffff"); for(const sx of [-1, 1]) tb([[sx*.12, 1.08, 0], [sx*.25, 1.3, -.02]], .012, .01, "#c9c0d8"); break; }
        case "swing": { for(const sx of [-1, 1]){ tb([[sx*.6, 0, -.3], [sx*.6, 1.8, 0]], .05, .05, W); tb([[sx*.6, 0, .3], [sx*.6, 1.8, 0]], .05, .05, W); }
          tb([[-.65, 1.8, 0], [.65, 1.8, 0]], .05, .05, WD); const sw = Math.sin(t*1.2)*.15; for(const sx of [-1, 1]) tb([[sx*.3, 1.78, 0], [sx*.3, .5, sw]], .01, .01, "#d6c9b0");
          rbox(0, .48, sw, .75, .06, .3, PK, .03); break; }
        case "bench": { rbox(0, .42, 0, 1.4, .07, .4, W, .03); rbox(0, .78, -.18, 1.4, .3, .06, W, .03); for(const sx of [-1, 1]){ tb([[sx*.6, 0, .15], [sx*.6, .42, .15]], .04, .04, "#7a6a7a"); tb([[sx*.6, 0, -.15], [sx*.6, .95, -.2]], .04, .04, "#7a6a7a"); } break; }
        case "slamp": disc(0, .03, 0, .2, .04, "#7a6a7a"); tb([[0, 0, 0], [0, 2.1, 0]], .045, .035, "#7a6a7a"); tb([[0, 2.1, 0], [.15, 2.25, 0], [.3, 2.2, 0]], .03, .03, "#7a6a7a");
          tb([[.3, 2.18, 0], [.3, 1.98, 0]], .07, .14, "#ffeec0"); el(.3, 2.02, 0, .07, .07, .07, "#fff6c8"); tb([[.3, 2.22, 0], [.3, 2.16, 0]], .02, .16, "#7a6a7a"); break;
        case "frack": { for(const [ly, w] of [[.3, 1], [.7, .85], [1.1, .7]]) rbox(0, ly, -(1.1 - ly)*.12, w, .05, .26, W, .02); for(const sx of [-1, 1]) tb([[sx*.5, 0, .12], [sx*.36, 1.2, -.02]], .03, .03, WD);
          const cols = [PK, "#ffe08a", BL, "#cdb4f0", "#f28b82"]; let k = 0; for(const [ly, w] of [[.3, 1], [.7, .85], [1.1, .7]]) for(let i = 0; i < 3; i++){ const px = (i - 1)*w*.32, pz = -(1.1 - ly)*.12; tb([[px, ly + .03, pz], [px, ly + .15, pz]], .06, .075, "#e8a07a");
            el(px, ly + .22, pz, .07, .06, .07, cols[k++ % cols.length]); } break; }
        case "pond": { el(0, .02, 0, .95, .03, .7, "#9a9ab0"); el(0, .035, 0, .82, .02, .58, "#a8d6ee"); for(let k = 0; k < 9; k++){ const a = k*.698; el(Math.cos(a)*.92, .07, Math.sin(a)*.68, .14, .08, .11, k % 2 ? "#c6c3d4" : "#b8b5c8"); }
          disc(.25, .05, .1, .14, .008, "#8fc48a"); el(.27, .07, .08, .04, .03, .04, PK); const fx = Math.cos(t*.8)*.35, fz = Math.sin(t*.8)*.2; el(fx, .04, fz, .07, .025, .04, "#f2a65a", RY(-t*.8)); break; }
      }
    }
    // ---------- 方塊風家具（像方塊遊戲的家具模型：用 1/16 格的小方塊拼，顏色用和紙色）----------
    // 有貼圖的小方塊（家具用）：每一面 0～1 貼一整張材質，面的亮度不同
    const tcube = (() => { const P = [], N = [], UV = [], SH = [], I = []; FACES.forEach(f => { const b = P.length/3; f.c.forEach(c => { P.push(c[0]-.5, c[1]-.5, c[2]-.5); N.push(...f.n); SH.push(f.l); }); UV.push(0,1, 1,1, 1,0, 0,0); I.push(b,b+1,b+2,b,b+2,b+3); }); return mesh(P, N, UV, SH, I); })();
    function drawFurnV(id, x, y, z, rot, t){
      const M0 = chain(T(x, y, z), RY(rot || 0)), FS = window.__fvStyle != null ? window.__fvStyle : FV_STYLE;
      const v = FCAP ? (x0, y0, z0, x1, y1, z1, c) => FCAP.push([x0, y0, z0, x1, y1, z1, c]) : FS < 0 ? (x0, y0, z0, x1, y1, z1, c) => box(chain(M0, T((x0 + x1)/32 - .5, (y0 + y1)/32, (z0 + z1)/32 - .5), S((x1 - x0)/16, (y1 - y0)/16, (z1 - z0)/16)), c, FV_A)
        : (x0, y0, z0, x1, y1, z1, c) => { const ci = FV_COLS.indexOf(c); if(ci < 0){ box(chain(M0, T((x0 + x1)/32 - .5, (y0 + y1)/32, (z0 + z1)/32 - .5), S((x1 - x0)/16, (y1 - y0)/16, (z1 - z0)/16)), c, FV_A); return; }
          const [u0,v0,u1,v1] = tileUV(128 + FS*FV_COLS.length + ci); bind(tcube); gl.uniform1f(U("mode"), 0); gl.uniform4f(U("uvR"), u0, v0, u1 - u0, v1 - v0);
          gl.uniformMatrix4fv(U("M"), false, chain(M0, T((x0 + x1)/32 - .5, (y0 + y1)/32, (z0 + z1)/32 - .5), S((x1 - x0)/16, (y1 - y0)/16, (z1 - z0)/16))); gl.uniform1f(U("alpha"), FV_A); gl.drawElements(gl.TRIANGLES, boundC, gl.UNSIGNED_SHORT, 0);
          gl.uniform4f(U("uvR"), 0, 0, 1, 1); gl.uniform1f(U("mode"), 1); bind(cube); };
      const W = "#dcbf96", WD = "#b8946a", WL = "#ead4b0", PK = "#f2a7bd", PKD = "#e08aa4", PKL = "#fbd3de", CR = "#fff6ea", SG = "#a8c89a", SGD = "#8fb582", SGL = "#c4ddb8", Y = "#ffd36b";
      switch(id){
        case "bed": v(0,0,0, 2,3,2, WD); v(14,0,0, 16,3,2, WD); v(0,0,30, 2,3,32, WD); v(14,0,30, 16,3,32, WD);
          v(0,3,0, 16,6,32, W); v(0,3,-1, 16,14,1, WD); v(1,6,0, 15,8,31, CR); v(3,8,1, 13,10,6, PKL); v(0,7,10, 16,9,31, PK); v(0,9,10, 16,9.6,31, PKD); v(0,3,31, 16,8,32, WD); break;
        case "sofa": v(1,0,2, 3,2,4, WD); v(13,0,2, 15,2,4, WD); v(1,0,12, 3,2,14, WD); v(13,0,12, 15,2,14, WD);
          v(-8,2,2, 24,6,14, SG); v(-8,6,2, 24,13,5, SGD); v(-8,2,2, -5,10,14, SGD); v(21,2,2, 24,10,14, SGD);
          v(-5,6,5, 8,8,14, SGL); v(8.2,6,5, 21,8,14, SGL); v(-3,8,5, 3,12,7, PKL); v(13,8,5, 19,12,7, CR); break;
        case "cattree": v(1,0,1, 15,2,15, PK); v(3,2,3, 7,22,7, WL); v(10,2,10, 14,13,14, WL);
          for(let k = 0; k < 10; k++) v(2.6,3 + k*2,2.6, 7.4,4 + k*2,7.4, "#e6cfa6");
          v(7,13,7, 16,15,16, PKD); v(0,22,0, 10,24,10, PK); v(1,24,1, 9,25.5,9, CR); v(9,18,4, 9.6,22,4.6, Y); v(8.6,16.5,3.6, 10,18,5, PK); break;
        case "lamp": v(5,0,5, 11,1,11, WD); v(7.2,1,7.2, 8.8,10,8.8, Y); v(4,10,4, 12,15,12, CR); v(5,15,5, 11,16,11, CR); v(6,9,6, 10,10,10, "#fff1b0"); break;
        case "catbed": v(1,0,1, 15,2,15, PK); v(1,2,1, 15,5,3, PK); v(1,2,13, 15,5,15, PK); v(1,2,3, 3,5,13, PK); v(13,2,3, 15,5,13, PK); v(3,2,3, 13,3,13, CR); v(5,3,5, 9,4,8, PKL); break;
        case "bowl": v(1,0,4, 15,.3,12, CR); v(2,0,5, 7,2.5,10, PK); v(3,2,6, 6,2.6,9, "#d9a066"); v(9,0,5, 14,2.5,10, "#a9c6ef"); v(10,2,6, 13,2.6,9, "#dff2ff"); break;
        case "wardrobe": v(0,0,4, 16,30,16, W); v(1,1,16, 7.8,28,16.3, WL); v(8.2,1,16, 15,28,16.3, WL); v(7,14,16.3, 7.6,17,16.7, Y); v(8.4,14,16.3, 9,17,16.7, Y); v(-.5,30,3.5, 16.5,31,16.5, WD); v(4,31,8, 12,33,12, PKL); break;
        case "rug": v(-6,0,-6, 22,.4,22, PKL); v(-6,0,-6, 22,.5,-4.5, PK); v(-6,0,20.5, 22,.5,22, PK); v(-6,0,-4.5, -4.5,.5,20.5, PK); v(20.5,0,-4.5, 22,.5,20.5, PK); v(4,0,4, 12,.55,12, CR); break;
        case "nstand": v(2,1,3, 14,11,13, W); for(const [a2, b2] of [[2,3],[12,3],[2,11],[12,11]]) v(a2,0,b2, a2 + 2,1,b2 + 2, WD); v(3,4,13, 13,9,13.3, WL); v(7.5,6,13.3, 8.5,7,13.7, Y); v(8,11,6, 11,14,9, "#a9c6ef"); break;
        case "ltable": v(0,6,0, 16,7.5,16, W); for(const [a2, b2] of [[1,1],[13,1],[1,13],[13,13]]) v(a2,0,b2, a2 + 2,6,b2 + 2, WD); v(3,7.5,3, 7,8,7, CR); v(4,8,4, 6,9.5,6, PK); v(10,7.5,9, 12,10,11, CR); break;
        case "cushion": v(1,0,1, 15,4,15, PKL); v(2,4,2, 14,4.6,14, PK); v(7,4.6,7, 9,5,9, CR); for(const [a2, b2] of [[0,0],[15,0],[0,15],[15,15]]) v(a2,1,b2, a2 + 1,3,b2 + 1, PK); break;
        case "plant": v(4,0,4, 12,7,12, "#e8a07a"); v(3.5,6,3.5, 12.5,7.5,12.5, "#d98a66"); v(5,7,5, 11,7.6,11, "#8a5a3a"); v(7.5,7,7.5, 8.5,18,8.5, SGD);
          v(2,11,6, 8,12,10, SG); v(8,13,6, 14,14,10, SGL); v(5,15,2, 11,16,8, SG); v(5,17,8, 11,18,14, SGL); v(6,19,6, 10,20,10, SG); v(7,20,7, 9,22,9, SGL); break;
        case "tv": v(-2,0,2, 18,8,14, W); v(-1,1,14, 7.8,7,14.3, WL); v(8.2,1,14, 17,7,14.3, WL); v(1,8,5, 15,18,11, "#e9e1ef"); v(2,9,11, 14,17,11.3, "#7fa9c9"); v(3,15,11.3, 6,16,11.4, "#ffffff"); v(5,18,8, 5.6,22,8.6, WD); v(10.4,18,8, 11,22,8.6, WD); break;
        case "swing": { v(-6,0,7, -4,28,9, W); v(20,0,7, 22,28,9, W); v(-6,28,7, 22,30,9, WD); const sw = Math.sin(t*1.2)*1.5;
          v(2.7,8,7.7 + sw*.5, 3.3,28,8.3 + sw*.5, "#e6cfa6"); v(12.7,8,7.7 + sw*.5, 13.3,28,8.3 + sw*.5, "#e6cfa6"); v(1,7,5 + sw, 15,8.5,11 + sw, PK); break; }
        case "bench": v(-4,6,4, 20,7.5,12, W); for(const yy of [9, 11.5]) v(-4,yy,4, 20,yy + 1.8,5.5, W); for(const xx of [-3, 17]){ v(xx,0,10, xx + 2,6,12, "#7a6a7a"); v(xx,0,4, xx + 2,14,5.5, "#7a6a7a"); } break;
        case "slamp": v(5,0,5, 11,1,11, "#7a6a7a"); v(7,1,7, 9,34,9, "#7a6a7a"); v(9,32,7, 14,33,9, "#7a6a7a"); v(11,26,6, 16,31,10, Y); v(12,27,6.5, 15,30,9.5, "#fff1b0"); v(10.5,31,5.5, 16.5,32,10.5, "#7a6a7a"); break;
        case "frack": { v(0,0,11, 1.5,18,13, WD); v(14.5,0,11, 16,18,13, WD); v(0,0,3, 1.5,18,5, WD); v(14.5,0,3, 16,18,5, WD); const fc = [PK, Y, "#a9c6ef", PKL, CR, SGL]; let k2 = 0;
          for(const [yy, zz] of [[5, 9], [11, 7], [17, 5]]){ v(0,yy,zz - 2, 16,yy + 1,zz + 4, W); for(const xx of [2, 6.5, 11]){ v(xx,yy + 1,zz, xx + 3,yy + 3.5,zz + 3, "#e8a07a"); v(xx + .3,yy + 3.5,zz + .3, xx + 2.7,yy + 5,zz + 2.7, fc[k2++ % fc.length]); } } break; }
        case "pond": { v(-6,0,-4, 22,.8,20, "#a8d6ee"); for(let k2 = 0; k2 < 14; k2++){ const a2 = k2/14*Math.PI*2, cx2 = 8 + Math.cos(a2)*15, cz2 = 8 + Math.sin(a2)*13; v(cx2 - 2,0,cz2 - 2, cx2 + 2,2.5,cz2 + 2, k2 % 2 ? "#c6c3d4" : "#b8b5c8"); }
          v(2,.8,6, 7,1.1,11, SG); v(4,1.1,8, 5.5,2,9.5, PK); const fx = 8 + Math.cos(t*.8)*6, fz = 8 + Math.sin(t*.8)*5; v(fx - 1.5,.9,fz - .8, fx + 1.5,1.5,fz + .8, "#f2a65a"); break; }
      }
    }
    const FV_STYLE = 6;    // 家具材質風格（-1 平塗；0 和紙、1 像素點點、2 手繪木紋布紋、3 粉彩小圖案）
    function frame(now){
      if(dead) return; raf = requestAnimationFrame(frame);
      if(CFG.fps && now - last < 1000/CFG.fps - 2) return;   // 幀率上限：還沒到時間就先不畫（比較省電、不會燙）
      const dt = Math.min(.05, (now - last)/1000); last = now; const t = (now - t0)/1000;
      const hr = window.__cubeHour != null ? window.__cubeHour : CFG.time === "day" ? 13 : (() => { const d = new Date(); return d.getHours() + d.getMinutes()/60; })(), night = hr >= 22 || hr < 6; curHr = hr; dayLight(hr); const dark = STAR > .4; if(root._dk !== dark){ root._dk = dark; root.classList.toggle("dark", dark); }
      if(CFG.showFps){ fpsN++; if(now - fpsT > 500){ fpsEl.textContent = Math.round(fpsN*1000/(now - fpsT)) + " FPS"; fpsN = 0; fpsT = now; } }
      // 玩家移動（搖桿方向跟著鏡頭）
      let ix = J.x, iz = J.y;
      if(K.w || K.arrowup) iz = -1; if(K.s || K.arrowdown) iz = 1; if(K.a || K.arrowleft) ix = -1; if(K.d || K.arrowright) ix = 1;
      const mag = Math.min(1, Math.hypot(ix, iz)), sp = 4.2*mag;
      let mx = 0, mz = 0;
      if(mag > .08){ const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw), rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
        const dx = (rx*ix - fx*iz), dz = (rz*ix - fz*iz), l = Math.hypot(dx, dz) || 1; mx = dx/l*sp; mz = dz/l*sp;
        const want = Math.atan2(mx, mz); let d = want - player.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); player.yaw += d*Math.min(1, dt*12); }
      tryJump(dt); if(player.petT > 0) player.petT -= dt; idleT = mag > .08 ? 0 : idleT + dt;
      // 走路有起步和停下來的緩衝（不會一按就全速、一放就急停）
      { const k = Math.min(1, dt*(mag > .08 ? 9 : 12)); player.vx = (player.vx || 0) + (mx - (player.vx || 0))*k; player.vz = (player.vz || 0) + (mz - (player.vz || 0))*k; if(Math.hypot(player.vx, player.vz) < .02) player.vx = player.vz = 0; }
      move(player, player.vx, player.vz, dt, .28, 1.45); player._dt = dt; const sp2 = Math.min(1, Math.hypot(player.vx, player.vz)/4.2); player.spd = sp2; player.walk += dt*(sp2*1.05 + (sp2 > .02 ? .15 : 0));
      if(player.visY){ player.visY *= Math.pow(.0005, dt); if(Math.abs(player.visY) < .01) player.visY = 0; }
      // 鏡頭慢慢轉到玩家背後（有在走、而且沒在拖曳時）
      if(CFG.autoCam && mag > .2 && dragId === null){ let d = (player.yaw + Math.PI) - cam.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); cam.yaw += d*Math.min(1, dt*1.4); }
      // 寵物貓：到處閒晃，你靠近時會轉過來看你
      near = -1; let nd = 2.4;
      pets.forEach(p => {
        const dp = Math.hypot(p.x - player.x, p.z - player.z);
        const atHome = Math.hypot(p.x - p.home[0], p.z - p.home[2]) < .7; if(!p.fam) p.sleep = night && atHome && talkIdx !== p.i ? Math.min(1, p.sleep + dt) : Math.max(0, p.sleep - dt*2);
        if(dp < nd && Math.abs(p.y - player.y) < 1.2 && !solid((p.x+player.x)/2, player.y + .5, (p.z+player.z)/2)){ nd = dp; near = p.i; }   // 隔著牆、高低差太多不算
        if(dp < .55 && dp > 1e-4){ const k = (.55 - dp)/dp*.5, ox = p.x, oz = p.z; p.x -= (player.x - p.x)*k; p.z -= (player.z - p.z)*k; if(hits(p.x, p.y, p.z, .25*p.s, .8*p.s)){ p.x = ox; p.z = oz; } }   // 不會穿過小貓，會把牠輕輕擠開
        let vx = 0, vz = 0;
        if(p.fam){ const r = famAI(p, dp, dt, night); vx = r[0]; vz = r[1]; }
        else if(p.sleep > .5){ /* 睡著了，不動 */ } else if(dp < 2.4){ const want = Math.atan2(player.x - p.x, player.z - p.z); let d = want - p.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); p.yaw += d*Math.min(1, dt*6); p.tx = null; }
        else if(p.tx == null){ p.wait -= dt; if(p.wait <= 0){ const a = Math.random()*Math.PI*2, r = night ? 0 : 1 + Math.random()*3.5; const nx = p.home[0] + Math.cos(a)*r, nz = p.home[2] + Math.sin(a)*r; if(world.topY(Math.floor(nx), Math.floor(nz)) >= world.floor - 1){ p.tx = nx; p.tz = nz; } else p.wait = .5; } }
        else { const dx = p.tx - p.x, dz = p.tz - p.z, l = Math.hypot(dx, dz); if(l < .3){ p.tx = null; p.wait = 1.5 + Math.random()*3.5; } else if(!ground(p.x + dx/l*.5, p.z + dz/l*.5, p.y)){ p.tx = null; p.wait = .8; } else { vx = dx/l*1.6; vz = dz/l*1.6; const want = Math.atan2(vx, vz); let d = want - p.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); p.yaw += d*Math.min(1, dt*6); } }
        const ox = p.x, oz = p.z; move(p, vx, vz, dt, .25*p.s, .8*p.s); if(p.tx != null && Math.hypot(p.x-ox, p.z-oz) < .001 && (vx || vz)){ p.tx = null; p.wait = 1; }
        p.spd = Math.min(1, Math.hypot(vx, vz)/1.6); p.walk += dt*p.spd; if(p.love > 0) p.love -= dt; if(p.hop > 0) p.hop = Math.max(0, p.hop - dt);
      });
      if(yarn) ballStep(dt);
      if(talkIdx >= 0 && pets[talkIdx] && Math.hypot(pets[talkIdx].x - player.x, pets[talkIdx].z - player.z) > 3.6) endTalk();   // 走遠了就不聊了
      if(near !== act._near){ act._near = near; paintAct(); }
      if(clockEl._m !== Math.floor(hr*60)){ clockEl._m = Math.floor(hr*60); const H = Math.floor(hr), M = Math.floor((hr - H)*60); clockEl.innerHTML = CFG.time === "day" ? "" : `${o.icon ? `<span class="p3dIc">${o.icon(H >= 6 && H < 18 ? "sun" : "moon")}</span>` : ""}${H < 5 || H >= 19 ? "晚上" : H < 11 ? "早上" : H < 13 ? "中午" : H < 17 ? "下午" : "傍晚"} ${H}:${String(M).padStart(2, "0")}`; }

      // 鏡頭：在玩家後上方，被方塊擋住就拉近
      // 鏡頭：跟著玩家但有一點點緩衝（上下比較慢，跳上一格、跳起來時不會抖）
      { const ty = player.y + (player.visY || 0) + 1.35, C = cam.t || (cam.t = [player.x, ty, player.z]), kx = Math.min(1, dt*16), ky = Math.min(1, dt*(player.onG ? 9 : 4));
        C[0] += (player.x - C[0])*kx; C[2] += (player.z - C[2])*kx; C[1] += (ty - C[1])*ky; if(Math.hypot(player.x - C[0], player.z - C[2]) > 3 || Math.abs(ty - C[1]) > 4){ C[0] = player.x; C[1] = ty; C[2] = player.z; } }
      const tgt = (window.__camT || cam.t).slice();   // __camT：測試截圖用
      let dist = cam.dist; const dir = [Math.sin(cam.yaw)*Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw)*Math.cos(cam.pitch)];
      for(let d = .25; d <= cam.dist; d += .1){ const bx = tgt[0]+dir[0]*d, by = tgt[1]+dir[1]*d, bz = tgt[2]+dir[2]*d;
        if(solid(bx, by, bz) || solid(bx, by + .15, bz) || solid(bx, by - .15, bz)){ dist = Math.max(.3, d - .3); break; } }
      { const cur = cam.cd == null ? dist : cam.cd; cam.cd = dist < cur ? Math.max(dist, cur - dt*30) : cur + (dist - cur)*Math.min(1, dt*3); dist = Math.min(dist, cam.cd); }   // 被擋住馬上拉近、沒擋住慢慢退回去（不會一直跳來跳去）
      let eye = [tgt[0]+dir[0]*dist, tgt[1]+dir[1]*dist, tgt[2]+dir[2]*dist];
      // 蓋房子模式：鏡頭慢慢移到自己的眼睛（第一人稱），準星對到哪就蓋到哪，不會被自己擋住
      { const k = cam.bk = (cam.bk || 0) + ((buildOn ? 1 : 0) - (cam.bk || 0))*Math.min(1, dt*7);
        if(!buildOn && cam.pitch < .08) cam.pitch += (.3 - cam.pitch)*Math.min(1, dt*6);
        if(k > .003 && !window.__camT){ const hd = [player.x, player.y + (player.visY || 0) + 1.22, player.z], fp = [hd[0] - dir[0], hd[1] - dir[1], hd[2] - dir[2]];
          for(let i = 0; i < 3; i++){ eye[i] += (hd[i] - eye[i])*k; tgt[i] += (fp[i] - tgt[i])*k; } } }
      lastCam = { eye, tgt };
      const V = lookAt(eye, tgt, [0,1,0]), P = persp(CFG.fov*Math.PI/180, cv.width/cv.height, .05, Math.max(CFG.view + 12, STAR > .02 ? 90 : 0));

      gl.viewport(0, 0, cv.width, cv.height); gl.clearColor(SKY[0], SKY[1], SKY[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); drawSky();
      gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); gl.frontFace(gl.CCW);
      gl.uniformMatrix4fv(U("V"), false, V); gl.uniformMatrix4fv(U("P"), false, P); gl.uniform2f(U("fogR"), CFG.fog ? CFG.view*.45 : 1e4, CFG.fog ? CFG.view : 1e4 + 1); gl.uniform3fv(U("tint"), TINT); gl.uniform3fv(U("sky"), SKY);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(U("tex"), 0);
      gl.uniform1f(U("mode"), 0); gl.uniform1f(U("alpha"), 1); gl.uniformMatrix4fv(U("M"), false, I4());
      chunks[0].forEach(m => { bind(m); gl.drawElements(gl.TRIANGLES, m.c, gl.UNSIGNED_SHORT, 0); });
      gl.disable(gl.CULL_FACE); gl.uniform1f(U("cut"), .55); (chunks[2] || []).forEach(m => { bind(m); gl.drawElements(gl.TRIANGLES, m.c, gl.UNSIGNED_SHORT, 0); }); gl.uniform1f(U("cut"), .08); gl.enable(gl.CULL_FACE);   // 透明邊切乾淨，不會有黑黑的毛邊   // 樹葉、櫻花（兩面都畫）
      // 貓、花
      gl.uniform1f(U("mode"), 1); bind(cube);
      const puff = (m, col, a = 1) => { bind(ball); gl.uniform1f(U("mode"), 2); gl.disable(gl.CULL_FACE); box(m, col, a); gl.enable(gl.CULL_FACE); bind(cube); gl.uniform1f(U("mode"), 1); };
      // 樹葉、櫻花：照 LEAF_STYLE 畫（window.__leafStyle 可以換，給站長挑樣式用）
      puffs.forEach(([x, y, z, b, top]) => drawLeaf(0, x, y, z, b, top, t, puff));
      const TS = window.__treeStyle != null ? window.__treeStyle : TREE_STYLE;
      trees.forEach(tr => { if(TS < 0) tr.blocks.forEach(([x, y, z, b, top]) => drawLeaf(0, x, y, z, b, top, t, puff)); else drawTree(TS, tr, t, puff); });
      // 小花、小蘑菇（被方塊蓋住的就不畫）
      { const fa = AIM && AIM.take && AIM.take.kind === "flower" ? AIM.take.i : -1; world.flowers.forEach((f0, fi) => { if(f0.gone) return; const ix = Math.floor(f0.x), iz = Math.floor(f0.z); if(world.get(ix, f0.y, iz) || !world.get(ix, f0.y - 1, iz)) return;
        const f = fi === fa ? Object.assign({}, f0, { x:f0.x + (brk ? Math.sin(t*50)*.03 : 0), y:f0.y + (brk ? 0 : .03 + Math.sin(t*7)*.02) }) : f0, s = f.s;
        if(f.m){ box(chain(T(f.x, f.y + .08*s, f.z), S(.07*s, .16*s, .07*s)), "#fff6ea"); puff(chain(T(f.x, f.y + .19*s, f.z), S(.24*s, .13*s, .24*s)), "#ef8a8a"); puff(chain(T(f.x + .05*s, f.y + .24*s, f.z + .04*s), S(.05*s, .03*s, .05*s)), "#ffffff"); return; }
        box(chain(T(f.x, f.y + .12*s, f.z), S(.035, .24*s, .035)), "#7cbf6e"); box(chain(T(f.x + .05, f.y + .08*s, f.z), RY(f.a), RZ(.6), S(.1*s, .02, .05*s)), "#8fd080");
        for(let k = 0; k < 5; k++){ const a = f.a + k*Math.PI*2/5; puff(chain(T(f.x + Math.cos(a)*.055*s, f.y + .27*s, f.z + Math.sin(a)*.055*s), S(.075*s, .035*s, .075*s)), f.c); }
        puff(chain(T(f.x, f.y + .285*s, f.z), S(.05*s, .04*s, .05*s)), f.c === "#ffe08a" ? "#f2a65a" : "#ffd36b"); }); }
      if(dist > .6 && !window.__camT && (cam.bk || 0) < .5) drawKid(player, t);   // 鏡頭被擠到頭裡面時先不畫自己
      pets.forEach(p => drawCat(p, t));
      if(yarn) drawBall();
      (window.__furn || []).forEach(f => (f.v ? drawFurnV : drawFurn)(f.id, f.x, f.y, f.z, f.r, t));   // 測試用
      { const ai = AIM && AIM.take && AIM.take.kind === "furn" ? AIM.take.i : -1;   // 準星瞄到的家具會輕輕跳
        FSAVE.placed.forEach((f, i) => { const sh = brk && i === ai ? Math.sin(t*55)*.025 : 0; drawFurnV(f.id, f.x + .5 + sh, f.y + (i === ai && !brk ? .05 + Math.sin(t*7)*.04 : 0), f.z + .5 - sh, f.r, t); }); }
      // 挖方塊噴出來的小碎塊、剛放好的方塊閃一下
      for(let k = fx.length - 1; k >= 0; k--){ const f = fx[k]; f.life -= dt; if(f.life <= 0){ fx.splice(k, 1); continue; } f.vy -= 12*dt; f.x += f.vx*dt; f.y += f.vy*dt; f.z += f.vz*dt; box(chain(T(f.x, f.y, f.z), S(.12, .12, .12)), f.c); }
      // 腳下的影子：人、貓、家具下面淡淡的一圈，看起來是站在地上（不是浮著）
      { gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-1, -2);
        bind(ball); gl.uniform1f(U("mode"), 1);
        const blob = (x, y, z, w, d, a) => box(chain(T(x, y + .015, z), S(w, .01, d)), "#2e2333", a);
        const under = e => { let gy = e.y, k = 0; while(k < 5 && !solid(e.x, gy - .05, e.z)){ gy = Math.floor(gy - .05); k++; } return { gy, h: e.y - gy }; };
        if((cam.bk || 0) < .5){ const u = under(player); blob(player.x, u.gy, player.z, .62/(1 + u.h*.5), .62/(1 + u.h*.5), .2/(1 + u.h)); }
        for(const pt of pets){ const u = under(pt); blob(pt.x, u.gy, pt.z, .55*pt.s, .55*pt.s, .16/(1 + u.h)); }
        for(const f of FSAVE.placed){ const b = furnCells(f).box; blob((b[0] + b[3])/2, f.y, (b[2] + b[5])/2, (b[3] - b[0])*1.08, (b[5] - b[2])*1.08, F_FLAT.has(f.id) ? .06 : .17); }
        gl.disable(gl.POLYGON_OFFSET_FILL); gl.depthMask(true); gl.disable(gl.BLEND); bind(cube); }
      if(buildOn) paintAim();
      breakStep(dt);
      if(buildOn && AIM){   // 準星的預覽：瞄到的方塊外框、要放的位置半透明
        gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        const tk = AIM.take; if(tk && tk.kind === "block" && tool !== "furn"){ const c = tk.bad ? "#d0506e" : "#3a2830", e = .035, q = .5;
          for(const [ax, ay, az] of [[1,0,0],[0,1,0],[0,0,1]]) for(const s1 of [-1, 1]) for(const s2 of [-1, 1]){
            const off = ax ? [0, s1*q, s2*q] : ay ? [s1*q, 0, s2*q] : [s1*q, s2*q, 0];
            box(chain(T(tk.x + .5 + off[0], tk.y + .5 + off[1], tk.z + .5 + off[2]), S(ax ? 1.04 : e, ay ? 1.04 : e, az ? 1.04 : e)), c, .85); } }
        const pp = AIM.put;
        if(pp && pp.kind === "block"){ gl.depthMask(false);   // 要放的位置：很淡的方塊＋細細的邊框（站長說太亮）
          const pc = pp.bad ? "#e0607a" : (TILE_COL[BT[pick].t[1]] || ["#ffffff"])[0];
          box(chain(T(pp.x + .5, pp.y + .5, pp.z + .5), S(.98, .98, .98)), pc, .16);
          for(const [ax, ay, az] of [[1,0,0],[0,1,0],[0,0,1]]) for(const s1 of [-1, 1]) for(const s2 of [-1, 1]){ const off = ax ? [0, s1*.5, s2*.5] : ay ? [s1*.5, 0, s2*.5] : [s1*.5, s2*.5, 0];
            box(chain(T(pp.x + .5 + off[0], pp.y + .5 + off[1], pp.z + .5 + off[2]), S(ax ? 1.02 : .025, ay ? 1.02 : .025, az ? 1.02 : .025)), pp.bad ? "#e0607a" : "#ffffff", .55); }
          gl.depthMask(true); }
        if(pp && pp.kind === "furn"){ gl.depthMask(false); FV_A = .38; if(pp.bad) gl.uniform3fv(U("tint"), [1, .45, .5]);
          drawFurnV(pp.f.id, pp.f.x + .5, pp.f.y, pp.f.z + .5, pp.f.r, t); FV_A = 1; gl.uniform3fv(U("tint"), TINT); gl.depthMask(true); }
        if(brk && AIM.take && AIM.take.kind !== "flower"){   // 裂痕：貼在要拿的方塊（或家具外框）上，越按越裂
          const tk = AIM.take, b = tk.kind === "furn" ? furnCells(FSAVE.placed[tk.i]).box : [tk.x, tk.y, tk.z, tk.x + 1, tk.y + 1, tk.z + 1], st = Math.min(4, Math.floor(brk.t/brk.dur*5)), [u0, v0, u1, v1] = tileUV(246 + st);
          bind(tcube); gl.uniform1f(U("mode"), 0); gl.uniform4f(U("uvR"), u0, v0, u1 - u0, v1 - v0); gl.uniform1f(U("cut"), .05); gl.depthFunc(gl.LEQUAL); gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-2, -4);
          gl.uniformMatrix4fv(U("M"), false, chain(T((b[0] + b[3])/2, (b[1] + b[4])/2, (b[2] + b[5])/2), S(b[3] - b[0] + .012, b[4] - b[1] + .012, b[5] - b[2] + .012))); gl.uniform1f(U("alpha"), 1); gl.drawElements(gl.TRIANGLES, boundC, gl.UNSIGNED_SHORT, 0);
          gl.disable(gl.POLYGON_OFFSET_FILL); gl.depthFunc(gl.LESS); gl.uniform1f(U("cut"), .08); gl.uniform4f(U("uvR"), 0, 0, 1, 1); gl.uniform1f(U("mode"), 1); bind(cube); }
        gl.disable(gl.BLEND); }
      if(flash.t > 0){ flash.t -= dt; gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); box(chain(T(flash.x + .5, flash.y + .5, flash.z + .5), S(1.04, 1.04, 1.04)), "#ffffff", flash.t*2); gl.disable(gl.BLEND); }
      // 雲海和飄來飄去的雲（白白的大方塊，半透明）
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.uniform1f(U("mode"), 1); bind(cube);
      if(CFG.clouds){ bind(ball); gl.uniform1f(U("mode"), 3); gl.disable(gl.CULL_FACE);   // 圓圓蓬蓬的雲
        CLOUDS.forEach(c => { const x = ((c.x + t*c.v) % 140 + 140) % 140 - 42; for(const [ox, oy, oz, sx, sy, sz] of c.parts) box(chain(T(x+ox, c.y+oy, c.z+oz), S(sx*1.25, sy*1.3, sz*1.25)), "#ffffff", c.a); });
        gl.enable(gl.CULL_FACE); bind(cube); gl.uniform1f(U("mode"), 1); }
      // 飄落的櫻花瓣（在你附近慢慢飄）
      if(CFG.clouds){ bind(ball); gl.uniform1f(U("mode"), 2); gl.disable(gl.CULL_FACE);
        PETALS.forEach(q => { q.y -= dt*.45; q.x += Math.sin(t*.8 + q.p)*dt*.5 + dt*.25; q.z += Math.cos(t*.6 + q.p)*dt*.3; q.r += dt*q.w;
          if(q.y < player.y - 2 || Math.hypot(q.x - player.x, q.z - player.z) > 13){ const a = Math.random()*Math.PI*2, d = 2 + Math.random()*10; q.x = player.x + Math.cos(a)*d; q.z = player.z + Math.sin(a)*d; q.y = player.y + 4 + Math.random()*5; }
          box(chain(T(q.x, q.y, q.z), RY(q.r), RX(Math.sin(q.r*1.3)*.9), S(.13, .018, .09)), q.c, .92); });
        gl.enable(gl.CULL_FACE); bind(cube); gl.uniform1f(U("mode"), 1); }
      if(STAR > .02){ gl.uniform3fv(U("tint"), [1,1,1]); gl.uniform2f(U("fogR"), 1e4, 1e4 + 1); gl.depthMask(false);
        STARS.forEach(([x, y, z, r], k) => box(chain(T(eye[0] + x, eye[1] + y - 8, eye[2] + z), S(r, r, r)), "#fff8d8", STAR*(.55 + .45*Math.sin(t*1.3 + k)))); gl.depthMask(true);
        gl.uniform3fv(U("tint"), TINT); gl.uniform2f(U("fogR"), CFG.fog ? CFG.view*.45 : 1e4, CFG.fog ? CFG.view : 1e4 + 1); }
      gl.disable(gl.BLEND);
      // 水和玻璃最後畫（半透明）
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); gl.disable(gl.CULL_FACE);
      gl.uniform1f(U("mode"), 0); gl.uniform1f(U("alpha"), 1); gl.uniformMatrix4fv(U("M"), false, I4());
      chunks[1].forEach(m => { bind(m); gl.drawElements(gl.TRIANGLES, m.c, gl.UNSIGNED_SHORT, 0); });
      gl.depthMask(true); gl.disable(gl.BLEND);

      // 名字、愛心（HTML 疊在上面，用像素圖示）
      let html = "";
      const cs = npc;
      pets.forEach(p => { const c = cs[p.i]; if(!c) return; const q = project(p.x, p.y + 1.15*p.s + .25, p.z, V, P); if(!q || q[2] > 16) return;
        if(CFG.names || p.fam) html += `<div class="p3dNmTag${p.i === near ? " on" : ""}${p.fam ? " fam" : ""}" style="transform:translate(${q[0]}px,${q[1]}px) translate(-50%,-100%)">${p.fam && o.icon ? `<span class="p3dIc">${o.icon("paw")}</span>` : ""}${o.esc(c.name)}</div>`;
        if(p.sleep > .5) html += `<div class="p3dZz" style="transform:translate(${q[0] + 18}px,${q[1] - 16 - (t*14 % 18)}px) translate(-50%,-100%);opacity:${1 - (t*14 % 18)/18}">Z<small>z</small></div>`;
        if(p.love > 0){ const k = 2.2 - p.love; html += `<div class="p3dHeart" style="transform:translate(${q[0]}px,${q[1] - 18 - k*26}px) translate(-50%,-100%);opacity:${Math.min(1, p.love)}">${o.icon ? o.icon("heart") : "♥"}</div>`; } });
      if(labels._h !== html){ labels._h = html; labels.innerHTML = html; }
    }
    furnInit();
    raf = requestAnimationFrame(frame);

    return { close, _state:{ player, pets, cam, world, rebuild: buildWorld, FURN, FSAVE, furnIcon } };
    }   // build 結束
    function close(){
      if(dead) return; dead = true; cancelAnimationFrame(raf); offAll(); cur = null;
      try{ if(screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); }catch(e){}
      try{ if(document.fullscreenElement) document.exitFullscreen().catch(()=>{}); }catch(e){}
      document.body.classList.remove("p3dOn"); root.remove();
      try{ const ext = gl && gl.getExtension("WEBGL_lose_context"); if(ext) ext.loseContext(); }catch(e){}
      o.onClose && o.onClose();
    }
  }
  window.Cube3D = { open, AVATARS, HAIRS, HAIR_COLORS, portrait, avOf };
})();

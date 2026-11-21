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
    ["繡球・粉紅", "#f2b0c4", "face"], ["繡球・天空藍", "#9cbff0", "face"], ["繡球・紫色", "#b896e0", "face"], ["繡球・白綠", "#dfeed2", "face"], ["繡球・粉藍紫混色", "#c8bfe8", "face"],
    ["繡球・大朵", "#b8c8ee", "face"], ["繡球・小碎花", "#b8c8ee", "face"], ["繡球・帶葉子", "#8cc68c", "face"], ["繡球・和紙淡色", "#dfe2ee", "face"], ["繡球・彩虹", "#e8dcf0", "face"], ["繡球・圓球花團", "#b8c8ee", "rand"],
  ];
  const FOL_INNER = [...new Set(FOL_STYLES.map(x => x[1]).filter(Boolean))];
  function makeAtlas(){
    const N = 64, COLS = 8, cv = document.createElement("canvas"); cv.width = cv.height = N*COLS; const g = cv.getContext("2d");
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
      () => { bg(W.g); sh(() => el(18, 20, 10, 7), lt(W.g, .15)); sh(() => el(44, 42, 12, 8), lt(W.g, .1)); plum(46, 14, 5, W.f); plum(16, 48, 4.5, "#f3d6da"); edge(); },
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
      () => { bg(W.cl); for(const [x, y, q] of [[18,18,10],[44,40,12]]){ el(x, y, q, q*.7); g.fillStyle = "rgba(255,255,255,.6)"; g.fill(); } edge(); },
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
    const HYD = [
      [["#f7b6c8", "#f9c4d4", "#f2a2b8"], 18, 1, 0, "spiral"],          // 粉紅
      [["#8fb8f0", "#a6c8f6", "#7aa6e8"], 18, 1, 0, "spiral"],          // 天空藍
      [["#b48ee0", "#c4a2ea", "#a37ad6"], 18, 1, 0, "spiral"],          // 紫色
      [["#f4f8ee", "#e6f2da", "#ffffff"], 18, 1, 0, "spiral"],          // 白綠
      [["#f7b6c8", "#a6c8f6", "#c4a2ea"], 18, 1, 0, "mix"],             // 粉藍紫混色
      [["#a8c8f2", "#b9a8ee", "#c8d8fa"], 9, 1.55, 0, "spiral"],        // 大朵
      [["#a8c8f2", "#b9a8ee", "#c8d8fa"], 34, .7, 0, "spiral"],         // 小碎花
      [["#a8c8f2", "#b9a8ee", "#c8d8fa"], 14, 1, 1, "spiral"],          // 帶大葉子
      [["#d6dcef", "#e4d6ea", "#dfe8f2"], 18, 1, 0, "spiral"],          // 和紙淡色
      [["#f7a7b8", "#ffe08a", "#a8d8ff", "#cdb4f0", "#a8e6c4"], 18, 1, 0, "mix"],   // 彩虹
      [["#a8c8f2", "#b9a8ee", "#c8d8fa"], 22, .9, 0, "ball"],           // 一顆一顆圓球花團
    ];
    HYD.forEach(([cols, n, sz, lv, lay], k) => { const ox = ((52 + k) % COLS)*N, oy = Math.floor((52 + k) / COLS)*N; g.save(); g.translate(ox, oy); g.beginPath(); g.rect(0, 0, N, N); g.clip(); g.clearRect(0, 0, N, N);
      const E2 = (x, y, rx, ry, a, c) => { g.save(); g.translate(x, y); g.rotate(a); g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, Math.PI*2); g.fillStyle = c; g.fill(); g.restore(); };
      if(lv) for(const [x, y, a] of [[14, 48, -.8], [50, 46, .8]]){ g.save(); g.translate(x, y); g.rotate(a); g.beginPath(); g.ellipse(0, 0, 9, 14, 0, 0, Math.PI*2); g.fillStyle = "#7fbf7a"; g.fill(); g.strokeStyle = "rgba(255,255,255,.4)"; g.lineWidth = 1; g.beginPath(); g.moveTo(0, -12); g.lineTo(0, 12); g.stroke(); g.restore(); }
      const floret = (x, y, s, c) => { for(let j = 0; j < 4; j++) E2(x + Math.cos(j*1.57 + .4)*3.2*s, y + Math.sin(j*1.57 + .4)*3.2*s, 3.4*s, 2.4*s, j*1.57 + .4, c); g.beginPath(); g.arc(x, y, 1*s, 0, Math.PI*2); g.fillStyle = "#fff"; g.fill(); };
      if(lay === "ball"){ for(const [cx, cy, rr] of [[22, 24, 13], [44, 28, 12], [32, 46, 13]]){ g.beginPath(); g.arc(cx, cy, rr, 0, Math.PI*2); g.fillStyle = cols[2]; g.fill(); for(let j = 0; j < 9; j++){ const an = j*2.4, d = Math.sqrt(j/9)*rr*.75; floret(cx + Math.cos(an)*d, cy + Math.sin(an)*d, .62, cols[j % 2]); } } }
      else for(let j = 0; j < n; j++){ const an = j*2.4, d = Math.sqrt(j/n)*25; floret(32 + Math.cos(an)*d, 32 + Math.sin(an)*d, sz, lay === "mix" ? cols[(j*7) % cols.length] : cols[j % cols.length]); }
      g.restore(); });

    // 顏色格（材質格 52 切成 8×8 小格，給 30 款樹葉裡面那層用）
    { const ox = (63 % COLS)*N, oy = Math.floor(63 / COLS)*N; FOL_INNER.forEach((c, k) => { g.fillStyle = c; g.fillRect(ox + (k % 8)*8, oy + Math.floor(k / 8)*8, 8, 8); }); }
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
    const blob = (cx, cz, top, R, seed) => { const q = rng(seed);
      const bumps = Array.from({ length: 6 }, () => [q()*Math.PI*2, .75 + q()*.5]);
      for(let x = Math.floor(cx-R-3); x <= cx+R+3; x++) for(let z = Math.floor(cz-R-3); z <= cz+R+3; z++){
        const ang = Math.atan2(z-cz, x-cx); let rr = R; for(const [ph, k] of bumps) rr += Math.cos(ang*3 - ph)*k*.6;
        const d = Math.hypot(x+.5-cx, z+.5-cz); if(d > rr) continue;
        const depth = 1 + Math.floor((1 - d/rr) * Math.min(5, R*.45)) + (q() < .3 ? 1 : 0);
        for(let y = top - depth; y <= top; y++) set(x, y, z, y === top ? B.CLOUD : B.CLOUDB);
      } };
    blob(CX, CZ, GY, 14.5, 11);
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
    for(const [x,z,h,lf] of [[19,22,4,B.SAKURA],[37,33,5,B.LEAF],[22,37,4,B.LEAF],[36,20,3,B.SAKURA]]) tree(x,z,h,lf);
    // 小花、小蘑菇（裝飾，不會擋路）
    const flowers = [], FC = ["#f7a7b8", "#ffe08a", "#ffffff", "#cdb4f0", "#f28b82", "#a8d8ff"];
    for(let k = 0; k < 70; k++){ const x = CX - 13 + r()*26, z = CZ - 13 + r()*26, ix = Math.floor(x), iz = Math.floor(z), ty = topY(ix, iz);
      if(ty !== GY || get(ix, ty, iz) !== B.CLOUD) continue; if(x > hx - 2 && x < hx + hw + 1 && z > hz - 2 && z < hz + hd + 4) continue;
      flowers.push({ x, y: ty + 1, z, c: FC[k % FC.length], m: k % 9 === 0, s: .8 + r()*.5, a: r()*6 }); }
    return { v, get, set, topY, flowers, spawn:[dx+.5, fy+1, hz+hd+2.5], house:{ x:hx+hw/2, z:hz+hd/2 }, floor: fy };
  }

  // ---------- 著色器 ----------
  const VS = `attribute vec3 p; attribute vec3 n; attribute vec2 uv; attribute float sh;
  uniform mat4 M, V, P; uniform vec2 fogR; varying vec2 vuv; varying float vsh, vfog; varying vec3 vn, vvn;
  void main(){ vec4 w = M*vec4(p,1.); vec4 e = V*w; vfog = clamp((-e.z - fogR.x)/(fogR.y - fogR.x), 0., 1.); vuv = uv; vsh = sh; vn = normalize(mat3(M)*n); vvn = mat3(V)*vn; gl_Position = P*e; }`;
  const FS = `precision mediump float; varying vec2 vuv; varying float vsh, vfog; varying vec3 vn, vvn;
  uniform sampler2D tex; uniform float mode, alpha; uniform vec3 col, sky, tint;
  void main(){
    vec3 c; float a = alpha;
    if(mode < .5){ vec4 t = texture2D(tex, vuv); if(t.a < .08) discard; c = t.rgb*vsh; a *= t.a; }
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
    const root = document.createElement("div"); root.className = "p3d";
    root.innerHTML = `<canvas class="p3dC"></canvas><div class="p3dL" id="p3dL"></div>
      <div class="p3dTop"><button class="p3dX" id="p3dX"><span class="p3dBack"></span><span>離開</span></button><span class="p3dT">喵喵方塊島</span><span class="p3dF" id="p3dF" hidden></span><span class="p3dFps" id="p3dFps" hidden></span><button class="p3dX p3dBuildT" id="p3dBuildT">${o.icon ? `<span class="p3dIc">${o.icon("home")}</span>` : ""}<span>蓋房子</span></button><button class="p3dX p3dGear" id="p3dGear">${o.icon ? `<span class="p3dIc">${o.icon("gear")}</span>` : ""}<span>設定</span></button></div>
      <div class="p3dSet" id="p3dSet" hidden></div>
      <div class="p3dTalk" id="p3dTalk" hidden></div>
      <div class="p3dBuild" id="p3dBuild" hidden><div class="p3dTool" id="p3dTool"><button data-t="put" class="on">放方塊</button><button data-t="dig">挖方塊</button></div><button class="p3dUndo" id="p3dUndo">復原</button><div class="p3dBar" id="p3dBar"></div><div class="p3dBHint" id="p3dBHint">點畫面上的方塊：放在那一面／挖掉它</div><div class="p3dCnt" id="p3dCnt"></div></div><div class="p3dClock" id="p3dClock"></div>
      <div class="p3dHint" id="p3dHint">左下搖桿走路・右邊拖曳轉鏡頭</div>
      <div class="p3dRot" id="p3dRot"><div class="p3dRotPh"><i></i></div><div>把手機轉橫的玩</div><button id="p3dRotX">直的也沒關係</button></div>
      <div class="p3dJoy" id="p3dJoy"><i></i></div>
      <div class="p3dBtns"><div class="p3dAct" id="p3dAct"></div><button class="p3dJump" id="p3dJump">跳</button></div>`;
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
    let EDITS = {}; try{ EDITS = JSON.parse(localStorage.getItem("mw_cube_edits") || "{}") || {}; }catch(e){}
    let nEdit = 0;
    for(const k in EDITS){ const [x, y, z] = k.split(",").map(Number);
      if(!(y > 0 && y < H) || (ORIG.get(x, y, z) || 0) === EDITS[k] || nEdit >= MAX_EDITS){ delete EDITS[k]; continue; } world.set(x, y, z, EDITS[k]); nEdit++; }
    const saveEdits = () => { try{ localStorage.setItem("mw_cube_edits", JSON.stringify(EDITS)); }catch(e){} };
    // 記一格的改變：改回原本的就刪掉，回傳 false 代表超過上限
    function editCell(x, y, z, b){ const k = `${x},${y},${z}`, orig = ORIG.get(x, y, z) || 0;
      if(b === orig){ if(k in EDITS){ delete EDITS[k]; nEdit--; } return true; }
      if(!(k in EDITS)){ if(nEdit >= MAX_EDITS) return false; nEdit++; } EDITS[k] = b; return true; }
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
    function buildWorld(){
      chunks.forEach(c => c.forEach(m => [m.p,m.n,m.uv,m.sh,m.i].forEach(b => gl.deleteBuffer(b)))); chunks = []; puffs = [];
      { let n = 0; for(let i = 0; i < world.v.length; i++) if(world.v[i] === B.LEAF || world.v[i] === B.SAKURA) n++; puffOK = n <= 600; }
      FOL = { P:[], N:[], UV:[], SH:[], I:[], out:[] };
      for(const pass of [0, 1]){
        let P = [], N = [], UV = [], SH = [], I = []; const out = [];
        const flush = () => { if(I.length) out.push(mesh(P, N, UV, SH, I)); P = []; N = []; UV = []; SH = []; I = []; };
        for(let y = 0; y < H; y++) for(let z = 0; z < D; z++) for(let x = 0; x < W; x++){
          const b = world.get(x,y,z); if(!b) continue; const bt = BT[b]; if(!!bt.clear !== !!pass) continue;
          const em = { P, N, UV, SH, I, push(){} };
          if(b === B.ROOF){ const rs = roofShape(x, y, z); if(rs){ emitRoof(x, y, z, rs, bt, P, N, UV, SH, I); if(P.length/3 > 60000) flush(); continue; } }
          if(b === B.LOG){ emitPost(x, y, z, bt, P, N, UV, SH, I); if(P.length/3 > 60000) flush(); continue; }
          if(b === B.LEAF || b === B.SAKURA){ emitFoliage(x, y, z, b); continue; }
          if(b === B.GLASS){ emitPane(x, y, z, bt, P, N, UV, SH, I); if(P.length/3 > 60000) flush(); continue; }
          void em;
          for(const f of FACES){
            const nb = world.get(x+f.n[0], y+f.n[1], z+f.n[2]);
            if(nb && (!BT[nb].clear || nb === b) && !shaped(x+f.n[0], y+f.n[1], z+f.n[2])) continue;
            if(b === B.WATER && f.n[1] !== 1 && nb) continue;
            const [u0,v0,u1,v1] = tileUV(bt.t[f.t]), base = P.length/3, yo = b === B.WATER && f.n[1] === 1 ? -.12 : 0;
            f.c.forEach((c, k) => { P.push(x+c[0], y+c[1]+(c[1] ? yo : 0), z+c[2]); N.push(...f.n); SH.push(f.l * (y < 2 && f.n[1] === 0 ? .9 : 1)); });
            UV.push(u0,v1, u1,v1, u1,v0, u0,v0);
            I.push(base, base+1, base+2, base, base+2, base+3);
            if(P.length/3 > 60000) flush();
          }
        }
        flush(); chunks.push(out);
      }
      if(FOL.I.length) FOL.out.push(mesh(FOL.P, FOL.N, FOL.UV, FOL.SH, FOL.I)); chunks.push(FOL.out);
      groupTrees();
    }
    // 樹葉、櫻花：每一格放幾片「一叢葉子／一叢小花」的透明貼圖，方向亂亂的，疊起來就是蓬蓬的樹冠（不是方塊）
    let FOL = null;
    const FOL_PICK = -1;   // 站長選好的樹葉款式（-1 = 還沒選，用乾淨版）；window.__fol 可以暫時換來看
    function emitFoliage(x, y, z, b){ const sel = window.__fol != null ? window.__fol : FOL_PICK; if(sel >= 0) return emitFol30(x, y, z, b, sel); return emitFolClean(x, y, z, b); }
    function emitFol30(x, y, z, b, sel){ const F = FOL, [nm, inner, mode] = FOL_STYLES[sel], [u0,v0,u1,v1] = tileUV(22 + sel), q = rng(((x*73856093) ^ (y*19349663) ^ (z*83492791)) >>> 0); void nm;
      const isF = (a, b2, c) => { const nb = world.get(a, b2, c); return nb === B.LEAF || nb === B.SAKURA; };
      const quad = (pts, uv, l) => { const base = F.P.length/3, nv = nrm(cross(sub(pts[1], pts[0]), sub(pts[2], pts[0]))); for(const p of pts){ F.P.push(...p); F.N.push(...nv); F.SH.push(l); } F.UV.push(...uv); F.I.push(base, base+1, base+2, base, base+2, base+3); };
      const UVq = [u0,v1, u1,v1, u1,v0, u0,v0];
      const card = (cc, ex, ey, sz, l) => quad([[-1,-1],[1,-1],[1,1],[-1,1]].map(([a, b2]) => [cc[0] + (ex[0]*a + ey[0]*b2)*sz, cc[1] + (ex[1]*a + ey[1]*b2)*sz, cc[2] + (ex[2]*a + ey[2]*b2)*sz]), UVq, l);
      let swUV = null; if(inner){ const k = FOL_INNER.indexOf(inner), s0 = 1/atlas.COLS, bu = (63 % atlas.COLS)*s0, bv = Math.floor(63 / atlas.COLS)*s0, cu = bu + ((k % 8)*8 + 4)/(atlas.N*atlas.COLS), cv2 = bv + (Math.floor(k / 8)*8 + 4)/(atlas.N*atlas.COLS); swUV = [cu,cv2, cu,cv2, cu,cv2, cu,cv2]; }
      const open = FACES.filter(f => !isF(x+f.n[0], y+f.n[1], z+f.n[2]));
      if(mode === "face" || mode === "hang"){
        for(const f of open){ const [nx, ny, nz] = f.n; const nb = world.get(x+nx, y+ny, z+nz); if(nb && !BT[nb].clear && !shaped(x+nx, y+ny, z+nz)) continue;
          if(swUV) quad(f.c.map(c => [x + .5 + (c[0] - .5)*.86, y + .5 + (c[1] - .5)*.86, z + .5 + (c[2] - .5)*.86]), swUV, f.l*.95);
          if(mode === "hang" && ny === 1) continue;
          const t1 = nx ? [0, 1, 0] : [1, 0, 0], t2 = cross(f.n, t1), nC = mode === "hang" ? 2 : 3;
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
    const solid = (x,y,z) => { const b = world.get(Math.floor(x), Math.floor(y), Math.floor(z)); return b && BT[b].solid; };
    function hits(px,py,pz,w,h){ for(const dx of [-w,w]) for(const dz of [-w,w]) for(const dy of [0.01, h/2, h-.01]) if(solid(px+dx, py+dy, pz+dz)) return true; return false; }
    function move(e, mx, mz, dt, w = .3, h = .9){   // 切成小步，掉很快或手機很卡時也不會穿過方塊
      const n = Math.ceil(dt/.02); for(let i = 0; i < n; i++) move1(e, mx, mz, dt/n, w, h); }
    function move1(e, mx, mz, dt, w, h){
      const step = (ax, v) => { if(!v) return; const nx = e.x + (ax === 0 ? v : 0), nz = e.z + (ax === 2 ? v : 0);
        if(!hits(nx, e.y, nz, w, h)) { e.x = nx; e.z = nz; return; }
        if(e.onG && !hits(nx, e.y+1.05, nz, w, h) && !hits(e.x, e.y+1.05, e.z, w, h)){ e.vy = 7; e.onG = false; return; }   // 自動跳上一格（跳高 1.2 格，確定跳得上去）
        // 差一點點對準門口／縫隙時，自動往旁邊滑進去（不用很準也走得進門）
        const px = ax === 0 ? 0 : 1, pz = ax === 0 ? 1 : 0, sp = Math.abs(v);
        for(const off of [.08, .16, .24, .32, .4, .5]) for(const sg of [-1, 1]){ const ox = px*off*sg, oz = pz*off*sg;
          if(!hits(nx + ox, e.y, nz + oz, w, h) && !hits(e.x + ox, e.y, e.z + oz, w, h)){ const m = Math.min(off, sp); e.x += px*m*sg; e.z += pz*m*sg; return; } }
      };
      step(0, mx*dt); step(2, mz*dt);
      e.vy = Math.max(-22, e.vy - 20*dt); const ny = e.y + e.vy*dt;
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
    cv.addEventListener("pointermove", e => { if(e.pointerId !== dragId) return; if(tap0) tap0.m = Math.max(tap0.m, Math.hypot(e.clientX - tap0.x, e.clientY - tap0.y)); cam.yaw -= (e.clientX - lx)*.0085*CFG.sens; cam.pitch = Math.max(.08, Math.min(1.25, cam.pitch + (e.clientY - ly)*.006*CFG.sens*(CFG.invY ? -1 : 1))); lx = e.clientX; ly = e.clientY; });
    const cEnd = e => { if(e.pointerId !== dragId) return; dragId = null;
      if(e.type === "pointerup" && buildOn && tap0 && tap0.m < 10 && performance.now() - tap0.t < 400) buildAt(e.clientX, e.clientY); tap0 = null; }; cv.addEventListener("pointerup", cEnd); cv.addEventListener("pointercancel", cEnd); cv.addEventListener("lostpointercapture", cEnd);
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
    root.querySelector("#p3dJump").addEventListener("pointerdown", e => { e.preventDefault(); jump(); });
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
      if(p && p.fam){ act.innerHTML = `<div class="p3dNm fam"><b>${o.esc(c.name)}</b><small>我們家的貓${c.stage ? "・" + o.esc(c.stage) : ""}</small></div><div class="p3dActB three"><button data-a="talk">${IC("chat")}<span>聊天</span></button><button data-a="pet">${IC("paw")}<span>摸摸</span></button><button data-a="ball">${IC("yarn")}<span>丟球</span></button></div>`; return; }
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
      if(TK && p.v){ talkLv = friendLv(p.v.id); talkLines = [TK.petLine(p.v)]; talkIdx = near; talkK = 0; showLine(); clearTimeout(p._pt); p._pt = setTimeout(() => { if(talkIdx === p.i && talkLines.length === 1) endTalk(); }, 2200); }
      p.love = 2.2; p.hop = .6; p.tx = null; p.wait = 2.5; p.pets = (p.pets || 0) + 1;
      player.yaw = Math.atan2(p.x - player.x, p.z - player.z); player.petT = .5;   // 轉向小貓
      if(!TK) CFG.sound && o.sfx && o.sfx.meow && o.sfx.meow(1.2); hideHint();
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
    function paintBar(){
      const pages = Math.ceil(PALETTE.length/PER); barPg = Math.max(0, Math.min(pages - 1, barPg));
      const nav = (d, on) => `<button class="p3dPg" data-pg="${d}" ${on ? "" : "disabled"}>${d < 0 ? "◀" : "▶"}</button>`;
      barEl.innerHTML = nav(-1, barPg > 0) + PALETTE.slice(barPg*PER, barPg*PER + PER).map(b => `<button data-b="${b}" class="${b === pick ? "on" : ""}"><img src="${ICONS[b] || (ICONS[b] = blockIcon(b))}" alt=""><i>${BNAME[b]}</i></button>`).join("") + nav(1, barPg < pages - 1);
      barEl.querySelectorAll("[data-pg]").forEach(x => x.addEventListener("click", () => { barPg += +x.dataset.pg; paintBar(); }));
      barEl.querySelectorAll("[data-b]").forEach(x => x.addEventListener("click", () => { pick = +x.dataset.b; tool = "put"; paintTool(); paintBar(); CFG.sound && o.sfx && o.sfx.tap && o.sfx.tap(); }));
    }
    function paintCount(){ const el = root.querySelector("#p3dCnt"); if(!el) return; el.textContent = `已經蓋了 ${nEdit} / ${MAX_EDITS} 格`; el.classList.toggle("full", nEdit >= MAX_EDITS*.9); }
    function paintTool(){ buildEl.querySelectorAll("[data-t]").forEach(x => x.classList.toggle("on", x.dataset.t === tool)); root.classList.toggle("dig", tool === "dig"); }
    buildEl.querySelectorAll("[data-t]").forEach(x => x.addEventListener("click", () => { tool = x.dataset.t; paintTool(); }));
    function setBuild(on){
      buildOn = on; buildEl.hidden = !on; root.classList.toggle("building", on); endTalk && endTalk();
      root.querySelector("#p3dBuildT span:last-child").textContent = on ? "蓋好了" : "蓋房子";
      if(on){ paintBar(); paintTool(); paintCount(); hideHint(); }
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
    function buildAt(cx, cy){
      const h = pickRay(cx, cy); if(!h){ o.toast && o.toast("點近一點的方塊"); return; }
      if(tool === "dig"){
        if(h.y <= 0){ o.toast && o.toast("最底下的雲不能挖喔"); return; }
        if(Math.hypot(h.x + .5 - player.x, h.y + .5 - (player.y + .7), h.z + .5 - player.z) > 7){ o.toast && o.toast("太遠了，走近一點"); return; }
        const b = world.get(h.x, h.y, h.z); if(setBlock(h.x, h.y, h.z, 0, true)){ burst(h.x, h.y, h.z, b); Object.assign(flash, { t:.25, x:h.x, y:h.y, z:h.z }); CFG.sound && o.sfx && o.sfx.tap && o.sfx.tap(); }
      } else {
        if(!h.face){ return; } const x = h.x + h.face[0], y = h.y + h.face[1], z = h.z + h.face[2];
        if(y <= 0 || y >= H - 1 || x < 0 || z < 0 || x >= W || z >= D){ o.toast && o.toast("這裡不能放"); return; }
        if(Math.hypot(x + .5 - player.x, y + .5 - (player.y + .7), z + .5 - player.z) > 7){ o.toast && o.toast("太遠了，走近一點"); return; }
        const cur = world.get(x, y, z); if(cur && cur !== B.WATER) return;
        if(inBody(player, x, y, z, .28, 1.45) || pets.some(p => inBody(p, x, y, z, .25*p.s, .8*p.s))){ o.toast && o.toast("會壓到人或小貓喔"); return; }
        if(setBlock(x, y, z, pick, true)){ Object.assign(flash, { t:.25, x, y, z }); CFG.sound && o.sfx && o.sfx.tap && o.sfx.tap(); }
      }
    }
    root.querySelector("#p3dUndo").addEventListener("click", () => { const u = undo.pop(); if(!u){ o.toast && o.toast("沒有可以復原的了"); return; }
      if(!editCell(u.x, u.y, u.z, u.prev)){ undo.push(u); o.toast && o.toast("蓋滿了，不能復原這一步"); return; }
      world.set(u.x, u.y, u.z, u.prev); saveEdits(); paintCount(); buildWorld(); });

    // ---------- 設定畫面 ----------
    const clockEl = root.querySelector("#p3dClock"), fpsEl = root.querySelector("#p3dFps"), setEl = root.querySelector("#p3dSet"); let fpsN = 0, fpsT = performance.now();
    const CAMD = { s:3.6, m:5, l:6.6 };
    function applyCfg(first){
      root.dataset.joy = CFG.joy; root.dataset.ui = "c";   // 站長選了 C 精緻像素 fpsEl.hidden = !CFG.showFps; cam.dist = CAMD[CFG.camD] || 5;
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
        try{ localStorage.removeItem("mw_cube_edits"); }catch(e){} for(const k in EDITS){ const [x, y, z] = k.split(",").map(Number); world.set(x, y, z, ORIG.get(x, y, z) || 0); }
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
      const W0 = chain(T(e.x, e.y + hop + Math.abs(Math.sin(ph))*.03*wk, e.z), RY(e.yaw));
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
      move(player, mx, mz, dt, .28, 1.45); player._dt = dt; player.spd = mag; player.walk += dt*mag;
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
      const tgt = [player.x, player.y + 1.35, player.z];
      let dist = cam.dist; const dir = [Math.sin(cam.yaw)*Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw)*Math.cos(cam.pitch)];
      for(let d = .25; d <= cam.dist; d += .1){ const bx = tgt[0]+dir[0]*d, by = tgt[1]+dir[1]*d, bz = tgt[2]+dir[2]*d;
        if(solid(bx, by, bz) || solid(bx, by + .15, bz) || solid(bx, by - .15, bz)){ dist = Math.max(.3, d - .3); break; } }
      const eye = [tgt[0]+dir[0]*dist, tgt[1]+dir[1]*dist, tgt[2]+dir[2]*dist]; lastCam = { eye, tgt };
      const V = lookAt(eye, tgt, [0,1,0]), P = persp(CFG.fov*Math.PI/180, cv.width/cv.height, .05, Math.max(CFG.view + 12, STAR > .02 ? 90 : 0));

      gl.viewport(0, 0, cv.width, cv.height); gl.clearColor(SKY[0], SKY[1], SKY[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); gl.frontFace(gl.CCW);
      gl.uniformMatrix4fv(U("V"), false, V); gl.uniformMatrix4fv(U("P"), false, P); gl.uniform2f(U("fogR"), CFG.fog ? CFG.view*.45 : 1e4, CFG.fog ? CFG.view : 1e4 + 1); gl.uniform3fv(U("tint"), TINT); gl.uniform3fv(U("sky"), SKY);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(U("tex"), 0);
      gl.uniform1f(U("mode"), 0); gl.uniform1f(U("alpha"), 1); gl.uniformMatrix4fv(U("M"), false, I4());
      chunks[0].forEach(m => { bind(m); gl.drawElements(gl.TRIANGLES, m.c, gl.UNSIGNED_SHORT, 0); });
      gl.disable(gl.CULL_FACE); (chunks[2] || []).forEach(m => { bind(m); gl.drawElements(gl.TRIANGLES, m.c, gl.UNSIGNED_SHORT, 0); }); gl.enable(gl.CULL_FACE);   // 樹葉、櫻花（兩面都畫）
      // 貓、花
      gl.uniform1f(U("mode"), 1); bind(cube);
      const puff = (m, col, a = 1) => { bind(ball); gl.uniform1f(U("mode"), 2); gl.disable(gl.CULL_FACE); box(m, col, a); gl.enable(gl.CULL_FACE); bind(cube); gl.uniform1f(U("mode"), 1); };
      // 樹葉、櫻花：照 LEAF_STYLE 畫（window.__leafStyle 可以換，給站長挑樣式用）
      puffs.forEach(([x, y, z, b, top]) => drawLeaf(0, x, y, z, b, top, t, puff));
      const TS = window.__treeStyle != null ? window.__treeStyle : TREE_STYLE;
      trees.forEach(tr => { if(TS < 0) tr.blocks.forEach(([x, y, z, b, top]) => drawLeaf(0, x, y, z, b, top, t, puff)); else drawTree(TS, tr, t, puff); });
      // 小花、小蘑菇（被方塊蓋住的就不畫）
      world.flowers.forEach(f => { const ix = Math.floor(f.x), iz = Math.floor(f.z); if(world.get(ix, f.y, iz) || !world.get(ix, f.y - 1, iz)) return; const s = f.s;
        if(f.m){ box(chain(T(f.x, f.y + .08*s, f.z), S(.07*s, .16*s, .07*s)), "#fff6ea"); puff(chain(T(f.x, f.y + .19*s, f.z), S(.24*s, .13*s, .24*s)), "#ef8a8a"); puff(chain(T(f.x + .05*s, f.y + .24*s, f.z + .04*s), S(.05*s, .03*s, .05*s)), "#ffffff"); return; }
        box(chain(T(f.x, f.y + .12*s, f.z), S(.035, .24*s, .035)), "#7cbf6e"); box(chain(T(f.x + .05, f.y + .08*s, f.z), RY(f.a), RZ(.6), S(.1*s, .02, .05*s)), "#8fd080");
        for(let k = 0; k < 5; k++){ const a = f.a + k*Math.PI*2/5; puff(chain(T(f.x + Math.cos(a)*.055*s, f.y + .27*s, f.z + Math.sin(a)*.055*s), S(.075*s, .035*s, .075*s)), f.c); }
        puff(chain(T(f.x, f.y + .285*s, f.z), S(.05*s, .04*s, .05*s)), f.c === "#ffe08a" ? "#f2a65a" : "#ffd36b"); });
      if(dist > .6) drawKid(player, t);   // 鏡頭被擠到頭裡面時先不畫自己
      pets.forEach(p => drawCat(p, t));
      if(yarn) drawBall();
      // 挖方塊噴出來的小碎塊、剛放好的方塊閃一下
      for(let k = fx.length - 1; k >= 0; k--){ const f = fx[k]; f.life -= dt; if(f.life <= 0){ fx.splice(k, 1); continue; } f.vy -= 12*dt; f.x += f.vx*dt; f.y += f.vy*dt; f.z += f.vz*dt; box(chain(T(f.x, f.y, f.z), S(.12, .12, .12)), f.c); }
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
    raf = requestAnimationFrame(frame);

    return { close, _state:{ player, pets, cam, world, rebuild: buildWorld } };
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

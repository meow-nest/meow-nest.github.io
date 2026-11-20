// 喵喵方塊島的 3D 引擎：方塊世界、第三人稱、虛擬搖桿到處走，島上有小貓可以摸摸
// 用法：Cube3D.open({ meCat, meName, npcs:[{name,color}], sfx, icon, esc, onClose })
// 方塊和貓都是自己用程式畫的（像素風的方塊材質是隨機產生的），不使用任何遊戲的素材。
(function(){
  // ---------- 小工具：矩陣 ----------
  const I4 = () => [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
  function mul(a, b){ const o = new Array(16); for(let c = 0; c < 4; c++) for(let r = 0; r < 4; r++){ let v = 0; for(let k = 0; k < 4; k++) v += a[k*4+r]*b[c*4+k]; o[c*4+r] = v; } return o; }
  const T = (x,y,z) => [1,0,0,0,0,1,0,0,0,0,1,0,x,y,z,1];
  const S = (x,y,z) => [x,0,0,0,0,y,0,0,0,0,z,0,0,0,0,1];
  const RY = a => [Math.cos(a),0,-Math.sin(a),0,0,1,0,0,Math.sin(a),0,Math.cos(a),0,0,0,0,1];
  const RX = a => [1,0,0,0,0,Math.cos(a),Math.sin(a),0,0,-Math.sin(a),Math.cos(a),0,0,0,0,1];
  const chain = (...m) => m.reduce((a, b) => mul(a, b), I4());
  const sub = (a,b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]], dot = (a,b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  const cross = (a,b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]], nrm = a => { const l = Math.hypot(...a) || 1; return a.map(v => v/l); };
  function lookAt(e, c, up){ const z = nrm(sub(e, c)), x = nrm(cross(up, z)), y = cross(z, x); return [x[0],y[0],z[0],0, x[1],y[1],z[1],0, x[2],y[2],z[2],0, -dot(x,e),-dot(y,e),-dot(z,e),1]; }
  function persp(f, a, n, fa){ const t = 1/Math.tan(f/2); return [t/a,0,0,0, 0,t,0,0, 0,0,(fa+n)/(n-fa),-1, 0,0,2*fa*n/(n-fa),0]; }
  const hexc = h => [1,3,5].map(i => parseInt(h.substr(i, 2), 16)/255);
  function rng(seed){ let s = seed >>> 0 || 1; return () => (s = (s*1664525 + 1013904223) >>> 0) / 4294967296; }

  // ---------- 方塊種類和像素材質 ----------
  // 每種方塊：[上面, 側面, 下面] 用哪一格材質；solid 會擋路；clear 是半透明
  const B = { AIR:0, GRASS:1, DIRT:2, STONE:3, PLANK:4, LOG:5, LEAF:6, WATER:7, ROOF:8, SAND:9, BRICK:10, WOOL:11, GLASS:12, CLOUD:13, CLOUDB:14 };
  const BT = {
    1:{ t:[0,1,2], solid:1 }, 2:{ t:[2,2,2], solid:1 }, 3:{ t:[3,3,3], solid:1 }, 4:{ t:[4,4,4], solid:1 }, 5:{ t:[6,5,6], solid:1 },
    6:{ t:[7,7,7], solid:1 }, 7:{ t:[8,8,8], solid:0, clear:1 }, 8:{ t:[9,9,9], solid:1 }, 9:{ t:[10,10,10], solid:1 }, 10:{ t:[11,11,11], solid:1 },
    11:{ t:[12,12,12], solid:1 }, 12:{ t:[13,13,13], solid:1, clear:1 }, 13:{ t:[14,15,16], solid:1 }, 14:{ t:[16,16,16], solid:1 },
  };
  // 材質格子（16×16 像素）：用調色盤加隨機雜點畫出來
  const TILES = [
    { p:["#7fcf6a","#6bbd57","#8fdb78","#5ea94c"] },                                  // 0 草地上面
    { p:["#8a6a4a","#7a5c3e","#98785a"], top:["#7fcf6a","#6bbd57","#5ea94c"], topH:4 }, // 1 草地側面
    { p:["#8a6a4a","#7a5c3e","#98785a","#6e5236"] },                                  // 2 泥土
    { p:["#9aa0a8","#8a9098","#aab0b8","#7c828a"] },                                  // 3 石頭
    { p:["#d9a86a","#c99858","#e6b87a"], planks:1 },                                   // 4 木板
    { p:["#8a5a34","#7a4c2a","#9a6a40"], bark:1 },                                     // 5 樹幹側面
    { p:["#c9965e","#b98650","#d9a86a"], ring:1 },                                     // 6 樹幹切面
    { p:["#4fae5a","#3f9a4c","#62c06c","#358a42"] },                                  // 7 樹葉
    { p:["#5fb8e8","#4fa8d8","#7cc8f0"], a:.72 },                                      // 8 水
    { p:["#e07a7a","#d06a6a","#ee8a8a"], planks:1 },                                   // 9 屋頂（粉紅）
    { p:["#f2dfa6","#e8d296","#f8e8b6","#dcc488"] },                                  // 10 沙子
    { p:["#c8744e","#b8643e","#d8845e"], bricks:1 },                                   // 11 磚
    { p:["#f6c8d8","#ecb8cc","#fbd8e4"] },                                            // 12 毛毯（粉）
    { p:["#e8f6ff"], glass:1, a:.35 },                                                 // 13 玻璃
    { p:["#ffffff","#f6f9fe","#edf3fb","#ffffff","#fbfcff"] },                        // 14 白雲上面（暫時的素材，之後換）
    { p:["#e4ecf8","#d9e4f4","#edf2fb"], top:["#ffffff","#f6f9fe"], topH:4 },          // 15 白雲側面
    { p:["#cfdcef","#c4d3ea","#d8e3f3"] },                                            // 16 白雲下面（比較暗）
  ];
  function makeAtlas(){
    const N = 16, COLS = 8, cv = document.createElement("canvas"); cv.width = cv.height = N*COLS; const g = cv.getContext("2d"), r = rng(7);
    TILES.forEach((t, k) => { const ox = (k % COLS)*N, oy = Math.floor(k / COLS)*N;
      for(let y = 0; y < N; y++) for(let x = 0; x < N; x++){
        let pal = t.p;
        if(t.top && y < t.topH + (r() < .35 ? 1 : 0)) pal = t.top;
        let c = pal[Math.floor(r()*pal.length)];
        if(t.planks && (y % 4 === 3)) c = pal[1];
        if(t.planks && y % 4 !== 3 && x === ((Math.floor(y/4)*7) % 16)) c = pal[1];
        if(t.bark && (x % 4 === 0 || r() < .1)) c = pal[1];
        if(t.ring){ const d = Math.max(Math.abs(x-7.5), Math.abs(y-7.5)); if(Math.round(d) % 3 === 0) c = pal[1]; if(d > 6.6) c = "#8a5a34"; }
        if(t.bricks){ const row = Math.floor(y/4), off = row % 2 ? 4 : 0; if(y % 4 === 3 || (x + off) % 8 === 7) c = "#e8d8c8"; }
        if(t.glass){ c = (x === 0 || y === 0 || x === N-1 || y === N-1) ? "#ffffff" : (x === y || x === y+1) ? "#ffffff" : t.p[0]; }
        g.fillStyle = c; g.globalAlpha = t.a && !(t.glass && (x === 0 || y === 0 || x === N-1 || y === N-1)) ? t.a : 1; g.fillRect(ox+x, oy+y, 1, 1);
      } });
    g.globalAlpha = 1; return { cv, COLS, N };
  }

  // ---------- 世界 ----------
  // 世界：飄在天空的白雲島（主島＋幾塊小雲朵踏腳石），下面是雲海
  const W = 56, H = 18, D = 56, GY = 6;   // GY：主島上面的高度
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
    const tree = (x,z,h) => { const g = topY(x,z) + 1; if(g < 1) return; for(let y = g; y < g+h; y++) set(x,y,z,B.LOG);
      for(let y = g+h-2; y <= g+h+1; y++){ const rr = y > g+h ? 1 : 2; for(let a = -rr; a <= rr; a++) for(let b = -rr; b <= rr; b++){ if(Math.abs(a)+Math.abs(b) > rr+1) continue; if(!get(x+a,y,z+b)) set(x+a,y,z+b,B.LEAF); } } };
    for(const [x,z,h] of [[19,22,4],[37,33,5],[22,37,4]]) tree(x,z,h);
    void r;
    return { v, get, set, topY, flowers: [], spawn:[dx+.5, fy+1, hz+hd+2.5], house:{ x:hx+hw/2, z:hz+hd/2 }, floor: fy };
  }

  // ---------- 著色器 ----------
  const VS = `attribute vec3 p; attribute vec3 n; attribute vec2 uv; attribute float sh;
  uniform mat4 M, V, P; varying vec2 vuv; varying float vsh, vfog; varying vec3 vn, vvn;
  void main(){ vec4 w = M*vec4(p,1.); vec4 e = V*w; vfog = clamp((-e.z - 26.)/34., 0., 1.); vuv = uv; vsh = sh; vn = normalize(mat3(M)*n); vvn = mat3(V)*vn; gl_Position = P*e; }`;
  const FS = `precision mediump float; varying vec2 vuv; varying float vsh, vfog; varying vec3 vn, vvn;
  uniform sampler2D tex; uniform float mode, alpha; uniform vec3 col, sky;
  void main(){
    vec3 c; float a = alpha;
    if(mode < .5){ vec4 t = texture2D(tex, vuv); if(t.a < .08) discard; c = t.rgb*vsh; a *= t.a; }
    else if(mode < 1.5){ float d = dot(normalize(vn), normalize(vec3(-.4,.9,.5))); float l = d > .4 ? 1. : d > -.1 ? .86 : .72; c = col*l; }
    else { vec3 N = normalize(vn); float d = dot(N, normalize(vec3(-.4,.9,.5))); c = col*(.66 + .4*max(d, 0.)) + vec3(.05)*pow(max(d, 0.), 12.); }   // 平滑的光（頭髮）
    gl_FragColor = vec4(mix(c, sky, vfog), a);
  }`;

  // ---------- 貓的樣子（用小方塊拼） ----------
  const CAT = {
    orange:{ b:"#f2a65a", d:"#d9823a", l:"#fff2e0" }, white:{ b:"#f6f2ea", d:"#e2d8c8", l:"#ffffff" }, black:{ b:"#3a3540", d:"#26222c", l:"#5a5560" },
    gray:{ b:"#a8aeb8", d:"#8a909a", l:"#d8dce2" }, calico:{ b:"#f6f2ea", d:"#f2a65a", l:"#3a3540" },
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

  let cur = null;   // 同時只能開一個
  function open(o){
    if(cur) return cur;
    let last = performance.now(), raf = 0, dead = false, t0 = last, offAll = () => {};
    const root = document.createElement("div"); root.className = "p3d";
    root.innerHTML = `<canvas class="p3dC"></canvas><div class="p3dL" id="p3dL"></div>
      <div class="p3dTop"><button class="p3dX" id="p3dX">◀ 離開</button><span class="p3dT">喵喵方塊島</span><span class="p3dF" id="p3dF" hidden></span></div>
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
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const tileUV = k => { const s = 1/atlas.COLS, e = .002, u = (k % atlas.COLS)*s, v = Math.floor(k / atlas.COLS)*s; return [u+e, v+e, u+s-e, v+s-e]; };

    // 世界的網格（不透明一份、半透明一份；超過 65535 個點就分成好幾塊）
    const world = makeWorld();
    const FACES = [ // 法線、四個角、哪一面材質(0上1側2下)、亮度
      { n:[0,1,0], c:[[0,1,1],[1,1,1],[1,1,0],[0,1,0]], t:0, l:1 }, { n:[0,-1,0], c:[[0,0,0],[1,0,0],[1,0,1],[0,0,1]], t:2, l:.55 },
      { n:[1,0,0], c:[[1,0,1],[1,0,0],[1,1,0],[1,1,1]], t:1, l:.8 }, { n:[-1,0,0], c:[[0,0,0],[0,0,1],[0,1,1],[0,1,0]], t:1, l:.8 },
      { n:[0,0,1], c:[[0,0,1],[1,0,1],[1,1,1],[0,1,1]], t:1, l:.9 }, { n:[0,0,-1], c:[[1,0,0],[0,0,0],[0,1,0],[1,1,0]], t:1, l:.7 },
    ];
    let chunks = [];
    function buildWorld(){
      chunks.forEach(c => c.forEach(m => [m.p,m.n,m.uv,m.sh,m.i].forEach(b => gl.deleteBuffer(b)))); chunks = [];
      for(const pass of [0, 1]){
        let P = [], N = [], UV = [], SH = [], I = []; const out = [];
        const flush = () => { if(I.length) out.push(mesh(P, N, UV, SH, I)); P = []; N = []; UV = []; SH = []; I = []; };
        for(let y = 0; y < H; y++) for(let z = 0; z < D; z++) for(let x = 0; x < W; x++){
          const b = world.get(x,y,z); if(!b) continue; const bt = BT[b]; if(!!bt.clear !== !!pass) continue;
          for(const f of FACES){
            const nb = world.get(x+f.n[0], y+f.n[1], z+f.n[2]);
            if(nb && (!BT[nb].clear || nb === b)) continue;
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
    }
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
    const pets = npc.map((c, i) => { const a = i*2.2 + .6; return { i, x:world.house.x + Math.cos(a)*2, y:world.floor + 1, z:world.house.z + Math.sin(a)*1.6, vy:0, yaw:a, walk:0, onG:false, col:CAT[catKey(c.color)], s:.55 + (c.scale||.6)*.45, tx:null, tz:null, wait:Math.random()*2, love:0, home:[world.house.x + Math.cos(a)*2, world.floor + 1, world.house.z + Math.sin(a)*1.6] }; });
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
    joy.addEventListener("pointerdown", e => { e.preventDefault(); try{ joy.setPointerCapture(e.pointerId); }catch(_){} const r = joy.getBoundingClientRect(); J.id = e.pointerId; J.cx = r.left + r.width/2; J.cy = r.top + r.height/2; jm(e); hideHint(); });
    const jm = e => { if(e.pointerId !== J.id) return; let dx = e.clientX - J.cx, dy = e.clientY - J.cy; const R = 46, l = Math.hypot(dx, dy); if(l > R){ dx *= R/l; dy *= R/l; } J.x = dx/R; J.y = dy/R; knob.style.transform = `translate(${dx}px,${dy}px)`; };
    joy.addEventListener("pointermove", jm);
    const jEnd = e => { if(e.pointerId !== J.id) return; J.id = null; J.x = J.y = 0; knob.style.transform = ""; };
    joy.addEventListener("pointerup", jEnd); joy.addEventListener("pointercancel", jEnd); joy.addEventListener("lostpointercapture", jEnd);
    cv.addEventListener("pointerdown", e => { if(dragId !== null) return; dragId = e.pointerId; lx = e.clientX; ly = e.clientY; try{ cv.setPointerCapture(e.pointerId); }catch(_){} hideHint(); });
    cv.addEventListener("pointermove", e => { if(e.pointerId !== dragId) return; cam.yaw -= (e.clientX - lx)*.0085; cam.pitch = Math.max(.08, Math.min(1.25, cam.pitch + (e.clientY - ly)*.006)); lx = e.clientX; ly = e.clientY; });
    const cEnd = e => { if(e.pointerId === dragId) dragId = null; }; cv.addEventListener("pointerup", cEnd); cv.addEventListener("pointercancel", cEnd); cv.addEventListener("lostpointercapture", cEnd);
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
      if(player.onG || (player.air || 0) < .1 && player.vy <= 0){ player.vy = 7.2; player.onG = false; player.air = 1; jumpBuf = 0; o.sfx && o.sfx.tap && o.sfx.tap(); } }
    root.querySelector("#p3dJump").addEventListener("pointerdown", e => { e.preventDefault(); jump(); });
    root.querySelector("#p3dX").addEventListener("click", close);
    root.querySelector("#p3dRotX").addEventListener("click", () => { root.classList.add("rotOk"); });

    // 靠近寵物貓時出現「餵牠／摸摸」
    const act = root.querySelector("#p3dAct"), foodEl = root.querySelector("#p3dF");
    let near = -1, busy = false;
    function paintAct(){
      void foodEl;
      if(near < 0){ act.innerHTML = ""; return; }
      const c = npc[near]; if(!c){ act.innerHTML = ""; return; }
      act.innerHTML = `<span class="p3dNm">${o.esc(c.name)}</span><button data-a="pet">摸摸</button>`;
    }
    // 摸摸：用 pointerdown 比較靈敏；摸完 .7 秒內再按不會一直叫
    act.addEventListener("pointerdown", e => {
      const b = e.target.closest("button"); if(!b) return; e.preventDefault(); e.stopPropagation();
      const p = pets[near]; if(!p || busy) return; busy = true; setTimeout(() => { busy = false; }, 700);
      p.love = 2.2; p.hop = .6; p.tx = null; p.wait = 2.5; p.pets = (p.pets || 0) + 1;
      player.yaw = Math.atan2(p.x - player.x, p.z - player.z); player.petT = .5;   // 轉向小貓
      o.sfx && o.sfx.meow && o.sfx.meow(1.2); hideHint();
    });
    paintAct();

    // ---------- 畫面 ----------
    const labels = root.querySelector("#p3dL");
    function resize(){ const dpr = Math.min(window.devicePixelRatio || 1, 2); cv.width = Math.round(root.clientWidth*dpr); cv.height = Math.round(root.clientHeight*dpr); }
    resize(); window.addEventListener("resize", resize);
    offAll = () => { window.removeEventListener("resize", resize); window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku); window.removeEventListener("blur", release); document.removeEventListener("visibilitychange", vis); };
    const SKY = hexc("#cdeaff");
    let boundC = 36; const bind0 = bind; bind = m => { boundC = m.c; bind0(m); };
    function box(m, col, a = 1){ gl.uniformMatrix4fv(U("M"), false, m); gl.uniform3fv(U("col"), hexc(col)); gl.uniform1f(U("alpha"), a); gl.drawElements(gl.TRIANGLES, boundC, gl.UNSIGNED_SHORT, 0); }
    function drawCat(e, t){
      const k = e.col, s = e.s, sw = Math.sin(e.walk*10)*.5*Math.min(1, e.spd || 0), hop = e.hop ? Math.sin((.6 - e.hop)/.6*Math.PI)*.35 : 0;
      const W0 = chain(T(e.x, e.y + hop, e.z), RY(e.yaw), S(s, s, s));
      const at = (x,y,z, sx,sy,sz, col, r) => box(chain(W0, r || I4(), T(x,y,z), S(sx,sy,sz)), col);
      const wk = e.spd || 0, ph = e.walk*10;
      at(0,.33,0, .42,.3,.74, k.b);                                  // 身體（矮矮長長）
      at(0,.2,0, .34,.05,.56, k.l);                                   // 肚子
      if(k === CAT.calico){ at(.1,.485,.08, .24,.03,.3, "#3a3540"); at(-.1,.485,-.16, .24,.03,.26, "#f2a65a"); }
      else { at(0,.485,.08, .3,.02,.06, k.d); at(0,.485,-.1, .3,.02,.06, k.d); }   // 背上的條紋
      const hd = chain(T(0,.56,.36), RX(Math.sin(t*1.7 + e.x)*.06));
      at(0,0,0, .46,.38,.36, k.b, hd);                                // 頭
      at(0,-.1,.16, .26,.14,.08, k.l, hd);                            // 嘴邊白白的
      for(const sx of [-1, 1]){
        at(sx*.14,.24,-.02, .12,.12,.08, k.b, hd); at(sx*.14,.31,-.02, .06,.06,.06, k.b, hd);    // 尖尖的耳朵
        at(sx*.14,.25,.025, .06,.07,.02, "#ffb3c6", hd);                                        // 耳朵裡面
        at(sx*.11,.03,.185, .08,.1,.02, "#2b2430", hd); at(sx*.09,.06,.196, .03,.03,.01, "#ffffff", hd);   // 眼睛＋亮點
        for(const wy of [-.08,-.12]) at(sx*.21,wy,.18, .14,.012,.012, "#ffffff", hd);             // 鬍鬚
      }
      at(0,-.05,.205, .06,.04,.02, "#ff8fa8", hd);                    // 鼻子
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
      // 毛茸茸的貓尾巴：從屁股往後、再往上翹成問號的形狀，尾巴尖是白的；
      // 會跟著走路一彈一彈、轉身時往反方向甩（彈簧），站著時慢慢左右搖
      { const dt = e._dt || .016, dyaw = Math.atan2(Math.sin(e.yaw - (e._ty ?? e.yaw)), Math.cos(e.yaw - (e._ty ?? e.yaw))); e._ty = e.yaw;
        const want = Math.max(-.9, Math.min(.9, -dyaw/Math.max(dt, .001)*.09)) + Math.sin(t*1.7)*.22 + Math.sin(e.walk*10)*.1*(e.spd || 0);
        e._tv = ((e._tv || 0) + (want - (e._tw || 0))*60*dt)*Math.pow(.02, dt); e._tw = (e._tw || 0) + e._tv*dt;
        const lift = (e.spd || 0)*.08 + (e.onG ? 0 : .1);
        const C = [[0,.6,-.16],[0,.56,-.3],[0,.62,-.45],[0,.8,-.55],[0,1.0,-.56],[0,1.13,-.5],[0,1.2,-.4]];
        const pts = C.map(([x, y, z], i) => { const u = i/(C.length-1), sw = e._tw*Math.pow(u, 1.2)*.55; return toW(e, x + sw, y + lift*u, z - Math.abs(sw)*.25*u); });
        const sm = smooth(pts, 6), L = sm.length, R = u => (u < .08 ? .055 + u*.2 : .072 - Math.max(0, u - .55)*.06);
        const base = a.mark === "stripe" ? a.pj : (a.dk === a.pj ? a.lt : a.dk), ring = a.mark === "stripe" ? a.dk : null;
        // 分段上色：條紋貓有一圈一圈的深色、尾巴尖白白的
        const cut = [[0, .3, base], [.3, .38, ring || base], [.38, .52, base], [.52, .6, ring || base], [.6, .8, base], [.8, 1.0001, a.lt]];
        for(const [u0, u1, col] of cut){ const i0 = Math.floor(u0*(L-1)), i1 = Math.min(L-1, Math.ceil(u1*(L-1))); if(i1 - i0 < 1) continue;
          tube(sm.slice(i0, i1+1), k => R((i0 + k*(i1-i0))/(L-1)), col, true); }
        const tip = sm[L-1]; bind(ball); gl.uniform1f(U("mode"), 2); box(chain(T(tip[0], tip[1], tip[2]), S(.105,.105,.105)), a.lt); gl.uniform1f(U("mode"), 1); bind(cube); }
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
    function frame(now){
      if(dead) return; raf = requestAnimationFrame(frame);
      const dt = Math.min(.05, (now - last)/1000); last = now; const t = (now - t0)/1000;
      // 玩家移動（搖桿方向跟著鏡頭）
      let ix = J.x, iz = J.y;
      if(K.w || K.arrowup) iz = -1; if(K.s || K.arrowdown) iz = 1; if(K.a || K.arrowleft) ix = -1; if(K.d || K.arrowright) ix = 1;
      const mag = Math.min(1, Math.hypot(ix, iz)), sp = 4.2*mag;
      let mx = 0, mz = 0;
      if(mag > .08){ const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw), rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
        const dx = (rx*ix - fx*iz), dz = (rz*ix - fz*iz), l = Math.hypot(dx, dz) || 1; mx = dx/l*sp; mz = dz/l*sp;
        const want = Math.atan2(mx, mz); let d = want - player.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); player.yaw += d*Math.min(1, dt*12); }
      tryJump(dt); if(player.petT > 0) player.petT -= dt;
      move(player, mx, mz, dt, .28, 1.45); player._dt = dt; player.spd = mag; player.walk += dt*mag;
      // 鏡頭慢慢轉到玩家背後（有在走、而且沒在拖曳時）
      if(mag > .2 && dragId === null){ let d = (player.yaw + Math.PI) - cam.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); cam.yaw += d*Math.min(1, dt*1.4); }
      // 寵物貓：到處閒晃，你靠近時會轉過來看你
      near = -1; let nd = 2.4;
      pets.forEach(p => {
        const dp = Math.hypot(p.x - player.x, p.z - player.z);
        if(dp < nd && Math.abs(p.y - player.y) < 1.2 && !solid((p.x+player.x)/2, player.y + .5, (p.z+player.z)/2)){ nd = dp; near = p.i; }   // 隔著牆、高低差太多不算
        if(dp < .55 && dp > 1e-4){ const k = (.55 - dp)/dp*.5, ox = p.x, oz = p.z; p.x -= (player.x - p.x)*k; p.z -= (player.z - p.z)*k; if(hits(p.x, p.y, p.z, .25*p.s, .8*p.s)){ p.x = ox; p.z = oz; } }   // 不會穿過小貓，會把牠輕輕擠開
        let vx = 0, vz = 0;
        if(dp < 2.4){ const want = Math.atan2(player.x - p.x, player.z - p.z); let d = want - p.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); p.yaw += d*Math.min(1, dt*6); p.tx = null; }
        else if(p.tx == null){ p.wait -= dt; if(p.wait <= 0){ const a = Math.random()*Math.PI*2, r = 1.5 + Math.random()*4; const nx = player.x*.25 + p.x*.75 + Math.cos(a)*r, nz = player.z*.25 + p.z*.75 + Math.sin(a)*r; if(world.topY(Math.floor(nx), Math.floor(nz)) >= world.floor - 1){ p.tx = nx; p.tz = nz; } else p.wait = .5; } }
        else { const dx = p.tx - p.x, dz = p.tz - p.z, l = Math.hypot(dx, dz); if(l < .3){ p.tx = null; p.wait = 1.5 + Math.random()*3.5; } else if(!ground(p.x + dx/l*.5, p.z + dz/l*.5, p.y)){ p.tx = null; p.wait = .8; } else { vx = dx/l*1.6; vz = dz/l*1.6; const want = Math.atan2(vx, vz); let d = want - p.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); p.yaw += d*Math.min(1, dt*6); } }
        const ox = p.x, oz = p.z; move(p, vx, vz, dt, .25*p.s, .8*p.s); if(p.tx != null && Math.hypot(p.x-ox, p.z-oz) < .001 && (vx || vz)){ p.tx = null; p.wait = 1; }
        p.spd = Math.min(1, Math.hypot(vx, vz)/1.6); p.walk += dt*p.spd; if(p.love > 0) p.love -= dt; if(p.hop > 0) p.hop = Math.max(0, p.hop - dt);
      });
      if(near !== act._near){ act._near = near; paintAct(); }

      // 鏡頭：在玩家後上方，被方塊擋住就拉近
      const tgt = [player.x, player.y + 1.35, player.z];
      let dist = cam.dist; const dir = [Math.sin(cam.yaw)*Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw)*Math.cos(cam.pitch)];
      for(let d = .25; d <= cam.dist; d += .1){ const bx = tgt[0]+dir[0]*d, by = tgt[1]+dir[1]*d, bz = tgt[2]+dir[2]*d;
        if(solid(bx, by, bz) || solid(bx, by + .15, bz) || solid(bx, by - .15, bz)){ dist = Math.max(.3, d - .3); break; } }
      const eye = [tgt[0]+dir[0]*dist, tgt[1]+dir[1]*dist, tgt[2]+dir[2]*dist];
      const V = lookAt(eye, tgt, [0,1,0]), P = persp(1.05, cv.width/cv.height, .05, 90);

      gl.viewport(0, 0, cv.width, cv.height); gl.clearColor(SKY[0], SKY[1], SKY[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); gl.frontFace(gl.CCW);
      gl.uniformMatrix4fv(U("V"), false, V); gl.uniformMatrix4fv(U("P"), false, P); gl.uniform3fv(U("sky"), SKY);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(U("tex"), 0);
      gl.uniform1f(U("mode"), 0); gl.uniform1f(U("alpha"), 1); gl.uniformMatrix4fv(U("M"), false, I4());
      chunks[0].forEach(m => { bind(m); gl.drawElements(gl.TRIANGLES, m.c, gl.UNSIGNED_SHORT, 0); });
      // 貓、花
      gl.uniform1f(U("mode"), 1); bind(cube);
      world.flowers.forEach(f => { box(chain(T(f.x, f.y + .14, f.z), S(.05,.28,.05)), "#4f9e48"); box(chain(T(f.x, f.y + .32, f.z), RY(.8), S(.16,.12,.16)), f.c); });
      if(dist > .6) drawKid(player, t);   // 鏡頭被擠到頭裡面時先不畫自己
      pets.forEach(p => drawCat(p, t));
      // 雲海和飄來飄去的雲（白白的大方塊，半透明）
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.uniform1f(U("mode"), 1); bind(cube);
      CLOUDS.forEach(c => { const x = ((c.x + t*c.v) % 140 + 140) % 140 - 42; for(const [ox, oy, oz, sx, sy, sz] of c.parts) box(chain(T(x+ox, c.y+oy, c.z+oz), S(sx, sy, sz)), "#ffffff", c.a); });
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
        html += `<div class="p3dNmTag${p.i === near ? " on" : ""}" style="transform:translate(${q[0]}px,${q[1]}px) translate(-50%,-100%)">${o.esc(c.name)}</div>`;
        if(p.love > 0){ const k = 2.2 - p.love; html += `<div class="p3dHeart" style="transform:translate(${q[0]}px,${q[1] - 18 - k*26}px) translate(-50%,-100%);opacity:${Math.min(1, p.love)}">${o.icon ? o.icon("heart") : "♥"}</div>`; } });
      if(labels._h !== html){ labels._h = html; labels.innerHTML = html; }
    }
    raf = requestAnimationFrame(frame);

    return { close, _state:{ player, pets, cam, world } };
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

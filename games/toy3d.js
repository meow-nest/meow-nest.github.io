// 3D 布偶引擎（給 3D 夾娃娃機用）：WebGL 卡通描邊 + 分段光影，娃娃用球、圓錐、圓柱拼出來，花紋畫在身體上
(function(){
  // ---------- 矩陣 ----------
  const I4 = () => [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
  function mul(a, b){ const o = new Array(16).fill(0); for(let c = 0; c < 4; c++) for(let r = 0; r < 4; r++){ let v = 0; for(let k = 0; k < 4; k++) v += a[k*4+r]*b[c*4+k]; o[c*4+r] = v; } return o; }
  const T = (x,y,z) => [1,0,0,0,0,1,0,0,0,0,1,0,x,y,z,1];
  const S = (x,y,z) => [x,0,0,0,0,y,0,0,0,0,z,0,0,0,0,1];
  const RX = a => [1,0,0,0,0,Math.cos(a),Math.sin(a),0,0,-Math.sin(a),Math.cos(a),0,0,0,0,1];
  const RY = a => [Math.cos(a),0,-Math.sin(a),0,0,1,0,0,Math.sin(a),0,Math.cos(a),0,0,0,0,1];
  const RZ = a => [Math.cos(a),Math.sin(a),0,0,-Math.sin(a),Math.cos(a),0,0,0,0,1,0,0,0,0,1];
  const chain = (...m) => m.reduce((a, b) => mul(a, b), I4());
  const sub = (a,b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]], dot = (a,b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  const cross = (a,b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]], norm = a => { const l = Math.hypot(...a) || 1; return a.map(v => v/l); };
  function lookAt(e, c, up){ const z = norm(sub(e, c)), x = norm(cross(up, z)), y = cross(z, x); return [x[0],y[0],z[0],0, x[1],y[1],z[1],0, x[2],y[2],z[2],0, -dot(x,e),-dot(y,e),-dot(z,e),1]; }
  function persp(f, a, n, fa){ const t = 1/Math.tan(f/2); return [t/a,0,0,0, 0,t,0,0, 0,0,(fa+n)/(n-fa),-1, 0,0,2*fa*n/(n-fa),0]; }
  // 從 a 到 b 的圓柱（半徑 r）
  function seg(a, b, r){ const d = sub(b, a), L = Math.hypot(...d) || 1e-6, y = d.map(v => v/L); let x = norm(cross(Math.abs(y[1]) < .95 ? [0,1,0] : [1,0,0], y)); const z = cross(x, y);
    const m = [(a[0]+b[0])/2, (a[1]+b[1])/2, (a[2]+b[2])/2]; return [x[0]*r,x[1]*r,x[2]*r,0, y[0]*L,y[1]*L,y[2]*L,0, z[0]*r,z[1]*r,z[2]*r,0, m[0],m[1],m[2],1]; }
  const hexc = h => [1,3,5].map(i => parseInt(h.substr(i, 2), 16)/255);

  const VS = `attribute vec3 p; attribute vec3 n; attribute vec2 uv; uniform mat4 M, V, P; uniform float ol; varying vec3 vn, vw; varying vec2 vuv;
  void main(){ vec3 q = p + normalize(n)*ol; vec4 w = M*vec4(q,1.); vw = w.xyz; vn = normalize(mat3(M)*n); vuv = uv; gl_Position = P*V*w; }`;
  const FS = `precision mediump float; varying vec3 vn, vw; varying vec2 vuv; uniform vec3 col, eye, glow; uniform float mode, alpha; uniform sampler2D tex;
  void main(){
    if(mode > 2.5 && mode < 3.5){ vec4 t = texture2D(tex, vuv); if(t.a < .05) discard; gl_FragColor = vec4(t.rgb, t.a*alpha); return; }   // 貼紙（臉、地板）
    if(mode > .5 && mode < 1.5){ gl_FragColor = vec4(col, 1.); return; }                                                              // 描邊
    vec3 base = mode > 1.5 ? texture2D(tex, vuv).rgb : col;                                                                             // 有花紋的身體
    vec3 N = normalize(vn), L = normalize(vec3(-.45,.9,.6)), Vd = normalize(eye - vw);
    float d = dot(N, L);
    float band = d > .5 ? 1. : d > 0. ? .84 : .68;
    band = mix(band, .66 + .36*(.5 + .5*d), .6);
    vec3 c = base*band;
    float rim = pow(1. - max(dot(N, Vd), 0.), 3.); c += vec3(1.)*rim*.2;
    vec3 H = normalize(L + Vd); c += vec3(1.)*pow(max(dot(N, H), 0.), 50.)*.14;
    c += glow;
    gl_FragColor = vec4(c, alpha);
  }`;

  function Engine(canvas, opts = {}){
    const gl = canvas.getContext("webgl", Object.assign({ antialias: true, alpha: true, premultipliedAlpha: false, preserveDrawingBuffer: !!opts.keep }, opts.ctx || {}));
    if(!gl) return null;
    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if(!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
    const PR = gl.createProgram(); gl.attachShader(PR, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(PR, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(PR); gl.useProgram(PR);
    const UL = {}; const U = n => UL[n] || (UL[n] = gl.getUniformLocation(PR, n));
    const AL = { p: gl.getAttribLocation(PR, "p"), n: gl.getAttribLocation(PR, "n"), uv: gl.getAttribLocation(PR, "uv") };
    function mesh(P, N, UV, idx){ const mk = (a, t = gl.ARRAY_BUFFER, A = Float32Array) => { const b = gl.createBuffer(); gl.bindBuffer(t, b); gl.bufferData(t, new A(a), gl.STATIC_DRAW); return b; }; return { p: mk(P), n: mk(N), uv: mk(UV), i: mk(idx, gl.ELEMENT_ARRAY_BUFFER, Uint16Array), c: idx.length }; }
    function sphere(seg = 20){ const P = [], N = [], UV = [], I = []; for(let y = 0; y <= seg; y++){ const v = y/seg, th = v*Math.PI; for(let x = 0; x <= seg; x++){ const u = x/seg, ph = u*Math.PI*2; const n = [Math.sin(th)*Math.cos(ph), Math.cos(th), Math.sin(th)*Math.sin(ph)]; P.push(...n); N.push(...n); UV.push(u, v); } }
      for(let y = 0; y < seg; y++) for(let x = 0; x < seg; x++){ const a = y*(seg+1)+x, b = a + seg + 1; I.push(a, a+1, b, b, a+1, b+1); } return mesh(P, N, UV, I); }
    function cyl(seg = 14){ const P = [], N = [], UV = [], I = []; for(let y = 0; y <= 1; y++) for(let x = 0; x <= seg; x++){ const a = x/seg*Math.PI*2; P.push(Math.cos(a), y - .5, Math.sin(a)); N.push(Math.cos(a), 0, Math.sin(a)); UV.push(x/seg, 1 - y); }
      for(let x = 0; x < seg; x++){ const a = x, b = x + seg + 1; I.push(a, b, a+1, b, b+1, a+1); }
      // 上下蓋
      for(const [yy, ny] of [[.5, 1], [-.5, -1]]){ const c0 = P.length/3; P.push(0, yy, 0); N.push(0, ny, 0); UV.push(.5, .5); for(let x = 0; x <= seg; x++){ const a = x/seg*Math.PI*2; P.push(Math.cos(a), yy, Math.sin(a)); N.push(0, ny, 0); UV.push(.5 + .5*Math.cos(a), .5 + .5*Math.sin(a)); }
        for(let x = 1; x <= seg; x++) ny > 0 ? I.push(c0, c0 + x + 1, c0 + x) : I.push(c0, c0 + x, c0 + x + 1); }
      return mesh(P, N, UV, I); }
    function cone(seg = 14){ const P = [0,1,0], N = [0,1,0], UV = [.5,0], I = []; for(let x = 0; x <= seg; x++){ const a = x/seg*Math.PI*2; P.push(Math.cos(a), 0, Math.sin(a)); N.push(...norm([Math.cos(a), .6, Math.sin(a)])); UV.push(x/seg, 1); } for(let x = 1; x <= seg; x++) I.push(0, x+1, x);
      const c0 = P.length/3; P.push(0,0,0); N.push(0,-1,0); UV.push(.5,.5); for(let x = 0; x <= seg; x++){ const a = x/seg*Math.PI*2; P.push(Math.cos(a), 0, Math.sin(a)); N.push(0,-1,0); UV.push(.5,.5); } for(let x = 1; x <= seg; x++) I.push(c0, c0 + x, c0 + x + 1);
      return mesh(P, N, UV, I); }
    function torus(seg = 22, sides = 10, r = .32){ const P = [], N = [], UV = [], I = []; for(let i = 0; i <= seg; i++){ const a = i/seg*Math.PI*2; for(let j = 0; j <= sides; j++){ const b = j/sides*Math.PI*2; const n = [Math.cos(a)*Math.cos(b), Math.sin(b), Math.sin(a)*Math.cos(b)]; P.push(Math.cos(a)*(1 - r) + n[0]*r, n[1]*r, Math.sin(a)*(1 - r) + n[2]*r); N.push(...n); UV.push(i/seg, j/sides); } }
      for(let i = 0; i < seg; i++) for(let j = 0; j < sides; j++){ const a = i*(sides+1)+j, b = a + sides + 1; I.push(a, a+1, b, b, a+1, b+1); } return mesh(P, N, UV, I); }
    function quad(){ return mesh([-1,-1,0, 1,-1,0, 1,1,0, -1,1,0], [0,0,1,0,0,1,0,0,1,0,0,1], [0,1, 1,1, 1,0, 0,0], [0,1,2,0,2,3]); }
    function box(){ const P = [], N = [], UV = [], I = []; const F = [[[1,0,0],[0,0,-1],[0,1,0]],[[-1,0,0],[0,0,1],[0,1,0]],[[0,1,0],[1,0,0],[0,0,-1]],[[0,-1,0],[1,0,0],[0,0,1]],[[0,0,1],[1,0,0],[0,1,0]],[[0,0,-1],[-1,0,0],[0,1,0]]];
      F.forEach(([n, u, v], k) => { for(const [a, b] of [[-1,-1],[1,-1],[1,1],[-1,1]]){ P.push(n[0]+u[0]*a+v[0]*b, n[1]+u[1]*a+v[1]*b, n[2]+u[2]*a+v[2]*b); N.push(...n); UV.push((a+1)/2, (1-b)/2); } I.push(k*4, k*4+1, k*4+2, k*4, k*4+2, k*4+3); }); return mesh(P, N, UV, I); }
    const dv = (u, v, k) => { const th = v*Math.PI, ph = u*Math.PI*2, n = [Math.sin(th)*Math.cos(ph), Math.cos(th), Math.sin(th)*Math.sin(ph)];
      const yy = n[1] < 0 ? n[1]*.4 : n[1], wide = (n[1] < 0 ? 1 + .05*(1 + n[1]) : 1 + .05*(1 - n[1]))*k; return [[n[0]*wide, yy*k, n[2]*wide], [n[0], n[1] < 0 ? n[1]*2 : n[1], n[2]]]; };
    function dome(seg = 24){ const P = [], N = [], UV = [], I = []; for(let y = 0; y <= seg; y++) for(let x = 0; x <= seg; x++){ const [p, n] = dv(x/seg, y/seg, 1); P.push(...p); N.push(...n); UV.push(x/seg, y/seg); }
      for(let y = 0; y < seg; y++) for(let x = 0; x < seg; x++){ const a = y*(seg+1)+x, b = a + seg + 1; I.push(a, a+1, b, b, a+1, b+1); } return mesh(P, N, UV, I); }
    // 臉：貼在麻糬身體表面上的一片（跟著身體彎曲，不會陷進去）
    function facePatch(seg = 14){ const P = [], N = [], UV = [], I = [], u0 = .25 - .17, u1 = .25 + .17, v0 = .2, v1 = .58;
      for(let y = 0; y <= seg; y++) for(let x = 0; x <= seg; x++){ const u = u0 + (u1 - u0)*x/seg, v = v0 + (v1 - v0)*y/seg, [p, n] = dv(u, v, 1.012); P.push(...p); N.push(...n); UV.push(1 - x/seg, y/seg); }
      for(let y = 0; y < seg; y++) for(let x = 0; x < seg; x++){ const a = y*(seg+1)+x, b = a + seg + 1; I.push(a, a+1, b, b, a+1, b+1); } return mesh(P, N, UV, I); }
    const M = { DOME: dome(), FACE: facePatch(), SPH: sphere(), CYL: cyl(), CONE: cone(), TOR: torus(), QUAD: quad(), BOX: box() };
    const texCache = new Map();
    function texture(key, make){ if(texCache.has(key)) return texCache.get(key); const c = make(); const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); texCache.set(key, t); return t; }
    let lastMesh = null;
    const OUT = hexc("#5e3d36");
    function draw(m, Mx, color, o = {}){
      if(lastMesh !== m){ for(const [k, n] of [["p", 3], ["n", 3], ["uv", 2]]){ const l = AL[k]; if(l < 0) continue; gl.bindBuffer(gl.ARRAY_BUFFER, m[k]); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, n, gl.FLOAT, false, 0, 0); } gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.i); lastMesh = m; }
      gl.uniformMatrix4fv(U("M"), false, Mx);
      const decal = o.decal;
      if(o.outline !== false && !decal){ gl.enable(gl.CULL_FACE); gl.cullFace(gl.FRONT); gl.uniform1f(U("mode"), 1); gl.uniform3fv(U("col"), o.oc || OUT); gl.uniform1f(U("ol"), (o.ow ?? .05)*.8); gl.drawElements(gl.TRIANGLES, m.c, gl.UNSIGNED_SHORT, 0); }
      if(o.noCull || decal) gl.disable(gl.CULL_FACE); else { gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); }
      gl.uniform1f(U("ol"), 0); gl.uniform1f(U("alpha"), o.alpha ?? 1); gl.uniform3fv(U("glow"), o.glow || [0,0,0]);
      if(o.tex){ gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, o.tex); gl.uniform1i(U("tex"), 0); gl.uniform1f(U("mode"), decal ? 3 : 2); }
      else { gl.uniform1f(U("mode"), 0); gl.uniform3fv(U("col"), typeof color === "string" ? hexc(color) : color); }
      gl.drawElements(gl.TRIANGLES, m.c, gl.UNSIGNED_SHORT, 0);
    }
    function camera(eye, at, fov, aspect){ gl.uniformMatrix4fv(U("V"), false, lookAt(eye, at, [0,1,0])); gl.uniformMatrix4fv(U("P"), false, persp(fov, aspect, .1, 200)); gl.uniform3fv(U("eye"), eye); }
    function begin(w, h, clear){ gl.viewport(0, 0, w, h); gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.disable(gl.BLEND); gl.clearColor(...(clear || [0,0,0,0])); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); lastMesh = null; }
    function blend(on){ if(on){ gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); } else { gl.disable(gl.BLEND); gl.depthMask(true); } }
    return { gl, M, draw, camera, begin, blend, texture, mesh };
  }

  // ================= 布偶模型 =================
  const C2 = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
  // 臉的貼紙
  function faceCanvas(o){
    const c = C2(256, 256), x = c.getContext("2d"), ink = o.ink || "#3a2424"; x.lineCap = "round"; x.lineJoin = "round";
    const ex = (o.ex || 60)*.82, ey = 112, FS = .9;
    for(const s of [-1, 1]){ const cx = 128 + s*ex; x.save(); x.translate(cx, ey); x.scale(FS, FS); x.translate(-cx, -ey);
      if(o.ring){ x.strokeStyle = o.ring; x.lineWidth = 6; x.beginPath(); x.arc(cx, ey + 2, 15, 0, 7); x.stroke(); }
      if(o.cheek){ x.fillStyle = o.cheek; x.beginPath(); x.ellipse(128 + s*(ex + 22), ey + 34, 25, 21, 0, 0, 7); x.fill();
        if(o.cheekDot){ x.fillStyle = o.cheekDot; x.beginPath(); x.ellipse(128 + s*(ex + 36), ey + 44, 9, 7, -s*.4, 0, 7); x.fill(); } }
      const k = o.eye === "wink" && s > 0 ? "happy" : o.eye || "dot";
      if(k === "dot" || k === "big" || k === "cat"){ x.fillStyle = k === "cat" ? (o.eyeC || "#f5c842") : ink; x.beginPath(); x.ellipse(cx, ey + 2, 9, 11, 0, 0, 7); x.fill(); }   // 豆豆眼
      if(false){ const r = k === "big" ? 1.25 : 1; x.fillStyle = o.eyeC || ink; x.beginPath(); x.ellipse(cx, ey, 15*r, 19*r, 0, 0, 7); x.fill(); x.fillStyle = "#fff"; x.beginPath(); x.arc(cx - 5*r, ey - 7*r, 6.5*r, 0, 7); x.fill(); x.beginPath(); x.arc(cx + 5*r, ey + 6*r, 3*r, 0, 7); x.fill(); }
      if(false){ x.fillStyle = o.eyeC || "#f5c842"; x.beginPath(); x.ellipse(cx, ey, 16, 19, 0, 0, 7); x.fill(); x.fillStyle = ink; x.beginPath(); x.ellipse(cx, ey, 5, 15, 0, 0, 7); x.fill(); x.fillStyle = "#fff"; x.beginPath(); x.arc(cx - 6, ey - 8, 4, 0, 7); x.fill(); }
      if(k === "happy"){ x.strokeStyle = ink; x.lineWidth = 9; x.beginPath(); x.arc(cx, ey + 8, 15, Math.PI*1.12, Math.PI*1.88); x.stroke(); }
      if(k === "sleep"){ x.strokeStyle = ink; x.lineWidth = 9; x.beginPath(); x.arc(cx, ey - 8, 15, Math.PI*.12, Math.PI*.88); x.stroke(); }
      if(k === "line"){ x.strokeStyle = ink; x.lineWidth = 9; x.beginPath(); x.moveTo(cx - 14, ey); x.lineTo(cx + 14, ey); x.stroke(); }
      if(k === "love"){ x.fillStyle = "#f2557a"; x.beginPath(); x.moveTo(cx, ey + 16); x.bezierCurveTo(cx - 26, ey - 2, cx - 12, ey - 24, cx, ey - 8); x.bezierCurveTo(cx + 12, ey - 24, cx + 26, ey - 2, cx, ey + 16); x.fill(); x.strokeStyle = ink; x.lineWidth = 4; x.stroke(); }
      if(k === "star"){ x.fillStyle = "#ffcf3a"; x.strokeStyle = ink; x.lineWidth = 4; x.beginPath(); for(let i = 0; i < 10; i++){ const a = -Math.PI/2 + i*Math.PI/5, r = i % 2 ? 8 : 19; x.lineTo(cx + Math.cos(a)*r, ey + Math.sin(a)*r); } x.closePath(); x.fill(); x.stroke(); }
      if(k === "cry"){ x.strokeStyle = ink; x.lineWidth = 9; x.beginPath(); x.arc(cx, ey - 8, 15, Math.PI*.12, Math.PI*.88); x.stroke(); x.fillStyle = "#8fd3ff"; x.beginPath(); x.ellipse(cx + s*6, ey + 18, 6, 9, 0, 0, 7); x.fill(); }
      if(k === "x"){ x.strokeStyle = ink; x.lineWidth = 8; x.beginPath(); x.moveTo(cx - 11, ey - 11); x.lineTo(cx + 11, ey + 11); x.moveTo(cx + 11, ey - 11); x.lineTo(cx - 11, ey + 11); x.stroke(); }
      x.restore();
      if(o.lash){ x.strokeStyle = ink; x.lineWidth = 5; x.beginPath(); x.moveTo(cx + s*13, ey - 10); x.lineTo(cx + s*22, ey - 17); x.stroke(); }
      if(o.blush !== false){ const bx = 128 + s*(ex + 32), by = ey + 26, g = x.createRadialGradient(bx, by, 2, bx, by, 26); g.addColorStop(0, "rgba(255,120,150,.75)"); g.addColorStop(1, "rgba(255,120,150,0)"); x.fillStyle = g; x.beginPath(); x.ellipse(bx, by, 26, 17, 0, 0, 7); x.fill(); }
      if(o.whisker){ x.strokeStyle = ink; x.lineWidth = 4; x.globalAlpha = .6; for(const dy of [-6, 6]){ x.beginPath(); x.moveTo(128 + s*(ex + 40), ey + 26 + dy); x.lineTo(128 + s*(ex + 62), ey + 22 + dy*1.6); x.stroke(); } x.globalAlpha = 1; }
    }
    if(o.glasses){ x.strokeStyle = "#3a2424"; x.lineWidth = 4; for(const s of [-1, 1]){ x.beginPath(); x.arc(128 + s*ex, ey + 2, 19, 0, 7); x.stroke(); } x.beginPath(); x.moveTo(128 - ex + 19, ey); x.quadraticCurveTo(128, ey - 8, 128 + ex - 19, ey); x.stroke(); }
    x.save(); x.translate(128, 140); x.scale(.8, .8); x.translate(-128, -142);
    x.strokeStyle = ink; x.lineWidth = 7;
    const m = o.mouth || "w";
    if(m === "beak"){ x.fillStyle = "#ffa53a"; x.beginPath(); x.moveTo(108, 136); x.lineTo(148, 136); x.lineTo(128, 162); x.closePath(); x.fill(); x.lineWidth = 5; x.stroke(); }
    else if(m === "duck"){ x.fillStyle = "#ffa53a"; x.beginPath(); x.ellipse(128, 146, 28, 14, 0, 0, 7); x.fill(); x.lineWidth = 5; x.stroke(); }
    else if(m === "nose"){ x.fillStyle = ink; x.beginPath(); x.ellipse(128, 140, 11, 8, 0, 0, 7); x.fill(); x.lineWidth = 6; x.beginPath(); x.moveTo(128, 148); x.lineTo(128, 155); x.moveTo(116, 159); x.quadraticCurveTo(122, 166, 128, 155); x.quadraticCurveTo(134, 166, 140, 159); x.stroke(); }
    else if(m === "pig"){ x.fillStyle = "#f5a3b8"; x.beginPath(); x.ellipse(128, 148, 24, 16, 0, 0, 7); x.fill(); x.lineWidth = 5; x.stroke(); x.fillStyle = "#b5506e"; for(const s of [-1, 1]){ x.beginPath(); x.ellipse(128 + s*8, 148, 4, 6, 0, 0, 7); x.fill(); } }
    else if(m === "o"){ x.fillStyle = "#c2405c"; x.beginPath(); x.ellipse(128, 150, 9, 11, 0, 0, 7); x.fill(); }
    else if(m === "smile"){ x.fillStyle = "#c2405c"; x.beginPath(); x.moveTo(110, 140); x.quadraticCurveTo(128, 172, 146, 140); x.closePath(); x.fill(); x.lineWidth = 5; x.stroke(); }
    else if(m === "tongue"){ x.beginPath(); x.moveTo(110, 142); x.quadraticCurveTo(119, 156, 128, 143); x.quadraticCurveTo(137, 156, 146, 142); x.stroke(); x.fillStyle = "#f2557a"; x.beginPath(); x.ellipse(136, 156, 7, 9, 0, 0, 7); x.fill(); }
    else if(m === "cat"){ x.fillStyle = "#f28aa0"; x.beginPath(); x.moveTo(120, 134); x.lineTo(136, 134); x.lineTo(128, 142); x.closePath(); x.fill(); x.beginPath(); x.moveTo(128, 142); x.lineTo(128, 148); x.moveTo(112, 146); x.quadraticCurveTo(120, 158, 128, 148); x.quadraticCurveTo(136, 158, 144, 146); x.stroke(); }
    else if(m !== "none"){ x.beginPath(); x.moveTo(110, 142); x.quadraticCurveTo(119, 156, 128, 143); x.quadraticCurveTo(137, 156, 146, 142); x.stroke(); }
    x.restore();
    if(o.mask){ x.globalCompositeOperation = "destination-over"; x.fillStyle = o.mask; x.beginPath(); x.ellipse(128, 128, 96, 70, 0, 0, 7); x.fill(); }
    return c;
  }
  // 身體的花紋（球的 UV：u=.25 是正面、v=0 是頭頂）
  function skinCanvas(base, pat, c2, c3){
    const c = C2(512, 256), x = c.getContext("2d"); x.fillStyle = base; x.fillRect(0, 0, 512, 256);
    const U = u => u*512, Vv = v => v*256;
    const blob = (u, v, rx, ry, col) => { x.fillStyle = col; for(const du of [0, -1, 1]){ x.beginPath(); x.ellipse(U(u + du), Vv(v), rx*512, ry*256, 0, 0, 7); x.fill(); } };
    if(pat === "stripe"){ x.fillStyle = c2; for(let i = 0; i < 9; i++){ const u = .5 + (i - 4)*.055; x.beginPath(); x.ellipse(U(u), Vv(.18), 9, 34, 0, 0, 7); x.fill(); } for(const u of [.0, .08, .42, .5]) for(const v of [.45, .58]){ x.beginPath(); x.ellipse(U(u), Vv(v), 22, 6, 0, 0, 7); x.fill(); } }
    if(pat === "tabby"){ x.fillStyle = c2; for(let i = 0; i < 16; i++){ const u = i/16; x.beginPath(); x.ellipse(U(u), Vv(.3 + (i % 2)*.12), 9, 30, 0, 0, 7); x.fill(); } }
    // 三花：頭頂兩塊（避開臉）＋背上幾塊
    if(pat === "calico"){ blob(.34, .07, .1, .13, c2); blob(.15, .06, .08, .11, c3); blob(.66, .3, .065, .13, c2); blob(.8, .5, .055, .11, c3); blob(.9, .24, .05, .1, c2); blob(.58, .6, .045, .09, c3); blob(.76, .74, .05, .08, c2); }
    if(pat === "tux"){ x.fillStyle = c2; x.beginPath(); x.ellipse(U(.25), Vv(.82), 70, 80, 0, 0, 7); x.fill(); }
    if(pat === "belly"){ x.fillStyle = c2; x.beginPath(); x.ellipse(U(.25), Vv(.78), 62, 60, 0, 0, 7); x.fill(); }
    if(pat === "cow"){ blob(.08, .3, .07, .14, c2); blob(.48, .5, .09, .2, c2); blob(.7, .25, .06, .12, c2); blob(.35, .72, .05, .1, c2); }
    if(pat === "spots"){ x.fillStyle = c2; for(let i = 0; i < 26; i++){ x.beginPath(); x.arc((i*97) % 512, 40 + ((i*53) % 170), 7 + (i % 3)*2, 0, 7); x.fill(); } }
    if(pat === "point"){ const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, c2); g.addColorStop(.25, base); g.addColorStop(1, base); x.fillStyle = g; x.fillRect(0, 0, 512, 256); }
    if(pat === "tortie"){ for(let i = 0; i < 40; i++){ x.fillStyle = i % 2 ? c2 : c3; x.beginPath(); x.ellipse((i*131) % 512, 20 + (i*71) % 220, 15, 9, i, 0, 7); x.fill(); } }
    if(pat === "rainbow"){ const cols = ["#ff8fab", "#ffc46b", "#fff07a", "#9ff0b5", "#8fd8ff", "#c9a6ff"]; cols.forEach((cc, i) => { x.fillStyle = cc; x.fillRect(0, i*256/6, 512, 256/6 + 1); }); }
    if(pat === "galaxy"){ const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, "#2b2c6e"); g.addColorStop(1, "#5a3b9e"); x.fillStyle = g; x.fillRect(0, 0, 512, 256); x.fillStyle = "#fff"; for(let i = 0; i < 80; i++){ x.globalAlpha = .4 + (i % 5)*.12; x.beginPath(); x.arc((i*113) % 512, (i*59) % 256, 1 + (i % 3), 0, 7); x.fill(); } x.globalAlpha = 1; }
    if(pat === "gold"){ const g = x.createLinearGradient(0, 0, 512, 256); g.addColorStop(0, "#ffe08a"); g.addColorStop(.5, "#f5b82e"); g.addColorStop(1, "#ffe9a8"); x.fillStyle = g; x.fillRect(0, 0, 512, 256); }
    if(pat === "seeds"){ x.fillStyle = "#ffe9a8"; for(let i = 0; i < 70; i++){ x.beginPath(); x.ellipse((i*83) % 512, 60 + (i*37) % 190, 3, 5, 0, 0, 7); x.fill(); } }
    if(pat === "sprinkle"){ const cols = ["#fff", "#7fd3ff", "#ffe066", "#a8e6a1"]; for(let i = 0; i < 60; i++){ x.fillStyle = cols[i % 4]; x.save(); x.translate((i*97) % 512, (i*41) % 120 + 4); x.rotate(i); x.fillRect(-6, -2, 12, 4); x.restore(); } }
    if(pat === "panda"){ blob(.25, .9, .2, .25, c2); blob(.75, .5, .25, .4, c2); }
    if(pat === "fox"){ x.fillStyle = c2; x.beginPath(); x.ellipse(U(.25), Vv(.75), 80, 70, 0, 0, 7); x.fill(); }
    const cap = (col, v1) => { x.fillStyle = col; x.fillRect(0, 0, 512, Vv(v1) - 8); const g = x.createLinearGradient(0, Vv(v1) - 9, 0, Vv(v1) + 9); g.addColorStop(0, col); g.addColorStop(1, col + "00"); x.fillStyle = g; x.fillRect(0, Vv(v1) - 9, 512, 18); };
    if(pat === "cap") cap(c2, .3);
    if(pat === "mask"){ x.fillStyle = c2; x.beginPath(); x.ellipse(U(.25), Vv(.42), 84, 66, 0, 0, 7); x.fill(); }
    if(pat === "bib"){ x.fillStyle = c2; x.beginPath(); x.ellipse(U(.25), Vv(.62), 80, 72, 0, 0, 7); x.fill(); }
    if(pat === "under"){ x.fillStyle = c2; x.fillRect(0, Vv(.6), 512, 256); const g = x.createLinearGradient(0, Vv(.6) - 12, 0, Vv(.6) + 2); g.addColorStop(0, c2 + "00"); g.addColorStop(1, c2); x.fillStyle = g; x.fillRect(0, Vv(.6) - 12, 512, 14); }
    if(pat === "budgie"){ cap(c2, .34); x.strokeStyle = c3; x.globalAlpha = .55; x.lineWidth = 3; for(let r = 0; r < 3; r++) for(let i = 0; i < 7; i++){ const u = .58 + i*.06 + (r % 2)*.03; x.beginPath(); x.arc(U(u), Vv(.1 + r*.08), 9, .2*Math.PI, .8*Math.PI); x.stroke(); } x.globalAlpha = 1;
    }
    if(pat === "scallop"){ x.strokeStyle = c2; x.lineWidth = 5; for(let r = 0; r < 7; r++) for(let i = 0; i < 18; i++){ x.beginPath(); x.arc(i*30 + (r % 2)*15, 20 + r*32, 14, .15*Math.PI, .85*Math.PI); x.stroke(); } }
    if(pat === "sparrow"){ cap(c2, .28); x.fillStyle = c3; x.beginPath(); x.ellipse(U(.25), Vv(.6), 14, 9, 0, 0, 7); x.fill(); }
    if(pat === "whitehead"){ cap(c2, .3); x.fillStyle = c3; x.beginPath(); x.ellipse(U(.75), Vv(.17), 50, 30, 0, 0, 7); x.fill(); }
    if(pat === "band"){ const g = x.createLinearGradient(0, 0, 512, 0); for(let i = 0; i <= 6; i++) g.addColorStop(i/6, i % 2 ? c3 : c2); x.fillStyle = g; x.globalAlpha = .55; x.fillRect(0, Vv(.42), 512, Vv(.07)); x.globalAlpha = 1; }
    if(pat === "socks"){ x.fillStyle = c2; x.fillRect(0, Vv(.86), 512, 40); }
    // 臉的地方留乾淨（花紋不要跑到臉上）
    if(["calico", "cow", "tortie", "tabby", "stripe", "spots", "rainbow"].includes(pat)){ x.save(); x.translate(U(.25), Vv(.4)); x.scale(1, .75); const g = x.createRadialGradient(0, 0, 40, 0, 0, 86); g.addColorStop(0, base); g.addColorStop(.75, base); g.addColorStop(1, base + "00"); x.fillStyle = g; x.beginPath(); x.arc(0, 0, 86, 0, 7); x.fill(); x.restore(); }
    return c;
  }

  // 一個模型 = 一串部件 [mesh, 矩陣, 顏色或花紋, 選項]
  const PART = (m, mx, col, o) => ({ m, mx, col, o: o || {} });
  // 共用的小零件
  function catParts(o){
    const L = [], c = o.c;
    const body = o.skin ? { skin: [c, o.skin, o.c2, o.c3] } : c;
    // 尾巴
    // 尾巴：沿著麻糬的底部繞半圈，尾巴尖往上翹一點（很多顆重疊的小球，看起來是一條滑順的尾巴）
    if(!o.noTail){ const N = 36; for(let i = 0; i < N; i++){ const t = i/(N - 1), a = t*Math.PI*.6, rr = 1.1, y = -.74 + Math.pow(t, 2.5)*.42, r = .16 - t*.04;
        L.push(PART("SPH", chain(T(Math.sin(a)*rr, y, -Math.cos(a)*rr), S(r, r, r)), o.tailBands ? o.tailBands[Math.min(o.tailBands.length - 1, Math.floor(t*o.tailBands.length))] : t > .8 && o.tailTip ? o.tailTip : (o.tail || c), { ow: i === N - 1 ? .04 : .012 })); } }
    const BM = chain(T(0, -.5, 0), S(1.06, 1.4, 1.0)); L.push(PART("DOME", BM, body));
    const ear = o.ear || c;
    if(o.ears !== false) for(const s of [-1, 1]){ L.push(PART("CONE", chain(T(s*.56, .66, 0), RZ(-s*.36), S(.3, .46, .27)), (s < 0 ? o.earL : o.earR) || ear)); L.push(PART("CONE", chain(T(s*.57, .69, .15), RZ(-s*.36), S(.15, .27, .1)), o.earIn || "#ffb3c6", { outline: false })); }
    if(o.paws) for(const s of [-1, 1]) L.push(PART("SPH", chain(T(s*.4, -.7, .75), S(.16, .1, .12)), o.paw || c));
    if(o.wave) L.push(PART("SPH", chain(T(.92, .1, .45), RZ(-.6), S(.2, .3, .2)), o.paw || c));
    L.push(PART("FACE", BM, null, { face: o.face || {} }));
    return L;
  }
  // 配件
  const ACC = {
    bow: (col = "#f2557a", y = .78, xo = -.42) => [PART("SPH", chain(T(xo - .17, y, .3), RZ(.4), S(.2, .13, .1)), col), PART("SPH", chain(T(xo + .17, y, .3), RZ(-.4), S(.2, .13, .1)), col), PART("SPH", chain(T(xo, y, .33), S(.09, .09, .08)), col)],
    crown: () => [PART("CYL", chain(T(0, .98, 0), S(.42, .22, .42)), "#ffcf3a"), ...[0, 1, 2, 3, 4].map(i => { const a = i/5*Math.PI*2; return PART("CONE", chain(T(Math.cos(a)*.34, 1.08, Math.sin(a)*.34), S(.1, .22, .1)), "#ffcf3a"); }), PART("SPH", chain(T(0, .98, .42), S(.08, .08, .05)), "#f2557a", { outline: false })],
    halo: () => [PART("TOR", chain(T(0, 1.22, 0), RX(.25), S(.5, .5, .5)), "#fff07a", { glow: [.25, .22, .05] })],
    // 天使翅膀：背上兩邊各三片羽毛，往斜上方張開
    wings: (col = "#ffffff") => [-1, 1].flatMap(s => [0, 1, 2].map(i => { const a = .7 + i*.4; return PART("SPH", chain(T(s*(.62 + Math.sin(a)*.5), .3 + Math.cos(a)*.45, -.6 + i*.05), RY(s*.6), RZ(-s*a), S(.16, .5 - i*.09, .07)), col, { ow: .035 }); })),
    party: (col = "#7fd3ff") => [PART("CONE", chain(T(.25, .92, 0), RZ(-.25), S(.24, .5, .24)), col), PART("SPH", chain(T(.37, 1.4, 0), S(.09, .09, .09)), "#ffe066")],
    flower: (col = "#ff8fab") => [...[0, 1, 2, 3, 4].map(i => { const a = i/5*Math.PI*2; return PART("SPH", chain(T(-.5 + Math.cos(a)*.12, .75 + Math.sin(a)*.12, .35), S(.1, .1, .06)), col); }), PART("SPH", chain(T(-.5, .75, .4), S(.07, .07, .05)), "#ffe066")],
    sprout: () => [PART("CYL", chain(T(0, 1.0, 0), S(.03, .25, .03)), "#6cbf5a"), PART("SPH", chain(T(-.12, 1.13, 0), RZ(.5), S(.14, .07, .07)), "#8fd96c"), PART("SPH", chain(T(.12, 1.13, 0), RZ(-.5), S(.14, .07, .07)), "#8fd96c")],
    scarf: (col = "#e8484d") => [PART("TOR", chain(T(0, -.3, 0), S(1.06, 1.1, 1.0)), col), PART("SPH", chain(T(.35, -.45, .75), RZ(.3), S(.12, .26, .08)), col)],
    horn: () => [PART("CONE", chain(T(0, .9, .2), RX(.25), S(.12, .45, .12)), "#ffe9a8")],
    coin: () => [PART("CYL", chain(T(-.75, -.2, .7), RZ(.3), RX(Math.PI/2), S(.28, .06, .28)), "#ffcf3a")],
    glasses: () => [-1, 1].map(s => PART("TOR", chain(T(s*.3, .1, .98), RX(Math.PI/2), S(.2, .2, .2)), "#3a2424", { outline: false })),
    chef: () => [PART("CYL", chain(T(0, .92, 0), S(.45, .2, .45)), "#ffffff"), PART("SPH", chain(T(0, 1.15, 0), S(.55, .3, .55)), "#ffffff")],
    beret: (col = "#e8484d") => [PART("SPH", chain(T(-.1, .88, 0), RZ(.2), S(.62, .16, .6)), col), PART("SPH", chain(T(-.1, 1.02, 0), S(.06, .06, .06)), col)],
  };
  const cat = (o) => () => [...catParts(o), ...(o.acc || []).flatMap(a => typeof a === "function" ? a() : a)];
  const MODELS = {};
  // ---- 貓 ----
  Object.assign(MODELS, {
    c_orange: cat({ c: "#f5ae63", skin: "stripe", c2: "#d9823a", face: { eye: "dot" } }),
    c_cream: cat({ c: "#ffe2b8", skin: "belly", c2: "#fff7ea", face: { eye: "happy" } }),
    c_white: cat({ c: "#fffdf8", face: { eye: "dot", lash: true } }),
    c_black: cat({ c: "#3f3846", skin: "tux", c2: "#ffffff", paw: "#ffffff", face: { eye: "cat", ink: "#1a1418" } }),
    c_gray: cat({ c: "#b8bfd0", skin: "belly", c2: "#eef1f7", face: { eye: "sleep" } }),
    c_calico: cat({ c: "#fffaf3", skin: "calico", c2: "#f2a65a", c3: "#3f3542", earL: "#f2a65a", earR: "#3f3542", tailBands: ["#fffaf3", "#f2a65a", "#f2a65a", "#3f3542", "#3f3542", "#fffaf3"], face: { eye: "happy" } }),
    c_tabby: cat({ c: "#a9a194", skin: "tabby", c2: "#6e665c", face: { eye: "dot" } }),
    c_siamese: cat({ c: "#fbf1de", skin: "point", c2: "#6b4a3a", ear: "#6b4a3a", tail: "#6b4a3a", paw: "#6b4a3a", face: { eye: "dot", eyeC: "#3a7bd5", mask: "rgba(107,74,58,.55)" } }),
    c_cow: cat({ c: "#ffffff", skin: "cow", c2: "#3a3440", ear: "#3a3440", face: { eye: "dot" } }),
    c_tortie: cat({ c: "#5a4038", skin: "tortie", c2: "#d98a3a", c3: "#2e2228", face: { eye: "cat", eyeC: "#9fe07a" } }),
    c_pink: cat({ c: "#ffc8d6", face: { eye: "wink" } }),
    c_blue: cat({ c: "#bfe0ff", face: { eye: "dot" }, acc: [() => ACC.party("#ffe066")] }),
    c_mint: cat({ c: "#c8f0dc", face: { eye: "happy" }, acc: [ACC.sprout] }),
    c_lav: cat({ c: "#dccdff", face: { eye: "star" } }),
    c_bow: cat({ c: "#fffdf8", face: { eye: "dot", lash: true }, acc: [() => ACC.bow()] }),
    c_flower: cat({ c: "#ffe2b8", face: { eye: "happy" }, acc: [() => ACC.flower()] }),
    c_scarf: cat({ c: "#b8bfd0", face: { eye: "dot" }, acc: [() => ACC.scarf()] }),
    c_chef: cat({ c: "#f5ae63", skin: "stripe", c2: "#d9823a", face: { eye: "happy" }, acc: [ACC.chef] }),
    c_beret: cat({ c: "#3f3846", skin: "tux", c2: "#ffffff", face: { eye: "cat", ink: "#1a1418" }, acc: [() => ACC.beret()] }),
    c_glasses: cat({ c: "#a9a194", skin: "tabby", c2: "#6e665c", face: { eye: "dot", glasses: true } }),
    c_cry: cat({ c: "#ffc8d6", face: { eye: "cry", mouth: "o" } }),
    c_sleepy: cat({ c: "#fbf1de", skin: "socks", c2: "#ffffff", face: { eye: "sleep", mouth: "o" } }),
  });
  // ---- 動物朋友 ----
  const ball = (c, extra, o = {}) => () => { const BM = chain(T(0, -.5, 0), S((o.sx || 1)*1.04, (o.sy || .92)*1.5, (o.sz || .92)*1.06)); return [PART("DOME", BM, o.skin ? { skin: [c, o.skin, o.c2, o.c3] } : c), PART("FACE", BM, null, { face: o.face || {} }), ...extra()]; };
  Object.assign(MODELS, {
    a_bear: ball("#c48a5a", () => [...[-1, 1].flatMap(s => [PART("SPH", chain(T(s*.68, .7, 0), S(.3, .3, .2)), "#c48a5a"), PART("SPH", chain(T(s*.68, .7, .12), S(.16, .16, .1)), "#f4c7a8", { outline: false })]), PART("SPH", chain(T(0, -.18, .76), S(.38, .28, .22)), "#f4dcc0", { ow: .02 })], { face: { mouth: "nose" } }),
    a_panda: ball("#ffffff", () => [...[-1, 1].map(s => PART("SPH", chain(T(s*.66, .72, 0), S(.28, .28, .2)), "#2e2a33")), ...[-1, 1].map(s => PART("SPH", chain(T(s*.3, .1, .82), RZ(s*.5), S(.2, .15, .1)), "#2e2a33", { outline: false }))], { face: { eye: "dot", mouth: "nose" }, foot: "#2e2a33", fz: 1.0 }),
    a_rabbit: ball("#fffdf8", () => [-1, 1].flatMap(s => [PART("SPH", chain(T(s*.32, 1.15, -.05), RZ(-s*.15), S(.18, .55, .14)), "#fffdf8"), PART("SPH", chain(T(s*.32, 1.15, .06), RZ(-s*.15), S(.09, .42, .08)), "#ffc1d0", { outline: false })]), {}),
    a_bunnyB: ball("#e8cfae", () => [-1, 1].flatMap(s => [PART("SPH", chain(T(s*.88, .2, .15), RZ(s*.25), S(.2, .55, .16)), "#b88a5e")]), { face: { eye: "happy" } }),
    a_frog: ball("#8fd96c", () => [...[-1, 1].flatMap(s => [PART("SPH", chain(T(s*.42, .78, .1), S(.26, .26, .24)), "#8fd96c"), PART("SPH", chain(T(s*.42, .8, .3), S(.14, .14, .08)), "#ffffff", { outline: false }), PART("SPH", chain(T(s*.42, .8, .37), S(.08, .1, .04)), "#2e2a33", { outline: false })])], { face: { eye: "none", mouth: "smile" }, sy: .8 }),
    a_pig: ball("#ffc2d0", () => [...[-1, 1].map(s => PART("CONE", chain(T(s*.5, .72, 0), RZ(-s*.6), S(.2, .3, .16)), "#ffb0c4"))], { face: { mouth: "pig" } }),
    a_shiba: ball("#f2a65a", () => [...[-1, 1].map(s => PART("CONE", chain(T(s*.5, .66, 0), RZ(-s*.3), S(.28, .45, .24)), "#f2a65a")), PART("TOR", chain(T(.7, .2, -.6), RY(.8), RX(1.2), S(.3, .3, .3)), "#f2a65a")], { skin: "fox", c2: "#fff4e4", face: { mouth: "tongue" } }),
    a_fox: ball("#f28a3a", () => [...[-1, 1].map(s => PART("CONE", chain(T(s*.52, .64, 0), RZ(-s*.35), S(.28, .55, .24)), "#f28a3a")), PART("SPH", chain(T(.78, -.1, -.55), RZ(-.8), S(.25, .55, .25)), "#f28a3a"), PART("SPH", chain(T(1.1, .3, -.62), S(.17, .17, .17)), "#ffffff")], { skin: "fox", c2: "#ffffff", face: { eye: "happy" } }),
    a_hamster: ball("#f5c98a", () => [...[-1, 1].map(s => PART("SPH", chain(T(s*.55, .72, 0), S(.18, .18, .12)), "#f5c98a"))], { skin: "belly", c2: "#fff6e6", face: { mouth: "w" }, sx: 1.1, sy: .88 }),
    a_koala: ball("#aab0bd", () => [...[-1, 1].flatMap(s => [PART("SPH", chain(T(s*.82, .5, 0), S(.36, .36, .18)), "#aab0bd"), PART("SPH", chain(T(s*.82, .5, .1), S(.2, .2, .1)), "#f4dde2", { outline: false })]), PART("SPH", chain(T(0, -.05, .9), S(.17, .22, .12)), "#3a3440")], { face: { mouth: "none" } }),
    a_sheep: () => [PART("SPH", S(1.02, .92, .95), "#fffaf0"), ...Array.from({ length: 10 }, (_, i) => { const a = i/10*Math.PI*2; return PART("SPH", chain(T(Math.cos(a)*.62, .5 + Math.sin(a*2)*.08, Math.sin(a)*.5 - .1), S(.34, .3, .34)), "#fffaf0", { ow: .035 }); }), PART("SPH", chain(T(0, -.05, .55), S(.62, .55, .45)), "#ffe9dc", { ow: .03 }), ...[-1, 1].map(s => PART("SPH", chain(T(s*.68, .2, .45), RZ(s*1.1), S(.12, .26, .08)), "#ffd2c4")), PART("QUAD", chain(T(0, -.02, 1.01), S(.62, .62, 1)), null, { face: {} })],
    a_seal: ball("#eef3f8", () => [...[-1, 1].map(s => PART("SPH", chain(T(s*.85, -.6, .3), RZ(s*.9), S(.1, .3, .2)), "#d5dde8")), PART("SPH", chain(T(0, -.7, -.85), RX(.5), S(.35, .1, .25)), "#d5dde8")], { face: { mouth: "cat", whisker: true }, sx: 1.05, sy: .82, feet: false }),
    a_owl: ball("#b58a63", () => [...[-1, 1].map(s => PART("CONE", chain(T(s*.5, .72, 0), RZ(-s*.4), S(.18, .35, .16)), "#8d6644")), ...[-1, 1].map(s => PART("SPH", chain(T(s*.95, -.25, 0), RZ(s*.4), S(.13, .32, .26)), "#8d6644"))], { skin: "belly", c2: "#f4dcc0", face: { eye: "big", mouth: "beak" } }),
    a_axolotl: ball("#ffc1d4", () => [...[-1, 1].flatMap(s => [0, 1, 2].map(i => PART("SPH", chain(T(s*(.9 + i*.05), .35 + i*.2 - .2, 0), RZ(s*(.9 - i*.4)), S(.07, .28, .07)), "#ff7fa6")))], { face: { eye: "dot", mouth: "smile" }, sx: 1.1, sy: .85 }),
    a_whale: () => [PART("SPH", S(1.15, .85, .95), { skin: ["#7fb8f0", "belly", "#eaf6ff"] }), PART("SPH", chain(T(-1.05, .2, -.2), RZ(.7), S(.1, .35, .3)), "#7fb8f0"), PART("SPH", chain(T(-1.1, .55, -.2), RZ(-.3), S(.1, .3, .25)), "#7fb8f0"), ...[0, 1, 2].map(i => PART("SPH", chain(T(-.15 + i*.15, .95 + (i === 1 ? .12 : 0), 0), S(.06, .12, .06)), "#bfe3ff", { outline: false })), PART("QUAD", chain(T(.15, -.05, .96), S(.8, .8, 1)), null, { face: { eye: "happy" } })],
    a_dino: ball("#8fd96c", () => [...[0, 1, 2, 3].map(i => PART("CONE", chain(T(0, .78 - i*.05, -.25 - i*.25), RX(-.4 - i*.25), S(.14, .3, .1)), "#ffd84d")), PART("SPH", chain(T(.15, -.5, -.85), RX(.8), S(.25, .5, .25)), "#8fd96c")], { skin: "belly", c2: "#d8f5c4", face: { eye: "dot", mouth: "smile" } }),
    a_mouse: ball("#c9cdd8", () => [...[-1, 1].flatMap(s => [PART("SPH", chain(T(s*.6, .7, 0), S(.34, .34, .1)), "#c9cdd8"), PART("SPH", chain(T(s*.6, .7, .06), S(.22, .22, .06)), "#ffc1d0", { outline: false })])], { face: { mouth: "cat", whisker: true } }),
  });
  // ---- 點心 ----
  const facePart = (y, z, sc = .7, f = {}) => PART("QUAD", chain(T(0, y, z), S(sc, sc, 1)), null, { face: f });
  Object.assign(MODELS, {
    f_donut: () => [PART("TOR", chain(T(0, -.2, 0), S(1.05, 1.5, 1.05)), "#e8a05a"), PART("TOR", chain(T(0, -.05, 0), S(1.06, .9, 1.06)), { skin: ["#ff9ec4", "sprinkle"] }, { ow: .03 }), facePart(-.25, 1.05, .55)],
    f_pudding: () => [PART("CYL", chain(T(0, -.25, 0), S(.85, 1.1, .85)), "#ffd56a"), PART("CYL", chain(T(0, .38, 0), S(.82, .14, .82)), "#8a4a20"), PART("CYL", chain(T(0, -.84, 0), S(1.15, .06, 1.15)), "#eaf2ff"), facePart(-.25, .86, .6)],
    f_onigiri: () => [PART("SPH", chain(T(0, -.15, 0), S(1, .85, .7)), "#ffffff"), PART("CONE", chain(T(0, .2, 0), S(.85, .8, .62)), "#ffffff", { ow: .0 }), PART("BOX", chain(T(0, -.6, .55), S(.4, .25, .18)), "#2f3b33"), facePart(.0, .72, .55)],
    f_strawberry: () => [PART("SPH", chain(T(0, -.1, 0), S(.85, 1, .85)), { skin: ["#ff5a6e", "seeds"] }), ...[0, 1, 2, 3, 4].map(i => { const a = i/5*Math.PI*2; return PART("SPH", chain(T(Math.cos(a)*.3, .85, Math.sin(a)*.3), RY(-a), RZ(.6), S(.3, .07, .14)), "#6cbf5a"); }), PART("CYL", chain(T(0, 1.0, 0), S(.05, .2, .05)), "#4f9a3f"), facePart(0, .86, .6)],
    f_peach: () => [PART("SPH", S(1, .95, .95), { skin: ["#ffc2b0", "point", "#ff8f8f"] }), PART("SPH", chain(T(.25, .92, 0), RZ(-.8), S(.28, .1, .14)), "#7fcf6f"), facePart(.0, .96, .7, { eye: "happy" })],
    f_dumpling: () => [PART("SPH", chain(T(0, -.2, 0), S(1.05, .7, 1.05)), "#fffaf0"), ...[0, 1, 2, 3, 4, 5].map(i => { const a = i/6*Math.PI*2; return PART("CONE", chain(T(Math.cos(a)*.18, .35, Math.sin(a)*.18), RY(-a), RZ(.35), S(.14, .3, .08)), "#fffaf0", { ow: .02 }); }), facePart(-.2, 1.08, .6, { eye: "sleep" })],
    f_macaron: () => [PART("SPH", chain(T(0, .3, 0), S(1, .38, 1)), "#ffb3cf"), PART("CYL", chain(T(0, -.02, 0), S(.92, .22, .92)), "#fff6ec", { ow: .02 }), PART("SPH", chain(T(0, -.32, 0), S(1, .38, 1)), "#ffb3cf"), facePart(.3, .82, .5)],
    f_boba: () => [PART("CYL", chain(T(0, -.15, 0), S(.75, 1.4, .75)), "#e8c9a0"), ...Array.from({ length: 8 }, (_, i) => { const a = i/8*Math.PI*2; return PART("SPH", chain(T(Math.cos(a)*.6, -.7, Math.sin(a)*.6), S(.13, .13, .13)), "#3a2424", { outline: false }); }), PART("CYL", chain(T(0, .6, 0), S(.8, .1, .8)), "#ffffff"), PART("CYL", chain(T(.2, 1.1, 0), RZ(-.2), S(.07, .9, .07)), "#f2557a"), facePart(-.1, .77, .55)],
    f_icecream: () => [PART("CONE", chain(T(0, -.15, 0), RX(Math.PI), S(.55, 1.0, .55)), "#e8b16a"), PART("SPH", chain(T(0, .25, 0), S(.72, .62, .72)), "#ffb3cf"), PART("SPH", chain(T(0, .78, 0), S(.12, .12, .12)), "#ff3a5a"), facePart(.2, .72, .55)],
    f_cupcake: () => [PART("CYL", chain(T(0, -.45, 0), S(.75, .7, .75)), "#9fd3ff"), PART("SPH", chain(T(0, .05, 0), S(.85, .5, .85)), "#fff3fa"), PART("SPH", chain(T(0, .45, 0), S(.55, .35, .55)), "#fff3fa"), PART("SPH", chain(T(0, .85, 0), S(.15, .15, .15)), "#ff3a5a"), facePart(-.4, .77, .45)],
    f_toast: () => [PART("BOX", chain(T(0, -.1, 0), S(.85, .8, .35)), "#e8b16a"), PART("BOX", chain(T(0, -.1, .02), S(.75, .7, .35)), "#fff2d6", { outline: false }), PART("SPH", chain(T(0, .65, 0), S(.85, .3, .35)), "#e8b16a"), facePart(-.05, .39, .6)],
  });
  // ---- 超稀有 ----
  Object.assign(MODELS, {
    s_lucky: cat({ c: "#fffdf8", skin: "calico", c2: "#f2a65a", c3: "#3f3542", earL: "#f2a65a", earR: "#3f3542", tailBands: ["#fffdf8", "#f2a65a", "#f2a65a", "#3f3542", "#fffdf8"], wave: true, face: { eye: "happy", mouth: "smile" }, acc: [ACC.coin, () => [PART("TOR", chain(T(0, -.3, 0), S(1.06, 1.1, 1.0)), "#e8484d"), PART("SPH", chain(T(0, -.42, 1.0), S(.13, .13, .13)), "#ffcf3a")]] }),
    s_gold: cat({ c: "#f5c242", skin: "gold", face: { eye: "star", mouth: "smile" }, glow: [.12, .09, 0], acc: [ACC.coin] }),
    s_crown: cat({ c: "#dccdff", face: { eye: "dot", lash: true }, acc: [ACC.crown] }),
    s_angel: cat({ c: "#ffffff", face: { eye: "sleep" }, acc: [ACC.halo, () => ACC.wings()] }),
    s_rainbow: cat({ c: "#ffffff", skin: "rainbow", ear: "#ff8fab", face: { eye: "star", mouth: "smile" } }),
    s_galaxy: cat({ c: "#3a3a8a", skin: "galaxy", ear: "#5a3b9e", face: { eye: "cat", eyeC: "#8ff0ff", ink: "#1a1418" }, glow: [.04, .06, .14] }),
    s_unicorn: cat({ c: "#fff6fb", face: { eye: "dot", lash: true }, earIn: "#c9a6ff", tail: "#c9a6ff", acc: [ACC.horn, () => [PART("SPH", chain(T(-.2, .82, -.3), S(.2, .14, .3)), "#ff9ec4"), PART("SPH", chain(T(.15, .85, -.35), S(.18, .12, .28)), "#9fe0ff")]] }),
  });

  // ---- 小鳥 ----
  function birdParts(o){
    const L = [], c = o.c, body = o.skin ? { skin: [c, o.skin, o.c2, o.c3] } : c;
    if(o.fan) for(let i = 0; i < 9; i++){ const a = -1.25 + i*2.5/8;
      L.push(PART("SPH", chain(T(Math.sin(a)*.95, -.15 + Math.cos(a)*.95, -.85), RZ(-a), S(.26, .62, .07)), o.fan));
      L.push(PART("SPH", chain(T(Math.sin(a)*1.42, -.15 + Math.cos(a)*1.42, -.82), S(.16, .16, .06)), "#2a5fc4", { ow: .03 }));
      L.push(PART("SPH", chain(T(Math.sin(a)*1.42, -.15 + Math.cos(a)*1.42, -.77), S(.08, .08, .04)), "#ffd84d", { outline: false })); }
    if(o.longTail){ L.push(PART("SPH", chain(T(0, .12, -1.15), RX(.75), S(.17, .07, .6)), o.tail || c)); if(o.tailTip) L.push(PART("SPH", chain(T(0, .55, -1.55), RX(.75), S(.15, .07, .2)), o.tailTip));
      if(o.tail3) for(const sx of [-1, 1]) L.push(PART("SPH", chain(T(sx*.38, .25, -1.1), RY(sx*.45), RX(.7), S(.12, .06, .55)), o.tail3)); }
    else L.push(PART("SPH", chain(T(0, -.05, -.98), RX(.7), S(.26, .07, .36)), o.tail || c));
    const BM = chain(T(0, -.45, 0), S(1.02, 1.18, 1.0)); L.push(PART("DOME", BM, body));
    const wing = o.wingSkin ? { skin: o.wingSkin } : (o.wing || c);
    for(const sx of [-1, 1]) L.push(PART("SPH", chain(T(sx*.98, -.3, .05), RY(sx*.2), RZ(sx*1.0), S(.13, .3, .3)), wing));
    
    const bw = (o.bw || .14)*.95, bl = (o.bl || .26)*.85, by = (o.by ?? -.05) - .1;
    L.push(PART("CONE", chain(T(0, by, .93), RX(Math.PI/2 + (o.bd ?? .18)), S(bw, bl, bw*.85)), o.beak || "#f5b04a", { ow: .03 }));
    if(o.beakTip) L.push(PART("CONE", chain(T(0, by - Math.sin(o.bd || 0)*bl*.75, .93 + Math.cos(o.bd || 0)*bl*.75), RX(Math.PI/2 + (o.bd || 0)), S(bw*.45, bl*.32, bw*.4)), o.beakTip, { outline: false }));
    if(o.crest) for(let i = 0; i < 3; i++) L.push(PART("CONE", chain(T(0, .82, .32 - i*.14), RX(-.35 - i*.3), S(.09, .5 - i*.08, .08)), o.crest, { ow: .03 }));
    if(o.tuft) L.push(PART("SPH", chain(T(0, .82, -.15), RX(-.6), S(.26, .2, .4)), o.tuft));
    if(o.comb){ for(let i = 0; i < 3; i++) L.push(PART("SPH", chain(T(0, .92 - Math.abs(i - 1)*.06, .3 - i*.2), S(.1, .17, .1)), o.comb)); L.push(PART("SPH", chain(T(0, -.32, .9), S(.08, .14, .07)), o.comb, { ow: .03 })); }
    if(o.flame) for(let i = 0; i < 3; i++) L.push(PART("CONE", chain(T((i - 1)*.18, .82, .1), RZ((1 - i)*.35), RX(-.2), S(.1, .55 - Math.abs(i - 1)*.15, .1)), i === 1 ? "#ffd84d" : "#ffa53a", { glow: [.1, .06, 0] }));
    L.push(PART("FACE", BM, null, { face: Object.assign({ eye: "dot", mouth: "none", ex: 58, blush: !o.cheek, ring: o.ring, cheek: o.cheek, cheekDot: o.cheekDot, eyeC: o.eyeC }, o.face || {}) }));
    return L;
  }
  const bird = o => () => birdParts(o);
  const BIG = { bw: .22, bl: .3 };
  Object.assign(MODELS, {
    a_chick: bird({ c: "#ffd84d", wing: "#ffc72c", tail: "#ffc72c", tuft: "#ffd84d", beak: "#ffa53a", bw: .15, bl: .2 }),
    a_duck: bird({ c: "#fff6c8", wing: "#ffeca0", tail: "#ffeca0", beak: "#ffa53a", bw: .24, bl: .18 }),
    a_penguin: bird({ c: "#3d4a6b", skin: "tux", c2: "#ffffff", wing: "#3d4a6b", tail: "#3d4a6b", beak: "#ffa53a", bw: .14, bl: .18, face: { ink: "#2e2a33" } }),
    b_javaW: bird(Object.assign({ c: "#fffdf8", beak: "#ff6b7d", ring: "#ff9aa6", feet: "#ffb3c0" }, BIG)),
    b_javaG: bird(Object.assign({ c: "#9aa0ad", skin: "cap", c2: "#2e2a33", tail: "#2e2a33", wing: "#8a909e", beak: "#ff6b7d", cheek: "#ffffff", ring: "#ff9aa6", feet: "#ffb3c0" }, BIG)),
    b_javaC: bird(Object.assign({ c: "#d9bfa3", skin: "cap", c2: "#8a5f45", tail: "#8a5f45", wing: "#cbb093", beak: "#ff6b7d", cheek: "#ffffff", ring: "#ff9aa6", feet: "#ffb3c0" }, BIG)),
    b_cockatiel: bird({ c: "#fff3c4", wing: "#fff7d8", tail: "#fff7d8", crest: "#ffd84d", cheek: "#ff9a3c", beak: "#e8cba8", bw: .16, bl: .2 }),
    b_cockatielG: bird({ c: "#9a9aa3", skin: "mask", c2: "#ffe066", wing: "#8a8a94", tail: "#7a7a84", crest: "#ffe066", cheek: "#ff9a3c", beak: "#c9b8a8", bw: .16, bl: .2 }),
    b_budgieG: bird({ c: "#7ccf5a", skin: "budgie", c2: "#ffe066", c3: "#2e2a33", wingSkin: ["#ffe066", "scallop", "#2e2a33"], tail: "#3a6fd1", cheek: "#6a7fd8", beak: "#e8b88a", bw: .12, bl: .17, by: .0 }),
    b_budgieB: bird({ c: "#7fb3f0", skin: "budgie", c2: "#ffffff", c3: "#2e2a33", wingSkin: ["#ffffff", "scallop", "#2e2a33"], tail: "#3150a8", cheek: "#7a62c9", beak: "#e8b88a", bw: .12, bl: .17, by: .0 }),
    b_lovebird: bird({ c: "#7fd36a", skin: "mask", c2: "#ff9f7a", wing: "#5fb84f", tail: "#3a8fd1", beak: "#ff5a5a", ring: "#ffffff", bw: .2, bl: .24 }),
    b_parrotlet: bird({ c: "#9fe07a", wing: "#6fae5a", tail: "#4a9fd8", beak: "#f2c9a8", bw: .17, bl: .2 }),
    b_quaker: bird({ c: "#7fd36a", skin: "bib", c2: "#dfe4ea", wing: "#5fb84f", tail: "#4fa86a", beak: "#ffcf9a", bw: .18, bl: .22 }),
    b_sparrow: bird({ c: "#c49a6c", skin: "sparrow", c2: "#8a5a3a", c3: "#2e2a33", wingSkin: ["#a8774e", "scallop", "#5a3b2a"], tail: "#8a5a3a", beak: "#4a3a33", bw: .12, bl: .18, feet: "#c9a080" }),
    b_whiteeye: bird({ c: "#b5d94a", skin: "under", c2: "#f2f0d8", wing: "#9cc23a", tail: "#8ab030", ring: "#ffffff", beak: "#4a3a33", bw: .1, bl: .24, feet: "#8a8a94" }),
    b_magpie: bird({ c: "#2f6fd1", skin: "cap", c2: "#2a2530", wing: "#2a5fb8", longTail: true, tail: "#2f6fd1", tailTip: "#ffffff", beak: "#e8484d", feet: "#e8484d", ring: "#ffd84d", bw: .15, bl: .3 }),
    b_bulbul: bird({ c: "#3e3e4a", wing: "#33333e", tail: "#33333e", tuft: "#3e3e4a", beak: "#ff4a3a", feet: "#ff4a3a", ring: "#6e6e7e", bw: .14, bl: .28 }),
    b_whitehead: bird({ c: "#a3b56e", skin: "whitehead", c2: "#2e2a33", c3: "#ffffff", wing: "#8a9e58", tail: "#8a9e58", beak: "#3a3a44", bw: .12, bl: .22, feet: "#6a6a74", face: { eyeC: "#2e2a33" }, cheek: "#ffffff" }),
    b_enaga: bird({ c: "#ffffff", wing: "#f0ebe4", longTail: true, tail: "#2e2a33", beak: "#2e2a33", bw: .07, bl: .1, by: .02, feet: "#5a5a64" }),
    b_robin: bird({ c: "#a87a52", skin: "bib", c2: "#ff7a3a", wing: "#946a46", tail: "#946a46", beak: "#4a3a33", bw: .11, bl: .2, feet: "#c9a080" }),
    b_canary: bird({ c: "#ffe23a", wing: "#ffd21a", tail: "#ffd21a", beak: "#ffb08a", bw: .13, bl: .18 }),
    b_pigeon: bird({ c: "#b3b9c8", skin: "band", c2: "#6fbf8a", c3: "#a77bd1", wing: "#a2a9b8", tail: "#8a90a0", beak: "#5a5a66", bw: .1, bl: .2, feet: "#ff7a8a" }),
    b_flamingo: bird({ c: "#ffa3b8", wing: "#ff7f9e", tail: "#ff7f9e", beak: "#fff0f3", beakTip: "#2e2a33", bd: .55, bw: .16, bl: .4, feet: "#ff7f9e" }),
    b_kingfisher: bird({ c: "#2fa0d8", skin: "under", c2: "#ff8a3a", wing: "#1f86c0", tail: "#1f86c0", cheek: "#ff8a3a", beak: "#2e2a33", bw: .12, bl: .55, feet: "#ff6a4a" }),
    b_toucan: bird({ c: "#2e2a33", skin: "mask", c2: "#ffffff", wing: "#25222a", tail: "#25222a", ring: "#5fc4ff", beak: "#ff9a1a", beakTip: "#e8484d", bw: .3, bl: .8, by: -.1, feet: "#5fc4ff" }),
    b_hen: bird({ c: "#fffaf2", wing: "#f5efe4", tail: "#f5efe4", comb: "#e8484d", beak: "#ffb52a", feet: "#ffb52a", bw: .15, bl: .2 }),
    s_peacock: bird({ c: "#2f62c9", skin: "under", c2: "#1f8a8a", fan: "#3fae6a", wing: "#2a8a7a", tail: "#3fae6a", crest: "#2f62c9", ring: "#ffffff", beak: "#c9b8a8", bw: .12, bl: .2 }),
    s_phoenix: bird({ c: "#e8484d", skin: "under", c2: "#ffcf3a", wing: "#ffa53a", longTail: true, tail: "#ffcf3a", tailTip: "#e8484d", tail3: "#ffa53a", flame: true, ring: "#ffe066", beak: "#ffcf3a", bw: .14, bl: .24, feet: "#ffcf3a" }),
  });

  // 把模型畫出來（所有部件都乘上 base 矩陣）
  const PC = {}; const MOCHI = chain(T(0, -.02, 0), S(1.08, .92, 1.04));
  function drawModel(E, key, base, o = {}){
    const parts = PC[key] || (PC[key] = (MODELS[key] || MODELS.c_orange)());
    const glow = o.glow;
    const B = mul(base, MOCHI);
    for(const p of parts){
      const mx = mul(B, p.mx);
      if(p.o.face){ const fk = p.fk || (p.fk = "f:" + JSON.stringify(p.o.face)); E.blend(true); E.draw(E.M[p.m], mx, null, { tex: E.texture(fk, () => faceCanvas(p.o.face)), decal: true }); E.blend(false); continue; }
      if(p.col && p.col.skin){ const [b, pat, c2, c3] = p.col.skin; E.draw(E.M[p.m], mx, null, Object.assign({ tex: E.texture("s:" + p.col.skin.join(","), () => skinCanvas(b, pat, c2, c3)), glow: p.o.glow || glow }, p.o)); continue; }
      E.draw(E.M[p.m], mx, p.col, Object.assign({ glow: p.o.glow || glow }, p.o));
    }
  }
  window.Toy3D = { Engine, MODELS, drawModel, faceCanvas, skinCanvas, mul, chain, T, S, RX, RY, RZ, seg, hexc };
})();

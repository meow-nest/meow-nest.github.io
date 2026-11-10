// 遊戲：堆雪貓 ☃（冬季限定）
// 按住滾雪球當身體 → 再滾一顆當頭（頭比身體大會掉下來！）→ 幫雪貓戴帽子、圍圍巾 → 放進「雪貓展示區」給 ta 看，ta 可以按愛心。
(function(){
const VW = 90, VH = 110, GROUND = 98;
const OL = "#5a3b2e", SNOW = "#ffffff", SH1 = "#dce8f6", SH2 = "#bccfe8", PINK = "#f7a7b8", BLUSH = "#ffb9c8", DARK = "#2b1d18";
const COLORS = { red: ["#e5484d","#b92f3a"], pink: ["#f08aa0","#cf5f7a"], blue: ["#5e9de6","#3f73b8"], green: ["#4fb894","#2f8a6a"], yellow: ["#f5c242","#c9962a"], purple: ["#a77fe6","#7c57bd"] };
const CNAME = { red: "紅", pink: "粉紅", blue: "藍", green: "綠", yellow: "黃", purple: "紫" };
const OPTS = {
  ear:   [["cat","貓耳"],["fold","折耳"],["none","沒有"]],
  eye:   [["dot","圓眼"],["happy","笑眼"],["heart","愛心"],["sleep","睡覺"],["star","星星"]],
  mouth: [["w","ω 嘴"],["o","喔嘴"],["tongue","吐舌"]],
  hat:   [["none","沒有"],["beanie","毛帽"],["santa","聖誕帽"],["muff","耳罩"],["bow","蝴蝶結"]],
  scarf: [["none","沒有"],["plain","圍巾"],["stripe","條紋圍巾"]],
  arm:   [["none","沒有"],["twig","樹枝手"],["mitten","手套"]],
  btn:   [["none","沒有"],["coal","煤炭"],["heart","愛心"]],
  bg:    [["day","白天"],["night","夜晚"],["sunset","黃昏"]],
};
const TABS = [["ear","耳朵"],["eye","眼睛"],["mouth","嘴巴"],["hat","帽子","hatC"],["scarf","圍巾","scarfC"],["arm","手","armC"],["btn","鈕扣"],["bg","背景"]];
const DEF = { rb: 20, rh: 14, ear: "cat", eye: "dot", mouth: "w", hat: "beanie", hatC: "red", scarf: "plain", scarfC: "blue", arm: "twig", armC: "pink", btn: "coal", bg: "day" };

// ---------- 畫圖（像素） ----------
function painter(cv){
  const g = cv.getContext("2d");
  const px = (x, y, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), 1, 1); };
  const rect = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  const disc = (cx, cy, r, fill, opt = {}) => {
    const r2 = r*r, ri = (r-1.1)*(r-1.1);
    for(let y = Math.floor(cy-r); y <= Math.ceil(cy+r); y++) for(let x = Math.floor(cx-r); x <= Math.ceil(cx+r); x++){
      const dx = x + .5 - cx, dy = y + .5 - cy, d2 = dx*dx + dy*dy; if(d2 > r2) continue;
      if(opt.clip && !opt.clip(x, y)) continue;
      if(d2 > ri && opt.ol !== false) { px(x, y, opt.ol || OL); continue; }
      let c = fill;
      if(opt.shade){ const s = (dx*.55 + dy*.85)/r; if(s > .62) c = opt.shade[1]; else if(s > .25) c = opt.shade[0]; if(s < -.55 && dx < 0 && dy < 0 && d2 < r2*.35) c = opt.hi || c; }
      px(x, y, c);
    } };
  const tri = (a, b, c, fill, ol) => {
    const minX = Math.floor(Math.min(a[0],b[0],c[0])), maxX = Math.ceil(Math.max(a[0],b[0],c[0])), minY = Math.floor(Math.min(a[1],b[1],c[1])), maxY = Math.ceil(Math.max(a[1],b[1],c[1]));
    const ar = (p, q, r) => (q[0]-p[0])*(r[1]-p[1]) - (q[1]-p[1])*(r[0]-p[0]);
    const A = ar(a, b, c); if(!A) return;
    const inside = (x, y) => { const p = [x+.5, y+.5]; const w0 = ar(b, c, p)/A, w1 = ar(c, a, p)/A, w2 = ar(a, b, p)/A; return w0 >= 0 && w1 >= 0 && w2 >= 0; };
    for(let y = minY; y <= maxY; y++) for(let x = minX; x <= maxX; x++) if(inside(x, y)){
      const edge = ol && (!inside(x-1,y) || !inside(x+1,y) || !inside(x,y-1) || !inside(x,y+1)); px(x, y, edge ? ol : fill); } };
  const line = (x0, y0, x1, y1, c) => { x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1-x0), dy = -Math.abs(y1-y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx + dy;
    for(let i = 0; i < 200; i++){ px(x0, y0, c); if(x0 === x1 && y0 === y1) break; const e2 = 2*e; if(e2 >= dy){ e += dy; x0 += sx; } if(e2 <= dx){ e += dx; y0 += sy; } } };
  const heart = (x, y, c) => { [[1,0],[3,0],[0,1],[1,1],[2,1],[3,1],[4,1],[1,2],[2,2],[3,2],[2,3]].forEach(([a,b]) => px(x+a, y+b, c)); };
  return { g, px, rect, disc, tri, line, heart };
}

function drawBg(P, bg, t){
  const { rect, px, disc } = P;
  const sky = bg === "night" ? ["#1b2142","#232c55","#2c3868","#36457a"] : bg === "sunset" ? ["#ffc9a8","#ffbaa6","#ffaeb0","#f9a3b8"] : ["#bfe0ff","#cde7ff","#dbeeff","#e8f4ff"];
  for(let i = 0; i < 4; i++) rect(0, i*25, VW, 26, sky[i]);
  if(bg === "night"){ [[8,8],[20,18],[33,6],[52,14],[70,7],[82,20],[62,27],[12,32],[40,24]].forEach(([x,y],i) => { const tw = Math.sin(t*2 + i) > -.3; px(x, y, tw ? "#fff6c9" : "#9aa6d8"); });
    disc(74, 16, 7, "#fff3c4", { ol: "#e8d48a" }); disc(77, 14, 6, sky[0], { ol: false }); }
  else if(bg === "sunset") disc(70, 40, 9, "#ffe08a", { ol: "#ffb35c" });
  else { disc(16, 14, 6, "#fff6b0", { ol: "#ffd45c" }); }
  // 遠山
  const hill = bg === "night" ? "#c7d3ee" : "#f2f7ff", hs = bg === "night" ? "#a9b8de" : "#dbe7f7";
  disc(14, 104, 30, hill, { ol: false, shade: [hill, hs] }); disc(80, 108, 34, hill, { ol: false, shade: [hill, hs] });
  // 小松樹
  const tree = (x, y, s) => { P.tri([x, y - 14*s], [x - 7*s, y], [x + 7*s, y], "#3f8f6a", "#2a6248"); P.tri([x, y - 18*s], [x - 5*s, y - 8*s], [x + 5*s, y - 8*s], "#4fa37a", "#2a6248");
    rect(x - 1, y, 2, 3*s, "#7a5232"); px(x - 1, y - 17*s, "#fff"); px(x, y - 18*s, "#fff"); px(x + 2, y - 9*s, "#fff"); px(x - 4*s, y - 3, "#fff"); };
  tree(10, 90, 1); tree(82, 88, 1.15);
  // 雪地
  rect(0, GROUND - 4, VW, VH - GROUND + 4, bg === "night" ? "#e2eaf7" : "#f8fbff"); rect(0, GROUND - 4, VW, 1, bg === "night" ? "#b8c6e3" : "#d6e4f5");
  for(let x = 3; x < VW; x += 9) px(x, GROUND + 3 + (x % 3), bg === "night" ? "#c6d3ec" : "#dde8f6");
}

function drawSnow(P, t, n){
  for(let i = 0; i < (n || 26); i++){
    const sp = 6 + (i*7 % 9), x = (i*37 + Math.sin(t*1.3 + i)*3 + 400) % VW, y = ((i*53 + t*sp) % (VH + 6)) - 3;
    P.px(x, y, "#ffffff"); if(i % 4 === 0) { P.px(x + 1, y, "#ffffff"); P.px(x, y + 1, "#eef4fc"); }
  }
}

// 雪貓本體：b = 身體中心 y、h = 頭中心 y（動畫時可以改），d = 外觀
function drawCat(P, d, o){
  o = o || {}; const { disc, rect, px, tri, line, heart } = P;
  const cx = 45 + (o.hx || 0), rb = d.rb, rh = d.rh;
  const by = o.by != null ? o.by : GROUND - rb + 2;
  const hy = o.hy != null ? o.hy : by - rb - rh + 5;
  const hx = cx + (o.hdx || 0);
  const col = k => COLORS[d[k]] || COLORS.red;
  if(!o.noBody){
    // 尾巴
    if(!o.noTail) [[.95,.55,3.2],[1.12,.3,2.8],[1.2,.02,2.5],[1.12,-.22,2.2]].forEach(([a,b,r]) => disc(cx + rb*a, by + rb*b, r, SNOW, { shade: [SH1, SH2] }));
    // 手（在身體後面）
    if(d.arm !== "none" && o.deco !== false){
      [-1, 1].forEach(s => { const x0 = cx + s*rb*.8, y0 = by - rb*.35, x1 = x0 + s*12, y1 = y0 - 9;
        line(x0, y0, x1, y1, "#7a5232"); line(x0, y0 + 1, x1, y1 + 1, "#5e3d22"); line(x1 - s*4, y1 + 3, x1 - s*6, y1 - 2, "#7a5232");
        if(d.arm === "mitten"){ const c = col("armC"); disc(x1 + s, y1, 3.2, c[0], { ol: OL, shade: [c[0], c[1]] }); disc(x1 - s*2.2, y1 + 1.5, 1.6, c[0], { ol: OL }); } });
    }
    disc(cx, by, rb, SNOW, { shade: [SH1, SH2], hi: "#ffffff" });
    if(o.deco !== false){
      if(d.btn === "coal") [-.35, .05, .45].forEach(k => { if(rb*k > -rb + 4) { rect(cx - 1, by + rb*k - 1, 2, 2, DARK); } });
      if(d.btn === "heart") [-.3, .2].forEach(k => heart(cx - 2, by + rb*k - 2, "#e5486a"));
    }
  }
  if(o.noHead) return;
  // 耳朵（在頭後面）
  const earPts = s => [[hx + s*rh*.92, hy - rh*.25], [hx + s*rh*.62, hy - rh - 5], [hx + s*rh*.1, hy - rh*.82]];
  const ears = () => { if(d.ear === "cat") [-1, 1].forEach(s => { const p = earPts(s); tri(p[0], p[1], p[2], SNOW, OL); tri([p[0][0] - s*2.5, p[0][1] - 2.5], [p[1][0] - s*.8, p[1][1] + 3.5], [p[2][0] + s*2.2, p[2][1] + .5], PINK); });
    else if(d.ear === "fold") [-1, 1].forEach(s => disc(hx + s*rh*.68, hy - rh*.72, rh*.36, SNOW, { shade: [SH1, SH2] })); };
  const hatBehind = d.hat === "beanie" || d.hat === "santa";
  if(!hatBehind || d.hat === "beanie") ears();
  disc(hx, hy, rh, SNOW, { shade: [SH1, SH2], hi: "#ffffff" });
  // 臉
  const ey = hy - rh*.05, ex = Math.max(3, Math.round(rh*.42));
  [-1, 1].forEach(s => { const x = Math.round(hx + s*ex) - (s < 0 ? 1 : 0), y = Math.round(ey);
    if(d.eye === "dot"){ rect(x, y - 1, 2, 2, DARK); px(x, y - 1, "#fff"); }
    else if(d.eye === "happy"){ px(x - 1, y, DARK); px(x, y - 1, DARK); px(x + 1, y - 1, DARK); px(x + 2, y, DARK); }
    else if(d.eye === "heart"){ heart(x - 1, y - 2, "#e5486a"); }
    else if(d.eye === "sleep"){ px(x - 1, y - 1, DARK); px(x, y, DARK); px(x + 1, y, DARK); px(x + 2, y - 1, DARK); }
    else if(d.eye === "star"){ px(x, y - 2, "#e8a400"); rect(x - 1, y - 1, 3, 1, "#f5c242"); px(x, y, "#f5c242"); px(x - 1, y + 1, "#e8a400"); px(x + 1, y + 1, "#e8a400"); }
    rect(Math.round(hx + s*(ex + 1.5)) - 1, y + 2, 2, 1, BLUSH);
    line(hx + s*(rh*.55), ey + 3, hx + s*(rh + 2), ey + 2, "#9a8a86"); line(hx + s*(rh*.55), ey + 4.5, hx + s*(rh + 2), ey + 5, "#9a8a86"); });
  const my = Math.round(ey + 3), mx = Math.round(hx);
  rect(mx - 1, my, 2, 1, "#f0708d");
  if(d.mouth === "o"){ rect(mx - 1, my + 2, 2, 2, DARK); }
  else { [[-2,1],[-1,2],[0,1],[1,2],[2,1]].forEach(([a,b]) => px(mx + a, my + b, DARK)); if(d.mouth === "tongue") rect(mx - 1, my + 3, 2, 2, "#f0708d"); }
  // 帽子
  if(o.deco !== false){
    const c = col("hatC");
    if(d.hat === "beanie"){ disc(hx, hy - rh*.42, rh*.86, c[0], { shade: [c[0], c[1]], clip: (x, y) => y <= hy - rh*.42 }); rect(hx - rh*.9, hy - rh*.5, rh*1.8, 3, c[1]); rect(hx - rh*.9, hy - rh*.5, rh*1.8, 1, OL);
      for(let x = Math.round(hx - rh*.8); x < hx + rh*.8; x += 3) px(x, hy - rh*.5 + 1, c[0]); disc(hx, hy - rh*1.3, 3, SNOW, { shade: [SH1, SH2] }); }
    if(d.hat === "santa"){ tri([hx - rh*.95, hy - rh*.45], [hx + rh*.95, hy - rh*.45], [hx + rh*1.25, hy - rh*1.75], c[0], OL); rect(hx - rh, hy - rh*.55, rh*2, 4, SNOW); rect(hx - rh, hy - rh*.55, rh*2, 1, OL); rect(hx - rh, hy - rh*.55 + 4, rh*2, 1, SH2);
      disc(hx + rh*1.25, hy - rh*1.75, 3, SNOW, { shade: [SH1, SH2] }); }
    if(d.hat === "muff"){ for(let a = Math.PI*1.08; a <= Math.PI*1.92; a += .04){ const x = hx + Math.cos(a)*(rh + 1), y = hy + Math.sin(a)*(rh + 1); rect(x - 1, y - 1, 2, 2, c[1]); }
      [-1, 1].forEach(s => disc(hx + s*rh*.98, hy - rh*.05, rh*.36, c[0], { shade: [c[0], c[1]] })); }
    if(d.hat === "bow"){ const bx = hx + rh*.55, byy = hy - rh*.88; tri([bx, byy], [bx - 6, byy - 4], [bx - 6, byy + 3], c[0], OL); tri([bx, byy], [bx + 6, byy - 4], [bx + 6, byy + 3], c[0], OL); disc(bx, byy, 2, c[1]); }
    // 圍巾
    if(d.scarf !== "none"){ const s = col("scarfC"), y0 = hy + rh*.7, w = Math.min(rh*1.05, rb*.95);
      rect(hx - w, y0, w*2, 5, s[0]); rect(hx - w, y0, w*2, 1, OL); rect(hx - w, y0 + 5, w*2, 1, OL); px(hx - w - 1, y0 + 1, OL); px(hx + w, y0 + 1, OL);
      if(d.scarf === "stripe") for(let x = Math.round(hx - w) + 1; x < hx + w; x += 4) rect(x, y0 + 1, 2, 4, "#ffffff");
      const tx = hx + w*.35; rect(tx, y0 + 5, 5, 9, s[0]); rect(tx - 1, y0 + 5, 1, 9, OL); rect(tx + 5, y0 + 5, 1, 9, OL); rect(tx, y0 + 13, 5, 1, s[1]);
      if(d.scarf === "stripe") rect(tx, y0 + 8, 5, 2, "#ffffff"); for(let i = 0; i < 5; i += 2) px(tx + i, y0 + 14, s[1]); }
  }
}

function render(cv, d, o){ const P = painter(cv); P.g.clearRect(0, 0, VW, VH); drawBg(P, d.bg, (o && o.t) || 0); drawCat(P, d, o); if(!o || o.snow !== false) drawSnow(P, (o && o.t) || 0, o && o.snowN); }
function thumb(d){ const c = document.createElement("canvas"); c.width = VW; c.height = VH; render(c, d, { snow: false, t: 2 }); return c; }
window.SnowCat = { render, thumb, DEF, VW, VH };

// ---------- 遊戲 ----------
App.registerGame({
  id: "snowcat",
  solo: true,
  name: "堆雪貓",
  desc: "冬季限定！滾雪球堆一隻雪貓給 ta 看",
  icon: () => { const c = thumb(Object.assign({}, DEF, { bg: "day" })); return `<img src="${c.toDataURL()}" style="image-rendering:pixelated;width:100%;height:auto;display:block" alt="">`; },
  mount(el, ctx){
    const { esc, SFX } = ctx, K = window.MiniKit;
    let s = null, alive = true, view = "lobby", raf = 0;
    const me = () => ctx.me.uid, partner = () => ctx.partner();
    const list = () => ((s && s.list) || []).slice().sort((a, b) => b.at - a.at);
    function lobby(){
      if(!alive || view !== "lobby") return; cancelAnimationFrame(raf);
      const L = list(), p = partner();
      el.innerHTML = `<div class="box skLobby scLobby">
        <div class="scHero"><canvas width="${VW}" height="${VH}" id="scHero"></canvas></div>
        <p class="skIntro"><b>冬季限定</b> ☃<br>按住滾雪球當身體，再滾一顆當頭<br>（頭比身體大會掉下來喔！）<br>再幫雪貓戴帽子、圍圍巾～</p>
        <button class="btn" id="scGo">☃ 開始堆雪貓</button>
        <div class="k" style="text-align:center">每天第一隻雪貓送 2 個貓幣 🪙</div></div>
        <div class="box scGal"><h3>❄ 雪貓展示區 <span class="k">${L.length ? `${L.length} 隻` : ""}</span></h3>
        ${L.length ? `<div class="scGrid">${L.map(x => `<button class="scItem" data-id="${x.id}"><span class="scTh" data-d='${esc(JSON.stringify(x.d))}'></span><b>${x.by === me() ? "你" : esc(ctx.nameOf(x.by) || (p && p.name) || "ta")}</b><i>${Object.keys(x.likes || {}).length ? `❤ ${Object.keys(x.likes).length}` : ""}</i></button>`).join("")}</div>`
          : `<div class="k" style="text-align:center;padding:10px">還沒有雪貓，堆第一隻吧！${p ? `<br>堆好的雪貓 ${esc(p.name)} 也看得到 💕` : ""}</div>`}</div>`;
      el.querySelectorAll(".scTh").forEach(t => { try{ t.appendChild(thumb(JSON.parse(t.dataset.d))); }catch(e){} });
      el.querySelector("#scGo").addEventListener("click", build);
      el.querySelectorAll(".scItem").forEach(b => b.addEventListener("click", () => openItem(b.dataset.id)));
      const hero = el.querySelector("#scHero"), hd = L[0] ? L[0].d : DEF; let t0 = performance.now();
      const loop = () => { if(!el.contains(hero)) return; render(hero, hd, { t: (performance.now() - t0)/1000 }); raf = requestAnimationFrame(loop); }; loop();
    }
    function openItem(id){
      const x = list().find(i => i.id === id); if(!x) return; SFX.tap();
      const mineIt = x.by === me(), liked = !!(x.likes || {})[me()], n = Object.keys(x.likes || {}).length;
      const box = document.createElement("div"); box.className = "careModal scView";
      box.innerHTML = `<div class="cmBox"><canvas width="${VW}" height="${VH}" class="scBig"></canvas>
        <div class="scBy">${mineIt ? "你" : esc(ctx.nameOf(x.by) || "ta")} 堆的雪貓・${new Date(x.at).toLocaleDateString("zh-TW", { month: "numeric", day: "numeric" })}</div>
        <div class="scBtns">${!mineIt ? `<button class="btn ${liked ? "sub" : ""}" id="scLike">${liked ? "❤ 已經按愛心了" : "❤ 按愛心"}</button>` : `<div class="k">${n ? `收到 ${n} 個愛心 ❤` : "還沒有人按愛心"}</div>`}
        ${mineIt ? `<button class="btn sub" id="scDel">🗑 融化它</button>` : ""}<button class="btn sub" id="scClose">關閉</button></div></div>`;
      document.body.appendChild(box);
      const cv = box.querySelector(".scBig"); let t0 = performance.now(), r2 = 0;
      const loop = () => { if(!document.body.contains(cv)) return; render(cv, x.d, { t: (performance.now() - t0)/1000 }); r2 = requestAnimationFrame(loop); }; loop();
      const close = () => { cancelAnimationFrame(r2); box.remove(); };
      box.querySelector("#scClose").addEventListener("click", close);
      box.addEventListener("click", e => { if(e.target === box) close(); });
      const lk = box.querySelector("#scLike"); if(lk) lk.addEventListener("click", async () => {
        if(liked) return; SFX.select(); ctx.burst();
        await ctx.update("snowcat", st => { const it = st && (st.list || []).find(i => i.id === id); if(!it) return undefined; it.likes = it.likes || {}; it.likes[me()] = Date.now(); return st; });
        ctx.notifyPartner(`${ctx.me.name} 幫你的雪貓按了愛心 ❤`); close(); });
      const dl = box.querySelector("#scDel"); if(dl) dl.addEventListener("click", async () => {
        if(!confirmDel(dl)) return; SFX.miss();
        await ctx.update("snowcat", st => { if(!st) return undefined; st.list = (st.list || []).filter(i => !(i.id === id && i.by === me())); return st; }); close(); });
    }
    const confirmDel = b => { if(b.dataset.ok) return true; b.dataset.ok = "1"; b.textContent = "再按一次就融化"; return false; };

    // ---------- 堆雪貓 ----------
    function build(){
      SFX.tap(); view = "build"; cancelAnimationFrame(raf);
      const d = Object.assign({}, DEF, { rb: 6, rh: 5 });
      let stage = "body", grow = 0, holding = false, t0 = performance.now(), last = t0, drop = null, puffs = [], tab = "hat", shakeT = 0;
      el.innerHTML = `<div class="box sc"><div class="scMsg" id="scMsg"></div><div class="scStage"><canvas width="${VW}" height="${VH}" class="scCv" id="scCv"></canvas></div><div id="scCtl"></div></div>`;
      const cv = el.querySelector("#scCv"), msg = el.querySelector("#scMsg"), ctl = el.querySelector("#scCtl");
      const say = (h) => { msg.innerHTML = h; msg.classList.remove("pop"); void msg.offsetWidth; msg.classList.add("pop"); };
      const sizeWord = (r, lo, hi) => r < lo + (hi-lo)*.33 ? "小小的" : r < lo + (hi-lo)*.7 ? "剛剛好" : "好大顆！";
      function rollCtl(label){
        ctl.innerHTML = `<button class="scRoll" id="scRoll"><span>${label}</span><i>按住不放</i></button>`;
        const b = ctl.querySelector("#scRoll");
        const down = e => { e.preventDefault(); if(stage !== "body" && stage !== "head") return; holding = true; b.classList.add("on"); SFX.tap(); };
        const up = () => { if(!holding) return; holding = false; b.classList.remove("on"); release(); };
        b.addEventListener("pointerdown", down); b.addEventListener("pointerup", up); b.addEventListener("pointerleave", up); b.addEventListener("pointercancel", up);
      }
      function release(){
        if(stage === "body"){
          if(d.rb < 12){ say("太小了～再滾大一點！"); SFX.miss(); d.rb = 6; return; }
          SFX.place(); stage = "head"; d.rh = 5; say(`身體${sizeWord(d.rb, 12, 26)} ✨<br>再滾一顆當<b>頭</b>（要比身體小喔）`); rollCtl("⛄ 滾頭");
        } else if(stage === "head"){
          if(d.rh < 8){ say("頭太小了～再滾大一點！"); SFX.miss(); d.rh = 5; return; }
          stage = "drop"; ctl.innerHTML = ""; drop = { y: -d.rh, v: 0, fail: d.rh >= d.rb - 1, t: 0, x: 0, rot: 0 };
        }
      }
      function decoCtl(){
        const tabsH = TABS.map(([k, n]) => `<button class="scTab ${tab===k?"on":""}" data-t="${k}">${n}</button>`).join("");
        const T = TABS.find(x => x[0] === tab), opts = OPTS[tab];
        ctl.innerHTML = `<div class="scTabs">${tabsH}</div>
          <div class="scOpts">${opts.map(([v, n]) => `<button class="scOpt ${d[tab]===v?"on":""}" data-v="${v}">${n}</button>`).join("")}</div>
          ${T[2] && d[tab] !== "none" ? `<div class="scCols">${Object.keys(COLORS).map(c => `<button class="scCol ${d[T[2]]===c?"on":""}" data-c="${c}" style="background:${COLORS[c][0]}" aria-label="${CNAME[c]}"></button>`).join("")}</div>` : ""}
          <div class="scDone"><button class="btn sub" id="scRe">↩ 重新堆</button><button class="btn" id="scOk">✅ 完成！</button></div>`;
        ctl.querySelectorAll(".scTab").forEach(b => b.addEventListener("click", () => { tab = b.dataset.t; SFX.key(.9); decoCtl(); }));
        ctl.querySelectorAll(".scOpt").forEach(b => b.addEventListener("click", () => { d[tab] = b.dataset.v; SFX.select(); shakeT = performance.now(); decoCtl(); }));
        ctl.querySelectorAll(".scCol").forEach(b => b.addEventListener("click", () => { d[T[2]] = b.dataset.c; SFX.key(1.1); shakeT = performance.now(); decoCtl(); }));
        ctl.querySelector("#scRe").addEventListener("click", () => { SFX.tap(); build(); });
        ctl.querySelector("#scOk").addEventListener("click", finish);
      }
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
        if(holding && stage === "body"){ d.rb = Math.min(26, d.rb + dt*7.5); if(Math.random() < .5) puffs.push({ x: 45 + (Math.random()-.5)*d.rb*2, y: GROUND, vx: (Math.random()-.5)*20, vy: -10 - Math.random()*15, l: .5 }); if(d.rb >= 26 && !msg.dataset.max){ msg.dataset.max = 1; say("推不動了！放開吧～"); } }
        if(holding && stage === "head"){ d.rh = Math.min(24, d.rh + dt*6.5); }
        puffs.forEach(p => { p.x += p.vx*dt; p.y += p.vy*dt; p.vy += 40*dt; p.l -= dt; }); puffs = puffs.filter(p => p.l > 0);
        const P = painter(cv); P.g.clearRect(0, 0, VW, VH); drawBg(P, d.bg, t);
        const wob = stage === "deco" && now - shakeT < 300 ? Math.sin((now - shakeT)/30) * (1 - (now - shakeT)/300) * 1.5 : 0;
        if(stage === "body"){ drawCat(P, d, { noHead: true, deco: false, noTail: true }); }
        else if(stage === "head"){ drawCat(P, d, { noHead: true, deco: false }); const ry = GROUND - 2*d.rb - d.rh - 6; drawCat(P, Object.assign({}, d, { rb: 1 }), { noBody: true, deco: false, hy: Math.max(d.rh + 2, ry), hx: 0 }); }
        else if(stage === "drop"){
          const target = GROUND - d.rb + 2 - d.rb - d.rh + 5;
          if(!drop.landed){ drop.v += 260*dt; drop.y += drop.v*dt; if(drop.y >= target){ drop.y = target; drop.landed = true; drop.t = 0; SFX.place();
            if(!drop.fail){ stage = "deco"; d.hat = "beanie"; say("站好了！現在來<b>打扮</b>雪貓 🎀"); decoCtl(); } } }
          else if(drop.fail){ drop.t += dt; drop.x += (20 + drop.t*90)*dt; drop.y += drop.t*drop.t*60*dt;
            if(drop.t > .05 && !drop.said){ drop.said = 1; say("頭太大了…<b>掉下來了！</b>😹<br>再滾一顆小一點的頭"); SFX.miss(); }
            if(drop.t > 1.1){ stage = "head"; d.rh = 5; rollCtl("⛄ 再滾一次頭"); } }
          drawCat(P, d, { deco: false, noHead: true }); if(stage === "drop" || stage === "deco") drawCat(P, d, { noBody: true, deco: false, hy: drop.y, hdx: drop.x });
        }
        else drawCat(P, d, { hdx: wob });
        puffs.forEach(p => P.px(p.x, p.y, "#ffffff"));
        drawSnow(P, t);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }
    this._u = ctx.onState("snowcat", st => { s = st; if(view === "lobby") lobby(); });
    this._stop = () => { alive = false; cancelAnimationFrame(raf); document.querySelectorAll(".scView").forEach(x => x.remove()); };
    (async () => { const cur = await ctx.getState("snowcat").catch(() => null); s = cur ? cur.state : null; lobby(); })();
  },
  unmount(){ if(this._u) this._u(); if(this._stop) this._stop(); },
});
if(window.GameArt) window.GameArt.snowcat = () => { const c = thumb(Object.assign({}, DEF, { bg: "night", hat: "santa", scarfC: "red", eye: "happy" })); return `<span class="gaL" style="left:18%;top:0;width:64%"><img src="${c.toDataURL()}" style="image-rendering:pixelated;width:100%;display:block;border:2px solid #5a3b2e" alt=""></span>`; };
})();

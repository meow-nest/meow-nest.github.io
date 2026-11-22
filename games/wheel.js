// 幫我選：選擇困難的時候用（轉盤、抽籤筒、扭蛋機、翻牌，四種玩法用同一份選項）
// 每個人自己的題目存在 game_state「wheel:自己 uid 前 8 碼」（同小窩的人介面上看不到別人的）。
// 純粹幫忙做決定：不用任何貓幣／小魚乾、沒有獎勵，不是抽獎。
(function(){
const WCOL = ["#ffd6e0","#fff1b8","#d4f0ff","#dff5d6","#eadcff","#ffe2c4","#fcd0ea","#cdeee8"];
const CAPC = ["#f28ba3","#ffc94d","#6fb7e8","#6cc49d","#a58be8","#ff9f5a","#ee7fc4","#4fc2b0"];
const LINE = "#5a3b2e";
const MAX_OPT = 20, MAX_W = 20, OPT_LEN = 12;
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const DEFAULTS = () => [
  { id: "eat", name: "今天吃什麼", opts: ["拉麵","火鍋","便當","咖哩飯","義大利麵","壽司","炒飯","牛肉麵"] },
  { id: "drink", name: "喝什麼", opts: ["珍珠奶茶","美式咖啡","拿鐵","綠茶","果汁","奶茶"] },
  { id: "go", name: "去哪裡玩", opts: ["看電影","逛街","夜市","公園散步","咖啡廳","在家耍廢"] },
  { id: "yn", name: "要不要", opts: ["要！","不要","再想想"] },
];
// 四種玩法（小圖示是向量畫的，不用 emoji）
const MODES = [
  { id: "wheel", n: "轉盤", go: "轉！", again: "再轉一次", busy: "轉轉轉…", got: "轉到",
    ic: `<svg viewBox="0 0 32 32"><g stroke="${LINE}" stroke-width="2.2"><path d="M16 17 L16 5 A12 12 0 0 1 28 17 Z" fill="#ffd6e0"/><path d="M16 17 L28 17 A12 12 0 0 1 16 29 Z" fill="#fff1b8"/><path d="M16 17 L16 29 A12 12 0 0 1 4 17 Z" fill="#d4f0ff"/><path d="M16 17 L4 17 A12 12 0 0 1 16 5 Z" fill="#dff5d6"/></g><path d="M12 1 L20 1 L16 7 Z" fill="#f08aa0" stroke="${LINE}" stroke-width="1.6" stroke-linejoin="round"/></svg>` },
  { id: "stick", n: "抽籤", go: "搖籤筒", again: "再抽一次", busy: "搖搖搖…", got: "抽到",
    ic: `<svg viewBox="0 0 32 32"><g stroke="${LINE}" stroke-width="1.8"><rect x="11" y="2" width="4" height="16" fill="#f3d9a4"/><rect x="17" y="4" width="4" height="14" fill="#f3d9a4"/><rect x="11" y="2" width="4" height="4" fill="#e5486a"/><rect x="17" y="4" width="4" height="4" fill="#e5486a"/><rect x="7" y="13" width="18" height="17" rx="3" fill="#e5486a"/><rect x="7" y="17" width="18" height="3" fill="#ffd36b"/></g></svg>` },
  { id: "gacha", n: "扭蛋", go: "轉扭蛋", again: "再扭一次", busy: "喀啦喀啦…", got: "扭到",
    ic: `<svg viewBox="0 0 32 32"><g stroke="${LINE}" stroke-width="2"><circle cx="16" cy="11" r="9" fill="#e8f6ff"/><rect x="7" y="18" width="18" height="12" rx="3" fill="#f08aa0"/><circle cx="16" cy="24" r="3" fill="#fff1b8"/></g><circle cx="13" cy="10" r="3" fill="#ffc94d" stroke="${LINE}" stroke-width="1.4"/><circle cx="19" cy="13" r="3" fill="#6fb7e8" stroke="${LINE}" stroke-width="1.4"/></svg>` },
  { id: "card", n: "翻牌", go: "洗牌", again: "再翻一次", busy: "洗牌中…", got: "翻到",
    ic: `<svg viewBox="0 0 32 32"><g stroke="${LINE}" stroke-width="2" stroke-linejoin="round"><rect x="4" y="7" width="14" height="20" rx="2" fill="#f08aa0" transform="rotate(-12 11 17)"/><rect x="13" y="5" width="14" height="20" rx="2" fill="#fffaf2" transform="rotate(8 20 15)"/></g><circle cx="20.5" cy="15" r="3" fill="#ffd36b" stroke="${LINE}" stroke-width="1.4"/></svg>` },
];

// 遊戲大廳卡片的小插圖（轉盤＋籤筒）
window.PickArt = () => `<span class="gaL" style="left:4%;top:2%;width:58%">${MODES[0].ic.replace("<svg", '<svg width="100%"')}</span><span class="gaL" style="left:50%;top:6%;width:26%;transform:rotate(12deg)">${MODES[1].ic.replace("<svg", '<svg width="100%"')}</span>`;
App.registerGame({
  id: "wheel",
  name: "幫我選",
  desc: "轉盤、抽籤、扭蛋、翻牌，選擇困難救星",
  solo: true,
  icon: () => MODES[0].ic,
  mount(el, ctx){
    const { esc, SFX } = ctx;
    const KEY = "wheel:" + String(ctx.me.uid || "me").slice(0, 8);
    let s = null, rot = 0, busy = false, raf = 0, alive = true, deal = null;   // deal＝翻牌洗好的順序
    const timers = new Set(); const later = (f, ms) => { const t = setTimeout(() => { timers.delete(t); if(alive) f(); }, ms); timers.add(t); return t; };
    const out = {};   // 這次打開時「拿掉」的選項（不存檔）：{題目id: Set}
    const lsGet = k => { try{ return localStorage.getItem(k); }catch(e){ return null; } }, lsSet = (k, v) => { try{ localStorage.setItem(k, v); }catch(e){} };
    const wheels = () => (s && Array.isArray(s.list) && s.list.length ? s.list : DEFAULTS());
    let curId = lsGet("mw_wheel_cur") || "eat", mode = lsGet("mw_pick_mode") || "wheel";
    if(!MODES.some(m => m.id === mode)) mode = "wheel";
    const M = () => MODES.find(m => m.id === mode);
    const cur = () => wheels().find(w => w.id === curId) || wheels()[0];
    const live = w => { const o = out[w.id]; return w.opts.map((t, i) => ({ t, i })).filter(x => !(o && o.has(x.i))); };
    const save = fn => ctx.update(KEY, st => { st = st && Array.isArray(st.list) ? st : { list: DEFAULTS(), hist: {} }; const r = fn(st); return r === undefined ? st : r; });
    const tick = (f, v) => SFX.tone(f, .03, { vol: v || .22, type: "square", lp: 3200 });
    const wood = () => SFX.tone(260 + Math.random() * 260, .025, { vol: .3, type: "triangle", lp: 1800 });

    // ---------- 轉盤 ----------
    function wheelSvg(L){
      const n = Math.max(1, L.length), a = 360 / n, R = 140, C = 150;
      const pt = (deg, r) => { const t = (deg - 90) * Math.PI / 180; return [C + r * Math.cos(t), C + r * Math.sin(t)]; };
      const fs = n <= 4 ? 22 : n <= 6 ? 19 : n <= 8 ? 17 : n <= 12 ? 14 : 12;
      let g = L.length === 1 ? `<circle cx="${C}" cy="${C}" r="${R}" fill="${WCOL[0]}"/>` : "";
      L.forEach((x, k) => {
        const s0 = k * a, s1 = (k + 1) * a, [x0, y0] = pt(s0, R), [x1, y1] = pt(s1, R), col = WCOL[(n > 1 && k === n - 1 && k % WCOL.length === 0) ? 2 : k % WCOL.length];
        if(L.length > 1) g += `<path d="M${C} ${C} L${x0.toFixed(1)} ${y0.toFixed(1)} A${R} ${R} 0 ${a > 180 ? 1 : 0} 1 ${x1.toFixed(1)} ${y1.toFixed(1)} Z" fill="${col}" stroke="${LINE}" stroke-width="2.5"/>`;
        // 字一個一個直立排，從外圈往中間（中文這樣最好讀）
        const mid = s0 + a / 2, ch = [...x.t], room = R * .78 - 34, wMax = 2 * Math.PI * (R * .62) / n * .8;
        const f = Math.max(9, Math.min(fs + (ch.length <= 2 ? 4 : 0), room / Math.max(1, ch.length) / 1.04, wMax));
        const r0 = R * .86 - f * .55;
        g += `<g transform="rotate(${mid.toFixed(2)} ${C} ${C})">` + ch.map((c, j) => `<text x="${C}" y="${(C - r0 + j * f * 1.04).toFixed(1)}" text-anchor="middle" dominant-baseline="central" font-size="${f.toFixed(1)}" fill="${LINE}">${esc(c)}</text>`).join("") + `</g>`;
      });
      let dots = ""; for(let i = 0; i < 24; i++){ const [dx, dy] = pt(i * 15, R + 4); dots += `<circle cx="${dx.toFixed(1)}" cy="${dy.toFixed(1)}" r="3.2" fill="${i % 2 ? "#ffd36b" : "#fffaf2"}" stroke="${LINE}" stroke-width="1.2"/>`; }
      return `<div class="whPtr" id="whPtr"><svg viewBox="0 0 40 46"><path d="M4 4 L36 4 L20 40 Z" fill="#f08aa0" stroke="${LINE}" stroke-width="4" stroke-linejoin="round"/><circle cx="20" cy="15" r="4.5" fill="#fffaf2"/></svg></div>
        <div class="whBox"><svg viewBox="0 0 300 300" class="whSvg"><circle cx="${C}" cy="${C}" r="${R + 8}" fill="#f08aa0" stroke="${LINE}" stroke-width="3"/><g class="whRot" style="transform:rotate(${rot}deg)">${g}</g>${dots}<circle cx="${C}" cy="${C}" r="30" fill="#fffaf2" stroke="${LINE}" stroke-width="3"/></svg><span class="whCat">${ctx.sprite(ctx.me.cat || "orange", "normal")}</span></div>`;
    }
    function runWheel(L, pick, done){
      const n = L.length, a = 360 / n, target = -(pick + .5) * a + (Math.random() - .5) * a * .7;
      const from = rot, delta = 360 * (5 + ((Math.random() * 2) | 0)) + (((target - from) % 360) + 360) % 360, to = from + delta;
      const dur = 4200 + Math.random() * 900, t0 = performance.now(), rg = el.querySelector(".whRot"), ptr = el.querySelector("#whPtr");
      let lastIdx = -1;
      const step = now => {
        if(!alive) return;
        const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 4); rot = from + delta * e;
        if(rg) rg.style.transform = `rotate(${rot}deg)`;
        const idx = Math.floor(((((-rot) % 360) + 360) % 360) / a);
        if(idx !== lastIdx){ if(lastIdx >= 0){ tick(1250 + (idx % 2) * 160); if(ptr){ ptr.classList.remove("tick"); void ptr.offsetWidth; ptr.classList.add("tick"); } } lastIdx = idx; }
        if(p < 1){ raf = requestAnimationFrame(step); return; }
        rot = ((to % 360) + 360) % 360; done();
      };
      raf = requestAnimationFrame(step);
    }

    // ---------- 抽籤筒 ----------
    function stickSvg(L){
      const m = Math.min(L.length, 9); let st = "";
      for(let i = 0; i < m; i++){ const k = i - (m - 1) / 2, x = 150 + k * 12 - 6, ang = k * 4.5, y = 46 + Math.abs(k) * 5 + (i % 2) * 6;
        st += `<g transform="rotate(${ang} 150 200)"><rect x="${x}" y="${y}" width="12" height="130" rx="2" fill="#f3d9a4" stroke="${LINE}" stroke-width="2"/><rect x="${x}" y="${y}" width="12" height="16" rx="2" fill="#e5486a" stroke="${LINE}" stroke-width="2"/></g>`; }
      return `<svg viewBox="0 0 300 330" class="whSvg">
        <g id="stTube" style="transform-origin:150px 300px">${st}
          <g id="stPop" style="opacity:0"><rect x="128" y="40" width="44" height="170" rx="4" fill="#fbe7bd" stroke="${LINE}" stroke-width="3"/><rect x="128" y="40" width="44" height="22" rx="4" fill="#e5486a" stroke="${LINE}" stroke-width="3"/><g id="stTxt"></g></g>
          <rect x="90" y="150" width="120" height="166" rx="16" fill="#e5486a" stroke="${LINE}" stroke-width="3.5"/>
          <ellipse cx="150" cy="152" rx="60" ry="15" fill="#b83552" stroke="${LINE}" stroke-width="3.5"/>
          <rect x="90" y="176" width="120" height="11" fill="#ffd36b" stroke="${LINE}" stroke-width="2.5"/><rect x="90" y="286" width="120" height="11" fill="#ffd36b" stroke="${LINE}" stroke-width="2.5"/>
          <circle cx="150" cy="236" r="28" fill="#fffaf2" stroke="${LINE}" stroke-width="3"/><text x="150" y="238" text-anchor="middle" dominant-baseline="central" font-size="30" fill="#e5486a">籤</text>
          <rect x="102" y="196" width="10" height="84" rx="5" fill="#ffffff" opacity=".35"/></g></svg>`;
    }
    function runStick(L, pick, done){
      const tube = el.querySelector("#stTube"), pop = el.querySelector("#stPop"), tx = el.querySelector("#stTxt");
      if(tube) tube.animate([{ transform: "rotate(0)" }, { transform: "rotate(-13deg)" }, { transform: "rotate(11deg)" }, { transform: "rotate(-10deg)" }, { transform: "rotate(12deg)" }, { transform: "rotate(-9deg)" }, { transform: "rotate(8deg)" }, { transform: "rotate(-4deg)" }, { transform: "rotate(0)" }], { duration: 1500, easing: "ease-in-out" });
      for(let i = 0; i < 20; i++) later(wood, i * 70 + Math.random() * 30);
      later(() => {
        const ch = [...L[pick].t], f = Math.min(24, 140 / Math.max(1, ch.length));
        if(tx) tx.innerHTML = ch.map((c, j) => `<text x="150" y="${(76 + f * .6 + j * f * 1.05).toFixed(1)}" text-anchor="middle" dominant-baseline="central" font-size="${f.toFixed(1)}" fill="${LINE}">${esc(c)}</text>`).join("");
        SFX.tone(420, .22, { to: 1250, vol: .25, type: "triangle" });
        if(pop) pop.animate([{ transform: "translateY(120px)", opacity: 1 }, { transform: "translateY(-46px)", opacity: 1, offset: .75 }, { transform: "translateY(-34px)", opacity: 1 }], { duration: 700, easing: "ease-out", fill: "forwards" });
        later(done, 1400);
      }, 1550);
    }

    // ---------- 扭蛋機 ----------
    const capsule = (x, y, r, col, rotd, id) => `<g ${id ? `id="${id}"` : ""} transform="translate(${x} ${y}) rotate(${rotd || 0})"><g class="capT"><path d="M${-r} 0 A${r} ${r} 0 0 1 ${r} 0 Z" fill="${col}" stroke="${LINE}" stroke-width="2.5"/><ellipse cx="${-r * .35}" cy="${-r * .45}" rx="${r * .22}" ry="${r * .13}" fill="#fff" opacity=".6"/></g><g class="capB"><path d="M${-r} 0 A${r} ${r} 0 0 0 ${r} 0 Z" fill="#fffaf2" stroke="${LINE}" stroke-width="2.5"/></g></g>`;
    function gachaSvg(L){
      // 扭蛋從下面一層一層往上堆（像真的扭蛋機）
      const m = 16, P = [];
      for(const dy of [62, 30, -2, -34]){ const half = Math.sqrt(84 * 84 - dy * dy) - 20, k = Math.max(1, Math.floor(half * 2 / 36) + 1), sx = -(k - 1) * 18 + (dy % 2 ? 9 : 0);
        for(let j = 0; j < k; j++) P.push([sx + j * 36 + ((j * 7 + dy) % 5) - 2, dy + ((j * 13) % 7) - 3]); }
      let caps = ""; for(let i = 0; i < m && i < P.length; i++){ const [dx, dy] = P[i]; caps += capsule(150 + dx, 112 + dy, 18, CAPC[L[i % L.length].i % CAPC.length], (i * 67) % 360); }
      return `<svg viewBox="0 0 300 340" class="whSvg">
        <rect x="70" y="196" width="160" height="16" rx="6" fill="#d96a84" stroke="${LINE}" stroke-width="3"/>
        <circle cx="150" cy="112" r="96" fill="#e8f6ff" stroke="${LINE}" stroke-width="3.5"/>
        <g id="gaCaps">${caps}</g>
        <path d="M86 70 A76 76 0 0 1 128 40" fill="none" stroke="#ffffff" stroke-width="8" stroke-linecap="round" opacity=".8"/>
        <rect x="62" y="206" width="176" height="118" rx="20" fill="#f08aa0" stroke="${LINE}" stroke-width="3.5"/>
        <rect x="80" y="222" width="70" height="28" rx="6" fill="#fffaf2" stroke="${LINE}" stroke-width="2.5"/><text x="115" y="237" text-anchor="middle" dominant-baseline="central" font-size="15" fill="#e5486a">扭蛋</text>
        <g id="gaKnob" style="transform-origin:115px 288px"><circle cx="115" cy="288" r="24" fill="#fff1b8" stroke="${LINE}" stroke-width="3"/><rect x="97" y="282" width="36" height="12" rx="5" fill="#ffc94d" stroke="${LINE}" stroke-width="2.5"/></g>
        <rect x="172" y="268" width="48" height="40" rx="8" fill="${LINE}"/><rect x="176" y="272" width="40" height="32" rx="6" fill="#3b2720"/>
        <g id="gaOut" style="opacity:0"></g></svg>`;
    }
    function runGacha(L, pick, done){
      const knob = el.querySelector("#gaKnob"), caps = el.querySelector("#gaCaps"), outG = el.querySelector("#gaOut");
      if(knob) knob.animate([{ transform: "rotate(0)" }, { transform: "rotate(360deg)" }], { duration: 1200, easing: "ease-in-out" });
      for(let i = 0; i < 8; i++) later(() => tick(820 + (i % 2) * 120, .26), 80 + i * 140);
      if(caps) caps.animate([{ transform: "translate(0,0)" }, { transform: "translate(-4px,3px)" }, { transform: "translate(4px,-3px)" }, { transform: "translate(-3px,-2px)" }, { transform: "translate(3px,3px)" }, { transform: "translate(0,0)" }], { duration: 300, iterations: 4 });
      later(() => {
        const col = CAPC[L[pick].i % CAPC.length];
        if(outG){ outG.innerHTML = capsule(0, 0, 20, col, 0, "gaCap"); outG.style.opacity = 1;
          outG.animate([{ transform: "translate(196px,276px) scale(.4)" }, { transform: "translate(196px,318px) scale(1)", offset: .5 }, { transform: "translate(196px,304px) scale(1)", offset: .72 }, { transform: "translate(196px,318px) scale(1)" }], { duration: 600, easing: "ease-in", fill: "forwards" }); }
        SFX.tone(200, .12, { to: 110, vol: .35, type: "sine" }); later(() => SFX.tone(170, .08, { to: 110, vol: .22, type: "sine" }), 420);
        later(() => {
          const c = el.querySelector("#gaCap"); if(c){ const t = c.querySelector(".capT"), b = c.querySelector(".capB");
            t.animate([{ transform: "none" }, { transform: "translate(-6px,-16px) rotate(-35deg)" }], { duration: 300, easing: "ease-out", fill: "forwards" });
            b.animate([{ transform: "none" }, { transform: "translate(4px,6px) rotate(14deg)" }], { duration: 300, easing: "ease-out", fill: "forwards" }); }
          SFX.tone(900, .08, { to: 1600, vol: .25, type: "triangle" });
          later(done, 450);
        }, 750);
      }, 1300);
    }

    // ---------- 翻牌 ----------
    function cardHtml(L){
      const n = L.length, cols = n <= 4 ? n : n <= 6 ? 3 : n <= 12 ? 4 : 5;
      return `<div class="pkCards" style="--cols:${cols}">${L.map((x, k) => `<button class="pkCard" data-k="${k}"><span class="in"><span class="bk">${ctx.icon("paw")}</span><span class="fr" style="background:${WCOL[k % WCOL.length]}"></span></span></button>`).join("")}</div>`;
    }
    function shuffleCards(L, done){
      const box = el.querySelector(".pkCards"); if(!box){ done(L.map((_, k) => k)); return; }
      const cs = [...box.children], br = box.getBoundingClientRect(), cx = br.left + br.width / 2, cy = br.top + br.height / 2;
      cs.forEach((c, i) => { const r = c.getBoundingClientRect(), dx = cx - (r.left + r.width / 2), dy = cy - (r.top + r.height / 2), rr = (Math.random() - .5) * 30;
        c.animate([{ transform: "none" }, { transform: `translate(${dx}px,${dy}px) rotate(${rr}deg)`, offset: .35 }, { transform: `translate(${dx * .9}px,${dy * .9}px) rotate(${-rr}deg)`, offset: .6 }, { transform: "none" }], { duration: 1300, delay: i * 18, easing: "ease-in-out" }); });
      for(let i = 0; i < 12; i++) later(() => SFX.tone(1800 + Math.random() * 900, .02, { vol: .12, type: "square", lp: 5000 }), 350 + i * 45);
      // 洗好：每張牌背後是哪個選項（隨機）
      const order = L.map((_, k) => k); for(let i = order.length - 1; i > 0; i--){ const j = (Math.random() * (i + 1)) | 0; [order[i], order[j]] = [order[j], order[i]]; }
      later(() => done(order), 1450);
    }

    // ---------- 畫面 ----------
    function view(){
      deal = null;
      const w = cur(), L = live(w), o = out[w.id], hist = (s && s.hist && s.hist[w.id]) || [], md = M();
      const stage = mode === "wheel" ? `<div class="whStage">${wheelSvg(L)}</div>` : mode === "stick" ? `<div class="whStage tall">${stickSvg(L)}</div>` : mode === "gacha" ? `<div class="whStage tall">${gachaSvg(L)}</div>` : `<div class="whStage cards">${cardHtml(L)}</div>`;
      el.innerHTML = `<div class="wh">
        <div class="whTabs">${wheels().map(x => `<button data-w="${esc(x.id)}" class="${x.id === w.id ? "on" : ""}">${esc(x.name)}</button>`).join("")}${wheels().length < MAX_W ? `<button class="add" id="whNew">＋ 新題目</button>` : ""}</div>
        <div class="pkModes">${MODES.map(m => `<button data-m="${m.id}" class="${m.id === mode ? "on" : ""}"><i>${m.ic}</i>${m.n}</button>`).join("")}</div>
        ${stage}
        ${L.length < 2 ? `<div class="whTip">選項少於 2 個，先按「編輯選項」加一些吧</div>` : mode === "card" ? `<div class="whTip soft" id="pkHint">先洗牌，再挑一張翻開</div>` : ""}
        <button class="btn whGo" id="whGo" ${L.length < 2 ? "disabled" : ""}>${md.go}</button>
        <div class="whRow"><button class="btn sub" id="whEdit">編輯選項</button>${o && o.size ? `<button class="btn sub" id="whBack">放回 ${o.size} 個</button>` : ""}</div>
        ${hist.length ? `<div class="whHist"><span>最近</span>${hist.slice(0, 6).map(h => `<b>${esc(h)}</b>`).join("")}</div>` : ""}
      </div>`;
      el.querySelectorAll("[data-w]").forEach(b => b.addEventListener("click", () => { if(busy) return; SFX.tap(); curId = b.dataset.w; lsSet("mw_wheel_cur", curId); rot = 0; view(); }));
      el.querySelectorAll("[data-m]").forEach(b => b.addEventListener("click", () => { if(busy) return; SFX.tap(); mode = b.dataset.m; lsSet("mw_pick_mode", mode); view(); }));
      const nw = el.querySelector("#whNew"); if(nw) nw.addEventListener("click", () => { if(busy) return; SFX.tap(); edit(null); });
      el.querySelector("#whGo").addEventListener("click", go);
      el.querySelector("#whEdit").addEventListener("click", () => { if(busy) return; SFX.tap(); edit(cur()); });
      const bk = el.querySelector("#whBack"); if(bk) bk.addEventListener("click", () => { if(busy) return; SFX.tap(); delete out[w.id]; rot = 0; view(); });
      el.querySelectorAll(".pkCard").forEach(c => c.addEventListener("click", () => flip(c)));
      const tb = el.querySelector(".whTabs .on"); if(tb) tb.scrollIntoView({ block: "nearest", inline: "center" });
    }

    function go(){
      const w = cur(), L = live(w); if(busy || L.length < 2) return;
      busy = true; SFX.tap();
      const btn = el.querySelector("#whGo"); btn.disabled = true; btn.textContent = M().busy;
      el.querySelectorAll(".whTabs button,.pkModes button,#whEdit,#whBack").forEach(b => b.disabled = true);
      const pick = (Math.random() * L.length) | 0, fin = () => { busy = false; result(w, L[pick]); };
      if(mode === "wheel") runWheel(L, pick, fin);
      else if(mode === "stick") runStick(L, pick, fin);
      else if(mode === "gacha") runGacha(L, pick, fin);
      else shuffleCards(L, order => { busy = false; deal = order; btn.textContent = "點一張牌！"; const h = el.querySelector("#pkHint"); if(h) h.textContent = "挑一張喜歡的牌，點它翻開";
        el.querySelectorAll(".pkCard").forEach(c => c.classList.add("ready")); });
    }
    function flip(c){
      if(busy || !deal || c.classList.contains("open")) return;
      const w = cur(), L = live(w), order = deal, x = L[order[+c.dataset.k]]; if(!x) return;
      busy = true; deal = null; SFX.tone(700, .1, { to: 1300, vol: .22, type: "triangle" });
      c.querySelector(".fr").innerHTML = `<b>${esc(x.t)}</b>`; c.classList.add("open", "pick");
      // 其他牌也慢慢翻開給你看
      later(() => { el.querySelectorAll(".pkCard:not(.open)").forEach((o, i) => { const y = L[order[+o.dataset.k]]; if(!y) return; o.querySelector(".fr").innerHTML = `<b>${esc(y.t)}</b>`; later(() => o.classList.add("open", "dim"), i * 60); }); }, 650);
      later(() => { busy = false; result(w, x); }, 1300);
    }

    function result(w, x){
      SFX.match(); ctx.burst();
      save(st => { st.hist = st.hist && typeof st.hist === "object" ? st.hist : {}; st.hist[w.id] = [x.t].concat(st.hist[w.id] || []).slice(0, 8);
        if(!st.list.some(y => y.id === w.id)) st.list.push(w); return st; });
      const p = ctx.partner(), more = live(w).length > 2, md = M();
      const o = document.createElement("div"); o.className = "whRes";
      o.innerHTML = `<div class="whCard"><div class="whResCat">${ctx.sprite(ctx.me.cat || "orange", "love")}</div><div class="whQ">${esc(w.name)}・${md.got}</div><div class="whAns">${esc(x.t)}</div>
        <div class="whBtns"><button class="btn" data-a="again">${md.again}</button>${more ? `<button class="btn sub" data-a="drop">拿掉這個再來</button>` : ""}</div>
        <div class="whBtns">${p ? `<button class="btn mint" data-a="send">傳給 ${esc(p.name)}</button>` : ""}<button class="btn sub" data-a="ok">就決定是你了！</button></div></div>`;
      el.appendChild(o);
      o.querySelector(".whCard").animate([{ transform: "scale(.6)", opacity: 0 }, { transform: "scale(1.06)", opacity: 1, offset: .7 }, { transform: "none" }], { duration: 320, easing: "ease-out" });
      const close = () => { o.remove(); view(); };
      o.querySelectorAll("[data-a]").forEach(b => b.addEventListener("click", async () => {
        const k = b.dataset.a; SFX.tap();
        if(k === "again"){ close(); later(go, 120); }
        else if(k === "drop"){ (out[w.id] = out[w.id] || new Set()).add(x.i); rot = 0; close(); later(go, 300); }
        else if(k === "send"){ b.disabled = true; b.textContent = "傳送中…"; const ok = ctx.say ? await ctx.say(`【幫我選】${w.name}・${md.got}：${x.t}！`) : false; b.textContent = ok ? "傳好了" : "沒傳成功"; if(ok) ctx.toast("傳到聊天室了"); }
        else close();
      }));
    }

    // ---------- 編輯 ----------
    function edit(w){
      const isNew = !w, d = w ? { id: w.id, name: w.name, opts: w.opts.slice() } : { id: uid(), name: "", opts: ["", ""] };
      const o = document.createElement("div"); o.className = "whRes whEd";
      const paint = () => {
        o.innerHTML = `<div class="whCard"><h3>${isNew ? "新的題目" : "編輯題目"}</h3>
          <label class="whLbl">題目<input class="whName" maxlength="12" placeholder="例如：今天吃什麼" value="${esc(d.name)}"></label>
          <div class="whLbl">選項（最多 ${MAX_OPT} 個）</div>
          <div class="whOpts">${d.opts.map((t, i) => `<div class="whOpt"><i style="background:${WCOL[i % WCOL.length]}"></i><input data-i="${i}" maxlength="${OPT_LEN}" placeholder="選項 ${i + 1}" value="${esc(t)}"><button data-x="${i}" aria-label="刪掉">✕</button></div>`).join("")}</div>
          ${d.opts.length < MAX_OPT ? `<button class="btn sub whAdd" id="whAdd">＋ 加一個選項</button>` : ""}
          <div class="whBtns">${!isNew && wheels().length > 1 ? `<button class="btn sub whDel" id="whDel">刪除題目</button>` : ""}<button class="btn sub" id="whCancel">取消</button><button class="btn" id="whOk">完成</button></div></div>`;
        o.querySelector(".whName").addEventListener("input", e => { d.name = e.target.value; });
        o.querySelectorAll(".whOpt input").forEach(inp => inp.addEventListener("input", () => { d.opts[+inp.dataset.i] = inp.value; }));
        o.querySelectorAll("[data-x]").forEach(b => b.addEventListener("click", () => { SFX.tap(); d.opts.splice(+b.dataset.x, 1); paint(); }));
        const ad = o.querySelector("#whAdd"); if(ad) ad.addEventListener("click", () => { SFX.tap(); d.opts.push(""); paint(); const ins = o.querySelectorAll(".whOpt input"); const last = ins[ins.length - 1]; if(last){ last.focus(); last.scrollIntoView({ block: "center" }); } });
        o.querySelector("#whCancel").addEventListener("click", () => { SFX.tap(); o.remove(); });
        const dl = o.querySelector("#whDel"); if(dl) dl.addEventListener("click", async () => { if(dl.dataset.sure !== "1"){ dl.dataset.sure = "1"; dl.textContent = "真的要刪？再按一次"; return; }
          SFX.tap(); await save(st => { st.list = st.list.filter(x => x.id !== d.id); if(!st.list.length) st.list = DEFAULTS(); return st; }); curId = wheels()[0].id; lsSet("mw_wheel_cur", curId); o.remove(); view(); });
        o.querySelector("#whOk").addEventListener("click", async () => {
          const opts = d.opts.map(t => String(t || "").trim().slice(0, OPT_LEN)).filter(Boolean);
          const name = String(d.name || "").trim().slice(0, 12) || "我的題目";
          if(opts.length < 2){ ctx.toast("至少要寫 2 個選項喔"); return; }
          SFX.select();
          const r = await save(st => { const k = st.list.findIndex(x => x.id === d.id); const nw = { id: d.id, name, opts }; if(k >= 0) st.list[k] = nw; else st.list.push(nw); return st; });
          if(r === null) return;
          delete out[d.id]; curId = d.id; lsSet("mw_wheel_cur", curId); rot = 0; o.remove(); view(); });
      };
      paint(); el.appendChild(o);
      o.querySelector(".whCard").animate([{ transform: "translateY(30px)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 200, easing: "ease-out" });
    }

    view();
    ctx.getState(KEY).then(r => { if(!alive) return; s = r ? r.state : null; if(!busy && !deal && !el.querySelector(".whRes")) view(); });
    const off = ctx.onState(KEY, st => { s = st; if(!busy && !deal && !el.querySelector(".whRes")) view(); });
    this._un = () => { alive = false; cancelAnimationFrame(raf); timers.forEach(clearTimeout); timers.clear(); if(off) off(); };
  },
  unmount(){ if(this._un) this._un(); },
});
})();

// 遊戲：喵喵夾娃娃機
// 按住 ◀ ▶ 移動爪子，按「夾！」夾娃娃。夾起來的娃娃可能會在半路滑掉 😹
// 每天 10 次免費，之後 1 次 1 個貓幣。連續沒夾到 8 次，下一次一定夾得到（幸運值）。
// 夾到的娃娃收進「收藏」，有重複的可以送給 ta。
(function(){
const O = "#5a3b2e";
const PX = (rows, pal) => { pal = Object.assign({ O }, pal); const w = Math.max(...rows.map(r => r.length)), h = rows.length; let r = "";
  rows.forEach((row, y) => [...row].forEach((c, x) => { if(pal[c]) r += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${pal[c]}"/>`; }));
  return `<svg viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg">${r}</svg>`; };
const CLAW_OPEN = PX(["....OOOOO....","....OGGGO....","..OOOGGGOOO..",".OGGGHGGGGGO.","OGO.......OGO","OGO.......OGO","OGO.......OGO",".OGO.....OGO.","..OO.....OO.."], { O: "#5b6b8c", G: "#c9d3e3", H: "#ffffff" });
const CLAW_SHUT = PX(["....OOOOO....","....OGGGO....","..OOOGGGOOO..",".OGGGHGGGGGO.","..OGO...OGO..","...OGO.OGO...","....OGOGO....",".....OOO....."], { O: "#5b6b8c", G: "#c9d3e3", H: "#ffffff" });
const MOUSE = PX([".OOO.......OOO.","OGPGO.....OGPGO","OGPGOOOOOOOGPGO",".OGGGGGGGGGGGO.","..OGEHGGGEHGO..","..OGEEGGGEEGO..","WW.OGGGNGGGO.WW","..WWOGGGGGOWW..","....OOGGGOO....","......OOO......"], { G: "#b8bfd2", P: "#f7a7b8", N: "#f0708d", E: "#2b1d18", H: "#fff", W: "#fff" });
const CROWN = PX(["O...O...O","OYO.OYO.OYO".slice(0, 9),"OYYOYYOYO","OYYYRYYYO","OOOOOOOOO"], { Y: "#f6c45f", R: "#e5484d" });
const HALO = PX(["..OOOOO..",".OY...YO.","..OOOOO.."], { Y: "#fff07a", O: "#e8a400" });

// 娃娃：[名字, 稀有度 0 普通 1 稀有 2 超稀有, 畫法, 特效 class]
const PRIZES = [
  ["橘貓娃娃", 0, () => Pix.sprite("orange", "happy")],
  ["白貓娃娃", 0, () => Pix.sprite("white", "normal")],
  ["灰貓娃娃", 0, () => Pix.sprite("gray", "happy")],
  ["吐司貓", 0, () => Pix.sprite("orange", "loaf")],
  ["小魚抱枕", 0, () => Pix.icon("fish")],
  ["愛心抱枕", 0, () => Pix.icon("heart")],
  ["貓掌抱枕", 0, () => Pix.icon("paw")],
  ["老鼠玩偶", 0, () => MOUSE],
  ["黑貓娃娃", 1, () => Pix.sprite("black", "love")],
  ["三花貓娃娃", 1, () => Pix.sprite("calico", "happy")],
  ["捲捲貓", 1, () => Pix.sprite("gray", "curl")],
  ["星星抱枕", 1, () => Pix.icon("star")],
  ["粉紅小魚", 1, () => Pix.icon("fish", { B: "#f7a7b8" })],
  ["金色招財貓", 2, () => Pix.sprite("orange", "wave"), "gold"],
  ["彩虹貓", 2, () => Pix.sprite("white", "happy"), "rainbow"],
  ["皇冠貓", 2, () => `<span class="cwCrown">${CROWN}</span>${Pix.sprite("calico", "love")}`],
  ["天使貓", 2, () => `<span class="cwHalo">${HALO}</span>${Pix.sprite("white", "sleep")}`],
];
const RAR = [["普通", "#9aa3bd"], ["稀有", "#5e9de6"], ["超稀有", "#e8a400"]];
const FREE = 10, PITY = 8;
const today = () => new Date().toDateString();
const pick = () => { const r = Math.random(), tier = r < .07 ? 2 : r < .32 ? 1 : 0; const L = PRIZES.map((p, i) => [p, i]).filter(([p]) => p[1] === tier); return L[(Math.random()*L.length)|0][1]; };
const art = i => `<span class="cwArt ${PRIZES[i][3] || ""}">${PRIZES[i][2]()}</span>`;

App.registerGame({
  id: "claw",
  solo: true,
  wip: true,   // 站長測試中：一般使用者先看不到
  name: "喵喵夾娃娃機",
  desc: "夾娃娃收集貓咪玩偶，還能送給 ta",
  icon: () => Pix.sprite("orange", "wave"),
  mount(el, ctx){
    const { esc, SFX } = ctx, K = window.MiniKit;
    let s = null, alive = true, raf = 0, busy = false;
    const me = () => ctx.me.uid, partner = () => ctx.partner();
    const myCol = () => ((s && s.col) || {})[me()] || {};
    const triesLeft = () => { const t = ((s && s.tries) || {})[me()]; return t && t.day === today() ? Math.max(0, FREE - t.n) : FREE; };
    const luck = () => ((s && s.luck) || {})[me()] || 0;
    const owned = c => Object.keys(c).filter(k => c[k] > 0).length;

    document.body.classList.add("cwOn");
    el.innerHTML = `<div class="box cw">
      <div class="cwTop"><div class="cwInfo" id="cwInfo"></div><button class="btn sub cwColBtn" id="cwCol">🎁 收藏</button></div>
      <div class="cwM"><div class="cwMarq"><span class="cwLights"></span><b>喵喵夾娃娃機</b><span class="cwLights"></span></div>
        <div class="cwGlass" id="cwGlass"><div class="cwRail"></div><div class="cwChute"><span>出口</span></div><div class="cwShine"></div>
          <div class="cwClaw" id="cwClaw"><div class="cwRope"></div><div class="cwHead" id="cwHead">${CLAW_OPEN}</div></div></div>
        <div class="cwMsg" id="cwMsg">按住 ◀ ▶ 移動爪子，對準了按「夾！」</div>
        <div class="cwPanel"><button class="cwBtn" id="cwL">◀</button><button class="cwGo" id="cwGo">夾！</button><button class="cwBtn" id="cwR">▶</button></div></div></div>`;
    const G = el.querySelector("#cwGlass"), clawEl = el.querySelector("#cwClaw"), head = el.querySelector("#cwHead"), rope = clawEl.querySelector(".cwRope"), msgEl = el.querySelector("#cwMsg");
    const msg = (h, cls) => { msgEl.innerHTML = h; msgEl.className = "cwMsg " + (cls || ""); };
    let GW = 300, GH = 330, PW = 54, chuteW = 66, floor = 8;
    let prizes = [], nid = 0;
    const claw = { x: 0, len: 0, open: true, carry: null, sway: 0 };
    let move = 0;   // -1 / 0 / 1

    function sizes(){ GW = G.clientWidth; GH = G.clientHeight; PW = Math.round(GW*.19); chuteW = Math.round(GW*.22); }
    // 娃娃堆：下排一排格子，上排每格靠下面兩隻撐著
    let rows = [];   // rows[0] 最下排；rows[i][k] 靠 rows[i-1][k] 和 rows[i-1][k+1] 撐著
    function layout(){ const n = Math.max(3, Math.floor((maxX() - minX())/(PW*.92)) + 1), step = (maxX() - minX())/(n - 1);
      rows = [0, 1, 2].map(i => Array.from({ length: n - i }, (_, k) => ({ i, k, x: minX() + (k + i/2)*step, y: i*PW*.5, p: null }))); }
    function mk(kind){ const p = { id: ++nid, kind, x: 0, y: GH, w: PW, r: (Math.random() - .5)*20, vy: 0, slot: null, el: document.createElement("div") };
      p.el.className = "cwP"; p.el.innerHTML = art(kind); p.el.style.width = PW + "px"; G.insertBefore(p.el, clawEl); prizes.push(p); return p; }
    const place = p => { p.el.style.transform = `translate(${p.x - p.w/2}px, ${GH - floor - p.y - p.w}px) rotate(${p.r}deg)`; p.el.style.zIndex = 10 + Math.round(p.y); };
    const minX = () => chuteW + PW*.6, maxX = () => GW - PW*.6;
    const supported = sl => sl.i === 0 || (rows[sl.i - 1][sl.k].p && rows[sl.i - 1][sl.k + 1].p);
    function seat(p, sl){ if(p.slot) p.slot.p = null; sl.p = p; p.slot = sl; p.drop = true; }
    function freeSlotNear(x){ for(const R of rows){ const L = R.filter(sl => !sl.p && supported(sl)); if(L.length) return L.reduce((b, sl) => Math.abs(sl.x - x) < Math.abs(b.x - x) ? sl : b); } return null; }
    function unseat(p){ if(p.slot){ p.slot.p = null; p.slot = null; }
      // 上面沒人撐的娃娃往下掉到空位
      for(let pass = 0; pass < 3; pass++) rows.slice(1).forEach(R => R.forEach(sl => { if(sl.p && !supported(sl)){ const q = sl.p; sl.p = null; q.slot = null; const t = freeSlotNear(sl.x); if(t) seat(q, t); } })); }
    function fill(){
      const want = rows.reduce((a, R) => a + R.length, 0) - 3;
      while(prizes.length < want){ const sl = freeSlotNear(minX() + Math.random()*(maxX() - minX())); if(!sl) break; const p = mk(pick()); p.x = sl.x; p.y = GH*.85; seat(p, sl); }
    }
    function startPile(){ prizes.forEach(p => p.el.remove()); prizes = []; layout();
      rows.forEach((R, i) => R.forEach((sl, k) => { if(i === 2 && k % 2 === 1) return; const p = mk(pick()); p.x = sl.x; p.y = sl.y; seat(p, sl); p.drop = false; place(p); })); }
    // 娃娃掉到自己的位置
    function settle(dt){ prizes.forEach(p => { if(p === claw.carry || !p.drop || !p.slot) return;
      p.x += (p.slot.x - p.x)*Math.min(1, dt*8); p.vy -= 900*dt; p.y += p.vy*dt;
      if(p.y <= p.slot.y){ p.y = p.slot.y; if(p.vy < -150) SFX.key(.6); p.vy = 0; if(Math.abs(p.x - p.slot.x) < 1){ p.x = p.slot.x; p.drop = false; } }
      place(p); }); }

    // 爪子正下方最上面的娃娃（有的話）
    const topPrize = x => { let best = null; prizes.forEach(p => { if(p.slot && p !== claw.carry && Math.abs(p.slot.x - x) < p.w*.55 && (!best || p.slot.y > best.slot.y)) best = p; }); return best; };
    const topAt = x => { const p = topPrize(x); return p ? p.slot.y + p.w*.62 : 0; };

    function info(){
      const tl = triesLeft(), l = luck(), c = myCol();
      el.querySelector("#cwInfo").innerHTML = `<div>今天免費 <b>${tl}</b> / ${FREE} 次</div><div class="cwLuck" title="幸運值">幸運值 <i>${Array.from({ length: PITY }, (_, i) => `<span class="${i < l ? "on" : ""}"></span>`).join("")}</i></div>`;
      el.querySelector("#cwCol").textContent = `🎁 收藏 ${owned(c)}/${PRIZES.length}`;
      const go = el.querySelector("#cwGo"); go.textContent = tl > 0 ? "夾！" : "1🪙 夾！"; go.classList.toggle("paid", tl <= 0);
    }
    // 開始一次：先扣次數（免費或貓幣）
    async function pay(){
      if(triesLeft() > 0){ let ok = false; await ctx.update("claw", st => { st = st || {}; st.tries = st.tries || {}; const t = st.tries[me()];
          const cur = t && t.day === today() ? t : { day: today(), n: 0 }; if(cur.n >= FREE) return undefined; cur.n++; st.tries[me()] = cur; ok = true; return st; }); return ok; }
      let ok = false;
      await ctx.update("pet", st => { if(!st || !(st.coins >= 1)) return undefined; st = JSON.parse(JSON.stringify(st)); st.coins -= 1; ok = true; return st; });
      if(!ok) ctx.toast("今天的免費次數用完了，貓幣也不夠～<br>明天再來，或玩其他遊戲賺貓幣吧 🪙", 4000);
      return ok;
    }
    async function grab(){
      if(busy) return; busy = true; move = 0;
      if(!(await pay())){ busy = false; return; }
      SFX.tap(); msg("爪子下去囉…");
      const lucky = luck() >= PITY;
      // 1. 往下
      const stopAt = Math.max(10, GH - floor - topAt(claw.x) - 14 - head.offsetHeight*.6);
      await anim(t => { claw.len = Math.min(stopAt, claw.len + 260*t); return claw.len >= stopAt; });
      // 2. 夾起來
      claw.open = false; head.innerHTML = CLAW_SHUT; SFX.key(1.2); await K.wait(350);
      const target = topPrize(claw.x); let held = false;
      if(target){ const align = 1 - Math.abs(target.slot.x - claw.x)/(target.w*.55); held = lucky || Math.random() < .22 + .55*align; }
      if(held){ claw.carry = target; unseat(target); target.r = (Math.random() - .5)*16; SFX.select(); }
      else if(target){ target.r = (Math.random() - .5)*30; place(target); }
      // 3. 往上
      await anim(t => { claw.len = Math.max(0, claw.len - 200*t); return claw.len <= 0; });
      // 4. 移到出口（中途可能會滑掉）
      const rar = held ? PRIZES[claw.carry.kind][1] : 0;
      const slip = held && !lucky && Math.random() < [.28, .45, .62][rar];
      const slipAt = .25 + Math.random()*.5, from = claw.x, to = chuteW/2;
      let slipped = false;
      await anim(t => { claw.x = Math.max(to, claw.x - 150*t);
        if(slip && !slipped && (from - claw.x)/(from - to) > slipAt){ slipped = true; const p = claw.carry; claw.carry = null; p.vy = 0; const sl = freeSlotNear(Math.max(minX(), p.x)); if(sl) seat(p, sl); else { p.el.remove(); prizes = prizes.filter(x => x !== p); } SFX.miss(); msg("啊！<b>滑掉了</b>…差一點點 😿", "bad"); }
        return claw.x <= to; });
      // 5. 放開
      claw.open = true; head.innerHTML = CLAW_OPEN;
      if(claw.carry){ const p = claw.carry; claw.carry = null; p.el.classList.add("cwWin"); await K.wait(450); p.el.remove(); prizes = prizes.filter(x => x !== p); await win(p.kind); }
      else { if(!slipped) { msg(target ? "爪子沒抓穩，<b>沒夾到</b>～" : "什麼都沒夾到～再對準一點！", "bad"); SFX.miss(); }
        await ctx.update("claw", st => { st = st || {}; st.luck = st.luck || {}; st.luck[me()] = Math.min(PITY, (st.luck[me()] || 0) + 1); return st; }); }
      await K.wait(300);
      await anim(t => { claw.x = Math.min(GW/2, claw.x + 220*t); return claw.x >= GW/2; });
      fill(); busy = false; info();
      if(triesLeft() <= 0 && !msgEl.classList.contains("good")) msg("今天的免費次數用完了，可以用 1 個貓幣再夾一次 🪙");
    }
    async function win(kind){
      const P = PRIZES[kind], wasNew = !(myCol()[kind] > 0);
      await ctx.update("claw", st => { st = st || {}; st.col = st.col || {}; const c = st.col[me()] = st.col[me()] || {}; c[kind] = (c[kind] || 0) + 1; st.luck = st.luck || {}; st.luck[me()] = 0;
        st.last = { by: me(), kind, at: Date.now() }; return st; });
      SFX.level(); ctx.burst(); if(P[1] >= 1) SFX.combo();
      msg(`🎉 夾到了 <b>${esc(P[0])}</b>！`, "good");
      if(P[1] === 2 && partner()) ctx.notifyPartner(`${ctx.me.name} 在夾娃娃機夾到超稀有的「${P[0]}」！✨`);
      const o = document.createElement("div"); o.className = "careModal cwReveal";
      o.innerHTML = `<div class="cmBox"><div class="cwRay r${P[1]}"></div><div class="cwBig">${art(kind)}</div>${wasNew ? `<div class="cwNew">NEW!</div>` : ""}
        <h3>${esc(P[0])}</h3><div class="cwRar" style="background:${RAR[P[1]][1]}">${"★".repeat(P[1] + 1)} ${RAR[P[1]][0]}</div>
        <div class="k">${wasNew ? "第一次夾到！已經收進收藏 🎁" : `收藏裡有 ${(myCol()[kind] || 1)} 個了`}</div><button class="btn" style="width:100%">好耶！</button></div>`;
      document.body.appendChild(o); o.querySelector("button").addEventListener("click", () => o.remove());
    }
    // 動畫小幫手：每一格跑 step(dt)，回傳 true 就結束
    const anim = step => new Promise(res => { let last = performance.now(); const f = now => { if(!alive) return res(); const dt = Math.min(.05, (now - last)/1000); last = now; if(step(dt)) res(); else requestAnimationFrame(f); }; requestAnimationFrame(f); });

    function openCol(){
      SFX.tap(); const c = myCol(), p = partner(), pc = p ? (((s && s.col) || {})[p.user_id] || {}) : null;
      const o = document.createElement("div"); o.className = "careModal cwColM";
      o.innerHTML = `<div class="cmBox"><h3>🎁 我的收藏 ${owned(c)}/${PRIZES.length}</h3>${p ? `<div class="k" style="text-align:center">${esc(p.name)} 收集了 ${owned(pc)}/${PRIZES.length}</div>` : ""}
        <div class="cwGrid">${PRIZES.map((P, i) => c[i] > 0 ? `<button class="cwSlot r${P[1]}" data-i="${i}">${art(i)}<b>${esc(P[0])}</b>${c[i] > 1 ? `<i>×${c[i]}</i>` : ""}</button>`
          : `<div class="cwSlot r${P[1]} no"><span class="cwArt">${P[2]()}</span><b>？？？</b></div>`).join("")}</div>
        <div class="k" style="text-align:center;margin:6px 0">${p ? "有重複的娃娃，點一下可以送 1 個給 ta 🎁" : "超稀有的娃娃很難夾，加油！"}</div><button class="btn sub" style="width:100%" id="cwX">關閉</button></div>`;
      document.body.appendChild(o);
      o.querySelector("#cwX").addEventListener("click", () => o.remove());
      o.querySelectorAll(".cwSlot[data-i]").forEach(b => b.addEventListener("click", async () => {
        const i = +b.dataset.i; if(!p){ return; } if(!(myCol()[i] > 1)){ ctx.toast("只有 1 個的捨不得送啦～有重複的才能送喔"); return; }
        if(!b.dataset.ok){ o.querySelectorAll(".cwSlot").forEach(x => { delete x.dataset.ok; x.classList.remove("ask"); }); b.dataset.ok = 1; b.classList.add("ask"); ctx.toast(`再點一次，把 1 個「${PRIZES[i][0]}」送給 ${esc(p.name)}`); return; }
        let ok = false;
        await ctx.update("claw", st => { const c2 = st && st.col && st.col[me()]; if(!c2 || !(c2[i] > 1)) return undefined; c2[i]--; const pc2 = st.col[p.user_id] = st.col[p.user_id] || {}; pc2[i] = (pc2[i] || 0) + 1; ok = true; return st; });
        if(ok){ SFX.select(); ctx.burst(); ctx.toast(`送出了 🎁 ${esc(p.name)} 收到 1 個「${PRIZES[i][0]}」`); ctx.notifyPartner(`${ctx.me.name} 送你 1 個「${PRIZES[i][0]}」娃娃 🎁 快去夾娃娃機的收藏看看！`); o.remove(); openCol(); }
      }));
    }

    // 控制：按住 ◀ ▶ 移動（只看手指放開，安卓長按不會中斷）
    const hold = (btn, dir) => {
      const up = () => { if(move === dir) move = 0; btn.classList.remove("on"); ["pointerup","touchend","mouseup"].forEach(t => window.removeEventListener(t, up)); };
      const down = e => { if(e.cancelable) e.preventDefault(); if(busy) return; move = dir; btn.classList.add("on"); ["pointerup","touchend","mouseup"].forEach(t => window.addEventListener(t, up)); };
      btn.addEventListener("pointerdown", down); btn.addEventListener("touchstart", down, { passive: false }); btn.addEventListener("contextmenu", e => e.preventDefault()); };
    hold(el.querySelector("#cwL"), -1); hold(el.querySelector("#cwR"), 1);
    el.querySelector("#cwGo").addEventListener("click", grab);
    el.querySelector("#cwCol").addEventListener("click", openCol);

    let last = performance.now(), t0 = last;
    const loop = now => {
      if(!alive) return; const dt = Math.min(.05, (now - last)/1000); last = now;
      if(!busy && move){ claw.x = Math.max(chuteW*.5 + 10, Math.min(GW - 22, claw.x + move*170*dt)); }
      claw.sway = Math.sin((now - t0)/260) * (claw.carry ? 5 : busy ? 2 : 1);
      clawEl.style.transform = `translateX(${claw.x}px)`; rope.style.height = (14 + claw.len) + "px";
      head.style.transform = `translate(-50%, 0) rotate(${claw.sway}deg)`;
      if(claw.carry){ const p = claw.carry; p.x = claw.x; p.y = GH - floor - (14 + claw.len + head.offsetHeight*.75) - p.w; place(p); }
      settle(dt);
      raf = requestAnimationFrame(loop);
    };
    requestAnimationFrame(() => { sizes(); claw.x = GW/2; startPile(); info(); raf = requestAnimationFrame(loop); });
    this._u = ctx.onState("claw", st => { s = st; if(alive) info(); });
    this._stop = () => { alive = false; document.body.classList.remove("cwOn"); cancelAnimationFrame(raf); document.querySelectorAll(".cwReveal,.cwColM").forEach(x => x.remove()); };
    (async () => { const cur = await ctx.getState("claw").catch(() => null); s = cur ? cur.state : null; if(alive) info(); })();
  },
  unmount(){ if(this._u) this._u(); if(this._stop) this._stop(); },
});
if(window.GameArt) window.GameArt.claw = () => `<span class="gaL" style="left:30%;top:0;width:40%">${CLAW_SHUT}</span><span class="gaL" style="left:6%;bottom:0;width:40%">${Pix.sprite("orange","happy")}</span><span class="gaL" style="right:6%;bottom:0;width:38%">${Pix.sprite("calico","love")}</span>`;
})();

// 遊戲：喵喵消消樂
// 交換相鄰的兩格，三個一樣的連成一線就消掉。連鎖越多分數越高，一次消 4 個以上多 2 秒。60 秒比分數。
(function(){
const N = 7, TIME = 60;
const KINDS = [
  () => Pix.sprite("orange","happy"), () => Pix.sprite("black","happy"), () => Pix.sprite("white","love"),
  () => Pix.icon("fish"), () => Pix.icon("heart"),
];
const rnd = n => (Math.random()*n)|0;

if(window.GameArt) window.GameArt.match3 = () => `<span class="gaL" style="left:2%;top:2%;width:34%">${Pix.sprite("orange","happy")}</span><span class="gaL" style="left:34%;top:2%;width:34%">${Pix.sprite("orange","happy")}</span><span class="gaL" style="left:66%;top:2%;width:34%">${Pix.sprite("orange","happy")}</span><span class="gaL" style="left:10%;bottom:4%;width:26%">${Pix.icon("fish")}</span><span class="gaL" style="left:40%;bottom:0;width:30%">${Pix.sprite("black","happy")}</span><span class="gaL" style="right:4%;bottom:6%;width:24%">${Pix.icon("heart")}</span>`;

App.registerGame({
  id: "match3",
  solo: true,
  name: "喵喵消消樂",
  desc: "三個連成一線就消掉，60 秒比分數",
  icon: () => Pix.sprite("black","happy"),
  mount(el, ctx){
    const { esc, SFX } = ctx, K = window.MiniKit;
    let s = null, alive = true, playing = false, timer = 0;
    const lobby = () => {
      if(playing) return;
      el.innerHTML = `<div class="box skLobby m3Lobby">
        <div class="m3Hero">${[0,3,1,4,2].map(i=>`<i>${KINDS[i]()}</i>`).join("")}</div>
        <p class="skIntro">把相鄰的兩格<b>換位置</b>（滑一下或先後點兩格），<br><b>三個一樣</b>的連成一線就消掉 🐾<br>連鎖越多分數越高，一次消 <b>4 個以上多 2 秒</b>！</p>
        ${K.bestRows(ctx, s, v => `${v} 分`)}
        <button class="btn" id="m3Go">🐱 開始！（${TIME} 秒）</button>
        <div class="k" style="text-align:center">每 400 分得 1 個貓幣 🪙</div></div>`;
      el.querySelector("#m3Go").addEventListener("click", start);
    };
    function start(){
      SFX.tap(); playing = true;
      let grid = [], els = {}, nid = 0, cs = 40, score = 0, left = TIME, busy = false, sel = null, ended = false;
      el.innerHTML = `<div class="box m3"><div class="m3Hud"><div><span>分數</span><b id="m3Sc">0</b></div><div class="m3T"><span>時間</span><b id="m3Tm">${TIME}</b></div></div>
        <div class="m3Bar"><i id="m3Bar"></i></div><div class="m3B" id="m3B"></div><div class="k" style="text-align:center;margin-top:6px">滑一下換位置，或先點一格再點旁邊那格</div></div>`;
      const B = el.querySelector("#m3B");
      const at = (x, y) => grid[y] && grid[y][x];
      const place = (p, x, y) => { p.x = x; p.y = y; p.el.style.transform = `translate(${x*cs}px,${y*cs}px)`; };
      const mk = (t, x, y, fromY) => { const p = { id: ++nid, t }; p.el = document.createElement("div"); p.el.className = "m3P"; p.el.innerHTML = KINDS[t]();
        p.el.style.width = p.el.style.height = cs + "px"; B.appendChild(p.el); els[p.id] = p; place(p, x, fromY == null ? y : fromY); return p; };
      // 開局：不能一開始就有連線，也要有步可以走
      function fresh(){
        B.innerHTML = ""; els = {}; grid = [];
        do{ grid = []; for(let y=0;y<N;y++){ grid.push([]); for(let x=0;x<N;x++){ let t; do{ t = rnd(KINDS.length); }
          while((x>=2 && grid[y][x-1].t===t && grid[y][x-2].t===t) || (y>=2 && grid[y-1][x].t===t && grid[y-2][x].t===t)); grid[y].push({ t }); } } }
        while(!hasMove());
        for(let y=0;y<N;y++) for(let x=0;x<N;x++) grid[y][x] = mk(grid[y][x].t, x, y);
      }
      function matches(){
        const hit = new Set(), runs = [];
        for(let y=0;y<N;y++) for(let x=0;x<N;){ let e = x; while(e+1<N && grid[y][e+1].t===grid[y][x].t) e++; if(e-x>=2){ runs.push(e-x+1); for(let i=x;i<=e;i++) hit.add(grid[y][i]); } x = e+1; }
        for(let x=0;x<N;x++) for(let y=0;y<N;){ let e = y; while(e+1<N && grid[e+1][x].t===grid[y][x].t) e++; if(e-y>=2){ runs.push(e-y+1); for(let i=y;i<=e;i++) hit.add(grid[i][x]); } y = e+1; }
        return { hit, runs };
      }
      const sw = (a, b) => { const t = grid[a.y][a.x]; grid[a.y][a.x] = grid[b.y][b.x]; grid[b.y][b.x] = t; };
      function hasMove(){
        for(let y=0;y<N;y++) for(let x=0;x<N;x++) for(const [dx,dy] of [[1,0],[0,1]]){ const X = x+dx, Y = y+dy; if(X>=N || Y>=N) continue;
          sw({x,y}, {x:X,y:Y}); const ok = matches().hit.size > 0; sw({x,y}, {x:X,y:Y}); if(ok) return true; }
        return false;
      }
      const hud = () => { el.querySelector("#m3Sc").textContent = score; el.querySelector("#m3Tm").textContent = Math.ceil(left);
        const bar = el.querySelector("#m3Bar"); bar.style.width = Math.max(0, Math.min(100, left/TIME*100)) + "%"; bar.classList.toggle("low", left <= 10); };
      async function trySwap(a, b){
        if(busy || ended || !a || !b) return; if(Math.abs(a.x-b.x) + Math.abs(a.y-b.y) !== 1) return;
        busy = true; setSel(null); SFX.key(.8);
        const ax = a.x, ay = a.y, bx = b.x, by = b.y; sw(a, b); place(a, bx, by); place(b, ax, ay);
        await K.wait(170);
        let m = matches();
        if(!m.hit.size){ sw(a, b); place(a, ax, ay); place(b, bx, by); SFX.miss(); await K.wait(170); busy = false; return; }
        let combo = 0;
        while(m.hit.size){
          combo++;
          const pts = m.hit.size * 10 * combo; score += pts;
          const big = m.runs.some(n => n >= 4);
          if(big){ left = Math.min(TIME, left + 2); K.pop(B, "+2 秒", "m3Big"); }
          if(combo >= 2){ K.pop(B, `連鎖 ×${combo}！`, "m3Combo"); SFX.combo(); } else SFX.match();
          let cx = 0, cy = 0; m.hit.forEach(p => { cx += p.x; cy += p.y; p.el.classList.add("pop"); });
          const sp = document.createElement("div"); sp.className = "m3Pts"; sp.textContent = "+" + pts;
          sp.style.left = ((cx/m.hit.size + .5) * cs) + "px"; sp.style.top = ((cy/m.hit.size) * cs) + "px"; B.appendChild(sp); setTimeout(() => sp.remove(), 800);
          hud(); await K.wait(210);
          m.hit.forEach(p => { p.el.remove(); delete els[p.id]; grid[p.y][p.x] = null; });
          for(let x=0;x<N;x++){ let w = N-1;
            for(let y=N-1;y>=0;y--) if(grid[y][x]){ const p = grid[y][x]; grid[y][x] = null; grid[w][x] = p; if(p.y !== w) place(p, x, w); w--; }
            for(let y=w, k=1; y>=0; y--, k++){ const p = mk(rnd(KINDS.length), x, y, -k); grid[y][x] = p; } }
          await K.wait(30); for(let y=0;y<N;y++) for(let x=0;x<N;x++){ const p = grid[y][x]; place(p, x, y); }
          await K.wait(240);
          m = matches();
        }
        if(!hasMove()){ K.pop(B, "沒有步了，洗牌！", "m3Combo"); await K.wait(500);
          let ts; do{ ts = []; for(let i=0;i<N*N;i++) ts.push(rnd(KINDS.length)); for(let y=0;y<N;y++) for(let x=0;x<N;x++) grid[y][x].t = ts[y*N+x]; } while(matches().hit.size || !hasMove());
          for(let y=0;y<N;y++) for(let x=0;x<N;x++){ const p = grid[y][x]; p.el.innerHTML = KINDS[p.t](); } }
        busy = false;
        if(left <= 0) finish();
      }
      function setSel(p){ if(sel) sel.el.classList.remove("sel"); sel = p; if(p) p.el.classList.add("sel"); }
      const cellAt = (e) => { const r = B.getBoundingClientRect(); const x = Math.floor((e.clientX - r.left)/cs), y = Math.floor((e.clientY - r.top)/cs); return x>=0 && y>=0 && x<N && y<N ? grid[y][x] : null; };
      let down = null;
      B.addEventListener("pointerdown", e => { if(busy || ended) return; const p = cellAt(e); if(!p) return; down = { p, x: e.clientX, y: e.clientY, moved: false }; B.setPointerCapture(e.pointerId); e.preventDefault(); });
      B.addEventListener("pointermove", e => { if(!down || down.moved) return; const dx = e.clientX - down.x, dy = e.clientY - down.y; if(Math.max(Math.abs(dx), Math.abs(dy)) < cs*.35) return;
        down.moved = true; const p = down.p; const [ox, oy] = Math.abs(dx) > Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)]; trySwap(p, at(p.x+ox, p.y+oy)); });
      B.addEventListener("pointerup", () => { if(!down) return; const d = down; down = null; if(d.moved) return;
        if(sel && sel !== d.p && Math.abs(sel.x-d.p.x) + Math.abs(sel.y-d.p.y) === 1) trySwap(sel, d.p); else { setSel(sel === d.p ? null : d.p); SFX.tap(); } });
      function size(){ const w = B.clientWidth; cs = Math.floor(w / N); B.style.height = (cs*N) + "px"; Object.values(els).forEach(p => { p.el.style.width = p.el.style.height = cs + "px"; place(p, p.x, p.y); }); }
      requestAnimationFrame(() => { size(); fresh(); size(); hud();
        let last = performance.now();
        timer = setInterval(() => { const now = performance.now(); left -= (now - last)/1000; last = now; if(left <= 0){ left = 0; hud(); if(!busy) finish(); } else hud(); }, 100); });
      async function finish(){
        if(ended) return; ended = true; clearInterval(timer); busy = true;
        SFX.level();
        const coins = Math.floor(score / 400), foe = K.foeBest(ctx, s), p = ctx.partner();
        let rec = false; try{ rec = await K.saveBest(ctx, "match3", score); await K.giveCoins(ctx, coins, "match3"); }catch(e){ console.error(e); }
        if(rec && score > 0 && p) ctx.notifyPartner(`${ctx.me.name} 在「喵喵消消樂」拿到新紀錄 ${score} 分！${foe != null && score > foe ? "比你還高喔 😼" : ""}`);
        if(!alive) return;
        const end = document.createElement("div"); end.className = "m3End";
        end.innerHTML = `<div class="m3EndBox">${Pix.sprite(ctx.me.cat || "orange", rec ? "love" : "happy")}<h3>${rec ? "🎉 新紀錄！" : "時間到！"}</h3><div class="m3Big2">${score} 分</div>
          ${foe != null ? `<div class="k">${esc(p.name)} 的最高分：${foe} 分</div>` : ""}${coins ? `<div class="k">得到 ${coins} 個貓幣 🪙</div>` : ""}
          <button class="btn" id="m3Again">再玩一次</button><button class="btn sub" id="m3Lob">回到大廳</button></div>`;
        el.querySelector(".m3").appendChild(end);
        end.querySelector("#m3Again").addEventListener("click", () => { playing = false; start(); });
        end.querySelector("#m3Lob").addEventListener("click", () => { playing = false; lobby(); });
      }
      this_stop = () => { ended = true; clearInterval(timer); };
    }
    let this_stop = () => {};
    this._stop = () => { alive = false; this_stop(); };
    this._u = ctx.onState("match3", st => { s = st; lobby(); });
    (async () => { const cur = await ctx.getState("match3").catch(() => null); s = cur ? cur.state : null; lobby(); })();
  },
  unmount(){ if(this._u) this._u(); if(this._stop) this._stop(); },
});
})();

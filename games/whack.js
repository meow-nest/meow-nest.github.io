// 遊戲：打老鼠
// 老鼠從洞裡冒出來就用貓爪拍下去！金老鼠 +3，打到睡覺的貓咪 -2。30 秒比分數。
(function(){
const TIME = 30, HOLES = 9;
const O = "#5a3b2e";
const P = (rows, pal) => { pal = Object.assign({ O }, pal); const w = Math.max(...rows.map(r=>r.length)), h = rows.length; let r = "";
  rows.forEach((row,y)=>[...row].forEach((c,x)=>{ if(pal[c]) r += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${pal[c]}"/>`; }));
  return `<svg viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg">${pxC(r)}</svg>`; };
const MOUSE = [
  ".OOO.........OOO.",
  "OGGGO.......OGGGO",
  "OGPPGO.....OGPPGO",
  "OGPPGOOOOOOOGPPGO",
  ".OGGGGGGGGGGGGGO.",
  "..OGGGGGGGGGGGO..",
  "..OGEHGGGGGEHGO..",
  "..OGEEGGGGGEEGO..",
  "WW.OGGGGGGGGGO.WW",
  "..WWOGGGNGGGOWW..",
  "....OGGGGGGGO....",
  ".....OOGGGOO.....",
  ".......OOO.......",
];
const MOUSE_OW = MOUSE.map((r, y) => y===6 ? r.replace(/EH/g,"GG") : r);
const mouse = (gold, ow) => P(ow ? MOUSE_OW : MOUSE, { G: gold ? "#ffcf4a" : "#a7aec2", P: "#f7a7b8", N: "#f0708d", E: "#2b1d18", H: "#ffffff", W: "#ffffff" });
const PAW = ["..OO.OO..",".OKKOKKO.","..OO.OO..","OO.....OO","OKO.O.OKO",".OOOWOOO.","OWWWWWWWO","OWWWWWWWO",".OWWWWWO.","..OOOOO.."];

App.registerGame({
  id: "whack",
  solo: true,
  name: "打老鼠",
  desc: "老鼠冒出來就拍下去，30 秒比分數",
  icon: () => mouse(false),
  mount(el, ctx){
    const { esc, SFX } = ctx, K = window.MiniKit;
    let s = null, alive = true, playing = false, stop = () => {};
    const lobby = () => {
      if(playing) return;
      el.innerHTML = `<div class="box skLobby">
        <div class="wkHero"><i>${mouse(false)}</i><i>${mouse(true)}</i><i>${Pix.sprite("gray","sleep")}</i></div>
        <p class="skIntro">老鼠從洞裡冒出來就<b>點牠</b>，用貓爪拍下去！🐾<br><b>金老鼠 +3 分</b>，一般老鼠 +1 分<br>小心別打到<b>睡覺的貓咪</b>，會 -2 分！</p>
        ${K.bestRows(ctx, s, v => `${v} 分`)}
        <button class="btn" id="wkGo">🐾 開始！（${TIME} 秒）</button>
        <div class="k" style="text-align:center">每 10 分得 1 個貓幣 🪙</div></div>`;
      el.querySelector("#wkGo").addEventListener("click", start);
    };
    function start(){
      SFX.tap(); playing = true;
      let score = 0, left = TIME, ended = false, hits = 0, combo = 0;
      const holes = Array.from({ length: HOLES }, () => ({ kind: null, until: 0, el: null, hit: false }));
      el.innerHTML = `<div class="box wk"><div class="m3Hud"><div><span>分數</span><b id="wkSc">0</b></div><div class="m3T"><span>時間</span><b id="wkTm">${TIME}</b></div></div>
        <div class="m3Bar"><i id="wkBar"></i></div>
        <div class="wkG" id="wkG">${holes.map((_, i) => `<div class="wkH" data-i="${i}"><div class="wkW"><div class="wkM"></div></div><div class="wkHole"></div></div>`).join("")}</div>
        <div class="k" style="text-align:center;margin-top:6px">別打到睡覺的貓咪喔！</div></div>`;
      const G = el.querySelector("#wkG");
      holes.forEach((h, i) => { h.el = G.children[i]; h.m = h.el.querySelector(".wkM"); });
      const hud = () => { el.querySelector("#wkSc").textContent = score; el.querySelector("#wkTm").textContent = Math.ceil(left);
        const bar = el.querySelector("#wkBar"); bar.style.width = Math.max(0, left/TIME*100) + "%"; bar.classList.toggle("low", left <= 8); };
      function show(i){
        const h = holes[i], t = TIME - left, r = Math.random();
        h.kind = r < .12 ? "gold" : r < (t > 8 ? .3 : .2) ? "cat" : "mouse";
        const stay = Math.max(520, 1150 - t*22) * (h.kind === "gold" ? .75 : 1);
        h.until = performance.now() + stay; h.hit = false;
        const c = ["gray","calico","white","black"][(Math.random()*4)|0]; h.m.dataset.c = c;
        h.m.innerHTML = h.kind === "cat" ? Pix.sprite(c, "sleep") : mouse(h.kind === "gold");
        h.el.classList.remove("hit", "bad"); h.el.classList.add("up");
      }
      function hide(i){ const h = holes[i]; h.kind = null; h.el.classList.remove("up"); }
      G.addEventListener("pointerdown", e => {
        if(ended) return; const hEl = e.target.closest(".wkH"); if(!hEl) return; e.preventDefault();
        const i = +hEl.dataset.i, h = holes[i];
        const paw = document.createElement("div"); paw.className = "wkPaw"; paw.innerHTML = P(PAW, { K: "#f7a7b8", W: "#fffaf4" }); hEl.appendChild(paw); setTimeout(() => paw.remove(), 260);
        if(!h.kind || h.hit) { combo = 0; return; }
        h.hit = true;
        if(h.kind === "cat"){ score = Math.max(0, score - 2); combo = 0; SFX.miss(); h.el.classList.add("bad"); h.m.innerHTML = Pix.sprite(h.m.dataset.c || "gray", "angry"); K.pop(hEl, "-2", "wkMinus"); }
        else { const pts = h.kind === "gold" ? 3 : 1; score += pts; hits++; combo++; SFX.hit(); if(h.kind === "gold") SFX.coin();
          h.el.classList.add("hit"); h.m.innerHTML = mouse(h.kind === "gold", true); K.pop(hEl, "+" + pts, h.kind === "gold" ? "wkGold" : "wkPlus");
          if(combo > 0 && combo % 5 === 0){ K.pop(G, `${combo} 連擊！`, "m3Combo"); SFX.combo(); } }
        hud(); h.until = Math.min(h.until, performance.now() + 220);
      });
      let last = performance.now(), nextSpawn = 0;
      function tick(){
        if(ended) return;
        const now = performance.now(); left -= (now - last)/1000; last = now;
        holes.forEach((h, i) => { if(h.kind && now > h.until){ if(!h.hit && h.kind !== "cat") combo = 0; hide(i); } });
        const t = TIME - left, maxUp = t < 8 ? 2 : t < 18 ? 3 : 4;
        if(now > nextSpawn && holes.filter(h => h.kind).length < maxUp){
          const free = holes.map((h, i) => h.kind ? -1 : i).filter(i => i >= 0); if(free.length) show(free[(Math.random()*free.length)|0]);
          nextSpawn = now + Math.max(260, 700 - t*15) * (.6 + Math.random()*.8);
        }
        if(left <= 0){ left = 0; hud(); finish(); return; }
        hud(); raf = requestAnimationFrame(tick);
      }
      let raf = requestAnimationFrame(tick);
      async function finish(){
        if(ended) return; ended = true; cancelAnimationFrame(raf); holes.forEach((_, i) => hide(i)); SFX.level();
        const coins = Math.floor(score / 10), foe = K.foeBest(ctx, s), p = ctx.partner();
        let rec = false; try{ rec = await K.saveBest(ctx, "whack", score); await K.giveCoins(ctx, coins, "whack"); }catch(e){ console.error(e); }
        if(rec && score > 0 && p) ctx.notifyPartner(`${ctx.me.name} 在「打老鼠」拍到 ${score} 分，新紀錄！${foe != null && score > foe ? "比你還高喔 😼" : ""}`);
        if(!alive) return;
        const end = document.createElement("div"); end.className = "m3End";
        end.innerHTML = `<div class="m3EndBox">${Pix.sprite(ctx.me.cat || "orange", rec ? "love" : "happy")}<h3>${rec ? "🎉 新紀錄！" : "時間到！"}</h3><div class="m3Big2">${score} 分</div>
          <div class="k">拍到 ${hits} 隻老鼠</div>${foe != null ? `<div class="k">${esc(p.name)} 的最高分：${foe} 分</div>` : ""}${coins ? `<div class="k">得到 ${coins} 個貓幣 🪙</div>` : ""}
          <button class="btn" id="wkAgain">再玩一次</button><button class="btn sub" id="wkLob">回到大廳</button></div>`;
        el.querySelector(".wk").appendChild(end);
        end.querySelector("#wkAgain").addEventListener("click", () => { playing = false; start(); });
        end.querySelector("#wkLob").addEventListener("click", () => { playing = false; lobby(); });
      }
      stop = () => { ended = true; cancelAnimationFrame(raf); };
    }
    this._stop = () => { alive = false; stop(); };
    this._u = ctx.onState("whack", st => { s = st; lobby(); });
    (async () => { const cur = await ctx.getState("whack").catch(() => null); s = cur ? cur.state : null; lobby(); })();
  },
  unmount(){ if(this._u) this._u(); if(this._stop) this._stop(); },
});
if(window.GameArt) window.GameArt.whack = () => `<span class="gaL" style="left:4%;bottom:2%;width:56%">${Pix.sprite("orange","angry")}</span><span class="gaL" style="right:2%;bottom:6%;width:42%">${mouse(false)}</span><span class="gaL" style="right:8%;top:6%;width:26%">${mouse(true)}</span>`;
})();

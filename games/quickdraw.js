// 遊戲：西部快槍手（兩人同時在線，看到「開槍！」誰先按誰贏；太早按犯規）
// 公平性：每支手機各自從收到開始訊號起算同樣的隨機等待時間，比的是各自的反應毫秒數。
(function(){
const fresh = (sc, best) => ({ round:1, phase:"idle", ready:{}, delay:0, res:{}, sc: sc||{}, best: best||{}, hist:[] });

App.registerGame({
  id: "quickdraw",
  name: "西部快槍手",
  desc: "看到訊號誰先按誰贏！",
  icon: () => Pix.sprite("calico","surprised"),
  mount(el, ctx){
    const { sprite, esc, SFX } = ctx;
    let s = null, armedRound = 0, signalAt = 0, timer = null, myShot = null, practice = null;
    el.innerHTML = `<div class="box qd">
      <div class="qdScene" id="qdScene"><div class="qdSun"></div><div class="qdCats" id="qdCats"></div><div class="qdSign" id="qdSign"></div><div class="qdWeed">🌵</div></div>
      <button class="qdBtn" id="qdBtn">準備好了</button>
      <div class="qdMsg" id="qdMsg"></div>
      <div class="qdStats" id="qdStats"></div></div>`;
    const $ = q => el.querySelector(q);
    const ids = () => ctx.players(), me = () => ctx.me.uid, opp = () => ids().find(i=>i!==me());
    const fmt = ms => (ms/1000).toFixed(3)+" 秒";

    function cats(faceMe, faceOpp){
      const p = ctx.partner();
      $("#qdCats").innerHTML = `<div class="qdC l"><i class="hat">🤠</i>${sprite(ctx.catOf(me()), faceMe||"normal")}<b>${esc(ctx.me.name)}</b></div>
        <div class="qdC r"><i class="hat">🤠</i>${p ? sprite(p.cat, faceOpp||"normal") : ""}<b>${p?esc(p.name):"？？？"}</b></div>`;
    }
    function stats(){
      if(!s) return;
      const p = ctx.partner(), b = s.best||{};
      const h = (s.hist||[]).slice(-5).reverse().map(x=>`<li>${x.w==="draw"?"平手":x.w===me()?"🏆 你贏":"😿 "+esc(ctx.nameOf(x.w))+" 贏"}・${x.t}</li>`).join("");
      $("#qdStats").innerHTML = `<div class="qdScore"><span>${esc(ctx.me.name)} <b>${s.sc[me()]||0}</b></span> : <span><b>${p?(s.sc[p.user_id]||0):0}</b> ${p?esc(p.name):""}</span></div>
        <div class="qdBest">⚡ 最快紀錄：你 ${b[me()]?fmt(b[me()]):"—"}${p?`・${esc(p.name)} ${b[p.user_id]?fmt(b[p.user_id]):"—"}`:""}</div>${h?`<ul>${h}</ul>`:""}`;
    }
    function sign(text, cls){ const sg=$("#qdSign"); sg.className = "qdSign "+(cls||""); sg.innerHTML = text; }
    function render(){
      const p = ctx.partner(), btn = $("#qdBtn");
      stats();
      if(practice){ return; }
      if(!p){ cats(); sign(""); btn.textContent=`等${ctx.pw()}加入`; btn.disabled=true; $("#qdMsg").textContent=""; return; }
      const here = ctx.isOnline(p.user_id);
      if(s.phase==="idle"){
        cats(s.ready[me()]===s.round?"happy":"normal", s.ready[p.user_id]===s.round?"happy":"normal");
        sign("");
        const iReady = s.ready[me()]===s.round, theyReady = s.ready[p.user_id]===s.round;
        btn.disabled = iReady || !here; btn.className = "qdBtn"; btn.textContent = iReady ? "等對方準備…" : "準備好了";
        $("#qdMsg").innerHTML = !here ? `要兩個人<b>同時在線</b>才能對決<br><button class="btn sub" id="qdPrac">先自己練習反應</button>` : theyReady ? `<b>${esc(p.name)} 準備好了！</b>` : "兩個人都按「準備好了」就開始";
        const pr = $("#qdPrac"); if(pr) pr.addEventListener("click", startPractice);
      } else if(s.phase==="arming"){
        btn.disabled = false;
      } else if(s.phase==="done"){
        const r = s.res, a = r[me()]||{}, b = r[p.user_id]||{};
        const w = s.lastWin;
        cats(w===me()?"love":w==="draw"?"surprised":"sleep", w===p.user_id?"love":w==="draw"?"surprised":"sleep");
        sign(w==="draw" ? "平手！" : w===me() ? "你贏了！" : `${esc(p.name)} 贏了`, w===me()?"win":"");
        const line = (x, n) => x.foul ? `${n}：<span class="foul">太早開槍，犯規！</span>` : x.ms!=null ? `${n}：${fmt(x.ms)}` : `${n}：沒開槍`;
        $("#qdMsg").innerHTML = `${line(a,"你")}<br>${line(b,esc(p.name))}`;
        btn.disabled = !here; btn.className = "qdBtn"; btn.textContent = "再來一局！";
      }
    }
    // start the countdown when the round is armed
    function arm(st){
      if(armedRound===st.round) return;
      armedRound = st.round; myShot = null; signalAt = 0;
      cats("normal","normal"); sign("預備…", "ready"); $("#qdMsg").innerHTML = "看到 <b>開槍！</b> 立刻按下去<br>太早按會犯規喔";
      const btn = $("#qdBtn"); btn.disabled = false; btn.className = "qdBtn wait"; btn.textContent = "等…";
      let beeps = 0; const tick = setInterval(()=>{ if(beeps++<2) SFX.beep(false); else clearInterval(tick); }, 600);
      clearTimeout(timer);
      timer = setTimeout(()=>{ if(myShot) return; signalAt = performance.now(); sign("開槍！", "go"); btn.className = "qdBtn go"; btn.textContent = "砰！"; SFX.beep(true); el.querySelector(".qdScene").animate([{filter:"brightness(1.8)"},{filter:"brightness(1)"}],{duration:250}); }, st.delay);
    }
    async function shoot(){
      if(practice){ practiceShoot(); return; }
      const p = ctx.partner(); if(!s || !p) return;
      if(s.phase==="idle" || s.phase==="done"){
        SFX.select();
        await ctx.update("quickdraw", st=>{
          if(!st || st.phase==="arming") return undefined;
          if(st.phase==="done"){ st.round++; st.phase="idle"; st.ready={}; st.res={}; }
          if(st.ready[me()]===st.round) return undefined;
          st.ready[me()] = st.round;
          if(ids().every(i=>st.ready[i]===st.round)){ st.phase="arming"; st.delay = 2000 + Math.floor(Math.random()*3500); st.res = {}; }
          return st;
        });
        return;
      }
      if(s.phase!=="arming" || myShot) return;
      const now = performance.now();
      myShot = signalAt && now >= signalAt ? { ms: Math.round(now - signalAt) } : { foul: true };
      clearTimeout(timer);
      SFX.bang(); if(navigator.vibrate) try{ navigator.vibrate(40); }catch(e){}
      sign(myShot.foul ? "犯規！" : fmt(myShot.ms), myShot.foul?"foul":"go");
      $("#qdBtn").disabled = true; $("#qdBtn").textContent = "等結果…";
      const r = s.round, shot = myShot;
      await ctx.update("quickdraw", st=>{
        if(!st || st.round!==r || st.phase!=="arming") return undefined;
        st.res[me()] = shot;
        const I = ids();
        if(I.every(i=>st.res[i])){
          const [A,B] = I.map(i=>st.res[i]);
          let w;
          if(A.foul && B.foul) w = "draw"; else if(A.foul) w = I[1]; else if(B.foul) w = I[0];
          else w = A.ms===B.ms ? "draw" : A.ms < B.ms ? I[0] : I[1];
          st.phase = "done"; st.lastWin = w;
          if(w!=="draw") st.sc[w] = (st.sc[w]||0)+1;
          for(const i of I){ const x = st.res[i]; if(x.ms!=null && (!st.best[i] || x.ms < st.best[i])) st.best[i] = x.ms; }
          const t = I.map(i=>st.res[i].foul ? "犯規" : fmt(st.res[i].ms)).join(" vs ");
          st.hist = (st.hist||[]).concat({ w, t }).slice(-20);
        }
        return st;
      });
    }
    // a player who never presses: auto-finish after 4s past the signal
    // (the other phone does it, so nobody gets stuck)
    function watchdog(st){
      if(st.phase!=="arming") return;
      const r = st.round;
      setTimeout(async ()=>{
        if(!s || s.round!==r || s.phase!=="arming" || !myShot) return;
        await ctx.update("quickdraw", x=>{ if(!x || x.round!==r || x.phase!=="arming") return undefined; for(const i of ids()) if(!x.res[i]) x.res[i] = { foul:false, ms:null, none:true };
          const I = ids(), [A,B] = I.map(i=>x.res[i]);
          const ok = v => v.ms!=null && !v.foul;
          const w = ok(A)&&!ok(B) ? I[0] : ok(B)&&!ok(A) ? I[1] : ok(A)&&ok(B) ? (A.ms<B.ms?I[0]:I[1]) : "draw";
          x.phase="done"; x.lastWin=w; if(w!=="draw") x.sc[w]=(x.sc[w]||0)+1; x.hist=(x.hist||[]).concat({ w, t:"有人沒開槍" }).slice(-20); return x; });
      }, st.delay + 6000);
    }
    // solo practice (local only)
    function startPractice(){
      practice = { n:0, best:null }; nextPractice();
    }
    function nextPractice(){
      cats("normal","sleep"); sign("預備…","ready"); signalAt = 0; myShot = null;
      $("#qdMsg").innerHTML = `練習模式・看到「開槍！」就按<br><button class="btn sub" id="qdStop">結束練習</button>`;
      $("#qdStop").addEventListener("click", ()=>{ practice=null; clearTimeout(timer); render(); });
      const btn=$("#qdBtn"); btn.disabled=false; btn.className="qdBtn wait"; btn.textContent="等…";
      clearTimeout(timer); timer = setTimeout(()=>{ signalAt=performance.now(); sign("開槍！","go"); btn.className="qdBtn go"; btn.textContent="砰！"; SFX.beep(true); }, 1500+Math.random()*3000);
    }
    async function practiceShoot(){
      const btn=$("#qdBtn");
      if(btn.textContent==="再練一次"){ nextPractice(); return; }
      const now = performance.now(); clearTimeout(timer); SFX.bang();
      if(!signalAt){ sign("犯規！","foul"); }
      else { const ms = Math.round(now-signalAt); sign(fmt(ms),"go"); if(!practice.best || ms<practice.best) practice.best = ms;
        if(!s.best[me()] || ms < s.best[me()]){ ctx.toast(`⚡ 新紀錄 ${fmt(ms)}！`); await ctx.update("quickdraw", st=>{ if(!st) return undefined; if(!st.best[me()] || ms<st.best[me()]) st.best[me()] = ms; return st; }); } }
      btn.textContent="再練一次"; btn.className="qdBtn";
    }
    $("#qdBtn").addEventListener("pointerdown", e=>{ e.preventDefault(); shoot(); });
    function onState(st){
      if(!st) return;
      const prev = s; s = st;
      if(practice) { stats(); return; }
      if(st.phase==="arming"){ arm(st); watchdog(st); stats(); }
      else { clearTimeout(timer); render(); }
      if(prev && prev.phase!=="done" && st.phase==="done"){ if(st.lastWin===me()){ SFX.match(); ctx.burst(); } else if(st.lastWin!=="draw") SFX.miss(); }
    }
    this._t = () => clearTimeout(timer);
    this._u = ctx.onState("quickdraw", onState);
    this._p = ctx.onPresence(()=>{ if(s && s.phase!=="arming" && !practice) render(); });
    (async()=>{
      let cur = await ctx.getState("quickdraw");
      if(!cur && ids().length>=2){ await ctx.update("quickdraw", st=> st ? undefined : fresh()); cur = await ctx.getState("quickdraw"); }
      if(cur){ s = JSON.parse(JSON.stringify(cur.state));
        // a duel left half-finished (someone closed the app): reset it
        if(s.phase==="arming"){ await ctx.update("quickdraw", st=>{ if(!st||st.phase!=="arming") return undefined; st.phase="idle"; st.ready={}; st.res={}; st.round++; return st; }); cur = await ctx.getState("quickdraw"); s = JSON.parse(JSON.stringify(cur.state)); }
      }
      if(s) render(); else { cats(); $("#qdMsg").textContent=`等${ctx.pw()}加入小窩…`; }
    })();
  },
  unmount(){ if(this._u) this._u(); if(this._p) this._p(); if(this._t) this._t(); },
});
})();

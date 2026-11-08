// 遊戲：貓咪格鬥對決（同時出招、互相剋制）
(function(){
const MAXHP = 30, MAXEN = 6;
const MOVES = {
  atk:    { n:"攻擊", i:"👊", cost:0, d:"4 傷害・快，閃避躲不掉" },
  heavy:  { n:"重擊", i:"💥", cost:2, d:"7 傷害・可以打破防禦" },
  def:    { n:"防禦", i:"🛡️", cost:0, d:"完全擋下攻擊，還 +1 能量" },
  charge: { n:"蓄力", i:"✨", cost:0, d:"+2 能量，但被打會多受傷" },
  dodge:  { n:"閃避", i:"💨", cost:1, d:"躲開重擊和必殺並反擊" },
  special:{ n:"必殺", i:"🌟", cost:5, d:"12 傷害的超強一擊" },
};
const BASE = { atk:4, heavy:7, special:12 };
// how much damage `m` does to someone who chose `o`; also returns counter damage to the attacker
function hitOf(m, o){
  let dmg = BASE[m]||0, counter = 0, tag = "";
  if(!dmg) return { dmg:0, counter:0, tag:"" };
  if(o==="def"){ if(m==="atk"){ dmg=0; tag="block"; } else if(m==="heavy"){ dmg=5; tag="break"; } else { dmg=6; tag="half"; } }
  else if(o==="dodge"){ if(m==="atk"){ tag="slow"; } else { dmg=0; counter=3; tag="dodge"; } }
  else if(o==="charge"){ dmg+=2; tag="open"; }
  return { dmg, counter, tag };
}
function resolve(st, A, B){
  const ma = st.pick[A].m, mb = st.pick[B].m;
  const ha = hitOf(ma, mb), hb = hitOf(mb, ma);
  const dmg = { [A]: hb.dmg + ha.counter, [B]: ha.dmg + hb.counter };
  const en = { [A]: st.en[A], [B]: st.en[B] };
  for(const [u,m,blocked] of [[A,ma,hb.tag==="block"],[B,mb,ha.tag==="block"]]){
    en[u] = en[u] - MOVES[m].cost + 1 + (m==="charge"?2:0) + (blocked?1:0);
    en[u] = Math.max(0, Math.min(MAXEN, en[u]));
  }
  st.hp[A] = Math.max(0, st.hp[A]-dmg[A]); st.hp[B] = Math.max(0, st.hp[B]-dmg[B]);
  st.en = en;
  st.last = { r: st.round, moves:{ [A]:ma, [B]:mb }, dmg, tags:{ [A]:ha.tag, [B]:hb.tag } };
  st.round++; st.pick = {};
  if(st.hp[A]<=0 || st.hp[B]<=0){
    st.win = st.hp[A]<=0 && st.hp[B]<=0 ? "draw" : st.hp[A]<=0 ? B : A;
    if(st.win!=="draw") st.sc[st.win] = (st.sc[st.win]||0)+1;
  }
  return st;
}
const fresh = (ids, sc) => ({ round:1, hp:{[ids[0]]:MAXHP,[ids[1]]:MAXHP}, en:{[ids[0]]:1,[ids[1]]:1}, pick:{}, last:null, win:null, sc: sc||{} });

App.registerGame({
  id: "fight",
  name: "貓咪格鬥",
  desc: "同時出招，猜透對方！",
  icon: () => Pix.sprite("gray","surprised"),
  mount(el, ctx){
    const { sprite, esc, SFX } = ctx;
    let s = null, shown = 0, busy = false, helpOpen = false;
    el.innerHTML = `<div class="box ft">
      <div class="ftStage" id="ftStage"></div>
      <div class="ftMsg" id="ftMsg"></div>
      <div class="ftMoves" id="ftMoves"></div>
      <div class="ftFoot"><button class="btn sub" id="ftHelp">📖 招式相剋表</button><button class="btn sub" id="ftNew">重新開一局</button></div>
      <div class="ftHelpBox hidden" id="ftHelpBox"></div></div>`;
    const $ = q => el.querySelector(q);
    const ids = () => ctx.players();
    const me = () => ctx.me.uid;
    const opp = () => ids().find(i=>i!==me());

    $("#ftHelpBox").innerHTML = `<table><tr><th>你出</th><th>贏過</th><th>怕</th></tr>
      <tr><td>👊 攻擊</td><td>閃避、蓄力</td><td>防禦</td></tr>
      <tr><td>💥 重擊</td><td>防禦、蓄力</td><td>閃避</td></tr>
      <tr><td>🛡️ 防禦</td><td>攻擊</td><td>重擊、蓄力時被拖時間</td></tr>
      <tr><td>✨ 蓄力</td><td>（存能量）</td><td>所有攻擊</td></tr>
      <tr><td>💨 閃避</td><td>重擊、必殺</td><td>攻擊</td></tr>
      <tr><td>🌟 必殺</td><td>幾乎所有</td><td>閃避、防禦（減半）</td></tr></table>
      <div>每回合兩個人<b>同時偷偷</b>選一招，選好就會一起亮牌。每回合自動 +1 能量，先把對方打到 0 血就贏！</div>`;
    $("#ftHelp").addEventListener("click", ()=>{ helpOpen=!helpOpen; $("#ftHelpBox").classList.toggle("hidden", !helpOpen); });

    function stage(anim){
      const [L,R] = ids(); if(!L||!R) return;
      const fighter = (u, side) => {
        const hp = s.hp[u], en = s.en[u];
        const face = s.win ? (s.win===u ? "love" : s.win==="draw" ? "surprised" : "sleep") : (s.pick[u] && s.pick[u].r===s.round ? "happy" : "normal");
        return `<div class="ftF ${side}" id="ftF_${side}">
          <div class="ftName">${esc(ctx.nameOf(u))}${u===me()?"（你）":""}</div>
          <div class="ftHp"><i style="width:${hp/MAXHP*100}%" class="${hp<=8?"low":""}"></i><span>${hp}</span></div>
          <div class="ftEn">${[...Array(MAXEN)].map((_,k)=>`<i class="${k<en?"on":""}"></i>`).join("")}</div>
          <div class="ftCat">${sprite(ctx.catOf(u), face)}</div>
          <div class="ftReady">${!s.win && s.pick[u] && s.pick[u].r===s.round ? (u===me() ? MOVES[s.pick[u].m].i : "✔ 已出招") : ""}</div></div>`;
      };
      $("#ftStage").innerHTML = fighter(L,"l") + `<div class="ftVs">VS</div>` + fighter(R,"r");
    }
    function msg(){
      const p = ctx.partner();
      if(!p){ $("#ftMsg").textContent = `等${ctx.pw()}加入小窩…`; return; }
      if(s.win){ $("#ftMsg").innerHTML = s.win==="draw" ? "同歸於盡！平手 🤝" : s.win===me() ? "<b>你贏了！</b> 🏆" : `${esc(ctx.nameOf(s.win))} 贏了～ 再來一局報仇！`; return; }
      const mine = s.pick[me()] && s.pick[me()].r===s.round, theirs = s.pick[opp()] && s.pick[opp()].r===s.round;
      $("#ftMsg").innerHTML = `第 ${s.round} 回合・` + (mine && !theirs ? `等 ${esc(p.name)} 出招…（可以改）` : !mine && theirs ? `<b>${esc(p.name)} 已出招，換你！</b>` : "選一招，兩人同時亮牌");
    }
    function moves(){
      const myEn = s ? s.en[me()] : 0, picked = s && s.pick[me()] && s.pick[me()].r===s.round ? s.pick[me()].m : null;
      $("#ftMoves").innerHTML = Object.entries(MOVES).map(([k,v])=>`<button data-m="${k}" class="${picked===k?"on":""}" ${(!s||s.win||myEn<v.cost||busy)?"disabled":""}>
        <span class="i">${v.i}</span><b>${v.n}</b><span class="c">${v.cost?`⚡${v.cost}`:"免費"}</span><span class="d">${v.d}</span></button>`).join("");
      $("#ftMoves").querySelectorAll("button").forEach(b=>b.addEventListener("click", ()=>pick(b.dataset.m)));
    }
    function render(){ if(!s) return; stage(); msg(); moves(); }

    async function pick(m){
      if(!s || s.win || busy) return;
      SFX.select();
      const r = s.round, u = me();
      const ns = await ctx.update("fight", st=>{
        if(!st || st.win || st.round!==r) return undefined;
        if(st.en[u] < MOVES[m].cost) return undefined;
        st.pick[u] = { r, m };
        const [A,B] = ids();
        if(st.pick[A] && st.pick[B] && st.pick[A].r===r && st.pick[B].r===r) resolve(st, A, B);
        return st;
      });
      const p = ctx.partner();
      if(ns && p && !ctx.isOnline(p.user_id) && ns.round===r) ctx.notifyPartner(`${ctx.me.name} 在「貓咪格鬥」出招了，換你！`);
    }
    // reveal animation for a resolved round
    async function reveal(last){
      busy = true; moves();
      const [L,R] = ids();
      const side = u => u===L ? "l" : "r";
      for(const u of [L,R]){
        const f = $("#ftF_"+side(u)); if(!f) continue;
        const card = document.createElement("div"); card.className = "ftCard"; card.innerHTML = `${MOVES[last.moves[u]].i}<b>${MOVES[last.moves[u]].n}</b>`; f.appendChild(card);
        card.animate([{transform:"translateX(-50%) scale(.2) rotateY(90deg)",opacity:0},{transform:"translateX(-50%) scale(1.2) rotateY(0)",opacity:1,offset:.6},{transform:"translateX(-50%) scale(1)",opacity:1}],{duration:420,easing:"ease-out",fill:"forwards"});
      }
      SFX.beep(true);
      await wait(650);
      for(const u of [L,R]){
        const o = u===L ? R : L, m = last.moves[u], f = $("#ftF_"+side(u)), cat = f && f.querySelector(".ftCat");
        if(!cat) continue;
        if(BASE[m]){ const dir = u===L ? 1 : -1; cat.animate([{transform:"translateX(0)"},{transform:`translateX(${dir*60}px) scale(1.15)`,offset:.4},{transform:"translateX(0)"}],{duration:380,easing:"ease-out"}); SFX.shoot(); }
        else if(m==="charge"){ cat.animate([{filter:"brightness(1)"},{filter:"brightness(1.6) drop-shadow(0 0 8px #ffd34d)"},{filter:"brightness(1)"}],{duration:500}); SFX.charge(); }
        else if(m==="def"){ cat.animate([{transform:"scale(1)"},{transform:"scale(.9)"},{transform:"scale(1)"}],{duration:300}); }
        else if(m==="dodge"){ cat.animate([{transform:"translateY(0)"},{transform:"translateY(-36px)",offset:.4},{transform:"translateY(0)"}],{duration:420,easing:"ease-out"}); }
      }
      await wait(360);
      for(const u of [L,R]){
        const d = last.dmg[u], f = $("#ftF_"+side(u)); if(!f) continue;
        const o = u===L ? R : L, tag = last.tags[o];
        const pop = document.createElement("div"); pop.className = "ftDmg" + (d?"":" zero");
        pop.textContent = d ? `-${d}` : (tag==="block" ? "擋下！" : tag==="dodge" ? "閃過！" : "");
        if(pop.textContent){ f.appendChild(pop); pop.animate([{transform:"translate(-50%,0) scale(.5)",opacity:0},{transform:"translate(-50%,-30px) scale(1.3)",opacity:1,offset:.3},{transform:"translate(-50%,-60px) scale(1)",opacity:0}],{duration:1100,easing:"ease-out",fill:"forwards"}); }
        if(d){ const cat=f.querySelector(".ftCat"); cat.animate([{transform:"translateX(0)"},{transform:"translateX(-6px)"},{transform:"translateX(6px)"},{transform:"translateX(-4px)"},{transform:"translateX(0)"}],{duration:300}); SFX.hit(); if(navigator.vibrate) try{navigator.vibrate(30)}catch(e){} }
        else if(tag==="block") SFX.block();
      }
      await wait(900);
      el.querySelectorAll(".ftCard").forEach(c=>c.remove());
      busy = false;
    }
    const wait = ms => new Promise(r=>setTimeout(r, ms));
    async function onState(st){
      if(!st) return;
      const prevRound = s ? s.round : null;
      const newLast = st.last && st.last.r >= shown && prevRound!==null && st.round > prevRound ? st.last : null;
      if(newLast){
        // show HP before damage, animate, then update
        const before = JSON.parse(JSON.stringify(st));
        for(const u of Object.keys(before.hp)) before.hp[u] = Math.min(MAXHP, before.hp[u] + (newLast.dmg[u]||0));
        before.win = null; before.pick = {}; s = before; render();
        shown = newLast.r + 1;
        await reveal(newLast);
      }
      s = st; render();
      if(newLast && st.win){ if(st.win===me()){ SFX.match(); ctx.burst(); } else SFX.miss(); }
    }
    this._rs = ctx.restartable("fight", { title:"貓咪格鬥", done: ()=>!s || !!s.win, run: async ()=>{ const I=ids(); if(I.length<2) return; shown = 1; s = null; await ctx.update("fight", st=>fresh(I, st?st.sc:{})); } });
    $("#ftNew").addEventListener("click", ()=>ctx.askRestart("fight"));
    this._u = ctx.onState("fight", st=>{ if(!busy) onState(st); else setTimeout(()=>onState(st), 1800); });
    this._p = ctx.onPresence(()=>{ if(s && !busy) render(); });
    (async()=>{
      const I = ids();
      let cur = await ctx.getState("fight");
      if(!cur && I.length>=2){ await ctx.update("fight", st=> st ? undefined : fresh(I, {})); cur = await ctx.getState("fight"); }
      if(cur && I.length>=2 && !I.every(i=>i in cur.state.hp)){ await ctx.update("fight", st=>fresh(I, st?st.sc:{})); cur = await ctx.getState("fight"); }
      if(cur){ s = JSON.parse(JSON.stringify(cur.state)); shown = s.round; }
      if(!ctx.partner()){ $("#ftMsg").textContent = `等${ctx.pw()}加入小窩…`; return; }
      render();
    })();
  },
  unmount(){ if(this._rs) this._rs(); if(this._u) this._u(); if(this._p) this._p(); },
});
})();

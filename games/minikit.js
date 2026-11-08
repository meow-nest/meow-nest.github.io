// 小遊戲共用：存最高分、給貓幣、大廳的分數列
(function(){
const K = {
  // 存自己的最佳成績；lower = 數字越小越好（例如翻牌用的步數）。回傳是不是新紀錄
  async saveBest(ctx, id, val, lower, extra){
    const uid = ctx.me.uid; let rec = false;
    await ctx.update(id, st => { st = st || {}; st.best = st.best || {}; st.plays = st.plays || {};
      st.plays[uid] = (st.plays[uid]||0) + 1;
      const old = st.best[uid];
      if(old == null || (lower ? val < old : val > old)){ st.best[uid] = val; rec = true; }
      st.last = Object.assign({ by: uid, val, at: Date.now() }, extra || {}); return st; });
    return rec;
  },
  // 給貓幣（養貓用）；還沒領養貓的話就不給
  async giveCoins(ctx, n, tag){
    if(!(n > 0)) return;
    await ctx.update("pet", st => { if(!st || !window.PetLogic) return undefined; st = window.PetLogic.norm(JSON.parse(JSON.stringify(st)));
      st.coins = (st.coins||0) + n; st.log = (st.log||[]).concat([{ by: ctx.me.uid, a: tag, n, at: Date.now() }]).slice(-24); return st; });
  },
  // 大廳的「你 / ta」最佳成績
  bestRows(ctx, s, fmt){
    const best = (s && s.best) || {}, plays = (s && s.plays) || {}, p = ctx.partner();
    const row = (name, uid) => `<div><b>${ctx.esc(name)}</b><span>${best[uid] != null ? fmt(best[uid]) : "—"}</span><em>${plays[uid] ? `玩了 ${plays[uid]} 次` : "還沒玩過"}</em></div>`;
    return `<div class="tsBest">${row(ctx.me.name, ctx.me.uid)}${p ? row(p.name, p.user_id) : ""}</div>`;
  },
  foeBest(ctx, s){ const p = ctx.partner(); return p && s && s.best ? s.best[p.user_id] : null; },
  wait: ms => new Promise(r => setTimeout(r, ms)),
  pop(el, html, cls){ const d = document.createElement("div"); d.className = "mkPop " + (cls||""); d.innerHTML = html; el.appendChild(d); setTimeout(() => d.remove(), 900); },
};
window.MiniKit = K;
})();

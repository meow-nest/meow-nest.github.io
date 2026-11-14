// 遊戲：貓貓股市（偽股票）
// 股價、帳戶、買賣全部在伺服器上（supabase/update_25_stock.sql）：這裡只負責顯示和送出委託。
// 全站同一個行情，每分鐘跳一次；每天漲跌停 ±10%；買進收手續費 0.1425%，賣出再加證交稅 0.3%。
// 公司、貓咪、新聞全部是虛構的。
(function(){
const CO = {
  MEOW: ["喵晶片", "執行長晶晶", "gray", "做全世界最快的貓咪晶片，逗貓棒 AI 都靠它"],
  PAW:  ["肉球銀行", "行長元寶", "orange", "幫大家保管貓幣的老牌銀行，走勢穩穩的"],
  TOY:  ["逗貓棒娛樂", "社長跳跳", "calico", "逗貓棒、雷射筆、貓咪手遊，什麼紅就做什麼"],
  CAN:  ["罐罐食品", "廠長阿肥", "white", "每天出貨一百萬個罐罐，景氣再差貓也要吃飯"],
  FISH: ["小魚乾航運", "船長浪浪", "black", "把小魚乾運到世界各地，看天氣吃飯"],
  SAND: ["貓砂科技", "所長砂砂", "gray", "研發不會飛出來的貓砂，默默賺錢"],
  NAP:  ["午睡紙箱", "店長呼嚕", "orange", "專做最好睡的紙箱，訂單忽多忽少"],
  NIP:  ["貓草生技", "博士草草", "calico", "研究新品種貓草，股價像雲霄飛車"],
};
const SYMS = Object.keys(CO);
const GOOD = [
  (n, c) => `${n}新產品大賣，門市被貓咪擠爆`,
  (n, c) => `${c}宣布：今年每位股東加發小魚乾`,
  (n, c) => `${n}接到超大訂單，工廠連夜加班`,
  (n, c) => `${n}上季賺翻了，獲利比預期多一倍`,
  (n, c) => `知名網紅貓推薦${n}，粉絲搶著買`,
  (n, c) => `${n}宣布和隔壁大廠合作，前景看好`,
];
const BAD = [
  (n, c) => `${c}被拍到深夜和隔壁的貓散步，投資人嚇壞了`,
  (n, c) => `${n}工廠被一群貓佔領當睡床，停工一天`,
  (n, c) => `${n}新產品被嫌難用，退貨排到街尾`,
  (n, c) => `${c}開會開到一半睡著，直播全被看光`,
  (n, c) => `${n}倉庫打翻一整櫃貨，損失慘重`,
  (n, c) => `${n}上季獲利不如預期，法人喊賣`,
];
const num = (v, d) => { v = Number(v); return Number.isFinite(v) ? v : (d || 0); };
const f2 = v => num(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const f0 = v => Math.round(num(v)).toLocaleString("en-US");
const START = 10000;

App.registerGame({
  id: "stock",
  solo: true,
  name: "貓貓股市",
  desc: "低買高賣，看誰最會賺！早盤、夜盤每分鐘跳一次",
  icon: () => `<svg viewBox="0 0 16 16" shape-rendering="crispEdges" style="width:100%"><rect width="16" height="16" fill="#fff8ec"/><path d="M1 12h2v-3h2v2h2v-5h2v3h2v-6h2v9" fill="none" stroke="#e5484d" stroke-width="1.6"/><rect x="0" y="14" width="16" height="1.4" fill="#5a3b2e"/></svg>`,
  mount(el, ctx){
    const { esc, SFX } = ctx;
    let S = null, REC = { counts: {}, mine: [], ok: false }, alive = true, tab = "mkt", timer = 0, err = "", busy = false, detail = null;
    const me = () => ctx.me.uid;
    const cat = (c, mood) => `<span class="skCat">${ctx.sprite(c || "orange", mood || "normal")}</span>`;
    const px = s => num(S.px[s]), ref = s => num(S.ref[s], px(s));
    const chg = s => { const r = ref(s); return r ? (px(s) - r)/r*100 : 0; };
    const lim = s => { const r = ref(s); return px(s) >= Math.floor(r*110)/100 - .005 ? 1 : px(s) <= Math.ceil(r*90)/100 + .005 ? -1 : 0; };
    const cls = v => v > 0.004 ? "up" : v < -0.004 ? "dn" : "";
    const sign = v => (v > 0 ? "+" : "") + v.toFixed(2);
    const hold = s => { const h = S.hold && S.hold[s]; return h ? { q: Math.max(0, Math.floor(num(h.q))), c: num(h.c) } : { q: 0, c: 0 }; };
    const buyFee = amt => Math.max(Math.ceil(amt*0.1425 - 1e-9)/100, 0.01);
    const sellFee = amt => buyFee(amt) + Math.ceil(amt*0.3 - 1e-9)/100;

    // 整理伺服器給的資料（只留認得的欄位、數字一定是數字）
    function clean(r){
      if(!r || typeof r !== "object" || !r.px) return null;
      const o = { t: num(r.t), px: {}, ref: {}, cash: num(r.cash), hold: {}, assets: num(r.assets), bail: num(r.bail), can_bail: !!r.can_bail, rank: num(r.rank), players: num(r.players), open: r.open !== false, next: num(r.next) };
      for(const s of SYMS){ o.px[s] = num(r.px[s], 1); o.ref[s] = num(r.ref && r.ref[s], o.px[s]); if(r.hold && r.hold[s]) o.hold[s] = { q: num(r.hold[s].q), c: num(r.hold[s].c) }; }
      o.spark = (Array.isArray(r.spark) ? r.spark : []).slice(-40).map(x => { const m = {}; for(const s of SYMS) m[s] = num(x && x[s]); return m; });
      o.news = (Array.isArray(r.news) ? r.news : []).slice(0, 20).filter(n => n && CO[n.sym]).map(n => ({ t: num(n.t), sym: n.sym, good: !!n.good, k: Math.abs(Math.floor(num(n.k))) % 6, pct: num(n.pct) }));
      o.trades = (Array.isArray(r.trades) ? r.trades : []).slice(0, 30).filter(x => x && CO[x.sym]).map(x => ({ at: num(x.at), sym: x.sym, qty: Math.trunc(num(x.qty)), price: num(x.price), fee: num(x.fee) }));
      o.top = (Array.isArray(r.top) ? r.top : []).slice(0, 10).map(x => ({ name: String(x && x.name || "").slice(0, 3), cat: String(x && x.cat || "orange").replace(/[^a-z]/g, "").slice(0, 12), assets: num(x && x.assets), me: !!(x && x.me) }));
      o.nest = (Array.isArray(r.nest) ? r.nest : []).slice(0, 2).map(x => ({ uid: String(x && x.uid || ""), assets: num(x && x.assets) }));
      return o;
    }
    async function loadRec(){ try{ const r = await ctx.rpc("stock_recs"); const o = { counts: {}, mine: [], ok: true };
        for(const s of SYMS) o.counts[s] = Math.max(0, Math.floor(num(r && r.counts && r.counts[s]))); o.mine = (Array.isArray(r && r.mine) ? r.mine : []).filter(x => CO[x]).slice(0, 3); REC = o; }catch(e){} }
    const recN = s => REC.counts[s] || 0;
    // ---------- 新手教學 ----------
    const TUT = [
      ["股票是什麼？", "買一家公司的股票，就像當它的小股東。公司變值錢，你手上的股票也跟著變貴。這裡的 8 家貓咪公司都是虛構的，錢也是遊戲用的，放心玩！"],
      ["怎麼賺錢？", "口訣只有四個字：<b>低買高賣</b>。便宜的時候買進，等它漲了再賣出，中間的價差就是你賺的。反過來，買貴了又賣便宜就會虧。"],
      ["紅色、綠色是什麼？", "<b class='up'>紅色是漲</b>、<b class='dn'>綠色是跌</b>（跟台灣的股市一樣）。旁邊的百分比是跟昨天比漲跌多少。一天最多漲 10%（漲停）或跌 10%（跌停）。"],
      ["什麼時候可以玩？", "跟真的股市一樣有開盤時間（台灣時間，每天都開）：<b>早盤 9:00～13:30</b>、<b>夜盤 19:00～23:00</b>。開盤時價格每分鐘跳一次；休市時價格不會動，也不能買賣。"],
      ["怎麼買賣？", "在「行情」點一家公司，選「買進」或「賣出」，填要幾股，按下去就成交。每次買賣會收一點點手續費，所以不要買了馬上賣，會白白虧手續費喔。"],
      ["怎麼看那張圖？", "圖上一根一根的叫 K 線：<b class='up'>紅色</b>代表那段時間漲了，<b class='dn'>綠色</b>代表跌了，越長代表漲跌越多。整體往右上走就是在漲。"],
      ["新聞和推薦", "「新聞」會有好消息、壞消息，股價會跟著動。每檔股票旁邊看得到<b>全站有幾個人推薦</b>，你也可以推薦最多 3 檔給大家參考（不會顯示是誰推薦的）。"],
      ["小提醒", "不要把錢全押在同一家，分散一點比較安全。萬一賠到剩不到 1,000，每天可以領一次救濟金重新來過。祝你變成股神喵！"],
    ];
    function tutorial(){
      document.querySelectorAll(".skTut").forEach(x => x.remove()); let i = 0;
      const o = document.createElement("div"); o.className = "careModal skTut"; document.body.appendChild(o);
      const draw = () => { o.innerHTML = `<div class="cmBox skBox"><div class="skTutH">${cat("gray", "happy")}<div><small>新手教學 ${i + 1} / ${TUT.length}</small><b>${TUT[i][0]}</b></div></div><p class="skTutP">${TUT[i][1]}</p>
          <div class="skDots">${TUT.map((_, k) => `<i class="${k === i ? "on" : ""}"></i>`).join("")}</div>
          <div class="skTutB">${i ? `<button class="btn sub" data-a="p">上一頁</button>` : `<button class="btn sub" data-a="x">跳過</button>`}<button class="btn" data-a="n">${i === TUT.length - 1 ? "開始玩！" : "下一頁"}</button></div></div>`;
        o.querySelectorAll("button").forEach(b => b.addEventListener("click", () => { const a = b.dataset.a; SFX.tap(); if(a === "x" || (a === "n" && i === TUT.length - 1)){ try{ localStorage.setItem("sk_tut", "1"); }catch(e){} o.remove(); return; } i += a === "n" ? 1 : -1; draw(); })); };
      draw();
    }
    function receipt(sym, side, q, r){
      document.querySelectorAll(".skRcp").forEach(x => x.remove());
      const buy = side === "buy", amt = num(r.price) * q, fee = num(r.fee), tot = buy ? amt + fee : amt - fee;
      const o = document.createElement("div"); o.className = "careModal skTut skRcp"; document.body.appendChild(o);
      o.innerHTML = `<div class="cmBox skBox"><div class="skTutH">${cat("gray", "happy")}<div><small>成交回報</small><b class="${buy ? "up" : "dn"}">${buy ? "買進成功！" : "賣出成功！"}</b></div></div>
        <div class="skRcpT"><span>股票</span><b>${esc(CO[sym][0])}</b><span>股數</span><b>${f0(q)} 股</b><span>成交價</span><b>${f2(r.price)}</b><span>${buy ? "手續費" : "手續費＋交易稅"}</span><b>${f2(fee)}</b>
        <span class="tot">${buy ? "總共花了" : "總共拿回"}</span><b class="tot">${f2(tot)}</b><span>剩下現金</span><b>${f2(r.cash)}</b><span>現在持有</span><b>${f0(r.hold && r.hold[sym] ? r.hold[sym].q : 0)} 股</b></div>
        <button class="btn" style="width:100%">知道了</button></div>`;
      const close = () => o.remove(); o.querySelector("button").addEventListener("click", () => { SFX.tap(); close(); });
      o.addEventListener("click", e => { if(e.target === o) close(); });
    }
    async function load(silent){
      try{ const [r0] = await Promise.all([ctx.rpc("stock_status"), loadRec()]); const r = clean(r0); if(!alive) return; if(!r) throw new Error("bad"); const first = !S; if(first){ let seen = false; try{ seen = !!localStorage.getItem("sk_tut"); }catch(e){} if(!seen) setTimeout(() => { if(alive) tutorial(); }, 400); } const oldNews = S && S.news[0] ? S.news[0].t : 0; S = r; err = "";
        if(!first && S.news[0] && S.news[0].t > oldNews){ const n = S.news[0], c = CO[n.sym]; ctx.toast(`快訊：${esc((n.good ? GOOD : BAD)[n.k](c[0], c[1]))}`, 3500); SFX.key(n.good ? 1.3 : .7); }
        render(); if(detail) detail.refresh(); }
      catch(e){ if(!alive) return; const m = String(e && e.message || e);
        err = /stock_status|function|no_rpc|404|schema/i.test(m) ? "股市還沒開張：資料庫還沒加上股市的設定" : /no_couple/.test(m) ? "要先有小窩才能開戶喔" : "連不上交易所，等一下會自動再試";
        if(!S) render(); else if(!silent) ctx.toast(err); }
    }
    // 每分鐘行情跳一次：整分過 3 秒去拿新的
    function schedule(){ clearTimeout(timer); const ms = 60000 - (Date.now() % 60000) + 3000; timer = setTimeout(async () => { if(!alive) return; if(document.visibilityState === "visible") await load(true); schedule(); }, ms); }
    const onVis = () => { if(alive && document.visibilityState === "visible") load(true); };
    document.addEventListener("visibilitychange", onVis);

    const spark = s => { const pts = S.spark.map(x => x[s]).filter(v => v > 0); if(pts.length < 2) return ""; const lo = Math.min(...pts), hi = Math.max(...pts), sp = (hi - lo) || 1;
      return `<svg class="skSpark ${cls(chg(s))}" viewBox="0 0 60 22" preserveAspectRatio="none"><polyline fill="none" stroke-width="1.6" points="${pts.map((v, i) => `${(i/(pts.length - 1)*60).toFixed(1)},${(20 - (v - lo)/sp*18).toFixed(1)}`).join(" ")}"/></svg>`; };
    const badge = s => { const l = lim(s); return l > 0 ? `<i class="skLim up">漲停</i>` : l < 0 ? `<i class="skLim dn">跌停</i>` : ""; };
    const pnl = () => S.assets - START - S.bail*2000;
    const newsLine = n => { const c = CO[n.sym]; return `<div class="skNews ${n.good ? "up" : "dn"}"><em>${new Date(n.t*60000).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", hour12: false })}</em><div><b>${c[0]}</b> ${esc((n.good ? GOOD : BAD)[n.k](c[0], c[1]))}<span>${sign(n.pct)}%</span></div></div>`; };

    const hm = t => { const d = new Date((t + 8 * 3600) * 1000); return d.getUTCHours() + ":" + String(d.getUTCMinutes()).padStart(2, "0"); };
    const nextTxt = () => { if(!S || !S.next) return ""; const tw = t => Math.floor((t + 8 * 3600) / 86400); return (tw(S.next) > tw(Date.now() / 1000) ? "明天 " : "") + hm(S.next); };
    const HOURS = "早盤 9:00～13:30・夜盤 19:00～23:00";
    function render(){
      if(!alive) return;
      if(!S){ el.innerHTML = `<div class="box skBox"><div class="skHead"><b>貓貓股市</b></div><p class="skMsg">${err ? esc(err) : "交易所連線中…"}</p>${err ? `<button class="btn sub" id="skRetry">再試一次</button>` : ""}</div>`;
        const r = el.querySelector("#skRetry"); if(r) r.addEventListener("click", () => { err = ""; render(); load(); }); return; }
      const p = pnl();
      let body = "";
      if(tab === "mkt") body = `<div class="skList">${SYMS.map(s => { const c = CO[s], h = hold(s), d = chg(s);
          return `<button class="skRow" data-s="${s}">${cat(c[2])}<span class="skNm"><b>${c[0]}</b><small>${s}${recN(s) ? `・<u class="skRec">${f0(recN(s))} 人推薦</u>` : ""}${h.q ? `・持有 ${f0(h.q)} 股` : ""}</small></span>${spark(s)}<span class="skPx ${cls(d)}"><b>${f2(px(s))}</b><small>${d > 0.004 ? "▲" : d < -0.004 ? "▼" : ""}${Math.abs(d).toFixed(2)}%${badge(s)}</small></span></button>`; }).join("")}</div>
        <div class="skFoot">紅色是漲、綠色是跌・漲跌停 ±10%<br>${HOURS}（每天都開）</div>`;
      if(tab === "hold"){ const hs = SYMS.filter(s => hold(s).q > 0);
        body = `${hs.length ? `<div class="skList">${hs.map(s => { const h = hold(s), v = h.q*px(s), g = v - h.c;
            return `<button class="skRow" data-s="${s}">${cat(CO[s][2])}<span class="skNm"><b>${CO[s][0]}</b><small>${f0(h.q)} 股・均價 ${f2(h.c/h.q)}</small></span><span class="skPx ${cls(g)}"><b>${f2(v)}</b><small>${sign(g)}（${sign(h.c ? g/h.c*100 : 0)}%）</small></span></button>`; }).join("")}</div>` : `<p class="skMsg">還沒有持股，去「行情」挑一檔吧！</p>`}
          <div class="skSub">交易紀錄</div>${S.trades.length ? `<div class="skLog">${S.trades.map(x => `<div class="${x.qty > 0 ? "up" : "dn"}"><em>${new Date(x.at*1000).toLocaleString("zh-TW", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })}</em><b>${x.qty > 0 ? "買" : "賣"}</b><span>${CO[x.sym][0]} ${f0(Math.abs(x.qty))} 股 @ ${f2(x.price)}</span><i>費 ${f2(x.fee)}</i></div>`).join("")}</div>` : `<p class="skMsg small">還沒有交易</p>`}`; }
      if(tab === "news") body = S.news.length ? `<div class="skFeed">${S.news.map(newsLine).join("")}</div>` : `<p class="skMsg">目前風平浪靜，沒有新聞</p>`;
      if(tab === "rank"){ const pt = ctx.partner(), ta = pt && S.nest.find(x => x.uid === pt.user_id);
        body = `<div class="skMe">你在全站排第 <b>${S.rank}</b> 名<small>／${Math.max(S.players, S.rank)} 位有下過單的股民</small></div>
          ${pt ? `<div class="skVs"><div>${cat(ctx.me.cat, "happy")}<b>你</b><span>${f0(S.assets)}</span></div><i>VS</i><div>${cat(pt.cat, "happy")}<b>${esc(pt.name)}</b><span>${ta ? f0(ta.assets) : "還沒開戶"}</span></div></div>` : ""}
          ${REC.ok ? `<div class="skSub">大家推薦（每人最多推薦 3 檔，不會顯示是誰）</div><div class="skRecs">${SYMS.slice().sort((a, b) => recN(b) - recN(a)).map(s => { const mx = Math.max(1, ...SYMS.map(recN)); return `<button class="skRow skRecRow" data-s="${s}"><b>${CO[s][0]}${REC.mine.includes(s) ? `<i>你推薦</i>` : ""}</b><span><i style="width:${Math.round(recN(s)/mx*100)}%"></i></span><em>${f0(recN(s))} 人</em></button>`; }).join("")}</div>` : ""}
          <div class="skSub">全站前 10 名（名字只顯示第一個字）</div><div class="skTop">${S.top.length ? S.top.map((x, i) => `<div class="${x.me ? "me" : ""}"><em>${i + 1}</em>${cat(x.cat)}<b>${esc(x.name)}${x.me ? "（你）" : ""}</b><span>${f0(x.assets)}</span></div>`).join("") : `<p class="skMsg small">還沒有人下單，快去當第一名！</p>`}</div>`; }
      el.innerHTML = `<div class="box skBox">
        <div class="skHead"><b>貓貓股市</b><button class="skHelp" id="skHelp">？新手教學</button><span class="skLive ${S.open ? "" : "off"}"><i></i>${S.open ? "開盤中" : "休市中"}</span></div>${S.open ? "" : `<div class="skClosed"><b>現在休市中，${nextTxt()} 開盤</b><small>${HOURS}<br>休市時價格不會動，也不能買賣，可以先研究要買哪一檔</small></div>`}
        <div class="skAcct"><div><small>總資產</small><b>${f2(S.assets)}</b></div><div><small>現金</small><b>${f2(S.cash)}</b></div><div class="${cls(p)}"><small>總損益</small><b>${sign(p)}</b></div></div>
        ${S.can_bail ? `<button class="btn skBail" id="skBail">資產不到 1,000…領今天的救濟金 2,000</button>` : ""}
        <div class="skTabs">${[["mkt", "行情"], ["hold", "持股"], ["news", "新聞"], ["rank", "排行"]].map(([k, n]) => `<button data-t="${k}" class="${tab === k ? "on" : ""}">${n}</button>`).join("")}</div>
        ${body}</div>`;
      el.querySelectorAll(".skTabs button").forEach(b => b.addEventListener("click", () => { tab = b.dataset.t; SFX.tap(); render(); }));
      el.querySelectorAll(".skRow").forEach(b => b.addEventListener("click", () => openDetail(b.dataset.s)));
      el.querySelector("#skHelp").addEventListener("click", () => { SFX.tap(); tutorial(); });
      const bl = el.querySelector("#skBail"); if(bl) bl.addEventListener("click", async () => { bl.disabled = true; try{ const r = await ctx.rpc("stock_bailout"); if(r && r.ok){ SFX.coin ? SFX.coin() : SFX.select(); ctx.toast("領到救濟金 2,000，東山再起！"); } }catch(e){} load(); });
    }

    // ---------- 個股：K 線＋下單 ----------
    function openDetail(s){
      if(!CO[s]) return; SFX.tap();
      document.querySelectorAll(".skDet").forEach(x => x.remove());
      const o = document.createElement("div"); o.className = "careModal skDet"; let range = "3h", candles = null, qty = 1, side = "buy";
      o.innerHTML = `<div class="cmBox skBox"><div id="skD"></div></div>`; document.body.appendChild(o);
      const box = o.querySelector("#skD");
      const maxBuy = () => { let q = Math.floor(S.cash/(px(s)*1.001425)); while(q > 0 && q*px(s) + buyFee(q*px(s)) > S.cash + 1e-6) q--; return Math.max(0, q); };
      const chart = () => { if(!candles) return `<div class="skChart load">讀取走勢中…</div>`; if(candles.length < 2) return `<div class="skChart load">剛開盤，資料還不夠畫圖</div>`;
        const W = 320, H = 150, lo = Math.min(...candles.map(c => c[3])), hi = Math.max(...candles.map(c => c[2])), sp = (hi - lo) || 1, y = v => (8 + (hi - v)/sp*(H - 16)).toFixed(1), w = W/candles.length;
        return `<svg class="skChart" viewBox="0 0 ${W} ${H}"><text x="2" y="10" class="ax">${f2(hi)}</text><text x="2" y="${H - 2}" class="ax">${f2(lo)}</text>${[.25, .5, .75].map(k => `<line x1="0" x2="${W}" y1="${H*k}" y2="${H*k}" class="grid"/>`).join("")}
          ${candles.map((c, i) => { const up = c[4] >= c[1], x = i*w + w/2, top = Math.min(+y(c[1]), +y(c[4])), bh = Math.max(1.2, Math.abs(+y(c[1]) - +y(c[4])));
            return `<g class="${up ? "up" : "dn"}"><line x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${y(c[2])}" y2="${y(c[3])}"/><rect x="${(x - w*.32).toFixed(1)}" y="${top.toFixed(1)}" width="${(w*.64).toFixed(1)}" height="${bh.toFixed(1)}"/></g>`; }).join("")}</svg>`; };
      async function loadH(){ candles = null; draw(); try{ const r = await ctx.rpc("stock_history", { p_sym: s, p_range: range }); candles = (Array.isArray(r) ? r : []).slice(-60).map(c => [num(c[0]), num(c[1]), num(c[2]), num(c[3]), num(c[4])]).filter(c => c[3] > 0); }catch(e){ candles = []; } draw(); }
      function draw(){
        if(!o.isConnected) return; const c = CO[s], d = chg(s), h = hold(s), mb = maxBuy(), max = side === "buy" ? mb : h.q;
        qty = Math.max(1, Math.min(Math.floor(qty) || 1, Math.max(1, max)));
        const amt = qty*px(s), fee = side === "buy" ? buyFee(amt) : sellFee(amt), ok = max >= 1 && qty <= max, g = h.q ? h.q*px(s) - h.c : 0;
        box.innerHTML = `<div class="skDH">${cat(c[2], d >= 0 ? "happy" : "normal")}<div><b>${c[0]} <small>${s}</small></b><small>${c[1]}・${c[3]}</small></div></div>
          <div class="skBig ${cls(d)}"><b>${f2(px(s))}</b><span>${sign(px(s) - ref(s))}（${sign(d)}%）${badge(s)}</span></div>
          <div class="skTabs sm">${[["3h", "3 小時"], ["12h", "1 天"], ["2d", "3 天"]].map(([k, n]) => `<button data-r="${k}" class="${range === k ? "on" : ""}">${n}</button>`).join("")}</div>
          ${chart()}
          <div class="skStat"><span>昨收 <b>${f2(ref(s))}</b></span><span>漲停 <b class="up">${f2(Math.floor(ref(s)*110)/100)}</b></span><span>跌停 <b class="dn">${f2(Math.ceil(ref(s)*90)/100)}</b></span></div>
          ${h.q ? `<div class="skMine">你有 <b>${f0(h.q)}</b> 股・均價 ${f2(h.c/h.q)}・損益 <b class="${cls(g)}">${sign(g)}</b></div>` : ""}
          ${REC.ok ? `<button class="skRecB ${REC.mine.includes(s) ? "on" : ""}" id="skRecB">${REC.mine.includes(s) ? `你推薦了這檔（再按一次取消）` : `推薦這檔給大家`}<small>目前 ${f0(recN(s))} 人推薦・你已推薦 ${REC.mine.length} / 3 檔</small></button>` : ""}
          <div class="skSide"><button data-sd="buy" class="${side === "buy" ? "on up" : ""}">買進</button><button data-sd="sell" class="${side === "sell" ? "on dn" : ""}">賣出</button></div>
          <div class="skQty"><button data-q="-10">-10</button><button data-q="-1">-1</button><input id="skQ" inputmode="numeric" value="${qty}"><button data-q="1">+1</button><button data-q="10">+10</button></div>
          <div class="skQuick"><button data-m=".25">1/4</button><button data-m=".5">一半</button><button data-m="1">${side === "buy" ? "買到滿" : "全部賣"}</button><span>${side === "buy" ? `最多可買 ${f0(mb)} 股` : `可賣 ${f0(h.q)} 股`}</span></div>
          <div class="skCalc"><span>成交金額 <b>${f2(amt)}</b></span><span>${side === "buy" ? "手續費" : "手續費＋證交稅"} <b>${f2(fee)}</b></span><span>${side === "buy" ? "總共付出" : "實際拿回"} <b>${f2(side === "buy" ? amt + fee : amt - fee)}</b></span></div>
          <button class="btn skGo ${side}" id="skGo" ${ok && !busy && S.open ? "" : "disabled"}>${!S.open ? `休市中，${nextTxt()} 開盤` : max < 1 ? (side === "buy" ? "現金不夠買 1 股" : "沒有持股可以賣") : `${side === "buy" ? "買進" : "賣出"} ${f0(qty)} 股`}</button>
          <div class="skFoot">以送出當下的市價成交，價格可能和畫面上差一點點</div>
          <button class="btn sub" id="skX" style="width:100%">關閉</button>`;
        box.querySelectorAll("[data-r]").forEach(b => b.addEventListener("click", () => { range = b.dataset.r; SFX.tap(); loadH(); }));
        box.querySelectorAll("[data-sd]").forEach(b => b.addEventListener("click", () => { side = b.dataset.sd; qty = 1; SFX.tap(); draw(); }));
        box.querySelectorAll("[data-q]").forEach(b => b.addEventListener("click", () => { qty += +b.dataset.q; SFX.tap(); draw(); }));
        box.querySelectorAll("[data-m]").forEach(b => b.addEventListener("click", () => { qty = Math.max(1, Math.floor(max*(+b.dataset.m))); SFX.tap(); draw(); }));
        const inp = box.querySelector("#skQ"); inp.addEventListener("change", () => { qty = parseInt(inp.value.replace(/\D/g, ""), 10) || 1; draw(); });
        box.querySelector("#skX").addEventListener("click", () => { o.remove(); detail = null; });
        box.querySelector("#skGo").addEventListener("click", trade);
        const rb = box.querySelector("#skRecB"); if(rb) rb.addEventListener("click", async () => { rb.disabled = true;
          try{ const r = await ctx.rpc("stock_recommend", { p_sym: s }); if(r && r.ok){ SFX.select(); ctx.toast(r.on ? `已推薦 ${CO[s][0]}！` : `取消推薦 ${CO[s][0]}`); }
            else ctx.toast(r && r.reason === "max" ? "最多只能推薦 3 檔，先取消一檔再推薦" : r && r.reason === "too_fast" ? "按太快了，等 1 秒再試" : "沒有成功，再試一次"); }catch(e){ ctx.toast("連不上交易所，再試一次"); }
          await loadRec(); render(); draw(); });
      }
      async function trade(){
        if(busy) return; busy = true; draw();
        try{ const r = await ctx.rpc("stock_trade", { p_sym: s, p_qty: side === "buy" ? qty : -qty });
          if(r && r.ok){ SFX.coin ? SFX.coin() : SFX.select(); receipt(s, side, qty, r); if(ctx.burst) ctx.burst(); qty = 1; }
          else ctx.toast(r && r.reason === "closed" ? "現在休市中，開盤後才能買賣" : r && r.reason === "too_fast" ? "下單太快了，等 2 秒再試" : r && r.reason === "cash" ? "現金不夠（價格可能剛剛變了）" : r && r.reason === "shares" ? "持股不夠賣" : "沒有成交，再試一次"); }
        catch(e){ ctx.toast("連不上交易所，這筆沒有成交"); }
        busy = false; await load(true); draw();
      }
      detail = { refresh: () => { draw(); if(candles && S.t % (range === "3h" ? 5 : 20) === 0) loadH(); } };
      draw(); loadH();
    }

    render(); load().then(schedule);
    this._stop = () => { alive = false; clearTimeout(timer); document.removeEventListener("visibilitychange", onVis); document.querySelectorAll(".skDet,.skTut").forEach(x => x.remove()); };
  },
  unmount(){ if(this._stop) this._stop(); },
});
if(window.GameArt) window.GameArt.stock = () => `<span class="gaL" style="left:6%;top:8%;width:88%"><svg viewBox="0 0 44 22" style="width:100%"><rect width="44" height="22" fill="#fff" stroke="#5a3b2e" stroke-width="1.2"/><path d="M3 17l5-4 4 2 5-7 4 3 5-6 4 4 5-6 5 3" fill="none" stroke="#e5484d" stroke-width="1.6"/></svg></span><span class="gaL" style="right:2%;bottom:0;width:36%">${Pix.sprite("gray", "happy")}</span>`;
})();

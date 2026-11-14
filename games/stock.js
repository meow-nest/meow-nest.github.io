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
  CLAW: ["利爪半導體", "董事長尖尖", "black", "喵晶片的死對頭，晶片便宜又大碗，天天搶訂單"],
  TREE: ["貓跳台建設", "董座高高", "white", "蓋全城最高的貓跳台大樓，一蓋就是好幾年"],
  COIN: ["貓幣信託", "總裁金金", "calico", "新開的網路銀行，利息比肉球銀行高一點點"],
  TUNA: ["鮪魚王食品", "老闆阿鮪", "gray", "主打高級鮪魚罐，和罐罐食品搶貓咪的胃"],
  LASR: ["紅點點遊戲", "製作人閃閃", "orange", "只做雷射紅點遊戲，一款紅了就大賺"],
  YARN: ["毛線球紡織", "廠長捲捲", "white", "老字號毛線球工廠，冬天生意特別好"],
  SUN:  ["曬太陽能源", "站長暖暖", "orange", "出租窗邊曬太陽的位子，陰天就沒收入"],
  MILK: ["奶泡咖啡", "店長拿鐵", "black", "貓咪咖啡廳連鎖店，展店超快但還在燒錢"],
};
const ALL = Object.keys(CO); let SYMS = ALL.slice(0, 8);
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
// 成就徽章：[名稱, 條件, 徽章上的字, 顏色]
const BADGES = {
  first: ["初次下單", "完成第一筆交易", "初", "#f0889c"], profit: ["第一桶金", "第一次賣出有賺", "賺", "#e5484d"],
  hold3: ["長期股東", "同一檔抱超過 3 天（市值 500 以上）", "抱", "#7cc98a"], div5: ["分散投資", "同時持有 5 家公司（每家市值 500 以上）", "五", "#7ab8f0"],
  div10: ["貓咪基金", "同時持有 10 家公司（每家市值 500 以上）", "十", "#5b8def"], a12k: ["小有收穫", "總資產突破 12,000", "升", "#f6a65a"],
  a20k: ["資產翻倍", "總資產突破 20,000", "倍", "#f0b429"], a50k: ["貓界股神", "總資產突破 50,000", "神", "#d99a1e"],
  limitup: ["漲停板", "手上的股票漲停", "漲", "#e5484d"], comeback: ["東山再起", "領過救濟金後回到 10,000", "回", "#2f9e6b"],
  t50: ["交易達人", "累積交易 50 次", "勤", "#a78bda"], w10: ["本週飆股手", "一週內資產成長 10%", "週", "#f0708d"],
  duo: ["小窩同心", "小窩兩個人都下過單", "雙", "#f0889c"], story1: ["聽故事的貓", "解鎖第一篇股東故事", "書", "#b98a5e"],
  story8: ["故事收藏家", "解鎖 8 篇股東故事", "藏", "#8a6a4a"],
};
// 徽章外框：銅、銀、金（[外圈, 內圈, 亮光]）
const MTIER = [["#e2a36a", "#c47f42", "#ffd9b0"], ["#dfe5ec", "#a9b4c0", "#ffffff"], ["#f8d35e", "#d9a52b", "#fff5c2"]];
const BTIER = { first: 0, profit: 0, a12k: 0, story1: 0, duo: 0, div5: 0, hold3: 1, limitup: 1, comeback: 1, t50: 1, w10: 1, div10: 1, a20k: 2, a50k: 2, story8: 2 };
// 徽章中間的圖案（24×24）
const MICON = {
  first: `<path d="M6 3v19" fill="none"/><path d="M6 4h12l-3 4.5 3 4.5H6z" fill="{p}"/><circle cx="6" cy="22" r="1.4" fill="{f}"/>`,
  profit: `<rect x="4" y="16" width="16" height="5" rx="2.5" fill="{a}"/><rect x="5" y="11" width="14" height="5" rx="2.5" fill="{a}"/><rect x="4" y="6" width="16" height="5" rx="2.5" fill="{a}"/><path d="M9 8.5h6" fill="none"/>`,
  hold3: `<path d="M6 3h12M6 21h12" fill="none"/><path d="M7 3c0 5 4 7 4 9s-4 4-4 9h10c0-5-4-7-4-9s4-4 4-9z" fill="{f}"/><path d="M9.5 20.5c0-2 2.5-3 2.5-4.5 0 1.5 2.5 2.5 2.5 4.5z" fill="{a}" stroke-width="1"/>`,
  div5: `<circle cx="12" cy="12" r="9" fill="{f}"/><path d="M12 12V3a9 9 0 0 1 8.6 6.3z" fill="{p}"/><path d="M12 12l-5.3 7.3M12 12l8.6-2.7" fill="none"/>`,
  div10: `<rect x="3" y="3" width="18" height="18" rx="3" fill="{f}"/><rect x="6" y="13" width="3" height="5" fill="{p}" stroke-width="1.1"/><rect x="10.5" y="9" width="3" height="9" fill="{a}" stroke-width="1.1"/><rect x="15" y="6" width="3" height="12" fill="{p}" stroke-width="1.1"/>`,
  a12k: `<path d="M7 16h10l-1.5 6h-7z" fill="{p}"/><path d="M12 16v-6" fill="none"/><path d="M12 11C11 7 7 6 4.5 7c1 3.5 4.5 5 7.5 4zM12 10c1-4 5-5.5 8-4.5-1 3.5-5 5.5-8 4.5z" fill="{f}"/>`,
  a20k: `<path d="M12 2l7 7h-4v3H9V9H5z" fill="{f}"/><path d="M12 11l6 6h-3.5v4h-5v-4H6z" fill="{a}"/>`,
  a50k: `<path d="M3 9l4.5 4 4.5-8 4.5 8L21 9l-2 10H5z" fill="{a}"/><rect x="5" y="19" width="14" height="3" rx="1" fill="{a}"/><circle cx="12" cy="14" r="1.6" fill="{p}" stroke-width="1"/><circle cx="3" cy="9" r="1.3" fill="{f}" stroke-width="1"/><circle cx="21" cy="9" r="1.3" fill="{f}" stroke-width="1"/><circle cx="12" cy="4.5" r="1.3" fill="{f}" stroke-width="1"/>`,
  limitup: `<path d="M9 17c-1-6 0-11 3-15 3 4 4 9 3 15z" fill="{f}"/><path d="M9 13l-3 3v3l3-2zM15 13l3 3v3l-3-2z" fill="{p}"/><circle cx="12" cy="9" r="1.8" fill="{p}" stroke-width="1.1"/><path d="M10 18c0 2 1 3 2 4.5 1-1.5 2-2.5 2-4.5z" fill="{a}"/>`,
  comeback: `<path d="M4 17a8 8 0 0 1 16 0z" fill="{a}"/><path d="M2 17h20M12 3v3M5 6l2 2M19 6l-2 2M2 11h2.5M19.5 11H22" fill="none"/><path d="M12 20.5v-3" fill="none"/><path d="M9.5 19.5L12 22l2.5-2.5" fill="none"/>`,
  t50: `<path d="M13.5 2L5 13.5h6L9.5 22 19 9.5h-6z" fill="{a}"/>`,
  w10: `<rect x="3" y="5" width="18" height="16" rx="2.5" fill="{f}"/><path d="M3 9.5h18" fill="none"/><path d="M3 7.5a2.5 2.5 0 0 1 2.5-2.5h13A2.5 2.5 0 0 1 21 7.5v2H3z" fill="{p}"/><path d="M8 3v4M16 3v4" fill="none"/><path d="M12 11.5l1.2 2.5 2.7.3-2 1.8.6 2.7-2.5-1.4-2.5 1.4.6-2.7-2-1.8 2.7-.3z" fill="{a}" stroke-width="1.1"/>`,
  duo: `<path d="M9 20S2.5 15.5 2.5 10.5A3.6 3.6 0 0 1 9 8.4a3.6 3.6 0 0 1 6.5 2.1C15.5 15.5 9 20 9 20z" fill="{p}"/><path d="M15.5 21s-5-3.3-5-7.2a2.8 2.8 0 0 1 5-1.7 2.8 2.8 0 0 1 5 1.7c0 3.9-5 7.2-5 7.2z" fill="{f}"/>`,
  story1: `<path d="M2.5 6c3.5-1.5 6.5-1 9.5 1.2V21c-3-2.2-6-2.7-9.5-1.2z" fill="{f}"/><path d="M21.5 6c-3.5-1.5-6.5-1-9.5 1.2V21c3-2.2 6-2.7 9.5-1.2z" fill="{f}"/><path d="M5 10c1.8-.5 3.3-.3 4.8.5M5 13.5c1.8-.5 3.3-.3 4.8.5M14.2 10.5c1.5-.8 3-1 4.8-.5" fill="none" stroke-width="1.1"/>`,
  story8: `<rect x="3" y="17" width="18" height="4.5" rx="1" fill="{p}"/><rect x="4.5" y="12.5" width="15" height="4.5" rx="1" fill="{a}"/><rect x="3.5" y="8" width="16" height="4.5" rx="1" fill="{f}"/><path d="M7 3.5h10l-1 4.5H8z" fill="{p}" stroke-width="1.3"/><path d="M6 19.2h4M7.5 14.7h3" fill="none" stroke-width="1.1"/>`,
};
// 公司基本資料（虛構）：[產業, 發行股數（萬股）, 財報日位移, 除息日位移]
const INFO = { MEOW: ["半導體", 26000, 0, 0], PAW: ["金融", 90000, 1, 4], TOY: ["遊戲娛樂", 12000, 2, 8], CAN: ["食品", 30000, 3, 12], FISH: ["航運", 45000, 4, 16], SAND: ["居家科技", 18000, 5, 20], NAP: ["居家用品", 15000, 6, 24], NIP: ["生技", 22000, 0, 2],
  CLAW: ["半導體", 20000, 1, 6], TREE: ["營建", 38000, 2, 10], COIN: ["金融", 60000, 3, 14], TUNA: ["食品", 16000, 4, 18], LASR: ["遊戲娛樂", 9000, 5, 22], YARN: ["紡織", 24000, 6, 26], SUN: ["綠能", 28000, 0, 1], MILK: ["餐飲", 35000, 1, 5] };
// 台股的升降單位
const tk = p => p < 10 ? .01 : p < 50 ? .05 : p < 100 ? .1 : p < 500 ? .5 : p < 1000 ? 1 : 5;
const r2 = v => Math.round(v * 100) / 100;
const rt = p => Math.max(.01, r2(Math.round(p / tk(p)) * tk(p)));
const upL = r => { const x = r * 1.1, t = tk(x); return r2(Math.floor(x / t + 1e-7) * t); };
const dnL = r => { const x = r * .9, t = tk(x); return Math.max(.01, r2(Math.ceil(x / t - 1e-7) * t)); };
const fq = q => { q = Math.round(q); const l = Math.floor(q / 1000), r = q % 1000; return l ? `${l.toLocaleString("en-US")} 張${r ? ` ${r} 股` : ""}` : `${r} 股`; };
const fv = v => { const l = v / 1000; return l >= 10000 ? (l / 10000).toFixed(1) + " 萬張" : l >= 10 ? Math.round(l).toLocaleString("en-US") + " 張" : l.toFixed(1) + " 張"; };
const num = (v, d) => { v = Number(v); return Number.isFinite(v) ? v : (d || 0); };
const f2 = v => num(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const f0 = v => Math.round(num(v)).toLocaleString("en-US");
const START = 10000;

App.registerGame({
  id: "stock",
  solo: true,
  name: "貓貓股市",
  desc: "低買高賣，看誰最會賺！24 小時開盤，每分鐘跳一次",
  icon: () => `<svg viewBox="0 0 16 16" shape-rendering="crispEdges" style="width:100%"><rect width="16" height="16" fill="#fff8ec"/><path d="M1 12h2v-3h2v2h2v-5h2v3h2v-6h2v9" fill="none" stroke="#e5484d" stroke-width="1.6"/><rect x="0" y="14" width="16" height="1.4" fill="#5a3b2e"/></svg>`,
  mount(el, ctx){
    const { esc, SFX } = ctx;
    let S = null, REC = { counts: {}, mine: [], ok: false }, alive = true, tab = "mkt", rk = "all", onlyW = false, timer = 0, err = "", busy = false, detail = null;
    const me = () => ctx.me.uid;
    const cat = (c, mood) => `<span class="skCat">${ctx.sprite(c || "orange", mood || "normal")}</span>`;
    const px = s => num(S.px[s]), ref = s => num(S.ref[s], px(s));
    const chg = s => { const r = ref(s); return r ? (px(s) - r)/r*100 : 0; };
    const upP = s => S.pro ? upL(ref(s)) : Math.floor(ref(s)*110)/100, dnP = s => S.pro ? dnL(ref(s)) : Math.ceil(ref(s)*90)/100;
    const lim = s => px(s) >= upP(s) - .005 ? 1 : px(s) <= dnP(s) + .005 ? -1 : 0;
    const cls = v => v > 0.004 ? "up" : v < -0.004 ? "dn" : "";
    const sign = v => (v > 0 ? "+" : "") + v.toFixed(2);
    const hold = s => { const h = S.hold && S.hold[s]; return h ? { q: Math.max(0, Math.floor(num(h.q))), c: num(h.c), s: num(h.s) } : { q: 0, c: 0, s: 0 }; };
    const medal = (id, on) => { const b = BADGES[id], T = MTIER[BTIER[id] || 0], ink = "#5a3b2e";
      const col = on ? b[3] : "#e3d9cf", dk = on ? "rgba(0,0,0,.16)" : "rgba(90,59,46,.08)", rim = on ? T : ["#d8cfc6", "#b9aca0", "#ece5de"];
      const pts = Array.from({ length: 32 }, (_, k) => { const a = k / 32 * Math.PI * 2 - Math.PI / 2, r = k % 2 ? 23.2 : 25.4; return (32 + r * Math.cos(a)).toFixed(2) + "," + (48 + r * Math.sin(a)).toFixed(2); }).join(" ");
      const icon = (MICON[id] || "").replace(/\{f\}/g, on ? "#fff" : "#cbbfb3").replace(/\{a\}/g, on ? "#ffd36b" : "#d6ccc2").replace(/\{p\}/g, on ? "#f7a8b8" : "#d6ccc2").replace(/\{s\}/g, on ? ink : "#b9aca0");
      return `<svg class="skMedal ${on ? "" : "off"}" viewBox="0 0 64 78"><path d="M17 2h12l7 22H24z" fill="${on ? "#f08aa0" : "#d8cfc6"}" stroke="${ink}" stroke-width="2.2" stroke-linejoin="round"/><path d="M47 2H35l-7 22h12z" fill="${on ? "#e0557a" : "#c9bdb2"}" stroke="${ink}" stroke-width="2.2" stroke-linejoin="round"/><path d="M21.5 2l6 20M42.5 2l-6 20" stroke="${on ? "#fff" : "#ece5de"}" stroke-width="2" opacity=".7"/>
        <polygon points="${pts}" fill="${rim[0]}" stroke="${ink}" stroke-width="2.4" stroke-linejoin="round"/><circle cx="32" cy="48" r="20.5" fill="${rim[1]}"/><circle cx="32" cy="48" r="18.5" fill="${col}" stroke="${ink}" stroke-width="1.6"/>
        <path d="M13.6 50a18.5 18.5 0 0 0 36.8 0z" fill="${dk}"/><circle cx="32" cy="48" r="15" fill="none" stroke="#fff" stroke-width="1.1" stroke-dasharray="2 2.4" opacity="${on ? .6 : .5}"/>
        ${on ? `<path d="M19 40a15 15 0 0 1 9-8" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".75"/><path d="M10.5 37.5a23 23 0 0 1 5-7" fill="none" stroke="${rim[2]}" stroke-width="2" stroke-linecap="round"/>` : ""}
        <g transform="translate(17.6 33.6) scale(1.2)" stroke="${on ? ink : "#b9aca0"}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round">${icon}</g>
        ${on && BTIER[id] === 2 ? `<path d="M55 30l1.4 3.6L60 35l-3.6 1.4L55 40l-1.4-3.6L50 35l3.6-1.4z M9 58l1 2.6 2.6 1-2.6 1L9 65l-1-2.4-2.6-1 2.6-1z" fill="#fff6c9" stroke="${ink}" stroke-width="1.1"/>` : ""}
        ${on ? "" : `<g transform="translate(43 59)"><rect x="0" y="5" width="12" height="9" rx="1.5" fill="#cbbfb3" stroke="${ink}" stroke-width="1.6"/><path d="M2.5 5V3.5a3.5 3.5 0 0 1 7 0V5" fill="none" stroke="${ink}" stroke-width="1.6"/></g>`}</svg>`; };
    const stLv = s => Math.min(2, Math.max(0, Math.floor(num(S.stories && S.stories[s]))));
    const stWait = (s, lv, short) => { const h = hold(s); if(!h.q || !h.s) return ""; if(h.q * px(s) < 500) return short ? "市值未滿 500" : `市值滿 500 後再抱 ${lv === 1 ? 1 : 3} 天`; const left = (lv === 1 ? 86400 : 259200) - (S.now - h.s); if(left <= 0) return "快解鎖了"; return left >= 86400 ? `再抱 ${Math.ceil(left / 86400)} 天` : `再抱 ${Math.max(1, Math.ceil(left / 3600))} 小時`; };
    function modal(cls, html){ const o = document.createElement("div"); o.className = "careModal skTut " + cls; o.innerHTML = `<div class="cmBox skBox">${html}<button class="btn" style="width:100%" data-x="1">知道了</button></div>`; document.body.appendChild(o);
      const close = () => o.remove(); o.querySelector("[data-x]").addEventListener("click", () => { SFX.tap(); close(); }); o.addEventListener("click", e => { if(e.target === o) close(); }); return o; }
    function resetAsk(){ SFX.tap(); document.querySelectorAll(".skRst").forEach(x => x.remove());
      const o = document.createElement("div"); o.className = "careModal skTut skRst"; document.body.appendChild(o);
      o.innerHTML = `<div class="cmBox skBox"><div class="skTutH">${cat("gray", "sad")}<div><small>請先看清楚再按喔</small><b class="dn2">確定要破產重來嗎？</b></div></div>
        <div class="skWarn"><b>按下去之後會：</b><ul><li>現金回到 <b>10,000</b></li><li>手上<b>所有股票直接清空</b>，不會換成現金（現在持股市值 ${f0(S.assets - S.cash)}）</li><li>交易紀錄全部刪除，總損益從 0 重新算</li><li>有 <b>3 天新手保護期</b>，這段時間不會出現在排行榜</li><li><b>3 天內不能再按一次</b>破產重來</li></ul>
        <b>會保留：</b><ul class="keep"><li>拿到的成就徽章</li><li>解鎖過的股東小故事</li><li>你推薦的股票</li></ul><p>這個動作<b>不能復原</b>。</p></div>
        <label class="skChk"><input type="checkbox" id="skRstOk"> 我看完了，確定要重來</label>
        <div class="skTutB"><button class="btn sub" data-a="x">再想想</button><button class="btn skRstGo" id="skRstGo" disabled>破產重來</button></div></div>`;
      const go = o.querySelector("#skRstGo"), ck = o.querySelector("#skRstOk"); ck.addEventListener("change", () => { go.disabled = !ck.checked; SFX.tap(); });
      o.querySelector("[data-a=x]").addEventListener("click", () => { SFX.tap(); o.remove(); }); o.addEventListener("click", e => { if(e.target === o) o.remove(); });
      go.addEventListener("click", async () => { if(!ck.checked) return; go.disabled = true; go.textContent = "處理中…";
        try{ const r = await ctx.rpc("stock_reset"); if(r && r.ok){ o.remove(); SFX.select(); ctx.toast("重新開始了！現金 10,000，這次一定會更好", 3500); tab = "mkt"; await load(true); return; }
          if(r && r.reason === "cooldown"){ const l = num(r.until) - Date.now() / 1000; ctx.toast(`3 天內只能破產重來一次，還要等 ${l >= 86400 ? Math.ceil(l / 86400) + " 天" : Math.max(1, Math.ceil(l / 3600)) + " 小時"}`, 3500); }
          else ctx.toast("沒有成功，再試一次"); }
        catch(e){ ctx.toast(/stock_reset|function|404|schema/i.test(String(e && e.message || e)) ? "破產重來還沒開放（資料庫還沒更新）" : "連不上交易所，再試一次"); }
        o.remove(); }); }
    function hitPop(hits){ if(!alive) return; SFX.level ? SFX.level() : SFX.select();
      modal("skHitPop", `<div class="skTutH">${cat("gray", "happy")}<div><small>到價提醒</small><b>你設定的價格到了！</b></div></div><div class="skHits">${hits.map(h => `<div><b>${CO[h.sym][0]}</b><span>${h.d === "u" ? "漲到" : "跌到"} <b class="${h.d === "u" ? "up" : "dn"}">${f2(h.p)}</b>・現在 ${f2(px(h.sym))}</span></div>`).join("")}</div><p class="skMsg small">提醒一次就會自動取消，要再提醒可以重新設定。</p>`); }
    function badgePop(ids){ ids = (ids || []).filter(x => BADGES[x]); if(!ids.length || !alive) return; SFX.level ? SFX.level() : SFX.select(); if(ctx.burst) ctx.burst();
      modal("skBdgPop", `<div class="skTutH">${cat("gray", "happy")}<div><small>成就達成</small><b>獲得${ids.length > 1 ? ` ${ids.length} 個` : ""}徽章！</b></div></div><div class="skBdgNew">${ids.map(x => `<div>${medal(x, true)}<b>${BADGES[x][0]}</b><small>${BADGES[x][1]}</small></div>`).join("")}</div>`); }
    const storyCache = {};
    async function storyPop(s, i){ if(stLv(s) <= i) return; SFX.tap(); const c = CO[s], key = s + i;
      const o = modal("skStoryPop", `<div class="skTutH">${cat(c[2], "happy")}<div><small>${c[0]}・股東小故事</small><b>${c[1]}（${i ? "下" : "上"}篇）</b></div></div><p class="skTutP" id="skStT">翻開故事書中…</p>`);
      let t = storyCache[key]; if(t == null){ try{ t = await ctx.rpc("stock_story", { p_sym: s, p_i: i }); }catch(e){ t = null; } if(typeof t === "string") storyCache[key] = t; }
      const p = o.querySelector("#skStT"); if(p) p.textContent = typeof t === "string" && t ? t.slice(0, 400) : "故事書打不開，等一下再試試"; }
    const dayMove = () => { let hi = SYMS[0], lo = SYMS[0]; for(const s of SYMS){ if(chg(s) > chg(hi)) hi = s; if(chg(s) < chg(lo)) lo = s; } return { hi, lo }; };
    const twDate = off => { const d = new Date(Date.now() + 8 * 3600000 - (off || 0) * 86400000); return d.toISOString().slice(0, 10); };
    const moveOf = (base) => { let hi = null, lo = null; for(const s of SYMS){ const b = num(base[s]); if(!b) continue; const c = (num(base === S.ref ? px(s) : S.ref[s]) - b) / b * 100; if(!hi || c > hi[1]) hi = [s, c]; if(!lo || c < lo[1]) lo = [s, c]; } return { hi, lo }; };
    const repCard = (m, g, base, who) => `<div class="skRep">${m.hi ? `<div><small>${who}漲最多</small><b>${CO[m.hi[0]][0]}</b><span class="${cls(m.hi[1])}">${sign(m.hi[1])}%</span></div><div><small>${who}跌最多</small><b>${CO[m.lo[0]][0]}</b><span class="${cls(m.lo[1])}">${sign(m.lo[1])}%</span></div>` : ""}${g === null ? "" : `<div class="you"><small>你${who}</small><b>${g > 0.004 ? "賺了" : g < -0.004 ? "賠了" : "不賺不賠"}</b><span class="${cls(g)}">${sign(g)}（${sign(base ? g / base * 100 : 0)}%）</span></div>`}</div>`;
    const repBody = () => repCard(moveOf(S.ref), S.dy_base ? S.assets - S.dy_base : null, S.dy_base, "今天");
    function reportPop(){ if(!S.fun || !S.ydy || S.ydy !== twDate(1) || !S.ybase || document.querySelector(".skTut")) return;
      let seen = ""; try{ seen = localStorage.getItem("sk_rep") || ""; }catch(e){} if(seen === S.ydy) return; try{ localStorage.setItem("sk_rep", S.ydy); }catch(e){}
      const g = S.ydiff, d = S.ydy.split("-");
      modal("skRepPop", `<div class="skTutH">${cat("gray", g < -0.004 ? "sad" : "happy")}<div><small>${+d[1]}/${+d[2]} 的成績單</small><b>昨日日報</b></div></div>${repCard(S.yref ? moveOf(S.yref) : {}, g, S.ybase, "昨天")}<p class="skMsg small">${g > 0.004 ? "昨天表現不錯，今天繼續加油！" : g < -0.004 ? "有賺有賠很正常，今天再接再厲。" : "新的一天開始了，看看今天買哪一檔吧！"}</p>`); }
    const buyFee = amt => Math.max(Math.ceil(amt*0.1425 - 1e-9)/100, 0.01);
    const sellFee = amt => buyFee(amt) + Math.ceil(amt*0.3 - 1e-9)/100;

    // 整理伺服器給的資料（只留認得的欄位、數字一定是數字）
    function clean(r){
      if(!r || typeof r !== "object" || !r.px) return null;
      const have = ALL.filter(x => r.px[x] != null); if(have.length) SYMS = have;
      const o = { t: num(r.t), px: {}, ref: {}, cash: num(r.cash), hold: {}, assets: num(r.assets), bail: num(r.bail), can_bail: !!r.can_bail, rank: num(r.rank), players: num(r.players), open: r.open !== false, next: num(r.next), fun: !!r.badges, now: num(r.now, Date.now() / 1000), badges: {}, stories: {}, new_badges: [],
        dy_base: num(r.dy_base), wk_base: num(r.wk_base), wpct: num(r.wpct), wrank: num(r.wrank, 1), wplayers: num(r.wplayers), nprofit: r.nprofit == null ? null : num(r.nprofit), ntotal: num(r.ntotal), nrank: num(r.nrank, 1), nests: num(r.nests), nsolo: !!r.nsolo, pro: !!r.pro, td: {}, fund: {}, watch: [], alerts: {}, hits: [], orders: [], resv: num(r.resv), rank_ok: r.rank_ok !== false, rank_ok_at: num(r.rank_ok_at), ydy: String(r.ydy || "").replace(/[^0-9-]/g, "").slice(0, 10), ybase: num(r.ybase), ydiff: num(r.ydiff), yref: null };
      if(r.yref && typeof r.yref === "object"){ o.yref = {}; for(const s of SYMS) o.yref[s] = num(r.yref[s]); }
      if(r.badges && typeof r.badges === "object") for(const k of Object.keys(BADGES)) if(r.badges[k]) o.badges[k] = num(r.badges[k]);
      o.new_badges = (Array.isArray(r.new_badges) ? r.new_badges : []).filter(x => typeof x === "string" && BADGES[x]).slice(0, 15);
      const who = x => ({ name: String(x && x.name || "").slice(0, 3), cat: String(x && x.cat || "orange").replace(/[^a-z]/g, "").slice(0, 12) });
      o.wtop = (Array.isArray(r.wtop) ? r.wtop : []).slice(0, 10).map(x => Object.assign(who(x), { pct: num(x && x.pct), me: !!(x && x.me) }));
      o.ntop = (Array.isArray(r.ntop) ? r.ntop : []).slice(0, 10).map(x => ({ profit: num(x && x.profit), total: num(x && x.total), me: !!(x && x.me), who: (Array.isArray(x && x.who) ? x.who : []).slice(0, 2).map(who) }));
      for(const s of SYMS){ o.px[s] = num(r.px[s], 1); o.ref[s] = num(r.ref && r.ref[s], o.px[s]); if(r.hold && r.hold[s]) o.hold[s] = { q: num(r.hold[s].q), c: num(r.hold[s].c), s: num(r.hold[s].s) }; if(r.stories && typeof r.stories === "object") o.stories[s] = Math.min(2, Math.max(0, Math.floor(num(r.stories[s]))));
        const d = r.td && r.td[s]; if(Array.isArray(d)) o.td[s] = [num(d[0]), num(d[1]), num(d[2]), num(d[3])];
        const f = r.fund && r.fund[s]; if(f && typeof f === "object") o.fund[s] = { e: (Array.isArray(f.e) ? f.e : []).slice(-4).map(x => num(x)), d: (Array.isArray(f.d) ? f.d : []).slice(-4).map(x => num(x)) };
        const al = r.alerts && r.alerts[s]; if(al && typeof al === "object" && num(al.p) > 0) o.alerts[s] = { p: num(al.p), d: al.d === "u" ? "u" : "d" }; }
      o.watch = (Array.isArray(r.watch) ? r.watch : []).filter(x => typeof x === "string" && CO[x]).slice(0, 16);
      o.hits = (Array.isArray(r.hits) ? r.hits : []).filter(x => x && CO[x.sym]).slice(0, 16).map(x => ({ sym: x.sym, p: num(x.p), d: x.d === "u" ? "u" : "d" }));
      o.orders = (Array.isArray(r.orders) ? r.orders : []).filter(x => x && CO[x.sym]).slice(0, 30).map(x => ({ id: Math.floor(num(x.id)), sym: x.sym, side: x.side === "s" ? "s" : "b", price: num(x.price), qty: Math.max(0, Math.floor(num(x.qty))), status: ["o", "d", "c", "x"].includes(x.status) ? x.status : "x", at: num(x.at), done: num(x.done_price) }));
      o.spark = (Array.isArray(r.spark) ? r.spark : []).slice(-40).map(x => { const m = {}; for(const s of SYMS) m[s] = num(x && x[s]); return m; });
      o.news = (Array.isArray(r.news) ? r.news : []).slice(0, 20).filter(n => n && CO[n.sym]).map(n => ({ t: num(n.t), sym: n.sym, good: !!n.good, k: [10, 11].includes(Math.floor(num(n.k))) ? Math.floor(num(n.k)) : Math.abs(Math.floor(num(n.k))) % 6, pct: num(n.pct) }));
      o.trades = (Array.isArray(r.trades) ? r.trades : []).slice(0, 30).filter(x => x && CO[x.sym]).map(x => ({ at: num(x.at), sym: x.sym, qty: Math.trunc(num(x.qty)), price: num(x.price), fee: num(x.fee), kind: ["l", "d"].includes(x.kind) ? x.kind : "m" }));
      o.top = (Array.isArray(r.top) ? r.top : []).slice(0, 10).map(x => ({ name: String(x && x.name || "").slice(0, 3), cat: String(x && x.cat || "orange").replace(/[^a-z]/g, "").slice(0, 12), assets: num(x && x.assets), me: !!(x && x.me) }));
      o.nest = (Array.isArray(r.nest) ? r.nest : []).slice(0, 2).map(x => ({ uid: String(x && x.uid || ""), assets: num(x && x.assets) }));
      return o;
    }
    async function loadRec(){ try{ const r = await ctx.rpc("stock_recs"); const o = { counts: {}, mine: [], ok: true };
        for(const s of SYMS) o.counts[s] = Math.max(0, Math.floor(num(r && r.counts && r.counts[s]))); o.mine = (Array.isArray(r && r.mine) ? r.mine : []).filter(x => CO[x]).slice(0, 3); REC = o; }catch(e){} }
    const recN = s => REC.counts[s] || 0;
    // ---------- 新手教學 ----------
    const TUT = [
      ["股票是什麼？", "買一家公司的股票，就像當它的小股東。公司變值錢，你手上的股票也跟著變貴。<br><b>這只是遊戲，不是賭博</b>：公司是虛構的，錢是遊戲裡的虛擬資金，不能儲值、也不能換成現金或獎品，放心玩！"],
      ["怎麼賺錢？", "口訣只有四個字：<b>低買高賣</b>。便宜的時候買進，等它漲了再賣出，中間的價差就是你賺的。反過來，買貴了又賣便宜就會虧。"],
      ["紅色、綠色是什麼？", "<b class='up'>紅色是漲</b>、<b class='dn'>綠色是跌</b>（跟台灣的股市一樣）。旁邊的百分比是跟昨天比漲跌多少。一天最多漲 10%（漲停）或跌 10%（跌停）。"],
      ["什麼時候可以玩？", "<b>24 小時都能買賣</b>，價格每分鐘跳一次。每天半夜 12 點（台灣時間）換日，漲停跌停會用前一天最後的價格重新計算。"],
      ["怎麼買賣？", "在「行情」點一家公司，選「買進」或「賣出」，填數量，按下去就成交。每次買賣會收手續費（0.1425%），賣出還要多收證交稅（0.3%），跟台股一樣。所以不要買了馬上賣，會白白虧掉喔。"],
      ["張和零股", "股票的單位是「張」，<b>1 張 = 1,000 股</b>。貴的股票一張要好幾十萬，所以也可以只買幾股，叫做<b>零股</b>。下單時可以切換「零股」或「整張」。"],
      ["市價單和限價單", "<b>市價單</b>：不管多少錢，現在馬上買（賣）。<br><b>限價單</b>：自己設定價格，股價到了才成交。例如現在 100，你掛 95 買進，要等跌到 95 才會買到。掛單可以在「委託」取消，當天沒成交就會失效。"],
      ["走勢圖和 K 線", "「走勢」是今天一整天的價格連成的線，中間的虛線是昨天的收盤價。<br>K 線一根代表一段時間：<b class='up'>紅色</b>是漲、<b class='dn'>綠色</b>是跌。可以切換分K、日K、週K…看短期或長期。"],
      ["成交量和均線", "<b>成交量</b>：那段時間有多少股票換手，量大代表很多人在買賣。<br><b>均線（MA）</b>：最近幾根 K 棒的平均價。股價在均線上面通常比較強，跌到均線下面就要小心。"],
      ["KD、MACD、RSI", "這些叫<b>技術指標</b>，是用過去的價格算出來的參考線。簡單記：KD 或 RSI 太高（超過 80／70）代表漲太多、可能會休息；太低（低於 20／30）代表跌很多、可能會反彈。只是參考，不一定準！"],
      ["五檔和成交明細", "<b>五檔</b>：現在最想買的 5 個價格、最想賣的 5 個價格，和各有多少人在排隊。<br><b>成交明細</b>：一筆一筆成交的時間、價格和數量。看這兩個可以知道現在是買的人多還是賣的人多。"],
      ["基本面：公司賺不賺錢", "<b>每股盈餘（EPS）</b>：公司每一股賺多少錢。<b>本益比</b>＝股價 ÷ EPS，越低代表相對便宜。<br>公司每週公布一次<b>財報</b>，賺得比上次多股價通常會漲，賺得少就會跌。"],
      ["配息：當股東領股利", "公司賺錢會分給股東，叫<b>股利</b>。每 4 週有一天「除息日」，那天有股票的人就會自動收到現金。<br>不過除息當天股價會先扣掉股利，所以不是白拿的，長期抱著好公司才划算。"],
      ["自選股和到價提醒", "在個股按「＋自選」，就能在行情只看自己關心的股票。<br>「到價提醒」可以設定一個價格，股價到了就通知你，不用一直盯著。"],
      ["新聞和推薦", "「新聞」會有好消息、壞消息，股價會跟著動。每檔股票旁邊看得到<b>全站有幾個人推薦</b>，你也可以推薦最多 3 檔給大家參考（不會顯示是誰推薦的）。"],
      ["還有這些好玩的", "<b>成就徽章</b>：達成目標就能蒐集。<b>股東小故事</b>：同一檔抱久一點，可以解鎖貓老闆的故事。<b>排行</b>除了比總資產，還有每週漲幅榜和小窩合作榜，新手也有機會上榜！"],
      ["跟真的股市哪裡不一樣？", "真的台股只有<b>週一到週五 9:00～13:30</b> 開盤，買了要<b>兩天後才扣款</b>，而且價格是所有人的買單賣單互相配對出來的。<br>這裡為了好玩改成 24 小時開盤、馬上扣款，價格和掛單量是電腦模擬的。這裡賺錢不代表真的投資也會賺喔。"],
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
        <div class="skRcpT"><span>股票</span><b>${esc(CO[sym][0])}</b><span>數量</span><b>${fq(q)}</b><span>成交價</span><b>${f2(r.price)}</b><span>${buy ? "手續費" : "手續費＋交易稅"}</span><b>${f2(fee)}</b>
        <span class="tot">${buy ? "總共花了" : "總共拿回"}</span><b class="tot">${f2(tot)}</b><span>剩下現金</span><b>${f2(r.cash)}</b><span>現在持有</span><b>${fq(r.hold && r.hold[sym] ? num(r.hold[sym].q) : 0)}</b></div>
        <button class="btn" style="width:100%">知道了</button></div>`;
      const close = () => o.remove(); o.querySelector("button").addEventListener("click", () => { SFX.tap(); close(); });
      o.addEventListener("click", e => { if(e.target === o) close(); });
    }
    async function load(silent){
      try{ const [r0] = await Promise.all([ctx.rpc("stock_status"), loadRec()]); const r = clean(r0); if(!alive) return; if(!r) throw new Error("bad"); const first = !S; if(first){ let seen = false; try{ seen = !!localStorage.getItem("sk_tut"); }catch(e){} if(!seen) setTimeout(() => { if(alive) tutorial(); }, 400); } const oldNews = S && S.news[0] ? S.news[0].t : 0; S = r; err = "";
        if(!first && S.news[0] && S.news[0].t > oldNews){ const n = S.news[0], c = CO[n.sym]; ctx.toast(`快訊：${esc(c[0] + " " + newsTxt(n))}`, 3500); SFX.key(n.good ? 1.3 : .7); }
        render(); if(detail) detail.refresh(); if(S.hits.length) hitPop(S.hits); if(S.new_badges.length) badgePop(S.new_badges); else if(!detail) setTimeout(() => { if(alive && S) reportPop(); }, first ? 900 : 0); }
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
    const newsTxt = n => { const c = CO[n.sym]; return n.k === 10 ? `今天除息，每股發放現金股利 ${f2(n.pct)}，持有的股東已經領到了` : n.k === 11 ? `公布財報，每股盈餘比上一季${n.good ? "成長" : "衰退"} ${Math.abs(n.pct).toFixed(1)}%` : (n.good ? GOOD : BAD)[n.k](c[0], c[1]); };
    const newsLine = n => { const c = CO[n.sym]; return `<div class="skNews ${n.good ? "up" : "dn"}"><em>${new Date(n.t*60000).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", hour12: false })}</em><div><b>${c[0]}</b> ${esc(newsTxt(n))}<span>${n.k === 10 ? "除息" : sign(n.pct) + "%"}</span></div></div>`; };

    const hm = t => { const d = new Date((t + 8 * 3600) * 1000); return d.getUTCHours() + ":" + String(d.getUTCMinutes()).padStart(2, "0"); };
    const nextTxt = () => { if(!S || !S.next) return ""; const tw = t => Math.floor((t + 8 * 3600) / 86400); return (tw(S.next) > tw(Date.now() / 1000) ? "明天 " : "") + hm(S.next); };
    const okLeft = () => { const l = S.rank_ok_at - Date.now() / 1000; return l >= 86400 ? `還要 ${Math.ceil(l / 86400)} 天` : `還要 ${Math.max(1, Math.ceil(l / 3600))} 小時`; };
    const newbie = () => `新手保護期<small>開戶滿 3 天才會出現在排行榜（${okLeft()}），先好好練習吧！<br>如果現在上榜，大約會是第 ${S.rank} 名</small>`;
    const HOURS = "24 小時開盤・每天 0:00 換日";
    function render(){
      if(!alive) return;
      if(!S){ el.innerHTML = `<div class="box skBox"><div class="skHead"><b>貓貓股市</b></div><p class="skMsg">${err ? esc(err) : "交易所連線中…"}</p>${err ? `<button class="btn sub" id="skRetry">再試一次</button>` : ""}</div>`;
        const r = el.querySelector("#skRetry"); if(r) r.addEventListener("click", () => { err = ""; render(); load(); }); return; }
      const p = pnl();
      let body = "";
      if(tab === "mkt") body = `${S.fun ? `<div class="skSub">今日小報（每天 0:00 換日）</div>${repBody()}` : ""}${S.pro ? `<div class="skFilt"><button data-w="0" class="${onlyW ? "" : "on"}">全部</button><button data-w="1" class="${onlyW ? "on" : ""}">自選 ${S.watch.length}</button></div>` : ""}${onlyW && !S.watch.length ? `<p class="skMsg small">還沒有自選股。點進任何一檔，按「＋自選」就會出現在這裡。</p>` : ""}<div class="skList">${SYMS.filter(s => !onlyW || S.watch.includes(s)).map(s => { const c = CO[s], h = hold(s), d = chg(s);
          return `<button class="skRow" data-s="${s}">${cat(c[2])}<span class="skNm"><b>${c[0]}${S.watch.includes(s) ? `<i class="skStar">自選</i>` : ""}</b><small>${s}${recN(s) ? `・<u class="skRec">${f0(recN(s))} 人推薦</u>` : ""}${h.q ? `・持有 ${fq(h.q)}` : ""}</small></span>${spark(s)}<span class="skPx ${cls(d)}"><b>${f2(px(s))}</b><small>${d > 0.004 ? "▲" : d < -0.004 ? "▼" : ""}${Math.abs(d).toFixed(2)}%${badge(s)}</small></span></button>`; }).join("")}</div>
        <div class="skFoot">紅色是漲、綠色是跌・漲跌停 ±10%<br>${HOURS}</div><div class="skNote">這只是遊戲，不是賭博也不是投資。資金是虛擬的，不能儲值、不能換成現金或獎品；公司和新聞都是虛構的。</div>`;
      if(tab === "hold"){ const hs = SYMS.filter(s => hold(s).q > 0);
        body = `${hs.length ? `<div class="skList">${hs.map(s => { const h = hold(s), v = h.q*px(s), g = v - h.c;
            return `<button class="skRow" data-s="${s}">${cat(CO[s][2])}<span class="skNm"><b>${CO[s][0]}</b><small>${fq(h.q)}・均價 ${f2(h.c/h.q)}</small></span><span class="skPx ${cls(g)}"><b>${f2(v)}</b><small>${sign(g)}（${sign(h.c ? g/h.c*100 : 0)}%）</small></span></button>`; }).join("")}</div>` : `<p class="skMsg">還沒有持股，去「行情」挑一檔吧！</p>`}
          <div class="skSub">交易紀錄</div>${S.trades.length ? `<div class="skLog">${S.trades.map(x => `<div class="${x.kind === "d" || x.qty > 0 ? "up" : "dn"}"><em>${new Date(x.at*1000).toLocaleString("zh-TW", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })}</em><b>${x.kind === "d" ? "息" : x.qty > 0 ? "買" : "賣"}</b><span>${x.kind === "d" ? `${CO[x.sym][0]} 股利入帳 +${f2(-x.fee)}（每股 ${f2(x.price)}）` : `${CO[x.sym][0]} ${fq(Math.abs(x.qty))} @ ${f2(x.price)}${x.kind === "l" ? "・限價" : ""}`}</span><i>${x.kind === "d" ? "" : "費 " + f2(x.fee)}</i></div>`).join("")}</div>` : `<p class="skMsg small">還沒有交易</p>`}<button class="skReset" id="skReset">破產重來</button>`; }
      if(tab === "ord"){ const ST = { o: "委託中", d: "已成交", c: "已取消", x: "已失效" }, op = S.orders.filter(x => x.status === "o");
        body = `<div class="skMe">委託中 <b>${op.length}</b> 筆<small>掛買單保留的現金 ${f2(S.resv)}・可用現金 ${f2(Math.max(0, S.cash - S.resv))}</small></div>
          ${S.orders.length ? `<div class="skOrds">${S.orders.map(x => `<div class="${x.status}"><span class="${x.side === "b" ? "up" : "dn"}">${x.side === "b" ? "買" : "賣"}</span><div><b>${CO[x.sym][0]}</b><small>限價 ${f2(x.price)}・${fq(x.qty)}${x.status === "d" ? `・成交價 ${f2(x.done)}` : ""}</small><small>${new Date(x.at*1000).toLocaleString("zh-TW", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })}</small></div>${x.status === "o" ? `<button data-cx="${x.id}">取消</button>` : `<em>${ST[x.status]}</em>`}</div>`).join("")}</div>` : `<p class="skMsg">還沒有委託。在個股的「下單」選「限價」，就可以自己設定價格掛單。</p>`}
          <div class="skFoot">限價單：到了你設定的價格才會成交・一次最多掛 10 筆<br>委託都是「當日有效」，每天 0:00 換日後還沒成交的會自動失效</div>`; }
      if(tab === "news") body = S.news.length ? `<div class="skFeed">${S.news.map(newsLine).join("")}</div>` : `<p class="skMsg">目前風平浪靜，沒有新聞</p>`;
      if(tab === "rank"){ const pt = ctx.partner(), ta = pt && S.nest.find(x => x.uid === pt.user_id);
        const seg = S.fun ? `<div class="skTabs sm">${[["all", "總資產"], ["week", "本週漲幅"], ["nest", "小窩合作"]].map(([k, n]) => `<button data-rk="${k}" class="${rk === k ? "on" : ""}">${n}</button>`).join("")}</div>` : "";
        if(S.fun && rk === "week") body = `${seg}<div class="skMe">你這週 <b class="${cls(S.wpct)}">${sign(S.wpct)}%</b><small>${!S.rank_ok ? `開戶滿 3 天才會上榜（${okLeft()}）` : S.trades.length || S.wplayers ? `第 ${S.wrank} 名／${Math.max(S.wplayers, S.wrank)} 位這週有上線的股民` : "下單之後就會進榜"}</small></div>
          <div class="skSub">本週漲幅前 10 名</div><div class="skTop">${S.wtop.length ? S.wtop.map((x, i) => `<div class="${x.me ? "me" : ""}"><em>${i + 1}</em>${cat(x.cat)}<b>${esc(x.name)}${x.me ? "（你）" : ""}</b><span class="${cls(x.pct)}">${sign(x.pct)}%</span></div>`).join("") : `<p class="skMsg small">這週還沒有人上榜，快去搶第一！</p>`}</div>
          <div class="skFoot">比的是這一週資產成長幾 %，不是比誰錢多，新手也能上榜<br>每週一 0:00 重新起算・救濟金不算漲幅</div>`;
        else if(S.fun && rk === "nest") body = `${seg}<div class="skMe">${S.nprofit === null ? `你們小窩還沒上榜<small>下過一次單就會進榜</small>` : `小窩合計獲利 <b class="${cls(S.nprofit)}">${sign(S.nprofit)}</b><small>${S.nsolo ? "單人" : "雙人"}小窩組第 ${S.nrank} 名／${Math.max(S.nests, S.nrank)} 個小窩・合計資產 ${f0(S.ntotal)}</small>`}</div>
          ${pt && !ta ? `<p class="skMsg small">${esc(pt.name)} 還沒開戶，叫 ta 一起來幫小窩賺錢吧！</p>` : ""}
          <div class="skSub">${S.nsolo ? "單人" : "雙人"}小窩組・前 10 名</div><div class="skTop nest">${S.ntop.length ? S.ntop.map((x, i) => `<div class="${x.me ? "me" : ""}"><em>${i + 1}</em><i>${x.who.map(w => cat(w.cat)).join("")}</i><b>${x.who.map(w => esc(w.name)).join(" & ")}${x.me ? "（你們）" : ""}</b><span class="${cls(x.profit)}">${x.profit > 0 ? "+" : ""}${f0(x.profit)}</span></div>`).join("") : `<p class="skMsg small">還沒有小窩上榜</p>`}</div>
          <div class="skFoot">${S.nsolo ? "單人小窩只跟單人小窩比，公平競爭" : "把兩個人賺的錢加起來排名（每人從 10,000 起算）<br>雙人小窩只跟雙人小窩比，單人小窩有自己的榜"}</div>`;
        else body = seg + `<div class="skMe">${S.rank_ok ? `你在全站排第 <b>${S.rank}</b> 名<small>／${Math.max(S.players, S.rank)} 位有下過單的股民</small>` : newbie()}</div>
          ${pt ? `<div class="skVs"><div>${cat(ctx.me.cat, "happy")}<b>你</b><span>${f0(S.assets)}</span></div><i>VS</i><div>${cat(pt.cat, "happy")}<b>${esc(pt.name)}</b><span>${ta ? f0(ta.assets) : "還沒開戶"}</span></div></div>` : ""}
          ${REC.ok ? `<div class="skSub">大家推薦（每人最多推薦 3 檔，不會顯示是誰）</div><div class="skRecs">${SYMS.slice().sort((a, b) => recN(b) - recN(a)).map(s => { const mx = Math.max(1, ...SYMS.map(recN)); return `<button class="skRow skRecRow" data-s="${s}"><b>${CO[s][0]}${REC.mine.includes(s) ? `<i>你推薦</i>` : ""}</b><span><i style="width:${Math.round(recN(s)/mx*100)}%"></i></span><em>${f0(recN(s))} 人</em></button>`; }).join("")}</div>` : ""}
          <div class="skSub">全站前 10 名（名字只顯示第一個字）</div><div class="skTop">${S.top.length ? S.top.map((x, i) => `<div class="${x.me ? "me" : ""}"><em>${i + 1}</em>${cat(x.cat)}<b>${esc(x.name)}${x.me ? "（你）" : ""}</b><span>${f0(x.assets)}</span></div>`).join("") : `<p class="skMsg small">還沒有人下單，快去當第一名！</p>`}</div>`; }
      if(tab === "fun" && S.fun){ const ids = Object.keys(BADGES).filter(x => !(x === "duo" && S.nsolo && !S.badges.duo)), got = ids.filter(x => S.badges[x]).length, sn = SYMS.reduce((a, x) => a + stLv(x), 0);
        body = `<div class="skSub">成就徽章　${got} / ${ids.length}</div><div class="skBdg">${ids.map(x => `<div class="${S.badges[x] ? "on" : ""}">${medal(x, !!S.badges[x])}<b>${BADGES[x][0]}</b><small>${BADGES[x][1]}</small></div>`).join("")}</div>
          <div class="skSub">股東小故事　${sn} / ${SYMS.length * 2}</div><p class="skMsg small">同一檔股票持有市值 500 以上，抱滿 1 天解鎖上篇、抱滿 3 天解鎖下篇。賣掉或市值低於 500 再買回會重新計算，解鎖過的故事會一直留著。</p>
          <div class="skStories">${SYMS.map(x => { const lv = stLv(x), c = CO[x]; return `<div>${cat(c[2])}<span><b>${c[1]}</b><small>${c[0]}</small></span>${[0, 1].map(i => lv > i ? `<button class="on" data-st="${x}" data-i="${i}">${i ? "下篇" : "上篇"}</button>` : `<button disabled>${lv === i && stWait(x, i + 1, 1) ? stWait(x, i + 1, 1) : (i ? "抱 3 天" : "抱 1 天")}</button>`).join("")}</div>`; }).join("")}</div>`; }
      el.innerHTML = `<div class="box skBox">
        <div class="skHead"><b>貓貓股市</b><button class="skHelp" id="skHelp">？新手教學</button><span class="skLive ${S.open ? "" : "off"}"><i></i>${S.open ? "開盤中" : "休市中"}</span></div>${S.open ? "" : `<div class="skClosed"><b>現在休市中，${nextTxt()} 開盤</b><small>${HOURS}<br>休市時價格不會動，也不能買賣，可以先研究要買哪一檔</small></div>`}
        <div class="skAcct"><div><small>總資產</small><b>${f2(S.assets)}</b></div><div><small>現金</small><b>${f2(S.cash)}</b></div><div class="${cls(p)}"><small>總損益</small><b>${sign(p)}</b></div></div>
        ${S.can_bail ? `<button class="btn skBail" id="skBail">資產不到 1,000…領今天的救濟金 2,000</button>` : ""}
        <div class="skTabs ${S.pro ? "six" : S.fun ? "five" : ""}">${[["mkt", "行情"], ["hold", "持股"]].concat(S.pro ? [["ord", "委託"]] : [], [["news", "新聞"], ["rank", "排行"]], S.fun ? [["fun", "成就"]] : []).map(([k, n]) => `<button data-t="${k}" class="${tab === k ? "on" : ""}">${n}</button>`).join("")}</div>
        ${body}</div>`;
      el.querySelectorAll(".skTabs button[data-t]").forEach(b => b.addEventListener("click", () => { tab = b.dataset.t; SFX.tap(); render(); }));
      el.querySelectorAll(".skRow").forEach(b => b.addEventListener("click", () => openDetail(b.dataset.s)));
      el.querySelectorAll("[data-w]").forEach(b => b.addEventListener("click", () => { onlyW = b.dataset.w === "1"; SFX.tap(); render(); }));
      el.querySelectorAll("[data-cx]").forEach(b => b.addEventListener("click", async () => { b.disabled = true; SFX.tap(); try{ const r = await ctx.rpc("stock_cancel", { p_id: +b.dataset.cx }); ctx.toast(r && r.ok ? "委託已取消" : "這筆已經成交或失效了"); }catch(e){ ctx.toast("連不上交易所，再試一次"); } load(true); }));
      const rs = el.querySelector("#skReset"); if(rs) rs.addEventListener("click", resetAsk);
      el.querySelectorAll("[data-rk]").forEach(b => b.addEventListener("click", () => { rk = b.dataset.rk; SFX.tap(); render(); }));
      el.querySelectorAll("[data-st]").forEach(b => b.addEventListener("click", () => storyPop(b.dataset.st, +b.dataset.i)));
      el.querySelector("#skHelp").addEventListener("click", () => { SFX.tap(); tutorial(); });
      const bl = el.querySelector("#skBail"); if(bl) bl.addEventListener("click", async () => { bl.disabled = true; try{ const r = await ctx.rpc("stock_bailout"); if(r && r.ok){ SFX.coin ? SFX.coin() : SFX.select(); ctx.toast("領到救濟金 2,000，東山再起！"); } }catch(e){} load(); });
    }

    // ---------- 技術指標 ----------
    const sma = (a, n) => a.map((_, i) => i < n - 1 ? null : a.slice(i - n + 1, i + 1).reduce((x, y) => x + y, 0) / n);
    const ema = (a, n) => { const k = 2 / (n + 1); let e = a[0]; return a.map((v, i) => (e = i ? v * k + e * (1 - k) : v)); };
    const kdOf = cs => { let K = 50, D = 50; return cs.map((c, i) => { const w = cs.slice(Math.max(0, i - 8), i + 1), hi = Math.max(...w.map(x => x[2])), lo = Math.min(...w.map(x => x[3])), rsv = hi > lo ? (c[4] - lo) / (hi - lo) * 100 : 50; K = K * 2 / 3 + rsv / 3; D = D * 2 / 3 + K / 3; return [K, D]; }); };
    const rsiOf = (cl, n) => { let up = 0, dn = 0; return cl.map((v, i) => { if(!i) return null; const d = v - cl[i - 1], u = Math.max(d, 0), w = Math.max(-d, 0); if(i <= n){ up += u / n; dn += w / n; if(i < n) return null; } else { up = (up * (n - 1) + u) / n; dn = (dn * (n - 1) + w) / n; } return up + dn ? up / (up + dn) * 100 : 50; }); };
    const rng = seed => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    const DAY0 = Date.UTC(2026, 0, 5) / 864e5;
    const dayIdx = () => Math.floor((Date.now() + 8 * 3600000) / 864e5) - DAY0;
    const inDays = n => { if(n === 0) return "今天"; const d = new Date(Date.now() + 8 * 3600000 + n * 864e5); return `${n} 天後（${d.getUTCMonth() + 1}/${d.getUTCDate()}）`; };
    const nextIn = (off, per) => { const m = ((dayIdx() + off) % per + per) % per; return m === 0 ? 0 : per - m; };

    // ---------- 個股：看盤＋下單 ----------
    function openDetail(s){
      if(!CO[s]) return; SFX.tap();
      document.querySelectorAll(".skDet").forEach(x => x.remove());
      const o = document.createElement("div"); o.className = "careModal skDet";
      let view = S.pro ? "tl" : "5m", sub = "vol", pane = "order", side = "buy", unit = "s", ot = "m", lp = 0, qty = 1, all = null, Q = null;
      o.innerHTML = `<div class="cmBox skBox"><div id="skD"></div></div>`; document.body.appendChild(o);
      const box = o.querySelector("#skD"), W = 320;
      const openSell = () => S.orders.filter(x => x.status === "o" && x.sym === s && x.side === "s").reduce((a, x) => a + x.qty, 0);
      const maxBuy = P => { const av = Math.max(0, S.cash - S.resv); let q = Math.floor(av / (P * 1.001425)); while(q > 0 && q * P + buyFee(q * P) > av + 1e-6) q--; return Math.max(0, q); };
      const yFn = (lo, hi, H, pad) => v => (pad + (hi - v) / ((hi - lo) || 1) * (H - pad * 2));
      const line = (pts, cls2) => pts.length > 1 ? `<polyline class="${cls2}" fill="none" points="${pts.map(p => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ")}"/>` : "";

      function mainChart(){
        if(!all) return `<div class="skChart load">讀取走勢中…</div>`; if(all.length < 1) return `<div class="skChart load">資料還不夠畫圖，過一陣子再來看</div>`;
        const H = 150;
        if(view === "tl"){ const r = ref(s), hi = Math.max(...all.map(c => c[2])), lo = Math.min(...all.map(c => c[3])), dev = Math.max(hi - r, r - lo, r * .012) * 1.1, y = yFn(r - dev, r + dev, H, 6);
          const t0 = Math.floor((S.t + 480) / 1440) * 1440 - 480, x = g => Math.min(W, Math.max(0, (g - t0) / 1440 * W)), pts = all.map(c => [x(c[0]), y(c[4])]);
          let sv = 0, sa = 0; const avg = all.map(c => { sv += c[5] || 1; sa += c[4] * (c[5] || 1); return [x(c[0]), y(sa / sv)]; });
          const up = all[all.length - 1][4] >= r;
          return `<svg class="skChart tl ${up ? "up" : "dn"}" viewBox="0 0 ${W} ${H}">${[.25, .75].map(k => `<line x1="0" x2="${W}" y1="${H * k}" y2="${H * k}" class="grid"/>`).join("")}${[.25, .5, .75].map(k => `<line y1="0" y2="${H}" x1="${W * k}" x2="${W * k}" class="grid"/>`).join("")}
            <line x1="0" x2="${W}" y1="${H / 2}" y2="${H / 2}" class="refl"/>
            <polygon class="area" points="${pts[0][0].toFixed(1)},${H} ${pts.map(p => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ")} ${pts[pts.length - 1][0].toFixed(1)},${H}"/>${line(avg, "avg")}${line(pts, "pl")}
            <text x="2" y="10" class="ax up">${f2(r + dev)}　+${(dev / r * 100).toFixed(2)}%</text><text x="2" y="${H / 2 - 2}" class="ax">${f2(r)} 昨收</text><text x="2" y="${H - 3}" class="ax dn">${f2(r - dev)}　-${(dev / r * 100).toFixed(2)}%</text>
            ${["6:00", "12:00", "18:00"].map((t, i) => `<text x="${W * (i + 1) / 4 + 2}" y="${H - 3}" class="ax">${t}</text>`).join("")}</svg>`; }
        const vis = all.slice(-60), off = all.length - vis.length, lo = Math.min(...vis.map(c => c[3])), hi = Math.max(...vis.map(c => c[2])), y = yFn(lo, hi, H, 9), w = W / Math.max(vis.length, 14), cl = all.map(c => c[4]);
        const ma = n => { const m = sma(cl, n); return vis.map((_, i) => m[i + off] == null ? null : [i * w + w / 2, y(m[i + off])]).filter(Boolean); };
        return `<svg class="skChart" viewBox="0 0 ${W} ${H}"><text x="2" y="9" class="ax">${f2(hi)}</text><text x="2" y="${H - 2}" class="ax">${f2(lo)}</text>${[.25, .5, .75].map(k => `<line x1="0" x2="${W}" y1="${H * k}" y2="${H * k}" class="grid"/>`).join("")}
          ${vis.map((c, i) => { const up = c[4] >= c[1], x = i * w + w / 2, top = Math.min(y(c[1]), y(c[4])), bh = Math.max(1.2, Math.abs(y(c[1]) - y(c[4])));
            return `<g class="${up ? "up" : "dn"}"><line x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${y(c[2]).toFixed(1)}" y2="${y(c[3]).toFixed(1)}"/><rect x="${(x - w * .32).toFixed(1)}" y="${top.toFixed(1)}" width="${(w * .64).toFixed(1)}" height="${bh.toFixed(1)}"/></g>`; }).join("")}
          ${line(ma(5), "m5")}${line(ma(20), "m20")}${line(ma(60), "m60")}</svg>`; }
      function maLegend(){ if(!all || view === "tl" || !all.length) return ""; const cl = all.map(c => c[4]), last = n => { const m = sma(cl, n)[cl.length - 1]; return m == null ? "—" : f2(m); };
        return `<div class="skLeg"><span class="m5">MA5 ${last(5)}</span><span class="m20">MA20 ${last(20)}</span><span class="m60">MA60 ${last(60)}</span></div>`; }
      function subChart(){
        if(!all || !all.length) return ""; const H = 58, tl = view === "tl", k = tl ? "vol" : sub;
        const vis = tl ? all : all.slice(-60), off = all.length - vis.length, w = W / Math.max(vis.length, 14);
        const t0 = Math.floor((S.t + 480) / 1440) * 1440 - 480, xi = i => tl ? Math.min(W, Math.max(0, (vis[i][0] - t0) / 1440 * W)) : i * w + w / 2, bw = tl ? Math.max(.6, W / 480 * .8) : w * .64;
        let body = "", leg = "";
        if(k === "vol"){ const mx = Math.max(1, ...vis.map(c => c[5])); body = vis.map((c, i) => { const up = tl ? (i ? c[4] >= vis[i - 1][4] : c[4] >= ref(s)) : c[4] >= c[1], h = Math.max(.6, c[5] / mx * (H - 12)); return `<rect class="${up ? "up" : "dn"}" x="${(xi(i) - bw / 2).toFixed(1)}" y="${(H - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}"/>`; }).join("");
          leg = `<span>成交量 ${fv(vis[vis.length - 1][5])}</span><span>這張圖最大 ${fv(mx)}</span>`; }
        else if(k === "kd"){ const kd = kdOf(all).slice(off), y = yFn(0, 100, H, 4); body = `<line x1="0" x2="${W}" y1="${y(80)}" y2="${y(80)}" class="grid"/><line x1="0" x2="${W}" y1="${y(20)}" y2="${y(20)}" class="grid"/>` + line(kd.map((v, i) => [xi(i), y(v[0])]), "la") + line(kd.map((v, i) => [xi(i), y(v[1])]), "lb");
          const l = kd[kd.length - 1]; leg = `<span class="la">K ${l[0].toFixed(1)}</span><span class="lb">D ${l[1].toFixed(1)}</span><span>${l[0] > 80 ? "偏熱（超買）" : l[0] < 20 ? "偏冷（超賣）" : "中間區"}</span>`; }
        else if(k === "macd"){ const cl = all.map(c => c[4]), e12 = ema(cl, 12), e26 = ema(cl, 26), dif = cl.map((_, i) => e12[i] - e26[i]), sig = ema(dif, 9), osc = dif.map((v, i) => v - sig[i]), d2 = dif.slice(off), s2 = sig.slice(off), o2 = osc.slice(off);
          const mx = Math.max(1e-6, ...d2.map(Math.abs), ...s2.map(Math.abs), ...o2.map(Math.abs)), y = yFn(-mx, mx, H, 4);
          body = `<line x1="0" x2="${W}" y1="${H / 2}" y2="${H / 2}" class="grid"/>` + o2.map((v, i) => `<rect class="${v >= 0 ? "up" : "dn"}" x="${(xi(i) - bw / 2).toFixed(1)}" y="${Math.min(y(v), H / 2).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(.5, Math.abs(y(v) - H / 2)).toFixed(1)}"/>`).join("") + line(d2.map((v, i) => [xi(i), y(v)]), "la") + line(s2.map((v, i) => [xi(i), y(v)]), "lb");
          leg = `<span class="la">DIF ${d2[d2.length - 1].toFixed(2)}</span><span class="lb">MACD ${s2[s2.length - 1].toFixed(2)}</span><span class="${o2[o2.length - 1] >= 0 ? "up" : "dn"}">柱 ${o2[o2.length - 1].toFixed(2)}</span>`; }
        else { const cl = all.map(c => c[4]), a = rsiOf(cl, 6).slice(off), b = rsiOf(cl, 12).slice(off), y = yFn(0, 100, H, 4), pts = r => r.map((v, i) => v == null ? null : [xi(i), y(v)]).filter(Boolean);
          body = `<line x1="0" x2="${W}" y1="${y(70)}" y2="${y(70)}" class="grid"/><line x1="0" x2="${W}" y1="${y(30)}" y2="${y(30)}" class="grid"/>` + line(pts(a), "la") + line(pts(b), "lb");
          const la = a[a.length - 1], lb = b[b.length - 1]; leg = `<span class="la">RSI6 ${la == null ? "—" : la.toFixed(1)}</span><span class="lb">RSI12 ${lb == null ? "—" : lb.toFixed(1)}</span><span>${la == null ? "" : la > 70 ? "偏熱（超買）" : la < 30 ? "偏冷（超賣）" : "中間區"}</span>`; }
        return `<svg class="skChart sub" viewBox="0 0 ${W} ${H}">${body}</svg><div class="skLeg">${leg}</div>`; }

      async function loadH(quiet){ if(!quiet){ all = null; draw(); } const rg = view; try{ const r = await ctx.rpc("stock_history", { p_sym: s, p_range: rg }); const cs = (Array.isArray(r) ? r : []).slice(rg === "tl" ? -500 : -121).map(c => [num(c[0]), num(c[1]), num(c[2]), num(c[3]), num(c[4]), Math.max(0, num(c[5]))]).filter(c => c[3] > 0); if(rg !== view) return;
          if(rg === "1m") for(let i = cs.length - 1; i > 0; i--){ const p0 = cs[i - 1][4]; cs[i] = [cs[i][0], p0, Math.max(p0, cs[i][2]), Math.min(p0, cs[i][3]), cs[i][4], cs[i][5]]; }   // 一分鐘只有一個價格：開盤用上一分鐘的收盤
          all = rg === "1m" ? cs.slice(1) : cs; }catch(e){ if(rg !== view) return; if(!quiet) all = []; } draw(); }
      async function loadQ(){ try{ const r = await ctx.rpc("stock_quote", { p_sym: s }); const arr = (x, n) => (Array.isArray(x) ? x : []).slice(0, n);
          Q = { book: arr(r && r.book, 40).map(x => [x && x[0] === "s" ? "s" : "b", num(x && x[1]), Math.max(0, num(x && x[2]))]), ticks: arr(r && r.ticks, 41).map(x => [num(x && x[0]), num(x && x[1]), Math.max(0, num(x && x[2]))]).filter(x => x[1] > 0), fills: arr(r && r.fills, 20).map(x => [num(x && x[0]), num(x && x[1]), Math.trunc(num(x && x[2]))]) }; }
        catch(e){ if(!Q) Q = { book: [], ticks: [], fills: [] }; } draw(); }

      function bookPane(){ const c = px(s), up = upP(s), dn = dnP(s), l = lim(s), r = rng((S.t * 31 + s.charCodeAt(0) * 7 + s.charCodeAt(1) * 13) >>> 0), base = Math.max(3, Math.round(4000 / c));
        const mine = (sd, p) => (Q ? Q.book : []).filter(x => x[0] === sd && Math.abs(x[1] - p) < .005).reduce((a, x) => a + x[2], 0);
        const asks = [], bids = []; let p = c;
        if(l <= 0){ p = c; for(let i = 0; i < 5 && p <= up + .001; i++){ asks.push([p, Math.round(base * (.3 + r() * 1.7) * (1 + i * .25)) * 1000 + mine("s", p)]); p = r2(p + tk(p)); } }
        if(l >= 0){ p = l > 0 ? c : r2(c - tk(c - .001)); for(let i = 0; i < 5 && p >= dn - .001; i++){ bids.push([p, Math.round(base * (.3 + r() * 1.7) * (1 + i * .25) * (l > 0 && !i ? 6 : 1)) * 1000 + mine("b", p)]); p = r2(p - tk(p - .001)); } }
        const mx = Math.max(1, ...asks.map(x => x[1]), ...bids.map(x => x[1])), row = (x, sd) => `<button class="${sd}" data-bp="${x[0]}"><i style="width:${Math.round(x[1] / mx * 100)}%"></i><em>${sd === "a" ? "賣" : "買"}</em><b class="${cls(x[0] - ref(s))}">${f2(x[0])}</b><span>${fv(x[1])}</span></button>`;
        const sa = asks.reduce((a, x) => a + x[1], 0), sb = bids.reduce((a, x) => a + x[1], 0);
        return `<div class="skBook">${asks.length ? asks.slice().reverse().map(x => row(x, "a")).join("") : `<p class="skMsg small">漲停鎖住了：大家都想買，沒有人要賣</p>`}<div class="skBookMid"><b class="${cls(chg(s))}">${f2(c)}</b><span>成交價</span></div>${bids.length ? bids.map(x => row(x, "b")).join("") : `<p class="skMsg small">跌停鎖住了：大家都想賣，沒有人要買</p>`}</div>
          <div class="skBar"><i style="width:${Math.round(sb / Math.max(1, sa + sb) * 100)}%"></i><span>買方 ${fv(sb)}</span><span>賣方 ${fv(sa)}</span></div>
          <div class="skFoot">五檔：目前最想買的 5 個價格和最想賣的 5 個價格<br>點一下價格，就會帶到「下單」用這個價格掛限價單<br>掛單量是模擬的，其他玩家掛的限價單也會算進去</div>`; }
      function tickPane(){ if(!Q) return `<p class="skMsg small">讀取中…</p>`; const t = Q.ticks;
        return `<div class="skTicks"><div class="hd"><span>時間</span><span>成交價</span><span>漲跌</span><span>單量</span></div>${t.slice(0, 24).map((x, i) => { const pv = t[i + 1] ? t[i + 1][1] : x[1], d = x[1] - pv; return `<div><span>${hm(x[0] * 60)}</span><b class="${cls(x[1] - ref(s))}">${f2(x[1])}</b><span class="${cls(d)}">${d ? sign(d) : "—"}</span><span>${fv(x[2])}</span></div>`; }).join("")}</div>
          ${Q.fills.length ? `<div class="skSub">玩家最近成交</div><div class="skTicks p"><div class="hd"><span>時間</span><span>成交價</span><span>買賣</span><span>數量</span></div>${Q.fills.slice(0, 10).map(x => `<div><span>${hm(x[0])}</span><b>${f2(x[1])}</b><span class="${x[2] > 0 ? "up" : "dn"}">${x[2] > 0 ? "買進" : "賣出"}</span><span>${fq(Math.abs(x[2]))}</span></div>`).join("")}</div>` : ""}
          <div class="skFoot">成交明細：每分鐘一筆。真的股市是每一筆成交都會列出來</div>`; }
      const extra = () => { const h = hold(s); return `${S.fun ? `<div class="skStLine">股東故事 ${stLv(s)} / 2${stLv(s) >= 2 ? "・全部解鎖了，到「成就」看" : h.q ? `・${stWait(s, stLv(s) + 1)}解鎖${stLv(s) ? "下" : "上"}篇` : "・買進市值 500 以上並抱滿 1 天，解鎖老闆的故事"}</div>` : ""}
          ${REC.ok ? `<button class="skRecB ${REC.mine.includes(s) ? "on" : ""}" id="skRecB">${REC.mine.includes(s) ? `你推薦了這檔（再按一次取消）` : `推薦這檔給大家`}<small>目前 ${f0(recN(s))} 人推薦・你已推薦 ${REC.mine.length} / 3 檔</small></button>` : ""}`; };
      function fundPane(){ const c = CO[s], inf = INFO[s] || ["—", 10000, 0, 0], f = S.fund[s], h = hold(s);
        let core = "";
        if(f && f.e.length){ const e4 = f.e.reduce((a, x) => a + x, 0), pe = e4 > 0 ? px(s) / e4 : 0, dv = f.d, yr = dv.length ? dv.reduce((a, x) => a + x, 0) / dv.length * 4 : Math.max(0, e4) * .6, mx = Math.max(.01, ...f.e.map(Math.abs));
          core = `<div class="skFund"><div><small>本益比</small><b>${pe ? pe.toFixed(1) + " 倍" : "—"}</b></div><div><small>近四季每股盈餘</small><b>${f2(e4)}</b></div><div><small>殖利率${dv.length ? "" : "（預估）"}</small><b>${(yr / px(s) * 100).toFixed(2)}%</b></div><div><small>市值</small><b>${(inf[1] * 1e4 * px(s) / 1e8).toFixed(1)} 億</b></div></div>
            <div class="skSub">每股盈餘（最近四季，越右邊越新）</div><div class="skEps">${f.e.map((x, i) => `<div><i style="height:${Math.max(6, Math.round(Math.abs(x) / mx * 46))}px" class="${i && x < f.e[i - 1] ? "dn" : "up"}"></i><b>${f2(x)}</b></div>`).join("")}</div>
            <div class="skKV"><span>下次公布財報</span><b>${inDays(nextIn(inf[2], 7))}</b><span>下次除息（發股利）</span><b>${inDays(nextIn(inf[3], 28))}</b><span>最近一次股利</span><b>${dv.length ? "每股 " + f2(dv[dv.length - 1]) : "還沒發過"}</b>${h.q ? `<span>你下次大約可領</span><b>${f2(h.q * Math.max(0, e4) * .15)}</b>` : ""}</div>`; }
        return `<div class="skKV"><span>公司</span><b>${c[0]}（${s}）</b><span>產業</span><b>${inf[0]}</b><span>負責貓</span><b>${c[1]}</b><span>發行股數</span><b>${f0(inf[1])} 萬股</b></div><p class="skMsg small" style="text-align:left">${c[3]}</p>${core}
          ${extra()}
          <div class="skFoot">本益比＝股價 ÷ 近四季每股盈餘，越低代表相對便宜<br>殖利率＝一年的股利 ÷ 股價・每週公布一次財報、每 4 週除息一次<br>除息當天股價會先扣掉股利，所以不是白拿的喔</div>`; }
      function orderPane(){ const h = hold(s), c = px(s), mult = unit === "l" ? 1000 : 1, up = upP(s), dn = dnP(s);
        if(ot === "l"){ if(!lp) lp = c; lp = Math.min(up, Math.max(dn, rt(lp))); }
        const P = ot === "l" ? lp : c, avQ = Math.max(0, h.q - openSell()), mbS = maxBuy(P), max = Math.floor((side === "buy" ? mbS : avQ) / mult);
        qty = Math.max(1, Math.min(Math.floor(qty) || 1, Math.max(1, max)));
        const sh = qty * mult, amt = sh * P, fee = side === "buy" ? buyFee(amt) : sellFee(amt), ok = max >= 1 && qty <= max, u = unit === "l" ? "張" : "股";
        const will = ot === "l" ? (side === "buy" ? lp >= c : lp <= c) : true;
        return `<div class="skSide"><button data-sd="buy" class="${side === "buy" ? "on up" : ""}">買進</button><button data-sd="sell" class="${side === "sell" ? "on dn" : ""}">賣出</button></div>
          <div class="skOpt"><span>價格</span><div><button data-ot="m" class="${ot === "m" ? "on" : ""}">市價</button>${S.pro ? `<button data-ot="l" class="${ot === "l" ? "on" : ""}">限價</button>` : ""}</div><span>單位</span><div><button data-un="s" class="${unit === "s" ? "on" : ""}">零股</button><button data-un="l" class="${unit === "l" ? "on" : ""}">整張</button></div></div>
          ${ot === "l" ? `<div class="skQty"><button data-lp="-5">－5檔</button><button data-lp="-1">－</button><input id="skLP" inputmode="decimal" value="${lp.toFixed(2)}"><button data-lp="1">＋</button><button data-lp="5">＋5檔</button></div>
            <div class="skHint">${will ? `這個價格現在就會成交（用市價 ${f2(c)}）` : side === "buy" ? `等股價跌到 ${f2(lp)} 以下才會買進` : `等股價漲到 ${f2(lp)} 以上才會賣出`}・一檔 ${tk(lp)}・可掛 ${f2(dn)}～${f2(up)}</div>` : ""}
          <div class="skQty"><button data-q="-10">-10</button><button data-q="-1">-1</button><input id="skQ" inputmode="numeric" value="${qty}"><button data-q="1">+1</button><button data-q="10">+10</button></div>
          <div class="skQuick"><button data-m=".25">1/4</button><button data-m=".5">一半</button><button data-m="1">${side === "buy" ? "買到滿" : "全部賣"}</button><span>${side === "buy" ? `最多可買 ${f0(max)} ${u}` : `可賣 ${f0(max)} ${u}`}</span></div>
          <div class="skCalc"><span>${ot === "l" ? "委託" : "成交"}金額（${fq(sh)}）<b>${f2(amt)}</b></span><span>${side === "buy" ? "手續費 0.1425%" : "手續費＋證交稅 0.3%"} <b>${f2(fee)}</b></span><span>${side === "buy" ? "總共付出" : "實際拿回"} <b>${f2(side === "buy" ? amt + fee : amt - fee)}</b></span>${S.pro && S.resv > 0 && side === "buy" ? `<span>可用現金（扣掉掛單保留）<b>${f2(Math.max(0, S.cash - S.resv))}</b></span>` : ""}</div>
          <button class="btn skGo ${side}" id="skGo" data-max="${max}" ${ok && !busy && S.open ? "" : "disabled"}>${!S.open ? `休市中，${nextTxt()} 開盤` : max < 1 ? (side === "buy" ? `現金不夠買 1 ${u}${unit === "l" ? "，可以改用零股" : ""}` : `沒有${unit === "l" ? "滿 1 張的" : ""}持股可以賣${unit === "l" && avQ ? "，可以改用零股" : ""}`) : `${ot === "l" ? "限價" : "市價"}${side === "buy" ? "買進" : "賣出"} ${f0(qty)} ${u}`}</button>
          <div class="skFoot">${ot === "l" ? "限價單：到你設定的價格才成交，當日有效，可以到「委託」取消" : "市價單：用送出當下的價格馬上成交"}<br>1 張 = 1,000 股，不到一張叫「零股」</div>`; }

      function draw(){
        if(!o.isConnected) return; const c = CO[s], d = chg(s), h = hold(s), g = h.q ? h.q * px(s) - h.c : 0, td = S.td[s], al = S.alerts[s], w = S.watch.includes(s);
        const views = (S.pro ? [["tl", "走勢"]] : []).concat([["1m", "分K"], ["5m", "5分K"], ["1h", "時K"], ["1d", "日K"], ["1w", "週K"], ["1M", "月K"], ["1y", "年K"]]);
        box.innerHTML = `<div class="skDH">${cat(c[2], d >= 0 ? "happy" : "normal")}<div><b>${c[0]} <small>${s}</small></b><small>${c[1]}・${(INFO[s] || [""])[0]}</small></div></div>
          <div class="skBig ${cls(d)}"><b>${f2(px(s))}</b><span>${sign(px(s) - ref(s))}（${sign(d)}%）${badge(s)}</span></div>
          ${S.pro ? `<div class="skActs"><button id="skW" class="${w ? "on" : ""}">${w ? "已加入自選" : "＋自選"}</button><button id="skAl" class="${al ? "on" : ""}">${al ? `提醒：${al.d === "u" ? "漲到" : "跌到"} ${f2(al.p)}` : "到價提醒"}</button></div>` : ""}
          ${td ? `<div class="skToday"><div><small>開盤</small><b class="${cls(td[0] - ref(s))}">${f2(td[0])}</b></div><div><small>最高</small><b class="${cls(td[1] - ref(s))}">${f2(td[1])}</b></div><div><small>最低</small><b class="${cls(td[2] - ref(s))}">${f2(td[2])}</b></div><div><small>總量</small><b>${fv(td[3])}</b></div>
            <div><small>昨收</small><b>${f2(ref(s))}</b></div><div><small>漲停</small><b class="up">${f2(upP(s))}</b></div><div><small>跌停</small><b class="dn">${f2(dnP(s))}</b></div><div><small>振幅</small><b>${((td[1] - td[2]) / ref(s) * 100).toFixed(2)}%</b></div></div>`
            : `<div class="skStat"><span>昨收 <b>${f2(ref(s))}</b></span><span>漲停 <b class="up">${f2(upP(s))}</b></span><span>跌停 <b class="dn">${f2(dnP(s))}</b></span></div>`}
          <div class="skTabs sm k8">${views.map(([k, n]) => `<button data-r="${k}" class="${view === k ? "on" : ""}">${n}</button>`).join("")}</div>
          ${maLegend()}${mainChart()}${all && all.length < 5 && ["1d", "1w", "1M", "1y"].includes(view) ? `<div class="skKNote">股市剛開張，${{ "1d": "每天", "1w": "每週", "1M": "每個月", "1y": "每年" }[view]}會多一根 K 棒，過一陣子就會越來越長</div>` : ""}
          ${S.pro && view !== "tl" ? `<div class="skTabs sm k4">${[["vol", "成交量"], ["kd", "KD"], ["macd", "MACD"], ["rsi", "RSI"]].map(([k, n]) => `<button data-sb="${k}" class="${sub === k ? "on" : ""}">${n}</button>`).join("")}</div>` : ""}${S.pro ? subChart() : ""}
          ${h.q ? `<div class="skMine">你有 <b>${fq(h.q)}</b>・均價 ${f2(h.c / h.q)}・損益 <b class="${cls(g)}">${sign(g)}</b></div>` : ""}
          ${S.pro ? `<div class="skTabs sm k4 pn">${[["order", "下單"], ["book", "五檔"], ["tick", "明細"], ["fund", "基本面"]].map(([k, n]) => `<button data-pn="${k}" class="${pane === k ? "on" : ""}">${n}</button>`).join("")}</div>` : ""}
          ${S.pro ? "" : extra()}${pane === "book" ? bookPane() : pane === "tick" ? tickPane() : pane === "fund" ? fundPane() : orderPane()}
          <button class="btn sub" id="skX" style="width:100%">關閉</button>`;
        const on = (sel, fn) => box.querySelectorAll(sel).forEach(b => b.addEventListener("click", () => { SFX.tap(); fn(b); }));
        on("[data-r]", b => { view = b.dataset.r; loadH(); });
        on("[data-sb]", b => { sub = b.dataset.sb; draw(); });
        on("[data-pn]", b => { pane = b.dataset.pn; if(pane === "book" || pane === "tick") loadQ(); draw(); });
        on("[data-sd]", b => { side = b.dataset.sd; qty = 1; draw(); });
        on("[data-ot]", b => { ot = b.dataset.ot; if(ot === "l" && !lp) lp = px(s); draw(); });
        on("[data-un]", b => { unit = b.dataset.un; qty = 1; draw(); });
        on("[data-lp]", b => { let n = +b.dataset.lp; while(n > 0){ lp = r2(lp + tk(lp)); n--; } while(n < 0){ lp = r2(lp - tk(lp - .001)); n++; } draw(); });
        on("[data-q]", b => { qty += +b.dataset.q; draw(); });
        on("[data-m]", b => { const g2 = box.querySelector("#skGo"); qty = Math.max(1, Math.floor(num(g2 && g2.dataset.max) * (+b.dataset.m))); draw(); });
        on("[data-bp]", b => { ot = "l"; lp = num(b.dataset.bp); pane = "order"; draw(); });
        const inp = box.querySelector("#skQ"); if(inp) inp.addEventListener("change", () => { qty = parseInt(inp.value.replace(/\D/g, ""), 10) || 1; draw(); });
        const li = box.querySelector("#skLP"); if(li) li.addEventListener("change", () => { lp = num(parseFloat(li.value.replace(/[^\d.]/g, "")), px(s)) || px(s); draw(); });
        box.querySelector("#skX").addEventListener("click", () => { o.remove(); detail = null; });
        const go = box.querySelector("#skGo"); if(go) go.addEventListener("click", trade);
        const wb = box.querySelector("#skW"); if(wb) wb.addEventListener("click", async () => { wb.disabled = true; SFX.tap(); try{ const r = await ctx.rpc("stock_watch", { p_sym: s }); if(r && r.ok){ S.watch = (Array.isArray(r.watch) ? r.watch : []).filter(x => CO[x]); ctx.toast(r.on ? "加入自選了，在「行情」按「自選」就看得到" : "從自選拿掉了"); render(); } }catch(e){ ctx.toast("連不上交易所，再試一次"); } draw(); });
        const ab = box.querySelector("#skAl"); if(ab) ab.addEventListener("click", alertAsk);
        const rb = box.querySelector("#skRecB"); if(rb) rb.addEventListener("click", async () => { rb.disabled = true; SFX.tap();
          try{ const r = await ctx.rpc("stock_recommend", { p_sym: s }); if(r && r.ok){ SFX.select(); ctx.toast(r.on ? `你推薦了 ${c[0]}！` : "取消推薦了"); } else ctx.toast(r && r.reason === "max" ? "最多只能推薦 3 檔，先取消一檔再來" : "按太快了，等一下再試"); }
          catch(e){ ctx.toast("連不上交易所，再試一次"); }
          await loadRec(); render(); draw(); });
      }
      function alertAsk(){ SFX.tap(); const cur = S.alerts[s]; let p = cur ? cur.p : rt(px(s) * 1.03);
        const m = document.createElement("div"); m.className = "careModal skTut skAlM"; document.body.appendChild(m);
        const dr = () => { p = Math.max(.01, rt(p)); const dir = p > px(s) ? "u" : "d";
          m.innerHTML = `<div class="cmBox skBox"><div class="skTutH">${cat("gray", "happy")}<div><small>${CO[s][0]}・現在 ${f2(px(s))}</small><b>到價提醒</b></div></div>
            <p class="skTutP">設定一個價格，股價${dir === "u" ? "<b class='up'>漲到</b>" : "<b class='dn'>跌到</b>"}這個價格時，你下次打開股市就會收到提醒。每檔股票可以設一個。</p>
            <div class="skQty"><button data-a="-5">－5檔</button><button data-a="-1">－</button><input id="skAP" inputmode="decimal" value="${p.toFixed(2)}"><button data-a="1">＋</button><button data-a="5">＋5檔</button></div>
            <div class="skTutB">${cur ? `<button class="btn sub" data-a="del">取消提醒</button>` : `<button class="btn sub" data-a="x">先不要</button>`}<button class="btn" data-a="ok">設定提醒</button></div></div>`;
          const ip = m.querySelector("#skAP"); ip.addEventListener("change", () => { p = num(parseFloat(ip.value.replace(/[^\d.]/g, "")), p) || p; dr(); });
          m.querySelectorAll("button").forEach(b => b.addEventListener("click", async () => { const a = b.dataset.a; SFX.tap();
            if(a === "x"){ m.remove(); return; } if(a !== "ok" && a !== "del"){ let n = +a; while(n > 0){ p = r2(p + tk(p)); n--; } while(n < 0){ p = r2(p - tk(p - .001)); n++; } dr(); return; }
            b.disabled = true; try{ const r = await ctx.rpc("stock_alert", { p_sym: s, p_price: a === "del" ? 0 : p }); if(r && r.ok){ ctx.toast(a === "del" ? "提醒取消了" : `設定好了：${dir === "u" ? "漲到" : "跌到"} ${f2(p)} 會提醒你`); m.remove(); await load(true); draw(); return; } ctx.toast("這個價格跟現在一樣，換一個價格吧"); }
            catch(e){ ctx.toast("連不上交易所，再試一次"); } b.disabled = false; })); };
        m.addEventListener("click", e => { if(e.target === m) m.remove(); }); dr(); }
      async function trade(){
        const h = hold(s), mult = unit === "l" ? 1000 : 1, sh = qty * mult; if(busy || sh < 1) return; busy = true; draw(); SFX.select();
        try{ const r = ot === "l" ? await ctx.rpc("stock_order", { p_sym: s, p_side: side === "buy" ? "b" : "s", p_price: lp, p_qty: sh }) : await ctx.rpc("stock_trade", { p_sym: s, p_qty: side === "buy" ? sh : -sh });
          if(r && r.ok && (ot === "m" || r.filled)){ SFX.coin ? SFX.coin() : SFX.select(); receipt(s, side, sh, r); if(ctx.burst) ctx.burst(); if(Array.isArray(r.new_badges) && r.new_badges.length) setTimeout(() => badgePop(r.new_badges), 500); qty = 1; }
          else if(r && r.ok){ SFX.select(); modal("skOrdPop", `<div class="skTutH">${cat("gray", "happy")}<div><small>委託回報</small><b>掛單成功，等待成交</b></div></div><div class="skRcpT"><span>股票</span><b>${esc(CO[s][0])}</b><span>買賣</span><b class="${side === "buy" ? "up" : "dn"}">限價${side === "buy" ? "買進" : "賣出"}</b><span>委託價</span><b>${f2(num(r.limit, lp))}</b><span>數量</span><b>${fq(sh)}</b></div><p class="skMsg small">${side === "buy" ? "股價跌到這個價格以下" : "股價漲到這個價格以上"}就會自動成交，不用一直盯著。可以到「委託」分頁查看或取消，今天沒成交的話半夜 12 點會自動失效。</p>`); qty = 1; }
          else ctx.toast(r && r.reason === "closed" ? "現在休市中，開盤後才能買賣" : r && r.reason === "too_fast" ? "下單太快了，等 2 秒再試" : r && r.reason === "cash" ? "可用現金不夠（價格可能剛變，或被其他掛單保留了）" : r && r.reason === "shares" ? "可賣的持股不夠（有些可能已經掛賣了）" : r && r.reason === "limit" ? "價格不能超過今天的漲停或跌停" : r && r.reason === "max" ? "一次最多掛 10 筆委託，先取消幾筆吧" : "沒有成交，再試一次"); }
        catch(e){ ctx.toast("連不上交易所，這筆沒有成交"); }
        busy = false; await load(true); draw();
      }
      detail = { refresh: () => { draw(); if(all && (view === "tl" || view === "1m" || S.t % 5 === 0)) loadH(true); if(pane === "book" || pane === "tick") loadQ(); } };
      draw(); loadH();
    }

    render(); load().then(schedule);
    this._stop = () => { alive = false; clearTimeout(timer); document.removeEventListener("visibilitychange", onVis); document.querySelectorAll(".skDet,.skTut,.skAlM").forEach(x => x.remove()); };
  },
  unmount(){ if(this._stop) this._stop(); },
});
if(window.GameArt) window.GameArt.stock = () => `<span class="gaL" style="left:6%;top:8%;width:88%"><svg viewBox="0 0 44 22" style="width:100%"><rect width="44" height="22" fill="#fff" stroke="#5a3b2e" stroke-width="1.2"/><path d="M3 17l5-4 4 2 5-7 4 3 5-6 4 4 5-6 5 3" fill="none" stroke="#e5484d" stroke-width="1.6"/></svg></span><span class="gaL" style="right:2%;bottom:0;width:36%">${Pix.sprite("gray", "happy")}</span>`;
})();

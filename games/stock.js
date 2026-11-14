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
  hold3: ["長期股東", "同一檔抱超過 3 天", "抱", "#7cc98a"], div5: ["分散投資", "同時持有 5 家公司", "五", "#7ab8f0"],
  div10: ["貓咪基金", "同時持有 10 家公司", "十", "#5b8def"], a12k: ["小有收穫", "總資產突破 12,000", "升", "#f6a65a"],
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
// 股東小故事：抱滿 1 天解鎖上篇、抱滿 3 天解鎖下篇（全部虛構）
const STORY = {
  MEOW: ["晶晶小時候最愛拆收音機，媽媽以為牠在搗蛋，其實牠在數裡面有幾顆零件。數到第 100 顆那天，牠決定長大要做全世界最小的零件。", "第一顆喵晶片做出來的那晚，晶晶興奮得把它推下桌子（貓的本能）。現在公司大廳還擺著那顆摔出缺角的晶片，底下寫著：「好東西要經得起推。」"],
  PAW: ["元寶從小就把小魚乾分成三堆：今天吃的、明天吃的、不能吃的。鄰居的貓都把吃不完的寄放在牠那裡，肉球銀行就這樣開張了。", "有一年冬天鬧魚荒，大家都來領小魚乾。元寶一隻都沒少給，自己餓了三天。從此貓咪們說：「放在元寶那裡，比放在自己肚子裡還安心。」"],
  TOY: ["跳跳追自己的尾巴追了一整個下午，突然想通一件事：「會動的東西最好玩！」隔天牠把羽毛綁在竹竿上，做出第一支逗貓棒。", "公司做過最失敗的產品是「不會動的逗貓棒」。跳跳沒有罵誰，只是把它掛在辦公室牆上提醒大家：好玩，比省錢重要。"],
  CAN: ["阿肥以前是流浪貓，最懂餓肚子的感覺。牠在巷口撿到第一個空罐頭的時候就發誓：以後要讓每隻貓都有罐罐可以開。", "工廠每天做出來的第一個罐罐不賣，阿肥會親自送去巷口給流浪貓。牠說那不是做公益，是「回老家吃飯」。"],
  FISH: ["浪浪其實很怕水。牠當船長的理由很簡單：只有自己開船，才能確定船不會翻。牠的船上到處都貼著「請勿搖晃」。", "有一次遇到大風浪，整船小魚乾差點泡湯。浪浪閉著眼睛把船開回港口，下船後腿軟了一小時，隔天照樣準時出航。"],
  SAND: ["砂砂有潔癖，最受不了貓砂被踢得滿地都是。牠把自己關在實驗室三個月，出來的時候全身都是砂，手上拿著第一包「不會飛的貓砂」。", "有貓問砂砂為什麼公司這麼低調。牠說：「貓砂做得好，就是沒有貓會注意到它。」然後默默把對方腳上的一粒砂撿走。"],
  NAP: ["呼嚕試睡過一千個紙箱，筆記本上寫滿評語：「太大，沒安全感」「太小，屁股露出來」。第一千零一個，牠睡了整整兩天。", "午睡紙箱的員工每天下午都要睡午覺，這是規定。呼嚕說：「自己都沒睡飽，怎麼做得出讓別的貓好睡的箱子？」"],
  NIP: ["草草第一次聞到貓草時，在地上滾了三圈，然後立刻拿出筆記本記錄：「滾三圈，持續十分鐘。」從此牠的研究停不下來。", "草草的實驗常常失敗，有一次整間實驗室的貓都睡了一整天。但牠從不氣餒，總說下一株一定最香。這句話牠已經說了十年。"],
  CLAW: ["尖尖以前在喵晶片上班，提了一百個點子，九十九個被退回。牠把那疊退件帶走，在車庫裡開了利爪半導體。", "尖尖的辦公桌上放著晶晶送的開業花籃，卡片寫著：「放馬過來。」兩隻貓白天搶訂單，晚上還是會一起去吃宵夜。"],
  TREE: ["高高小時候個子最小，什麼都看不到。牠疊了三個箱子爬上去，第一次看見整條街的屋頂，就決定這輩子都要往高處蓋。", "每棟貓跳台大樓的頂樓，高高都會留一個小平台不賣。那是給個子小的貓看風景用的，免費，而且永遠有位子。"],
  COIN: ["金金是元寶的徒弟，覺得師父的銀行排隊排太久。牠想出一個不用出門就能存小魚乾的方法，貓幣信託就這樣上線了。", "開幕那天，第一位客人是元寶。牠存了一隻小魚乾，說：「我來看看徒弟的店。」金金把那隻小魚乾裱起來，到現在還掛在牆上。"],
  TUNA: ["阿鮪是個挑嘴的美食家，普通罐罐聞一下就走。牠花了兩年吃遍各地的鮪魚，才找到願意放進自己罐頭的那一種。", "鮪魚王的罐罐不便宜，有貓抱怨。阿鮪於是每個月辦一次試吃日，請大家免費吃。牠說：「可以嫌貴，不可以沒吃過。」"],
  LASR: ["閃閃追紅點追了一輩子，從來沒抓到過。有一天牠想：「既然抓不到，不如我來當那個紅點。」公司的第一款遊戲就叫《抓不到》。", "公司有一條規定：每款遊戲都要讓玩家「差一點點」就抓到。閃閃說，那種差一點點的感覺，才是貓生最大的樂趣。"],
  YARN: ["毛線球紡織已經傳了五代。捲捲小時候最常做的事，就是被毛線纏住，等爺爺來救。牠說這門手藝就是這樣學會的。", "每年冬天的第一顆毛線球，捲捲都會親手捲好，送給街上最老的那隻貓。牠說毛線球會舊，但被惦記的感覺不會。"],
  SUN: ["暖暖發現全城最暖的窗台，每天只有下午兩點到四點曬得到太陽。牠在那裡放了一塊墊子，掛上牌子：「一次十分鐘，請排隊。」", "陰天沒有生意的時候，暖暖也照常開門。牠會泡一壺熱茶，陪上門的貓一起等太陽。牠說：「等的時候有伴，就不算白等。」"],
  MILK: ["拿鐵有一次不小心把鬍鬚沾到奶泡，照鏡子時笑了好久。牠想讓每隻貓都有這樣的一天，於是開了第一家奶泡咖啡。", "奶泡咖啡還沒開始賺錢，朋友都勸牠少開幾家。拿鐵說：「每條街都該有一個可以坐下來發呆的地方。」然後又簽了一間店面。"],
};
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
    let S = null, REC = { counts: {}, mine: [], ok: false }, alive = true, tab = "mkt", rk = "all", timer = 0, err = "", busy = false, detail = null;
    const me = () => ctx.me.uid;
    const cat = (c, mood) => `<span class="skCat">${ctx.sprite(c || "orange", mood || "normal")}</span>`;
    const px = s => num(S.px[s]), ref = s => num(S.ref[s], px(s));
    const chg = s => { const r = ref(s); return r ? (px(s) - r)/r*100 : 0; };
    const lim = s => { const r = ref(s); return px(s) >= Math.floor(r*110)/100 - .005 ? 1 : px(s) <= Math.ceil(r*90)/100 + .005 ? -1 : 0; };
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
    const stWait = (s, lv) => { const h = hold(s); if(!h.q || !h.s) return ""; const left = (lv === 1 ? 86400 : 259200) - (S.now - h.s); if(left <= 0) return "快解鎖了"; return left >= 86400 ? `再抱 ${Math.ceil(left / 86400)} 天` : `再抱 ${Math.max(1, Math.ceil(left / 3600))} 小時`; };
    function modal(cls, html){ const o = document.createElement("div"); o.className = "careModal skTut " + cls; o.innerHTML = `<div class="cmBox skBox">${html}<button class="btn" style="width:100%" data-x="1">知道了</button></div>`; document.body.appendChild(o);
      const close = () => o.remove(); o.querySelector("[data-x]").addEventListener("click", () => { SFX.tap(); close(); }); o.addEventListener("click", e => { if(e.target === o) close(); }); return o; }
    function badgePop(ids){ ids = (ids || []).filter(x => BADGES[x]); if(!ids.length || !alive) return; SFX.level ? SFX.level() : SFX.select(); if(ctx.burst) ctx.burst();
      modal("skBdgPop", `<div class="skTutH">${cat("gray", "happy")}<div><small>成就達成</small><b>獲得${ids.length > 1 ? ` ${ids.length} 個` : ""}徽章！</b></div></div><div class="skBdgNew">${ids.map(x => `<div>${medal(x, true)}<b>${BADGES[x][0]}</b><small>${BADGES[x][1]}</small></div>`).join("")}</div>`); }
    function storyPop(s, i){ if(stLv(s) <= i) return; SFX.tap(); const c = CO[s];
      modal("skStoryPop", `<div class="skTutH">${cat(c[2], "happy")}<div><small>${c[0]}・股東小故事</small><b>${c[1]}（${i ? "下" : "上"}篇）</b></div></div><p class="skTutP">${esc(STORY[s][i])}</p>`); }
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
        dy_base: num(r.dy_base), wk_base: num(r.wk_base), wpct: num(r.wpct), wrank: num(r.wrank, 1), wplayers: num(r.wplayers), nprofit: r.nprofit == null ? null : num(r.nprofit), ntotal: num(r.ntotal), nrank: num(r.nrank, 1), nests: num(r.nests), nsolo: !!r.nsolo, ydy: String(r.ydy || "").replace(/[^0-9-]/g, "").slice(0, 10), ybase: num(r.ybase), ydiff: num(r.ydiff), yref: null };
      if(r.yref && typeof r.yref === "object"){ o.yref = {}; for(const s of SYMS) o.yref[s] = num(r.yref[s]); }
      if(r.badges && typeof r.badges === "object") for(const k of Object.keys(BADGES)) if(r.badges[k]) o.badges[k] = num(r.badges[k]);
      o.new_badges = (Array.isArray(r.new_badges) ? r.new_badges : []).filter(x => typeof x === "string" && BADGES[x]).slice(0, 15);
      const who = x => ({ name: String(x && x.name || "").slice(0, 3), cat: String(x && x.cat || "orange").replace(/[^a-z]/g, "").slice(0, 12) });
      o.wtop = (Array.isArray(r.wtop) ? r.wtop : []).slice(0, 10).map(x => Object.assign(who(x), { pct: num(x && x.pct), me: !!(x && x.me) }));
      o.ntop = (Array.isArray(r.ntop) ? r.ntop : []).slice(0, 10).map(x => ({ profit: num(x && x.profit), total: num(x && x.total), me: !!(x && x.me), who: (Array.isArray(x && x.who) ? x.who : []).slice(0, 2).map(who) }));
      for(const s of SYMS){ o.px[s] = num(r.px[s], 1); o.ref[s] = num(r.ref && r.ref[s], o.px[s]); if(r.hold && r.hold[s]) o.hold[s] = { q: num(r.hold[s].q), c: num(r.hold[s].c), s: num(r.hold[s].s) }; if(r.stories && typeof r.stories === "object") o.stories[s] = Math.min(2, Math.max(0, Math.floor(num(r.stories[s])))); }
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
      ["股票是什麼？", "買一家公司的股票，就像當它的小股東。公司變值錢，你手上的股票也跟著變貴。<br><b>這只是遊戲，不是賭博</b>：公司是虛構的，錢是遊戲裡的虛擬資金，不能儲值、也不能換成現金或獎品，放心玩！"],
      ["怎麼賺錢？", "口訣只有四個字：<b>低買高賣</b>。便宜的時候買進，等它漲了再賣出，中間的價差就是你賺的。反過來，買貴了又賣便宜就會虧。"],
      ["紅色、綠色是什麼？", "<b class='up'>紅色是漲</b>、<b class='dn'>綠色是跌</b>（跟台灣的股市一樣）。旁邊的百分比是跟昨天比漲跌多少。一天最多漲 10%（漲停）或跌 10%（跌停）。"],
      ["什麼時候可以玩？", "<b>24 小時都能買賣</b>，價格每分鐘跳一次。每天半夜 12 點（台灣時間）換日，漲停跌停會用前一天最後的價格重新計算。"],
      ["怎麼買賣？", "在「行情」點一家公司，選「買進」或「賣出」，填要幾股，按下去就成交。每次買賣會收一點點手續費，所以不要買了馬上賣，會白白虧手續費喔。"],
      ["怎麼看那張圖？", "圖上一根一根的叫 K 線：<b class='up'>紅色</b>代表那段時間漲了，<b class='dn'>綠色</b>代表跌了，越長代表漲跌越多。整體往右上走就是在漲。"],
      ["新聞和推薦", "「新聞」會有好消息、壞消息，股價會跟著動。每檔股票旁邊看得到<b>全站有幾個人推薦</b>，你也可以推薦最多 3 檔給大家參考（不會顯示是誰推薦的）。"],
      ["還有這些好玩的", "<b>成就徽章</b>：達成目標就能蒐集。<b>股東小故事</b>：同一檔抱久一點，可以解鎖貓老闆的故事。<b>排行</b>除了比總資產，還有每週漲幅榜和小窩合作榜，新手也有機會上榜！"],
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
        render(); if(detail) detail.refresh(); if(S.new_badges.length) badgePop(S.new_badges); else if(!detail) setTimeout(() => { if(alive && S) reportPop(); }, first ? 900 : 0); }
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
    const HOURS = "24 小時開盤・每天 0:00 換日";
    function render(){
      if(!alive) return;
      if(!S){ el.innerHTML = `<div class="box skBox"><div class="skHead"><b>貓貓股市</b></div><p class="skMsg">${err ? esc(err) : "交易所連線中…"}</p>${err ? `<button class="btn sub" id="skRetry">再試一次</button>` : ""}</div>`;
        const r = el.querySelector("#skRetry"); if(r) r.addEventListener("click", () => { err = ""; render(); load(); }); return; }
      const p = pnl();
      let body = "";
      if(tab === "mkt") body = `${S.fun ? `<div class="skSub">今日小報（每天 0:00 換日）</div>${repBody()}` : ""}<div class="skList">${SYMS.map(s => { const c = CO[s], h = hold(s), d = chg(s);
          return `<button class="skRow" data-s="${s}">${cat(c[2])}<span class="skNm"><b>${c[0]}</b><small>${s}${recN(s) ? `・<u class="skRec">${f0(recN(s))} 人推薦</u>` : ""}${h.q ? `・持有 ${f0(h.q)} 股` : ""}</small></span>${spark(s)}<span class="skPx ${cls(d)}"><b>${f2(px(s))}</b><small>${d > 0.004 ? "▲" : d < -0.004 ? "▼" : ""}${Math.abs(d).toFixed(2)}%${badge(s)}</small></span></button>`; }).join("")}</div>
        <div class="skFoot">紅色是漲、綠色是跌・漲跌停 ±10%<br>${HOURS}</div><div class="skNote">這只是遊戲，不是賭博也不是投資。資金是虛擬的，不能儲值、不能換成現金或獎品；公司和新聞都是虛構的。</div>`;
      if(tab === "hold"){ const hs = SYMS.filter(s => hold(s).q > 0);
        body = `${hs.length ? `<div class="skList">${hs.map(s => { const h = hold(s), v = h.q*px(s), g = v - h.c;
            return `<button class="skRow" data-s="${s}">${cat(CO[s][2])}<span class="skNm"><b>${CO[s][0]}</b><small>${f0(h.q)} 股・均價 ${f2(h.c/h.q)}</small></span><span class="skPx ${cls(g)}"><b>${f2(v)}</b><small>${sign(g)}（${sign(h.c ? g/h.c*100 : 0)}%）</small></span></button>`; }).join("")}</div>` : `<p class="skMsg">還沒有持股，去「行情」挑一檔吧！</p>`}
          <div class="skSub">交易紀錄</div>${S.trades.length ? `<div class="skLog">${S.trades.map(x => `<div class="${x.qty > 0 ? "up" : "dn"}"><em>${new Date(x.at*1000).toLocaleString("zh-TW", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })}</em><b>${x.qty > 0 ? "買" : "賣"}</b><span>${CO[x.sym][0]} ${f0(Math.abs(x.qty))} 股 @ ${f2(x.price)}</span><i>費 ${f2(x.fee)}</i></div>`).join("")}</div>` : `<p class="skMsg small">還沒有交易</p>`}`; }
      if(tab === "news") body = S.news.length ? `<div class="skFeed">${S.news.map(newsLine).join("")}</div>` : `<p class="skMsg">目前風平浪靜，沒有新聞</p>`;
      if(tab === "rank"){ const pt = ctx.partner(), ta = pt && S.nest.find(x => x.uid === pt.user_id);
        const seg = S.fun ? `<div class="skTabs sm">${[["all", "總資產"], ["week", "本週漲幅"], ["nest", "小窩合作"]].map(([k, n]) => `<button data-rk="${k}" class="${rk === k ? "on" : ""}">${n}</button>`).join("")}</div>` : "";
        if(S.fun && rk === "week") body = `${seg}<div class="skMe">你這週 <b class="${cls(S.wpct)}">${sign(S.wpct)}%</b><small>${S.trades.length || S.wplayers ? `第 ${S.wrank} 名／${Math.max(S.wplayers, S.wrank)} 位這週有上線的股民` : "下單之後就會進榜"}</small></div>
          <div class="skSub">本週漲幅前 10 名</div><div class="skTop">${S.wtop.length ? S.wtop.map((x, i) => `<div class="${x.me ? "me" : ""}"><em>${i + 1}</em>${cat(x.cat)}<b>${esc(x.name)}${x.me ? "（你）" : ""}</b><span class="${cls(x.pct)}">${sign(x.pct)}%</span></div>`).join("") : `<p class="skMsg small">這週還沒有人上榜，快去搶第一！</p>`}</div>
          <div class="skFoot">比的是這一週資產成長幾 %，不是比誰錢多，新手也能上榜<br>每週一 0:00 重新起算・救濟金不算漲幅</div>`;
        else if(S.fun && rk === "nest") body = `${seg}<div class="skMe">${S.nprofit === null ? `你們小窩還沒上榜<small>下過一次單就會進榜</small>` : `小窩合計獲利 <b class="${cls(S.nprofit)}">${sign(S.nprofit)}</b><small>${S.nsolo ? "單人" : "雙人"}小窩組第 ${S.nrank} 名／${Math.max(S.nests, S.nrank)} 個小窩・合計資產 ${f0(S.ntotal)}</small>`}</div>
          ${pt && !ta ? `<p class="skMsg small">${esc(pt.name)} 還沒開戶，叫 ta 一起來幫小窩賺錢吧！</p>` : ""}
          <div class="skSub">${S.nsolo ? "單人" : "雙人"}小窩組・前 10 名</div><div class="skTop nest">${S.ntop.length ? S.ntop.map((x, i) => `<div class="${x.me ? "me" : ""}"><em>${i + 1}</em><i>${x.who.map(w => cat(w.cat)).join("")}</i><b>${x.who.map(w => esc(w.name)).join(" & ")}${x.me ? "（你們）" : ""}</b><span class="${cls(x.profit)}">${x.profit > 0 ? "+" : ""}${f0(x.profit)}</span></div>`).join("") : `<p class="skMsg small">還沒有小窩上榜</p>`}</div>
          <div class="skFoot">${S.nsolo ? "單人小窩只跟單人小窩比，公平競爭" : "把兩個人賺的錢加起來排名（每人從 10,000 起算）<br>雙人小窩只跟雙人小窩比，單人小窩有自己的榜"}</div>`;
        else body = seg + `<div class="skMe">你在全站排第 <b>${S.rank}</b> 名<small>／${Math.max(S.players, S.rank)} 位有下過單的股民</small></div>
          ${pt ? `<div class="skVs"><div>${cat(ctx.me.cat, "happy")}<b>你</b><span>${f0(S.assets)}</span></div><i>VS</i><div>${cat(pt.cat, "happy")}<b>${esc(pt.name)}</b><span>${ta ? f0(ta.assets) : "還沒開戶"}</span></div></div>` : ""}
          ${REC.ok ? `<div class="skSub">大家推薦（每人最多推薦 3 檔，不會顯示是誰）</div><div class="skRecs">${SYMS.slice().sort((a, b) => recN(b) - recN(a)).map(s => { const mx = Math.max(1, ...SYMS.map(recN)); return `<button class="skRow skRecRow" data-s="${s}"><b>${CO[s][0]}${REC.mine.includes(s) ? `<i>你推薦</i>` : ""}</b><span><i style="width:${Math.round(recN(s)/mx*100)}%"></i></span><em>${f0(recN(s))} 人</em></button>`; }).join("")}</div>` : ""}
          <div class="skSub">全站前 10 名（名字只顯示第一個字）</div><div class="skTop">${S.top.length ? S.top.map((x, i) => `<div class="${x.me ? "me" : ""}"><em>${i + 1}</em>${cat(x.cat)}<b>${esc(x.name)}${x.me ? "（你）" : ""}</b><span>${f0(x.assets)}</span></div>`).join("") : `<p class="skMsg small">還沒有人下單，快去當第一名！</p>`}</div>`; }
      if(tab === "fun" && S.fun){ const ids = Object.keys(BADGES).filter(x => !(x === "duo" && S.nsolo && !S.badges.duo)), got = ids.filter(x => S.badges[x]).length, sn = SYMS.reduce((a, x) => a + stLv(x), 0);
        body = `<div class="skSub">成就徽章　${got} / ${ids.length}</div><div class="skBdg">${ids.map(x => `<div class="${S.badges[x] ? "on" : ""}">${medal(x, !!S.badges[x])}<b>${BADGES[x][0]}</b><small>${BADGES[x][1]}</small></div>`).join("")}</div>
          <div class="skSub">股東小故事　${sn} / ${SYMS.length * 2}</div><p class="skMsg small">同一檔股票抱滿 1 天解鎖上篇、抱滿 3 天解鎖下篇，賣掉再買會重新計算。解鎖過的故事會一直留著。</p>
          <div class="skStories">${SYMS.map(x => { const lv = stLv(x), c = CO[x]; return `<div>${cat(c[2])}<span><b>${c[1]}</b><small>${c[0]}</small></span>${[0, 1].map(i => lv > i ? `<button class="on" data-st="${x}" data-i="${i}">${i ? "下篇" : "上篇"}</button>` : `<button disabled>${lv === i && stWait(x, i + 1) ? stWait(x, i + 1) : (i ? "抱 3 天" : "抱 1 天")}</button>`).join("")}</div>`; }).join("")}</div>`; }
      el.innerHTML = `<div class="box skBox">
        <div class="skHead"><b>貓貓股市</b><button class="skHelp" id="skHelp">？新手教學</button><span class="skLive ${S.open ? "" : "off"}"><i></i>${S.open ? "開盤中" : "休市中"}</span></div>${S.open ? "" : `<div class="skClosed"><b>現在休市中，${nextTxt()} 開盤</b><small>${HOURS}<br>休市時價格不會動，也不能買賣，可以先研究要買哪一檔</small></div>`}
        <div class="skAcct"><div><small>總資產</small><b>${f2(S.assets)}</b></div><div><small>現金</small><b>${f2(S.cash)}</b></div><div class="${cls(p)}"><small>總損益</small><b>${sign(p)}</b></div></div>
        ${S.can_bail ? `<button class="btn skBail" id="skBail">資產不到 1,000…領今天的救濟金 2,000</button>` : ""}
        <div class="skTabs ${S.fun ? "five" : ""}">${[["mkt", "行情"], ["hold", "持股"], ["news", "新聞"], ["rank", "排行"]].concat(S.fun ? [["fun", "成就"]] : []).map(([k, n]) => `<button data-t="${k}" class="${tab === k ? "on" : ""}">${n}</button>`).join("")}</div>
        ${body}</div>`;
      el.querySelectorAll(".skTabs button[data-t]").forEach(b => b.addEventListener("click", () => { tab = b.dataset.t; SFX.tap(); render(); }));
      el.querySelectorAll(".skRow").forEach(b => b.addEventListener("click", () => openDetail(b.dataset.s)));
      el.querySelectorAll("[data-rk]").forEach(b => b.addEventListener("click", () => { rk = b.dataset.rk; SFX.tap(); render(); }));
      el.querySelectorAll("[data-st]").forEach(b => b.addEventListener("click", () => storyPop(b.dataset.st, +b.dataset.i)));
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
          ${S.fun ? `<div class="skStLine">股東故事 ${stLv(s)} / 2${stLv(s) >= 2 ? "・全部解鎖了，到「成就」看" : h.q ? `・${stWait(s, stLv(s) + 1)}解鎖${stLv(s) ? "下" : "上"}篇` : "・買進並抱滿 1 天，解鎖老闆的故事"}</div>` : ""}
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
          if(r && r.ok){ SFX.coin ? SFX.coin() : SFX.select(); receipt(s, side, qty, r); if(ctx.burst) ctx.burst(); if(Array.isArray(r.new_badges) && r.new_badges.length) setTimeout(() => badgePop(r.new_badges), 500); qty = 1; }
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

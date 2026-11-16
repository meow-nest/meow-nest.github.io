// 遊戲：你畫我猜（合作）。一個人選題目畫畫，另一個人用注音鍵盤猜；答對兩個人一起得分，還會幫我們的貓賺小魚乾。
// 同步方式：畫完一筆（手指離開）就把這一筆寫進 game_state，對方那邊會把這一筆「畫出來」的動畫重播。
(function(){
let WORDS_B;
const WORDS = {
  "動物": ["貓咪","小狗","兔子","熊貓","長頸鹿","大象","企鵝","烏龜","章魚","金魚","老虎","獅子","猴子","蛇","恐龍","刺蝟","青蛙","蝴蝶","蜜蜂","螃蟹","鯨魚","鯊魚","小雞","豬","牛","馬","羊","老鼠","貓頭鷹","天鵝","孔雀","海豚","蝸牛","無尾熊","袋鼠","斑馬","鱷魚","狐狸","松鼠","水母","河馬","犀牛","駱駝","北極熊","浣熊","倉鼠","鸚鵡","火烈鳥","啄木鳥","蜘蛛","螞蟻","瓢蟲","蜻蜓","蚊子","毛毛蟲","海星","海馬","龍蝦","蝦子","魷魚","獨角獸","龍","鴨子","鵝","公雞","母雞","乳牛","狼","熊","鹿","蝙蝠","鴿子","麻雀","老鷹","河豚","烏鴉","柴犬","臘腸狗","哈士奇","黑貓","樹懶","水獺","羊駝","海獺","鯉魚","變色龍","蚯蚓","螢火蟲","蠍子"],
  "食物": ["蛋糕","披薩","漢堡","薯條","壽司","拉麵","珍珠奶茶","冰淇淋","西瓜","香蕉","蘋果","草莓","葡萄","鳳梨","荷包蛋","飯糰","水餃","熱狗","甜甜圈","棒棒糖","巧克力","吐司","咖啡","雞腿","玉米","胡蘿蔔","布丁","餅乾","爆米花","火鍋","小籠包","粽子","月餅","檸檬","櫻桃","鬆餅","蛋塔","泡麵","便當","烤肉","臭豆腐","滷肉飯","牛肉麵","雞排","地瓜","芒果","奇異果","桃子","酪梨","椰子","茄子","番茄","南瓜","香菇","花椰菜","洋蔥","辣椒","黃瓜","豆漿","油條","蛋餅","包子","饅頭","湯圓","刨冰","豆花","鹹酥雞","蚵仔煎","烤香腸","關東煮","三明治","義大利麵","牛排","炸蝦","生魚片","章魚燒","鯛魚燒","馬卡龍","杯子蛋糕","生日蛋糕","果凍","可樂","牛奶","啤酒","紅酒","柳橙汁","茶","蜂蜜","起司","奶油","麵包","可頌","貝果","雞蛋","炒飯","咖哩飯","涼麵","鍋貼","春捲","烤地瓜","棉花糖","口香糖","洋芋片","糖葫蘆","冰棒","優格"],
  "東西": ["手機","雨傘","眼鏡","帽子","襪子","鞋子","牙刷","剪刀","鉛筆","吹風機","電視","時鐘","鑰匙","氣球","禮物","蠟燭","風箏","吉他","鋼琴","相機","耳機","枕頭","沙發","馬桶","檯燈","書包","戒指","口紅","鏡子","梳子","電腦","滑板","腳踏車","汽車","飛機","火箭","帆船","火車","熱氣球","雪人","牙膏","毛巾","衛生紙","垃圾桶","掃把","拖把","洗衣機","冰箱","微波爐","電風扇","冷氣","電燈泡","插頭","電池","遙控器","鬧鐘","手錶","錢包","背包","行李箱","筆記本","書","橡皮擦","尺","釘書機","膠帶","信封","郵票","紙飛機","望遠鏡","放大鏡","指南針","地圖","地球儀","骰子","撲克牌","拼圖","積木","泰迪熊","娃娃","溜溜球","陀螺","彈弓","弓箭","寶劍","盾牌","皇冠","魔杖","掃帚","喇叭","麥克風","小提琴","鼓","口琴","鈴鐺","杯子","盤子","碗","筷子","湯匙","叉子","刀子","鍋子","平底鍋","茶壺","奶瓶","圍巾","手套","領帶","裙子","褲子","外套","T恤","洋裝","比基尼","拖鞋","高跟鞋","雨鞋","口罩","項鍊","耳環","蝴蝶結","髮夾","指甲油","香水","化妝品","浴缸","蓮蓬頭","床","衣櫃","書桌","椅子","窗戶","門","樓梯","梯子","帳篷","睡袋","手電筒","打火機","摩托車","公車","計程車","救護車","消防車","警車","卡車","挖土機","直升機","潛水艇","太空船","飛碟","機器人","紅綠燈","路燈","郵筒","信箱","安全帽","輪椅","嬰兒車","購物車","沙漏","天秤","磁鐵","鎖","鐵鎚","螺絲起子","鋸子","水桶","澆水器","花盆","仙人掌","向日葵","玫瑰","鬱金香","四葉草","聖誕襪"],
  "地方": ["海邊","山","公園","學校","醫院","便利商店","摩天輪","游泳池","電影院","圖書館","廚房","浴室","沙漠","島","瀑布","城堡","月亮","太陽","彩虹","星星","火山","森林","金字塔","燈塔","溜滑梯","夜市","動物園","遊樂園","雲霄飛車","旋轉木馬","鬼屋","水族館","博物館","機場","火車站","捷運","加油站","停車場","超市","百貨公司","咖啡廳","餐廳","麵包店","花店","寵物店","理髮店","健身房","教堂","寺廟","鳥居","101大樓","艾菲爾鐵塔","自由女神","長城","橋","隧道","碼頭","農場","果園","稻田","菜園","溫泉","滑雪場","籃球場","足球場","操場","教室","宿舍","臥室","客廳","陽台","屋頂","地下室","監獄","銀行","警察局","消防局","郵局","洞穴","冰山","草原","河流","湖","池塘","雪山","叢林","太空","地球","銀河","外星球"],
  "動作": ["睡覺","跑步","游泳","跳舞","唱歌","釣魚","拍照","打噴嚏","刷牙","洗澡","放風箏","看電影","吃飯","擁抱","親親","牽手","打電動","騎車","划船","爬山","滑雪","打哈欠","生氣","哭哭","大笑","走路","跳繩","打籃球","踢足球","打棒球","打網球","打羽毛球","桌球","保齡球","高爾夫","衝浪","潛水","溜冰","拳擊","瑜珈","舉重","射箭","跳水","盪鞦韆","翻跟斗","倒立","伏地挺身","仰臥起坐","喝水","煮飯","洗碗","洗衣服","掃地","拖地","澆花","遛狗","餵貓","化妝","刮鬍子","吹頭髮","剪頭髮","穿衣服","綁鞋帶","看書","寫字","畫畫","彈鋼琴","打鼓","拍手","揮手","比讚","比愛心","敬禮","鞠躬","握手","擊掌","眨眼","偷看","打電話","傳訊息","自拍","滑手機","購物","排隊","搭飛機","開車","等公車","搬家","打掃","搔癢","打呼","做夢","發呆","偷吃","吹蠟燭","許願","拆禮物","堆雪人","打雪仗","放煙火","抓娃娃","玩躲貓貓"],
  "職業": ["醫生","護士","警察","消防員","老師","廚師","甜點師","理髮師","司機","機長","空姐","太空人","科學家","畫家","歌手","演員","魔術師","小丑","外送員","郵差","農夫","漁夫","工程師","建築工人","牙醫","獸醫","律師","法官","記者","攝影師","偵探","海盜","忍者","武士","騎士","公主","王子","國王","女王","巫婆","天使","惡魔","吸血鬼","殭屍","鬼","超人","聖誕老人","美人魚","新娘","新郎","嬰兒","老爺爺","老奶奶"],
  "天氣": ["下雨","下雪","打雷","閃電","颱風","龍捲風","雲","太陽雨","冰雹","霧","大風","地震","流星","日出","日落","月蝕","極光","雪花","冰柱","落葉","楓葉","櫻花","春天","夏天","秋天","冬天"],
  "身體": ["眼睛","鼻子","嘴巴","耳朵","頭髮","眉毛","睫毛","牙齒","舌頭","脖子","肩膀","手","手指","指甲","腳","腳趾","膝蓋","肚子","肚臍","屁股","心臟","骨頭","肌肉","鬍子","酒窩","雀斑","雙下巴","黑眼圈","痘痘","光頭","馬尾","雙馬尾","捲髮","瀏海"],
  "我們": ["約會","求婚","情人節","聖誕樹","生日","煙火","愛心","婚禮","情侶裝","看夜景","野餐","露營","搭帳篷","寫信","撒嬌","吃醋","晚安","早安","想你","抱抱","牽手散步","一起看電影","一起煮飯","一起旅行","交換禮物","慶祝紀念日","吵架","和好","道歉","驚喜","告白","初吻","情書","玫瑰花束","婚戒","結婚蛋糕","蜜月","小窩","養貓","同居","視訊","遠距離","等你下班","接你下班","摸頭","公主抱","背你","餵你吃","一起睡覺","打卡","自拍合照","大頭貼","情侶對戒","抓娃娃機","夾到娃娃","看日出","看流星","許願池"],
};
WORDS_B = ["逛街","下午茶","自拍","交換禮物","唱KTV","敷面膜","睡衣派對","追劇","八卦","做指甲","拍貼","吃甜點","閨蜜旅行","穿同款","喝珍奶","聊通宵","化妝","夾娃娃","減肥","吃到飽","演唱會","應援棒","偶像","抱抱","生日派對","野餐","煙火","寫卡片","跳舞","瑜珈","逛夜市","自拍棒","美甲","購物袋","試衣間","咖啡廳","鬆餅","馬卡龍","拍照打卡","姊妹淘","秘密","說悄悄話","打電話聊天","一起哭","一起大笑","畢業典禮","合照","手搖飲","瀏海","捲髮棒"];
const ALL = []; for(const c in WORDS) for(const w of WORDS[c]) ALL.push([w,c]);
const ALL_B = ALL.filter(x=>x[1]!=="我們").concat(WORDS_B.map(w=>[w,"閨蜜"]));
const WORDS_M = ["打籃球","打電動","烤肉","喝啤酒","機車","健身","釣魚","露營","看球賽","吃宵夜","鹹酥雞","網咖","開黑","打撞球","保齡球","爬山","騎腳踏車","衝浪","賽車","擊掌","勾肩搭背","畢業旅行","當兵","拔河","打雪仗","抓娃娃","吃到飽","漢堡","拉麵","啞鈴","球鞋","棒球帽","遊戲手把","耳機麥克風","外送","熬夜","打呼","搞笑自拍","生日驚喜","夜衝","看日出","吃火鍋","便利商店","泡麵","背包旅行","足球","桌球","滑板","烤香腸","乾杯"];
const ALL_M = ALL.filter(x=>x[1]!=="我們").concat(WORDS_M.map(w=>[w,"兄弟"]));
const COLORS = ["#3b2a24","#e5486a","#f39a3d","#f6c945","#5cb87a","#4a90d9","#9b6fd6","#f7a7b8","#8a5a33"];   // old strokes store an index into this
const SIZES = [5, 11, 22];
const PALETTE = ["#2b1d18","#6b5a52","#a8a29e","#ffffff","#e5486a","#ff8fab","#f39a3d","#f6c945","#fff27a","#9be27a","#5cb87a","#2f8f6b","#7fd3e8","#4a90d9","#2f4ea8","#9b6fd6","#d6a2ff","#8a5a33","#c98b5a","#f3d3a4"];
// compact stroke points: "x,y;" then 2 chars per point (dx,dy in -31..31). ~4x smaller than a number array,
// so saving a drawing with lots of strokes stays fast.
const A64 = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_";
function encP(p){
  if(p.length < 2) return ""; let out = `${p[0]},${p[1]};`, px = p[0], py = p[1];
  for(let i=2;i<p.length;i+=2){ let dx = p[i]-px, dy = p[i+1]-py;
    while(dx || dy){ const sx = Math.max(-31, Math.min(31, dx)), sy = Math.max(-31, Math.min(31, dy)); out += A64[sx+32] + A64[sy+32]; px += sx; py += sy; dx -= sx; dy -= sy; if(!dx && !dy) break; }
  }
  return out; }
function decP(q){
  const k = q.indexOf(";"); if(k < 0) return []; const [x0, y0] = q.slice(0, k).split(",").map(Number); const p = [x0, y0]; let x = x0, y = y0;
  for(let i=k+1;i+1<q.length;i+=2){ x += A64.indexOf(q[i]) - 32; y += A64.indexOf(q[i+1]) - 32; p.push(x, y); }
  return p; }
const ptsOf = st => st.p || (st.q != null ? (st._p || (Object.defineProperty(st, "_p", { value: decP(st.q), enumerable: false }), st._p)) : []);
const TOOLS = [["pen","✏️","鉛筆"],["mark","🖍️","麥克筆"],["fill","🪣","油漆桶"],["line","📏","直線"],["oval","⭕","圓形"],["rect","⬜","方形"],["er","🧽","橡皮擦"]];
const BG = "#fffaf2", W = 1000, H = 750, TIME = 100;
const norm = s => String(s||"").normalize("NFKC").replace(/[\s，。！？!?,.~～、「」"'：:；;]/g,"").toLowerCase();

App.registerGame({
  id: "draw",
  name: "你畫我猜",
  desc: "一個畫一個猜，答對一起拿小魚乾",
  icon: () => Pix.sprite("calico","surprised"),
  mount(el, ctx){
    const { sprite, esc, SFX } = ctx;
    let s = null, drawn = 0, drawnKey = "", cur = null, kb = null, guessText = "", tick = null, lastGuessN = 0, lastPhase = null, myPend = [];
    const me = () => ctx.me.uid, other = () => ctx.players().find(i=>i!==me());
    const $ = q => el.querySelector(q);
    el.innerHTML = `<div class="box dr" id="dr"></div>`;
    const box = $("#dr");

    function pickWords(used, only){
      let pool = (ctx.mode()==="bestie"?ALL_B:ctx.mode()==="bro"?ALL_M:ALL).filter(x=>!(used||[]).includes(x[0])), out = [];
      if(only){ const sp = pool.filter(x=>x[1]===only); if(sp.length >= 3){ return sp.sort(()=>Math.random()-.5).slice(0, 3); } }
      const cats = [...new Set(pool.map(x=>x[1]))].sort(()=>Math.random()-.5);
      for(const c of cats){ const opts = pool.filter(x=>x[1]===c); if(opts.length) out.push(opts[Math.floor(Math.random()*opts.length)]); if(out.length===3) break; }
      return out;
    }
    const fresh = (drawer, prev) => ({ round:(prev&&prev.round||0)+1, drawer, phase:"pick", opts:pickWords(prev&&prev.used, prev&&prev.only), only:(prev&&prev.only)||null, word:null, cat:null, until:0, started:0, strokes:[], guesses:[], hint:0,
      solved:(prev&&prev.solved)||0, streak:(prev&&prev.streak)||0, best:(prev&&prev.best)||0, fast:(prev&&prev.fast)||0, used:(prev&&prev.used)||[], hist:(prev&&prev.hist)||[], result:null });

    // ---------- 多人版（開房間，最多 6 人）----------
    // 每人輪流畫 per 次；猜對：第 1 個 +3、第 2 個 +2、其他 +1；每有一個人猜對，畫的人 +1；最後分數最高的人贏
    const MP = !!ctx.party;
    const here = () => ctx.players();
    const hostId = () => { const h = ctx.partyHost && ctx.partyHost(); return h && here().includes(h) ? h : here()[0]; };
    const amHost = () => hostId() === me();
    const lobbyState = prev => ({ mp:true, phase:"lobby", per:(prev&&prev.per)||2, round:0, scores:{}, drawn:{}, order:[], drawer:null, strokes:[], guesses:[], used:(prev&&prev.used)||[], hist:[] });
    function nextDrawerOf(x){
      const pl = here(), ord = (x.order||[]).filter(u=>pl.includes(u)); if(!ord.length) return null;
      const i0 = (x.order||[]).filter(u=>pl.includes(u) || u===x.drawer).indexOf(x.drawer);
      const ring = (x.order||[]).filter(u=>pl.includes(u) || u===x.drawer);
      for(let k=1;k<=ring.length;k++){ const u = ring[((i0<0?-1:i0)+k) % ring.length]; if(pl.includes(u) && ((x.drawn||{})[u]||0) < x.per) return u; }
      return null;
    }
    function toPick(x, drawer){ return Object.assign(x, { round:(x.round||0)+1, drawer, phase:"pick", opts:pickWords(x.used), word:null, cat:null, until:0, started:0, strokes:[], guesses:[], hint:0, solvers:[], result:null }); }
    function mpAdvance(x){ const u = nextDrawerOf(x); if(!u){ x.phase = "over"; x.drawer = null; x.strokes = []; x.guesses = []; return x; } return toPick(x, u); }
    function mpSync(x){ let ch = false; for(const u of here()){ if(!(x.order||[]).includes(u)){ x.order = (x.order||[]).concat([u]); ch = true; } if(x.phase!=="lobby" && x.scores && x.scores[u]==null){ x.scores[u] = 0; ch = true; } } return ch; }
    const mpTotal = x => here().length * (x.per||1);
    const mpDoneN = x => here().reduce((n,u)=>n+Math.min(x.per||1, (x.drawn||{})[u]||0), 0);
    function settleMP(x, why){
      const secs = Math.max(1, Math.round((Date.now() - (x.started||Date.now()))/1000)), n = (x.solvers||[]).length;
      x.phase = "done"; x.result = { ok: n > 0, n, secs, why: why||null, at: Date.now() };
      x.drawn = x.drawn || {}; if(x.drawer) x.drawn[x.drawer] = (x.drawn[x.drawer]||0) + 1;
      if(x.word) x.hist = (x.hist||[]).concat([{ w:x.word, ok:n>0, by:x.drawer, n }]).slice(-20);
    }
    const iSolved = () => !!(s && (s.solvers||[]).some(v=>v.u===me()));
    function board(x, big){
      const sc = x.scores || {}, list = here().map(u=>({ u, v: sc[u]||0 })).sort((a,b)=>b.v-a.v);
      if(big){ const top = list.length ? list[0].v : 0;
        return `<div class="drRank">${list.map((r,i)=>{ const pl = list.filter(q=>q.v>r.v).length; return `<div class="${r.v===top?"win":""} ${r.u===me()?"me":""}"><em>${pl===0?"🥇":pl===1?"🥈":pl===2?"🥉":pl+1}</em>${sprite(ctx.catOf(r.u), r.v===top?"love":"happy")}<span>${esc(r.u===me()?"你":ctx.nameOf(r.u))}</span><b>${r.v} 分</b></div>`; }).join("")}</div>`; }
      return `<div class="drBoard">${list.map(r=>`<span class="${x.drawer===r.u?"dw":""} ${(x.solvers||[]).some(v=>v.u===r.u)?"ok":""}">${x.drawer===r.u?"✏️":""}${esc(r.u===me()?"你":ctx.nameOf(r.u))} <b>${r.v}</b></span>`).join("")}</div>`;
    }
    function renderMP(){
      const pl = here();
      if(s.phase==="lobby"){
        const host = amHost();
        box.innerHTML = `<div class="drHd"><b>你畫我猜・多人房</b></div>
          <div class="drLobby">${pl.map(u=>`<span>${sprite(ctx.catOf(u), "happy")}<i>${esc(u===me()?"你":ctx.nameOf(u))}${u===hostId()?"<em>房主</em>":""}</i></span>`).join("")}</div>
          <div class="drRule"><b>怎麼贏？</b>大家輪流畫，其他人一起猜。<br>猜對：第 1 個 <b>+3</b>、第 2 個 <b>+2</b>、之後 <b>+1</b><br>每有一個人猜對，畫的人也 <b>+1</b><br>每個人都畫完，<b>分數最高的人贏！</b></div>
          <div class="drPer"><span>每人畫幾次</span>${[1,2,3].map(n=>`<button data-per="${n}" class="${s.per===n?"on":""}" ${host?"":"disabled"}>${n} 次</button>`).join("")}</div>
          ${host ? `<button class="btn" id="drStart" style="width:100%" ${pl.length<2?"disabled":""}>${pl.length<2?"等朋友進來…":`開始遊戲（${pl.length} 人・共 ${pl.length*s.per} 回合）`}</button>` : `<p class="drSub" style="text-align:center">等房主 ${esc(ctx.nameOf(hostId()))} 按開始…</p>`}
          <p class="drSub" style="text-align:center">最多 6 人・玩到一半也可以加入</p>`;
        box.querySelectorAll("[data-per]").forEach(b=>b.addEventListener("click", ()=>{ if(!amHost()) return; SFX.tap(); const n = +b.dataset.per; ctx.update("draw", x=>{ if(!x || x.phase!=="lobby") return undefined; x.per = n; return x; }); }));
        const st = $("#drStart"); if(st) st.addEventListener("click", ()=>{ if(here().length < 2) return; SFX.select();
          ctx.update("draw", x=>{ if(!x || x.phase!=="lobby") return undefined; x.order = here().slice().sort(()=>Math.random()-.5); x.scores = {}; x.drawn = {}; here().forEach(u=>{ x.scores[u] = 0; }); x.drawer = null; x.round = 0; x.hist = []; return mpAdvance(x); }); });
        return;
      }
      if(s.phase==="pick"){
        const k = Math.min(mpTotal(s), mpDoneN(s)+1);
        if(isDrawer()){
          box.innerHTML = `<div class="drHd"><b>第 ${k} / ${mpTotal(s)} 回合・換你畫！</b></div><p class="drSub">選一個你想畫的題目（其他人看不到喔）</p>
            <div class="drPick">${s.opts.map((o,i)=>`<button data-o="${i}"><i>${esc(o[1])}</i><b>${esc(o[0])}</b></button>`).join("")}</div>
            <div class="drPickBtns"><button class="btn sub" id="drRe">🔄 換一組題目</button></div>${board(s)}`;
          box.querySelectorAll("[data-o]").forEach(b=>b.addEventListener("click", ()=>start(+b.dataset.o)));
          $("#drRe").addEventListener("click", ()=>{ SFX.tap(); ctx.update("draw", x=>{ if(!x || x.phase!=="pick" || x.drawer!==me()) return undefined; x.opts = pickWords(x.used); return x; }); });
        } else box.innerHTML = `<div class="drWait">${sprite(ctx.catOf(s.drawer),"normal")}<p>第 ${k} / ${mpTotal(s)} 回合<br><b>${esc(ctx.nameOf(s.drawer))}</b> 正在選題目…</p><p class="drSub">等等大家一起猜，越快猜對分數越高 🤔</p></div>${board(s)}`;
        return;
      }
      if(s.phase==="done"){
        closeKb(); box.classList.remove("drFull", "rot"); box.style.width = box.style.height = ""; document.body.classList.remove("drFullOn"); box.dataset.mode = "";
        const r = s.result || {}, last = mpDoneN(s) >= mpTotal(s);
        const head = r.n ? `🎉 ${r.n} 個人猜對了！` : r.why==="give" ? "😵 這題放棄了" : r.why==="left" ? `${esc(ctx.nameOf(s.drawer))} 離開了，這題跳過` : "⏰ 時間到，沒有人猜到～";
        box.innerHTML = `<div class="drRes ${r.n?"ok":""}"><div class="drResHd">${head}</div><div class="drAns">答案是「<b>${esc(s.word||"")}</b>」</div>
          <canvas class="drCv" id="drCv"></canvas>
          <div class="drGot">${(s.solvers||[]).map(v=>`<span>${esc(v.u===me()?"你":ctx.nameOf(v.u))} <b>+${v.pts}</b></span>`).join("")}${r.n ? `<span class="dw">✏️ ${esc(s.drawer===me()?"你":ctx.nameOf(s.drawer))} <b>+${r.n}</b></span>` : ""}</div>
          ${board(s)}
          <button class="btn" id="drNext" style="width:100%">${last ? "看最後結果 🏆" : "下一回合 ▶"}</button><p class="drSub" style="text-align:center" id="drAuto"></p></div>`;
        setupCanvas();
        $("#drNext").addEventListener("click", next);
        return;
      }
      if(s.phase==="over"){
        closeKb(); box.dataset.mode = "";
        const sc = s.scores || {}, top = Math.max(0, ...here().map(u=>sc[u]||0)), win = here().filter(u=>(sc[u]||0)===top);
        box.innerHTML = `<div class="drOver"><div class="drResHd">🏆 遊戲結束！</div>
          <div class="drWin">${win.map(u=>sprite(ctx.catOf(u),"love")).join("")}<p>${win.length > 1 ? `${win.map(u=>esc(u===me()?"你":ctx.nameOf(u))).join("、")} 同分，一起贏了！` : win[0]===me() ? "你贏了！畫得好又猜得快 🎉" : `${esc(ctx.nameOf(win[0]))} 贏了！`}</p></div>
          ${board(s, true)}
          <button class="btn" id="drAgain" style="width:100%">再玩一局</button>
          ${(s.hist||[]).length ? `<div class="drHist"><b>這局的題目</b>${s.hist.slice().reverse().map(h=>`<span class="${h.ok?"ok":""}">${h.ok?"✔":"✘"} ${esc(h.w)}</span>`).join("")}</div>` : ""}</div>`;
        $("#drAgain").addEventListener("click", ()=>{ SFX.select(); ctx.update("draw", x=>{ if(!x || x.phase!=="over") return undefined; return lobbyState(x); }); });
        return;
      }
    }

    // ---------- canvas ----------
    // stroke: { id, t:"pen"|"mark"|"er"|"line"|"oval"|"rect"|"fill", c:"#hex" (old: index), sz (old: w index), p:[x,y,...] }
    let cv = null, g = null, scale = 1, base = null;
    let tool = Object.assign({ t:"pen", c:"#2b1d18", sz:8, recent:[] }, (()=>{ try{ return JSON.parse(localStorage.getItem("mw_drTool")||"{}"); }catch(e){ return {}; } })());
    const saveTool = () => { try{ localStorage.setItem("mw_drTool", JSON.stringify({ t:tool.t, c:tool.c, sz:tool.sz, recent:tool.recent })); }catch(e){} };
    let redoStack = [], view = { z:1, x:0, y:0 };
    function setupCanvas(){
      cv = $("#drCv"); if(!cv) return;
      const full = box.classList.contains("drFull"), dpr = Math.min(2.5, window.devicePixelRatio||1) * (full ? 1.4 : 1);
      if(full){ // big canvas is landscape: turn the whole panel sideways when the phone is held upright
        const vw = window.innerWidth, vh = window.innerHeight, portrait = vh > vw, long = portrait ? vh : vw, short = portrait ? vw : vh;
        box.classList.toggle("rot", portrait); box.style.width = long + "px"; box.style.height = short + "px";
        const side = Math.min(190, long * .22), cw = Math.max(200, Math.min((short - 20) * W / H, long - side*2 - 36));
        cv.style.width = cw + "px";
      } else { box.classList.remove("rot"); box.style.width = box.style.height = ""; cv.style.width = ""; }
      const w = cv.offsetWidth || cv.parentElement.clientWidth;
      cv.width = Math.round(w*dpr); cv.height = Math.round(w*.75*dpr); cv.style.height = (w*.75)+"px";
      g = cv.getContext("2d", { willReadFrequently: true }); scale = cv.width / W; g.lineCap = "round"; g.lineJoin = "round";
      redraw();
    }
    const colOf = st => typeof st.c === "number" ? COLORS[st.c] || "#2b1d18" : (st.c || "#2b1d18");
    const typeOf = st => st.t || (st.e ? "er" : "pen");
    const sizeOf = st => st.sz != null ? st.sz : SIZES[st.w] || 8;
    function floodFill(x0, y0, hex){
      const Wd = cv.width, Hd = cv.height, X = Math.round(x0*scale), Y = Math.round(y0*scale); if(X<0||Y<0||X>=Wd||Y>=Hd) return;
      const img = g.getImageData(0, 0, Wd, Hd), d = img.data, at = (X + Y*Wd)*4;
      const tr = d[at], tg = d[at+1], tb = d[at+2];
      const [fr, fg, fb] = [1,3,5].map(k=>parseInt(hex.slice(k,k+2),16));
      if(Math.abs(tr-fr)+Math.abs(tg-fg)+Math.abs(tb-fb) < 12) return;
      const TOL = 110, same = i => Math.abs(d[i]-tr)+Math.abs(d[i+1]-tg)+Math.abs(d[i+2]-tb) <= TOL;
      const mark = new Uint8Array(Wd*Hd), stack = [X, Y]; let x0b = X, x1b = X, y0b = Y, y1b = Y;
      while(stack.length){
        const y = stack.pop(); let x = stack.pop(); let i = y*Wd + x;
        while(x >= 0 && !mark[i] && same(i*4)){ x--; i--; } x++; i++;
        let up = false, dn = false;
        while(x < Wd && !mark[i] && same(i*4)){
          mark[i] = 1; if(x < x0b) x0b = x; if(x > x1b) x1b = x; if(y < y0b) y0b = y; if(y > y1b) y1b = y;
          if(y > 0){ const k = i - Wd; if(!mark[k] && same(k*4)){ if(!up){ stack.push(x, y-1); up = true; } } else up = false; }
          if(y < Hd-1){ const k = i + Wd; if(!mark[k] && same(k*4)){ if(!dn){ stack.push(x, y+1); dn = true; } } else dn = false; }
          x++; i++;
        }
      }
      // paint the filled area, grown by 1px so there are no light seams along anti-aliased edges
      for(let y=Math.max(0,y0b-1);y<=Math.min(Hd-1,y1b+1);y++) for(let x=Math.max(0,x0b-1);x<=Math.min(Wd-1,x1b+1);x++){ const i = y*Wd + x; if(mark[i] || (x>0 && mark[i-1]) || (x<Wd-1 && mark[i+1]) || (y>0 && mark[i-Wd]) || (y<Hd-1 && mark[i+Wd])){ const o = i*4; d[o] = fr; d[o+1] = fg; d[o+2] = fb; d[o+3] = 255; } }
      g.putImageData(img, 0, 0);
    }
    function paintStroke(st, upto){
      const t = typeOf(st), p = ptsOf(st), n = Math.min(upto==null ? p.length/2 : upto, p.length/2); if(!n) return;
      if(t === "fill"){ floodFill(p[0], p[1], colOf(st)); return; }
      g.save();
      g.strokeStyle = t === "er" ? BG : colOf(st); g.fillStyle = g.strokeStyle;
      g.lineWidth = sizeOf(st)*scale*(t === "er" ? 1.8 : t === "mark" ? 2.2 : 1); g.lineCap = "round"; g.lineJoin = "round";
      if(t === "mark"){ g.globalAlpha = 0.38; g.lineCap = "butt"; g.lineJoin = "round"; }
      const S = v => v*scale;
      if(t === "line" || t === "oval" || t === "rect"){
        const x1 = S(p[0]), y1 = S(p[1]), x2 = S(p[p.length-2]), y2 = S(p[p.length-1]);
        g.beginPath();
        if(t === "line"){ g.moveTo(x1, y1); g.lineTo(x2, y2); }
        else if(t === "rect"){ g.rect(Math.min(x1,x2), Math.min(y1,y2), Math.abs(x2-x1), Math.abs(y2-y1)); }
        else g.ellipse((x1+x2)/2, (y1+y2)/2, Math.max(1, Math.abs(x2-x1)/2), Math.max(1, Math.abs(y2-y1)/2), 0, 0, Math.PI*2);
        g.stroke(); g.restore(); return;
      }
      if(n===1){ g.beginPath(); g.arc(S(p[0]), S(p[1]), g.lineWidth/2, 0, Math.PI*2); g.fill(); g.restore(); return; }
      g.beginPath(); g.moveTo(S(p[0]), S(p[1]));
      for(let i=1;i<n-1;i++){ const x=S(p[i*2]), y=S(p[i*2+1]), nx=S(p[i*2+2]), ny=S(p[i*2+3]); g.quadraticCurveTo(x, y, (x+nx)/2, (y+ny)/2); }
      g.lineTo(S(p[(n-1)*2]), S(p[(n-1)*2+1])); g.stroke(); g.restore();
    }
    // draw only the newest piece of a pen / eraser line (cheap, used while the finger is moving)
    function paintSeg(st, from){
      const p = ptsOf(st), t = typeOf(st); if(p.length - from < 2) return;
      g.save(); g.strokeStyle = t === "er" ? BG : colOf(st); g.fillStyle = g.strokeStyle; g.lineWidth = sizeOf(st)*scale*(t === "er" ? 1.8 : 1); g.lineCap = "round"; g.lineJoin = "round";
      if(p.length === 2){ g.beginPath(); g.arc(p[0]*scale, p[1]*scale, g.lineWidth/2, 0, Math.PI*2); g.fill(); g.restore(); return; }
      g.beginPath(); g.moveTo(p[from]*scale, p[from+1]*scale); for(let i=from+2;i<p.length;i+=2) g.lineTo(p[i]*scale, p[i+1]*scale); g.stroke(); g.restore();
    }
    function redraw(){
      if(!g) return; g.fillStyle = BG; g.fillRect(0,0,cv.width,cv.height);
      const all = (s && s.strokes || []).concat(myPend); all.forEach(st=>paintStroke(st)); if(cur) paintStroke(cur);
      drawn = s ? s.strokes.length : 0; drawnKey = strokeKey();
    }
    const strokeKey = () => s ? s.round+":"+(s.strokes[0] ? (s.strokes[0].id || ptsOf(s.strokes[0]).slice(0,4).join(",")) : "") : "";
    function animateNew(){
      if(!g || !s) return;
      if(s.strokes.length < drawn || strokeKey()!==drawnKey){ redraw(); return; }
      const news = s.strokes.slice(drawn); drawn = s.strokes.length;
      if(news.some(st => typeOf(st) === "fill" || typeOf(st) === "mark")){ redraw(); return; }
      (async()=>{ for(const st of news){ const n = ptsOf(st).length/2, steps = Math.min(24, Math.max(4, Math.round(n/2)));
        if(st.id && live.has(String(st.id).split("_")[0])){ continue; }   // already drawn live
        if(["line","oval","rect"].includes(typeOf(st))){ paintStroke(st); continue; }
        for(let k=1;k<=steps;k++){ await new Promise(r=>requestAnimationFrame(r)); paintStroke(st, Math.ceil(n*k/steps)); } } })();
    }
    // live strokes: the drawer broadcasts points while drawing, the guesser paints them right away
    const live = new Set(), liveS = {};
    let liveBuf = [], liveT = 0;
    function liveFlush(force){
      if(!cur || !liveBuf.length) return; const now = Date.now(); if(!force && now - liveT < 70) return; liveT = now;
      ctx.broadcast({ g:"drw", r: s.round, id: cur.id, t: cur.t, c: cur.c, sz: cur.sz, p: liveBuf }); liveBuf = [];
    }
    function onLive(m){
      if(!m || m.g !== "drw" || !s || s.phase !== "draw" || m.r !== s.round || isDrawer() || !g) return;
      if(!["pen","mark","er"].includes(m.t || "pen")) return;
      // 別人傳來的即時筆畫先檢查一下，太誇張的直接丟掉（避免被亂傳的資料卡住）
      if(!Array.isArray(m.p) || m.p.length > 400 || m.p.some(v => typeof v !== "number" || !isFinite(v)) || (m.sz != null && !(+m.sz > 0 && +m.sz <= 80)) || (m.c != null && (typeof m.c !== "string" || m.c.length > 30)) || (!liveS[m.id] && Object.keys(liveS).length > 500)) return;
      let L = liveS[m.id]; if(!L){ L = liveS[m.id] = { t: m.t, c: m.c, sz: m.sz, p: [], snap: m.t === "mark" ? g.getImageData(0, 0, cv.width, cv.height) : null }; live.add(m.id); }
      const from = Math.max(0, L.p.length - 2); L.p.push(...m.p);
      if(L.snap){ g.putImageData(L.snap, 0, 0); paintStroke(L); } else paintSeg(L, from);
    }
    const rotated = () => box.classList.contains("rot");
    function pos(e){ const r = cv.getBoundingClientRect();
      if(rotated()) return [Math.round((e.clientY-r.top)/r.height*W), Math.round((1 - (e.clientX-r.left)/r.width)*H)];
      return [Math.round((e.clientX-r.left)/r.width*W), Math.round((e.clientY-r.top)/r.height*H)]; }
    // screen point -> position inside the (maybe sideways) canvas frame, in CSS pixels
    function local(x, y){ const st = $("#drStage").getBoundingClientRect(); return rotated() ? [y - st.top, st.right - x] : [x - st.left, y - st.top]; }
    function bindDraw(){
      let sm = null, pendFill = null, frameReq = 0; const pts = new Map(); let pinch = null;
      const zr = $("#drZR");
      const applyZoom = () => { cv.style.transformOrigin = "0 0"; cv.style.transform = view.z > 1.01 ? `translate(${view.x}px,${view.y}px) scale(${view.z})` : ""; if(zr) zr.classList.toggle("hidden", view.z <= 1.01); };
      if(zr) zr.addEventListener("click", ()=>{ view = { z:1, x:0, y:0 }; applyZoom(); SFX.tap(); });
      applyZoom();
      cv.addEventListener("pointerdown", e=>{ pts.set(e.pointerId, [e.clientX, e.clientY]); if(!isDrawer() || s.phase!=="draw") return; e.preventDefault();
        if(pts.size === 2){ // two fingers: cancel the stroke and pinch-zoom / move the canvas
          pendFill = null; if(cur){ cur = null; if(base) g.putImageData(base, 0, 0); else redraw(); base = null; }
          const [a, b] = [...pts.values()], [lx, ly] = local((a[0]+b[0])/2, (a[1]+b[1])/2); pinch = { d: Math.hypot(a[0]-b[0], a[1]-b[1]) || 1, mx: lx, my: ly, z: view.z, x: view.x, y: view.y }; return; }
        if(pts.size > 2) return;
        try{ cv.setPointerCapture(e.pointerId); }catch(_){}
        const [x,y] = pos(e); redoStack = [];
        if(tool.t === "fill"){ pendFill = [x, y]; return; }   // filled on release, so a pinch doesn't fill by accident
        cur = { id: Math.random().toString(36).slice(2, 9), t: tool.t, c: tool.c, sz: tool.sz, p:[x,y] }; sm = [x, y];
        base = ["mark","line","oval","rect"].includes(cur.t) ? g.getImageData(0, 0, cv.width, cv.height) : null; paintStroke(cur); cur._d = 0;
        if(["pen","mark","er"].includes(cur.t)){ liveBuf = [x,y]; liveT = 0; liveFlush(true); } });
      cv.addEventListener("pointermove", e=>{ if(pts.has(e.pointerId)) pts.set(e.pointerId, [e.clientX, e.clientY]);
        if(pinch && pts.size >= 2){ const [a, b] = [...pts.values()], d = Math.hypot(a[0]-b[0], a[1]-b[1]) || 1, [mx, my] = local((a[0]+b[0])/2, (a[1]+b[1])/2);
          const z = Math.max(1, Math.min(5, pinch.z * d / pinch.d));
          // keep the point under the fingers fixed while zooming, then follow the fingers
          const ox = pinch.mx, oy = pinch.my, k = z / pinch.z;
          let x = ox - (ox - pinch.x)*k + (mx - pinch.mx), y = oy - (oy - pinch.y)*k + (my - pinch.my);
          const w = cv.offsetWidth, h = cv.offsetHeight; x = Math.min(0, Math.max(w - w*z, x)); y = Math.min(0, Math.max(h - h*z, y));
          view = { z, x, y }; applyZoom(); return; }
        if(!cur) return;
        const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
        for(const ev of (evs.length ? evs : [e])){
          let [x,y] = pos(ev); x = Math.max(0,Math.min(W,x)); y = Math.max(0,Math.min(H,y));
          const p = cur.p;
          if(["line","oval","rect"].includes(cur.t)){ p.length = 2; p.push(x, y); continue; }
          // light smoothing so lines look clean even with a shaky finger
          sm = [sm[0] + (x - sm[0])*0.55, sm[1] + (y - sm[1])*0.55]; const X = Math.round(sm[0]), Y = Math.round(sm[1]);
          const lx = p[p.length-2], ly = p[p.length-1]; if(Math.hypot(X-lx, Y-ly) < 3) continue;
          p.push(X, Y); liveBuf.push(X, Y);
        }
        if(!frameReq) frameReq = requestAnimationFrame(()=>{ frameReq = 0; if(!cur) return;
          if(base){ g.putImageData(base, 0, 0); paintStroke(cur); } else { paintSeg(cur, Math.max(0, cur._d - 2)); cur._d = cur.p.length; } });
        liveFlush(false); });
      const end = async e=>{ pts.delete(e.pointerId); if(pts.size < 2) pinch = null;
        if(pendFill && !pts.size){ const [x, y] = pendFill; pendFill = null; const st = { id: Math.random().toString(36).slice(2, 9), t:"fill", c: tool.c, p:[x,y] }; paintStroke(st); SFX.place(); commit([st]); return; }
        if(!cur) return; liveFlush(true); const st = cur; cur = null; base = null;
        if(["line","oval","rect"].includes(st.t) && st.p.length < 4) st.p.push(st.p[0]+1, st.p[1]+1);
        base = null;
        if(st.p.length > 3000) st.p = st.p.slice(0, 3000);
        commit([st]); };
      cv.addEventListener("pointerup", end); cv.addEventListener("pointercancel", end);
      cv.style.touchAction = "none";
    }
    // strokes are saved one batch at a time: while one save is on its way, new strokes wait and go together in the next one.
    // (saving every stroke at once made the two phones fight over the same version and could freeze the game)
    let saveQ = [], saving = false;
    function commit(parts){ myPend.push(...parts); saveQ.push(...parts); flushSave(); }
    async function flushSave(){
      if(saving || !saveQ.length) return; saving = true;
      const batch = saveQ.splice(0), packed = batch.map(st => { const o = { id: st.id, t: st.t, c: st.c }; if(st.sz != null) o.sz = st.sz; if(st.w != null) o.w = st.w; if(st.e) o.e = st.e; o.q = encP(st.p); return o; });
      const ns = await ctx.update("draw", x=>{ if(!x || x.phase!=="draw" || x.drawer!==me()) return undefined; x.strokes.push(...packed); if(x.strokes.length>400) x.strokes = x.strokes.slice(-400); return x; }).catch(()=>null);
      saving = false; myPend = myPend.filter(q=>!batch.includes(q));
      if(!ns){ if(s && s.phase === "draw"){ redraw(); ctx.toast("剛剛畫的沒存到，再畫一次 🙏"); } }
      if(saveQ.length) setTimeout(flushSave, 60);
    }
    function undo(){
      ctx.update("draw", x=>{ if(!x || x.phase!=="draw" || !x.strokes.length) return undefined;
        const last = x.strokes.pop(), base2 = last && last.id ? String(last.id).split("_")[0] : null, gone = [last];
        if(base2) while(x.strokes.length && String(x.strokes[x.strokes.length-1].id||"").split("_")[0] === base2) gone.unshift(x.strokes.pop());
        redoStack.push(gone); return x; });
    }
    function redo(){ const gone = redoStack.pop(); if(!gone) return; commit(gone.map(st => ({ id: st.id, t: st.t, c: st.c, sz: st.sz, p: ptsOf(st).slice(), e: st.e, w: st.w }))); }
    const isDrawer = () => s && s.drawer===me();
    const left = () => s ? Math.max(0, Math.ceil((s.until - Date.now())/1000)) : 0;
    const hintText = () => { if(!s || !s.word) return ""; const a=[...s.word]; return a.map((ch,i)=>i<s.hint?ch:"□").join(" "); };

    // ---------- views ----------
    function render(){
      const p = ctx.partner();
      if(MP && s && s.phase !== "draw"){ renderMP(); return; }
      if(!p){ box.innerHTML = `<div class="drWait">${sprite("white","sleep",{soft:true})}<p>等${ctx.pw()}加入小窩才能玩喔</p></div>`; return; }
      if(!s){ box.innerHTML = `<div class="drWait">${sprite(ctx.me.cat,"happy")}<p>準備中…</p></div>`; return; }
      const stats = `<div class="drStats">🤝 一起答對 <b>${s.solved||0}</b> 題・連續 <b>${s.streak||0}</b>・最快 <b>${s.fast?s.fast+" 秒":"—"}</b></div>`;
      if(s.phase==="pick"){
        if(isDrawer()){
          box.innerHTML = `<div class="drHd"><b>第 ${s.round} 回合・換你畫！</b></div><p class="drSub">選一個你想畫的題目（${esc(p.name)} 看不到喔）</p>
            <div class="drPick">${s.opts.map((o,i)=>`<button data-o="${i}"><i>${esc(o[1])}</i><b>${esc(o[0])}</b></button>`).join("")}</div>
            <div class="drPickBtns"><button class="btn sub" id="drRe">🔄 換一組題目</button></div>
            ${ctx.isOnline(p.user_id)?"":`<p class="drWarn">${esc(p.name)} 現在不在線上，選好題目後會通知 ta 來猜</p>`}${stats}`;
          box.querySelectorAll("[data-o]").forEach(b=>b.addEventListener("click", ()=>start(+b.dataset.o)));
          $("#drRe").addEventListener("click", ()=>{ SFX.tap(); ctx.update("draw", x=>{ if(!x || x.phase!=="pick" || x.drawer!==me()) return undefined; x.opts = pickWords(x.used, x.only); return x; }); });
        } else {
          box.innerHTML = `<div class="drWait">${sprite(p.cat,"normal")}<p><b>${esc(p.name)}</b> 正在選題目…</p><p class="drSub">等等你要負責猜 🤔</p></div>${stats}`;
        }
        return;
      }
      if(s.phase==="draw"){
        const drawer = isDrawer(), solvedMe = MP && !drawer && iSolved(), mkey = (drawer?"d":solvedMe?"s":"g")+s.round;
        if(!$("#drCv") || box.dataset.mode !== mkey){
          if(solvedMe) closeKb();
          box.dataset.mode = mkey;
          box.innerHTML = `<div class="drTop"><span class="drWord" id="drWord"></span><span class="drTime" id="drTime"></span></div>
            <div class="drStage" id="drStage"><canvas class="drCv" id="drCv"></canvas>${drawer ? `<button class="drZoomR hidden" id="drZR">🔍 回到 1 倍</button>` : ""}</div>
            ${drawer ? `<div class="drBar" id="drBar">
                <div class="drToolRow">${TOOLS.map(([k,ic,nm])=>`<button data-t="${k}" title="${nm}"><span>${ic}</span><i>${nm}</i></button>`).join("")}</div>
                <div class="drColRow"><div class="drCols">${PALETTE.map(c=>`<button data-c="${c}" style="background:${c}"></button>`).join("")}</div><label class="drPickC" title="自己調顏色"><input type="color" id="drColor">🎨</label></div>
                <div class="drSzRow"><span class="drDot" id="drDot"></span><input type="range" id="drSize" min="2" max="48" step="1"><span class="drSzN" id="drSzN"></span></div>
                <div class="drActRow"><button id="drUndo">↩ 復原</button><button id="drRedo">↪ 重做</button><button id="drClr">🗑 清空</button><button id="drHint">💡 提示</button><button id="drFull">⛶ 大畫布</button></div>
              </div>
              <div class="drFeed" id="drFeed"></div><button class="btn sub drGive" id="drGive">😵 放棄這題</button>`
            : solvedMe ? `<div class="drFeed" id="drFeed"></div><div class="drSolved">🎉 你猜對了！等其他人猜…</div>`
            : `<div class="drFeed" id="drFeed"></div>
              <div class="drGuess"><input class="drIn" id="drIn" placeholder="點這裡猜猜看…" enterkeyhint="send"><button class="btn" id="drSend">猜！</button></div>`}`;
          setupCanvas(); bindDraw();
          if(drawer){
            const pickColor = c => { tool.c = c; if(tool.t === "er") tool.t = "pen"; tool.recent = [c].concat((tool.recent||[]).filter(x=>x!==c)).slice(0, 6); saveTool(); toolsUi(); };
            box.querySelectorAll("[data-t]").forEach(b=>b.addEventListener("click", ()=>{ tool.t = b.dataset.t; SFX.tap(); saveTool(); toolsUi(); }));
            box.querySelectorAll("[data-c]").forEach(b=>b.addEventListener("click", ()=>{ SFX.tap(); pickColor(b.dataset.c); }));
            $("#drColor").addEventListener("input", e=>pickColor(e.target.value));
            $("#drSize").addEventListener("input", e=>{ tool.sz = +e.target.value; saveTool(); toolsUi(); });
            $("#drUndo").addEventListener("click", ()=>{ SFX.del(); undo(); });
            $("#drRedo").addEventListener("click", ()=>{ if(!redoStack.length){ ctx.toast("沒有可以重做的"); return; } SFX.tap(); redo(); });
            $("#drFull").addEventListener("click", ()=>{ SFX.tap(); box.classList.toggle("drFull"); document.body.classList.toggle("drFullOn", box.classList.contains("drFull")); $("#drFull").textContent = box.classList.contains("drFull") ? "↙ 縮小" : "⛶ 大畫布"; requestAnimationFrame(setupCanvas); });
            let clrArm = 0;
            $("#drClr").addEventListener("click", ()=>{ if(!s.strokes.length) return; const t = Date.now(); if(t - clrArm > 2500){ clrArm = t; ctx.toast("再按一次清空整張圖"); return; } SFX.del(); ctx.update("draw", x=>{ if(!x || x.phase!=="draw") return undefined; redoStack.push(x.strokes.slice()); x.strokes = []; return x; }); });
            $("#drHint").addEventListener("click", ()=>{ if(s.hint >= [...s.word].length-1){ ctx.toast("不能再提示了，再說就是答案啦 😹"); return; } SFX.select(); ctx.update("draw", x=>{ if(!x || x.phase!=="draw") return undefined; x.hint = Math.min([...x.word].length-1, (x.hint||0)+1); return x; }); });
            $("#drGive").addEventListener("click", ()=>finish(false, "give"));
            toolsUi();
          } else if(!solvedMe) {
            gf = ctx.caretField($("#drIn"), 20); gf.el.addEventListener("input", ()=>{ guessText = gf.value; });
            kb = ctx.dockKeyboard(gf, { enterLabel:"猜！", onEnter: () => sendGuess(), phrases: ["是不是","好像是","應該是","我猜","動物","食物","哈哈","不知道"] });
            guessText = ""; paintGuess();
            $("#drSend").addEventListener("click", sendGuess);
          }
        } else animateNew();
        $("#drWord").innerHTML = drawer ? `你要畫：<b>${esc(s.word)}</b>` : solvedMe ? `答案：<b>${esc(s.word)}</b>` : `提示：${esc(s.cat)}・<b class="hint">${esc(hintText())}</b>`;
        if(MP){ let bd = $("#drBd"); if(!bd){ $("#drStage").insertAdjacentHTML("afterend", `<div id="drBd"></div>`); bd = $("#drBd"); } bd.innerHTML = board(s); }
        feed(); timeUi();
        return;
      }
      // done
      closeKb(); box.classList.remove("drFull", "rot"); box.style.width = box.style.height = ""; document.body.classList.remove("drFullOn");
      const r = s.result || {}, secs = r.secs||0, pName = ctx.nameOf(s.drawer===me()?other():s.drawer);
      const head = r.ok ? `🎉 答對了！${r.secs?`只用了 ${secs} 秒`:""}` : r.why==="give" ? "😵 這題放棄了" : "⏰ 時間到了～";
      box.dataset.mode = "";
      box.innerHTML = `<div class="drRes ${r.ok?"ok":""}"><div class="drResHd">${head}</div><div class="drAns">答案是「<b>${esc(s.word||"")}</b>」</div>
        <canvas class="drCv" id="drCv"></canvas>
        <div class="drCats">${sprite(ctx.catOf(s.drawer), r.ok?"love":"cry")}<span>${r.ok?`${esc(ctx.nameOf(s.drawer))} 畫、${esc(ctx.nameOf(other()===s.drawer?me():other()))} 猜，默契滿分 💗${r.ok && !ctx.party?"<br>我們的貓 +1 小魚乾 🐟":""}`:"沒關係，下一題一定可以！"}</span>${sprite(ctx.catOf(s.drawer===me()?other():me()), r.ok?"love":"cry")}</div>
        <button class="btn" id="drNext" style="width:100%">${s.drawer===me() ? `換 ${esc(pName)} 畫 ▶` : "換我畫 ▶"}</button></div>${stats}
        ${(s.hist||[]).length ? `<div class="drHist"><b>最近的題目</b>${s.hist.slice(-6).reverse().map(h=>`<span class="${h.ok?"ok":""}">${h.ok?"✔":"✘"} ${esc(h.w)}</span>`).join("")}</div>` : ""}`;
      setupCanvas();
      $("#drNext").addEventListener("click", next);
    }
    function toolsUi(){
      box.querySelectorAll("[data-t]").forEach(b=>b.classList.toggle("on", b.dataset.t===tool.t));
      box.querySelectorAll("[data-c]").forEach(b=>b.classList.toggle("on", tool.t!=="er" && b.dataset.c.toLowerCase()===String(tool.c).toLowerCase()));
      const pc = $("#drColor"); if(pc && /^#[0-9a-f]{6}$/i.test(tool.c)) pc.value = tool.c;
      const lab = box.querySelector(".drPickC"); if(lab) lab.style.background = PALETTE.includes(tool.c) ? "" : tool.c;
      const sz = $("#drSize"); if(sz) sz.value = tool.sz;
      const dot = $("#drDot"); if(dot){ const px = Math.max(3, Math.min(34, tool.sz * (cv ? cv.getBoundingClientRect().width / W : .35) * (tool.t==="er"?1.8:tool.t==="mark"?2.2:1))); dot.style.width = dot.style.height = px + "px"; dot.style.background = tool.t==="er" ? "#fff" : tool.c; dot.style.opacity = tool.t==="mark" ? .45 : 1; }
      const n = $("#drSzN"); if(n) n.textContent = tool.sz;
      if(cv) cv.dataset.tool = tool.t;
    }
    function timeUi(){ const t = $("#drTime"); if(!t || !s || s.phase!=="draw") return; const l = left(); t.textContent = `⏱ ${l}`; t.classList.toggle("low", l<=15); }
    function feed(){
      const f = $("#drFeed"); if(!f || !s) return;
      const list = (s.guesses||[]).slice(-6);
      f.innerHTML = list.length ? list.map(q=>q.ok ? `<span class="got">🎉 ${esc(q.by===me()?"你":ctx.nameOf(q.by))} 猜對了！+${q.pts}</span>` : `<span class="${q.close?"close":""}">${esc(q.by===me()?"你":ctx.nameOf(q.by))}：${esc(q.t)} ${q.close?"🔥 很接近！":"❌"}</span>`).join("") : `<span class="none">${isDrawer()?"猜的答案會出現在這裡":"猜錯也沒關係，多猜幾次！"}</span>`;
      f.scrollLeft = f.scrollWidth;
      const n = (s.guesses||[]).length;
      if(n > lastGuessN && lastGuessN){ const q = s.guesses[n-1]; if(q && q.by!==me()){ q.ok ? SFX.match() : q.close ? SFX.select() : SFX.miss(); } }
      lastGuessN = n;
    }
    let gf = null;
    function paintGuess(){ if(gf && gf.el.isConnected && gf.value !== guessText) gf.value = guessText; }
    function closeKb(){ if(kb && kb.close) kb.close(); }
    async function sendGuess(){
      if(kb && kb.composing()) kb.flush();
      if(gf) guessText = gf.value;
      const t = guessText.trim(); if(!t || !s || s.phase!=="draw") return;
      guessText = ""; paintGuess(); SFX.send();
      let won = false;
      if(MP){
        await ctx.update("draw", x=>{ if(!x || x.phase!=="draw" || x.drawer===me()) return undefined; x.solvers = x.solvers || []; if(x.solvers.some(v=>v.u===me())) return undefined;
          const a = norm(t), w = norm(x.word); won = !!a && (a===w || a.includes(w));
          if(won){ const rk = x.solvers.length, pts = rk===0 ? 3 : rk===1 ? 2 : 1; x.scores = x.scores || {};
            x.scores[me()] = (x.scores[me()]||0) + pts; if(x.drawer) x.scores[x.drawer] = (x.scores[x.drawer]||0) + 1;
            x.solvers.push({ u:me(), pts, secs: Math.max(1, Math.round((Date.now()-x.started)/1000)) });
            x.guesses = (x.guesses||[]).concat([{ by:me(), ok:true, pts, at:Date.now() }]).slice(-30);
            if(here().filter(u=>u!==x.drawer).every(u=>x.solvers.some(v=>v.u===u))) settleMP(x, "all");
          } else { const close = [...w].filter(ch=>a.includes(ch)).length >= Math.max(1, Math.ceil(w.length/2)); x.guesses = (x.guesses||[]).concat([{ t, by:me(), at:Date.now(), close }]).slice(-30); }
          return x; });
        if(won) celebrate(); return;
      }
      await ctx.update("draw", x=>{ if(!x || x.phase!=="draw") return undefined;
        const a = norm(t), w = norm(x.word); won = !!a && (a===w || a.includes(w));
        const close = !won && [...w].filter(ch=>a.includes(ch)).length >= Math.max(1, Math.ceil(w.length/2));
        x.guesses = (x.guesses||[]).concat([{ t, by:me(), at:Date.now(), close }]).slice(-30);
        if(won) settle(x, true); return x; });
      if(won) celebrate();
    }
    function settle(x, ok, why){
      const secs = Math.max(1, Math.round((Date.now() - x.started)/1000));
      x.phase = "done"; x.result = { ok, secs, why: why||null };
      if(ok){ x.solved = (x.solved||0)+1; x.streak = (x.streak||0)+1; x.best = Math.max(x.best||0, x.streak); if(!x.fast || secs < x.fast) x.fast = secs; }
      else x.streak = 0;
      x.hist = (x.hist||[]).concat([{ w:x.word, ok, by:x.drawer, secs }]).slice(-20);
    }
    function celebrate(){ SFX.match(); ctx.burst(); }
    async function finish(ok, why){ await ctx.update("draw", x=>{ if(!x || x.phase!=="draw") return undefined; if(MP) settleMP(x, why); else settle(x, ok, why); return x; }); }
    async function start(i){
      SFX.select();
      const ns = await ctx.update("draw", x=>{ if(!x || x.phase!=="pick" || x.drawer!==me()) return undefined; const o = x.opts[i]; if(!o) return undefined;
        x.word = o[0]; x.cat = o[1]; x.phase = "draw"; x.started = Date.now(); x.until = Date.now() + TIME*1000; x.strokes = []; x.guesses = []; x.hint = 0; if(MP) x.solvers = [];
        x.used = (x.used||[]).concat([o[0]]).slice(-300); return x; });
      if(ns) ctx.notifyPartner(`${ctx.me.name} 在「你畫我猜」畫好題目了，快來猜！🎨`);
    }
    async function next(){
      SFX.next();
      if(MP){ const r0 = s && s.round; await ctx.update("draw", x=>{ if(!x || x.phase!=="done" || x.round!==r0) return undefined; return mpAdvance(x); }); return; }
      const nextDrawer = s.drawer===me() ? other() : me();
      await ctx.update("draw", x=>{ if(!x || x.phase!=="done") return undefined; return fresh(nextDrawer, x); });
    }

    function onState(st){
      const prevPhase = s && s.phase, prevRound = s && s.round;
      s = st;
      if(s && prevPhase==="draw" && s.phase==="done" && s.round===prevRound){ if(s.result && s.result.ok) celebrate(); else SFX.miss(); }
      if(MP && s && s.phase==="over" && prevPhase!=="over" && prevPhase){ SFX.match(); ctx.burst(); }
      if(MP && s && s.phase==="done" && !doneAt[s.round]) doneAt[s.round] = Date.now();
      if(MP) mpHostCheck();
      if(s && s.phase==="draw" && prevPhase!=="draw"){ drawn = 0; drawnKey = ""; lastGuessN = (s.guesses||[]).length; if(!isDrawer()) SFX.next(); }
      render();
      if(s && s.phase==="done" && g) redraw();
    }
    this._u = ctx.onState("draw", onState);
    this._b = ctx.onBroadcast(onLive);
    tick = setInterval(()=>{ if(MP){ mpHostCheck(); autoUi(); } if(!s || s.phase!=="draw") return; timeUi(); if(Date.now() > s.until + 600 && (!MP || isDrawer() || (amHost() && Date.now() > s.until + 10000))) finish(false, "time"); }, 500);
    // 房主負責：把新進來的人排進順序、畫的人離開就跳過、大家都猜對就結束、回合結束後 6 秒自動下一回合
    let hostBusy = false; const doneAt = {};
    function mpHostCheck(){
      if(!MP || !s || hostBusy || !amHost()) return;
      const pl = here(), need = { sync: s.phase!=="lobby" && s.phase!=="over" && (pl.some(u=>!(s.order||[]).includes(u)) || pl.some(u=>(s.scores||{})[u]==null)) };
      need.gone = (s.phase==="pick" || s.phase==="draw") && s.drawer && !pl.includes(s.drawer);
      need.all = s.phase==="draw" && !need.gone && pl.filter(u=>u!==s.drawer).length > 0 && pl.filter(u=>u!==s.drawer).every(u=>(s.solvers||[]).some(v=>v.u===u));
      need.auto = s.phase==="done" && doneAt[s.round] && Date.now() - doneAt[s.round] > 6000;
      need.alone = s.phase!=="lobby" && s.phase!=="over" && pl.length < 2;
      if(!need.sync && !need.gone && !need.all && !need.auto && !need.alone) return;
      hostBusy = true; const r0 = s.round;
      ctx.update("draw", x=>{ if(!x || !x.mp || x.round!==r0) return undefined; let ch = mpSync(x);
        if(here().length < 2 && x.phase!=="lobby" && x.phase!=="over"){ x.phase = "over"; x.drawer = null; return x; }
        if((x.phase==="pick" || x.phase==="draw") && x.drawer && !here().includes(x.drawer)){ if(x.phase==="draw") settleMP(x, "left"); else { x.drawn = x.drawn || {}; x.drawn[x.drawer] = x.per; mpAdvance(x); } return x; }
        if(x.phase==="draw" && here().filter(u=>u!==x.drawer).every(u=>(x.solvers||[]).some(v=>v.u===u))){ settleMP(x, "all"); return x; }
        if(x.phase==="done" && doneAt[x.round] && Date.now() - doneAt[x.round] > 6000){ mpAdvance(x); return x; }
        return ch ? x : undefined; }).finally(()=>{ hostBusy = false; });
    }
    function autoUi(){ const a = $("#drAuto"); if(!a || !s || s.phase!=="done" || !doneAt[s.round]) return; const l = Math.max(0, Math.ceil((doneAt[s.round] + 6000 - Date.now())/1000)); a.textContent = l ? `${l} 秒後自動${mpDoneN(s) >= mpTotal(s) ? "看結果" : "下一回合"}` : ""; }
    if(MP && ctx.onMembers) this._m = ctx.onMembers(()=>{ if(s && (s.phase==="lobby" || s.phase==="pick" || s.phase==="over")) render(); else if(s && s.phase==="draw"){ const bd = $("#drBd"); if(bd) bd.innerHTML = board(s); } mpHostCheck(); });
    const onResize = () => { if(cv) setupCanvas(); };
    window.addEventListener("resize", onResize);
    this._cleanup = () => { closeKb(); document.body.classList.remove("drkb"); document.body.classList.remove("drFullOn"); clearInterval(tick); window.removeEventListener("resize", onResize); };
    (async()=>{
      const I = ctx.players();
      let c = await ctx.getState("draw");
      if(MP && (!c || !c.state || !c.state.mp)){ await ctx.update("draw", x=> x && x.mp ? undefined : lobbyState(null)); c = await ctx.getState("draw"); }
      else if(!c && I.length>=2){ await ctx.update("draw", x=> x ? undefined : fresh(me(), null)); c = await ctx.getState("draw"); }
      s = c ? JSON.parse(JSON.stringify(c.state)) : null;
      if(s && s.phase==="draw") lastGuessN = (s.guesses||[]).length;
      render();
    })();
  },
  unmount(){ if(this._u) this._u(); if(this._b) this._b(); if(this._m) this._m(); if(this._cleanup) this._cleanup(); },
});
})();

// 遊戲：貓貓的一生（單人）
// 選一隻貓、取名字、選出身，每長大一歲遇到一件事，做選擇會改變「健康、快樂、聰明、人緣」。
// 健康變 0 或年紀大了就會回到喵星。比誰的貓活得最久（全站排行榜，更新 82）。
// 一局大約 5～10 分鐘；玩到一半離開，下次可以接著玩（存在這支手機 mw_catlife_run）。
(function(){
const COLORS = ["orange", "white", "calico", "black", "gray"];
const CNAME = { orange:"橘貓", white:"白貓", calico:"三花", black:"黑貓", gray:"灰貓" };
const NAMES = ["咪咪","小橘","糰子","布丁","奶茶","麻糬","阿肥","小黑","雪球","豆花","黑糖","可樂","湯圓","芝麻","小虎","饅頭"];
const STAT = [["h","健康","heart","#f0708d"],["j","快樂","sun","#f5b73b"],["i","聰明","star","#6fb7e8"],["l","人緣","flower","#6cc49d"]];
const ORIGIN = {
  home:  { name:"家貓",  desc:"在溫暖的家裡出生，身體比較好", st:{h:62,j:60,i:48,l:50}, f:["home"] },
  stray: { name:"流浪貓", desc:"在街頭長大，比較聰明但辛苦", st:{h:48,j:50,i:62,l:38}, f:["stray"] },
  shop:  { name:"店貓",  desc:"住在雜貨店，每天看客人來來去去", st:{h:55,j:55,i:50,l:64}, f:["shop","home"] },
  farm:  { name:"農場貓", desc:"在鄉下的農場，到處都是草地", st:{h:66,j:60,i:48,l:44}, f:["farm","home"] },
};
const MAX_AGE = 30;
const SAVE = "mw_catlife_run";

// 事件：[階段, 條件, 標題, 內容, 選項...]
// 階段 k 小貓(0 歲)、y 年輕(1～6)、a 成年(7～11)、s 老貓(12+)、* 都可以
// 條件："" 都可以、"旗子" 要有、"!旗子" 不能有
// 選項：[文字, 效果, 結果]；或 [文字, 機率, [成功效果, 結果], [失敗效果, 結果]]
// 效果："h+5 j-3 +旗子 -旗子"（h 健康 j 快樂 i 聰明 l 人緣）
const EV = [
  ["k","","第一次睜開眼睛","{n}慢慢睜開眼睛，世界好亮、好大。",
    ["往媽媽懷裡鑽","h+6 l+3","暖暖的，好安心。"],
    ["爬出去探險",.7,["i+6 j+5","發現了一顆毛線球！"],["h-6 j-2","滾下小台階，痛痛的。"]]],
  ["k","","搶奶喝","兄弟姊妹都擠在一起搶奶喝。",
    ["用力擠進去","h+7 l-3","吃得飽飽的，可是被大家瞪了一眼。"],
    ["先讓給弟弟","l+7 h-2","弟弟舔了舔你的臉。"]],
  ["k","home","第一次打預防針","醫生拿著小小的針筒走過來。",
    ["乖乖不動","h+10 l+3","一下就好了，醫生誇你好乖。"],
    ["哇哇大叫逃走","h+4 j-4","最後還是被抓回來打了。"]],
  ["k","home","學用貓砂","主人把你放進一盆沙子裡。",
    ["一次就學會","i+7","主人開心得拍照。"],
    ["先在拖鞋上試試看","j+4 l-5","主人的表情很複雜……"]],
  ["k","stray","下雨的夜晚","雨好大，{n}全身都濕了。",
    ["躲進路邊的紙箱","h+3 i+2","紙箱裡有一點點暖。"],
    ["跟著撐傘的人走",.55,["+home -stray +adopt l+12 j+10 h+6","那個人把你抱回家了！從今天起，你有家了。"],["l-3 h-3","那個人沒有注意到你……"]]],
  ["k","shop","第一位客人","雜貨店的門鈴叮咚一聲，有客人進來了。",
    ["跳上櫃台打招呼","l+9 j+3","客人笑著摸摸你的頭。"],
    ["躲在收銀機後面","i+3 h+2","偷偷觀察了好久。"]],
  ["k","farm","第一次看到雞","院子裡有一隻好大的雞。",
    ["撲過去！",.5,["j+7 i+2","雞嚇得飛上了圍牆。"],["h-6 j-3","被雞啄了一下鼻子。"]],
    ["遠遠地觀察","i+6","原來雞是這樣走路的。"]],
  ["k","","第一次照鏡子","鏡子裡有一隻跟你一模一樣的貓！",
    ["對牠哈氣","j+4 i-1","牠也對你哈氣，好可怕。"],
    ["伸爪子碰碰看","i+6","原來那是你自己呀。"]],

  ["y","","窗外的小鳥","窗外停了一隻小鳥，{n}的尾巴一直甩。",
    ["對著窗戶喀喀叫","j+6","叫了一個下午，好滿足。"],
    ["研究怎麼打開窗戶",.45,["i+9 j+4","你學會開窗了！小鳥飛走了就是。"],["h-9 +leg","從窗台上摔了下去，腳好痛。"]]],
  ["y","","新的逗貓棒","主人拿回一根有羽毛的逗貓棒。",
    ["瘋狂追！","j+9 h+4","玩到喘吁吁，開心！"],
    ["假裝沒興趣","i+3 l-2","其實心裡很想玩。"]],
  ["y","home","家裡來了新貓","主人抱回一隻小小的貓。",
    ["主動過去聞聞","l+8 j+4 +friend","你們變成好朋友了。"],
    ["哈氣宣示地盤","j-4 l-4","小貓躲到沙發底下了。"]],
  ["y","","零食時間","主人打開了一包好香的零食。",
    ["再來一包！","j+7 h-6 +fat","好好吃……肚子好像變圓了。"],
    ["吃一點就好","h+4 j+1","主人說你好有節制。"]],
  ["y","home","健康檢查","今天要去看醫生做檢查。",
    ["乖乖給醫生看","h+10 j-2","醫生說你很健康！"],
    ["躲到床底下","h-3 j+2","沒檢查到……下次再說吧。"]],
  ["y","","好熱的夏天","天氣好熱，{n}熱到攤成一片。",
    ["躺在冰涼的地磚上","h+4 j+3","涼涼的好舒服。"],
    ["跑去外面曬太陽",.5,["j+7","今天的太陽剛剛好。"],["h-9","曬太久，中暑了。"]]],
  ["y","","鄰居的狗狗","隔壁的大狗狗在門口搖尾巴。",
    ["跟牠做朋友",.5,["l+10 j+6 +dog","你們每天都隔著門聊天。"],["j-6 h-5","被追著跑了三條街！"]],
    ["炸毛躲開","h+1 i+3","安全第一。"]],
  ["y","!love","心動的感覺","隔壁屋頂上有一隻好好看的貓。",
    ["勇敢地喵一聲",.6,["l+10 j+10 +love","牠也對你喵了一聲！"],["l-2 j-5","牠轉頭就走了……"]],
    ["害羞地躲起來","i+2 j-1","偷偷看了牠一整天。"]],
  ["y","love !kids","小貓出生了","{n}當爸爸媽媽了！小貓們吱吱叫。",
    ["親自教牠們本領","i+5 l+9 h-4 +kids","小貓們學會了撲蝴蝶。"],
    ["請大家一起幫忙照顧","h+2 l+6 j+5 +kids","大家都好疼小貓。"]],
  ["y","","一個空紙箱","地上出現了一個剛剛好的紙箱。",
    ["鑽進去","j+9","剛剛好，太完美了。"],
    ["把它咬得爛爛的","j+5 i+2 l-2","紙屑滿地都是。"]],
  ["y","home","搬家了","全家要搬到新的房子。",
    ["到處聞聞新家","i+6 j+3","每個角落都很新鮮。"],
    ["躲在衣櫃裡三天","j-6 h-2 l+3","主人每天都來陪你說話。"]],
  ["y","","關起來的門","房間的門關起來了，{n}好想進去。",
    ["研究門把",.5,["i+10","你學會開門了！"],["j-3","跳了好多次都打不開。"]],
    ["坐在門口喵到有人開","l+4 j+2","門開了。你又不想進去了。"]],
  ["y","home","主人哭了","主人坐在沙發上偷偷哭。",
    ["走過去蹭蹭","l+11 j+3","主人抱著你，慢慢不哭了。"],
    ["在旁邊靜靜陪著","l+7 i+3","主人摸摸你說：「謝謝你。」"]],
  ["y","stray","街頭的挑戰","一隻大野貓擋在你的路上。",
    ["勇敢對峙",.5,["j+5 l+4","大野貓走開了，大家都很佩服你。"],["h-13 +leg","打輸了，腳受了傷。"]],
    ["繞路走開","i+5","聰明的貓不打沒必要的架。"]],
  ["y","","結紮手術","醫生說做了手術，以後會更健康。",
    ["勇敢面對","h+12 j-4 +fix","睡一覺就結束了，好勇敢。"],
    ["在醫院撒嬌","h+10 l+5 +fix","護士都超喜歡你。"]],
  ["y","","下雪了","外面白茫茫一片，好冷。",
    ["衝出去踩雪","j+9 h-4","留下了一串小腳印。"],
    ["窩在暖爐旁邊","h+5 j+3","瞇著眼睛看雪。"]],
  ["y","","變成網紅了","{n}的影片在網路上爆紅了！",
    ["對著鏡頭擺姿勢","l+12 j+4 +famous","好多人說你好可愛。"],
    ["躲開鏡頭","j+3 i+2","紅不紅沒關係，睡覺比較重要。"]],
  ["y","","桌上的魚","餐桌上有一條剛煎好的魚……",
    ["一口叼走！","j+8 l-7","好吃，但是被罵了。"],
    ["坐好等主人分給你","l+7 i+3","主人分了你一大塊。"]],
  ["y","","不想吃飯","{n}今天怎麼樣都不想吃飯。",
    ["一直喵喵叫告訴大家","h+9 l+3","大家帶你去看醫生，很快就好了。"],
    ["自己躲起來",.45,["h+2","睡了一天，好像好多了。"],["h-16","病得更重了……"]]],
  ["y","stray","找東西吃","肚子好餓，要去哪裡找吃的呢？",
    ["翻翻垃圾桶","h-4 j+2 i+4","找到半個便當。"],
    ["去市場找阿姨",.65,["h+9 l+7","阿姨給了你一條小魚。"],["j-4","今天阿姨沒有來。"]]],
  ["y","stray","愛心志工","有人在巷口放了一個籠子，裡面有罐罐。",
    ["走進去","h+12 l+5 +fix","志工幫你結紮、治好了耳朵，再放你回巷子。"],
    ["不相信人類","i+3 h-3","你繞過了籠子。"]],
  ["y","shop","想摸摸的客人","一位小朋友想摸摸你。",
    ["讓他摸","l+9 j+3","小朋友笑得好開心。"],
    ["只給熟客摸","i+3 l+3","你是有原則的店長。"]],
  ["y","farm","倉庫的老鼠","倉庫裡有老鼠跑來跑去。",
    ["埋伏抓老鼠",.6,["j+6 i+4 l+5","農場主人誇你是最棒的幫手。"],["j-3","老鼠溜走了。"]],
    ["跟老鼠做朋友","l+6 j+4","你們每天一起曬太陽。"]],
  ["y","","學把戲","主人想教你「握手」。",
    ["認真學","i+9 l+4","你學會了！還有零食可以吃。"],
    ["裝作聽不懂","j+3","貓才不握手呢。"]],
  ["y","","洗澡時間","主人放好了一盆溫水……",
    ["忍耐一下","h+5 j-6","洗得香香的。"],
    ["拼命掙扎","h+2 j-3 l-3","主人身上全是水。"]],
  ["y","","高高的地方","冰箱上面看起來很好玩。",
    ["跳上冰箱","j+6 i+3","從上面看，家好小。"],
    ["挑戰書櫃最高層",.55,["j+9","你是家裡最高的貓！"],["h-11 +leg","跳太遠，摔下來扭到腳了。"]]],
  ["y","","蛋糕上的奶油","桌上有一塊生日蛋糕。",
    ["偷舔一口奶油","j+8 h-3","甜甜的！"],
    ["只聞一聞","h+2 j+2 i+2","聞聞就好了。"]],
  ["y","","半夜跑酷","半夜兩點，{n}突然精神好好。",
    ["全家跑一圈！","j+9 h+2 l-4","大家都被你吵醒了。"],
    ["乖乖回去睡","h+5","一覺到天亮。"]],

  ["a","fat","中年發福","{n}最近跳上沙發都有點喘。",
    ["每天運動減肥","h+11 j-4 -fat","瘦回來了，身體好輕！"],
    ["繼續躺著","j+5 h-7","圓圓的也很可愛……吧？"]],
  ["a","","年輕的挑戰者","一隻年輕的貓想搶你最喜歡的位子。",
    ["讓給牠","i+5 l+5","你找到一個更好的位子。"],
    ["擺出老大的氣勢","j+5 l+2","年輕貓乖乖退下了。"]],
  ["a","home","小主人要出遠門","從小陪你長大的小主人要去外地念書了。",
    ["在門口送行","l+9 j-4","小主人說會常常回來看你。"],
    ["偷偷躲進行李箱","j+6 l+4","被發現了，大家又哭又笑。"]],
  ["a","","牙齒痛痛","吃東西的時候牙齒好痛。",
    ["去看牙醫","h+11 j-3","治好了，又可以大口吃飯。"],
    ["改吃軟軟的罐罐","h+4 j+2","軟軟的也很好吃。"]],
  ["a","","午覺越睡越久","{n}現在一天要睡十六個小時。",
    ["睡好睡滿","h+7 j+3","睡飽飽的貓最健康。"],
    ["硬撐起來玩","j+5 h-2","玩一下下就好。"]],
  ["a","","陽光窗台","今天的陽光剛好照在窗台上。",
    ["曬一整天","j+9 h+3","全身暖洋洋的。"],
    ["曬一下就去巡邏","i+4 j+4","家裡一切正常。"]],
  ["a","","醫生的叮嚀","檢查發現{n}有一點小毛病，要吃藥。",
    ["乖乖吃藥","h+13 j-3","很快就好起來了。"],
    ["把藥吐掉","h-5 j+2","藥好苦……"]],
  ["a","","搬到鄉下","全家搬到有大院子的鄉下。",
    ["在草地上打滾","j+9 h+4","原來草地這麼好玩！"],
    ["想念以前的家","j-3 i+4","慢慢地也習慣了。"]],
  ["a","home","主人加班","主人好晚好晚都還沒回家。",
    ["在門口等","l+9 h-2","門一開，你第一個衝過去。"],
    ["自己找樂子","j+5 i+3","把衛生紙捲成一座山。"]],
  ["a","kids","孩子回來看你","{n}的孩子長大了，回來看你。",
    ["舔舔牠的頭","l+9 j+9","牠還是跟小時候一樣撒嬌。"],
    ["教牠新本領","i+6 l+7","牠學得好快，跟你一樣聰明。"]],
  ["a","","家裡來了小貓","家裡又來了一隻小小貓。",
    ["教牠規矩","i+6 l+6 +friend","小貓把你當成老師。"],
    ["默默讓牠","l+5 j+3","小貓偷偷靠著你睡著了。"]],

  ["s","","跳不上沙發","{n}想跳上沙發，但腿沒有以前有力了。",
    ["等主人放小階梯","h+7 l+5","一步一步走上去，剛剛好。"],
    ["硬要跳",.5,["j+7","成功了！還是很厲害。"],["h-12","沒跳上去，扭到腳了。"]]],
  ["s","","眼睛看不太清楚","最近東西都變得霧霧的。",
    ["用鬍鬚感覺","i+7","鬍鬚比眼睛還好用。"],
    ["待在熟悉的地方","h+4 j-2","這裡的每一步都記得。"]],
  ["s","friend","老朋友","{n}跟老朋友一起躺在窗邊。",
    ["一起曬太陽","j+10 l+6","你們都不說話，但很開心。"],
    ["幫牠理毛","l+10 h+2","牠也幫你理了理。"]],
  ["s","dog","老狗狗","隔壁的狗狗也老了，慢慢走到門口。",
    ["隔著門喵一聲","l+9 j+7","牠搖了搖尾巴，還記得你。"],
    ["跟牠一起曬太陽","j+8 h+3","兩個老朋友。"]],
  ["s","","老貓健康檢查","主人說要帶你去做老貓健檢。",
    ["去檢查","h+12 j-3","醫生說你保養得很好。"],
    ["不想出門","j+3 h-5","在家比較舒服。"]],
  ["s","","想起小時候","{n}看到一顆毛線球，想起了小時候。",
    ["追一下下","j+9 h-2","腳步慢了，心還是一樣快。"],
    ["看著它微笑","j+5 i+4","那時候真好玩。"]],
  ["s","","老貓特製餐","主人準備了軟軟的老貓餐。",
    ["乖乖吃完","h+9","吃得乾乾淨淨。"],
    ["挑嘴不吃","h-6 j+2","還是想吃以前的乾乾。"]],
  ["s","","冬天怕冷","今年冬天好冷，{n}一直發抖。",
    ["窩在電熱毯上","h+7 j+4","暖暖的，睡得好熟。"],
    ["鑽進主人的被窩","l+9 h+5","主人抱著你睡。"]],
  ["s","","新來的小貓","家裡來了一隻好吵的小貓。",
    ["當牠的老師","i+6 l+9 j+4","小貓學會了你所有的本領。"],
    ["保持距離","h+3 i+2","老貓需要安靜。"]],
  ["s","home","主人在說話","主人坐在你旁邊，說了好多以前的事。",
    ["呼嚕呼嚕回應","l+11 j+6","主人說：「謝謝你陪我這麼久。」"],
    ["慢慢眨眨眼","l+7 i+3","貓咪眨眼，就是在說「我愛你」。"]],
  ["s","","慢慢散步","今天天氣很好。",
    ["慢慢走一圈","h+6 j+5","每一步都很穩。"],
    ["在門口吹風","j+5 h+1","風裡有花香。"]],

  ["*","","颱風天","外面風好大，窗戶一直響。",
    ["躲到床底下","h+3","等颱風走了再出來。"],
    ["陪主人看窗外","l+7 j+2","有你在，主人就不怕了。"]],
  ["*","","超大罐罐","今天的晚餐是超大的罐罐！",
    ["慢慢享受","h+4 j+9","這是最幸福的一天。"],
    ["分給朋友","l+11 j+4","大家一起吃更好吃。"]],
  ["*","","掉進浴缸","{n}一不小心掉進有水的浴缸！",
    ["拼命爬出來",.6,["i+5","自己爬出來了，好厲害。"],["h-7 j-5","喝了好幾口水。"]],
    ["喵喵叫救命","l+5 h-2","主人馬上把你撈起來。"]],
  ["*","","紙袋大冒險","地上有一個沙沙響的紙袋。",
    ["鑽進去！","j+8","沙沙沙，好好玩。"],
    ["在外面埋伏","i+4 j+4","等它自己動起來。"]],
  ["*","","陌生的聲音","半夜外面傳來奇怪的聲音。",
    ["叫醒主人","l+6 h+2","原來只是風把垃圾桶吹倒了。"],
    ["勇敢去看看",.6,["i+6 j+3","是一隻迷路的小刺蝟。"],["h-6 j-4","被嚇得撞到椅子。"]]],
].concat(window.CATLIFE_MORE || []);   // 更多事件在 games/catlife_more.js（只能加在後面，存檔記的是事件的序號）
// 特別的生日
const MILE = {
  1:  ["一歲生日","{n}一歲了！已經是大貓了。",
    ["許願：身體健康","h+8","吹熄了小魚造型的蠟燭。"],["許願：每天都開心","j+8","收到了一顆新毛線球。"],["許願：交到好朋友","l+8","大家一起唱生日快樂歌。"]],
  10: ["十歲生日","{n}十歲了，是一隻成熟穩重的貓。",
    ["許願：活得長長久久","h+10","主人買了好大的罐罐蛋糕。"],["許願：永遠快樂","j+10","收到了新的貓跳台。"],["許願：大家都愛你","l+10","好多朋友來幫你慶生。"]],
  15: ["長壽貓","{n}十五歲了！大家都說你是長壽貓。",
    ["喵～謝謝大家","l+8 j+6","你得到了「長壽貓」的稱號。"],["呼嚕呼嚕","h+6 j+6","今天的太陽特別溫暖。"]],
  20: ["二十歲了！","{n}二十歲了，是附近最老、最有智慧的貓。",
    ["把智慧傳給小貓們","i+8 l+10","小貓們都圍在你身邊聽故事。"],["好好睡個午覺","h+8 j+8","夢到了小時候的那顆毛線球。"]],
  25: ["傳說中的貓","{n}二十五歲了，大家都說你是傳說。",
    ["慢慢眨眨眼","l+10 j+8","電視台都來採訪你了。"]],
};


// ======================== 第二版：天賦、每年活動、職業、關係、傳承、結局、圖鑑 ========================
const TAL = window.CATLIFE_TAL || [], JOBS = window.CATLIFE_JOBS || [], ENDS = window.CATLIFE_END || [];
const TAL_R = ["普通", "稀有", "傳說"];
const talOf = id => TAL.find(x => x.id === id);
const jobOf = id => JOBS.find(x => x.id === id);
const tals = s => (s.tal || []).map(talOf).filter(Boolean);
const tSum = (s, k) => tals(s).reduce((a, t) => a + (typeof t[k] === "number" ? t[k] : 0), 0);
const tMul = (s, k) => tals(s).reduce((a, t) => a * (typeof t[k] === "number" ? t[k] : 1), 1);
const agingOf = s => Math.max(.6, tMul(s, "aging"));   // 老化最多慢到 0.6 倍
const actMul = (s, id) => tals(s).reduce((a, t) => a * ((t.act && t.act[id]) || 1), 1);
const pick = (a, rnd) => a[Math.floor((rnd || Math.random)() * a.length)];
const FRIEND_N = ["阿胖","小花","嘟嘟","圓圓","皮皮","球球","乖乖","豆豆","毛毛","Q比"];
const MATE_N = ["小月","星星","雪糕","栗子","可可","奶糖","小雨","泡芙"];
const KID_N = ["小豆","小米","小丸","小葵","小綠","小福","小可","小桃","小糖","小團"];
const REL_K = { owner:"主人", friend:"好朋友", mate:"伴侶", kid:"孩子" };
const REL_DO = { owner:["撒嬌","l+3 j+2"], friend:["一起玩","j+4 l+2"], mate:["約會","j+5 l+2"], kid:["陪孩子玩","j+4 i+1"] };

const BADGE = [
  ["long","長壽貓",s => s.age >= 15],["star","喵壽星",s => s.age >= 20],["legend","傳說之貓",s => s.age >= 25],
  ["joy","開心果",s => s.pk.j >= 90],["smart","小天才",s => s.pk.i >= 90],["love","萬人迷",s => s.pk.l >= 90],["fit","健康寶寶",s => s.pk.h >= 95],
  ["kids","當爸媽了",s => s.f.includes("kids")],["adopt","找到家了",s => s.f.includes("adopt")],["friend","好朋友",s => s.f.includes("friend") || s.f.includes("dog")],
  ["jobtop","職業巔峰",s => !!(s.job && s.job.lv >= 3)],["gen3","三代同堂",s => (s.gen || 1) >= 3],["bond","社交達人",s => (s.rel || []).filter(r => r.a >= 70).length >= 3],
  ["nine","九命貓",s => !!s.revived],["hidden","喵星的秘密",s => ["envoy","astro","mage"].some(f => s.f.includes(f))],
];
const BICON = { long:"crown", star:"star", legend:"spark", joy:"sun", smart:"star", love:"flower", fit:"heart", kids:"paw", adopt:"home", friend:"bigpaw", jobtop:"crown", gen3:"paw", bond:"flower", nine:"heart", hidden:"spark" };

const clamp = v => Math.max(0, Math.min(100, Math.round(v)));
const stage = a => a === 0 ? "k" : a <= 6 ? "y" : a <= 11 ? "a" : "s";
const STAGE_N = { k:"小小貓", y:"年輕貓", a:"成年貓", s:"老貓" };
function parse(eff){ const o = { d:{}, add:[], del:[] }; String(eff || "").split(/\s+/).forEach(t => { let m;
  if((m = t.match(/^([hjil])([+-]\d+)$/))) o.d[m[1]] = (o.d[m[1]] || 0) + (+m[2]);
  else if((m = t.match(/^\+(\w+)$/))) o.add.push(m[1]); else if((m = t.match(/^-(\w+)$/))) o.del.push(m[1]); }); return o; }
const okCond = (c, f) => String(c || "").split(/\s+/).filter(x => x && x !== "rare").every(x => x[0] === "!" ? !f.includes(x.slice(1)) : f.includes(x));
const fmtAge = m => `${Math.floor(m / 12)} 歲${m % 12 ? ` ${m % 12} 個月` : ""}`;
function scoreOf(s){ const b = BADGE.filter(x => x[2](s)).length, e = endingOf(s);
  return Math.min(999, s.age * 10 + b * 15 + (e && e.hid ? 40 : 0) + (s.job ? s.job.lv * 8 : 0) + Math.round((s.st.j + s.st.i + s.st.l) / 3)); }
const endingOf = s => ENDS.find(e => { try{ return e.ok(s); }catch(_){ return false; } });

// 舊存檔（第一版）補上新欄位
function norm(s){ if(!s) return s; s.v = 2; s.tal = s.tal || []; s.rel = s.rel || []; s.gen = s.gen || 1; s.fam = s.fam || s.n;
  if(s.ap == null) s.ap = s.age === 0 ? 1 : 2; s.acts = s.acts || []; s.ylog = s.ylog || []; if(s.job === undefined) s.job = null; syncRel(s, Math.random); return s; }
// 有了某些旗子，就多一個家人朋友
function syncRel(s, rnd){
  const add = (k, n, c, a) => { s.rel.push({ id: k + s.rel.length + "_" + Math.floor(rnd() * 1e4), k, n, c, a }); };
  if(s.f.includes("home") && !s.rel.some(r => r.k === "owner")) add("owner", "主人", null, s.f.includes("adopt") ? 60 : 55);
  if((s.f.includes("friend") || s.f.includes("dog") || s.f.includes("granny") || s.f.includes("gang")) && !s.rel.some(r => r.k === "friend"))
    add("friend", s.f.includes("dog") && !s.f.includes("friend") ? "大狗狗" : s.f.includes("granny") && !s.f.includes("friend") ? "阿嬤" : pick(FRIEND_N, rnd), pick(COLORS, rnd), 55);
  if(s.f.includes("love") && !s.rel.some(r => r.k === "mate")) add("mate", pick(MATE_N, rnd), pick(COLORS, rnd), 65);
  if(s.f.includes("kids") && !s.rel.some(r => r.k === "kid")){ const mate = s.rel.find(r => r.k === "mate"), n = 2 + Math.floor(rnd() * 2), names = KID_N.slice().sort(() => rnd() - .5);
    for(let i = 0; i < n; i++) add("kid", names[i], rnd() < .5 ? s.c : (mate ? mate.c : pick(COLORS, rnd)), 70); }
}

// 每年長大：自然老化、天賦、職業、家人朋友，還有隨機的意外
function ageUp(s, rnd){
  const a = s.age, st = s.st; let d = 0;
  if(a >= 2 && a <= 7) d -= 1.5; else if(a >= 8 && a <= 11) d -= 3.2; else if(a >= 12) d -= 4.5 + (a - 12) * 1.15 + (a >= 20 ? (a - 19) * 1.2 : 0);
  if(d < 0) d *= agingOf(s);
  if(st.j < 25) d -= 2; if(s.f.includes("fat")) d -= 1.5; if(s.f.includes("fix")) d += 0.6; if(s.f.includes("stray")) d -= 1.2;
  if(st.j >= 70 && st.l >= 60) d += 1;
  const y = { h:d, j:a >= 12 ? -1 : 0, i:0, l:-0.5 };
  tals(s).forEach(t => { if(t.yearly) for(const k in t.yearly) y[k] += t.yearly[k]; if(t.oldYearly && a >= 12) for(const k in t.oldYearly) y[k] += t.oldYearly[k]; });
  if(s.job && !s.job.ret){ const J = jobOf(s.job.id); if(J) for(const k in J.y) y[k] += J.y[k]; }
  (s.rel || []).forEach(r => { if(r.a >= 70) y[{ owner:"h", mate:"j", friend:"l", kid:"j" }[r.k]] += r.k === "mate" ? 2 : 1;
    r.a = Math.max(0, r.a - (tSum(s, "keepAff") ? 1 : 4)); });
  for(const k in y) st[k] = clamp(st[k] + y[k]);
  const fj = Math.max(0, ...tals(s).map(t => t.floorJ || 0)); if(st.j < fj) st.j = fj;
  if(st.h <= 0) return "weak";
  let risk = a >= 10 ? (a - 9) * 0.017 : 0.003; if(a >= 20) risk += (a - 19) * 0.025;   // 20 歲以後越來越難
  risk *= st.h < 25 ? 3 : st.h < 50 ? 1.6 : st.h < 75 ? 1 : 0.6;
  risk *= Math.sqrt(agingOf(s));
  if(s.f.includes("stray")) risk += 0.012; if(a >= MAX_AGE) risk = 1;
  return rnd() < risk ? "old" : "";
}

function pickEvent(s, rnd){
  if(MILE[s.age] && !s.used.includes("m" + s.age)) return { id: "m" + s.age, e: ["*", ""].concat(MILE[s.age]) };
  const sg = stage(s.age), rareW = .35 * Math.max(1, ...tals(s).map(t => t.rare || 1));
  let pool = EV.map((e, id) => ({ id, e })).filter(x => (x.e[0] === sg || (x.e[0] === "*" && sg !== "k")) && okCond(x.e[1], s.f));
  const fresh = pool.filter(x => !s.used.includes(x.id)); if(fresh.length) pool = fresh;
  // 有條件的事件（跟這隻貓的故事有關）優先一點
  const w = pool.map(x => /\brare\b/.test(x.e[1]) ? rareW : x.e[1] ? 2.2 : 1), tot = w.reduce((a, b) => a + b, 0); let r = rnd() * tot;
  for(let i = 0; i < pool.length; i++){ r -= w[i]; if(r <= 0) return pool[i]; } return pool[pool.length - 1];
}

const HI = { love:"遇見了心動的貓", kids:"小貓出生了", adopt:"找到了一個家", famous:"變成網紅了", hero:"成為大家的英雄", friend:"交到了好朋友", dog:"跟狗狗變成朋友",
  granny:"遇見了好心的阿嬤", model:"當上了貓咪模特兒", meowstar:"被喵星的光看見了", envoy:"和喵星約定好了", magic:"發現自己有魔力", mage:"成為魔法貓", stars:"愛上了星空", astro:"獲選為太空貓", elder:"成了廟口的貓", bird:"守護著小鳥長大" };
const hiAdd = (s, t) => { s.hi = s.hi || []; if(s.hi.length < 14 && !s.hi.some(x => x.t === t)) s.hi.push({ a: s.age, t }); };
function apply(s, eff){ const p = parse(eff), tough = tMul(s, "tough");
  for(const k in p.d){ let v = p.d[k]; if(k === "h" && v < 0 && tough < 1) v = Math.round(v * tough); p.d[k] = v; s.st[k] = clamp(s.st[k] + v); }
  p.del.forEach(f => { s.f = s.f.filter(x => x !== f); });
  p.add.forEach(f => { if(f === "jp"){ if(s.job && !s.job.ret) s.job.p = (s.job.p || 0) + 30; return; } if(!s.f.includes(f)){ s.f.push(f); if(HI[f]) hiAdd(s, HI[f]); } });
  if(s.rel) syncRel(s, Math.random);
  STAT.forEach(([k]) => { s.pk[k] = Math.max(s.pk[k] || 0, s.st[k]); }); return p.d; }

// ---------- 每年可以做的事 ----------
const ACTS = [
  { id:"play",     n:"玩耍",   ic:"yarn",   d:"快樂",       ok:s => true },
  { id:"nap",      n:"睡大覺", ic:"moon",   d:"健康、快樂", ok:s => true },
  { id:"learn",    n:"學本領", ic:"note",   d:"聰明",       ok:s => true },
  { id:"friend",   n:"陪伴",   ic:"flower", d:"家人朋友",   ok:s => true },
  { id:"exercise", n:"運動",   ic:"flame",  d:"健康",       ok:s => s.age >= 1 },
  { id:"vet",      n:"看醫生", ic:"heart",  d:"健康",       ok:s => s.age >= 1 },
  { id:"explore",  n:"探險",   ic:"spark",  d:"不一定成功", ok:s => s.age >= 1 },
  { id:"work",     n:"工作",   ic:"crown",  d:"升職",       ok:s => !!(s.job && !s.job.ret) },
  { id:"job",      n:"找工作", ic:"home",   d:"8 種職業",   ok:s => s.age >= 2 && s.age <= 13 && !s.job },
  { id:"retire",   n:"退休",   ic:"sun",    d:"快樂",       ok:s => !!(s.job && !s.job.ret && s.age >= 12) },
];
// 做一件事：回傳 { t: 結果文字, d: 屬性變化 }
function doAct(s, id, rnd, arg){
  const m = actMul(s, id), eff = (o) => { const p = []; for(const k in o){ const v = Math.round(o[k] * (o[k] > 0 ? m : 1)); if(v) p.push(k + (v > 0 ? "+" : "") + v); } return p.join(" "); };
  const old = s.age >= 12;
  if(id === "play") return { t: pick(["追著毛線球滾來滾去。","跟紙袋大戰三百回合。","玩到整個房間都是貓毛。"], rnd), d: apply(s, eff({ j:6, h:old ? 0 : 1 })) };
  if(id === "nap") return { t: pick(["窩在陽光下睡了一整天。","在紙箱裡睡到流口水。","夢到了一大盤小魚乾。"], rnd), d: apply(s, eff({ h:3, j:3 })) };
  if(id === "learn") return { t: pick(["學會了開抽屜。","研究了一整天的毛線球物理學。","學會了怎麼叫主人起床。"], rnd), d: apply(s, eff({ i:6 })) };
  if(id === "exercise"){ const r = { t: pick(["在貓跳台上爬上爬下。","追著雷射紅點跑了好幾圈。","繞著家裡跑酷。"], rnd), d: apply(s, eff({ h:old ? 4 : 5, j:1 })) };
    if(s.f.includes("fat") && rnd() < .35){ s.f = s.f.filter(x => x !== "fat"); r.t += "肚子變小了一點！"; } return r; }
  if(id === "vet"){ const r = { t: pick(["醫生說要多喝水。","打了一針，好勇敢。","做了全身檢查。"], rnd), d: apply(s, "h+" + (old ? 7 : 8) + " j-3") };
    if(s.f.includes("leg") && rnd() < .3){ s.f = s.f.filter(x => x !== "leg"); r.t += "舊傷也治好了！"; } return r; }
  if(id === "explore"){ const p = .62 + tSum(s, "luck") + tSum(s, "brave");
    if(rnd() < p){ const r = { t: pick(["在後山發現一片花海。","找到一條秘密小路。","爬上了鎮上最高的屋頂。"], rnd), d: apply(s, "j+6 i+3") };
      if(rnd() < .15){ const c = [["meowstar","在森林裡，看到一道溫柔的光……"],["magic","撿到一根會發光的羽毛……"],["stars","在山頂看到了好亮好亮的星空……"]].filter(x => !s.f.includes(x[0]));
        if(c.length){ const x = pick(c, rnd); s.f.push(x[0]); r.t += x[1]; r.clue = 1; hiAdd(s, HI[x[0]]); } }
      return r; }
    return { t: pick(["迷路了，好不容易才回家。","被樹枝刮傷了。","掉進水溝，全身濕透。"], rnd), d: apply(s, "h-6 j-2"), bad: 1 }; }
  if(id === "friend"){ let r = s.rel.find(x => x.id === arg);
    if(!r){ syncRel(s, rnd); s.rel.push({ id: "friend" + s.rel.length + "_" + Math.floor(rnd() * 1e4), k:"friend", n: pick(FRIEND_N, rnd), c: pick(COLORS, rnd), a: 50 });
      if(!s.f.includes("friend")) s.f.push("friend"); r = s.rel[s.rel.length - 1]; hiAdd(s, `認識了「${r.n}」`); return { t: `認識了新朋友「${r.n}」！`, d: apply(s, "l+5 j+3") }; }
    const [nm, ef] = REL_DO[r.k]; r.a = Math.min(100, r.a + Math.round(16 * tMul(s, "aff")));
    return { t: `跟${r.k === "owner" ? "主人" : "「" + r.n + "」"}${nm}，好感度 ${r.a}。`, d: apply(s, ef) }; }
  if(id === "job"){ const J = jobOf(arg); if(!J || !J.req(s)) return null; s.job = { id: J.id, lv: 0, p: 0 }; if(!s.f.includes("job_" + J.id)) s.f.push("job_" + J.id);
    hiAdd(s, `開始當「${J.lv[0]}」`); return { t: `開始當「${J.lv[0]}」了！`, d: apply(s, "j+4") }; }
  if(id === "work"){ const J = jobOf(s.job.id); s.job.p = (s.job.p || 0) + Math.round((24 + rnd() * 16) * tMul(s, "work"));
    let t = pick(["認真工作了一整年。","今天也很努力。","老闆誇你做得很好。"], rnd), d = apply(s, "j-2 l+1");
    if(s.job.p >= 100 && s.job.lv < 3){ s.job.lv++; s.job.p -= 100; t = `升職了！現在是「${J.lv[s.job.lv]}」。`; hiAdd(s, `升職成「${J.lv[s.job.lv]}」`); d = apply(s, "l+4 i+3 j+6"); if(s.job.lv >= 2 && J.id === "explore" && !s.f.includes("stars")) s.f.push("stars"); }
    return { t, d, up: t.startsWith("升職") }; }
  if(id === "retire"){ s.job.ret = 1; return { t: `從「${jobOf(s.job.id).lv[s.job.lv]}」退休了，可以好好休息了。`, d: apply(s, "j+8 h+2") }; }
  return null;
}

App.registerGame({
  id: "catlife",
  added: "2026-11-24",   // 新遊戲排在大廳最前面
  solo: true,
  name: "貓貓的一生",
  desc: "選擇喵生，看你的貓能活多久",
  icon: () => Pix.sprite("orange", "happy"),
  mount(el, ctx){
    const { esc, SFX } = ctx; const me = () => ctx.me.uid;
    let s = null, run = null, alive = true, sub = null;
    el.classList.add("clRoot"); this._el = el;   // sub：活動畫面裡打開的小選單（"friend"／"job"）
    const I = n => `<span class="clI">${Pix.icon(n)}</span>`;
    const load = () => { try{ const r = JSON.parse(localStorage.getItem(SAVE) || "null"); if(r && r.uid === me() && r.st && r.alive) return norm(r); }catch(e){} return null; };
    const save = () => { try{ if(run && run.alive) localStorage.setItem(SAVE, JSON.stringify(run)); else localStorage.removeItem(SAVE); }catch(e){} };
    const face = r => !r.alive ? "sleep" : r.st.h < 30 ? "cry" : r.st.j >= 75 ? "happy" : r.age >= 12 ? (r.st.j >= 50 ? "love" : "normal") : r.st.j < 35 ? "normal" : "happy";
    const fill = t => String(t).replace(/\{n\}/g, esc(run ? run.n : ""));
    const statN = k => STAT.find(x => x[0] === k)[1];
    const bars = r => `<div class="clBars">${STAT.map(([k, n, ic, c]) => `<div class="clBar"><span class="clBI">${I(ic)}</span><b>${n}</b><span class="clBT"><i style="width:${r.st[k]}%;background:${c}"></i></span><em>${r.st[k]}</em></div>`).join("")}</div>`;
    const dl = d => `<div class="clDl">${Object.entries(d || {}).filter(([, v]) => v).map(([k, v]) => `<span class="${v > 0 ? "up" : "dn"}">${statN(k)} ${v > 0 ? "+" : ""}${v}</span>`).join("")}</div>`;
    const talChip = t => `<span class="clTc r${t.r}">${esc(t.n)}</span>`;
    const tIc = t => I((window.ClArt && ClArt.TAL_IC[t.id]) || "star");
    const cardHtml = (t, o) => `<button class="clCard r${t.r}${o.on ? " on" : ""}${o.lock ? " lock" : ""}${o.deal ? " deal" : ""}" ${o.lock ? "" : `data-t="${t.id}"`} style="--d:${o.i || 0}">
      <span class="clCI">${tIc(t)}</span><small>${TAL_R[t.r]}${o.isNew ? "・新" : ""}</small><b>${o.lock ? "？？？" : esc(t.n)}</b><span>${o.lock ? "還沒用過這個天賦" : esc(t.d)}</span>${t.r === 2 && !o.lock ? `<i class="sp1"></i><i class="sp2"></i>` : ""}${o.on ? `<em class="clOk">${I("check")}</em>` : ""}</button>`;
    const jobName = r => r.job ? jobOf(r.job.id).lv[r.job.lv] + (r.job.ret ? "（退休）" : "") : "";
    // 貓（有各階段造型＋階級配件），第 1 階以上身邊有小星星、第 4 階有彩虹光
    const catHtml = (r, fc) => { const A = window.ClArt, t = A && A.tierOf ? A.tierOf(r) : 0;
      return `<div class="clCat t${t}">${A && A.catSvg ? A.catSvg(r, fc) : Pix.sprite(r.c, fc)}${t ? Array.from({ length: t * 2 }, (_, i) => `<i class="clSp" style="--i:${i};left:${4 + (i * 37) % 84}%;top:${4 + (i * 53) % 66}%"></i>`).join("") : ""}</div>`; };
    const where = r => r.f.includes("stray") ? "stray" : r.o === "shop" ? "shop" : r.o === "farm" ? "farm" : "home";
    const top = r => { const A = window.ClArt, sg = stage(r.age);
      return `<div class="clScene s${sg}">${A ? A.scene(where(r), r.age % 4, A.TOD(r.age)) : ""}
        <div class="clPlate"><b>${esc(r.n)}</b><small>${ORIGIN[r.o].name}・${STAGE_N[sg]}${r.gen > 1 ? `・第 ${r.gen} 代` : ""}</small>${A && A.tierOf ? `<span class="clTier t${A.tierOf(r)}">${esc(A.TIER[A.tierOf(r)].n)}</span>` : ""}</div>
        <div class="clAgeB"><b>${r.age}</b><small>歲</small></div>
        ${A ? `<span class="clSeason">${A.SEASON[r.age % 4]}</span>` : ""}
        ${r.job ? `<span class="clJobT">${I(jobOf(r.job.id).ic)}${esc(jobName(r))}</span>` : ""}
        ${catHtml(r, face(r))}</div>
      ${r.tal.length ? `<div class="clTals">${tals(r).map(talChip).join("")}</div>` : ""}`; };
    // 選項會影響哪些屬性（只顯示哪幾個，不顯示多少）
    const pips = c => { const ef = typeof c[1] === "number" ? c[2][0] : c[1], d = parse(ef).d;
      return `<span class="clPips">${STAT.filter(([k]) => d[k]).map(([k, , , col]) => `<i style="background:${col}" class="${d[k] < 0 ? "neg" : ""}"></i>`).join("")}${typeof c[1] === "number" ? `<em>?</em>` : ""}</span>`; };
    const col = () => { const c = (s && s.col && s.col[me()]) || {}; return { t: c.t || [], e: c.e || [], b: c.b || [], j: c.j || {} }; };

    function lobby(){
      if(!alive) return; sub = null; const R = load(), best = (s && s.best && s.best[me()]) || 0, lives = ((s && s.lives && s.lives[me()]) || []).slice().reverse(), C = col();
      el.innerHTML = `<div class="box clLobby">
        <div class="clHero">${window.ClArt ? ClArt.scene("home", 0, "morning") : ""}<i class="k1">${Pix.sprite("calico", "happy")}</i><i class="k2">${Pix.sprite(ctx.me.cat && COLORS.includes(ctx.me.cat) ? ctx.me.cat : "orange", "love")}</i><i class="k3">${Pix.sprite("gray", "curl")}</i></div>
        <h3 class="clTitle">貓貓的一生</h3>
        <p class="clIntro">抽天賦、選出身，陪你的貓<b>一歲一歲</b>長大。<br>每年遇到一件事，還能自己決定要做什麼：<br>交朋友、找工作、去探險……<br>你的選擇會決定牠能<b>活多久</b>、走向哪個<b>結局</b>。</p>
        <div class="clMyBest">${I("crown")}<span>我的最長紀錄</span><b>${best ? fmtAge(best) : "還沒玩過"}</b></div>
        ${R ? `<button class="btn" id="clCont">繼續 ${esc(R.n)} 的喵生（${R.age} 歲）</button><button class="btn sub" id="clNew">開始新的喵生</button>` : `<button class="btn" id="clNew">開始新的喵生</button>`}
        <div class="clTwo"><button class="skRkB" id="clRk">${ctx.icon("crown")}全站排行榜</button><button class="skRkB clDexB" id="clDex">${I("note")}圖鑑 <small>${C.t.length + C.e.length + C.b.length}/${TAL.length + ENDS.length + BADGE.length}</small></button></div>
        ${lives.length ? `<div class="clPast"><div class="clPH">喵星紀念冊</div>${lives.map(x => `<div class="clPI"><span>${Pix.sprite(COLORS.includes(x.c) ? x.c : "orange", "sleep")}</span><b>${esc(x.n)}${x.g > 1 ? `<i>第${x.g}代</i>` : ""}</b><small>${fmtAge(x.m)}・${esc(x.en || x.ep || "")}</small></div>`).join("")}</div>` : ""}
        <div class="k" style="text-align:center">每活 2 歲得 1 個貓幣，最多 12 個，會送進養貓房間</div></div>`;
      const nb = el.querySelector("#clNew"); nb.addEventListener("click", () => { if(R && !nb.dataset.ok){ nb.dataset.ok = 1; nb.textContent = `${R.n} 的喵生會不見喔，再按一次`; SFX.tap(); return; } SFX.tap(); create(); });
      const cb = el.querySelector("#clCont"); if(cb) cb.addEventListener("click", () => { SFX.select(); run = R; year(); });
      el.querySelector("#clRk").addEventListener("click", rank);
      el.querySelector("#clDex").addEventListener("click", dex);
    }

    // ---------- 出生：基本資料 → 抽天賦 → 分配屬性 ----------
    function create(heir){
      let c = heir ? heir.c : (ctx.me.cat && COLORS.includes(ctx.me.cat) ? ctx.me.cat : "orange"), o = heir ? heir.o : "home";
      const nm0 = heir ? heir.n : NAMES[Math.floor(Math.random() * NAMES.length)];
      el.innerHTML = `<div class="box clMake">
        <h3 class="clTitle">${heir ? `第 ${heir.gen} 代的喵生` : "一隻新的貓出生了"}</h3>
        ${heir ? `<p class="clIntro">${esc(heir.parent)}的孩子「${esc(heir.n)}」長大了，<br>接下來換牠過自己的一生。</p><div class="clHeirCat">${Pix.sprite(c, "happy")}</div>`
          : `<div class="clPick" id="clCol">${COLORS.map(x => `<button data-c="${x}" class="${x === c ? "on" : ""}">${Pix.sprite(x, "happy")}<small>${CNAME[x]}</small></button>`).join("")}</div>`}
        <label class="clNm"><span>名字</span><input id="clName" maxlength="6" value="${esc(nm0)}" autocomplete="off">${heir ? "" : `<button class="clDice" id="clRand">換一個</button>`}</label>
        ${heir ? "" : `<div class="clOH">出身</div>
        <div class="clOrig" id="clOrig">${Object.entries(ORIGIN).map(([k, v]) => `<button data-o="${k}" class="${k === o ? "on" : ""}"><b>${v.name}</b><small>${v.desc}</small></button>`).join("")}</div>`}
        <button class="btn" id="clGo">下一步：抽天賦 ▶</button><button class="btn sub" id="clBack">返回</button></div>`;
      el.querySelectorAll("#clCol button").forEach(b => b.addEventListener("click", () => { c = b.dataset.c; SFX.tap(); el.querySelectorAll("#clCol button").forEach(x => x.classList.toggle("on", x === b)); }));
      el.querySelectorAll("#clOrig button").forEach(b => b.addEventListener("click", () => { o = b.dataset.o; SFX.tap(); el.querySelectorAll("#clOrig button").forEach(x => x.classList.toggle("on", x === b)); }));
      const rb = el.querySelector("#clRand"); if(rb) rb.addEventListener("click", () => { SFX.tap(); el.querySelector("#clName").value = NAMES[Math.floor(Math.random() * NAMES.length)]; });
      el.querySelector("#clBack").addEventListener("click", () => { SFX.tap(); lobby(); });
      el.querySelector("#clGo").addEventListener("click", () => { SFX.select();
        const n = (el.querySelector("#clName").value || "").replace(/[<>&"'\s]/g, "").slice(0, 6) || nm0;
        talents({ n, c, o, heir }); });
    }
    function drawTal(n, lock){ const pool = TAL.filter(t => !lock.includes(t.id)), out = [];
      while(out.length < n && pool.length){ const r = Math.random(), want = r < .06 ? 2 : r < .32 ? 1 : 0;
        let cand = pool.filter(t => t.r === want); if(!cand.length) cand = pool; const t = pick(cand); out.push(t.id); pool.splice(pool.indexOf(t), 1); }
      return out.sort((a, b) => talOf(b).r - talOf(a).r); }
    function talents(b){
      const lockId = b.heirTal || null, need = 3; let rolls = 1, deal = true;
      let deck = drawTal(10, lockId ? [lockId] : []), chosen = lockId ? [lockId] : [];
      const paint = () => {
        const C = col();
        el.innerHTML = `<div class="box clMake">
          <h3 class="clTitle">抽天賦</h3>
          <p class="clIntro">從下面選 <b>${need - (lockId ? 1 : 0)}</b> 張天賦${lockId ? "（另一張是家傳的）" : ""}。<br>顏色越亮越稀有：普通・<span class="clR1">稀有</span>・<span class="clR2">傳說</span></p>
          ${lockId ? `<div class="clHeirT">家傳天賦　${talChip(talOf(lockId))}</div>` : ""}
          <div class="clDeck">${deck.map((id, i) => cardHtml(talOf(id), { on: chosen.includes(id), isNew: !C.t.includes(id), deal, i })).join("")}</div>
          <button class="btn sub" id="clRe" ${rolls ? "" : "disabled"}>重抽一次（剩 ${rolls} 次）</button>
          <button class="btn" id="clGo" ${chosen.length === need ? "" : "disabled"}>${chosen.length === need ? "下一步：分配屬性 ▶" : `還要再選 ${need - chosen.length} 張`}</button></div>`;
        deal = false;
        el.querySelectorAll(".clCard").forEach(x => x.addEventListener("click", () => { const id = x.dataset.t;
          if(chosen.includes(id)){ if(id === lockId) return; chosen = chosen.filter(y => y !== id); }
          else if(chosen.length < need) chosen.push(id); else { SFX.tap(); ctx.toast("最多選 3 張，先取消一張"); return; }
          SFX.tap(); paint(); }));
        el.querySelector("#clRe").addEventListener("click", () => { if(!rolls) return; rolls--; SFX.select(); deck = drawTal(10, lockId ? [lockId] : []); chosen = lockId ? [lockId] : []; deal = true; paint(); });
        el.querySelector("#clGo").addEventListener("click", () => { if(chosen.length !== need) return; SFX.select(); alloc(Object.assign(b, { tal: chosen.slice() })); });
      };
      paint();
    }
    function alloc(b){
      const O = ORIGIN[b.o], base = Object.assign({}, O.st);
      tals(b).forEach(t => { if(t.st) for(const k in t.st) base[k] += t.st[k]; });
      if(b.heir && b.heir.bonus) for(const k in b.heir.bonus) base[k] += b.heir.bonus[k];
      const TOT = 20, MAXP = 16, add = { h:0, j:0, i:0, l:0 }; const left = () => TOT - add.h - add.j - add.i - add.l;
      const paint = () => {
        el.innerHTML = `<div class="box clMake">
          <h3 class="clTitle">分配屬性</h3>
          <p class="clIntro">還有 <b id="clLeft">${left()}</b> 點可以分配（每格最多 +${MAXP}）</p>
          <div class="clAlloc">${STAT.map(([k, n, ic, cl]) => `<div class="clAR"><span class="clBI">${I(ic)}</span><b>${n}</b><button data-k="${k}" data-d="-2">−</button><span class="clAV"><i style="width:${clamp(base[k] + add[k])}%;background:${cl}"></i><em>${clamp(base[k] + add[k])}${add[k] ? `<small>+${add[k]}</small>` : ""}</em></span><button data-k="${k}" data-d="2">＋</button></div>`).join("")}</div>
          <div class="clTals">${tals(b).map(talChip).join("")}</div>
          <button class="btn sub" id="clRnd">隨機分配</button>
          <button class="btn" id="clBorn">${left() ? `還有 ${left()} 點沒分完，直接出生` : "出生！"}</button></div>`;
        el.querySelectorAll(".clAR button").forEach(x => x.addEventListener("click", () => { const k = x.dataset.k, d = +x.dataset.d;
          if(d > 0 && (left() < d || add[k] + d > MAXP)) return; if(d < 0 && add[k] + d < 0) return; add[k] += d; SFX.tap(); paint(); }));
        el.querySelector("#clRnd").addEventListener("click", () => { add.h = add.j = add.i = add.l = 0; const ks = ["h","j","i","l"];
          while(left() > 0){ const k = pick(ks); if(add[k] + 2 <= MAXP) add[k] += 2; } SFX.select(); paint(); });
        el.querySelector("#clBorn").addEventListener("click", () => {
          const st = {}; STAT.forEach(([k]) => { st[k] = clamp(base[k] + add[k]); });
          const f = O.f.slice(); tals(b).forEach(t => (t.f || []).forEach(x => { if(!f.includes(x)) f.push(x); }));
          if(b.heir && b.heir.f) b.heir.f.forEach(x => { if(!f.includes(x)) f.push(x); });
          run = norm({ uid: me(), n: b.n, c: b.c, o: b.o, age: 0, st, pk: Object.assign({}, st), f, used: [], mem: [], alive: true, ev: null, res: null, at: Date.now(),
            tal: b.tal, rel: [], gen: b.heir ? b.heir.gen : 1, fam: b.heir ? b.heir.fam : b.n, ap: 1, acts: [], ylog: [], job: null });
          if(b.heir) run.mem.push(`${b.heir.parent}的孩子，第 ${b.heir.gen} 代`);
          SFX.select(); save(); year(); });
      };
      paint();
    }

    // ---------- 每一年 ----------
    function year(){
      if(!alive) return;
      if(run.ev == null){ const p = pickEvent(run, Math.random); run.ev = p.id; run.res = null; run.ap = run.age === 0 ? 1 : 2; run.acts = []; run.ylog = []; save(); }
      const e = typeof run.ev === "string" ? ["*", ""].concat(MILE[+run.ev.slice(1)]) : EV[run.ev];
      const ch = e.slice(4);
      let body;
      if(!run.res){
        body = `<div class="clEv"><div class="clEH">${I("note")}<b>${esc(e[2])}</b><span class="clStep">這一年發生的事</span></div><p>${fill(e[3])}</p>
          <div class="clCh">${ch.map((c, i) => `<button data-i="${i}"><span>${esc(c[0])}</span>${pips(c)}${typeof c[1] === "number" ? `<small>不一定會成功</small>` : ""}</button>`).join("")}</div></div>
          <div class="k clPipK"><span>圓點＝會影響的屬性：</span>${STAT.map(([, n, , c]) => `<span><i style="background:${c}"></i>${n}</span>`).join("")}</div>`;
      } else {
        body = `<div class="clEv done"><div class="clEH">${I("note")}<b>${esc(e[2])}</b></div><div class="clRes"><p>${fill(run.res.t)}</p>${dl(run.res.d)}</div></div>
          <div class="clAct"><div class="clAH"><b>這一年還可以做 ${run.ap} 件事</b>${run.ap ? "" : `<small>已經做完了</small>`}</div>
          ${run.ylog.length ? `<div class="clLog">${run.ylog.map(x => `<div class="${x.bad ? "bad" : x.up ? "upj" : ""}"><b>${esc(x.n)}</b>${fill(x.t)}${dl(x.d)}</div>`).join("")}</div>` : ""}
          ${sub === "friend" ? relPanel() : sub === "job" ? jobPanel() : `<div class="clGrid">${ACTS.filter(a => a.ok(run)).map(a => `<button data-a="${a.id}" ${!run.ap || run.acts.includes(a.id) ? "disabled" : ""}>${I(a.ic)}<b>${a.n}</b><small>${a.d}</small></button>`).join("")}</div>`}
          <button class="btn" id="clNext">長大一歲 ▶</button></div>`;
      }
      el.innerHTML = `<div class="box clYear">${top(run)}${bars(run)}${body}<button class="clQuit" id="clQuit">先休息，等等再玩</button></div>`;
      el.querySelectorAll(".clCh button").forEach(b => b.addEventListener("click", () => choose(ch[+b.dataset.i], e[2])));
      el.querySelectorAll(".clGrid button").forEach(b => b.addEventListener("click", () => act(b.dataset.a)));
      el.querySelectorAll("[data-rel]").forEach(b => b.addEventListener("click", () => act("friend", b.dataset.rel)));
      el.querySelectorAll("[data-job]").forEach(b => b.addEventListener("click", () => act("job", b.dataset.job)));
      const bk = el.querySelector("#clSubX"); if(bk) bk.addEventListener("click", () => { sub = null; SFX.tap(); year(); });
      const nx = el.querySelector("#clNext"); if(nx) nx.addEventListener("click", () => { if(run.ap && !nx.dataset.ok){ nx.dataset.ok = 1; nx.textContent = `還可以做 ${run.ap} 件事，確定要長大？`; SFX.tap(); return; } next(); });
      el.querySelector("#clQuit").addEventListener("click", () => { SFX.tap(); save(); lobby(); });
      const tc = el.querySelector(".clTier"); if(tc) tc.addEventListener("click", () => { SFX.tap(); const t = ClArt.tierOf(run);
        const NEXT = ["7 歲、開始工作、被收養或當爸媽 → 銅星貓", "13 歲、升職 2 次、變成網紅 → 銀月貓", "18 歲、職業做到最高、成為英雄 → 金冠貓", "24 歲，或是走上喵星的秘密路線 → 彩虹傳說貓"];
        ctx.toast(t >= 4 ? "已經是最高的階級「彩虹傳說貓」了！" : `下一個階級：${NEXT[t]}`, 4000); });
    }
    function relPanel(){
      const rs = run.rel;
      return `<div class="clSub"><div class="clSubH"><b>要陪誰？</b><button id="clSubX">返回</button></div>
        ${rs.map(r => `<button class="clRel" data-rel="${r.id}"><span class="clRC">${r.k === "owner" ? I("home") : Pix.sprite(r.c || "orange", r.a >= 70 ? "love" : "happy")}</span><span class="clRN"><b>${esc(r.k === "owner" ? "主人" : r.n)}</b><small>${REL_K[r.k]}・${REL_DO[r.k][0]}</small></span><span class="clRA"><i style="width:${r.a}%"></i></span><em>${r.a}</em></button>`).join("")}
        <button class="clRel new" data-rel="__new"><span class="clRC">${I("bigpaw")}</span><span class="clRN"><b>交新朋友</b><small>認識一隻新的貓</small></span></button>
        <div class="k">好感度 70 以上每年都有好處；不常陪伴的話，好感度會慢慢變少。</div></div>`;
    }
    function jobPanel(){
      return `<div class="clSub"><div class="clSubH"><b>要做什麼工作？</b><button id="clSubX">返回</button></div>
        ${JOBS.map(J => { const ok = J.req(run); return `<button class="clJob${ok ? "" : " no"}" ${ok ? `data-job="${J.id}"` : "disabled"}><span class="clRC">${I(J.ic)}</span><span class="clRN"><b>${esc(J.lv[0])}</b><small>${esc(J.d)}</small></span><em>${ok ? "可以應徵" : "需要" + esc(J.need)}</em></button>`; }).join("")}
        <div class="k">做「工作」可以累積表現、升職，最高到第 4 級。12 歲以後可以退休。</div></div>`;
    }
    function act(id, arg){
      if(!run.ap) return;
      if(id === "friend" && arg == null){ sub = "friend"; SFX.tap(); year(); return; }
      if(id === "job" && arg == null){ sub = "job"; SFX.tap(); year(); return; }
      const A = ACTS.find(x => x.id === id); if(!A || !A.ok(run) || run.acts.includes(id)) return;
      const r = doAct(run, id, Math.random, arg === "__new" ? null : arg); if(!r) return;
      run.ap--; run.acts.push(id); sub = null;
      run.ylog.push({ n: A.n, t: r.t, d: r.d, bad: r.bad, up: r.up || r.clue }); run.mem.push(`${run.age} 歲：${A.n}——${r.t}`); if(run.mem.length > 60) run.mem = run.mem.slice(-60);
      if(r.bad) (SFX.wrong || SFX.tap)(); else if(r.up || r.clue) (SFX.level || SFX.select)(); else SFX.select();
      if(run.st.h <= 0 && !revive()){ die("hurt"); return; }
      save(); year();
    }
    // 九命貓：回喵星的時候可以復活一次
    function revive(){ if(!tals(run).some(t => t.revive) || run.revived) return false;
      run.revived = 1; run.st.h = 50; hiAdd(run, "九命貓發威，復活了一次"); run.mem.push(`${run.age} 歲：九命貓發威，又站起來了！`); ctx.toast(`九命貓發威！${run.n}又站起來了`, 3500); (SFX.level || SFX.select)(); return true; }

    function choose(c, title){
      let eff = c[1], t = c[2], good = true;
      if(typeof c[1] === "number"){ good = Math.random() < Math.min(.95, c[1] + tSum(run, "luck")); const r = good ? c[2] : c[3]; eff = r[0]; t = r[1]; }
      if(Array.isArray(t)) t = t[Math.floor(Math.random() * t.length)];
      const d = apply(run, eff); run.res = { t, d }; run.used.push(run.ev);
      run.mem.push(`${run.age} 歲：${title}——${c[0]}`); if(run.mem.length > 60) run.mem = run.mem.slice(-60);
      if(good) SFX.select(); else (SFX.wrong || SFX.tap)();
      if(run.st.h <= 0 && !revive()){ die("hurt"); return; }
      save(); year();
    }

    function next(){
      SFX.tap(); const tier0 = window.ClArt && ClArt.tierOf ? ClArt.tierOf(run) : 0; const why = ageUp(run, Math.random);
      if(why && !(run.age < MAX_AGE && revive())){ die(why); return; }   // 30 歲就算有九命也到頂了
      run.age++; run.ev = null; run.res = null; sub = null;
      const tier1 = window.ClArt && ClArt.tierOf ? ClArt.tierOf(run) : 0, up = tier1 > tier0 ? ClArt.TIER[tier1].n : "";
      if(up) hiAdd(run, `升階成「${up}」`); save();
      if(run.age === 1 || run.age % 5 === 0) (SFX.level || SFX.select)();
      year();
      const c = el.querySelector(".clScene"); if(c){ c.classList.add("bday"); c.insertAdjacentHTML("beforeend", `<div class="clConf">${Array.from({ length: 14 }, (_, i) => `<i style="--x:${(i * 37) % 100}%;--d:${(i % 5) * 90}ms;--c:${["#ff8fab","#ffd36b","#6fb7e8","#6cc49d","#c38be0"][i % 5]}"></i>`).join("")}</div><div class="clHB${up ? " up" : ""}">${up ? `升階！${up}` : `${run.age} 歲生日快樂！`}</div>`); setTimeout(() => { const x = el.querySelector(".clConf"), y = el.querySelector(".clHB"); if(x) x.remove(); if(y) y.remove(); }, 1900); }
    }

    async function die(why){
      run.alive = false; run.why = why; const m = Math.min(MAX_AGE * 12 + 11, run.age * 12 + Math.floor(Math.random() * 12));
      const top2 = STAT.slice().sort((a, b) => run.st[b[0]] - run.st[a[0]])[0][0];
      const ep = { h:"最健康的貓", j:"每天都很快樂的貓", i:"聰明絕頂的貓", l:"大家最愛的貓" }[top2];
      const E = endingOf(run), mate = run.rel.find(r => r.k === "mate");
      const txt = esc(E.t).replace(/\{n\}/g, esc(run.n)).replace(/\{job\}/g, esc(run.job ? jobOf(run.job.id).lv[run.job.lv] : "")).replace(/\{mate\}/g, mate ? "「" + esc(mate.n) + "」" : "伴侶").replace(/\{gen\}/g, run.gen);
      const bd = BADGE.filter(x => x[2](run)), sc = scoreOf(run), coins = Math.max(1, Math.min(12, Math.floor(run.age / 2)));
      const kids = run.rel.filter(r => r.k === "kid");
      try{ localStorage.removeItem(SAVE); }catch(e){}
      const prev = (s && s.best && s.best[me()]) || 0, rec = m > prev, C0 = col();
      const A = window.ClArt, place = E.hid ? "star" : where(run), shotSvg = A ? A.scene(place, run.age % 4, E.hid ? "night" : A.TOD(run.age)) : "";
      const hi = (run.hi || []).slice(0, 8), catFace = E.hid ? "love" : "sleep";
      el.innerHTML = `<div class="box clEnd clAlbum">
        <div class="clAlbH"><span>${I("star")}</span><b>${esc(run.n)} 的喵生相簿</b><span>${I("star")}</span></div>
        <div class="clPola${E.hid ? " hid" : ""}"><div class="clPolaP">${shotSvg}${catHtml(run, catFace)}${E.hid ? `<i class="tw t1"></i><i class="tw t2"></i><i class="tw t3"></i>` : ""}</div>
          <div class="clPolaC"><b>${esc(run.n)}</b><span>0 歲 ～ ${fmtAge(m)}</span></div>
          <div class="clStamp${E.hid ? " hid" : ""}"><small>${E.hid ? "隱藏結局" : "結局"}</small><b>${esc(E.n)}</b></div></div>
        ${C0.e.includes(E.id) ? "" : `<div class="clFirst">第一次看到這個結局！</div>`}
        <p class="clBye">${txt}</p>
        <div class="clLife"><b>${fmtAge(m)}</b>${rec ? `<span class="clNew">新紀錄！</span>` : ""}<small>${esc(ep)}・喵生分數 ${sc}${run.gen > 1 ? `・第 ${run.gen} 代` : ""}</small></div>
        ${hi.length ? `<div class="clTL"><div class="clPH">喵生大事記</div>${hi.map(x => `<div><em>${x.a} 歲</em><span>${esc(x.t)}</span></div>`).join("")}</div>` : ""}
        ${bars(run)}
        ${run.tal.length ? `<div class="clTals">${tals(run).map(talChip).join("")}</div>` : ""}
        ${bd.length ? `<div class="clBdg">${bd.map(x => `<span>${I(BICON[x[0]])}${x[1]}</span>`).join("")}</div>` : ""}
        <details class="clMem"><summary>完整的喵生回憶（${run.mem.length}）</summary><ol>${run.mem.map(x => `<li>${esc(x)}</li>`).join("")}</ol></details>
        <div class="k" style="text-align:center">得到 ${coins} 個貓幣，送進養貓房間了</div>
        ${kids.length ? `<div class="clHeir"><div class="clPH">傳承：接著玩孩子的一生</div>${kids.map(k => `<button data-kid="${k.id}"><span>${Pix.sprite(k.c || run.c, "happy")}</span><b>${esc(k.n)}</b><small>第 ${run.gen + 1} 代・好感度 ${k.a}</small></button>`).join("")}<div class="k">孩子會繼承一個天賦，好感度越高，出生時屬性越好。</div></div>` : ""}
        <button class="btn sub" id="clSave">${I("camera")}把相簿存成圖片</button>
        <button class="btn" id="clAgain">再活一次</button><button class="btn sub" id="clHome">回到大廳</button></div>`;
      el.querySelector("#clAgain").addEventListener("click", () => { SFX.tap(); create(); });
      el.querySelector("#clHome").addEventListener("click", () => { SFX.tap(); lobby(); });
      const album = { n: run.n, c: run.c, face: catFace, catSvg: window.ClArt && ClArt.catSvg ? ClArt.catSvg(run, catFace) : null, tier: window.ClArt && ClArt.tierOf ? ClArt.TIER[ClArt.tierOf(run)].n : "", svg: shotSvg, en: E.n, hid: E.hid, age: fmtAge(m), txt: E.t.replace(/\{n\}/g, run.n).replace(/\{job\}/g, run.job ? jobOf(run.job.id).lv[run.job.lv] : "").replace(/\{mate\}/g, mate ? "「" + mate.n + "」" : "伴侶").replace(/\{gen\}/g, run.gen),
        ep, sc, hi, st: Object.assign({}, run.st), tal: tals(run).map(t => t.n), gen: run.gen };
      el.querySelector("#clSave").addEventListener("click", () => saveAlbum(album));
      const parent = run;
      el.querySelectorAll("[data-kid]").forEach(b => b.addEventListener("click", () => { const k = parent.rel.find(r => r.id === b.dataset.kid); if(!k) return; SFX.select(); heirTal(parent, k); }));
      (SFX.level || SFX.select)();
      const life = { n: run.n, c: run.c, o: run.o, m, s: sc, ep, en: E.n, g: run.gen, at: Date.now() };
      try{
        await ctx.update("catlife", st => { st = st || {}; ["best", "score", "plays", "lives", "col"].forEach(k => { st[k] = st[k] || {}; });
          st.plays[me()] = (st.plays[me()] || 0) + 1;
          if(m > (st.best[me()] || 0) || (m === st.best[me()] && sc > (st.score[me()] || 0))){ st.best[me()] = m; st.score[me()] = sc; }
          st.lives[me()] = (st.lives[me()] || []).concat([life]).slice(-5);
          const c = st.col[me()] || {}; const u = (a, xs) => Array.from(new Set((a || []).concat(xs)));
          c.t = u(c.t, run.tal); c.e = u(c.e, [E.id]); c.b = u(c.b, bd.map(x => x[0]));
          c.j = c.j || {}; if(run.job) c.j[run.job.id] = Math.max(c.j[run.job.id] == null ? -1 : c.j[run.job.id], run.job.lv);
          st.col[me()] = c; return st; });
        if(rec && ctx.partner()) ctx.notifyPartner(`${ctx.me.name} 的貓「${run.n}」活到了 ${fmtAge(m)}，創下新紀錄！`);
        await ctx.update("pet", st => { if(!st || !window.PetLogic) return undefined; st = window.PetLogic.norm(JSON.parse(JSON.stringify(st)));
          st.coins = (st.coins || 0) + coins; st.log = (st.log || []).concat([{ by: me(), a: "catlife", n: coins, at: Date.now() }]).slice(-24); return st; });
      }catch(e){ ctx.toast("紀錄沒有存到，網路好像不太穩"); }
    }
    // 結局相簿存成圖片（跟你畫我猜一樣用下載）
    async function saveAlbum(a){
      SFX.tap(); try{ await document.fonts.load('20px "Cubic11"'); }catch(e){}
      const img = svg => new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg); });
      const Wd = 720, P = 36, sh = 330, Hh = 1020 + Math.max(0, a.hi.length - 4) * 34;
      const cv = document.createElement("canvas"); cv.width = Wd; cv.height = Hh; const o = cv.getContext("2d"); o.imageSmoothingEnabled = false;
      const O = "#4a3228", F = (n) => `${n}px "Cubic11", sans-serif`;
      o.fillStyle = "#fff8ec"; o.fillRect(0, 0, Wd, Hh);
      o.fillStyle = O; [[0, 0, Wd, 8], [0, Hh - 8, Wd, 8], [0, 0, 8, Hh], [Wd - 8, 0, 8, Hh]].forEach(r => o.fillRect(...r));
      o.fillStyle = "#e4caa5"; o.fillRect(8, Hh - 16, Wd - 16, 8);
      o.textAlign = "center"; o.textBaseline = "middle"; o.fillStyle = O; o.font = F(32); o.fillText(`${a.n} 的喵生相簿`, Wd / 2, 58);
      const px = P + 14, py = 100, pw = Wd - px * 2;
      o.fillStyle = "#ffffff"; o.fillRect(px - 14, py - 14, pw + 28, sh + 100); o.fillStyle = "#e9dccb"; o.fillRect(px - 14, py + sh + 86, pw + 28, 6);
      const sc = await img(a.svg); if(sc) o.drawImage(sc, px, py, pw, sh);
      const cat = await img(a.catSvg || Pix.sprite(a.c, a.face)); if(cat){ const cw = 170; o.drawImage(cat, Wd / 2 - cw / 2, py + sh - cw + 8, cw, cw); }
      o.fillStyle = O; o.font = F(30); o.fillText(a.n, Wd / 2, py + sh + 34); o.font = F(20); o.fillStyle = "#8a7a9a"; o.fillText(`0 歲 ～ ${a.age}${a.tier ? `・${a.tier}` : ""}`, Wd / 2, py + sh + 66);
      let y = py + sh + 136;
      o.fillStyle = a.hid ? "#b07a12" : "#e5486a"; o.font = F(26); o.fillText(`${a.hid ? "隱藏結局" : "結局"}・${a.en}`, Wd / 2, y); y += 40;
      o.fillStyle = O; o.font = F(19); const wrap = (t, w) => { const out = []; let line = ""; for(const ch of t){ if(o.measureText(line + ch).width > w){ out.push(line); line = ch; } else line += ch; } if(line) out.push(line); return out; };
      wrap(a.txt, Wd - P * 2 - 20).forEach(l => { o.fillText(l, Wd / 2, y); y += 30; }); y += 10;
      o.fillStyle = "#8a7a9a"; o.font = F(18); o.fillText(`${a.ep}・喵生分數 ${a.sc}${a.gen > 1 ? `・第 ${a.gen} 代` : ""}`, Wd / 2, y); y += 34;
      const cols = { h:"#f0708d", j:"#f5b73b", i:"#6fb7e8", l:"#6cc49d" }, bw = (Wd - P * 2 - 30) / 2;
      STAT.forEach(([k, n], i) => { const x = P + (i % 2) * (bw + 30), yy = y + Math.floor(i / 2) * 34; o.textAlign = "left"; o.fillStyle = O; o.font = F(18); o.fillText(n, x, yy);
        o.fillStyle = "#eadfcc"; o.fillRect(x + 52, yy - 8, bw - 100, 16); o.fillStyle = cols[k]; o.fillRect(x + 52, yy - 8, (bw - 100) * a.st[k] / 100, 16); o.fillStyle = O; o.textAlign = "right"; o.fillText(String(a.st[k]), x + bw, yy); });
      y += 80; o.textAlign = "center";
      if(a.tal.length){ o.fillStyle = "#9a6a1a"; o.font = F(18); o.fillText("天賦：" + a.tal.join("、"), Wd / 2, y); y += 40; }
      if(a.hi.length){ o.fillStyle = O; o.font = F(20); o.fillText("喵生大事記", Wd / 2, y); y += 34; o.textAlign = "left"; o.font = F(17);
        a.hi.forEach(h => { o.fillStyle = "#ff6f91"; o.fillText(`${h.a} 歲`, P + 30, y); o.fillStyle = O; o.fillText(h.t, P + 110, y); y += 34; }); }
      const d = new Date(); o.textAlign = "center"; o.fillStyle = "#b8a894"; o.font = F(16); o.fillText(`喵喵小窩・貓貓的一生・${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`, Wd / 2, Hh - 40);
      cv.toBlob(blob => { if(!blob){ ctx.toast("存不下來，再試一次"); return; }
        const url = URL.createObjectURL(blob), l = document.createElement("a"); l.href = url; l.download = `貓貓的一生_${a.n.replace(/[\\/:*?"<>|]/g, "")}.png`;
        document.body.appendChild(l); l.click(); l.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000); ctx.toast("存好了！在手機的「下載」資料夾裡", 3500); }, "image/png");
    }
    // 傳承：選一個家傳天賦
    function heirTal(p, k){
      const top2 = STAT.slice().sort((a, b) => p.st[b[0]] - p.st[a[0]])[0][0], bonus = { [top2]: k.a >= 70 ? 8 : 4 };
      const o = p.f.includes("home") ? (p.o === "stray" ? "home" : p.o) : p.o;
      const heir = { n: k.n, c: COLORS.includes(k.c) ? k.c : p.c, o, gen: (p.gen || 1) + 1, fam: p.fam || p.n, parent: p.n, bonus, f: p.f.includes("home") ? ["home"] : [] };
      const opts = tals(p);
      el.innerHTML = `<div class="box clMake"><h3 class="clTitle">家傳天賦</h3>
        <p class="clIntro">「${esc(k.n)}」可以從${esc(p.n)}身上，繼承一個天賦。<br>出生時${statN(top2)}也會 +${bonus[top2]}。</p>
        <div class="clDeck">${opts.map((t, i) => cardHtml(t, { deal: true, i })).join("")}</div>
        <button class="btn sub" id="clNo">不繼承，自己抽 3 張</button></div>`;
      el.querySelectorAll(".clCard").forEach(b => b.addEventListener("click", () => { SFX.select(); create2(b.dataset.t); }));
      el.querySelector("#clNo").addEventListener("click", () => { SFX.tap(); create2(null); });
      const create2 = t => talents({ n: heir.n, c: heir.c, o: heir.o, heir, heirTal: t });
    }

    // ---------- 圖鑑 ----------
    function dex(){
      SFX.tap(); const C = col(); let tab = "t";
      const o = document.createElement("div"); o.className = "careModal svModal clDexM";
      const paint = () => {
        const T = { t:["天賦", C.t.length, TAL.length], e:["結局", C.e.length, ENDS.length], b:["稱號", C.b.length, BADGE.length], j:["職業", Object.keys(C.j).length, JOBS.length] };
        let list = "";
        if(tab === "t") list = `<div class="clDexG">${TAL.map(t => cardHtml(t, { lock: !C.t.includes(t.id) }).replace("<button", "<div").replace(/<\/button>$/, "</div>")).join("")}</div>`;
        if(tab === "e") list = ENDS.map(e => C.e.includes(e.id) ? `<div class="clDexR got${e.hid ? " hid" : ""}">${I(e.hid ? "spark" : "star")}<b>${esc(e.n)}</b><small>${e.hid ? "隱藏結局" : "結局"}</small></div>` : `<div class="clDexR lock">${I("star")}<b>${e.hid ? "？？？（隱藏結局）" : "？？？"}</b><small>還沒看過</small></div>`).join("");
        if(tab === "b") list = BADGE.map(b => C.b.includes(b[0]) ? `<div class="clDexR got">${I(BICON[b[0]])}<b>${esc(b[1])}</b></div>` : `<div class="clDexR lock">${I(BICON[b[0]])}<b>？？？</b></div>`).join("");
        if(tab === "j") list = JOBS.map(J => { const lv = C.j[J.id]; return lv != null ? `<div class="clDexR got">${I(J.ic)}<b>${esc(J.lv[lv])}</b><small>最高第 ${lv + 1} 級</small></div>` : `<div class="clDexR lock">${I(J.ic)}<b>？？？</b><small>還沒做過</small></div>`; }).join("");
        o.innerHTML = `<div class="cmBox"><div class="lrHd">${I("note")}<h3>喵生圖鑑</h3></div>
          <div class="clDexTab">${Object.entries(T).map(([k, v]) => `<button data-tab="${k}" class="${k === tab ? "on" : ""}">${v[0]}<small>${v[1]}/${v[2]}</small></button>`).join("")}</div>
          <div class="clDexL">${list}</div><button class="btn sub" id="clDX" style="width:100%;margin-top:8px">關閉</button></div>`;
        o.querySelectorAll("[data-tab]").forEach(b => b.addEventListener("click", () => { tab = b.dataset.tab; SFX.tap(); paint(); }));
        o.querySelector("#clDX").addEventListener("click", () => o.remove());
      };
      o.addEventListener("click", e => { if(e.target === o) o.remove(); });
      paint(); document.body.appendChild(o);
    }

    // 全站排行榜（更新 82）：比活最久，一樣久比喵生分數
    async function rank(){
      SFX.tap();
      const o = document.createElement("div"); o.className = "careModal svModal skRkM";
      o.innerHTML = `<div class="cmBox"><div class="lrHd">${ctx.icon("crown")}<h3>最長壽的貓</h3></div><div class="lrList" id="clRL"><div class="k" style="text-align:center;padding:20px">讀取中…</div></div>
        <div class="k lrNote">全站一起比誰的貓活最久，一樣久就比喵生分數。名字只顯示第一個字</div><button class="btn sub" id="clRO" style="width:100%;margin-top:8px">關閉</button></div>`;
      o.addEventListener("click", e => { if(e.target === o) o.remove(); });
      document.body.appendChild(o); o.querySelector("#clRO").addEventListener("click", () => o.remove());
      let r; try{ r = await ctx.rpc("catlife_rank"); }catch(e){ const L = o.querySelector("#clRL"); if(L) L.innerHTML = `<div class="k" style="text-align:center;padding:20px">${/catlife_rank|function|schema|no_rpc/.test(String(e && e.message || e)) ? "排行榜還沒開放喔（更新 82）" : "網路好像不太穩，等等再試～"}</div>`; return; }
      if(!o.isConnected) return;
      const row = (x, mine) => `<div class="lrRow ${mine ? "me" : ""} ${x.rk <= 3 ? "top" + x.rk : ""}"><b class="lrRk">${x.rk <= 3 ? ctx.icon("crown") : ""}<i>${x.rk}</i></b><span class="lrCats"><span>${Pix.sprite(mine ? (ctx.me.cat || "orange") : (x.cat || "orange"), x.rk <= 3 ? "happy" : "loaf", { plain:true })}</span></span>
        <span class="lrWho"><b>${esc(mine ? (ctx.me.name || "我") : x.name)}</b><small>喵生分數 ${x.sc || 0}</small></span><span class="lrH skPt">${fmtAge(x.best)}</span></div>`;
      const tp = (r && r.top) || [], me2 = r && r.mine;
      o.querySelector("#clRL").innerHTML = (tp.length ? tp.map(x => row(x, x.me)).join("") : `<div class="k" style="text-align:center;padding:20px">還沒有人上榜，快來當第一名！</div>`)
        + (me2 && !tp.some(x => x.me) ? `<div class="lrGap">⋯</div>${row(me2, true)}` : "")
        + (!me2 ? `<div class="k" style="text-align:center;margin-top:8px">你還沒上榜，活完一生就會出現囉！</div>` : "");
      const c = tp.some(x => x.me) && o.querySelector(".lrRow.me"); if(c) setTimeout(() => c.scrollIntoView({ block:"center" }), 60);
    }

    this._u = ctx.onState("catlife", st => { s = st; if(el.querySelector(".clLobby")) lobby(); });
    (async () => { const cur = await ctx.getState("catlife").catch(() => null); s = cur ? cur.state : null; lobby(); })();
    this._end = () => { alive = false; save(); };
  },
  unmount(){ if(this._u) this._u(); if(this._end) this._end(); if(this._el) this._el.classList.remove("clRoot"); },
});

// 測試用：模擬很多局看平均活多久（pick："best" 好好照顧／其他＝隨便選）
window.__catlifeSim = (n, pickMode, talIds) => { const out = [], ends = {}; const R = Math.random;
  for(let k = 0; k < (n || 1000); k++){ const oid = Object.keys(ORIGIN)[k % 4], O = ORIGIN[oid];
    const tal = talIds || (pickMode === "best" ? ["strong","longev","healer"] : [TAL[Math.floor(R() * TAL.length)].id, TAL[Math.floor(R() * TAL.length)].id]);
    const st = Object.assign({}, O.st); tal.map(talOf).filter(Boolean).forEach(t => { if(t.st) for(const x in t.st) st[x] += t.st[x]; });
    const add = pickMode === "best" ? { h:12, j:8, i:0, l:0 } : { h:5, j:5, i:5, l:5 }; for(const x in add) st[x] = clamp(st[x] + add[x]);
    const f = O.f.slice(); tal.map(talOf).filter(Boolean).forEach(t => (t.f || []).forEach(x => { if(!f.includes(x)) f.push(x); }));
    const s = norm({ age: 0, n:"測", c:"orange", o: oid, st, pk: Object.assign({}, st), f, used: [], mem: [], tal, rel: [], gen: 1, job: null });
    let why = "";
    for(;;){ const p = pickEvent(s, R); const e = typeof p.id === "string" ? ["*", ""].concat(MILE[+p.id.slice(1)]) : p.e; const ch = e.slice(4);
      const c = ch[pickMode === "best" ? ch.reduce((bi, c, i, a) => { const v = x => { const ef = typeof x[1] === "number" ? x[2][0] : x[1]; const d = parse(ef).d; return (d.h || 0) * 2 + (d.j || 0) + (d.l || 0) * .5; }; return v(c) > v(a[bi]) ? i : bi; }, 0) : Math.floor(R() * ch.length)];
      let eff = c[1]; if(typeof c[1] === "number") eff = R() < c[1] + tSum(s, "luck") ? c[2][0] : c[3][0];
      apply(s, eff); s.used.push(p.id); if(s.st.h <= 0){ why = "hurt"; break; }
      const ap = s.age === 0 ? 1 : 2, done = [];
      for(let q = 0; q < ap; q++){ const can = ACTS.filter(a => a.ok(s) && !done.includes(a.id));
        let a = pickMode === "best" ? (can.find(x => x.id === (s.st.h < 85 ? "vet" : "exercise")) || can.find(x => x.id === "nap") || can[0]) : can[Math.floor(R() * can.length)];
        if(!a) break; done.push(a.id);
        doAct(s, a.id, R, a.id === "job" ? (JOBS.find(J => J.req(s)) || {}).id : a.id === "friend" ? (s.rel[0] || {}).id : null); }
      if(s.st.h <= 0){ why = "hurt"; break; }
      why = ageUp(s, R); if(why) break; s.age++; }
    s.why = why; out.push(s.age); const E = endingOf(s); ends[E.id] = (ends[E.id] || 0) + 1; }
  out.sort((a, b) => a - b); return { avg: +(out.reduce((a, b) => a + b, 0) / out.length).toFixed(1), p10: out[Math.floor(out.length * .1)], p50: out[Math.floor(out.length * .5)], p90: out[Math.floor(out.length * .9)], max: out[out.length - 1], ends }; };
})();

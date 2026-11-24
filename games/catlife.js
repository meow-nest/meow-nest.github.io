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

const BADGE = [
  ["long","長壽貓",s => s.age >= 15],["star","喵壽星",s => s.age >= 20],["legend","傳說之貓",s => s.age >= 25],
  ["joy","開心果",s => s.pk.j >= 90],["smart","小天才",s => s.pk.i >= 90],["love","萬人迷",s => s.pk.l >= 90],["fit","健康寶寶",s => s.pk.h >= 95],
  ["kids","當爸媽了",s => s.f.includes("kids")],["adopt","找到家了",s => s.f.includes("adopt")],["friend","好朋友",s => s.f.includes("friend") || s.f.includes("dog")],
];
const BICON = { long:"crown", star:"star", legend:"spark", joy:"sun", smart:"star", love:"flower", fit:"heart", kids:"paw", adopt:"home", friend:"bigpaw" };

const clamp = v => Math.max(0, Math.min(100, Math.round(v)));
const stage = a => a === 0 ? "k" : a <= 6 ? "y" : a <= 11 ? "a" : "s";
const STAGE_N = { k:"小小貓", y:"年輕貓", a:"成年貓", s:"老貓" };
function parse(eff){ const o = { d:{}, add:[], del:[] }; String(eff || "").split(/\s+/).forEach(t => { let m;
  if((m = t.match(/^([hjil])([+-]\d+)$/))) o.d[m[1]] = (o.d[m[1]] || 0) + (+m[2]);
  else if((m = t.match(/^\+(\w+)$/))) o.add.push(m[1]); else if((m = t.match(/^-(\w+)$/))) o.del.push(m[1]); }); return o; }
const okCond = (c, f) => String(c || "").split(/\s+/).filter(x => x && x !== "rare").every(x => x[0] === "!" ? !f.includes(x.slice(1)) : f.includes(x));
const fmtAge = m => `${Math.floor(m / 12)} 歲${m % 12 ? ` ${m % 12} 個月` : ""}`;
function scoreOf(s){ const b = BADGE.filter(x => x[2](s)).length; return Math.min(999, s.age * 10 + b * 20 + Math.round((s.st.j + s.st.i + s.st.l) / 3)); }

// 每年長大：自然老化、隨機的意外
function ageUp(s, rnd){
  const a = s.age, st = s.st; let d = 0;
  if(a >= 2 && a <= 7) d -= 1; else if(a >= 8 && a <= 11) d -= 2.5; else if(a >= 12) d -= 3.5 + (a - 12) * 0.9;
  if(st.j < 25) d -= 2; if(s.f.includes("fat")) d -= 1.5; if(s.f.includes("fix")) d += 0.6; if(s.f.includes("stray")) d -= 1.2;
  if(st.j >= 70 && st.l >= 60) d += 1;
  st.h = clamp(st.h + d); st.j = clamp(st.j - (a >= 12 ? 1 : 0)); st.l = clamp(st.l - 0.5);
  if(st.h <= 0) return "weak";
  let risk = a >= 10 ? (a - 9) * 0.013 : 0.003;
  risk *= st.h < 25 ? 3 : st.h < 50 ? 1.6 : st.h < 75 ? 1 : 0.6;
  if(s.f.includes("stray")) risk += 0.012; if(a >= MAX_AGE) risk = 1;
  return rnd() < risk ? "old" : "";
}

function pickEvent(s, rnd){
  if(MILE[s.age] && !s.used.includes("m" + s.age)) return { id: "m" + s.age, e: ["*", ""].concat(MILE[s.age]) };
  const sg = stage(s.age);
  let pool = EV.map((e, id) => ({ id, e })).filter(x => (x.e[0] === sg || (x.e[0] === "*" && sg !== "k")) && okCond(x.e[1], s.f));
  const fresh = pool.filter(x => !s.used.includes(x.id)); if(fresh.length) pool = fresh;
  // 有條件的事件（跟這隻貓的故事有關）優先一點
  const w = pool.map(x => /\brare\b/.test(x.e[1]) ? .35 : x.e[1] ? 2.2 : 1), tot = w.reduce((a, b) => a + b, 0); let r = rnd() * tot;
  for(let i = 0; i < pool.length; i++){ r -= w[i]; if(r <= 0) return pool[i]; } return pool[pool.length - 1];
}

function apply(s, eff){ const p = parse(eff); for(const k in p.d) s.st[k] = clamp(s.st[k] + p.d[k]);
  p.del.forEach(f => { s.f = s.f.filter(x => x !== f); }); p.add.forEach(f => { if(!s.f.includes(f)) s.f.push(f); });
  STAT.forEach(([k]) => { s.pk[k] = Math.max(s.pk[k] || 0, s.st[k]); }); return p.d; }

App.registerGame({
  id: "catlife",
  solo: true,
  name: "貓貓的一生",
  desc: "選擇喵生，看你的貓能活多久",
  icon: () => Pix.sprite("orange", "happy"),
  mount(el, ctx){
    const { esc, SFX } = ctx; const me = () => ctx.me.uid;
    let s = null, run = null, alive = true;
    const I = n => `<span class="clI">${Pix.icon(n)}</span>`;
    const load = () => { try{ const r = JSON.parse(localStorage.getItem(SAVE) || "null"); if(r && r.uid === me() && r.st && r.alive) return r; }catch(e){} return null; };
    const save = () => { try{ if(run && run.alive) localStorage.setItem(SAVE, JSON.stringify(run)); else localStorage.removeItem(SAVE); }catch(e){} };
    const face = r => !r.alive ? "sleep" : r.st.h < 30 ? "cry" : r.st.j >= 75 ? "happy" : r.age >= 12 ? (r.st.j >= 50 ? "love" : "normal") : r.st.j < 35 ? "normal" : "happy";
    const fill = t => String(t).replace(/\{n\}/g, esc(run ? run.n : ""));
    const bars = r => `<div class="clBars">${STAT.map(([k, n, ic, c]) => `<div class="clBar"><span class="clBI">${I(ic)}</span><b>${n}</b><span class="clBT"><i style="width:${r.st[k]}%;background:${c}"></i></span><em>${r.st[k]}</em></div>`).join("")}</div>`;
    const top = r => `<div class="clTop s${stage(r.age)}"><div class="clCat">${Pix.sprite(r.c, face(r))}</div><div class="clWho"><b>${esc(r.n)}</b><small>${ORIGIN[r.o].name}・${STAGE_N[stage(r.age)]}</small><span class="clAge">${r.age}<small>歲</small></span></div></div>`;

    function lobby(){
      if(!alive) return; const R = load(), best = (s && s.best && s.best[me()]) || 0, lives = ((s && s.lives && s.lives[me()]) || []).slice().reverse();
      el.innerHTML = `<div class="box clLobby">
        <div class="clHero"><i class="k1">${Pix.sprite("calico", "happy")}</i><i class="k2">${Pix.sprite(ctx.me.cat && COLORS.includes(ctx.me.cat) ? ctx.me.cat : "orange", "love")}</i><i class="k3">${Pix.sprite("gray", "curl")}</i></div>
        <h3 class="clTitle">貓貓的一生</h3>
        <p class="clIntro">選一隻貓、幫牠取名字，<br>每長大<b>一歲</b>都會遇到一件事。<br>你的選擇會決定牠能<b>活多久</b>。</p>
        <div class="clMyBest">${I("crown")}<span>我的最長紀錄</span><b>${best ? fmtAge(best) : "還沒玩過"}</b></div>
        ${R ? `<button class="btn" id="clCont">繼續 ${esc(R.n)} 的喵生（${R.age} 歲）</button><button class="btn sub" id="clNew">開始新的喵生</button>` : `<button class="btn" id="clNew">開始新的喵生</button>`}
        <button class="skRkB" id="clRk">${ctx.icon("crown")}全站排行榜</button>
        ${lives.length ? `<div class="clPast"><div class="clPH">喵星紀念冊</div>${lives.map(x => `<div class="clPI"><span>${Pix.sprite(COLORS.includes(x.c) ? x.c : "orange", "sleep")}</span><b>${esc(x.n)}</b><small>${fmtAge(x.m)}・${esc(x.ep || "")}</small></div>`).join("")}</div>` : ""}
        <div class="k" style="text-align:center">每活 2 歲得 1 個貓幣，最多 12 個，會送進養貓房間</div></div>`;
      const nb = el.querySelector("#clNew"); nb.addEventListener("click", () => { if(R && !nb.dataset.ok){ nb.dataset.ok = 1; nb.textContent = `${R.n} 的喵生會不見喔，再按一次`; SFX.tap(); return; } SFX.tap(); create(); });
      const cb = el.querySelector("#clCont"); if(cb) cb.addEventListener("click", () => { SFX.select(); run = R; year(); });
      el.querySelector("#clRk").addEventListener("click", rank);
    }

    function create(){
      let c = ctx.me.cat && COLORS.includes(ctx.me.cat) ? ctx.me.cat : "orange", o = "home";
      const nm0 = NAMES[Math.floor(Math.random() * NAMES.length)];
      el.innerHTML = `<div class="box clMake">
        <h3 class="clTitle">一隻新的貓出生了</h3>
        <div class="clPick" id="clCol">${COLORS.map(x => `<button data-c="${x}" class="${x === c ? "on" : ""}">${Pix.sprite(x, "happy")}<small>${CNAME[x]}</small></button>`).join("")}</div>
        <label class="clNm"><span>名字</span><input id="clName" maxlength="6" value="${esc(nm0)}" autocomplete="off"><button class="clDice" id="clRand">換一個</button></label>
        <div class="clOH">出身</div>
        <div class="clOrig" id="clOrig">${Object.entries(ORIGIN).map(([k, v]) => `<button data-o="${k}" class="${k === o ? "on" : ""}"><b>${v.name}</b><small>${v.desc}</small></button>`).join("")}</div>
        <button class="btn" id="clBorn">出生！</button><button class="btn sub" id="clBack">返回</button></div>`;
      el.querySelectorAll("#clCol button").forEach(b => b.addEventListener("click", () => { c = b.dataset.c; SFX.tap(); el.querySelectorAll("#clCol button").forEach(x => x.classList.toggle("on", x === b)); }));
      el.querySelectorAll("#clOrig button").forEach(b => b.addEventListener("click", () => { o = b.dataset.o; SFX.tap(); el.querySelectorAll("#clOrig button").forEach(x => x.classList.toggle("on", x === b)); }));
      el.querySelector("#clRand").addEventListener("click", () => { SFX.tap(); el.querySelector("#clName").value = NAMES[Math.floor(Math.random() * NAMES.length)]; });
      el.querySelector("#clBack").addEventListener("click", () => { SFX.tap(); lobby(); });
      el.querySelector("#clBorn").addEventListener("click", () => {
        const n = (el.querySelector("#clName").value || "").replace(/[<>&"'\s]/g, "").slice(0, 6) || nm0;
        const O = ORIGIN[o]; run = { uid: me(), n, c, o, age: 0, st: Object.assign({}, O.st), pk: Object.assign({}, O.st), f: O.f.slice(), used: [], mem: [], alive: true, ev: null, res: null, at: Date.now() };
        SFX.select(); save(); year();
      });
    }

    function year(){
      if(!alive) return;
      if(run.ev == null){ const p = pickEvent(run, Math.random); run.ev = p.id; run.res = null; save(); }
      const e = typeof run.ev === "string" ? ["*", ""].concat(MILE[+run.ev.slice(1)]) : EV[run.ev];
      const ch = e.slice(4);
      el.innerHTML = `<div class="box clYear">${top(run)}${bars(run)}
        <div class="clEv">
          <div class="clEH">${I("note")}<b>${esc(e[2])}</b></div>
          <p>${fill(e[3])}</p>
          ${run.res ? `<div class="clRes"><p>${fill(run.res.t)}</p><div class="clDl">${Object.entries(run.res.d).map(([k, v]) => { const S = STAT.find(x => x[0] === k); return `<span class="${v > 0 ? "up" : "dn"}">${S[1]} ${v > 0 ? "+" : ""}${v}</span>`; }).join("")}</div></div>
            <button class="btn" id="clNext">長大一歲 ▶</button>`
          : `<div class="clCh">${ch.map((c, i) => `<button data-i="${i}">${esc(c[0])}${typeof c[1] === "number" ? `<small>不一定會成功</small>` : ""}</button>`).join("")}</div>`}
        </div>
        <button class="clQuit" id="clQuit">先休息，等等再玩</button></div>`;
      el.querySelectorAll(".clCh button").forEach(b => b.addEventListener("click", () => choose(ch[+b.dataset.i], e[2])));
      const nx = el.querySelector("#clNext"); if(nx) nx.addEventListener("click", next);
      el.querySelector("#clQuit").addEventListener("click", () => { SFX.tap(); save(); lobby(); });
    }

    function choose(c, title){
      let eff = c[1], t = c[2], good = true;
      if(typeof c[1] === "number"){ good = Math.random() < c[1]; const r = good ? c[2] : c[3]; eff = r[0]; t = r[1]; }
      if(Array.isArray(t)) t = t[Math.floor(Math.random() * t.length)];
      const d = apply(run, eff); run.res = { t, d }; run.used.push(run.ev);
      run.mem.push(title + "：" + c[0]); if(run.mem.length > 40) run.mem = run.mem.slice(-40);
      if(good) SFX.select(); else (SFX.wrong || SFX.tap)();
      if(run.st.h <= 0){ die("hurt"); return; }
      save(); year();
    }

    function next(){
      SFX.tap(); const why = ageUp(run, Math.random);
      if(why){ die(why); return; }
      run.age++; run.ev = null; run.res = null; save();
      if(run.age === 1 || run.age % 5 === 0) (SFX.level || SFX.select)();
      year();
      const c = el.querySelector(".clCat"); if(c){ c.classList.add("grow"); }
    }

    async function die(why){
      run.alive = false; const m = Math.min(MAX_AGE * 12 + 11, run.age * 12 + Math.floor(Math.random() * 12));
      const top2 = STAT.slice().sort((a, b) => run.st[b[0]] - run.st[a[0]])[0][0];
      const ep = { h:"最健康的貓", j:"每天都很快樂的貓", i:"聰明絕頂的貓", l:"大家最愛的貓" }[top2];
      const bd = BADGE.filter(x => x[2](run)), sc = scoreOf(run), coins = Math.max(1, Math.min(12, Math.floor(run.age / 2)));
      const txt = why === "hurt" ? `${esc(run.n)}受了傷，提早回到了喵星。` : why === "weak" ? `${esc(run.n)}累了，在主人懷裡慢慢睡著，回到了喵星。` : run.age < 10 ? `${esc(run.n)}生了一場急病，大家都很捨不得，牠回到了喵星。` : `${esc(run.n)}在溫暖的陽光下睡著了，回到了喵星。`;
      try{ localStorage.removeItem(SAVE); }catch(e){}
      const prev = (s && s.best && s.best[me()]) || 0, rec = m > prev;
      el.innerHTML = `<div class="box clEnd">
        <div class="clStar">${["s1","s2","s3","s4"].map(x => `<i class="${x}">${Pix.icon("star")}</i>`).join("")}<div class="clCat">${Pix.sprite(run.c, "sleep")}</div></div>
        <h3 class="clTitle">${esc(run.n)} 的一生</h3>
        <p class="clBye">${txt}</p>
        <div class="clLife"><b>${fmtAge(m)}</b>${rec ? `<span class="clNew">新紀錄！</span>` : ""}<small>${esc(ep)}・喵生分數 ${sc}</small></div>
        ${bars(run)}
        ${bd.length ? `<div class="clBdg">${bd.map(x => `<span>${I(BICON[x[0]])}${x[1]}</span>`).join("")}</div>` : ""}
        <details class="clMem"><summary>喵生回憶（${run.mem.length}）</summary><ol>${run.mem.map(x => `<li>${esc(x)}</li>`).join("")}</ol></details>
        <div class="k" style="text-align:center">得到 ${coins} 個貓幣，送進養貓房間了</div>
        <button class="btn" id="clAgain">再活一次</button><button class="btn sub" id="clHome">回到大廳</button></div>`;
      el.querySelector("#clAgain").addEventListener("click", () => { SFX.tap(); create(); });
      el.querySelector("#clHome").addEventListener("click", () => { SFX.tap(); lobby(); });
      (SFX.level || SFX.select)();
      const life = { n: run.n, c: run.c, o: run.o, m, s: sc, ep, at: Date.now() };
      try{
        await ctx.update("catlife", st => { st = st || {}; ["best", "score", "plays", "lives"].forEach(k => { st[k] = st[k] || {}; });
          st.plays[me()] = (st.plays[me()] || 0) + 1;
          if(m > (st.best[me()] || 0) || (m === st.best[me()] && sc > (st.score[me()] || 0))){ st.best[me()] = m; st.score[me()] = sc; }
          st.lives[me()] = (st.lives[me()] || []).concat([life]).slice(-5); return st; });
        if(rec && ctx.partner()) ctx.notifyPartner(`${ctx.me.name} 的貓「${run.n}」活到了 ${fmtAge(m)}，創下新紀錄！`);
        await ctx.update("pet", st => { if(!st || !window.PetLogic) return undefined; st = window.PetLogic.norm(JSON.parse(JSON.stringify(st)));
          st.coins = (st.coins || 0) + coins; st.log = (st.log || []).concat([{ by: me(), a: "catlife", n: coins, at: Date.now() }]).slice(-24); return st; });
      }catch(e){ ctx.toast("紀錄沒有存到，網路好像不太穩"); }
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
  unmount(){ if(this._u) this._u(); if(this._end) this._end(); },
});
// 測試用：模擬很多局看平均活多久
window.__catlifeSim = (n, pick) => { const out = []; for(let k = 0; k < (n || 1000); k++){ const O = ORIGIN[Object.keys(ORIGIN)[k % 4]];
  const s = { age: 0, st: Object.assign({}, O.st), pk: Object.assign({}, O.st), f: O.f.slice(), used: [] };
  for(;;){ const p = pickEvent(s, Math.random); const e = typeof p.id === "string" ? ["*", ""].concat(MILE[+p.id.slice(1)]) : p.e; const ch = e.slice(4);
    const c = ch[pick === "best" ? ch.reduce((bi, c, i, a) => { const v = x => { const ef = typeof x[1] === "number" ? x[2][0] : x[1]; const d = parse(ef).d; return (d.h || 0) * 2 + (d.j || 0) + (d.l || 0) * .5; }; return v(c) > v(a[bi]) ? i : bi; }, 0) : Math.floor(Math.random() * ch.length)];
    let eff = c[1]; if(typeof c[1] === "number") eff = Math.random() < c[1] ? c[2][0] : c[3][0];
    apply(s, eff); s.used.push(p.id); if(s.st.h <= 0) break; if(ageUp(s, Math.random)) break; s.age++; }
  out.push(s.age); } out.sort((a, b) => a - b); return { avg: out.reduce((a, b) => a + b, 0) / out.length, p10: out[Math.floor(out.length * .1)], p50: out[Math.floor(out.length * .5)], p90: out[Math.floor(out.length * .9)], max: out[out.length - 1] }; };
})();

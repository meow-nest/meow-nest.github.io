// 遊戲：喵喵夾娃娃機（像真的娃娃機：前後左右移動、30 秒倒數、娃娃有物理）
// 投幣後用十字鍵移動爪子，按「夾！」或時間到就下爪。娃娃會滾、會疊、會卡在出口擋板上，也可以把娃娃推進出口。
// 每天 10 次免費，之後 1 次 1 個貓幣。連續沒夾到 8 次，下一次一定夾得到（幸運值）。
// 夾到的娃娃擺進「蒐集櫃」（展示用），點下去打開「蒐集冊」那一頁看介紹；同一款有 3 個可以用 2 個升級成閃亮版，重複的也可以送給 ta。
(function(){
const O = "#5a3b2e";
const PX = (rows, pal) => { pal = Object.assign({ O }, pal); const w = Math.max(...rows.map(r => r.length)), h = rows.length; let r = "";
  rows.forEach((row, y) => [...row].forEach((c, x) => { if(pal[c]) r += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${pal[c]}"/>`; }));
  return `<svg viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg">${pxC(r)}</svg>`; };
const CLAW_OPEN = PX(["....OOOOO....","....OGGGO....","..OOOGGGOOO..",".OGGGHGGGGGO.","OGO.......OGO","OGO.......OGO","OGO.......OGO",".OGO.....OGO.","..OO.....OO.."], { O: "#5b6b8c", G: "#c9d3e3", H: "#ffffff" });
const CLAW_SHUT = PX(["....OOOOO....","....OGGGO....","..OOOGGGOOO..",".OGGGHGGGGGO.","..OGO...OGO..","...OGO.OGO...","....OGOGO....",".....OOO....."], { O: "#5b6b8c", G: "#c9d3e3", H: "#ffffff" });
const MOUSE = PX([".OOO.......OOO.","OGPGO.....OGPGO","OGPGOOOOOOOGPGO",".OGGGGGGGGGGGO.","..OGEHGGGEHGO..","..OGEEGGGEEGO..","WW.OGGGNGGGO.WW","..WWOGGGGGOWW..","....OOGGGOO....","......OOO......"], { G: "#b8bfd2", P: "#f7a7b8", N: "#f0708d", E: "#2b1d18", H: "#fff", W: "#fff" });
const CROWN = PX(["O...O...O","OYO.OYO.OYO".slice(0, 9),"OYYOYYOYO","OYYYRYYYO","OOOOOOOOO"], { Y: "#f6c45f", R: "#e5484d" });
const HALO = PX(["..OOOOO..",".OY...YO.","..OOOOO.."], { Y: "#fff07a", O: "#e8a400" });

// ---- 獎品的像素圖 ----
const ART = {
  chick: [PX(["...OOOOO...","..OYYYYYO..",".OYYYYYYYO.",".OYEYYYEYO.","OYYYYAYYYYO","OYPYYYYYPYO","OYYYYYYYYYO",".OYYYYYYYO.","..OOOOOOO..","...A...A..."], { Y: "#ffd95a", A: "#f29b38", E: "#2b1d18", P: "#f7a7b8" })],
  rabbit: [PX(["..OO...OO..",".OWPO.OPWO.",".OWPO.OPWO.",".OWWOOOWWO.","OWWWWWWWWWO","OWEWWWWWEWO","OWPWWNWWPWO","OWWWWWWWWWO",".OWWWWWWWO.","..OOOOOOO.."], { W: "#ffffff", P: "#f7a7b8", N: "#f0708d", E: "#2b1d18" })],
  bear: [PX([".OO.....OO.","OBBO...OBBO","OBBOOOOOBBO",".OBBBBBBBO.","OBBEBBBEBBO","OBBBTTTBBBO","OBPBTNTBPBO","OBBBTTTBBBO",".OBBBBBBBO.","..OOOOOOO.."], { B: "#b07a4f", T: "#ecd0a6", N: "#3a2a22", E: "#2b1d18", P: "#f2a1ae" })],
  dog: [PX(["..OOOOOOO..",".OTTTTTTTO.","OBOTTTTTOBO","OBOETTTEOBO","OBOTTTTTOBO","OBOPTNTPOBO",".OOTTTTTOO.","..OTTKTTO..","...OOOOO..."], { T: "#f6e2c2", B: "#a8754a", E: "#2b1d18", N: "#3a2a22", P: "#f7a7b8", K: "#f0708d" })],
  penguin: [PX(["...OOOOO...","..OKKKKKO..",".OKKWWWKKO.",".OKWEWEWKO.",".OKWWAWWKO.","OKKWWWWWKKO","OKOWWWWWOKO",".OKWWWWWKO.","..OOWWWOO..","..AA...AA.."], { K: "#3b4155", W: "#ffffff", A: "#f29b38", E: "#2b1d18" })],
  frog: [PX([".OOO...OOO.","OWEWO.OWEWO","OGGGOOOGGGO","OGGGGGGGGGO","OGPGGGGGPGO","OGGOGGGOGGO","OGGGOOOGGGO",".OGGGGGGGO.","OGGOOOOOGGO",".OO.....OO."], { G: "#86d36f", W: "#ffffff", E: "#2b1d18", P: "#f7a7b8" })],
  bird: [PX(["....OOOO...","...OBBBBO..","..OBBBBBBO.","AAOBEBBBBO.",".OBBBBBBBBO",".OBWWWBBBBO",".OBWWWWBBO.","..OBWWBBO..","...OOOOO...","....A.A...."], { B: "#7ab8f0", W: "#e3f2ff", A: "#f29b38", E: "#2b1d18" })],
  pig: [PX([".OO.....OO.","OPPO...OPPO","OPPPOOOPPPO","OPPPPPPPPPO","OPEPPPPPEPO","OPPPQQQPPPO","OPKPNQNPKPO","OPPPQQQPPPO",".OPPPPPPPO.","..OOOOOOO.."], { P: "#f8bfcc", Q: "#f08ba3", N: "#a24a62", E: "#2b1d18", K: "#f0708d" })],
  donut: [PX(["..OOOOOO..",".OKKWKKYO.","OKYKKKKWKO","OKKKOOKKKO","OKWO..OKYO","ODKKOOKKDO","ODDKKKKDDO",".ODDDDDDO.","..OOOOOO.."], { K: "#f7a7c8", W: "#ffffff", Y: "#ffd95a", D: "#e0a463" })],
  pudding: [PX(["...OOOO...","..OCCCCO..","..OCCCCO..",".OYYYYYYO.",".OYHYYYYO.","OYYYYYYYYO","OYHYYYYYYO","OOOOOOOOOO","OWWWWWWWWO",".OOOOOOOO."], { C: "#8b4a26", Y: "#ffd56a", H: "#fff2b0", W: "#e9f1fb" })],
  cake: [PX(["....OO....","...ORRO...","..OORROO..",".OWWWWWWO.",".OWWWWWWO.",".ORRRRRRO.",".OYYYYYYO.",".OWWWWWWO.",".OYYYYYYO.",".OOOOOOOO."], { R: "#ef5a6f", W: "#ffffff", Y: "#f6d58c" })],
  boba: [PX([".....OO...",".....OS...","..OOOOOOO.",".OWWWWWWWO",".OMMMMMMMO",".OMMMMMMMO","..OMMMMMO.","..ODMDMDO.","..OMDMDMO.","...OOOOO.."], { M: "#d9b48f", D: "#3a2a22", W: "#fff7ec", S: "#f0708d" })],
  onigiri: [PX(["....OO....","...OWWO...","..OWWWWO..",".OWWWWWWO.",".OWEWWEWO.","OWPWWWWPWO","OWWWWWWWWO","OWNNNNNNWO","ONNNNNNNNO",".OOOOOOOO."], { W: "#ffffff", N: "#2f3b33", E: "#2b1d18", P: "#f7a7b8" })],
  sushi: [PX(["..OOOOOO..",".OSSWSSSO.","OSSSSWSSSO","OSWSSSSWSO","OOOOOOOOOO","OWWWWWWWWO","OWWWWWWWWO",".OOOOOOOO."], { S: "#f79a6a", W: "#ffffff" })],
  icecream: [PX(["...OOOO...","..OPPPPO..",".OPPHPPPO.",".OPPPPPPO.","OPPOPPOPPO","OCCCCCCCCO",".OCXCCXCO.","..OCCXCO..","..OCXCCO..","...OCCO...","....OO...."], { P: "#f7a7c8", H: "#ffffff", C: "#ecbb78", X: "#c98a42" })],
  milk: [PX(["...OOOO...","..OWWWWO..",".OWWWWWWO.",".OOOOOOOO.",".OWWWWWWO.",".OBBWWBBO.",".OWBBBBWO.",".OWWWWWWO.",".OWWWWWWO.",".OOOOOOOO."], { W: "#ffffff", B: "#7ab8f0" })],
  yarn: [PX(["...OOOO....",".OORRLROO..",".ORLRRRLRO.","ORRRLRRRRO.","ORLRRRLRRO.","ORRRLRRRLO.",".ORRRRLRO..",".OOLRRROO..","...OOOOOOLL"], { R: "#f07a9a", L: "#ffc1d3" })],
  bell: [PX(["....OO....","...OYYO...","..OOOOOO..",".OYYHYYYO.",".OYHYYYYO.","OYYYYYYYYO","OYYYYYYYYO","OOOOOOOOOO","...OKKO...","....OO...."], { Y: "#f6c45f", H: "#fff2b0", K: "#8b5a2b" })],
  moon: [PX(["...OOOO...","..OYYYO...",".OYYYO....","OYYYO.....","OYYEO.....","OYYYO.....","OYPYYO....",".OYYYYOOO.","..OYYYYYYO","...OOOOOO."], { Y: "#ffe27a", E: "#2b1d18", P: "#f7a7b8" })],
  cloud: [PX(["....OOO.....","..OOWWWOOO..",".OWWWWWWWWO.","OWWWWWWWWWWO","OWWEWWWWEWWO","OWPWWOOWWPWO","OWWWWWWWWWWO",".OOOOOOOOOO."], { W: "#ffffff", E: "#2b1d18", P: "#f7a7b8" })],
  ribbon: [PX(["OO.......OO","OKOO...OOKO","OKKKOOOKKKO","OKKKOWOKKKO","OKKKOOOKKKO","OKOO.O.OOKO","OO..OKO..OO","...OKO.OKO.","...OO...OO."], { K: "#f0708d", W: "#ffc1d3" })],
  gift: [PX(["..OO..OO..",".OKKOOKKO.","..OOKKOO..","OOOOKKOOOO","OBBBKKBBBO","OOOOKKOOOO",".OBBKKBBO.",".OBBKKBBO.",".OBBKKBBO.",".OOOOOOOO."], { B: "#7ab8f0", K: "#f0708d" })],
  mushroom: [PX(["...OOOO...",".OORRRROO.","ORWRRRRWRO","ORRRRWRRRO","OOOOOOOOOO","..OWWWWO..","..OEWWEO..","..OWWWWO..","...OOOO..."], { R: "#e5484d", W: "#ffffff", E: "#2b1d18" })],
  cactus: [PX(["....OO....","...OGGO...","...OGGO.O.",".O.OGGOOGO","OGOOGGOGGO","OGGGGGGGO.",".OOOGGOO..","..OOOOOOO.","..OTTTTTO.","...OTTTO.."], { G: "#6cbf5a", T: "#d8875a" })],
};
const ic = k => () => ART[k][0];
const sp = (c, f) => () => Pix.sprite(c, f);
// 獎品：[名字, 稀有度 0 普通 1 稀有 2 超稀有, 畫法, 特效 class, id, 分類, 介紹]
// 介面用的小像素圖示（不用 emoji）
const ICO = {
  cat: () => PX([".O.....O.","OYO...OYO","OYYOOOYYO","OYYYYYYYO","OYEYYYEYO","OYYYNYYYO",".OYYYYYO.","..OOOOO.."], { Y: "#f2b06a", E: "#2b1d18", N: "#f0708d" }),
  paw: () => Pix.icon("paw"), cake: () => ART.cake[0], ribbon: () => ART.ribbon[0], gift: () => ART.gift[0], crown: () => CROWN, lock: () => ICO._lock,
  spark: () => PX(["...O...","...Y...","..OYO..","OYYWYYO","..OYO..","...Y...","...O..."], { O: "#c8922f", Y: "#f6c45f", W: "#fff6c8" }),
  star: () => Pix.icon("star"), star0: () => Pix.icon("star", { Y: "#eadfce", O: "#b9a99a" }),
  trophy: () => PX(["..OOOOOOO..","OOOYYHYYOOO","OYOYYHYYOYO","OYOYYYYYOYO",".OOYYYYYOO.","...OYYYO...","....OYO....","....OYO....","...OOOOO...","..OBBBBBO..","..OOOOOOO.."], { Y: "#f6c45f", H: "#fff2b0", B: "#8b5a2b" }),
  book: () => PX(["OOOOOOOOOO","OKKKKKKKKO","OKOYYYYOKO","OKKKKKKKKO","OKKKKKKKKO","OKKKKKKKKO","OKKKKKKKKO","OOOOOOOOOO","OWWWWWWWWO","OOOOOOOOOO"], { K: "#d9455f", Y: "#f6c45f", W: "#ffffff" }),
  coin: () => PX(["..OOOO..",".OYYYYO.","OYHYYYYO","OYYOOYYO","OYYOOYYO","OYYYYYYO",".OYYYYO.","..OOOO.."], { Y: "#f6c45f", H: "#fff2b0" }),
  wrench: () => PX(["....O.O","....OGO","...OGGO","..OGGO.",".OGGO..","OGGO...","OOO...."], { G: "#a7aec2" }),
  down: () => PX(["..OOO..","..OWO..","..OWO..","OOOWOOO",".OWWWO.","..OWO..","...O..."], { O: "#3a2a22", W: "#ffd95a" }),
  _lock: PX(["..OOOO..",".OO..OO.",".O....O.","OOOOOOOO","OYYYYYYO","OYYOOYYO","OYYOOYYO","OYYYYYYO","OOOOOOOO"], { Y: "#f6c45f" }),
};
const I = (k, cls) => `<span class="cwI ${cls || ""}">${ICO[k]()}</span>`;
const stars = r => I("star").repeat(r + 1) + I("star0").repeat(2 - r);
const CATS = [["cat", "貓咪娃娃", "cat"], ["ani", "動物朋友", "paw"], ["food", "點心", "cake"], ["item", "小物", "ribbon"], ["sp", "超稀有", "spark"]];
const catLabel = c => `${I(c[2])} ${c[1]}`;
const PRIZES = [
  ["橘貓娃娃", 0, sp("orange", "happy"), "", "cat_orange", "cat", "最常見也最受歡迎的橘貓，抱起來暖呼呼的，聽說吃得比誰都多。"],
  ["白貓娃娃", 0, sp("white", "normal"), "", "cat_white", "cat", "安靜又乖巧的白貓，喜歡坐在窗邊看外面的鳥。"],
  ["灰貓娃娃", 0, sp("gray", "happy"), "", "cat_gray", "cat", "毛色像下雨天的雲，個性卻像晴天一樣開朗。"],
  ["吐司貓", 0, sp("orange", "loaf"), "", "cat_loaf", "cat", "把腳全部收起來變成一條吐司，是貓咪最放鬆的姿勢。"],
  ["瞌睡橘貓", 0, sp("orange", "sleep"), "", "cat_sleepy", "cat", "一天要睡十六個小時，夾起來的時候也還在睡。"],
  ["愛心眼白貓", 0, sp("white", "love"), "", "cat_heart", "cat", "看到罐罐眼睛就會變成愛心，非常好懂。"],
  ["生氣灰貓", 0, sp("gray", "angry"), "", "cat_grump", "cat", "其實沒有在生氣，只是天生長這樣，摸摸就好了。"],
  ["驚訝三花", 0, sp("calico", "surprised"), "", "cat_wow", "cat", "被小黃瓜嚇到的那一瞬間，被做成了娃娃。"],
  ["愛哭橘貓", 0, sp("orange", "cry"), "", "cat_cry", "cat", "罐罐開慢了就會哭，抱抱牠就不哭了。"],
  ["睡覺黑貓", 0, sp("black", "sleep"), "", "cat_bsleep", "cat", "在黑暗中睡覺時幾乎看不見，常常被踩到尾巴。"],
  ["黑貓娃娃", 1, sp("black", "love"), "", "cat_black", "cat", "傳說抱著黑貓娃娃睡覺，會做到好夢。"],
  ["三花貓娃娃", 1, sp("calico", "happy"), "", "cat_calico", "cat", "三種顏色的毛，每一隻花紋都獨一無二。"],
  ["捲捲貓", 1, sp("gray", "curl"), "", "cat_curl", "cat", "捲成一顆圓圓的球，尾巴剛好蓋住鼻子。"],
  ["黑吐司", 1, sp("black", "loaf"), "", "cat_bloaf", "cat", "烤焦的吐司？不，是一隻很滿足的黑貓。"],
  ["招手白貓", 1, sp("white", "wave"), "", "cat_wave", "cat", "一直在跟你打招呼，好像很高興見到你。"],
  ["三花捲捲", 1, sp("calico", "curl"), "", "cat_ccurl", "cat", "捲起來的時候，三種顏色會變成漂亮的漩渦。"],
  ["老鼠玩偶", 0, () => MOUSE, "", "mouse", "ani", "貓咪最愛追的老鼠，這隻是布做的，不用怕。"],
  ["小雞", 0, ic("chick"), "", "chick", "ani", "黃色毛毛的小雞，會一直跟在你後面嗶嗶叫。"],
  ["小熊", 0, ic("bear"), "", "bear", "ani", "愛吃蜂蜜的小熊，抱起來軟綿綿的。"],
  ["小狗", 0, ic("dog"), "", "dog", "ani", "貓咪的好朋友（有時候），尾巴搖個不停。"],
  ["青蛙", 0, ic("frog"), "", "frog", "ani", "下雨天最開心的青蛙，叫聲是呱呱呱。"],
  ["藍色小鳥", 0, ic("bird"), "", "bird", "ani", "貓咪每天在窗邊盯著看的那隻小鳥，終於抓到了！"],
  ["小豬", 0, ic("pig"), "", "pig", "ani", "粉紅色的小豬，鼻子會發出噗噗聲。"],
  ["兔兔", 1, ic("rabbit"), "", "rabbit", "ani", "長耳朵的兔兔，聽得到你小聲說的悄悄話。"],
  ["企鵝", 1, ic("penguin"), "", "penguin", "ani", "從很冷的地方來的企鵝，走路搖搖擺擺的。"],
  ["小魚乾", 0, () => Pix.icon("fish", { B: "#d9a066" }), "", "fish_dry", "food", "貓咪最愛的零食，聞到味道就會跑過來。"],
  ["甜甜圈", 0, ic("donut"), "", "donut", "food", "粉紅色糖霜加彩色糖粒，中間的洞可以偷看。"],
  ["布丁", 0, ic("pudding"), "", "pudding", "food", "搖一搖會晃來晃去，上面是苦苦甜甜的焦糖。"],
  ["珍珠奶茶", 0, ic("boba"), "", "boba", "food", "台灣之光！珍珠要用大吸管才吸得上來。"],
  ["飯糰", 0, ic("onigiri"), "", "onigiri", "food", "包著海苔的飯糰，今天的口味是鮭魚。"],
  ["冰淇淋", 0, ic("icecream"), "", "icecream", "food", "草莓口味，要趕快吃不然會融化。"],
  ["牛奶", 0, ic("milk"), "", "milk", "food", "小貓咪喝的是貓咪專用牛奶喔，人類的會拉肚子。"],
  ["草莓蛋糕", 1, ic("cake"), "", "cake", "food", "生日才吃得到的草莓蛋糕，上面的草莓要留到最後吃。"],
  ["鮭魚壽司", 1, ic("sushi"), "", "sushi", "food", "貓咪看到會流口水的鮭魚壽司，油花滿滿。"],
  ["小魚抱枕", 0, () => Pix.icon("fish"), "", "pillow_fish", "item", "藍色小魚形狀的抱枕，午睡時枕著剛剛好。"],
  ["愛心抱枕", 0, () => Pix.icon("heart"), "", "pillow_heart", "item", "送給喜歡的人的愛心，抱著會覺得被愛。"],
  ["貓掌抱枕", 0, () => Pix.icon("paw"), "", "pillow_paw", "item", "粉紅色肉球，按下去軟軟彈彈的。"],
  ["毛線球", 0, ic("yarn"), "", "yarn", "item", "貓咪的頭號玩具，一玩就會滾得到處都是。"],
  ["鈴鐺", 0, ic("bell"), "", "bell", "item", "掛在項圈上叮叮噹噹，貓咪走到哪都知道。"],
  ["雲朵", 0, ic("cloud"), "", "cloud", "item", "從天上摘下來的雲，軟到可以拿來當枕頭。"],
  ["蝴蝶結", 0, ic("ribbon"), "", "ribbon", "item", "綁在貓咪脖子上，瞬間變成小紳士小淑女。"],
  ["蘑菇", 0, ic("mushroom"), "", "mushroom", "item", "紅底白點的小蘑菇，看起來很可愛但不能吃。"],
  ["仙人掌", 0, ic("cactus"), "", "cactus", "item", "布做的仙人掌，不會刺刺的，可以放心抱。"],
  ["星星抱枕", 1, () => Pix.icon("star"), "", "pillow_star", "item", "晚上會在夢裡發光的星星抱枕。"],
  ["粉紅小魚", 1, () => Pix.icon("fish", { B: "#f7a7b8" }), "", "fish_pink", "item", "很少見的粉紅色小魚，據說會帶來戀愛運。"],
  ["月亮", 1, ic("moon"), "", "moon", "item", "彎彎的月亮在偷笑，陪你一起熬夜。"],
  ["禮物盒", 1, ic("gift"), "", "gift", "item", "裡面裝著什麼？是驚喜，也可能是一隻貓。"],
  ["金色招財貓", 2, sp("orange", "wave"), "gold", "sp_gold", "sp", "閃閃發亮的招財貓，一直招手把好運招過來。"],
  ["彩虹貓", 2, sp("white", "happy"), "rainbow", "sp_rainbow", "sp", "會一直變色的神奇貓咪，雨後才會出現。"],
  ["皇冠貓", 2, () => `<span class="cwCrown">${CROWN}</span>${Pix.sprite("calico", "love")}`, "", "sp_crown", "sp", "貓咪王國的國王，戴著閃亮的小皇冠。"],
  ["天使貓", 2, () => `<span class="cwHalo">${HALO}</span>${Pix.sprite("white", "sleep")}`, "", "sp_angel", "sp", "頭上有光圈的天使，睡著的樣子像在守護你。"],
  ["夜光貓", 2, sp("black", "happy"), "night", "sp_night", "sp", "在黑暗中會發出藍色的光，晚上關燈後最美。"],
];
const IDX = {}; PRIZES.forEach((p, i) => IDX[p[4]] = i);
// 舊版收藏是用編號存的，換成新的 id
const OLD = ["cat_orange","cat_white","cat_gray","cat_loaf","pillow_fish","pillow_heart","pillow_paw","mouse","cat_black","cat_calico","cat_curl","pillow_star","fish_pink","sp_gold","sp_rainbow","sp_crown","sp_angel"];
const normCol = c => { if(!c) return {}; const r = {}; for(const k in c){ const id = /^\d+$/.test(k) ? OLD[+k] : k; if(id && IDX[id] != null) r[id] = (r[id] || 0) + (c[k] || 0); } return r; };
const RAR = [["普通", "#9aa3bd"], ["稀有", "#5e9de6"], ["超稀有", "#e8a400"]];
const FREE = 10, PITY = 8;
const today = () => new Date().toDateString();
const pick = () => { const r = Math.random(), tier = r < .07 ? 2 : r < .32 ? 1 : 0; const L = PRIZES.map((p, i) => [p, i]).filter(([p]) => p[1] === tier); return L[(Math.random()*L.length)|0][1]; };
const art = i => `<span class="cwArt ${PRIZES[i][3] || ""}">${PRIZES[i][2]()}</span>`;
// 機台裡的娃娃：後面疊兩層深色做出厚度，上面再蓋一層光影（用娃娃自己的形狀當遮罩）
const MASKS = {};
const maskOf = i => { if(MASKS[i]) return MASKS[i]; const m = PRIZES[i][2]().match(/<svg[\s\S]*?<\/svg>/g); const svg = m ? m[m.length - 1] : "";
  return MASKS[i] = `url('data:image/svg+xml;utf8,${encodeURIComponent(svg)}')`; };
// 閃亮版：娃娃本身外面加一道會掃過去的光（用娃娃形狀當遮罩）
const SPK = PX(["...O...","..OWO..",".OWYWO.","OWYYYWO",".OWYWO.","..OWO..","...O..."], { O: "#d99a1e", W: "#ffffff", Y: "#fff3a8" });
const shinyArt = i => { const mk = maskOf(i), m = `-webkit-mask-image:${mk};mask-image:${mk}`;
  return `<span class="cwShinyA">${art(i)}<span class="cwHolo" style="${m}"></span><span class="cwSheen" style="${m}"></span>${[1, 2, 3, 4].map(n => `<span class="cwSpk k${n}">${SPK}</span>`).join("")}</span>`; };
const SHINY_COST = 2, SHINY_NEED = 3;
// 每天固定一批：用台灣日期當種子，大家同一天看到的一樣
const dayKey = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
const seeded = str => { let h = 1779033703 ^ str.length; for(const ch of str){ h = Math.imul(h ^ ch.charCodeAt(0), 3432918353); h = h << 13 | h >>> 19; }
  return () => { h = Math.imul(h ^ h >>> 16, 2246822507); h = Math.imul(h ^ h >>> 13, 3266489909); h ^= h >>> 16; return (h >>> 0)/4294967296; }; };
const lineup = (day, n) => { const rnd = seeded("meow-claw-" + day), used = new Set(), out = [];
  for(let j = 0; j < n; j++){ const r = rnd(), tier = r < .07 ? 2 : r < .32 ? 1 : 0; let L = PRIZES.map((p, i) => i).filter(i => PRIZES[i][1] === tier && !used.has(i));
    if(!L.length) L = PRIZES.map((p, i) => i).filter(i => PRIZES[i][1] === tier); const k = L[(rnd()*L.length)|0]; used.add(k); out.push(k); }
  return out; };
const art3d = i => { const a = PRIZES[i][2](), fx = PRIZES[i][3] || "", mk = maskOf(i);
  return `<span class="cw3d ${fx}"><span class="cwEx e1">${a}</span><span class="cwEx e2">${a}</span><span class="cwFr">${a}</span><span class="cwLt" style="-webkit-mask-image:${mk};mask-image:${mk}"></span></span>`; };


// ---------- 3D 機台（地板座標 x 左→右、z 前→後，0～1；y 是高度） ----------
const R = .082, HX = .27, HZ = .29, RIM = .085, YTOP = .86, CR = .045, G3 = 3.4, SPEED = .34, TIME = 30;
const HOME = { x: HX/2, z: HZ/2 };

App.registerGame({
  id: "claw",
  solo: true,
  name: "喵喵夾娃娃機",
  desc: "像真的娃娃機！前後左右對準，夾娃娃收集貓咪玩偶",
  icon: () => Pix.sprite("orange", "wave"),
  mount(el, ctx){
    const { esc, SFX } = ctx, K = window.MiniKit;
    let s = null, alive = true, raf = 0, srv = null;   // srv：伺服器給的今天機台、免費次數（防作弊）
    const me = () => ctx.me.uid, partner = () => ctx.partner();
    const myCol = () => normCol(((s && s.col) || {})[me()]);
    const triesLeft = () => { if(srv) return srv.free_left; const t = ((s && s.tries) || {})[me()]; return t && t.day === today() ? Math.max(0, FREE - t.n) : FREE; };
    const luck = () => ((s && s.luck) || {})[me()] || 0;
    const owned = c => Object.keys(c).filter(k => c[k] > 0).length;

    document.body.classList.add("cwOn");
    el.innerHTML = `<div class="box cw">
      <div class="cwTop"><div class="cwInfo" id="cwInfo"></div><div class="cwBtns"><button class="btn sub cwColBtn" id="cwCol"></button><button class="btn sub cwColBtn" id="cwBookBtn">${I("book")} 蒐集冊</button></div></div>
      <div class="cwM"><div class="cwMarq"><span class="cwLights"></span><b>喵喵夾娃娃機</b><span class="cwLights"></span></div>
        <div class="cw3" id="cw3"><svg class="cwBg" id="cwBg"></svg><svg class="cwRimB" id="cwRimB"></svg><svg class="cwRimA" id="cwRimA"></svg>
          <div class="cwGantry" id="cwGantry"></div><div class="cwShadow" id="cwShadow"></div><div class="cwRope3" id="cwRope"></div><svg class="cwClawL" id="cwClawB"></svg><svg class="cwClawL" id="cwClawF"></svg>
          <div class="cwFront"><span>${I("down")} 出口</span></div><div class="cwShine"></div><div class="cwTimer hidden" id="cwTimer">30</div></div>
        <div class="cwMsg" id="cwMsg">按「投幣」開始，30 秒內用十字鍵把爪子移到娃娃正上方</div>
        <div class="cwPanel3"><div class="cwPad"><button data-d="up" class="u">▲</button><button data-d="left" class="l">◀</button><button data-d="right" class="r">▶</button><button data-d="down" class="d">▼</button><i></i></div>
          <button class="cwGo" id="cwGo">投幣</button></div></div></div>`;
    const V = el.querySelector("#cw3"), clawB = el.querySelector("#cwClawB"), clawF = el.querySelector("#cwClawF"), rope = el.querySelector("#cwRope"), gantry = el.querySelector("#cwGantry"), shadow = el.querySelector("#cwShadow"),
      timerEl = el.querySelector("#cwTimer"), msgEl = el.querySelector("#cwMsg"), goBtn = el.querySelector("#cwGo");
    const msg = (h, cls) => { msgEl.innerHTML = h; msgEl.className = "cwMsg " + (cls || ""); };

    // ---- 投影 ----
    let W = 300, H = 320, Wf = 270, FY = 280, BY = 140;
    const sz = z => 1 - .36*z;
    const PX = (x, z) => W/2 + (x - .5)*Wf*sz(z);
    const PY = (z, y) => FY + (BY - FY)*z - y*Wf*sz(z)*.56;
    function sizes(){ W = V.clientWidth;
      // 機台高度：盡量大，但十字鍵和按鈕要留在畫面裡
      const room = window.innerHeight - 270; V.style.height = Math.round(Math.max(250, Math.min(W*1.1, room))) + "px";
      H = V.clientHeight; Wf = W*.94; FY = H*.8; BY = H*.36; drawMachine(); }
    function drawMachine(){
      const P = (x, z, y) => `${PX(x, z).toFixed(1)},${PY(z, y || 0).toFixed(1)}`;
      const top = 1.0;
      el.querySelector("#cwBg").innerHTML =
        `<defs><pattern id="cwChk" width="22" height="22" patternUnits="userSpaceOnUse"><rect width="22" height="22" fill="#ffd9e3"/><rect width="11" height="11" fill="#ffc8d6"/><rect x="11" y="11" width="11" height="11" fill="#ffc8d6"/></pattern>
          <pattern id="cwHaz" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="12" height="12" fill="#ffd34d"/><rect width="5" height="12" fill="#5a3b2e"/></pattern></defs>
        <linearGradient id="cwWallL" x1="0" x2="1"><stop offset="0" stop-color="#bcd6f2"/><stop offset="1" stop-color="#e3f0ff"/></linearGradient><linearGradient id="cwWallR" x1="1" x2="0"><stop offset="0" stop-color="#bcd6f2"/><stop offset="1" stop-color="#e3f0ff"/></linearGradient><linearGradient id="cwFloorF" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a3b5e" stop-opacity=".28"/><stop offset=".55" stop-color="#5a3b5e" stop-opacity="0"/></linearGradient><linearGradient id="cwDBack" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfe3fa"/><stop offset="1" stop-color="#b7cfeb"/></linearGradient>
        <polygon points="${P(0,1,0)} ${P(1,1,0)} ${P(1,1,top)} ${P(0,1,top)}" fill="url(#cwBack)"/>
        <polygon points="${P(0,0,0)} ${P(0,1,0)} ${P(0,1,top)} ${P(0,0,top)}" fill="url(#cwWallL)"/>
        <polygon points="${P(1,0,0)} ${P(1,1,0)} ${P(1,1,top)} ${P(1,0,top)}" fill="url(#cwWallR)"/>
        <polygon points="${P(0,0,0)} ${P(1,0,0)} ${P(1,1,0)} ${P(0,1,0)}" fill="url(#cwChk)" stroke="#5a3b2e" stroke-width="2"/><polygon points="${P(0,0,0)} ${P(1,0,0)} ${P(1,1,0)} ${P(0,1,0)}" fill="url(#cwFloorF)"/>
        <polygon points="${P(0,0,0)} ${P(HX,0,0)} ${P(HX,HZ,0)} ${P(0,HZ,0)}" fill="#2e2240"/>
        <polygon points="${P(.02,.02,0)} ${P(HX-.02,.02,0)} ${P(HX-.02,HZ-.02,0)} ${P(.02,HZ-.02,0)}" fill="#1b1428"/>
        <line x1="${PX(0,1)}" y1="${PY(1,top)}" x2="${PX(1,1)}" y2="${PY(1,top)}" stroke="#9aa6bd" stroke-width="5"/>
        <line x1="${PX(0,0)}" y1="${PY(0,top)}" x2="${PX(0,1)}" y2="${PY(1,top)}" stroke="#9aa6bd" stroke-width="5"/><line x1="${PX(1,0)}" y1="${PY(0,top)}" x2="${PX(1,1)}" y2="${PY(1,top)}" stroke="#9aa6bd" stroke-width="5"/>`;
      // 出口旁邊的透明擋板（娃娃要越過它才會掉進去）
      const rim = (a, b) => `<polygon points="${P(a[0],a[1],0)} ${P(b[0],b[1],0)} ${P(b[0],b[1],RIM)} ${P(a[0],a[1],RIM)}" fill="rgba(170,215,255,.45)" stroke="#6f8fb8" stroke-width="2"/>`;
      el.querySelector("#cwRimB").innerHTML = rim([0, HZ], [HX, HZ]);
      el.querySelector("#cwRimA").innerHTML = rim([HX, 0], [HX, HZ]);
      el.querySelectorAll(".cwBg,.cwRimA,.cwRimB,.cwClawL").forEach(x => x.setAttribute("viewBox", `0 0 ${W} ${H}`));
    }

    // ---- 娃娃（物理球） ----
    let prizes = [];
    const inHole = (x, z) => x < HX && z < HZ;
    function mk(kind, x, y, z){ const p = { kind, x, y, z, vx: 0, vy: 0, vz: 0, r: R, rot: (Math.random() - .5)*40, held: false, el: document.createElement("div") };
      p.el.className = "cwP3"; p.el.innerHTML = art3d(kind); p.sh = document.createElement("div"); p.sh.className = "cwPSh"; V.appendChild(p.sh); V.appendChild(p.el); p.sq = 0; p.fz = -1; prizes.push(p); return p; }
    // 整齊排好的位置：6 欄 × 5 排，出口旁邊空出來
    const SPOTS = []; [.13, .37, .61, .85].forEach(z => [.095, .257, .419, .581, .743, .905].forEach(x => { if(!(x < HX + .08 && z < HZ + .06)) SPOTS.push([x, z]); }));
    const spotFree = ([x, z]) => !prizes.some(p => Math.hypot(p.x - x, p.z - z) < R*1.3);
    let curDay = dayKey(), LINE = lineup(curDay, SPOTS.length);
    // 今天的機台由伺服器決定（還沒更新資料庫時，退回用手機算的）
    async function loadStatus(){
      try{ const r = await ctx.rpc("claw_status"); if(r && Array.isArray(r.lineup)){ const L = r.lineup.map(id => IDX[id]); if(L.length >= SPOTS.length && L.every(x => x != null)){ srv = r; curDay = r.day; LINE = L; return; } } }catch(e){}
      srv = null; curDay = dayKey(); LINE = lineup(curDay, SPOTS.length);
    }
    const takenToday = () => { const d = ((s && s.day) || {})[me()]; return d && d.d === curDay ? d.t : []; };
    function arrange(){ prizes.forEach(p => { p.el.remove(); p.sh.remove(); }); prizes = []; const tk = takenToday();
      SPOTS.forEach(([x, z], j) => { if(tk.includes(j)) return; const p = mk(LINE[j], x, R, z); p.rot = 0; p.spot = j; }); }
    const leftToday = () => SPOTS.length - takenToday().length;
    // 爪子：三根爪腳，每根都是會真的碰到娃娃的小球（kinematic）
    const OPEN = .128, CLOSED = .022, CRR = .017;
    const claw = { x: HOME.x, z: HOME.z, tip: YTOP, r: OPEN, rT: OPEN, vx: 0, vz: 0, swing: 0, contact: false };
    const ANG = [Math.PI/2, Math.PI/2 + 2*Math.PI/3, Math.PI/2 + 4*Math.PI/3];
    function prongs(c){ return ANG.map(a => { const ca = Math.cos(a), sa = Math.sin(a), hy = c.tip + .16, ey = c.tip + .085;
      const pt = (rad, y) => [c.x + ca*rad, y, c.z + sa*rad];
      return { front: sa < 0, pts: [pt(.024, hy), pt(c.r*.85 + .04, ey), pt(c.r, c.tip), pt(Math.max(0, c.r - .022), c.tip + .012)] }; }); }
    function colliders(c){ const L = [[c.x, c.tip + .155, c.z, .032, 1]]; prongs(c).forEach(pr => { const [h, e, t, k] = pr.pts; L.push(e, [(e[0] + t[0])/2, (e[1] + t[1])/2, (e[2] + t[2])/2], t, k); }); return L; }
    let captured = [];

    function physics(dt, C0, C1){
      const n = prizes.length;
      for(const p of prizes){
        p.vy -= G3*dt; p.x += p.vx*dt; p.y += p.vy*dt; p.z += p.vz*dt;
        const hole = inHole(p.x, p.z);
        if(!hole && p.y < p.r){ p.y = p.r; if(p.vy < -.6) p.sq = Math.min(.25, -p.vy*.08); if(p.vy < 0) p.vy *= -.18; p.vx *= Math.max(0, 1 - 4.5*dt); p.vz *= Math.max(0, 1 - 4.5*dt); p.rot += p.vx*dt*500; }
        // 牆
        if(p.x < p.r){ p.x = p.r; p.vx = Math.abs(p.vx)*.3; } if(p.x > 1 - p.r){ p.x = 1 - p.r; p.vx = -Math.abs(p.vx)*.3; }
        if(p.z < p.r && !hole){ p.z = p.r; p.vz = Math.abs(p.vz)*.3; } if(p.z > 1 - p.r){ p.z = 1 - p.r; p.vz = -Math.abs(p.vz)*.3; }
        if(hole){ if(p.z < p.r*.6) { p.z = p.r*.6; p.vz = Math.abs(p.vz)*.2; } if(p.x < p.r*.6){ p.x = p.r*.6; p.vx = Math.abs(p.vx)*.2; } }
        // 出口擋板（兩片薄牆，上緣是圓的，可以滾過去）
        for(const [ax, az, bx, bz] of [[0, HZ, HX, HZ], [HX, 0, HX, HZ]]){
          const qx = Math.max(Math.min(ax, bx), Math.min(Math.max(ax, bx), p.x)), qz = Math.max(Math.min(az, bz), Math.min(Math.max(az, bz), p.z)), qy = Math.max(0, Math.min(RIM, p.y));
          const dx = p.x - qx, dy = p.y - qy, dz = p.z - qz, d = Math.hypot(dx, dy, dz);
          if(d < p.r && d > 1e-6){ const k = (p.r - d)/d; p.x += dx*k; p.y += dy*k; p.z += dz*k; const vn = (p.vx*dx + p.vy*dy + p.vz*dz)/d; if(vn < 0){ p.vx -= 1.3*vn*dx/d; p.vy -= 1.3*vn*dy/d; p.vz -= 1.3*vn*dz/d; } }
        }
        p.vx *= 1 - .4*dt; p.vz *= 1 - .4*dt;
      }
      // 娃娃互相推擠
      for(let i = 0; i < n; i++) for(let j = i + 1; j < n; j++){
        const a = prizes[i], b = prizes[j], dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, d = Math.hypot(dx, dy, dz), m = a.r + b.r;
        if(d >= m || d < 1e-6) continue;
        const nx = dx/d, ny = dy/d, nz = dz/d, ov = m - d, wa = a.held ? 0 : b.held ? 1 : .5, wb = 1 - wa;
        a.x -= nx*ov*wa; a.y -= ny*ov*wa; a.z -= nz*ov*wa; b.x += nx*ov*wb; b.y += ny*ov*wb; b.z += nz*ov*wb;
        const vn = (b.vx - a.vx)*nx + (b.vy - a.vy)*ny + (b.vz - a.vz)*nz;
        if(vn < 0){ const jv = -1.2*vn; if(!a.held){ a.vx -= jv*nx*wa*2; a.vy -= jv*ny*wa*2; a.vz -= jv*nz*wa*2; } if(!b.held){ b.vx += jv*nx*wb*2; b.vy += jv*ny*wb*2; b.vz += jv*nz*wb*2; } }
        // 疊在上面的娃娃會慢慢往旁邊滑（像真的娃娃堆）
        if(Math.abs(ny) > .6 && !a.held && !b.held){ const top = ny > 0 ? b : a; top.vx += (ny > 0 ? nx : -nx)*.35*dt*10; top.vz += (ny > 0 ? nz : -nz)*.35*dt*10; }
      }
      // 爪腳：真的碰撞。娃娃被推開、被撐住、被帶著走，都是碰撞算出來的
      if(C1){ const A = colliders(C0), B = colliders(C1);
        // 每隻娃娃把所有爪腳的推力加起來一次算（三根同時夾，才不會被擠飛）
        for(const p of prizes){ let fx = 0, fy = 0, fz = 0, n = 0, vx = 0, vy = 0, vz = 0;
          for(let ci = 0; ci < B.length; ci++){ const c = B[ci], dx = p.x - c[0], dy = p.y - c[1], dz = p.z - c[2], d = Math.hypot(dx, dy, dz), m = p.r + (c[3] || CRR);
            if(d >= m || d < 1e-6) continue; const nx = dx/d, ny = dy/d, nz = dz/d, ov = m - d; n++;
            fx += nx*ov; fy += ny*ov; fz += nz*ov;
            const cv = [(c[0] - A[ci][0])/dt, (c[1] - A[ci][1])/dt, (c[2] - A[ci][2])/dt];
            const rvx = p.vx - cv[0], rvy = p.vy - cv[1], rvz = p.vz - cv[2], vn = rvx*nx + rvy*ny + rvz*nz;
            if(vn < 0){ vx -= vn*nx; vy -= vn*ny; vz -= vn*nz; }
            const tx = rvx - vn*nx, ty = rvy - vn*ny, tz = rvz - vn*nz; vx -= tx*.3; vy -= ty*.3; vz -= tz*.3;
            if(c[4] && ny < -.3) claw.contact = true;
            if(!c[4] && state === "close") claw.grip = true; }
          if(n){ p.x += fx; p.y += fy; p.z += fz; p.vx += vx/n*Math.min(n, 1.5); p.vy += vy/n*Math.min(n, 1.5); p.vz += vz/n*Math.min(n, 1.5); } } }
      // 幸運值滿了：爪子會把娃娃穩穩抱住
      if(lucky() && (state === "rise" || state === "top" || state === "back")) for(const p of prizes){ const h = Math.hypot(p.x - claw.x, p.z - claw.z);
        if(h < .13 && p.y > claw.tip - .06 && p.y < claw.tip + .2){ p.vx += (claw.x - p.x)*40*dt + (claw.vx - p.vx)*8*dt; p.vz += (claw.z - p.z)*40*dt + (claw.vz - p.vz)*8*dt; p.vy += (claw.tip + .075 - p.y)*40*dt; } }
      // 掉進出口
      for(const p of prizes.slice()) if(p.y < -.32){ captured.push({ kind: p.kind, spot: p.spot }); p.el.remove(); p.sh.remove(); prizes = prizes.filter(x => x !== p); SFX.coin && SFX.coin(); }
    }
    function draw(){
      for(const p of prizes){ const k = sz(p.z), size = 2*p.r*Wf*k*1.25, X = PX(p.x, p.z), Y = PY(p.z, p.y);
        p.sq *= .82; const sx = 1 + p.sq*.6, sy = 1 - p.sq;
        p.el.style.width = size + "px"; p.el.style.transform = `translate(${X - size/2}px, ${Y - size*.62}px) rotate(${(p.rot % 360).toFixed(1)}deg) scale(${sx.toFixed(3)},${sy.toFixed(3)})`;
        // 地上的影子：離地越高越小越淡
        const h = Math.max(0, p.y - p.r), sw = size*.9*Math.max(.35, 1 - h*1.6), inH = inHole(p.x, p.z);
        p.sh.style.width = sw + "px"; p.sh.style.height = (sw*.32) + "px"; p.sh.style.transform = `translate(${X - sw/2}px, ${PY(p.z, 0) - sw*.16}px)`; p.sh.style.opacity = inH ? 0 : Math.max(0, .55 - h*1.2).toFixed(2);
        // 越後面越暗一點（有景深）
        const fz = Math.round(p.z*20); if(fz !== p.fz){ p.fz = fz; p.el.style.filter = `brightness(${(1 - p.z*.16).toFixed(2)}) saturate(${(1 - p.z*.12).toFixed(2)})`; }
        p.el.style.zIndex = Math.round(2000 - p.z*1000 + p.y*60);
        p.el.style.opacity = p.y < -.12 ? Math.max(0, 1 + (p.y + .12)*6) : 1; }
      const k = sz(claw.z), cx = PX(claw.x, claw.z), topY = PY(claw.z, 1.0), hubY = PY(claw.z, claw.tip + .16), base = Math.round(2000 - claw.z*1000 + claw.tip*60);
      gantry.style.left = PX(0, claw.z) + "px"; gantry.style.width = (PX(1, claw.z) - PX(0, claw.z)) + "px"; gantry.style.top = (topY - 3) + "px"; gantry.style.zIndex = base + 150;
      rope.style.left = (cx - 1.5) + "px"; rope.style.top = topY + "px"; rope.style.height = Math.max(0, hubY - topY) + "px"; rope.style.zIndex = base + 150;
      // 三根爪腳：後面那根畫在娃娃後面，前面兩根畫在娃娃前面
      const sw = claw.swing*.0025, P2 = q => `${(PX(q[0] + sw*(q[1] - claw.tip - .16)*-1, q[2])).toFixed(1)},${PY(q[2], q[1]).toFixed(1)}`;
      let back = "", front = ""; const lw = Math.max(3, 6*k);
      prongs(claw).forEach(pr => { const pts = pr.pts.map(P2).join(" ");
        const g = `<polyline points="${pts}" fill="none" stroke="#4a5878" stroke-width="${lw}" stroke-linejoin="round" stroke-linecap="round"/><polyline points="${pts}" fill="none" stroke="#c9d3e3" stroke-width="${lw*.4}" stroke-linejoin="round" stroke-linecap="round"/>`;
        if(pr.front) front += g; else back += g; });
      const hubW = 16*k, hub = `<rect x="${cx - hubW/2}" y="${hubY - hubW*.55}" width="${hubW}" height="${hubW*.75}" rx="${hubW*.2}" fill="#9aa6bd" stroke="#4a5878" stroke-width="2"/><rect x="${cx - hubW*.3}" y="${hubY - hubW*.45}" width="${hubW*.25}" height="${hubW*.2}" fill="#fff" opacity=".7"/>`;
      clawB.innerHTML = back; clawF.innerHTML = front + hub; clawB.style.zIndex = base - 90; clawF.style.zIndex = base + 120;
      let surf = 0, under = null; for(const p of prizes){ const d = Math.hypot(p.x - claw.x, p.z - claw.z); if(d < p.r*.92){ const top = p.y + Math.sqrt(p.r*p.r - d*d); if(top > surf && top < claw.tip + .02){ surf = top; under = p; } } }
      const gap = Math.max(0, claw.tip - surf), shk = sz(claw.z)*(1 - Math.min(.45, gap*.45)), sw2 = 46*shk;
      shadow.style.width = sw2 + "px"; shadow.style.height = (sw2*.34) + "px"; const shY = under ? (PY(under.z, under.y) - 2*under.r*Wf*sz(under.z)*1.45*.62 + 2*under.r*Wf*sz(under.z)*1.45*.24) : PY(claw.z, 0);   // 落在娃娃看得到的頭頂上
      shadow.style.transform = `translate(${cx - sw2/2}px, ${shY - sw2*.17}px)`;
      shadow.style.zIndex = under ? (+under.el.style.zIndex + 2) : 6; shadow.style.display = !under && inHole(claw.x, claw.z) ? "none" : "";
      shadow.style.opacity = (.5 + .45*(1 - Math.min(1, gap/.8))).toFixed(2);
    }

    // ---- 流程 ----
    let state = "idle", tLeft = TIME, dir = { x: 0, z: 0 }, lastPlay = -1e9;
    function info(){
      const tl = triesLeft(), l = luck(), c = myCol();
      const adm = ctx.isAdmin && ctx.isAdmin();
      el.querySelector("#cwInfo").innerHTML = `<div>${adm ? `${I("wrench")} <b>站長測試</b>：無限次數` : `今天免費 <b>${tl}</b> / ${FREE} 次`}</div><div class="cwDay">今天剩 <b>${leftToday()}</b> 隻・0 點換新</div><div class="cwLuck">幸運值 <i>${Array.from({ length: PITY }, (_, i) => `<span class="${i < l ? "on" : ""}"></span>`).join("")}</i></div>`;
      el.querySelector("#cwCol").innerHTML = `${I("trophy")} 蒐集櫃 ${owned(c)}/${PRIZES.length}`;
      if(state === "idle"){ const free = adm || tl > 0; goBtn.innerHTML = free ? "投幣" : `1${I("coin")} 投幣`; goBtn.classList.toggle("paid", !free); goBtn.classList.remove("grab"); }
    }
    function soldOut(){
      const adm = ctx.isAdmin && ctx.isAdmin();
      msg(`今天的娃娃都被你夾完了！<br>明天 0 點會換一批新的${adm ? `<br><button class="btn sub" id="cwRestock" style="margin-top:4px">站長補貨（測試用）</button>` : ""}`, "good");
      const b = msgEl.querySelector("#cwRestock"); if(b) b.addEventListener("click", async () => {
        await ctx.update("claw", st => { st = st || {}; if(st.day) delete st.day[me()]; return st; }); await new Promise(r => setTimeout(r, 250));
        arrange(); msg("補貨完成！"); info(); });
    }
    async function pay(){
      if(!prizes.length){ soldOut(); return false; }
      if(srv){ let r = null; try{ r = await ctx.rpc("claw_pay"); }catch(e){}
        if(!r){ ctx.toast("連不上伺服器，等一下再試試看"); return false; }
        if(!r.ok){ ctx.toast("今天的免費次數用完了，貓幣也不夠～<br>明天再來，或玩其他遊戲賺貓幣吧", 4000); return false; }
        srv.free_left = r.free_left; return true; }
      if(ctx.isAdmin && ctx.isAdmin()) return true;   // 站長／管理員測試：不扣次數也不扣貓幣
      if(triesLeft() > 0){ let ok = false; await ctx.update("claw", st => { st = st || {}; st.tries = st.tries || {}; const t = st.tries[me()];
          const cur = t && t.day === today() ? t : { day: today(), n: 0 }; if(cur.n >= FREE) return undefined; cur.n++; st.tries[me()] = cur; ok = true; return st; }); return ok; }
      let ok = false;
      await ctx.update("pet", st => { if(!st || !(st.coins >= 1)) return undefined; st = JSON.parse(JSON.stringify(st)); st.coins -= 1; ok = true; return st; });
      if(!ok) ctx.toast("今天的免費次數用完了，貓幣也不夠～<br>明天再來，或玩其他遊戲賺貓幣吧", 4000);
      return ok;
    }
    goBtn.addEventListener("click", async () => {
      if(state === "idle"){ state = "paying"; if(!(await pay())){ state = "idle"; return; }
        SFX.coin ? SFX.coin() : SFX.select(); state = "aim"; tLeft = TIME; timerEl.classList.remove("hidden"); goBtn.textContent = "夾！"; goBtn.classList.add("grab"); goBtn.classList.remove("paid");
        msg("用十字鍵移動爪子，看地上的影子對準，按「夾！」"); info(); }
      else if(state === "aim") startDrop();
    });
    let seq = null, holdSet = new Set();   // 自動流程的計時、被爪子撐起來的娃娃
    function startDrop(){ if(state !== "aim") return; state = "drop"; dir = { x: 0, z: 0 }; timerEl.classList.add("hidden"); goBtn.textContent = "…"; goBtn.classList.remove("grab"); SFX.tap(); msg("爪子下去囉…"); seq = { t: 0 }; claw.contact = false; }
    const lucky = () => luck() >= PITY;
    // 現在被爪子撐在空中的娃娃
    const lifted = () => prizes.filter(p => Math.hypot(p.x - claw.x, p.z - claw.z) < .12 && p.y > p.r + .05 && p.y > claw.tip - .08 && p.y < claw.tip + .22);
    function watchHold(){
      const now = new Set(lifted());
      if(!holdSet.size && now.size && (state === "rise" || state === "top")){ msg("夾起來了！撐住…撐住…", "good2"); SFX.select(); }
      if(holdSet.size && [...holdSet].some(p => !now.has(p))){ const where = state === "rise" ? "才剛拉起來就<b>掉了</b>…" : state === "top" ? "爪子在最上面<b>鬆了一下</b>，娃娃掉下去了" : "啊！半路<b>滑掉了</b>…差一點點";
        if(!now.size){ msg(where, "bad"); SFX.miss(); } }
      holdSet = now;
    }
    function step(dt){
      if(state === "aim"){
        tLeft -= dt; timerEl.textContent = Math.max(0, Math.ceil(tLeft)); timerEl.classList.toggle("low", tLeft < 6);
        claw.vx = dir.x*SPEED; claw.vz = dir.z*SPEED;
        claw.x = Math.max(.06, Math.min(.94, claw.x + claw.vx*dt)); claw.z = Math.max(.06, Math.min(.94, claw.z + claw.vz*dt));
        if(tLeft <= 0){ msg("時間到！自動下爪～"); startDrop(); }
      } else { claw.vx = claw.vz = 0; }
      // 爪腳慢慢張開／合起來
      claw.r += Math.max(-.26*dt, Math.min(.3*dt, claw.rT - claw.r));
      if(state === "drop"){
        if(claw.tip > .018 && !claw.contact) claw.tip = Math.max(.018, claw.tip - .5*dt);
        else { seq.t += dt; if(seq.t > .2){ state = "close"; seq.t = 0; seq.stall = false; claw.grip = false; claw.rT = lucky() ? CLOSED*.8 : CLOSED; SFX.key(1.2); } }
      } else if(state === "close"){ seq.t += dt; if(claw.grip && !seq.stall){ seq.stall = true; claw.rT = Math.max(CLOSED, claw.r - .01); }   // 夾到東西了：馬達停住（再多夾緊一點）
        if(seq.t > .6){ state = "rise"; seq.t = 0; holdSet = new Set(); } }
      else if(state === "rise"){ claw.tip = Math.min(YTOP, claw.tip + .36*dt); seq.t += dt; watchHold(); if(claw.tip >= YTOP){ state = "top"; seq.t = 0; seq.loose = false; } }
      else if(state === "top"){ seq.t += dt; claw.swing = Math.sin(seq.t*28)*3*(1 - seq.t/.6);
        // 真的娃娃機：到最上面爪子會鬆一點（越稀有的娃娃越鬆）
        if(seq.t > .15 && !lucky() && !seq.loose){ seq.loose = true; const rar = Math.max(0, ...lifted().map(p => PRIZES[p.kind][1])); claw.rT = claw.r + (Math.random() < .3 ? 0 : .003 + Math.random()*.009) + rar*.004; }
        watchHold(); if(seq.t > .6){ state = "back"; seq.t = 0; } }
      else if(state === "back"){ const dx = HOME.x - claw.x, dz = HOME.z - claw.z, d = Math.hypot(dx, dz);
        if(d < .004){ claw.x = HOME.x; claw.z = HOME.z; state = "release"; seq.t = 0; }
        else { const v = Math.min(d, .26*dt); claw.vx = dx/d*.26; claw.vz = dz/d*.26; claw.x += dx/d*v; claw.z += dz/d*v; }
        watchHold(); }
      else if(state === "release"){ if(seq.t === 0){ claw.rT = OPEN; SFX.key(.9); } seq.t += dt; if(seq.t > 1.8) finish(); }
      if(state !== "top") claw.swing += (Math.sin(performance.now()/240)*(holdSet.size ? 3 : 1) - claw.swing)*Math.min(1, dt*3);
    }
    async function finish(){
      state = "done";
      const won = captured.splice(0);
      if(won.length){ for(const cap of won) await win(cap); }
      else { msg(msgEl.classList.contains("bad") ? msgEl.innerHTML : "沒有夾到～再對準一點！", "bad");
        await ctx.update("claw", st => { st = st || {}; st.luck = st.luck || {}; st.luck[me()] = Math.min(PITY, (st.luck[me()] || 0) + 1); return st; }); }
      state = "idle"; claw.rT = OPEN; lastPlay = performance.now(); info();
      if(!(ctx.isAdmin && ctx.isAdmin()) && triesLeft() <= 0 && !won.length && !msgEl.classList.contains("bad")) msg("今天的免費次數用完了，可以用 1 個貓幣再玩一次");
      if(!prizes.length) soldOut();
    }
    async function win(cap){
      const kind = cap.kind, P = PRIZES[kind], id = P[4], wasNew = !(myCol()[id] > 0);
      let saved = null;
      try{ saved = await ctx.update("claw", st => { st = st || {}; st.col = st.col || {}; const c = st.col[me()] = normCol(st.col[me()]); c[id] = (c[id] || 0) + 1; st.luck = st.luck || {}; st.luck[me()] = 0;
        if(cap.spot != null){ st.day = st.day || {}; let dd = st.day[me()]; if(!dd || dd.d !== curDay) dd = st.day[me()] = { d: curDay, t: [] }; if(!dd.t.includes(cap.spot)) dd.t.push(cap.spot); }
        st.first = st.first || {}; const f = st.first[me()] = st.first[me()] || {}; if(!f[id]) f[id] = Date.now();
        st.last = { by: me(), kind: id, at: Date.now() }; return st; }); }catch(e){ console.warn(e); }
      if(!saved){ msg("這次夾到的沒有算進去（伺服器檢查沒通過）", "bad"); return; }
      SFX.level(); ctx.burst(); if(P[1] >= 1) SFX.combo();
      msg(`${I("star")} 夾到了 <b>${esc(P[0])}</b>！`, "good");
      if(P[1] === 2 && partner()) ctx.notifyPartner(`${ctx.me.name} 在夾娃娃機夾到超稀有的「${P[0]}」！`);
      await new Promise(res => { const o = document.createElement("div"); o.className = "careModal cwReveal";
        o.innerHTML = `<div class="cmBox"><div class="cwRay r${P[1]}"></div><div class="cwBig">${art(kind)}</div>${wasNew ? `<div class="cwNew">NEW!</div>` : ""}
          <h3>${esc(P[0])}</h3><div class="cwRar" style="background:${RAR[P[1]][1]}">${stars(P[1])} ${RAR[P[1]][0]}</div>
          <div class="cwDesc">${esc(P[6])}</div><div class="k">${wasNew ? "第一次夾到！已經擺進蒐集櫃、寫進蒐集冊" : (myCol()[id] >= SHINY_NEED && !myShiny()[id] ? `有 ${myCol()[id]} 個了！可以去蒐集冊把牠升級成閃亮版` : `蒐集櫃裡有 ${(myCol()[id] || 1)} 個了`)}</div><button class="btn" style="width:100%">好耶！</button></div>`;
        document.body.appendChild(o); o.querySelector("button").addEventListener("click", () => { o.remove(); res(); }); });
    }

    // ---- 蒐集櫃：博物館展示櫃（玻璃門、聚光燈、展示台） ----
    const myFirst = () => (((s && s.first) || {})[me()]) || {};
    const myShiny = () => (((s && s.shiny) || {})[me()]) || {};
    // 用 2 個重複的，把這隻升級成閃亮版（原本那隻留著）
    async function makeShiny(i){
      const id = PRIZES[i][4]; let ok = false;
      await ctx.update("claw", st => { if(!st || !st.col) return undefined; const c2 = st.col[me()] = normCol(st.col[me()]);
        st.shiny = st.shiny || {}; const sh = st.shiny[me()] = st.shiny[me()] || {};
        if(sh[id] || !(c2[id] >= SHINY_NEED)) return undefined; c2[id] -= SHINY_COST; sh[id] = Date.now(); ok = true; return st; });
      if(!ok){ ctx.toast("升級失敗了，再試一次看看"); return false; }
      await new Promise(r => setTimeout(r, 250));
      SFX.combo(); SFX.level(); ctx.burst();
      await new Promise(res => { const o = document.createElement("div"); o.className = "careModal cwReveal cwShinyUp";
        o.innerHTML = `<div class="cmBox"><div class="cwRay r2"></div><div class="cwBig">${shinyArt(i)}</div><div class="cwNew">閃亮版！</div>
          <h3>${esc(PRIZES[i][0])}</h3><div class="k">用掉 ${SHINY_COST} 個重複的，這隻變成閃亮版了<br>蒐集櫃和蒐集冊裡都會閃閃發光</div><button class="btn" style="width:100%">太美了！</button></div>`;
        document.body.appendChild(o); o.querySelector("button").addEventListener("click", () => { o.remove(); res(); }); });
      return true;
    }
    function openCol(){
      SFX.level(); const c = myCol(), n = owned(c), N = PRIZES.length;
      document.querySelectorAll(".cwCabM").forEach(x => x.remove());
      const o = document.createElement("div"); o.className = "careModal cwCabM";
      const sh = myShiny(), ns = Object.keys(sh).filter(k => c[k] > 0).length;
      const ped = i => { const P = PRIZES[i], k = c[P[4]] || 0, z = k && sh[P[4]];
        return `<button class="cwPed r${P[1]} ${k ? "on" : "no"} ${z ? "shiny" : ""}" data-i="${i}"><span class="cwBeam"></span><span class="cwOnPed">${z ? shinyArt(i) : art(i)}</span><span class="cwBase"></span><span class="cwPlate">${k ? esc(P[0]) : "？？？"}</span>${k > 1 ? `<i>×${k}</i>` : ""}</button>`; };
      const tier = ([cat]) => { const L = PRIZES.map((P, i) => i).filter(i => PRIZES[i][5] === cat), got = L.filter(i => c[PRIZES[i][4]] > 0).length;
        return `<div class="cwTier t-${cat}"><div class="cwTierH"><span>${cat === "sp" ? `${I("spark")} 至寶展示台 ${I("spark")}` : catLabel(CATS.find(x => x[0] === cat))}</span><em>${got} / ${L.length}</em></div><div class="cwRow">${L.map(ped).join("")}</div></div>`; };
      const order = [CATS[4], CATS[0], CATS[1], CATS[2], CATS[3]];
      o.innerHTML = `<div class="cwCase">
        <div class="cwCrest"><span>${I("spark")}</span><b>獎品蒐集櫃</b><span>${I("spark")}</span></div>
        <div class="cwCaseSub">珍藏 <b>${n}</b> / ${N} 件${n === N ? ` ${I("crown")} 全部收集完成！` : ""}</div>
        <div class="cwShinyBar">${I("spark")} 閃亮版 <div><span style="width:${(ns/N*100).toFixed(1)}%"></span></div><b>${ns} / ${N}</b></div>
        <div class="cwCaseIn"><div class="cwGlassHi"></div>${order.map(tier).join("")}<div class="cwDoor l"></div><div class="cwDoor r"></div></div>
        <div class="cwCaseFoot"><button class="btn" id="cwToBook">${I("book")} 蒐集冊</button><button class="btn sub" id="cwX">關上櫃子</button></div></div>`;
      document.body.appendChild(o);
      o.querySelector("#cwX").addEventListener("click", () => o.remove());
      o.querySelector("#cwToBook").addEventListener("click", () => openBook(0));
      o.querySelectorAll(".cwPed").forEach(b => b.addEventListener("click", () => openBook(+b.dataset.i)));
    }
    // ---- 蒐集冊：一個獎品一頁，可以左右翻 ----
    function openBook(start){
      SFX.tap(); document.querySelectorAll(".cwBookM").forEach(x => x.remove());
      const o = document.createElement("div"); o.className = "careModal cwBookM"; let i = start || 0;
      o.innerHTML = `<div class="cwBook"><div class="cwTabs">${CATS.map(c => `<button data-c="${c[0]}" aria-label="${c[1]}">${I(c[2])}</button>`).join("")}</div>
        <div class="cwPageWrap"><div class="cwPage" id="cwPg"></div></div>
        <div class="cwBookNav"><button class="btn sub" id="cwPrev">◀</button><span id="cwPno"></span><button class="btn sub" id="cwNext">▶</button></div>
        <button class="btn sub" style="width:100%" id="cwBX">闔上蒐集冊</button></div>`;
      document.body.appendChild(o);
      const pg = o.querySelector("#cwPg"), N = PRIZES.length;
      const render = d => { const P = PRIZES[i], id = P[4], k = myCol()[id] || 0, z = k && myShiny()[id], f = myFirst()[id], p = partner(), cat = CATS.find(x => x[0] === P[5]);
        o.querySelectorAll(".cwTabs button").forEach(b => b.classList.toggle("on", b.dataset.c === P[5]));
        o.querySelector("#cwPno").textContent = `${i + 1} / ${N}`;
        pg.className = `cwPage r${P[1]} ${k ? "" : "no"} ${z ? "shiny" : ""} ${d ? (d > 0 ? "flipN" : "flipP") : ""}`;
        pg.innerHTML = `<div class="cwPgHead"><span class="cwNo">No.${String(i + 1).padStart(2, "0")}</span><span>${catLabel(cat)}</span></div>
          <div class="cwFrame"><span class="cwTape a"></span><span class="cwTape b"></span><div class="cwFrameIn">${z ? shinyArt(i) : art(i)}</div></div>
          <div class="cwPgName">${k ? (z ? `${I("spark")} ${esc(P[0])} ${I("spark")}` : esc(P[0])) : "？？？"}</div>
          <div class="cwStars">${stars(P[1])}<small>${RAR[P[1]][0]}</small></div>
          <div class="cwLined">${k ? esc(P[6]) : `這一頁還是空白的……<br>夾到之後，這裡就會寫上牠的故事 ${I("lock")}`}</div>
          <div class="cwPgFoot">${k ? `擁有 ×${k}　·　${f ? `第一次夾到：${new Date(f).toLocaleDateString("zh-TW")}` : "很久以前就夾到了"}${z ? `<br>升級閃亮版：${new Date(z).toLocaleDateString("zh-TW")}` : ""}` : "尚未收集"}</div>
          <div class="cwStamp">${z ? "閃亮" : k ? "已收集" : "未收集"}</div>
          ${k && !z ? (k >= SHINY_NEED ? `<button class="btn cwShinyB" id="cwShine">${I("spark")} 用 ${SHINY_COST} 個重複的升級成閃亮版</button>` : `<div class="cwShinyHint">再收集 ${SHINY_NEED - k} 個，就能升級成閃亮版</div>`) : ""}
          ${k > 1 && p ? `<button class="btn mint cwGiftB" id="cwGift">${I("gift")} 送 1 個給 ${esc(p.name)}</button>` : ""}`;
        const sb = pg.querySelector("#cwShine"); if(sb) sb.addEventListener("click", async () => {
          if(!sb.dataset.ok){ sb.dataset.ok = 1; sb.innerHTML = `${I("spark")} 確定嗎？會用掉 ${SHINY_COST} 個，再按一次`; return; }
          sb.disabled = true; if(await makeShiny(i)){ render(0); if(document.querySelector(".cwCabM")){ document.querySelectorAll(".cwCabM").forEach(x => x.remove()); openCol(); document.body.appendChild(o); } } else sb.disabled = false; });
        const g = pg.querySelector("#cwGift"); if(g) g.addEventListener("click", async () => {
          if(!g.dataset.ok){ g.dataset.ok = 1; g.textContent = `確定要送給 ${p.name} 嗎？再按一次`; return; }
          g.disabled = true; let ok = false;
          await ctx.update("claw", st => { if(!st || !st.col) return undefined; const c2 = st.col[me()] = normCol(st.col[me()]); if(!(c2[id] > 1)) return undefined; c2[id]--;
            const pc2 = st.col[p.user_id] = normCol(st.col[p.user_id]); pc2[id] = (pc2[id] || 0) + 1;
            ok = true; return st; });
          if(ok){ SFX.select(); ctx.burst(); ctx.toast(`送出了！${esc(p.name)} 收到 1 個「${P[0]}」`); ctx.notifyPartner(`${ctx.me.name} 送你 1 個「${P[0]}」，快去夾娃娃機的蒐集冊看看！`);
            await new Promise(r => setTimeout(r, 300)); render(0);
            if(document.querySelector(".cwCabM")){ document.querySelectorAll(".cwCabM").forEach(x => x.remove()); openCol(); document.body.appendChild(o); } }
          else { g.disabled = false; ctx.toast("送不出去，再試一次看看"); } });
      };
      const go = d => { i = (i + d + N) % N; SFX.key(d > 0 ? 1.1 : .9); render(d); };
      o.querySelector("#cwPrev").addEventListener("click", () => go(-1));
      o.querySelector("#cwNext").addEventListener("click", () => go(1));
      o.querySelector("#cwBX").addEventListener("click", () => o.remove());
      o.querySelectorAll(".cwTabs button").forEach(b => b.addEventListener("click", () => { const j = PRIZES.findIndex(P => P[5] === b.dataset.c); const d = j > i ? 1 : -1; i = j; SFX.key(1); render(d); }));
      let sx = null; pg.parentNode.addEventListener("touchstart", e => { sx = e.touches[0].clientX; }, { passive: true });
      pg.parentNode.addEventListener("touchend", e => { if(sx == null) return; const dx = e.changedTouches[0].clientX - sx; sx = null; if(Math.abs(dx) > 45) go(dx < 0 ? 1 : -1); });
      render(0);
    }

    // ---- 十字鍵：按住移動（只看手指放開，安卓長按不會中斷） ----
    const DIRS = { up: [0, 1], down: [0, -1], left: [-1, 0], right: [1, 0] };
    el.querySelectorAll(".cwPad [data-d]").forEach(btn => {
      const [dx, dz] = DIRS[btn.dataset.d];
      const up = () => { if(dir.x === dx && dir.z === dz) dir = { x: 0, z: 0 }; btn.classList.remove("on"); ["pointerup","touchend","mouseup"].forEach(t => window.removeEventListener(t, up)); };
      const down = e => { if(e.cancelable) e.preventDefault(); if(state !== "aim") { if(state === "idle") msg("先按「投幣」才能移動爪子喔"); return; } dir = { x: dx, z: dz }; btn.classList.add("on"); SFX.key(.8);
        ["pointerup","touchend","mouseup"].forEach(t => window.addEventListener(t, up)); };
      btn.addEventListener("pointerdown", down); btn.addEventListener("touchstart", down, { passive: false }); btn.addEventListener("contextmenu", e => e.preventDefault());
    });
    el.querySelector("#cwCol").addEventListener("click", openCol); el.querySelector("#cwBookBtn").addEventListener("click", () => openBook(0));

    let last = performance.now();
    const loop = now => {
      if(!alive) return; const dt = Math.max(0, Math.min(.04, (now - last)/1000)); last = now;
      const c0 = { x: claw.x, z: claw.z, tip: claw.tip, r: claw.r }; step(dt);
      const S = 4, lerp = (a, b, t) => a + (b - a)*t, at = t => ({ x: lerp(c0.x, claw.x, t), z: lerp(c0.z, claw.z, t), tip: lerp(c0.tip, claw.tip, t), r: lerp(c0.r, claw.r, t) });
      // 爪子只有在「夾」的時候才是實心的；回到出口打開 0.5 秒後就穿過去，卡在爪子上的娃娃會直接掉下去
      const solid = ["drop", "close", "rise", "top", "back"].includes(state) || (state === "release" && seq.t < .5);
      for(let i = 0; i < S; i++) solid ? physics(dt/S, at(i/S), at((i + 1)/S)) : physics(dt/S); draw();
      // 玩完後幾秒內滾進出口的也算；沒在玩的時候自己滾進去的不算（放回機台裡）
      if(state === "idle" && captured.length){ if(performance.now() - lastPlay < 4000) finish(); else { captured.splice(0).forEach(cap => { const sp = SPOTS[cap.spot] || [.6, .6]; const p = mk(cap.kind, sp[0], .7, sp[1]); p.spot = cap.spot; }); } }
      if(state === "idle" && now - dayChk > 5000){ dayChk = now; if(dayKey() !== curDay && !dayBusy){ dayBusy = true; loadStatus().then(() => { dayBusy = false; if(state === "idle"){ arrange(); msg("新的一天！機台換了一批新娃娃"); info(); } }); }
        if(false){ msg("新的一天！機台換了一批新娃娃"); info(); } }
      raf = requestAnimationFrame(loop);
    };
    let dayChk = 0, dayBusy = false;
    const loaded = Promise.all([ctx.getState("claw").catch(() => null).then(cur => { s = cur ? cur.state : s; }), loadStatus()]);
    requestAnimationFrame(async () => { try{ el.querySelector(".cw").scrollIntoView({ block: "start" }); }catch(e){} sizes(); await loaded; if(!alive) return;
      arrange(); for(let i = 0; i < 90; i++) physics(1/60); captured = []; draw(); info(); if(!prizes.length) soldOut(); last = performance.now(); raf = requestAnimationFrame(loop); });
    const onR = () => { if(alive) sizes(); }; window.addEventListener("resize", onR);
    this._u = ctx.onState("claw", st => { s = st; if(alive) info(); });
    this._stop = () => { alive = false; window.removeEventListener("resize", onR); document.body.classList.remove("cwOn"); cancelAnimationFrame(raf); document.querySelectorAll(".cwReveal,.cwColM,.cwCabM,.cwBookM").forEach(x => x.remove()); };
    // 測試用
    if(window.__mock) window.__cw = { claw, prizes: () => prizes, state: () => state, HOME, lifted: () => lifted() };
  },
  unmount(){ if(this._u) this._u(); if(this._stop) this._stop(); },
});
if(window.GameArt) window.GameArt.claw = () => `<span class="gaL" style="left:30%;top:0;width:40%">${CLAW_SHUT}</span><span class="gaL" style="left:6%;bottom:0;width:40%">${Pix.sprite("orange","happy")}</span><span class="gaL" style="right:6%;bottom:0;width:38%">${Pix.sprite("calico","love")}</span>`;
})();

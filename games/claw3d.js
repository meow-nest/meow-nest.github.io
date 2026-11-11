// 遊戲：3D 夾娃娃機（新款，原本的喵喵夾娃娃機保留）
// 真的 3D 機台和立體布偶（WebGL）。玩法跟原本一樣：投幣、30 秒內用十字鍵對準、下爪。
// 有自己的蒐集櫃和蒐集冊（跟原本那台分開算），蒐集冊裡的娃娃會轉圈圈給你看。
(function(){
const O = "#5a3b2e";
const PX = (rows, pal) => { pal = Object.assign({ O }, pal); const w = Math.max(...rows.map(r => r.length)), h = rows.length; let r = "";
  rows.forEach((row, y) => [...row].forEach((c, x) => { if(pal[c]) r += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${pal[c]}"/>`; }));
  return `<svg viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg">${r}</svg>`; };
const CROWN = PX(["O...O...O","OYO.OYO.O","OYYOYYOYO","OYYYRYYYO","OOOOOOOOO"], { Y: "#f6c45f", R: "#e5484d" });
const ICO = {
  cat: () => PX([".O.....O.","OYO...OYO","OYYOOOYYO","OYYYYYYYO","OYEYYYEYO","OYYYNYYYO",".OYYYYYO.","..OOOOO.."], { Y: "#f2b06a", E: "#2b1d18", N: "#f0708d" }),
  paw: () => Pix.icon("paw"),
  cake: () => PX(["....OO....","...ORRO...","..OORROO..",".OWWWWWWO.",".OWWWWWWO.",".ORRRRRRO.",".OYYYYYYO.",".OWWWWWWO.",".OYYYYYYO.",".OOOOOOOO."], { R: "#ef5a6f", W: "#ffffff", Y: "#f6d58c" }),
  gift: () => PX(["..OO..OO..",".OKKOOKKO.","..OOKKOO..","OOOOKKOOOO","OBBBKKBBBO","OOOOKKOOOO",".OBBKKBBO.",".OBBKKBBO.",".OBBKKBBO.",".OOOOOOOO."], { B: "#7ab8f0", K: "#f0708d" }),
  bird: () => PX(["....OOOO...","...OBBBBO..","..OBBBBBBO.","AAOBEBBBBO.",".OBBBBBBBBO",".OBWWWBBBBO",".OBWWWWBBO.","..OBWWBBO..","...OOOOO...","....A.A...."], { B: "#7ab8f0", W: "#e3f2ff", A: "#f29b38", E: "#2b1d18" }),
  crown: () => CROWN, lock: () => PX(["..OOOO..",".OO..OO.",".O....O.","OOOOOOOO","OYYYYYYO","OYYOOYYO","OYYOOYYO","OYYYYYYO","OOOOOOOO"], { Y: "#f6c45f" }),
  spark: () => PX(["...O...","...Y...","..OYO..","OYYWYYO","..OYO..","...Y...","...O..."], { O: "#c8922f", Y: "#f6c45f", W: "#fff6c8" }),
  star: () => Pix.icon("star"), star0: () => Pix.icon("star", { Y: "#eadfce", O: "#b9a99a" }),
  trophy: () => PX(["..OOOOOOO..","OOOYYHYYOOO","OYOYYHYYOYO","OYOYYYYYOYO",".OOYYYYYOO.","...OYYYO...","....OYO....","....OYO....","...OOOOO...","..OBBBBBO..","..OOOOOOO.."], { Y: "#f6c45f", H: "#fff2b0", B: "#8b5a2b" }),
  book: () => PX(["OOOOOOOOOO","OKKKKKKKKO","OKOYYYYOKO","OKKKKKKKKO","OKKKKKKKKO","OKKKKKKKKO","OKKKKKKKKO","OOOOOOOOOO","OWWWWWWWWO","OOOOOOOOOO"], { K: "#d9455f", Y: "#f6c45f", W: "#ffffff" }),
  coin: () => PX(["..OOOO..",".OYYYYO.","OYHYYYYO","OYYOOYYO","OYYOOYYO","OYYYYYYO",".OYYYYO.","..OOOO.."], { Y: "#f6c45f", H: "#fff2b0" }),
  wrench: () => PX(["....O.O","....OGO","...OGGO","..OGGO.",".OGGO..","OGGO...","OOO...."], { G: "#a7aec2" }),
  turn: () => PX(["..OOOO...",".OYYYYO..","OYOOOOYO.","OYO..OYO.","OYO.OOYOO","OYO..OYYO","..O...OO.","........."], { Y: "#f6c45f" }),
};
const I = (k, cls) => `<span class="cwI ${cls || ""}">${ICO[k]()}</span>`;
const stars = r => I("star").repeat(r + 1) + I("star0").repeat(2 - r);
const CATS = [["cat", "貓咪娃娃", "cat"], ["ani", "動物朋友", "paw"], ["bird", "小鳥", "bird"], ["food", "點心", "cake"], ["sp", "超稀有", "spark"]];
const catLabel = c => `${I(c[2])} ${c[1]}`;

// 獎品：[名字, 稀有度 0 普通 1 稀有 2 超稀有, 模型（也是 id）, 分類, 介紹]
const PRIZES = [
  ["橘子貓", 0, "c_orange", "cat", "身上有一條一條的橘色條紋，最喜歡曬太陽，抱起來暖呼呼的。"],
  ["奶油貓", 0, "c_cream", "cat", "顏色像剛烤好的奶油餅乾，笑起來眼睛會瞇成一條線。"],
  ["小白", 0, "c_white", "cat", "全身雪白、睫毛長長的。有人說牠是貓咪界的小公主。"],
  ["燕尾服黑貓", 0, "c_black", "cat", "黑色外套配白色襯衫和白手套，隨時準備好去參加舞會。"],
  ["灰灰", 0, "c_gray", "cat", "整天都在打瞌睡，被夾起來的時候還沒醒。"],
  ["三花貓", 1, "c_calico", "cat", "白、橘、黑三種顏色的花紋，每一隻的花紋都不一樣喔。"],
  ["虎斑貓", 0, "c_tabby", "cat", "灰褐色的虎斑紋，看起來很兇，其實很怕寂寞。"],
  ["暹羅貓", 1, "c_siamese", "cat", "臉、耳朵、腳掌和尾巴是深咖啡色，還有一雙藍眼睛。"],
  ["乳牛貓", 0, "c_cow", "cat", "黑白花色像一頭小乳牛，但是牠只喝牛奶，不會擠牛奶。"],
  ["玳瑁貓", 1, "c_tortie", "cat", "黑色和橘色混在一起的花紋，綠眼睛亮晶晶的，個性很有主見。"],
  ["草莓牛奶貓", 0, "c_pink", "cat", "粉紅色的毛像草莓牛奶，會偷偷對你眨眼睛。"],
  ["派對汽水貓", 1, "c_blue", "cat", "戴著派對帽的藍色貓咪，每天都覺得是自己的生日。"],
  ["發芽薄荷貓", 0, "c_mint", "cat", "頭上長出一株小嫩芽，澆水的話好像會長大一點點。"],
  ["星星眼薰衣草貓", 1, "c_lav", "cat", "看到喜歡的東西眼睛就會變成星星，例如你。"],
  ["蝴蝶結小白", 0, "c_bow", "cat", "小白戴上粉紅色蝴蝶結，準備去約會。"],
  ["小花奶油貓", 0, "c_flower", "cat", "耳朵旁邊別了一朵小花，聞起來香香的。"],
  ["圍巾灰灰", 1, "c_scarf", "cat", "冬天到了，灰灰圍上紅色圍巾，終於捨得起床了。"],
  ["主廚橘貓", 1, "c_chef", "cat", "戴著高高的廚師帽，拿手菜是魚乾炒飯。"],
  ["畫家黑貓", 1, "c_beret", "cat", "戴著紅色貝雷帽的藝術家，用肉球蓋章當簽名。"],
  ["書呆虎斑", 1, "c_glasses", "cat", "戴上圓圓的眼鏡，假裝自己看得懂報紙。"],
  ["愛哭粉貓", 0, "c_cry", "cat", "很容易感動到哭，看到你夾到牠也哭了。"],
  ["白襪睏睏貓", 0, "c_sleepy", "cat", "四隻腳都穿著白襪子，打哈欠的樣子超可愛。"],
  ["小熊", 0, "a_bear", "ani", "咖啡色的小熊，鼻子圓圓的，最喜歡蜂蜜。"],
  ["熊貓", 1, "a_panda", "ani", "黑眼圈不是熬夜造成的，是天生的，牠發誓。"],
  ["小白兔", 0, "a_rabbit", "ani", "長長的耳朵裡是粉紅色的，跳起來很快。"],
  ["垂耳兔", 0, "a_bunnyB", "ani", "耳朵軟軟地垂下來，摸起來像棉花糖。"],
  ["青蛙", 0, "a_frog", "ani", "大眼睛長在頭頂上，笑容永遠很燦爛。"],
  ["小豬", 0, "a_pig", "ani", "粉紅色的小豬，鼻子會呼嚕呼嚕。"],
  ["柴犬", 1, "a_shiba", "ani", "捲捲的尾巴、吐著小舌頭，看到你就超開心。"],
  ["小狐狸", 1, "a_fox", "ani", "大尾巴尖端是白色的，有一點點小聰明。"],
  ["倉鼠", 0, "a_hamster", "ani", "臉頰裡塞滿了瓜子，所以臉才這麼圓。"],
  ["無尾熊", 1, "a_koala", "ani", "毛茸茸的大耳朵，一天要睡二十個小時。"],
  ["綿羊", 0, "a_sheep", "ani", "全身捲捲的羊毛，數牠的話會想睡覺。"],
  ["海豹寶寶", 0, "a_seal", "ani", "白白胖胖的海豹寶寶，在地上一扭一扭地前進。"],
  ["六角恐龍", 1, "a_axolotl", "ani", "臉頰旁邊有粉紅色的鰓，永遠都在微笑。"],
  ["小鯨魚", 1, "a_whale", "ani", "頭頂會噴出小水花，游泳的時候會唱歌。"],
  ["小恐龍", 0, "a_dino", "ani", "背上有黃色的小刺，吼起來一點都不可怕。"],
  ["小老鼠", 0, "a_mouse", "ani", "圓圓的大耳朵，聞到起司就會跑過來。"],
  ["小雞", 0, "a_chick", "bird", "圓滾滾的黃色小雞，頭上有一撮呆毛。"],
  ["企鵝", 0, "a_penguin", "bird", "走路搖搖擺擺，在娃娃機裡也想滑來滑去。"],
  ["小鴨", 0, "a_duck", "bird", "嘴巴扁扁的鵝黃色小鴨，洗澡的時候最愛陪你。"],
  ["貓頭鷹", 1, "a_owl", "bird", "大大的眼睛晚上會發亮，懂很多事情。"],
  ["白文鳥", 0, "b_javaW", "bird", "全身雪白、粉紅色的大嘴巴，喜歡跳到你的手指上。"],
  ["灰文鳥", 0, "b_javaG", "bird", "黑色帽子、白色臉頰，嘴巴像一顆櫻桃。"],
  ["肉桂文鳥", 1, "b_javaC", "bird", "奶茶色的羽毛，聞起來好像有一點點肉桂香。"],
  ["玄鳳鸚鵡", 0, "b_cockatiel", "bird", "頭上有一撮黃色呆毛，臉頰兩坨橘色的腮紅，會吹口哨。"],
  ["灰玄鳳", 1, "b_cockatielG", "bird", "灰色身體配黃色的臉，心情好的時候呆毛會豎起來。"],
  ["綠虎皮鸚鵡", 0, "b_budgieG", "bird", "黃色的頭、綠色的身體，翅膀上有一圈一圈的花紋。"],
  ["藍虎皮鸚鵡", 0, "b_budgieB", "bird", "像天空一樣的藍色，學說話學得很快。"],
  ["桃面愛情鳥", 1, "b_lovebird", "bird", "桃子色的臉，最喜歡跟另一半黏在一起。"],
  ["太平洋鸚鵡", 0, "b_parrotlet", "bird", "小小一隻但是膽子很大，翅膀有一點藍藍的。"],
  ["和尚鸚鵡", 0, "b_quaker", "bird", "胸前像圍了灰色的圍兜，很愛聊天。"],
  ["麻雀", 0, "b_sparrow", "bird", "臉頰上有兩個小黑點，在路邊跳來跳去找麵包屑。"],
  ["綠繡眼", 0, "b_whiteeye", "bird", "眼睛周圍有一圈白邊，像戴了一副白框眼鏡。"],
  ["台灣藍鵲", 1, "b_magpie", "bird", "台灣特有的長尾巴藍色鳥，紅嘴巴紅腳丫，很有氣勢。"],
  ["紅嘴黑鵯", 0, "b_bulbul", "bird", "黑色的龐克頭配紅嘴巴紅腳，叫聲像小貓。"],
  ["白頭翁", 0, "b_whitehead", "bird", "後腦勺有一塊白色的毛，所以叫白頭翁，其實還很年輕。"],
  ["雪之妖精", 1, "b_enaga", "bird", "銀喉長尾山雀，白白圓圓像一顆麻糬，尾巴細細長長的。"],
  ["知更鳥", 0, "b_robin", "bird", "橘紅色的胸口，春天一到就開始唱歌。"],
  ["金絲雀", 0, "b_canary", "bird", "黃澄澄的小鳥，唱歌的聲音最好聽。"],
  ["鴿子", 0, "b_pigeon", "bird", "脖子上的羽毛會閃出綠色和紫色的光，咕咕咕。"],
  ["紅鶴", 1, "b_flamingo", "bird", "粉紅色是因為吃了很多蝦子，喜歡用一隻腳站著。"],
  ["翠鳥", 1, "b_kingfisher", "bird", "亮藍色的背、橘色的肚子，抓魚超級快。"],
  ["巨嘴鳥", 1, "b_toucan", "bird", "大大的橘色嘴巴看起來很重，其實輕得像海綿。"],
  ["母雞", 0, "b_hen", "bird", "頭上有紅色雞冠，每天早上都會咕咕叫你起床。"],
  ["甜甜圈", 0, "f_donut", "food", "粉紅糖霜上撒了彩色糖珠，咬一口就幸福。"],
  ["布丁", 0, "f_pudding", "food", "焦糖色的帽子，搖一搖會 Duang Duang 地晃。"],
  ["飯糰", 0, "f_onigiri", "food", "白白的飯糰包著海苔，裡面是什麼口味是秘密。"],
  ["草莓", 0, "f_strawberry", "food", "紅通通的草莓，頭上戴著綠色的葉子帽。"],
  ["水蜜桃", 1, "f_peach", "food", "粉嫩嫩的水蜜桃，臉紅紅的好像在害羞。"],
  ["小籠包", 0, "f_dumpling", "food", "十八個摺的小籠包，剛出爐所以很睏。"],
  ["馬卡龍", 1, "f_macaron", "food", "粉紅色的馬卡龍夾著奶油餡，甜度剛剛好。"],
  ["珍珠奶茶", 1, "f_boba", "food", "台灣之光！杯底的珍珠是牠最得意的地方。"],
  ["冰淇淋", 0, "f_icecream", "food", "草莓口味的冰淇淋，頂端有一顆櫻桃。"],
  ["杯子蛋糕", 0, "f_cupcake", "food", "鬆鬆軟軟的杯子蛋糕，上面擠了滿滿的鮮奶油。"],
  ["吐司", 0, "f_toast", "food", "烤得剛剛好的厚片吐司，聞起來很香。"],
  ["招財貓", 2, "s_lucky", "sp", "舉起手招來好運和貓幣，脖子上的鈴鐺叮叮響。"],
  ["黃金貓", 2, "s_gold", "sp", "全身金光閃閃，傳說摸一下就會發大財。"],
  ["皇冠貓", 2, "s_crown", "sp", "戴著金色皇冠的貓咪女王，請對牠行禮。"],
  ["天使貓", 2, "s_angel", "sp", "頭上有光環、背上有小翅膀，會在你睡覺時守護你。"],
  ["彩虹貓", 2, "s_rainbow", "sp", "雨過天晴的時候才會出現，身上有七彩的顏色。"],
  ["銀河貓", 2, "s_galaxy", "sp", "身上裝著整片星空，眼睛像兩顆藍色的星星。"],
  ["獨角貓", 2, "s_unicorn", "sp", "頭上有一根金色的角，尾巴是夢幻的紫色。"],
  ["孔雀", 2, "s_peacock", "sp", "打開尾巴是一整面綠色的扇子，上面有好多藍色的眼睛。"],
  ["鳳凰", 2, "s_phoenix", "sp", "頭上有火焰的羽冠，傳說看到牠的人會一整年好運。"],
];
const IDX = {}; PRIZES.forEach((P, i) => IDX[P[2]] = i);
const normCol = c => { const r = {}; if(c) for(const k in c) if(IDX[k] != null && c[k] > 0) r[k] = c[k]; return r; };
const RAR = [["普通", "#9aa3bd"], ["稀有", "#5e9de6"], ["超稀有", "#e8a400"]];
const FREE = 10, PITY = 8, SHINY_COST = 2, SHINY_NEED = 3;
const dayKey = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
const seeded = str => { let h = 1779033703 ^ str.length; for(const ch of str){ h = Math.imul(h ^ ch.charCodeAt(0), 3432918353); h = h << 13 | h >>> 19; }
  return () => { h = Math.imul(h ^ h >>> 16, 2246822507); h = Math.imul(h ^ h >>> 13, 3266489909); h ^= h >>> 16; return (h >>> 0)/4294967296; }; };
const lineup = (day, n) => { const rnd = seeded("meow-claw3d-" + day), used = new Set(), out = [];
  for(let j = 0; j < n; j++){ const r = rnd(), tier = r < .07 ? 2 : r < .32 ? 1 : 0; let L = PRIZES.map((p, i) => i).filter(i => PRIZES[i][1] === tier && !used.has(i));
    if(!L.length) L = PRIZES.map((p, i) => i).filter(i => PRIZES[i][1] === tier); const k = L[(rnd()*L.length)|0]; used.add(k); out.push(k); }
  return out; };

// ---------- 縮圖（蒐集櫃、蒐集冊用）：用另一個小畫布畫好存成圖片 ----------
let TE = null, TC = null; const THUMB = {};
function thumbEngine(){ if(TE || TE === false) return TE; TC = document.createElement("canvas"); TC.width = TC.height = 200; try{ TE = Toy3D.Engine(TC, { keep: true }) || false; }catch(e){ TE = false; } return TE; }
function renderThumb(key, ang){ const E = thumbEngine(); if(!E) return false; const { chain, RY } = Toy3D; E.begin(200, 200, [0, 0, 0, 0]); E.camera([0, 1.05, 5.3], [0, .08, 0], .62, 1); Toy3D.drawModel(E, key, chain(RY(ang))); return true; }
function thumb(key){ if(THUMB[key] != null) return THUMB[key]; return THUMB[key] = renderThumb(key, -.32) ? TC.toDataURL("image/png") : ""; }
const art = i => `<span class="cwArt c3"><img src="${thumb(PRIZES[i][2])}" alt=""></span>`;
const SPK = PX(["...O...","..OWO..",".OWYWO.","OWYYYWO",".OWYWO.","..OWO..","...O..."], { O: "#d99a1e", W: "#ffffff", Y: "#fff3a8" });
const shinyArt = i => { const u = thumb(PRIZES[i][2]), m = `-webkit-mask-image:url('${u}');mask-image:url('${u}')`;
  return `<span class="cwShinyA">${art(i)}<span class="cwHolo" style="${m}"></span><span class="cwSheen" style="${m}"></span>${[1, 2, 3, 4].map(n => `<span class="cwSpk k${n}">${SPK}</span>`).join("")}</span>`; };
// 會轉圈圈的娃娃（夾到的時候、蒐集冊裡）
function spinner(i, shiny){ const id = "sp" + Math.random().toString(36).slice(2, 8);
  setTimeout(() => { const cv = document.getElementById(id); if(!cv || !thumbEngine()) return; const g = cv.getContext("2d"); const t0 = performance.now();
    const f = now => { if(!cv.isConnected) return; renderThumb(PRIZES[i][2], -.32 + Math.sin((now - t0)/900)*.9 + (now - t0)/2400); g.clearRect(0, 0, 200, 200); g.drawImage(TC, 0, 0); requestAnimationFrame(f); }; requestAnimationFrame(f); }, 30);
  const c = `<span class="cwArt c3"><canvas id="${id}" width="200" height="200"></canvas></span>`;
  // 閃亮版在轉的時候：金色外框＋閃光（彩虹光只放在不會動的縮圖上，才不會跟轉動的娃娃對不起來）
  return shiny ? `<span class="cwShinyA c3spin">${c}${[1, 2, 3, 4].map(n => `<span class="cwSpk k${n}">${SPK}</span>`).join("")}</span>` : c; }

// ---------- 機台（地板座標 x 左→右、z 前→後，0～1；y 是高度） ----------
const R = .082, HX = .27, HZ = .29, RIM = .085, YTOP = .6, G3 = 3.4, SPEED = .34, TIME = 30;
const HOME = { x: HX/2, z: HZ/2 };
const SC = 6;   // 3D 世界裡機台地板是 6×6
const Wp = (x, y, z) => [(x - .5)*SC, y*SC, (.5 - z)*SC];

App.registerGame({
  id: "claw3d",
  solo: true,
  name: "3D 夾娃娃機",
  desc: "立體的娃娃機！80 多種立體布偶，有自己的蒐集櫃",
  icon: () => `<img src="${thumb("c_calico")}" alt="" style="width:100%">`,
  mount(el, ctx){
    const { esc, SFX } = ctx;
    let s = null, alive = true, raf = 0, srv = null;   // srv：伺服器給的今天機台、免費次數（防作弊）
    const me = () => ctx.me.uid, partner = () => ctx.partner();
    const isAdm = () => !!(ctx.isAdmin && ctx.isAdmin());
    const myCol = () => normCol(((s && s.col) || {})[me()]);
    const triesLeft = () => { if(srv) return srv.free_left; const t = ((s && s.tries) || {})[me()]; return t && t.day === dayKey() ? Math.max(0, FREE - t.n) : FREE; };
    const luck = () => ((s && s.luck) || {})[me()] || 0;
    const owned = c => Object.keys(c).filter(k => c[k] > 0).length;

    document.body.classList.add("cwOn");
    el.innerHTML = `<div class="box cw c3d">
      <div class="cwTop"><div class="cwInfo" id="cwInfo"></div><div class="cwBtns"><button class="btn sub cwColBtn" id="cwCol"></button><button class="btn sub cwColBtn" id="cwBookBtn">${I("book")} 蒐集冊</button></div></div>
      <div class="cwM"><div class="cwMarq"><span class="cwLights"></span><b>3D 夾娃娃機</b><span class="cwLights"></span></div>
        <div class="cw3" id="cw3"><canvas class="c3cv" id="c3cv"></canvas><div class="cwShine"></div><div class="cwTimer hidden" id="cwTimer">30</div></div>
        <div class="cwMsg" id="cwMsg">按「投幣」開始，30 秒內用十字鍵把爪子移到娃娃正上方</div>
        <div class="cwPanel3"><div class="cwPad"><button data-d="up" class="u">▲</button><button data-d="left" class="l">◀</button><button data-d="right" class="r">▶</button><button data-d="down" class="d">▼</button><i></i></div>
          <button class="cwGo" id="cwGo">投幣</button></div></div></div>`;
    const V = el.querySelector("#cw3"), cv = el.querySelector("#c3cv"), timerEl = el.querySelector("#cwTimer"), msgEl = el.querySelector("#cwMsg"), goBtn = el.querySelector("#cwGo");
    const msg = (h, cls) => { msgEl.innerHTML = h; msgEl.className = "cwMsg " + (cls || ""); };
    const { chain, T, S, RX, RY, RZ, seg } = Toy3D;
    let E = null; try{ E = Toy3D.Engine(cv, { ctx: { alpha: false } }); }catch(e){ E = null; }
    if(!E){ msg("你的手機好像不支援 3D 畫面…<br>可以先玩原本的「喵喵夾娃娃機」喔", "bad"); }

    // ---- 畫面大小 ----
    let W = 300, H = 320, DPR = 1;
    function sizes(){ W = V.clientWidth; const room = window.innerHeight - 270; V.style.height = Math.round(Math.max(250, Math.min(W*1.1, room))) + "px"; H = V.clientHeight;
      DPR = Math.min(2, window.devicePixelRatio || 1); cv.width = Math.round(W*DPR); cv.height = Math.round(H*DPR); }

    // ---- 機台的貼圖和網格 ----
    let floorMesh = null, holeMesh = null;
    const C2 = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
    function buildScene(){
      if(!E) return;
      // 地板（L 形，出口那一塊挖空），貼圖用整片地板的座標
      const x0 = -3, x1 = 3, zf = 3, zb = -3, hx = Wp(HX, 0, 0)[0], hz = Wp(0, 0, HZ)[2];
      const P = [], N = [], UV = [], Ix = [];
      const q = (ax, az, bx, bz) => { const b = P.length/3; for(const [x, z] of [[ax, az], [bx, az], [bx, bz], [ax, bz]]){ P.push(x, 0, z); N.push(0, 1, 0); UV.push((x + 3)/6, (z + 3)/6); } Ix.push(b, b + 1, b + 2, b, b + 2, b + 3); };
      q(hx, zf, x1, zb); q(x0, hz, hx, zb);
      floorMesh = E.mesh(P, N, UV, Ix);
      // 出口的洞：四面牆＋底
      const H2 = -2.2, P2 = [], N2 = [], U2 = [], I2 = [];
      const wall = (a, b, n) => { const k = P2.length/3; for(const [x, y, z] of [[a[0], 0, a[1]], [b[0], 0, b[1]], [b[0], H2, b[1]], [a[0], H2, a[1]]]){ P2.push(x, y, z); N2.push(...n); U2.push(0, y/H2); } I2.push(k, k + 1, k + 2, k, k + 2, k + 3); };
      wall([x0, hz], [hx, hz], [0, 0, 1]); wall([hx, hz], [hx, zf], [-1, 0, 0]); wall([x0, zf], [x0, hz], [1, 0, 0]); wall([hx, zf], [x0, zf], [0, 0, -1]);
      holeMesh = E.mesh(P2, N2, U2, I2);
    }
    const tex = (k, f) => E.texture(k, f);
    const floorTex = () => tex("c3floor", () => { const c = C2(512, 512), x = c.getContext("2d"); for(let i = 0; i < 8; i++) for(let j = 0; j < 8; j++){ x.fillStyle = (i + j) % 2 ? "#ffc8d6" : "#ffe3ea"; x.fillRect(i*64, j*64, 64, 64); }
      x.fillStyle = "rgba(255,255,255,.5)"; for(let i = 0; i < 8; i++) for(let j = 0; j < 8; j++) if((i + j) % 2 === 0){ x.beginPath(); x.arc(i*64 + 32, j*64 + 32, 5, 0, 7); x.fill(); }
      return c; });
    const backTex = () => tex("c3back", () => { const c = C2(512, 512), x = c.getContext("2d"); const g = x.createLinearGradient(0, 0, 0, 512); g.addColorStop(0, "#d9ecff"); g.addColorStop(1, "#bcd8f5"); x.fillStyle = g; x.fillRect(0, 0, 512, 512);
      for(let i = 0; i < 26; i++){ const X = (i*137) % 512, Y = 30 + (i*89) % 440; x.save(); x.translate(X, Y); x.rotate(i);
        if(i % 3 === 0){ x.fillStyle = "rgba(255,255,255,.75)"; x.beginPath(); for(let k = 0; k < 10; k++){ const a = -Math.PI/2 + k*Math.PI/5, r = k % 2 ? 6 : 14; x.lineTo(Math.cos(a)*r, Math.sin(a)*r); } x.fill(); }
        else if(i % 3 === 1){ x.fillStyle = "rgba(255,170,200,.6)"; x.beginPath(); x.moveTo(0, 8); x.bezierCurveTo(-16, -2, -8, -14, 0, -5); x.bezierCurveTo(8, -14, 16, -2, 0, 8); x.fill(); }
        else { x.fillStyle = "rgba(255,255,255,.55)"; x.beginPath(); x.arc(0, 0, 8, 0, 7); x.arc(10, 2, 7, 0, 7); x.arc(-10, 2, 7, 0, 7); x.fill(); } x.restore(); }
      return c; });
    const shTex = () => tex("c3sh", () => { const c = C2(128, 128), x = c.getContext("2d"); const g = x.createRadialGradient(64, 64, 4, 64, 64, 62); g.addColorStop(0, "rgba(90,40,70,.55)"); g.addColorStop(.6, "rgba(90,40,70,.3)"); g.addColorStop(1, "rgba(90,40,70,0)"); x.fillStyle = g; x.fillRect(0, 0, 128, 128); return c; });
    const clawShTex = () => tex("c3csh", () => { const c = C2(128, 128), x = c.getContext("2d"); const g = x.createRadialGradient(64, 64, 20, 64, 64, 60); g.addColorStop(0, "rgba(60,25,50,.62)"); g.addColorStop(.7, "rgba(60,25,50,.5)"); g.addColorStop(1, "rgba(60,25,50,0)"); x.fillStyle = g; x.fillRect(0, 0, 128, 128); return c; });
    const exitTex = () => tex("c3exit", () => { const c = C2(256, 96), x = c.getContext("2d"); x.fillStyle = "#2e2240"; x.fillRect(0, 0, 256, 96); x.strokeStyle = "#ffe08a"; x.lineWidth = 6; x.strokeRect(6, 6, 244, 84);
      x.fillStyle = "#ffe08a"; x.font = "bold 46px sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText("出口", 150, 50);
      x.beginPath(); x.moveTo(44, 30); x.lineTo(70, 30); x.lineTo(70, 50); x.lineTo(82, 50); x.lineTo(57, 76); x.lineTo(32, 50); x.lineTo(44, 50); x.closePath(); x.fill(); return c; });
    const ringTex = () => tex("c3ring", () => { const c = C2(128, 128), x = c.getContext("2d"); x.strokeStyle = "#ff4f86"; x.lineWidth = 10; x.beginPath(); x.arc(64, 64, 52, 0, 7); x.stroke();
      x.strokeStyle = "#ffffff"; x.lineWidth = 4; x.beginPath(); x.arc(64, 64, 52, 0, 7); x.stroke(); x.fillStyle = "#ff4f86"; x.beginPath(); x.arc(64, 64, 9, 0, 7); x.fill();
      for(let i = 0; i < 4; i++){ const a = i*Math.PI/2; x.fillRect(64 + Math.cos(a)*30 - 4, 64 + Math.sin(a)*30 - 4, 8, 8); } return c; });
    const box = (a, b, col, o) => E.draw(E.M.BOX, chain(T((a[0] + b[0])/2, (a[1] + b[1])/2, (a[2] + b[2])/2), S(Math.abs(b[0] - a[0])/2, Math.abs(b[1] - a[1])/2, Math.abs(b[2] - a[2])/2)), col, o);

    // ---- 娃娃（物理球） ----
    let prizes = [];
    const inHole = (x, z) => x < HX && z < HZ;
    function mk(kind, x, y, z){ const p = { kind, x, y, z, vx: 0, vy: 0, vz: 0, r: R, held: false, sq: 0,
        yaw: (Math.random() - .5)*.9, tx: 0, tz: 0, rx: -.28 - Math.random()*.22, rz: (Math.random() - .5)*.3 }; prizes.push(p); return p; }
    // 排好的位置：地上 4 排×6 欄（出口旁邊空出來），上面再疊一層
    const SPOTS = []; [.13, .37, .61, .85].forEach(z => [.095, .257, .419, .581, .743, .905].forEach(x => { if(!(x < HX + .08 && z < HZ + .06)) SPOTS.push([x, z, R]); }));
    [[.581, .25], [.419, .49], [.743, .49], [.257, .73], [.581, .73], [.905, .73]].forEach(([x, z]) => SPOTS.push([x, z, R*2.6]));
    let curDay = dayKey(), seenDay = curDay, LINE = lineup(curDay, SPOTS.length);
    // 今天的機台由伺服器決定（沒有伺服器的版本就用手機算）
    async function loadStatus(){
      if(ctx.rpc) try{ const r = await ctx.rpc("claw3d_status"); if(r && Array.isArray(r.lineup)){ const L = r.lineup.map(id => IDX[id]); if(L.length >= SPOTS.length && L.every(x => x != null)){ srv = r; curDay = r.day; LINE = L; return; } } }catch(e){}
      srv = null; curDay = dayKey(); LINE = lineup(curDay, SPOTS.length);
    }
    const takenToday = () => { const d = ((s && s.day) || {})[me()]; return d && d.d === curDay ? d.t : []; };
    function arrange(){ prizes = []; const tk = takenToday();
      SPOTS.forEach(([x, z, y], j) => { if(tk.includes(j)) return; const p = mk(LINE[j], x, y, z); p.spot = j; }); }
    const leftToday = () => SPOTS.length - takenToday().length;
    // 爪子
    const OPEN = .128, CLOSED = .022, CRR = .017;
    const claw = { x: HOME.x, z: HOME.z, tip: YTOP, r: OPEN, rT: OPEN, vx: 0, vz: 0, swing: 0, contact: false };
    const ANG = [Math.PI/2, Math.PI/2 + 2*Math.PI/3, Math.PI/2 + 4*Math.PI/3];
    function prongs(c){ return ANG.map(a => { const ca = Math.cos(a), sa = Math.sin(a), hy = c.tip + .16, ey = c.tip + .085;
      const pt = (rad, y) => [c.x + ca*rad, y, c.z + sa*rad];
      return { pts: [pt(.024, hy), pt(c.r*.85 + .04, ey), pt(c.r, c.tip), pt(Math.max(0, c.r - .022), c.tip + .012)] }; }); }
    function colliders(c){ const L = [[c.x, c.tip + .155, c.z, .032, 1]]; prongs(c).forEach(pr => { const [h, e, t, k] = pr.pts; L.push(e, [(e[0] + t[0])/2, (e[1] + t[1])/2, (e[2] + t[2])/2], t, k); }); return L; }
    let captured = [];

    function physics(dt, C0, C1){
      const n = prizes.length;
      for(const p of prizes){
        p.vy -= G3*dt; p.x += p.vx*dt; p.y += p.vy*dt; p.z += p.vz*dt;
        const hole = inHole(p.x, p.z);
        if(!hole && p.y < p.r){ p.y = p.r; if(p.vy < -.6) p.sq = Math.min(.25, -p.vy*.08); if(p.vy < 0) p.vy *= -.18; p.vx *= Math.max(0, 1 - 4.5*dt); p.vz *= Math.max(0, 1 - 4.5*dt); }
        if(p.x < p.r){ p.x = p.r; p.vx = Math.abs(p.vx)*.3; } if(p.x > 1 - p.r){ p.x = 1 - p.r; p.vx = -Math.abs(p.vx)*.3; }
        if(p.z < p.r && !hole){ p.z = p.r; p.vz = Math.abs(p.vz)*.3; } if(p.z > 1 - p.r){ p.z = 1 - p.r; p.vz = -Math.abs(p.vz)*.3; }
        if(hole){ if(p.z < p.r*.6) { p.z = p.r*.6; p.vz = Math.abs(p.vz)*.2; } if(p.x < p.r*.6){ p.x = p.r*.6; p.vx = Math.abs(p.vx)*.2; } }
        for(const [ax, az, bx, bz] of [[0, HZ, HX, HZ], [HX, 0, HX, HZ]]){
          const qx = Math.max(Math.min(ax, bx), Math.min(Math.max(ax, bx), p.x)), qz = Math.max(Math.min(az, bz), Math.min(Math.max(az, bz), p.z)), qy = Math.max(0, Math.min(RIM, p.y));
          const dx = p.x - qx, dy = p.y - qy, dz = p.z - qz, d = Math.hypot(dx, dy, dz);
          if(d < p.r && d > 1e-6){ const k = (p.r - d)/d; p.x += dx*k; p.y += dy*k; p.z += dz*k; const vn = (p.vx*dx + p.vy*dy + p.vz*dz)/d; if(vn < 0){ p.vx -= 1.3*vn*dx/d; p.vy -= 1.3*vn*dy/d; p.vz -= 1.3*vn*dz/d; } }
        }
        p.vx *= 1 - .4*dt; p.vz *= 1 - .4*dt;
      }
      for(let i = 0; i < n; i++) for(let j = i + 1; j < n; j++){
        const a = prizes[i], b = prizes[j], dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, d = Math.hypot(dx, dy, dz), m = a.r + b.r;
        if(d >= m || d < 1e-6) continue;
        const nx = dx/d, ny = dy/d, nz = dz/d, ov = m - d, wa = a.held ? 0 : b.held ? 1 : .5, wb = 1 - wa;
        a.x -= nx*ov*wa; a.y -= ny*ov*wa; a.z -= nz*ov*wa; b.x += nx*ov*wb; b.y += ny*ov*wb; b.z += nz*ov*wb;
        const vn = (b.vx - a.vx)*nx + (b.vy - a.vy)*ny + (b.vz - a.vz)*nz;
        if(vn < 0){ const jv = -1.2*vn; if(!a.held){ a.vx -= jv*nx*wa*2; a.vy -= jv*ny*wa*2; a.vz -= jv*nz*wa*2; } if(!b.held){ b.vx += jv*nx*wb*2; b.vy += jv*ny*wb*2; b.vz += jv*nz*wb*2; } }
        // 互相碰著的娃娃會慢慢停下來（娃娃堆才不會一直抖）
        const dmp = Math.max(0, 1 - 6*dt); if(!a.held){ a.vx *= dmp; a.vz *= dmp; } if(!b.held){ b.vx *= dmp; b.vz *= dmp; }
      }
      if(C1){ const A = colliders(C0), B = colliders(C1);
        for(const p of prizes){ let fx = 0, fy = 0, fz = 0, n = 0, vx = 0, vy = 0, vz = 0;
          for(let ci = 0; ci < B.length; ci++){ const c = B[ci], dx = p.x - c[0], dy = p.y - c[1], dz = p.z - c[2], d = Math.hypot(dx, dy, dz), m = p.r + (c[3] || CRR);
            if(d >= m || d < 1e-6) continue; const nx = dx/d, ny = dy/d, nz = dz/d, ov = m - d; n++;
            fx += nx*ov; fy += ny*ov; fz += nz*ov;
            const cvv = [(c[0] - A[ci][0])/dt, (c[1] - A[ci][1])/dt, (c[2] - A[ci][2])/dt];
            const rvx = p.vx - cvv[0], rvy = p.vy - cvv[1], rvz = p.vz - cvv[2], vn = rvx*nx + rvy*ny + rvz*nz;
            if(vn < 0){ vx -= vn*nx; vy -= vn*ny; vz -= vn*nz; }
            const tx = rvx - vn*nx, ty = rvy - vn*ny, tz = rvz - vn*nz; vx -= tx*.3; vy -= ty*.3; vz -= tz*.3;
            if(c[4] && ny < -.3) claw.contact = true;
            if(!c[4] && state === "close") claw.grip = true; }
          if(n){ p.x += fx; p.y += fy; p.z += fz; p.vx += vx/n*Math.min(n, 1.5); p.vy += vy/n*Math.min(n, 1.5); p.vz += vz/n*Math.min(n, 1.5); } } }
      if(lucky() && (state === "rise" || state === "top" || state === "back")) for(const p of prizes){ const h = Math.hypot(p.x - claw.x, p.z - claw.z);
        if(h < .13 && p.y > claw.tip - .06 && p.y < claw.tip + .2){ p.vx += (claw.x - p.x)*40*dt + (claw.vx - p.vx)*8*dt; p.vz += (claw.z - p.z)*40*dt + (claw.vz - p.vz)*8*dt; p.vy += (claw.tip + .075 - p.y)*40*dt; } }
      for(const p of prizes.slice()) if(p.y < -.32){ captured.push({ kind: p.kind, spot: p.spot }); prizes = prizes.filter(x => x !== p); SFX.coin && SFX.coin(); }
    }
    // 娃娃的姿勢：在空中會翻滾，落地後慢慢回到坐好的樣子
    function pose(dt){ for(const p of prizes){       const calm = Math.hypot(p.vx, p.vy, p.vz) < .3 && !p.held;
      if(calm){ const k = Math.min(1, dt*4); p.tx += (p.rx - p.tx)*k; p.tz += (p.rz - p.tz)*k; }
      else { p.tz -= p.vx*dt/p.r*.5; p.tx += p.vz*dt/p.r*-.5; p.tx = Math.max(-1.2, Math.min(1.2, p.tx)); p.tz = Math.max(-1.2, Math.min(1.2, p.tz)); } } }

    // ---- 畫出來 ----
    const CAM = { eye: [0, 8.2, 9.0], at: [0, 1.15, -.6], fov: .8 };
    const METAL = "#c9d3e3", PINK = "#f08aa0", BROWN = "#5a3b2e";
    function draw(){
      if(!E) return;
      E.begin(cv.width, cv.height, [0.81, 0.9, 1, 1]);
      E.camera(CAM.eye, CAM.at, CAM.fov, W/H);
      // 牆和柱子
      E.draw(E.M.BOX, chain(T(0, 3.2, -3.3), S(3.4, 3.4, .15)), null, { tex: backTex(), outline: false });
      box([-3.35, 0, -3.3], [-3.15, 6.6, 3.1], "#d4e7fb", { outline: false }); box([3.15, 0, -3.3], [3.35, 6.6, 3.1], "#d4e7fb", { outline: false });
      for(const x of [-3.3, 3.3]) for(const z of [-3.25, 3.15]) box([x - .13, -1.4, z - .13], [x + .13, 6.7, z + .13], PINK, { ow: .03 });
      box([-3.45, 6.45, -3.4], [3.45, 6.9, 3.3], PINK, { ow: .03 });
      // 前面的機台下半部（出口的牌子貼在這裡）
      box([-3.45, -1.5, 3.0], [3.45, -.02, 3.3], PINK, { ow: .03 });
      E.draw(E.M.QUAD, chain(T(Wp(HX/2, 0, 0)[0], -.72, 3.31), S(.95, .36, 1)), null, { tex: exitTex(), decal: true });
      // 地板和出口的洞
      E.draw(floorMesh, chain(), null, { tex: floorTex(), outline: false });
      E.draw(holeMesh, chain(), "#3a2b52", { outline: false, noCull: true });
      // 洞的邊框
      const hx = Wp(HX, 0, 0)[0], hz = Wp(0, 0, HZ)[2];
      E.draw(E.M.CYL, seg([-3, RIM*SC, hz], [hx, RIM*SC, hz], .06), "#8fb6e0", { ow: .02 });
      E.draw(E.M.CYL, seg([hx, RIM*SC, hz], [hx, RIM*SC, 3], .06), "#8fb6e0", { ow: .02 });
      // 天花板的軌道、橫桿
      const cw = Wp(claw.x, 0, claw.z);
      box([-3.15, 6.05, -3.15], [3.15, 6.2, -2.95], "#9aa6bd", { ow: .02 }); box([-3.15, 6.05, 2.75], [3.15, 6.2, 2.95], "#9aa6bd", { ow: .02 });
      box([-3.1, 5.9, cw[2] - .1], [3.1, 6.05, cw[2] + .1], "#9aa6bd", { ow: .02 });
      box([cw[0] - .3, 5.7, cw[2] - .25], [cw[0] + .3, 5.95, cw[2] + .25], "#7d8aa6", { ow: .03 });
      // 影子（娃娃、爪子）
      E.blend(true);
      for(const p of prizes){ if(inHole(p.x, p.z) && p.y < p.r + .02) continue; const h = Math.max(0, p.y - p.r), k = Math.max(.35, 1 - h*1.6), a = Math.max(0, 1 - h*1.4); if(a <= 0) continue; const w = Wp(p.x, 0, p.z);
        E.draw(E.M.QUAD, chain(T(w[0], .015, w[2]), RX(-Math.PI/2), S(.62*k, .62*k, 1)), null, { tex: shTex(), decal: true, alpha: a }); }
      let surf = 0, under = null; for(const p of prizes){ const d = Math.hypot(p.x - claw.x, p.z - claw.z); if(d < p.r*.92){ const top = p.y + Math.sqrt(p.r*p.r - d*d); if(top > surf && top < claw.tip + .02){ surf = top; under = p; } } }
      const aiming = state === "aim" || state === "idle" || state === "paying", pulse = .5 + .5*Math.sin(performance.now()/180);
      E.blend(false);
      // 娃娃（被瞄準的那隻會發亮）
      const sc = R*SC*1.18;
      for(const p of prizes){ const w = Wp(p.x, p.y, p.z); p.sq *= .82; const sx = 1 + p.sq*.6, sy = 1 - p.sq;
        const g = null;
        Toy3D.drawModel(E, PRIZES[p.kind][2], chain(T(w[0], w[1], w[2]), RY(p.yaw), RX(p.tx), RZ(p.tz), S(sc*sx, sc*sy, sc*sx)), g ? { glow: g } : {}); }
      // 爪子
      const sw = claw.swing*.0025, Wc = q => { const v = Wp(q[0] - sw*(q[1] - claw.tip - .16), q[1], q[2]); return v; };
      const hub = Wc([claw.x, claw.tip + .16, claw.z]);
      E.draw(E.M.CYL, seg([cw[0], 5.7, cw[2]], [hub[0], hub[1] + .3, hub[2]], .04), "#6b7896", { ow: .02 });
      E.draw(E.M.CYL, chain(T(hub[0], hub[1] + .12, hub[2]), S(.3, .32, .3)), "#9aa6bd", { ow: .035 });
      E.draw(E.M.SPH, chain(T(hub[0], hub[1] - .08, hub[2]), S(.24, .16, .24)), METAL, { ow: .03 });
      prongs(claw).forEach(pr => { const pts = pr.pts.map(Wc);
        for(let i = 0; i < 3; i++) E.draw(E.M.CYL, seg(pts[i], pts[i + 1], i === 2 ? .06 : .075), METAL, { ow: .035 });
        for(let i = 1; i < 4; i++) E.draw(E.M.SPH, chain(T(...pts[i]), S(.09, .09, .09)), i === 3 ? "#9aa6bd" : METAL, { ow: .03 }); });
      // 爪子的影子、出口旁邊的透明擋板
      E.blend(true);
      // 爪子的影子（落在娃娃頭上或地板上）
      if(!(surf === 0 && inHole(claw.x, claw.z))){ const gap = Math.max(0, claw.tip - surf); const k = 1 - Math.min(.35, gap*.4); E.draw(E.M.QUAD, chain(T(cw[0], surf*SC + .03, cw[2]), RX(-Math.PI/2), S(.55*k, .55*k, 1)), null, { tex: clawShTex(), decal: true, alpha: .8 + .2*(1 - Math.min(1, gap/.8)) }); }
      const rH = RIM*SC;
      E.draw(E.M.BOX, chain(T((-3 + hx)/2, rH/2, hz), S((hx + 3)/2, rH/2, .03)), "#bfe0ff", { outline: false, alpha: .45 });
      E.draw(E.M.BOX, chain(T(hx, rH/2, (hz + 3)/2), S(.03, rH/2, (3 - hz)/2)), "#bfe0ff", { outline: false, alpha: .45 });
      E.blend(false);
    }

    // ---- 流程 ----
    let state = "idle", tLeft = TIME, dir = { x: 0, z: 0 }, lastPlay = -1e9;
    function info(){
      const tl = triesLeft(), l = luck(), c = myCol(), adm = isAdm();
      el.querySelector("#cwInfo").innerHTML = `<div>${adm ? `${I("wrench")} <b>站長測試</b>：無限次數` : `今天免費 <b>${tl}</b> / ${FREE} 次`}</div><div class="cwDay">今天剩 <b>${leftToday()}</b> 隻・0 點換新</div><div class="cwLuck">幸運值 <i>${Array.from({ length: PITY }, (_, i) => `<span class="${i < l ? "on" : ""}"></span>`).join("")}</i></div>`;
      el.querySelector("#cwCol").innerHTML = `${I("trophy")} 蒐集櫃 ${owned(c)}/${PRIZES.length}`;
      if(state === "idle"){ const free = adm || tl > 0; goBtn.innerHTML = free ? "投幣" : `1${I("coin")} 投幣`; goBtn.classList.toggle("paid", !free); goBtn.classList.remove("grab"); }
    }
    function soldOut(){
      const adm = isAdm();
      msg(`今天的娃娃都被你夾完了！<br>明天 0 點會換一批新的${adm ? `<br><button class="btn sub" id="cwRestock" style="margin-top:4px">站長補貨（測試用）</button>` : ""}`, "good");
      const b = msgEl.querySelector("#cwRestock"); if(b) b.addEventListener("click", async () => {
        await ctx.update("claw3d", st => { st = st || {}; if(st.day) delete st.day[me()]; return st; }); await new Promise(r => setTimeout(r, 250));
        arrange(); msg("補貨完成！"); info(); });
    }
    async function pay(){
      if(!prizes.length){ soldOut(); return false; }
      if(srv){ let r = null; try{ r = await ctx.rpc("claw3d_pay"); }catch(e){}
        if(!r){ ctx.toast("連不上伺服器，等一下再試試看"); return false; }
        if(!r.ok){ ctx.toast("今天的免費次數用完了，貓幣也不夠～<br>明天再來，或玩其他遊戲賺貓幣吧", 4000); return false; }
        srv.free_left = r.free_left; return true; }
      if(isAdm()) return true;
      if(triesLeft() > 0){ let ok = false; await ctx.update("claw3d", st => { st = st || {}; st.tries = st.tries || {}; const t = st.tries[me()];
          const cur = t && t.day === dayKey() ? t : { day: dayKey(), n: 0 }; if(cur.n >= FREE) return undefined; cur.n++; st.tries[me()] = cur; ok = true; return st; }); return ok; }
      let ok = false;
      await ctx.update("pet", st => { if(!st || !(st.coins >= 1)) return undefined; st = JSON.parse(JSON.stringify(st)); st.coins -= 1; ok = true; return st; });
      if(!ok) ctx.toast("今天的免費次數用完了，貓幣也不夠～<br>明天再來，或玩其他遊戲賺貓幣吧", 4000);
      return ok;
    }
    goBtn.addEventListener("click", async () => {
      if(!E) return;
      if(state === "idle"){ state = "paying"; if(!(await pay())){ state = "idle"; return; }
        SFX.coin ? SFX.coin() : SFX.select(); state = "aim"; tLeft = TIME; timerEl.classList.remove("hidden"); goBtn.textContent = "夾！"; goBtn.classList.add("grab"); goBtn.classList.remove("paid");
        msg("用十字鍵移動爪子，看地上的影子對準，按「夾！」"); info(); }
      else if(state === "aim") startDrop();
    });
    let seq = null, holdSet = new Set();
    function startDrop(){ if(state !== "aim") return; state = "drop"; dir = { x: 0, z: 0 }; timerEl.classList.add("hidden"); goBtn.textContent = "…"; goBtn.classList.remove("grab"); SFX.tap(); msg("爪子下去囉…"); seq = { t: 0 }; claw.contact = false; }
    const lucky = () => luck() >= PITY;
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
      claw.r += Math.max(-.26*dt, Math.min(.3*dt, claw.rT - claw.r));
      if(state === "drop"){
        if(claw.tip > .018 && !claw.contact) claw.tip = Math.max(.018, claw.tip - .5*dt);
        else { seq.t += dt; if(seq.t > .2){ state = "close"; seq.t = 0; seq.stall = false; claw.grip = false; claw.rT = lucky() ? CLOSED*.8 : CLOSED; SFX.key(1.2); } }
      } else if(state === "close"){ seq.t += dt; if(claw.grip && !seq.stall){ seq.stall = true; claw.rT = Math.max(CLOSED, claw.r - .01); }
        if(seq.t > .6){ state = "rise"; seq.t = 0; holdSet = new Set(); } }
      else if(state === "rise"){ claw.tip = Math.min(YTOP, claw.tip + .36*dt); seq.t += dt; watchHold(); if(claw.tip >= YTOP){ state = "top"; seq.t = 0; seq.loose = false; } }
      else if(state === "top"){ seq.t += dt; claw.swing = Math.sin(seq.t*28)*3*(1 - seq.t/.6);
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
        await ctx.update("claw3d", st => { st = st || {}; st.luck = st.luck || {}; st.luck[me()] = Math.min(PITY, (st.luck[me()] || 0) + 1); return st; }); }
      state = "idle"; claw.rT = OPEN; lastPlay = performance.now(); info();
      if(!isAdm() && triesLeft() <= 0 && !won.length && !msgEl.classList.contains("bad")) msg("今天的免費次數用完了，可以用 1 個貓幣再玩一次");
      if(!prizes.length) soldOut();
    }
    async function win(cap){
      const kind = cap.kind, P = PRIZES[kind], id = P[2], wasNew = !(myCol()[id] > 0);
      let saved = null;
      try{ saved = await ctx.update("claw3d", st => { st = st || {}; st.col = st.col || {}; const c = st.col[me()] = normCol(st.col[me()]); c[id] = (c[id] || 0) + 1; st.luck = st.luck || {}; st.luck[me()] = 0;
        if(cap.spot != null){ st.day = st.day || {}; let dd = st.day[me()]; if(!dd || dd.d !== curDay) dd = st.day[me()] = { d: curDay, t: [] }; if(!dd.t.includes(cap.spot)) dd.t.push(cap.spot); }
        st.first = st.first || {}; const f = st.first[me()] = st.first[me()] || {}; if(!f[id]) f[id] = Date.now();
        st.last = { by: me(), kind: id, at: Date.now() }; return st; }); }catch(e){ console.warn(e); }
      if(!saved){ msg("這次夾到的沒有算進去（伺服器檢查沒通過）", "bad"); return; }
      SFX.level(); ctx.burst(); if(P[1] >= 1) SFX.combo();
      msg(`${I("star")} 夾到了 <b>${esc(P[0])}</b>！`, "good");
      if(P[1] === 2 && partner()) ctx.notifyPartner(`${ctx.me.name} 在 3D 夾娃娃機夾到超稀有的「${P[0]}」！`);
      await new Promise(res => { const o = document.createElement("div"); o.className = "careModal cwReveal";
        o.innerHTML = `<div class="cmBox"><div class="cwRay r${P[1]}"></div><div class="cwBig c3">${spinner(kind)}</div>${wasNew ? `<div class="cwNew">NEW!</div>` : ""}
          <h3>${esc(P[0])}</h3><div class="cwRar" style="background:${RAR[P[1]][1]}">${stars(P[1])} ${RAR[P[1]][0]}</div>
          <div class="cwDesc">${esc(P[4])}</div><div class="k">${wasNew ? "第一次夾到！已經擺進 3D 蒐集櫃、寫進蒐集冊" : (myCol()[id] >= SHINY_NEED && !myShiny()[id] ? `有 ${myCol()[id]} 個了！可以去蒐集冊把牠升級成閃亮版` : `蒐集櫃裡有 ${(myCol()[id] || 1)} 個了`)}</div><button class="btn" style="width:100%">好耶！</button></div>`;
        document.body.appendChild(o); o.querySelector("button").addEventListener("click", () => { o.remove(); res(); }); });
    }

    // ---- 蒐集櫃、蒐集冊 ----
    const myFirst = () => (((s && s.first) || {})[me()]) || {};
    const myShiny = () => (((s && s.shiny) || {})[me()]) || {};
    async function makeShiny(i){
      const id = PRIZES[i][2]; let ok = false;
      await ctx.update("claw3d", st => { if(!st || !st.col) return undefined; const c2 = st.col[me()] = normCol(st.col[me()]);
        st.shiny = st.shiny || {}; const sh = st.shiny[me()] = st.shiny[me()] || {};
        if(sh[id] || !(c2[id] >= SHINY_NEED)) return undefined; c2[id] -= SHINY_COST; sh[id] = Date.now(); ok = true; return st; });
      if(!ok){ ctx.toast("升級失敗了，再試一次看看"); return false; }
      await new Promise(r => setTimeout(r, 250));
      SFX.combo(); SFX.level(); ctx.burst();
      await new Promise(res => { const o = document.createElement("div"); o.className = "careModal cwReveal cwShinyUp";
        o.innerHTML = `<div class="cmBox"><div class="cwRay r2"></div><div class="cwBig c3">${spinner(i, true)}</div><div class="cwNew">閃亮版！</div>
          <h3>${esc(PRIZES[i][0])}</h3><div class="k">用掉 ${SHINY_COST} 個重複的，這隻變成閃亮版了<br>蒐集櫃和蒐集冊裡都會閃閃發光</div><button class="btn" style="width:100%">太美了！</button></div>`;
        document.body.appendChild(o); o.querySelector("button").addEventListener("click", () => { o.remove(); res(); }); });
      return true;
    }
    function openCol(){
      SFX.level(); const c = myCol(), n = owned(c), N = PRIZES.length;
      document.querySelectorAll(".cwCabM").forEach(x => x.remove());
      const o = document.createElement("div"); o.className = "careModal cwCabM c3";
      const sh = myShiny(), ns = Object.keys(sh).filter(k => c[k] > 0).length;
      const ped = i => { const P = PRIZES[i], k = c[P[2]] || 0, z = k && sh[P[2]];
        return `<button class="cwPed r${P[1]} ${k ? "on" : "no"} ${z ? "shiny" : ""}" data-i="${i}"><span class="cwBeam"></span><span class="cwOnPed">${z ? shinyArt(i) : art(i)}</span><span class="cwBase"></span><span class="cwPlate">${k ? esc(P[0]) : "？？？"}</span>${k > 1 ? `<i>×${k}</i>` : ""}</button>`; };
      const tier = ([cat]) => { const L = PRIZES.map((P, i) => i).filter(i => PRIZES[i][3] === cat), got = L.filter(i => c[PRIZES[i][2]] > 0).length;
        return `<div class="cwTier t-${cat}"><div class="cwTierH"><span>${cat === "sp" ? `${I("spark")} 至寶展示台 ${I("spark")}` : catLabel(CATS.find(x => x[0] === cat))}</span><em>${got} / ${L.length}</em></div><div class="cwRow">${L.map(ped).join("")}</div></div>`; };
      const order = [CATS[4], CATS[0], CATS[1], CATS[2], CATS[3]];
      o.innerHTML = `<div class="cwCase">
        <div class="cwCrest"><span>${I("spark")}</span><b>3D 蒐集櫃</b><span>${I("spark")}</span></div>
        <div class="cwCaseSub">珍藏 <b>${n}</b> / ${N} 件${n === N ? ` ${I("crown")} 全部收集完成！` : ""}</div>
        <div class="cwShinyBar">${I("spark")} 閃亮版 <div><span style="width:${(ns/N*100).toFixed(1)}%"></span></div><b>${ns} / ${N}</b></div>
        <div class="cwCaseIn"><div class="cwGlassHi"></div>${order.map(tier).join("")}<div class="cwDoor l"></div><div class="cwDoor r"></div></div>
        <div class="cwCaseFoot"><button class="btn" id="cwToBook">${I("book")} 蒐集冊</button><button class="btn sub" id="cwX">關上櫃子</button></div></div>`;
      document.body.appendChild(o);
      o.querySelector("#cwX").addEventListener("click", () => o.remove());
      o.querySelector("#cwToBook").addEventListener("click", () => openBook(0));
      o.querySelectorAll(".cwPed").forEach(b => b.addEventListener("click", () => openBook(+b.dataset.i)));
    }
    function openBook(start){
      SFX.tap(); document.querySelectorAll(".cwBookM").forEach(x => x.remove());
      const o = document.createElement("div"); o.className = "careModal cwBookM c3"; let i = start || 0;
      o.innerHTML = `<div class="cwBook"><div class="cwTabs">${CATS.map(c => `<button data-c="${c[0]}" aria-label="${c[1]}">${I(c[2])}</button>`).join("")}</div>
        <div class="cwPageWrap"><div class="cwPage" id="cwPg"></div></div>
        <div class="cwBookNav"><button class="btn sub" id="cwPrev">◀</button><span id="cwPno"></span><button class="btn sub" id="cwNext">▶</button></div>
        <button class="btn sub" style="width:100%" id="cwBX">闔上蒐集冊</button></div>`;
      document.body.appendChild(o);
      const pg = o.querySelector("#cwPg"), N = PRIZES.length;
      const render = d => { const P = PRIZES[i], id = P[2], k = myCol()[id] || 0, z = k && myShiny()[id], f = myFirst()[id], p = partner(), cat = CATS.find(x => x[0] === P[3]);
        o.querySelectorAll(".cwTabs button").forEach(b => b.classList.toggle("on", b.dataset.c === P[3]));
        o.querySelector("#cwPno").textContent = `${i + 1} / ${N}`;
        pg.className = `cwPage r${P[1]} ${k ? "" : "no"} ${z ? "shiny" : ""} ${d ? (d > 0 ? "flipN" : "flipP") : ""}`;
        pg.innerHTML = `<div class="cwPgHead"><span class="cwNo">No.${String(i + 1).padStart(2, "0")}</span><span>${catLabel(cat)}</span></div>
          <div class="cwFrame"><span class="cwTape a"></span><span class="cwTape b"></span><div class="cwFrameIn">${k ? spinner(i, z) : art(i)}</div></div>
          <div class="cwPgName">${k ? (z ? `${I("spark")} ${esc(P[0])} ${I("spark")}` : esc(P[0])) : "？？？"}</div>
          <div class="cwStars">${stars(P[1])}<small>${RAR[P[1]][0]}</small></div>
          <div class="cwLined">${k ? esc(P[4]) : `這一頁還是空白的……<br>夾到之後，這裡就會寫上牠的故事 ${I("lock")}`}</div>
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
          await ctx.update("claw3d", st => { if(!st || !st.col) return undefined; const c2 = st.col[me()] = normCol(st.col[me()]); if(!(c2[id] > 1)) return undefined; c2[id]--;
            const pc2 = st.col[p.user_id] = normCol(st.col[p.user_id]); pc2[id] = (pc2[id] || 0) + 1; ok = true; return st; });
          if(ok){ SFX.select(); ctx.burst(); ctx.toast(`送出了！${esc(p.name)} 收到 1 個「${P[0]}」`); ctx.notifyPartner(`${ctx.me.name} 送你 1 個「${P[0]}」，快去 3D 夾娃娃機的蒐集冊看看！`);
            await new Promise(r => setTimeout(r, 300)); render(0);
            if(document.querySelector(".cwCabM")){ document.querySelectorAll(".cwCabM").forEach(x => x.remove()); openCol(); document.body.appendChild(o); } }
          else { g.disabled = false; ctx.toast("送不出去，再試一次看看"); } });
      };
      const go = d => { i = (i + d + N) % N; SFX.key(d > 0 ? 1.1 : .9); render(d); };
      o.querySelector("#cwPrev").addEventListener("click", () => go(-1));
      o.querySelector("#cwNext").addEventListener("click", () => go(1));
      o.querySelector("#cwBX").addEventListener("click", () => o.remove());
      o.querySelectorAll(".cwTabs button").forEach(b => b.addEventListener("click", () => { const j = PRIZES.findIndex(P => P[3] === b.dataset.c); const d = j > i ? 1 : -1; i = j; SFX.key(1); render(d); }));
      let sx = null; pg.parentNode.addEventListener("touchstart", e => { sx = e.touches[0].clientX; }, { passive: true });
      pg.parentNode.addEventListener("touchend", e => { if(sx == null) return; const dx = e.changedTouches[0].clientX - sx; sx = null; if(Math.abs(dx) > 45) go(dx < 0 ? 1 : -1); });
      render(0);
    }

    // ---- 十字鍵 ----
    const DIRS = { up: [0, 1], down: [0, -1], left: [-1, 0], right: [1, 0] };
    el.querySelectorAll(".cwPad [data-d]").forEach(btn => {
      const [dx, dz] = DIRS[btn.dataset.d];
      const up = () => { if(dir.x === dx && dir.z === dz) dir = { x: 0, z: 0 }; btn.classList.remove("on"); ["pointerup","touchend","mouseup"].forEach(t => window.removeEventListener(t, up)); };
      const down = e => { if(e.cancelable) e.preventDefault(); if(state !== "aim") { if(state === "idle") msg("先按「投幣」才能移動爪子喔"); return; } dir = { x: dx, z: dz }; btn.classList.add("on"); SFX.key(.8);
        ["pointerup","touchend","mouseup"].forEach(t => window.addEventListener(t, up)); };
      btn.addEventListener("pointerdown", down); btn.addEventListener("touchstart", down, { passive: false }); btn.addEventListener("contextmenu", e => e.preventDefault());
    });
    el.querySelector("#cwCol").addEventListener("click", openCol); el.querySelector("#cwBookBtn").addEventListener("click", () => openBook(0));

    let last = performance.now(), dayChk = 0, dayBusy = false;
    const loop = now => {
      if(!alive) return; const dt = Math.max(0, Math.min(.04, (now - last)/1000)); last = now;
      const c0 = { x: claw.x, z: claw.z, tip: claw.tip, r: claw.r }; step(dt);
      const SS = 4, lerp = (a, b, t) => a + (b - a)*t, at = t => ({ x: lerp(c0.x, claw.x, t), z: lerp(c0.z, claw.z, t), tip: lerp(c0.tip, claw.tip, t), r: lerp(c0.r, claw.r, t) });
      const solid = ["drop", "close", "rise", "top", "back"].includes(state) || (state === "release" && seq.t < .5);
      for(let i = 0; i < SS; i++) solid ? physics(dt/SS, at(i/SS), at((i + 1)/SS)) : physics(dt/SS);
      pose(dt); draw();
      if(state === "idle" && captured.length){ if(performance.now() - lastPlay < 4000) finish(); else { captured.splice(0).forEach(cap => { const sp = SPOTS[cap.spot] || [.6, .6]; const p = mk(cap.kind, sp[0], .7, sp[1]); p.spot = cap.spot; }); } }
      // 換日：只看手機上的日期有沒有變（不會一直重排）
      if(state === "idle" && now - dayChk > 5000){ dayChk = now; const d = dayKey(); if(d !== seenDay && !dayBusy){ seenDay = d; dayBusy = true; loadStatus().then(() => { dayBusy = false; if(state === "idle"){ arrange(); msg("新的一天！機台換了一批新娃娃"); info(); } }); } }
      raf = requestAnimationFrame(loop);
    };
    const loaded = Promise.all([ctx.getState("claw3d").catch(() => null).then(cur => { s = cur ? cur.state : s; }), loadStatus()]);
    requestAnimationFrame(async () => { try{ el.querySelector(".cw").scrollIntoView({ block: "start" }); }catch(e){} sizes(); buildScene(); await loaded; if(!alive) return;
      arrange(); for(let i = 0; i < 120; i++) physics(1/60); for(const p of prizes){ p.tx = p.rx; p.tz = p.rz; } captured = []; draw(); info(); if(!prizes.length) soldOut(); last = performance.now(); raf = requestAnimationFrame(loop); });
    const onR = () => { if(alive) sizes(); }; window.addEventListener("resize", onR);
    this._u = ctx.onState("claw3d", st => { s = st; if(alive) info(); });
    this._stop = () => { alive = false; window.removeEventListener("resize", onR); document.body.classList.remove("cwOn"); cancelAnimationFrame(raf); document.querySelectorAll(".cwReveal,.cwCabM,.cwBookM").forEach(x => x.remove());
      try{ const lx = E && E.gl.getExtension("WEBGL_lose_context"); if(lx) lx.loseContext(); }catch(e){} };
    if(window.__mock) window.__cw = { claw, prizes: () => prizes, state: () => state, HOME, lifted: () => lifted(), openCol, openBook, CAM };
  },
  unmount(){ if(this._u) this._u(); if(this._stop) this._stop(); },
});
if(window.GameArt) window.GameArt.claw3d = () => `<span class="gaL" style="left:2%;bottom:0;width:52%"><img src="${thumb("c_calico")}" alt="" style="width:100%"></span><span class="gaL" style="right:2%;bottom:4%;width:48%"><img src="${thumb("a_shiba")}" alt="" style="width:100%"></span>`;
})();

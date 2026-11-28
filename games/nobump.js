// 遊戲：喵喵別亂碰（單人、11/28）
// 小貓坐在中間，東西會從四面八方跑過來，在碰到小貓之前點掉它。被碰到就失敗，每種東西都有不同的「下場」小劇場可以收集（21 種）。
// 5 個世界 × 10 關（WORLDS：家、公園、獸醫院、海邊、夢境；每個世界第 10 關是魔王），出場順序用固定種子產生（每次一樣）。蝴蝶不能點；金魚乾＝全清、鈴鐺＝變慢 3 秒。
// 三顆星：過關、沒用道具、連擊達標。打倒第一隻魔王（第 10 關）開無盡模式。魚幣 fc（第一次過關 +10、每多一顆星 +5、無盡每 10 秒 +1）可以在商店買帽子 HAT、拳頭特效 PAWFX（只有好看、沒有抽獎）。
// 進度存在每個人自己的 game_state「nobump:自己 uid 前 8 碼」：{ v:2, lv 解鎖到第幾關, f:{關:失敗次數}, c:{關:破關時的失敗次數}, d:{下場:次數}, st:{關:星星}, ib 無盡最久×10, ip 無盡玩幾次, ic, all, ea 賺到的魚幣（fc＝ea－買過的東西）, own 買過的, eq:{hat,paw} }
// 舊版（12 關）的存檔 v 不是 2：關卡重新開始、圖鑑和無盡紀錄保留、舊星星 ×5 換成魚幣（norm）。
(function(){
const O = "#3b2a24";
const P = (rows, pal) => { pal = Object.assign({ O }, pal); const w = Math.max(...rows.map(r => r.length)), h = rows.length; let r = "";
  rows.forEach((row, y) => [...row].forEach((c, x) => { if(pal[c]) r += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${pal[c]}"/>`; }));
  return `<svg viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg">${typeof pxC === "function" ? pxC(r) : r}</svg>`; };

// ---- 像素圖（全部自己畫的） ----
const ART = {
  cuke: P([
    "...OOOOOOOOOO...",
    "..OgGGgGGGgGGO..",
    ".OGGLGGGLGGGLGGO",
    "OgGGGGgGGGGgGGGO",
    "OGGgGGGGGgGGGGgO",
    ".OGGGLGGGGLGGGO.",
    "..OOOOOOOOOOOO..",
  ], { G:"#6cc04a", g:"#3e8f2e", L:"#a6e07a" }),
  yarn: P([
    "...OOOOO...",
    "..OPPpPPO..",
    ".OPpPPPpPO.",
    "OPPPpPpPPPO",
    "OpPPPpPPPpO",
    "OPPpPPPpPPO",
    "OPpPPpPPpPO",
    ".OPPpPPPPO.",
    "..OPPPpPO..",
    "...OOOOOkk.",
    ".........kk",
  ], { P:"#ff9ec4", p:"#e0638f", k:"#e0638f" }),
  drop: P([
    "...O...",
    "..OBO..",
    "..OBO..",
    ".OBBBO.",
    "OBWBBBO",
    "OBWBBBO",
    "OBBBBbO",
    ".ObbbO.",
    "..OOO..",
  ], { B:"#6cc0ff", b:"#3a8fe0", W:"#e6f6ff" }),
  vac: P([
    "..........OOOO",
    ".........OkkkO",
    "........Ok.OO.",
    ".......Ok.....",
    "......Ok......",
    "..OOOOk.......",
    ".ORRRRRO......",
    "ORRWWRRRO.....",
    "ORWRRRRRO.....",
    "ORRRRRRRO.....",
    "OGGGGGGGO.....",
    ".OO...OO......",
  ], { R:"#9b7bd8", W:"#d9ccff", G:"#5a4a7a", k:"#6a6a7a" }),
  bub: P([
    "..OOOOO..",
    ".OSSSSSO.",
    "OSWWSSSSO",
    "OSWSSSSSO",
    "OSSSSSSSO",
    "OSSSSSSsO",
    "OSSSSSssO",
    ".OSSsssO.",
    "..OOOOO..",
  ], { S:"#cdeeff", s:"#9fd6f5", W:"#ffffff" }),
  dog: P([
    "OOO........OOO",
    "OEEO......OEEO",
    "OEEEOOOOOOEEEO",
    "OEEOYYYYYYOEEO",
    ".OOYYYYYYYYOO.",
    "..OYKYYYYKYO..",
    "..OYYYYYYYYO..",
    "..OYYYNNYYYO..",
    "..OYYYYYYYYO..",
    "...OYYRRYYO...",
    "....OOROOO....",
    "......OO......",
  ], { E:"#a0683e", Y:"#e9c08a", K:"#2b1d18", N:"#2b1d18", R:"#ff7a9a" }),
  fly: P([
    ".OOO.....OOO.",
    "OPPPO...OPPPO",
    "OPWPPO.OPPWPO",
    "OPPPPPOPPPPPO",
    ".OPPPPOPPPPO.",
    "..OOPPOPPOO..",
    ".OYYOOOOOYYO.",
    ".OYYYO.OYYYO.",
    "..OOO...OOO..",
  ], { P:"#ffb3d1", W:"#ffffff", Y:"#ffe07a" }),
  cage: P([
    "....OOOOOO....",
    "....O....O....",
    "OOOOOOOOOOOOOO",
    "OGGGGGGGGGGGGO",
    "OGOOOOOGGGGGGO",
    "OGO.O.OGGHHGGO",
    "OGO.O.OGGGGGGO",
    "OGO.O.OGGGGGGO",
    "OGOOOOOGGGGGGO",
    "OGGGGGGGGGGGGO",
    "OOOOOOOOOOOOOO",
  ], { G:"#b9b0a6", H:"#ffffff" }),
  clock: P([
    ".OO......OO.",
    "OYYO....OYYO",
    "OYO.OOOO.OYO",
    ".O.ORRRRO.O.",
    "..ORWWWWRO..",
    ".ORWWOWWWRO.",
    ".ORWWOWWWRO.",
    ".ORWWOOOWRO.",
    ".ORWWWWWWRO.",
    "..ORWWWWRO..",
    "...ORRRRO...",
    "..OO.OO.OO..",
  ], { R:"#ff6a5a", W:"#fff8ec", Y:"#ffd04a" }),
  spray: P([
    "OOOOO....",
    "OKKKKOO..",
    "OOOKKKKO.",
    "...OKOOO.",
    "..OOKOO..",
    ".OBBBBBO.",
    ".OBWBBBO.",
    ".OBWBBBO.",
    ".OBBBBBO.",
    ".OBBBBbO.",
    ".OBBBBbO.",
    ".OOOOOOO.",
  ], { K:"#4ab08a", B:"#9fd8ff", b:"#6cb4e8", W:"#e6f6ff" }),
  paw: P(["..OO.OO..",".OKKOKKO.","..OO.OO..","OO.....OO","OKO.O.OKO",".OOOWOOO.","OWWWWWWWO","OWWWWWWWO",".OWWWWWO.","..OOOOO.."], { K:"#f7a7b8", W:"#fffaf4" }),
  lock: P(["..OOO..",".O...O.",".O...O.","OOOOOOO","OYYYYYO","OYYOYYO","OYYOYYO","OYYYYYO","OOOOOOO"], { Y:"#ffd04a" }),
  star: P(["...O...","..OYO..","OOOYOOO","OYYYYYO",".OYYYO.","OYYOYYO","OO...OO"], { Y:"#ffd04a" }),
};
ART.mini = ART.bub;
Object.assign(ART, {
  fish: P([
    "..........OO..",
    "..OOOOOO.OYO..",
    ".OYYYYYYOYYO..",
    "OYKYYyYYYYYO..",
    "OYYYYYyYYYYYO.",
    ".OYYYYYYOYYO..",
    "..OOOOOO.OYO..",
    "..........OO..",
  ], { Y:"#ffd04a", y:"#e0a020", K:"#3b2a24" }),
  bell: P([
    "....OO....",
    "...OYYO...",
    "..OYWYYO..",
    ".OYWYYYYO.",
    ".OYYYYYYO.",
    "OYYYYYYYYO",
    "OOOOOOOOOO",
    "...OKKO...",
    "....OO....",
  ], { Y:"#ffd04a", W:"#fff6c8", K:"#c98a1e" }),
  crown: P(["O..O..O","OYOYOYO","OYYRYYO","OYYYYYO","OOOOOOO"], { Y:"#ffd04a", R:"#ff6a7a" }),
  cloud: P([
    "....OOOO......",
    "...OWWWWO.OO..",
    ".OOWWWWWWOWWO.",
    "OWWWWWWWWWWWWO",
    "OGWWWWWWWWWWGO",
    ".OGGGGGGGGGGO.",
    "..OOOOOOOOOO..",
  ], { W:"#e9eef6", G:"#b8c2d4" }),
  heart: P([".OO.OO.","OPPOPPO","OPPPPPO",".OPPPO.","..OPO..","...O..."], { P:"#ff7a9a" }),
  zz: P(["OOOO","..O.",".O..","OOOO"], {}),
});
// ---- 第二批像素圖（11/28 擴充：公園、獸醫院、海邊、夢境、帽子）----
Object.assign(ART, {
  ball: P([
    "...OOOOO...",
    "..OWWKWWO..",
    ".OWWKKKWWO.",
    "OWWWWKWWWWO",
    "OKWWWWWWWKO",
    "OKKWWWWWKKO",
    "OKWWWKWWWKO",
    "OWWWKKKWWWO",
    ".OWWWKWWWO.",
    "..OWWWWWO..",
    "...OOOOO...",
  ], { W:"#ffffff", K:"#3b2a24" }),
  bee: P([
    "....OO.OO....",
    "...OWWOWWO...",
    "...OWWOWWO...",
    "..OOOOOOOOO..",
    ".OYYKKYYKKYO.",
    "OKYYKKYYKKYYO",
    "OYYYKKYYKKYKO",
    ".OYYKKYYKKYO.",
    "..OOOOOOOOO.O",
  ], { Y:"#ffd04a", K:"#3b2a24", W:"#e6f6ff" }),
  bird: P([
    "......OOO.....",
    ".....OGGGO....",
    ".....OGKGOOO..",
    ".....OGGGOYYO.",
    "..OOOOGGGOOO..",
    ".OWWWWGGGGO...",
    "OWWWWWWGGGGO..",
    ".OWWWWWWGGGGO.",
    "..OOOWWWWGGGO.",
    ".....OOOOOOO..",
    "......Y..Y....",
  ], { G:"#a8b3c4", W:"#e9eef6", K:"#3b2a24", Y:"#ffb04a" }),
  needle: P([
    "OO..............",
    "OGOOOOOOOOOO....",
    "OGOBBBBBBBWOOOO.",
    "OGOBBBBBBBWOSSSO",
    "OGOBBBBBBBWOOOO.",
    "OGOOOOOOOOOO....",
    "OO..............",
  ], { G:"#b9b0a6", B:"#9fd8ff", W:"#e6f6ff", S:"#c9ccd8" }),
  clip: P([
    "..OOO.....",
    ".OSSSO....",
    "OSSSSSOOOO",
    "OSSSSSSSSO",
    ".OOOOOOOOO",
    "....OSO...",
    "...OPPPO..",
    "..OPP.PPO.",
    "..OPP.PPO.",
    "...OPPPO..",
  ], { S:"#c9ccd8", P:"#ff7a9a" }),
  clipo: P([
    "..OOO.....",
    ".OSSSOOOO.",
    "OSSSSSSSSO",
    "OSSSOOOOO.",
    ".OOOSO....",
    "....OSO...",
    "...OPPPO..",
    "..OPP.PPO.",
    "..OPP.PPO.",
    "...OPPPO..",
  ], { S:"#c9ccd8", P:"#ff7a9a" }),
  crab: P([
    "OO........OO",
    "ORO......ORO",
    "OROO.OO.OORO",
    ".ORROKKORRO.",
    "..ORRRRRRO..",
    ".ORRWRRWRRO.",
    "ORRRRRRRRRRO",
    "O.ORRRRRRO.O",
    "..O.O..O.O..",
  ], { R:"#ff6a5a", W:"#ffffff", K:"#3b2a24" }),
  wave: P([
    ".......OOOO.......",
    ".....OOWWWWO......",
    "....OWWBBBWWO.....",
    "...OWBBOOOBWO.....",
    "..OWBBO...OBO..OO.",
    ".OWBBBO....O..OWWO",
    "OWBBBBBOOOOOOOWBBO",
    "OBBBBBBBBBBBBBBBBO",
    "OOOOOOOOOOOOOOOOOO",
  ], { W:"#e6f6ff", B:"#6cc0ff" }),
  gull: P([
    "OO...........OO",
    "OWOO.......OOWO",
    ".OWWOO.OOOOWWO.",
    "..OWWWOWWWWWO..",
    "...OOWWWKWWOYO.",
    ".....OWWWWWOOO.",
    "......OOOOO....",
  ], { W:"#ffffff", K:"#3b2a24", Y:"#ffb04a" }),
  clam: P([
    "...OOOOOO...",
    ".OOPpPPpPOO.",
    "OPPpPPPPpPPO",
    "OPpPPpPPPpPO",
    "OOOOOOOOOOOO",
    "OPPPPPPPPPPO",
    ".OOOOOOOOOO.",
  ], { P:"#ffc9d6", p:"#e89aae" }),
  clamo: P([
    "...OOOOOO...",
    ".OOPpPPpPOO.",
    "OPPpPPPPpPPO",
    "OOOOOOOOOOOO",
    ".O........O.",
    "O....OO....O",
    "O...OWWO...O",
    "OOOOOOOOOOOO",
    "OPPPPPPPPPPO",
    ".OOOOOOOOOO.",
  ], { P:"#ffc9d6", p:"#e89aae", W:"#ffffff" }),
  robot: P([
    "....OOOOOO....",
    "..OOGGGGGGOO..",
    ".OGGGGRGGGGGO.",
    "OGGGGGGGGGGGGO",
    "OGGLLLLLLLLGGO",
    "OGGGGGGGGGGGGO",
    ".OGGGGGGGGGGO.",
    "..OOOOOOOOOO..",
  ], { G:"#8a8f9e", L:"#7fd8c4", R:"#ff6a5a" }),
  ufo: P([
    ".....OOOO.....",
    "....OBBWBO....",
    "....OBBBBO....",
    "..OOOOOOOOOO..",
    ".OSSSSSSSSSSO.",
    "OSYSSYSSYSSYSO",
    ".OSSSSSSSSSSO.",
    "..OOOOOOOOOO..",
  ], { B:"#9fd8ff", W:"#ffffff", S:"#c9ccd8", Y:"#ffd04a" }),
  meteor: P([
    "OO.........",
    "OYOO.......",
    ".OYYOO.....",
    "..OYYYOOOO.",
    "...OYYORRRO",
    "....OORRRRRO",
    ".....ORRKRRO",
    ".....ORRRRRO",
    "......ORRRO.",
    ".......OOO..",
  ], { Y:"#ffd04a", R:"#c98a5a", K:"#8a5a3a" }),
  octo: P([
    "....OOOOOO....",
    "..OOPPPPPPOO..",
    ".OPPPPPPPPPPO.",
    "OPPWKPPPPWKPPO",
    "OPPKKPPPPKKPPO",
    "OPPPPPPPPPPPPO",
    "OPPPPPRRPPPPPO",
    ".OPPPPPPPPPPO.",
    "OPOPOPOPOPOPOP",
    "OPOPOPOPOPOPOP",
    "O.O.O.O.O.O.O.",
  ], { P:"#b98ae0", W:"#ffffff", K:"#3b2a24", R:"#ff7a9a" }),
  ink: P([
    "..OOO..OO..",
    ".OKKKOOKKO.",
    "OKKKKKKKKKO",
    "OKKKKKKKKO.",
    ".OKKKKKKKKO",
    "OKKKKKKKKKO",
    ".OKKOKKKKO.",
    "..OO.OOOO..",
  ], { K:"#2a2238" }),
  coin: P(["..OOOO..",".OYYYYO.","OYYWYYYO","OYWYYYYO","OYYYYYyO","OYYYYyyO",".OYyyyO.","..OOOO.."], { Y:"#ffd04a", y:"#e0a020", W:"#fff6c8" }),
  shield: P(["OOOOOOO","OBBWBBO","OBWBBBO","OBBBBBO",".OBBBO.","..OBO..","...O..."], { B:"#7fd8c4", W:"#e6fff8" }),
});
// 帽子（戴在小貓頭上，都是自己畫的）
const HAT = {
  bow:    { n:"粉紅蝴蝶結", p:30,  w:.42, x:.52, y:-.02, a:P(["OO...OO","OPOOOPO","OPPKPPO","OPOOOPO","OO...OO"], { P:"#ff9ec4", K:"#e0638f" }) },
  straw:  { n:"小草帽",     p:60,  w:.62, x:.5,  y:-.08, a:P(["...OOOOO...","..OYYYYYO..","..ORRRRRO..","OOOYYYYYOOO","OYYYYYYYYYO",".OOOOOOOOO."], { Y:"#f2cf7a", R:"#ff7a9a" }) },
  chef:   { n:"廚師帽",     p:80,  w:.52, x:.5,  y:-.1,  a:P([".OO.OO.OO.","OWWOWWOWWO","OWWWWWWWWO",".OWWWWWWO.","..OWWWWO..","..OGGGGO..","..OOOOOO.."], { W:"#ffffff", G:"#e9eef6" }) },
  flower: { n:"花環",       p:90,  w:.6,  x:.5,  y:0, a:P([".OO..OO..OO.","OPYO.OBO.OYPO","OPPOOBBOOPPO",".OOGGOOGGOO.","...OOOOOO..."], { P:"#ff9ec4", Y:"#ffd04a", B:"#9fd8ff", G:"#7fd8c4" }) },
  wizard: { n:"魔法帽",     p:120, w:.58, x:.52, y:-.26, a:P(["......OO..",".....OPPO.","....OPPPO.","....OPYPO.","...OPPPPO.","...OPPPPPO","..OPPYPPPO","..OPPPPPPO","OOOOOOOOOOOO","OPPPPPPPPPPO","OOOOOOOOOOOO"], { P:"#8a7cf0", Y:"#ffd04a" }) },
  phones: { n:"貓耳耳機",   p:140, w:.7,  x:.5,  y:-.02, a:P(["...OOOOOO...","..OKKKKKKO..",".OKO....OKO.","OKO......OKO","OPPO....OPPO","OPPO....OPPO",".OO......OO."], { K:"#3b2a24", P:"#ff9ec4" }) },
  crown:  { n:"國王皇冠",   p:200, w:.5,  x:.5,  y:0, a:P(["O..O..O..O","OYOOYOOYOO","OYYYRYYYYO","OYYYYYYYYO","OOOOOOOOOO"], { Y:"#ffd04a", R:"#ff6a7a" }) },
  helmet: { n:"太空頭盔",   p:260, w:.9,  x:.5,  y:-.02, a:P(["....OOOOOO....","..OOBBBBBBOO..",".OBWBBBBBBBBO.","OBWBBBBBBBBBBO","OBBBBBBBBBBBBO","OBBBBBBBBBBBBO","OBBBBBBBBBBBBO",".OBBBBBBBBBBO.","..OSSSSSSSSO..","..OOOOOOOOOO.."], { B:"rgba(159,216,255,.45)", W:"#ffffff", S:"#c9ccd8" }) },
};
// 拳頭特效（點下去的貓爪和碎片顏色）
const PAWFX = {
  none:   { n:"原本的",   p:0,   pal:{ K:"#f7a7b8", W:"#fffaf4" }, sh:null },
  heart:  { n:"愛心拳",   p:50,  pal:{ K:"#ff6f9c", W:"#ffe3ec" }, sh:["#ff6f9c","#ffb3d1","#ffffff"] },
  star:   { n:"星星拳",   p:80,  pal:{ K:"#ffd04a", W:"#fff6c8" }, sh:["#ffd04a","#fff6c8","#ffb04a"] },
  mint:   { n:"薄荷拳",   p:80,  pal:{ K:"#3fb39a", W:"#e6fff8" }, sh:["#7fd8c4","#c4f0e6","#ffffff"] },
  rainbow:{ n:"彩虹拳",   p:150, pal:{ K:"#8a7cf0", W:"#fff0fb" }, sh:["#ff6a5a","#ffd04a","#7fd8c4","#6cc0ff","#b98ae0"] },
  shadow: { n:"暗影拳",   p:200, pal:{ K:"#2a2238", W:"#8a7f9e" }, sh:["#2a2238","#5a4a7a","#b98ae0"] },
};
const PAW_ROWS = ["..OO.OO..",".OKKOKKO.","..OO.OO..","OO.....OO","OKO.O.OKO",".OOOWOOO.","OWWWWWWWO","OWWWWWWWO",".OWWWWWO.","..OOOOO.."];

// ---- 每種東西：大小、速度、怎麼動、要點幾下、下場、碎片顏色 ----
// mv：line 直線、curl 繞圈、feint 衝一下停一下、blink 一閃一閃、tele 一跳一跳、park 停在旁邊噴水、flutter 亂飛經過、
//     bounce 碰牆反彈、zig 左右亂晃、swoop 繞圈再俯衝、aim 瞄準再衝刺、hop 一跳一跳（跳的時候點不到）、side 橫著走、shell 殼打開才點得到、boss 魔王
const T = {
  cuke:  { s:46, v:70,  mv:"line",  hp:1, fate:"fly",  col:["#6cc04a","#3e8f2e","#a6e07a"] },
  drop:  { s:26, v:150, mv:"line",  hp:1, fate:"wet",  col:["#6cc0ff","#3a8fe0","#e6f6ff"] },
  yarn:  { s:36, v:62,  mv:"curl",  hp:1, fate:"wrap", col:["#ff9ec4","#e0638f"] },
  vac:   { s:52, v:30,  mv:"line",  hp:3, fate:"suck", col:["#9b7bd8","#d9ccff","#5a4a7a"] },
  bub:   { s:40, v:52,  mv:"line",  hp:1, fate:"foam", split:3, col:["#cdeeff","#ffffff","#9fd6f5"] },
  mini:  { s:22, v:105, mv:"line",  hp:1, fate:"foam", art:"bub", col:["#cdeeff","#ffffff"] },
  dog:   { s:44, v:140, mv:"feint", hp:1, fate:"lick", col:["#e9c08a","#a0683e"] },
  ball:  { s:34, v:150, mv:"bounce", hp:1, fate:"ko", col:["#ffffff","#3b2a24"] },
  bee:   { s:32, v:75,  mv:"zig",   hp:1, fate:"bump", col:["#ffd04a","#3b2a24"] },
  bird:  { s:42, v:70,  mv:"swoop", hp:1, fate:"peck", col:["#a8b3c4","#e9eef6"] },
  cage:  { s:48, v:46,  mv:"blink", hp:1, fate:"vet",  col:["#b9b0a6","#ffffff"] },
  needle:{ s:50, v:90,  mv:"aim",   hp:1, fate:"shot", col:["#9fd8ff","#c9ccd8"] },
  clip:  { s:34, v:0,   mv:"hop",   hp:1, fate:"nail", col:["#c9ccd8","#ff7a9a"] },
  crab:  { s:42, v:40,  mv:"side",  hp:2, fate:"pinch", col:["#ff6a5a","#ffffff"] },
  wave:  { s:66, v:34,  mv:"line",  hp:3, fate:"wash", col:["#6cc0ff","#e6f6ff"] },
  gull:  { s:46, v:80,  mv:"swoop", hp:1, fate:"snatch", col:["#ffffff","#ffb04a"] },
  clam:  { s:40, v:48,  mv:"shell", hp:1, fate:"clamp", col:["#ffc9d6","#e89aae"] },
  clock: { s:40, v:0,   mv:"tele",  hp:1, fate:"wake", col:["#ff6a5a","#ffd04a","#fff8ec"] },
  spray: { s:36, v:80,  mv:"park",  hp:2, fate:"wet",  col:["#9fd8ff","#4ab08a"] },
  robot: { s:46, v:95,  mv:"bounce", hp:2, fate:"ride", col:["#8a8f9e","#7fd8c4"] },
  ufo:   { s:48, v:0,   mv:"tele",  hp:2, fate:"abduct", col:["#c9ccd8","#ffd04a","#9fd8ff"] },
  meteor:{ s:40, v:230, mv:"line",  hp:1, fate:"flat", warn:true, col:["#ffd04a","#c98a5a"] },
  fly:   { s:34, v:55,  mv:"flutter", hp:1, fate:"trip", friend:true, col:["#ffb3d1","#ffe07a"] },
  fish:  { s:40, v:70,  mv:"flutter", hp:1, pow:"fish", col:["#ffd04a","#fff6c8","#e0a020"] },
  bell:  { s:30, v:70,  mv:"flutter", hp:1, pow:"bell", col:["#ffd04a","#fff6c8"] },
  bvac:  { s:108, v:15, mv:"boss",  hp:36, fate:"suck", art:"vac", boss:true, n:"巨大吸塵器", spit:["cuke","drop","drop","bub"], every:1.4, col:["#9b7bd8","#d9ccff","#5a4a7a"] },
  bdog:  { s:104, v:16, mv:"boss",  hp:44, fate:"lick", art:"dog", boss:true, n:"大狗狗", spit:["ball","bee","dog"], every:1.4, dash:3.2, col:["#e9c08a","#a0683e"] },
  bneedle:{ s:120, v:14, mv:"boss", hp:52, fate:"shot", art:"needle", boss:true, n:"巨大針筒", spit:["needle","clip","cage"], every:1.5, dash:2.6, col:["#9fd8ff","#c9ccd8"] },
  boct:  { s:112, v:13, mv:"boss",  hp:60, fate:"wash", art:"octo", boss:true, n:"大章魚", spit:["crab","clam","drop","gull"], every:1.25, ink:3.4, col:["#b98ae0","#2a2238"] },
  bcuke: { s:120, v:18, mv:"boss",  hp:72, fate:"fly",  art:"cuke", boss:true, n:"小黃瓜大王", crown:true, spit:["cuke","meteor","robot","ufo","yarn"], every:1.05, split:6, col:["#6cc04a","#3e8f2e","#a6e07a","#ffd04a"] },
};
// 下場：n 名字、t 說明、say 台詞、art 圖鑑圖、sc 小劇場的演法
const FATE = {
  fly:   { n:"嚇到彈飛",     t:"小黃瓜！！整隻彈出畫面，再摔回來變扁扁", say:"小、小黃瓜……", art:"cuke" },
  wet:   { n:"變成落湯貓",   t:"頭上一朵烏雲一直下雨，正在生悶氣", say:"……（生氣）", art:"drop" },
  wrap:  { n:"被捲成毛線球", t:"越掙扎纏得越緊，滾著滾著就滾走了", say:"救命喵——", art:"yarn" },
  suck:  { n:"被吸進吸塵器", t:"整隻被拉長，咻——不見了", say:"嗝。", art:"vac" },
  foam:  { n:"被洗香香",     t:"泡泡越堆越高，香到想哭", say:"香香的……不要啦", art:"bub" },
  lick:  { n:"被舔一臉",     t:"小狗超熱情，口水糊滿臉", say:"噁……口水……", art:"dog" },
  ko:    { n:"被球砸暈",     t:"足球正中腦門，眼前一圈星星", say:"誰踢的啦……", art:"ball" },
  bump:  { n:"叮出腫包",     t:"頭上腫了一個大包，還一直嗡嗡嗡", say:"好癢好癢！！", art:"bee" },
  peck:  { n:"被鴿子叼走",   t:"被叼著後頸飛上天，腳還在空中亂踢", say:"放我下來啦——", art:"bird" },
  vet:   { n:"被抓去看醫生", t:"外出籠從天而降，門關上了", say:"我不要打針！！", art:"cage" },
  shot:  { n:"打針哭哭",     t:"屁屁挨了一針，眼淚噴出來", say:"嗚哇——好痛！", art:"needle" },
  nail:  { n:"被剪指甲",     t:"喀嚓喀嚓，四隻腳的指甲都沒了", say:"我的指甲……", art:"clip" },
  pinch: { n:"被夾尾巴",     t:"螃蟹死命夾著尾巴不放", say:"痛痛痛痛痛！", art:"crab" },
  wash:  { n:"被浪沖走",     t:"一波大浪打過來，人就不見了", say:"咕嚕咕嚕……", art:"wave" },
  snatch:{ n:"零食被搶",     t:"海鷗連同小貓一起抓走了", say:"那是我的魚乾！", art:"gull" },
  clamp: { n:"頭被貝殼夾住", t:"眼前一片漆黑，貝殼不肯放開", say:"誰把燈關了？", art:"clam" },
  wake:  { n:"炸毛",         t:"鈴鈴鈴！毛全部豎起來變成刺蝟", say:"鈴——！！", art:"clock" },
  ride:  { n:"被載去兜風",   t:"坐在掃地機器人上轉了一百圈", say:"停、停下來……", art:"robot" },
  abduct:{ n:"被外星人抓走", t:"一道光照下來，飄上去就回不來了", say:"地球再見……", art:"ufo" },
  flat:  { n:"被流星砸扁",   t:"從天而降，變成一張貓貓餅", say:"（扁）", art:"meteor" },
  trip:  { n:"追蝴蝶跌倒",   t:"蝴蝶不能打啦！撲空摔了一跤，眼冒金星", say:"蝴蝶……好漂亮……", art:"fly" },
};
const FATE_IDS = Object.keys(FATE);
const HINT = {
  cuke:"小黃瓜碰到小貓之前點它一下就好", drop:"水滴很快，從遠遠的地方就要點", yarn:"毛線球會繞圈圈，等它繞到你旁邊再點",
  bub:"泡泡點破會分成三顆小泡泡，在遠一點的地方就點破它", vac:"吸塵器要點三下，越早開始點越好", fly:"粉紅色的蝴蝶不能點！讓牠飛走就好",
  dog:"小狗衝一下停一下，趁牠停下來的時候點", ball:"足球會撞牆反彈，看準它彈回來的方向", bee:"蜜蜂左右亂晃，點牠身體的正中間", bird:"鴿子會先繞圈，頭上出現「！」就要俯衝了",
  cage:"外出籠一閃一閃，看得到的時候才點得到", needle:"針筒停下來瞄準時最好點，衝過來就來不及了", clip:"指甲剪打開跳的時候點不到，合起來的時候才點",
  crab:"螃蟹橫著走、要點兩下，別等牠走到旁邊", wave:"海浪又大又慢，要點三下", gull:"海鷗跟鴿子一樣會俯衝，看到「！」就點", clam:"貝殼合起來點不到，打開的時候趕快點",
  clock:"鬧鐘會一跳一跳靠近，跳完的瞬間點", spray:"噴水瓶要點兩下，不然會一直噴水", robot:"掃地機器人會反彈、要點兩下", ufo:"幽浮會瞬間移動、要點兩下", meteor:"畫面邊邊出現「！」，流星就要從那裡飛過來了",
};

// ---- 5 個世界，每個 10 關（第 10 關是魔王）----
// intro：[第幾關出現, 種類]；bg：場景背景；dark：深色場景（字要換淺色）
const WORLDS = [
  { id:"home",  n:"喵喵的家", bg:"home",  intro:[[1,"cuke"],[2,"drop"],[3,"yarn"],[4,"fly"],[5,"bub"],[7,"vac"]], boss:"bvac",
    lv:["小黃瓜來了","下雨了","滾來滾去","不能點的","泡泡浴","大掃除","吸塵器出動","客廳大亂鬥","最後的打掃"] },
  { id:"park",  n:"公園",     bg:"park",  intro:[[1,"dog"],[3,"ball"],[5,"bee"],[7,"bird"]], boss:"bdog",
    lv:["散步的小狗","汪汪假動作","踢足球","球彈來彈去","蜜蜂嗡嗡","花叢裡","鴿子俯衝","公園好熱鬧","夕陽下的追逐"] },
  { id:"vet",   n:"獸醫院",   bg:"vet",   intro:[[1,"cage"],[3,"needle"],[5,"clip"]], boss:"bneedle",
    lv:["看不見的籠子","候診室","針筒瞄準","不要打針","剪指甲時間","喀嚓喀嚓","掛號大排隊","護士來了","診療室"] },
  { id:"beach", n:"海邊",     bg:"beach", intro:[[1,"crab"],[3,"wave"],[5,"gull"],[7,"clam"]], boss:"boct",
    lv:["橫著走的螃蟹","沙灘散步","浪來了","漲潮","海鷗搶食","藍天白雲","貝殼開開","退潮的秘密","深海的呼喚"] },
  { id:"dream", n:"夢境",     bg:"dream", intro:[[1,"clock"],[2,"spray"],[4,"robot"],[6,"ufo"],[8,"meteor"]], boss:"bcuke",
    lv:["鬧鐘響了","噴水攻擊","掃地機器人","滿地亂跑","幽浮出現","外星訪客","流星雨","星空大亂鬥","夢的盡頭"] },
];
const NLV = WORLDS.length * 10;
const R = (seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
function burst(rnd, from, to, every, kinds){ const a = []; for(let t = from; t < to; t += every * (.75 + rnd() * .5)) a.push([+t.toFixed(2), kinds[(rnd() * kinds.length) | 0], (rnd() * 360) | 0]); return a; }
const LV = [];
WORLDS.forEach((Wd, w) => {
  const prev = WORLDS.slice(0, w).flatMap(x => x.intro.map(i => i[1])).filter(k => k !== "fly");
  for(let k = 1; k <= 10; k++){
    const r = R(1000 + (w * 10 + k) * 7919), id = w * 10 + k;
    if(k === 10){
      const B = Wd.boss, kinds = Wd.intro.map(i => i[1]).filter(x => x !== "fly");
      LV.push({ id, w, k, n:"魔王：" + T[B].n, boss:B, hint:"魔王會一直丟東西出來：先清小的，空檔再狂點魔王", dur:180, cb:20 + w * 5, spd:1 + w * .06,
        plan:[[1, B, 270]].concat(burst(r, 3, 170, 2.3 - w * .1, kinds.concat(prev.slice(-2)))).concat(burst(r, 6, 170, 4.5, ["fly"])).concat([[10,"fish",30],[22,"bell",210],[38,"fish",120],[60,"bell",300]]).sort((a, b) => a[0] - b[0]) });
      continue;
    }
    const have = Wd.intro.filter(i => i[0] <= k).map(i => i[1]), newest = Wd.intro.filter(i => i[0] <= k).pop()[1];
    const main = have.filter(x => x !== "fly"), dur = 11 + k + w, every = Math.max(.42, 1.15 - k * .05 - w * .07);
    let plan = burst(r, .4, dur - 1, every, main.concat(main.includes(newest) ? [newest, newest] : []));
    if(prev.length && k >= 3) plan = plan.concat(burst(r, 2, dur - 1, every * 3, prev));
    if(w > 0 || k >= 4) plan = plan.concat(burst(r, 2, dur - 1, Math.max(1.8, 3 - w * .25), ["fly"]));
    if(k % 3 === 0) plan.push([+(dur * .45).toFixed(1), "fish", (r() * 360) | 0]);
    if(k % 4 === 2) plan.push([+(dur * .6).toFixed(1), "bell", (r() * 360) | 0]);
    LV.push({ id, w, k, n:Wd.lv[k - 1], hint:HINT[newest] || "", newk:newest, dur, cb:6 + k * 2 + w * 3, spd:1 + (w * 10 + k) * .012, plan:plan.sort((a, b) => a[0] - b[0]) });
  }
});
// 無盡模式：五個世界的東西都會來、越來越快
function endlessPlan(){ const r = R(424242), a = [], ks = ["cuke","drop","yarn","dog","ball","bee","vac","bub","cage","needle","clip","crab","bird","clock","spray","robot","gull","clam","wave","ufo","meteor"]; let t = .5;
  while(t < 600){ const lvl = Math.min(ks.length, 3 + Math.floor(t / 8)); a.push([+t.toFixed(2), ks[(r() * lvl) | 0], (r() * 360) | 0]); if(r() < .12) a.push([+(t + .3).toFixed(2), "fly", (r() * 360) | 0]); if(r() < .03) a.push([+(t + .5).toFixed(2), r() < .5 ? "fish" : "bell", (r() * 360) | 0]); t += Math.max(.3, 1.05 - t * .011) * (.7 + r() * .6); }
  return a; }
const ENDLESS_AT = 10;   // 打倒第一隻魔王就打開無盡模式

App.registerGame({
  id: "nobump",
  solo: true,
  added: "2026-11-28",   // 新遊戲排在大廳最前面
  name: "喵喵別亂碰",
  desc: "東西跑過來就點掉，碰到小貓就完蛋",
  icon: () => ART.cuke,
  mount(el, ctx){
    const { esc, SFX } = ctx;
    const KEY = "nobump:" + String(ctx.me.uid || "me").slice(0, 8), LK = "mw_nobump";
    let S = null, alive = true, stopGame = () => {}, dirty = false, wTab = -1, shopTab = "hat";
    try{ S = JSON.parse(localStorage.getItem(LK) || "null"); }catch(e){}
    const norm = s => { s = s && typeof s === "object" ? s : {};
      if(s.v !== 2 && (s.lv || s.st)){   // 11/28 晚上改成 5 個世界 50 關：舊的關卡進度重新開始，拿過的星星換成魚幣
        const oldSt = Object.values(s.st || {}).reduce((a, b) => a + (+b || 0), 0); s.ea = (s.ea | 0) + oldSt * 5 + (s.all ? 30 : 0); s.lv = 1; s.st = {}; s.c = {}; s.f = {}; s.moved = 1; }
      s.v = 2; s.lv = Math.max(1, Math.min(NLV, s.lv | 0 || 1)); s.f = s.f || {}; s.c = s.c || {}; s.d = s.d || {}; s.st = s.st || {};
      s.ib = Math.max(0, s.ib | 0, Math.round((+s.inf || 0) * 10)); s.ip = s.ip | 0; s.ic = s.ic | 0; s.inf = s.ib / 10; s.all = !!s.all;
      s.ea = Math.max(0, s.ea | 0); s.own = Array.isArray(s.own) ? s.own.filter(x => typeof x === "string").slice(0, 40) : []; s.eq = s.eq && typeof s.eq === "object" ? s.eq : {};
      s.eqT = +s.eqT || 0; if(!HAT[s.eq.hat] || !s.own.includes("h:" + s.eq.hat)) s.eq.hat = ""; if(!PAWFX[s.eq.paw] || (s.eq.paw !== "none" && !s.own.includes("p:" + s.eq.paw))) s.eq.paw = "none";
      s.fc = Math.max(0, s.ea - spent(s));   // 魚幣＝賺到的－買過的東西（兩支手機合併時才不會多出來）
      return s; };
    const spent = s => s.own.reduce((a, id) => a + ((id[0] === "h" ? HAT : PAWFX)[id.slice(2)] || { p:0 }).p, 0);
    S = norm(S);
    let movedNote = !!S.moved; delete S.moved;
    const merge = r => { if(!r) return; r = norm(JSON.parse(JSON.stringify(r)));   // 雲端和手機上的取大的
      S.lv = Math.max(S.lv, r.lv); if(r.ib > S.ib){ S.ib = r.ib; S.ic = r.ic; } S.ip = Math.max(S.ip, r.ip); S.inf = S.ib / 10; S.all = S.all || r.all;
      for(const k of ["f","d","st"]) for(const x in r[k]) S[k][x] = Math.max(S[k][x] || 0, r[k][x] || 0);
      for(const x in r.c) if(S.c[x] == null || r.c[x] < S.c[x]) S.c[x] = r.c[x];
      S.ea = Math.max(S.ea, r.ea); r.own.forEach(x => { if(!S.own.includes(x)) S.own.push(x); }); S.fc = Math.max(0, S.ea - spent(S)); if((r.eqT || 0) > (S.eqT || 0)){ S.eq = Object.assign({}, r.eq); S.eqT = r.eqT; } };
    const keep = () => { dirty = true; try{ localStorage.setItem(LK, JSON.stringify(S)); }catch(e){} };
    const sync = () => { if(!dirty) return; dirty = false; ctx.update(KEY, st => { merge(st); return JSON.parse(JSON.stringify(S)); }).catch(() => { dirty = true; }); };
    const cat = () => ctx.me.cat || "orange";
    const totalF = () => Object.values(S.f).reduce((a, b) => a + b, 0);
    const totalSt = () => Object.values(S.st).reduce((a, b) => a + b, 0);
    const wStars = w => LV.filter(L => L.w === w).reduce((a, L) => a + (S.st[L.id] || 0), 0);
    const stars = (n, cls) => `<span class="nbSt ${cls || ""}">${[1,2,3].map(i => `<i class="${i <= n ? "on" : ""}">${ART.star}</i>`).join("")}</span>`;
    const tone = (f, d, o) => { try{ SFX.tone && SFX.tone(f, d, o); }catch(e){} };
    const pawArt = k => P(PAW_ROWS, (PAWFX[k] || PAWFX.none).pal);
    const hatHtml = k => HAT[k] ? `<i class="nbHat" style="width:${HAT[k].w * 100}%;left:${(HAT[k].x - HAT[k].w / 2) * 100}%;top:0;margin-top:${HAT[k].y * 100}%">${HAT[k].a}</i>` : "";
    const catHtml = (face, hat) => Pix.sprite(cat(), face) + hatHtml(hat === undefined ? S.eq.hat : hat);
    const coinTag = () => `<span class="nbCoin"><i>${ART.coin}</i>${S.fc}</span>`;
    const endlessOpen = () => S.all || S.c[ENDLESS_AT] != null;

    // ---------- 大廳 ----------
    function lobby(){
      stopGame(); sync();
      if(wTab < 0) wTab = Math.min(WORLDS.length - 1, Math.floor((S.lv - 1) / 10));
      const got = FATE_IDS.filter(k => S.d[k]).length, Wd = WORLDS[wTab];
      el.innerHTML = `<div class="box nbLob">
        <div class="nbTopBar">${coinTag()}<button class="nbShopB" id="nbShop">商店・換裝</button></div>
        <div class="nbHero"><i class="a">${ART.cuke}</i><i class="b">${ART.yarn}</i><i class="c">${ART.drop}</i><i class="d">${ART.dog}</i><span class="nbHc">${catHtml("angry")}</span></div>
        ${movedNote ? `<div class="nbHint">遊戲變大了！現在有 5 個世界、50 關。關卡要重新開始，之前拿到的星星換成了 <b>${S.fc}</b> 個魚幣，可以去商店買帽子喔</div>` : ""}
        <div class="nbWTabs">${WORLDS.map((x, i) => { const open = S.lv > i * 10; return `<button class="nbWT bg_${x.bg}${i === wTab ? " on" : ""}${open ? "" : " lock"}" data-w="${i}" ${open ? "" : "disabled"}><b>${open ? esc(x.n) : "？？？"}</b><small>${open ? `${wStars(i)}/30` : `${i * 10} 關後`}</small></button>`; }).join("")}</div>
        <div class="nbLvs">${LV.filter(L => L.w === wTab).map(L => { const n = L.id, open = n <= S.lv, done = S.c[n] != null;
          return `<button class="nbLv${open ? "" : " lock"}${done ? " done" : ""}${L.boss ? " boss" : ""}" data-lv="${n}" ${open ? "" : "disabled"}><b>${open ? (L.boss ? `<i>${ART.crown}</i>` : L.k) : `<i>${ART.lock}</i>`}</b><span>${open ? esc(L.n) : "還沒解鎖"}${open && S.f[n] && !done ? `<small>失敗 ${S.f[n]} 次</small>` : ""}</span>${done ? stars(S.st[n] || 1, "sm") : ""}</button>`; }).join("")}</div>
        <div class="nbSum"><span>星星 <b>${totalSt()}</b> / ${NLV * 3}</span><span>總共失敗 <b>${totalF()}</b> 次</span></div>
        <button class="btn${endlessOpen() ? "" : " sub"}" id="nbInf" ${endlessOpen() ? "" : "disabled"}>${endlessOpen() ? `無盡模式・最久撐了 ${S.inf.toFixed(1)} 秒` : "無盡模式（打倒第一隻魔王就打開）"}</button>
        <button class="btn sub" id="nbRank">全站排行榜（無盡模式）</button>
        <button class="btn sub" id="nbAlbum">下場圖鑑（${got} / ${FATE_IDS.length}）</button>
        <div class="k" style="text-align:center">東西會從四面八方跑過來，在碰到小貓之前點掉它！粉紅色的蝴蝶不能點。<br>三顆星：過關・沒用道具・連擊達標</div></div>`;
      el.querySelectorAll(".nbLv:not(.lock)").forEach(b => b.addEventListener("click", () => { SFX.tap(); movedNote = false; play(+b.dataset.lv); }));
      el.querySelectorAll(".nbWT:not(.lock)").forEach(b => b.addEventListener("click", () => { SFX.tap(); wTab = +b.dataset.w; lobby(); }));
      el.querySelector("#nbAlbum").addEventListener("click", () => { SFX.tap(); album(); });
      el.querySelector("#nbRank").addEventListener("click", () => { SFX.tap(); rank(); });
      el.querySelector("#nbShop").addEventListener("click", () => { SFX.tap(); shop(); });
      const inf = el.querySelector("#nbInf"); if(endlessOpen()) inf.addEventListener("click", () => { SFX.tap(); play(0); });
    }
    async function rank(){
      el.innerHTML = `<div class="box nbLob"><h3 class="nbH">全站排行榜・無盡模式</h3><div class="k" style="text-align:center">比誰在無盡模式撐最久</div><div id="nbRL"><div class="k" style="text-align:center;padding:20px">讀取中…</div></div><button class="btn" id="nbBack">回去</button></div>`;
      el.querySelector("#nbBack").addEventListener("click", () => { SFX.tap(); lobby(); });
      let r; try{ r = await ctx.rpc("nobump_rank"); }catch(e){ const L = el.querySelector("#nbRL"); if(L) L.innerHTML = `<div class="k" style="text-align:center;padding:20px">${/nobump_rank|function/i.test(String(e.message || e)) ? "排行榜還在準備中，等站長更新資料庫" : "讀不到排行榜，等一下再試"}</div>`; return; }
      const L = el.querySelector("#nbRL"); if(!L || !r) return;
      const top = r.top || [], me = r.mine;
      const row = (x, mine) => `<div class="nbRk${mine ? " me" : ""}${x.rk <= 3 ? " t" + x.rk : ""}"><b>${x.rk <= 3 ? `<i>${ART.crown}</i>` : ""}${x.rk}</b><span class="c">${Pix.sprite(x.cat || cat(), x.rk === 1 ? "love" : "happy")}</span><span class="n">${mine ? esc(ctx.me.name) + "（你）" : esc(x.name)}</span><em>${(x.best / 10).toFixed(1)} 秒<small>連擊 ${x.ic}</small></em></div>`;
      L.innerHTML = top.length ? `<div class="nbRks">${top.map(x => row(x, x.me)).join("")}${me && !top.some(x => x.me) ? `<div class="nbGap">⋯</div>${row(me, true)}` : ""}</div><div class="k" style="text-align:center">共 ${r.total || top.length} 人上榜</div>`
        : `<div class="k" style="text-align:center;padding:20px">還沒有人上榜，第一名就是你的！</div>`;
    }
    function album(){
      el.innerHTML = `<div class="box nbLob"><h3 class="nbH">下場圖鑑（${FATE_IDS.filter(k => S.d[k]).length} / ${FATE_IDS.length}）</h3>
        <div class="nbAlb">${FATE_IDS.map(k => { const F = FATE[k], n = S.d[k] || 0;
          return `<div class="nbFa${n ? "" : " no"}"><i>${n ? ART[F.art] : ""}</i><b>${n ? esc(F.n) : "？？？"}</b><span>${n ? esc(F.t) : "還沒遇過"}</span>${n ? `<em>${n} 次</em>` : ""}</div>`; }).join("")}</div>
        <button class="btn" id="nbBack">回去</button></div>`;
      el.querySelector("#nbBack").addEventListener("click", () => { SFX.tap(); lobby(); });
    }
    // ---------- 商店・換裝（只有好看，不會讓遊戲變簡單；沒有抽獎）----------
    function shop(){
      const list = shopTab === "hat" ? Object.entries(HAT).map(([k, h]) => ({ id:"h:" + k, k, n:h.n, p:h.p, on:S.eq.hat === k, pic:`<span class="nbShCat">${catHtml("happy", k)}</span>` }))
        : Object.entries(PAWFX).map(([k, h]) => ({ id:"p:" + k, k, n:h.n, p:h.p, on:S.eq.paw === k, pic:`<span class="nbShPaw">${pawArt(k)}${h.sh ? `<em>${h.sh.map(c => `<i style="background:${c}"></i>`).join("")}</em>` : ""}</span>` }));
      el.innerHTML = `<div class="box nbLob"><div class="nbTopBar"><h3 class="nbH">商店・換裝</h3>${coinTag()}</div>
        <div class="nbShPrev"><span class="nbShBig">${catHtml("love")}</span><i class="nbShPw">${pawArt(S.eq.paw)}</i></div>
        <div class="admTabs nbShTabs"><button data-st="hat" class="${shopTab === "hat" ? "on" : ""}">帽子</button><button data-st="paw" class="${shopTab === "paw" ? "on" : ""}">拳頭特效</button></div>
        <div class="nbShop">${shopTab === "hat" ? `<button class="nbShI${!S.eq.hat ? " on" : ""}" data-off="1"><span class="nbShCat">${catHtml("normal", "")}</span><b>不戴帽子</b><em>${!S.eq.hat ? "穿戴中" : "選這個"}</em></button>` : ""}${list.map(x => { const own = x.p === 0 || S.own.includes(x.id);
          return `<button class="nbShI${x.on ? " on" : ""}${own ? "" : " buy"}" data-id="${x.id}" data-k="${x.k}" data-p="${x.p}">${x.pic}<b>${esc(x.n)}</b><em>${x.on ? "穿戴中" : own ? "選這個" : `<i>${ART.coin}</i>${x.p}`}</em></button>`; }).join("")}</div>
        <div class="k" style="text-align:center">魚幣怎麼拿：第一次過關 +10、每多一顆星 +5、無盡模式每撐 10 秒 +1</div>
        <button class="btn" id="nbBack">回去</button></div>`;
      el.querySelector("#nbBack").addEventListener("click", () => { SFX.tap(); lobby(); });
      el.querySelectorAll("[data-st]").forEach(b => b.addEventListener("click", () => { SFX.tap(); shopTab = b.dataset.st; shop(); }));
      const off = el.querySelector("[data-off]"); if(off) off.addEventListener("click", () => { SFX.tap(); S.eq.hat = ""; S.eqT = Date.now(); keep(); sync(); shop(); });
      el.querySelectorAll(".nbShI[data-id]").forEach(b => b.addEventListener("click", () => {
        const id = b.dataset.id, k = b.dataset.k, p = +b.dataset.p, own = p === 0 || S.own.includes(id);
        if(!own){ if(S.fc < p){ ctx.toast(`魚幣不夠喔，還差 ${p - S.fc} 個`); SFX.miss && SFX.miss(); return; }
          if(!b.classList.contains("arm")){ el.querySelectorAll(".nbShI.arm").forEach(x => { x.classList.remove("arm"); x.querySelector("em").innerHTML = `<i>${ART.coin}</i>${x.dataset.p}`; });
            b.classList.add("arm"); b.querySelector("em").textContent = "再按一下買"; SFX.tap(); return; }
          S.own.push(id); S.fc = Math.max(0, S.ea - spent(S)); SFX.coin && SFX.coin(); }
        else SFX.tap();
        if(id.startsWith("h:")) S.eq.hat = k; else S.eq.paw = k; S.eqT = Date.now();
        keep(); sync(); shop(); }));
    }

    // ---------- 遊戲 ----------
    function play(n){
      stopGame();
      const INF = n === 0, L = INF ? { n:"無盡模式", hint:"撐越久越好！", dur:1e9, cb:999, spd:1.05, w:4, plan: endlessPlan() } : LV[n - 1];
      const SPD = L.spd, Wd = WORLDS[L.w], pfx = PAWFX[S.eq.paw] || PAWFX.none;
      el.innerHTML = `<div class="box nbBox"><div class="nbTop"><span>${INF ? "無盡模式" : `${esc(Wd.n)} ${L.k}・${esc(L.n)}`}</span><em>${INF ? `最久 <b>${S.inf.toFixed(1)}</b> 秒` : `失敗 <b id="nbF">${S.f[n] || 0}</b> 次`}</em></div>
        <div class="m3Bar${L.boss ? " nbBossBar" : ""}"><i id="nbBar"></i>${L.boss ? `<span id="nbBossN">${esc(T[L.boss].n)}</span>` : ""}</div>
        <div class="nbF bg_${INF ? "dream" : Wd.bg}" id="nbField"><div class="nbW" id="nbW"><div class="nbCat" id="nbCat">${catHtml("normal")}</div></div><div class="nbCombo" id="nbCombo"></div><div class="nbTimer" id="nbTm"></div>
          ${!INF && L.newk && L.k === WORLDS[L.w].intro.find(i => i[1] === L.newk)[0] && S.c[n] == null ? `<div class="nbIntro" id="nbIntro"><i>${ART[L.newk]}</i><span>${esc(HINT[L.newk])}</span></div>` : ""}</div>
        <div class="nbBot"><button class="btn sub" id="nbQuit">${INF ? "結束" : "回到選關"}</button></div></div>`;
      const F = el.querySelector("#nbField"), Wl = el.querySelector("#nbW"), C = el.querySelector("#nbCat"), CB = el.querySelector("#nbCombo");
      el.querySelector("#nbQuit").addEventListener("click", () => { SFX.tap(); if(INF && !ended){ ended = true; cancelAnimationFrame(raf); endless(); } else lobby(); });
      let W = F.clientWidth, H = F.clientHeight, cx = W / 2, cy = H / 2;
      const things = [];
      let gone = false, t0 = 0, last = 0, gt = 0, idx = 0, ended = false, raf = 0, face = "normal", combo = 0, maxCombo = 0, usedPow = false, slowUntil = 0, boss = null, faceHold = 0;
      const intro = el.querySelector("#nbIntro"); const introT = intro ? 2.2 : 0; if(intro) setTimeout(() => intro && intro.classList.add("out"), 2000);
      const far = () => Math.hypot(W, H) / 2 + 30;
      const setFace = f => { if(f !== face){ face = f; C.innerHTML = catHtml(f); } };
      // ---- 特效 ----
      function fx(x, y, html, cls, ms){ const d = document.createElement("div"); d.className = "nbFx " + (cls || ""); d.style.left = x + "px"; d.style.top = y + "px"; d.innerHTML = html; Wl.appendChild(d); setTimeout(() => d.remove(), ms || 700); return d; }
      function shards(x, y, cols, k, big){ cols = pfx.sh && Math.random() < .5 ? pfx.sh : cols; for(let i = 0; i < k; i++){ const a = Math.random() * 6.28, r = (big ? 60 : 34) + Math.random() * (big ? 70 : 40), d = document.createElement("i");
          d.className = "nbShard"; d.style.left = x + "px"; d.style.top = y + "px"; d.style.background = cols[i % cols.length]; const sz = (big ? 6 : 4) + (Math.random() * 3 | 0); d.style.width = d.style.height = sz + "px";
          d.style.setProperty("--dx", Math.cos(a) * r + "px"); d.style.setProperty("--dy", Math.sin(a) * r + "px"); Wl.appendChild(d); setTimeout(() => d.remove(), 520); } }
      function shake(big){ F.classList.remove("shk", "shk2"); void F.offsetWidth; F.classList.add(big ? "shk2" : "shk"); }
      function comboUi(){ CB.innerHTML = combo >= 3 ? `<b>${combo}</b><span>連擊</span>` : ""; CB.classList.toggle("hot", combo >= 10); CB.classList.remove("bump"); void CB.offsetWidth; if(combo >= 3) CB.classList.add("bump"); }
      function addCombo(){ combo++; maxCombo = Math.max(maxCombo, combo); comboUi();
        tone(520 + Math.min(combo, 30) * 34, .07, { vol:.16, type:"square" });
        if([5, 10, 20, 30, 50].includes(combo) || (combo > 50 && combo % 25 === 0)){ fx(cx, cy - 70, `${combo} 連擊！`, "nbBig", 900); SFX.combo && SFX.combo(); setFace("happy"); faceHold = gt + .8; } }
      function spawn(kind, ang, x, y){
        const D0 = T[kind], D = Object.assign({}, D0, { v: D0.v * SPD }), a = ang * Math.PI / 180, r = far();
        const o = { kind, D, hp: D.hp, x: x != null ? x : cx + Math.cos(a) * r, y: y != null ? y : cy + Math.sin(a) * r, age: 0, ph: Math.random() * 6.28, el: document.createElement("div") };
        o.el.className = "nbT nb_" + kind + (D.boss ? " nbBoss" : "") + (D.pow ? " nbPow" : ""); o.el.style.width = D.s + "px"; o.el.innerHTML = ART[D.art || kind] + (D.crown ? `<i class="nbCrown">${ART.crown}</i>` : "");
        if(D.mv === "flutter"){ o.x = cx + Math.cos(a) * r; o.y = cy + Math.sin(a) * r * .6; o.tx = cx - Math.cos(a) * r; o.ty = cy - Math.sin(a) * r * .6 + (Math.random() - .5) * 60; }
        if(D.mv === "curl") o.spin = Math.random() < .5 ? 1 : -1;
        if(D.mv === "tele"){ o.next = .9; o.r = Math.min(W, H) / 2 - 20; o.ang = a; o.x = cx + Math.cos(a) * o.r; o.y = cy + Math.sin(a) * o.r; }
        if(D.mv === "bounce"){ const b = a + Math.PI + (Math.random() - .5) * .9; o.vx = Math.cos(b) * D.v; o.vy = Math.sin(b) * D.v; o.x = cx + Math.cos(a) * (Math.min(W, H) / 2 + 10); o.y = cy + Math.sin(a) * (Math.min(W, H) / 2 + 10); }
        if(D.mv === "swoop"){ o.r = Math.min(W, H) * .42; o.ang = a; o.dive = 1.6 + Math.random() * 1.4; o.x = cx + Math.cos(a) * o.r; o.y = cy + Math.sin(a) * o.r; o.spin = Math.random() < .5 ? 1 : -1; }
        if(D.mv === "aim") o.st = 0;
        if(D.mv === "hop"){ o.next = .5; o.open = false; }
        if(D.mv === "side"){ o.dir = Math.random() < .5 ? 1 : -1; }
        if(D.mv === "shell"){ o.open = false; }
        if(D.warn){ o.wait = .7; o.el.classList.add("hid"); const m = fx(Math.max(16, Math.min(W - 16, cx + (o.x - cx) * .8)), Math.max(16, Math.min(H - 16, cy + (o.y - cy) * .8)), "！", "nbWarn", 700); }
        if(D.boss){ o.r = Math.min(W, H) * .4; o.ang = a; o.cool = 2; o.hits = 0; o.dashT = D.dash || 0; o.inkT = D.ink || 0; boss = o; o.x = cx + Math.cos(a) * o.r; o.y = cy + Math.sin(a) * o.r; }
        Wl.appendChild(o.el); things.push(o); return o;
      }
      function kill(o, pop){ o.dead = true; o.el.classList.add(pop ? "pop" : "gone"); setTimeout(() => o.el.remove(), 260); }
      function place(o){ o.el.style.transform = `translate(${o.x - o.D.s / 2}px,${o.y - o.D.s / 2}px)${o.rot ? ` rotate(${o.rot}deg)` : ""}${o.flip ? " scaleX(-1)" : ""}`; }
      function ink(){ const d = document.createElement("div"); d.className = "nbInk"; const s = 120 + Math.random() * 60; d.style.width = s + "px"; d.style.left = (Math.random() * (W - s)) + "px"; d.style.top = (Math.random() * (H - s * .7)) + "px"; d.innerHTML = ART.ink; F.appendChild(d); setTimeout(() => d.remove(), 3600); SFX.splash && SFX.splash(); }
      function step(o, dt){
        const D = o.D, dx = cx - o.x, dy = cy - o.y, d = Math.hypot(dx, dy) || 1; o.age += dt;
        if(o.wait > 0){ o.wait -= dt; if(o.wait <= 0) o.el.classList.remove("hid"); place(o); return; }
        if(D.mv === "line"){ o.x += dx / d * D.v * dt; o.y += dy / d * D.v * dt; if(o.kind === "cuke" || o.kind === "meteor") o.rot = Math.atan2(dy, dx) * 57.3 - (o.kind === "meteor" ? 45 : 0); o.flip = dx < 0 && o.kind !== "cuke" && o.kind !== "meteor"; }
        else if(D.mv === "curl"){ const a = Math.atan2(dy, dx) + o.spin * Math.min(1.25, d / 160); o.x += Math.cos(a) * D.v * 1.4 * dt; o.y += Math.sin(a) * D.v * 1.4 * dt; o.rot = (o.rot || 0) + o.spin * 360 * dt; }
        else if(D.mv === "feint"){ const ph = (o.age % 1.15); const go = ph < .38; const side = Math.sin(o.age * 2.3 + o.ph) * (go ? 0 : 1);
          if(go){ o.x += dx / d * D.v * dt; o.y += dy / d * D.v * dt; } else { o.x += -dy / d * side * 40 * dt; o.y += dx / d * side * 40 * dt; }
          o.flip = dx < 0; o.el.classList.toggle("dash", go); }
        else if(D.mv === "blink"){ o.x += dx / d * D.v * dt; o.y += dy / d * D.v * dt; o.hid = (o.age + o.ph) % 1.4 > .75; o.el.classList.toggle("hid", o.hid); }
        else if(D.mv === "tele"){ o.next -= dt; o.el.classList.toggle("ring", o.next < .3);
          if(o.next <= 0){ o.next = 1.05; o.r = o.r * .62 - 6; o.ang += (Math.random() < .5 ? 1 : -1) * (.6 + Math.random() * .9); o.x = cx + Math.cos(o.ang) * o.r; o.y = cy + Math.sin(o.ang) * o.r; o.el.classList.remove("tp"); void o.el.offsetWidth; o.el.classList.add("tp"); tone(1400, .04, { vol:.08, type:"square" }); } }
        else if(D.mv === "park"){ const stop = Math.min(W, H) * .36;
          if(d > stop){ o.x += dx / d * D.v * dt; o.y += dy / d * D.v * dt; } else { o.cool = (o.cool == null ? .5 : o.cool) - dt; if(o.cool <= 0){ o.cool = 1.1; spawn("drop", 0, o.x + dx / d * 14, o.y + dy / d * 14); SFX.splash && SFX.splash(); } }
          o.flip = dx < 0; }
        else if(D.mv === "flutter"){ const fx_ = o.tx - o.x, fy = o.ty - o.y, fd = Math.hypot(fx_, fy) || 1;
          o.x += fx_ / fd * D.v * dt + Math.cos(o.age * 5 + o.ph) * 38 * dt; o.y += fy / fd * D.v * dt + Math.sin(o.age * 7 + o.ph) * 55 * dt; o.flip = fx_ < 0;
          if(fd < 20) kill(o); }
        else if(D.mv === "bounce"){ o.x += o.vx * dt; o.y += o.vy * dt; const m = D.s / 2;
          if(o.age > .5){ if(o.x < m && o.vx < 0 || o.x > W - m && o.vx > 0){ o.vx = -o.vx; tone(700, .03, { vol:.08, type:"square" }); } if(o.y < m && o.vy < 0 || o.y > H - m && o.vy > 0){ o.vy = -o.vy; tone(700, .03, { vol:.08, type:"square" }); } }
          if(o.age > 3){ const sp = Math.hypot(o.vx, o.vy); o.vx += dx / d * 40 * dt; o.vy += dy / d * 40 * dt; const s2 = Math.hypot(o.vx, o.vy); o.vx *= sp / s2; o.vy *= sp / s2; }   // 彈太久會慢慢往小貓這邊歪
          o.rot = (o.rot || 0) + 400 * dt * (o.kind === "ball" ? 1 : 0); }
        else if(D.mv === "zig"){ const nx = -dy / d, ny = dx / d, s = Math.cos(o.age * 7 + o.ph) * 90; o.x += (dx / d * D.v + nx * s) * dt; o.y += (dy / d * D.v + ny * s) * dt; o.flip = dx < 0; }
        else if(D.mv === "swoop"){
          if(o.dive > 0){ o.dive -= dt; o.ang += o.spin * 1.4 * dt; o.r = Math.max(70, o.r - 12 * dt); o.x = cx + Math.cos(o.ang) * o.r; o.y = cy + Math.sin(o.ang) * o.r; o.flip = Math.sin(o.ang) * o.spin > 0;
            if(o.dive < .45 && !o.warned){ o.warned = true; o.el.classList.add("aimS"); } }
          else { o.x += dx / d * D.v * 3.4 * dt; o.y += dy / d * D.v * 3.4 * dt; o.flip = dx < 0; } }
        else if(D.mv === "aim"){   // 靠近 → 停下來瞄準（閃）→ 衝刺
          o.rot = Math.atan2(dy, dx) * 57.3;
          if(o.st === 0){ if(d > Math.min(W, H) * .34){ o.x += dx / d * D.v * dt; o.y += dy / d * D.v * dt; } else { o.st = 1; o.t = .8; o.el.classList.add("aimS"); } }
          else if(o.st === 1){ o.t -= dt; if(o.t <= 0){ o.st = 2; o.el.classList.remove("aimS"); } }
          else { o.x += dx / d * D.v * 4.2 * dt; o.y += dy / d * D.v * 4.2 * dt; } }
        else if(D.mv === "hop"){ o.next -= dt;
          if(o.open){ const sp = 150 * SPD; o.x += dx / d * sp * dt; o.y += dy / d * sp * dt; if(o.next <= 0){ o.open = false; o.next = .55; o.el.innerHTML = ART.clip; tone(900, .03, { vol:.1, type:"square" }); } }
          else if(o.next <= 0){ o.open = true; o.next = .3; o.el.innerHTML = ART.clipo; }
          o.hid = o.open; o.flip = dx < 0; }
        else if(D.mv === "side"){ if(o.age % 1.3 < dt) o.dir = -o.dir; const nx = -dy / d, ny = dx / d; o.x += (nx * o.dir * 70 + dx / d * D.v) * dt; o.y += (ny * o.dir * 70 + dy / d * D.v) * dt; }
        else if(D.mv === "shell"){ const sp = D.v * (o.open ? 1 : .55); o.x += dx / d * sp * dt; o.y += dy / d * sp * dt; const op = (o.age + o.ph) % 1.8 > .85; if(op !== o.open){ o.open = op; o.el.innerHTML = op ? ART.clamo : ART.clam; } o.hid = !o.open; }
        else if(D.mv === "boss"){   // 魔王：慢慢繞著小貓靠近，一陣子吐東西出來；有的會衝刺、會噴墨
          o.ang += dt * .35; const dash = o.dashing > 0; o.dashing = (o.dashing || 0) - dt;
          o.r = Math.max(0, o.r - D.v * dt * (o.knock > 0 ? -2.5 : dash ? 9 : 1)); o.knock = (o.knock || 0) - dt;
          if(o.dashing <= 0 && o.back > 0){ o.r += 40 * dt; o.back -= dt; }
          o.x = cx + Math.cos(o.ang) * o.r; o.y = cy + Math.sin(o.ang) * o.r; o.flip = Math.cos(o.ang) > 0;
          o.cool -= dt; if(o.cool <= 0){ o.cool = D.every; const k = D.spit[(Math.random() * D.spit.length) | 0]; spawn(k, (o.ang * 57.3 + 180) % 360, o.x, o.y); o.el.classList.remove("spit"); void o.el.offsetWidth; o.el.classList.add("spit"); tone(220, .12, { to:440, vol:.12, type:"square" }); }
          if(D.dash){ o.dashT -= dt; if(o.dashT <= .6 && !o.warned){ o.warned = true; o.el.classList.add("aimS"); } if(o.dashT <= 0){ o.dashT = D.dash; o.warned = false; o.el.classList.remove("aimS"); o.dashing = .35; o.back = 1.2; tone(160, .25, { to:90, vol:.2, type:"sawtooth" }); } }
          if(D.ink){ o.inkT -= dt; if(o.inkT <= 0){ o.inkT = D.ink; ink(); } } }
        place(o);
      }
      function bossUi(){ if(!boss) return; const bar = el.querySelector("#nbBar"); if(bar) bar.style.width = Math.max(0, boss.hp / boss.D.hp * 100) + "%"; }
      // ---- 道具 ----
      function power(o){
        usedPow = true; kill(o, true); shards(o.x, o.y, o.D.col, 14, true);
        if(o.D.pow === "fish"){   // 金魚乾：貓拳旋風，畫面上的東西全部清掉
          SFX.coin && SFX.coin(); SFX.boom && SFX.boom(true); shake(true); F.classList.remove("flash"); void F.offsetWidth; F.classList.add("flash");
          fx(cx, cy - 70, "貓拳旋風！", "nbBig gold", 1000); setFace("happy"); faceHold = gt + 1;
          things.forEach(x => { if(x.dead || x.D.friend || x.D.pow) return; if(x.D.boss){ hurtBoss(x, 4); return; } kill(x, true); shards(x.x, x.y, x.D.col, 8); addCombo(); });
        } else {   // 鈴鐺：大家變慢 3 秒
          SFX.heart && SFX.heart(); slowUntil = gt + 3; F.classList.add("slow"); fx(cx, cy - 70, "時間變慢了…", "nbBig blue", 1000);
        }
      }
      function hurtBoss(o, dmg){ if(o.dead) return; o.hp -= dmg; o.hits += dmg; o.knock = .25; bossUi(); o.el.classList.remove("hurt"); void o.el.offsetWidth; o.el.classList.add("hurt"); shake(false);
        if(o.D.split && Math.floor((o.hits - dmg) / o.D.split) < Math.floor(o.hits / o.D.split) && o.hp > 0){ for(let i = 0; i < 2; i++) spawn("cuke", 0, o.x + (i ? 20 : -20), o.y); fx(o.x, o.y - 50, "生出來了！", "nbSay2", 700); }
        if(o.hp <= 0){ kill(o, true); shards(o.x, o.y, o.D.col, 30, true); SFX.boom && SFX.boom(true); shake(true); fx(cx, cy - 70, "打倒魔王！", "nbBig gold", 1200);
          things.forEach(x => { if(!x.dead && !x.D.friend) { kill(x, true); shards(x.x, x.y, x.D.col, 6); } }); boss = null; clear(); } }
      function fail(o){
        if(ended) return; ended = true; cancelAnimationFrame(raf);
        const fk = o.D.fate;
        if(!INF){ S.f[n] = (S.f[n] || 0) + 1; const e = el.querySelector("#nbF"); if(e) e.textContent = S.f[n]; }
        S.d[fk] = (S.d[fk] || 0) + 1; keep();
        SFX.miss && SFX.miss(); try{ navigator.vibrate && navigator.vibrate(80); }catch(e){}
        things.forEach(x => { if(x !== o && !x.dead) x.el.classList.add("freeze"); });
        scene(fk, o).then(() => { if(alive && !gone) INF ? endless(fk) : showEnd(false, fk); });
      }
      // ---- 下場小劇場 ----
      function scene(fk, o){
        CB.innerHTML = ""; F.classList.remove("slow"); if(intro) intro.remove(); F.querySelectorAll(".nbInk").forEach(x => x.remove());
        Wl.style.transformOrigin = `${cx}px ${cy}px`; Wl.classList.add("zoom");
        things.forEach(x => { if(x !== o && !x.dead && !(fk === "trip" && x.kind === "fly")) x.el.classList.add("fade"); });
        const say = (txt, at) => setTimeout(() => { if(alive && !gone) fx(cx, cy - 62, esc(txt), "nbSay", 2000); }, at);
        const side = o.x < cx ? -1 : 1, P_ = (cls, html, x, y, w) => { const d = document.createElement("div"); d.className = "nbProp " + cls; d.style.left = x + "px"; d.style.top = y + "px"; if(w) d.style.width = w + "px"; d.innerHTML = html; Wl.appendChild(d); return d; };
        let ms = 1900;
        const faceOf = { fly:"surprised", wet:"angry", wrap:"cry", suck:"surprised", foam:"cry", lick:"cry", vet:"cry", wake:"surprised", trip:"cry", ko:"cry", bump:"cry", peck:"surprised", shot:"cry", nail:"cry", pinch:"angry", wash:"surprised", snatch:"angry", clamp:"surprised", ride:"surprised", abduct:"surprised", flat:"cry" };
        setFace(faceOf[fk] || "cry");
        const F_ = FATE[fk];
        if(fk === "fly"){ o.el.classList.add("fade"); P_("p_cuke", ART.cuke, cx + side * 40, cy + 20, 46); C.classList.add("sc_fly"); SFX.jump && SFX.jump(); setTimeout(() => { tone(180, .2, { vol:.3, type:"square" }); shake(true); }, 1150); say(F_.say, 1300); ms = 2300; }
        else if(fk === "wet"){ P_("p_cloud", ART.cloud, cx, cy - 58, 70); C.classList.add("sc_wet"); SFX.splash && SFX.splash(); say(F_.say, 700); ms = 2100; }
        else if(fk === "wrap"){ o.el.classList.add("fade"); P_("p_yarn", ART.yarn, cx, cy, 82); C.classList.add("sc_wrap"); say(F_.say, 300); ms = 2100; }
        else if(fk === "suck"){ const v = P_("p_vac", ART.vac, cx + side * 78, cy - 6, 96); if(side < 0) v.classList.add("flip"); o.el.classList.add("fade"); C.style.setProperty("--sd", side); C.classList.add("sc_suck");
          tone(200, 1, { to:900, vol:.12, type:"sawtooth" }); setTimeout(() => alive && !gone && fx(cx + side * 78, cy - 66, esc(F_.say), "nbSay", 1400), 1200); ms = 2300; }
        else if(fk === "foam"){ [[-22,10],[20,12],[0,-8],[-30,-14],[28,-12],[-8,22],[12,-28],[-16,-30],[26,20]].forEach(([x, y], i) => { const b = P_("p_bub", ART.bub, cx + x, cy + y, 26 + (i % 3) * 8); b.style.animationDelay = i * .12 + "s"; }); say(F_.say, 1100); ms = 2200; }
        else if(fk === "lick"){ o.el.classList.add("fade"); const dg = P_("p_dog", ART.dog, cx + side * 60, cy, 80); if(side > 0) dg.classList.add("flip"); const tg = P_("p_tongue", "", cx + side * 28, cy + 8); tg.style.setProperty("--sd", side);
          for(let i = 0; i < 5; i++) setTimeout(() => alive && !gone && fx(cx + (Math.random() - .5) * 60, cy - 20, ART.heart, "nbHeart", 1100), 300 + i * 260); C.classList.add("sc_lick"); say(F_.say, 1100); ms = 2300; }
        else if(fk === "vet"){ o.el.classList.add("fade"); P_("p_cage", ART.cage, cx, cy, 96); setTimeout(() => { tone(140, .25, { vol:.3, type:"square" }); shake(true); }, 520); say(F_.say, 900); ms = 2200; }
        else if(fk === "wake"){ P_("p_spike", "", cx, cy + 4); C.classList.add("sc_wake"); o.el.classList.add("ringing"); for(let i = 0; i < 8; i++) tone(1300 + (i % 2) * 300, .06, { vol:.1, type:"square", delay:i * .07 }); say(F_.say, 250); ms = 2000; }
        else if(fk === "trip"){ o.el.classList.add("flyaway"); C.style.setProperty("--sd", side); C.classList.add("sc_trip"); setTimeout(() => { shake(false); tone(160, .15, { vol:.25, type:"square" });
            for(let i = 0; i < 3; i++){ const s = P_("p_star", ART.star, cx, cy - 30, 16); s.style.animationDelay = (-i * .33) + "s"; } }, 600); say(F_.say, 1000); ms = 2300; }
        else if(fk === "ko" || fk === "flat"){ o.el.classList.add("fade"); const b = P_(fk === "ko" ? "p_ballhit" : "p_meteor", ART[o.kind], cx, cy - 30, fk === "ko" ? 44 : 64);
          setTimeout(() => { shake(true); tone(120, .25, { vol:.3, type:"square" }); C.classList.add(fk === "flat" ? "sc_flat" : "sc_dizzy");
            for(let i = 0; i < 3; i++){ const s = P_("p_star", ART.star, cx, cy - 30, 16); s.style.animationDelay = (-i * .33) + "s"; } }, fk === "ko" ? 250 : 450); say(F_.say, 1000); ms = 2300; }
        else if(fk === "bump"){ const be = P_("p_beeorb", ART.bee, cx, cy - 30, 30); P_("p_lump", "", cx + 8, cy - 26); C.classList.add("sc_lick"); for(let i = 0; i < 4; i++) tone(240 + i * 20, .2, { vol:.06, type:"sawtooth", delay:i * .2 }); say(F_.say, 700); ms = 2200; }
        else if(fk === "peck" || fk === "snatch" || fk === "abduct"){ o.el.classList.add("fade");
          if(fk === "abduct"){ P_("p_ufo", ART.ufo, cx, cy - 110, 90); P_("p_beam", "", cx, cy - 34); }
          else P_("p_grab", ART[o.kind], cx, cy - 40, 60);
          C.classList.add(fk === "abduct" ? "sc_float" : "sc_carry"); setTimeout(() => tone(500, .6, { to:1200, vol:.1, type:"triangle" }), 300); say(F_.say, 500); ms = 2300; }
        else if(fk === "shot"){ o.el.classList.add("fade"); const nd = P_("p_needle", ART.needle, cx + side * 40, cy + 14, 56); if(side > 0) nd.classList.add("flip"); C.classList.add("sc_jump");
          setTimeout(() => { for(let i = 0; i < 6; i++) alive && !gone && fx(cx + (i % 2 ? 12 : -12), cy - 14, "", "nbTear", 900); tone(800, .3, { to:300, vol:.2, type:"triangle" }); }, 350); say(F_.say, 600); ms = 2200; }
        else if(fk === "nail"){ o.el.classList.add("fade"); P_("p_clipsnap", ART.clip, cx + side * 28, cy + 24, 34); for(let i = 0; i < 4; i++) setTimeout(() => { tone(1500, .03, { vol:.15, type:"square" }); alive && !gone && shards(cx + side * 24, cy + 26, ["#ffffff","#e9eef6"], 4); }, 200 + i * 220); C.classList.add("sc_wake"); say(F_.say, 1100); ms = 2200; }
        else if(fk === "pinch"){ o.el.classList.add("fade"); P_("p_crab", ART.crab, cx + 26, cy + 26, 40); C.classList.add("sc_jump"); setTimeout(() => shake(false), 200); say(F_.say, 300); ms = 2000; }
        else if(fk === "wash"){ const wv = P_("p_wave", ART.wave, cx - side * 200, cy + 6, 160); wv.style.setProperty("--sd", side); if(side > 0) wv.classList.add("flip"); setTimeout(() => C.classList.add("sc_wash"), 500); SFX.splash && SFX.splash(); say(F_.say, 1300); ms = 2300; }
        else if(fk === "clamp"){ o.el.classList.add("fade"); P_("p_clamhead", ART.clam, cx, cy - 22, 52); setTimeout(() => { tone(300, .1, { vol:.25, type:"square" }); shake(false); }, 300); say(F_.say, 900); ms = 2100; }
        else if(fk === "ride"){ o.el.classList.add("fade"); const rb = P_("p_robot", ART.robot, cx, cy + 30, 60); C.classList.add("sc_ride"); rb.classList.add("spin"); say(F_.say, 900); ms = 2300; }
        return new Promise(r => setTimeout(r, ms));
      }
      function clear(){
        if(ended) return; ended = true; cancelAnimationFrame(raf);
        things.forEach(o => { if(!o.dead){ kill(o, true); shards(o.x, o.y, o.D.col, 6); } });
        const first = S.c[n] == null; if(first || (S.f[n] || 0) < S.c[n]) S.c[n] = S.f[n] || 0;
        const st = 1 + (usedPow ? 0 : 1) + (maxCombo >= L.cb ? 1 : 0), before = S.st[n] || 0, gain = (first ? 10 : 0) + Math.max(0, st - before) * 5;
        S.st[n] = Math.max(before, st); S.ea += gain; S.fc += gain;
        if(n === S.lv && n < NLV) S.lv = n + 1;
        if(n === NLV) S.all = true;
        keep(); sync(); SFX.level && SFX.level(); setFace("love"); CB.innerHTML = "";
        for(let i = 0; i < 6; i++) setTimeout(() => alive && !gone && shards(cx + (Math.random() - .5) * 160, cy + (Math.random() - .5) * 160, ["#ffd04a","#ff9ec4","#7fd8c4","#9fd8ff"], 10, true), i * 140);
        setTimeout(() => { if(alive && !gone) showEnd(true, null, st, gain); }, 900);
      }
      function showEnd(win, fk, st, gain){
        const host = el.querySelector(".nbBox"); if(!host || gone) return;
        const box = document.createElement("div"); box.className = "m3End nbEnd";
        const fails = S.f[n] || 0, hint = !win && fails >= 3 && L.hint ? `<div class="nbHint">提示：${esc(L.hint)}</div>` : "";
        const nextW = n < NLV && n % 10 === 0 ? WORLDS[n / 10] : null;
        box.innerHTML = win
          ? `<div class="m3EndBox"><span class="nbEndCat">${catHtml("love")}</span><h3>${L.boss ? "打倒魔王了！" : "過關了！"}</h3>${stars(st, "big")}
              <div class="nbChk"><span class="on">過關</span><span class="${usedPow ? "" : "on"}">沒用道具</span><span class="${maxCombo >= L.cb ? "on" : ""}">連擊 ${maxCombo} / ${L.cb}</span></div>
              ${gain ? `<div class="nbGain"><i>${ART.coin}</i>＋${gain} 魚幣</div>` : ""}
              <div class="k">${fails ? `失敗了 ${fails} 次才過，辛苦了` : "一次就過，好厲害！"}</div>
              ${nextW ? `<div class="nbNew">新世界「${esc(nextW.n)}」打開了！${n === ENDLESS_AT ? "無盡模式也打開了！" : ""}</div>` : ""}
              ${n < NLV ? `<button class="btn" id="nbNext">下一關</button>` : `<div class="k">50 關全破！你是最強的喵！</div>`}${st < 3 ? `<button class="btn sub" id="nbAgain">再挑戰三顆星</button>` : ""}<button class="btn sub" id="nbLob">回到選關</button></div>`
          : `<div class="m3EndBox"><i class="nbFaI">${ART[FATE[fk].art]}</i><h3>${esc(FATE[fk].n)}</h3><div class="k">${esc(FATE[fk].t)}</div><div class="k">這關失敗 ${fails} 次・這次連擊 ${maxCombo}</div>${S.d[fk] === 1 ? `<div class="nbNew">新的下場收進圖鑑了！（${FATE_IDS.filter(k => S.d[k]).length} / ${FATE_IDS.length}）</div>` : ""}${hint}
              <button class="btn" id="nbAgain">再來一次</button><button class="btn sub" id="nbLob">回到選關</button></div>`;
        host.appendChild(box);
        const go = (id, f) => { const b = box.querySelector(id); if(b) b.addEventListener("click", () => { SFX.tap(); f(); }); };
        go("#nbAgain", () => play(n)); go("#nbNext", () => { if(n % 10 === 0) wTab = n / 10; play(n + 1); }); go("#nbLob", lobby);
      }
      function endless(fk){
        const host = el.querySelector(".nbBox"); if(!host || gone) return;
        const secs = Math.min(600, gt), rec = Math.round(secs * 10) > S.ib, gain = Math.floor(secs / 10); S.ip++; S.ea += gain; S.fc += gain; if(rec){ S.ib = Math.round(secs * 10); S.ic = maxCombo; S.inf = S.ib / 10; } keep(); sync();
        const box = document.createElement("div"); box.className = "m3End nbEnd";
        box.innerHTML = `<div class="m3EndBox">${fk ? `<i class="nbFaI">${ART[FATE[fk].art]}</i><h3>${esc(FATE[fk].n)}</h3>` : `<h3>結束了</h3>`}<div class="m3Big2">${secs.toFixed(1)} 秒</div>
          <div class="k">${rec ? "新紀錄！" : `最久 ${S.inf.toFixed(1)} 秒`}・最高連擊 ${maxCombo}</div>${gain ? `<div class="nbGain"><i>${ART.coin}</i>＋${gain} 魚幣</div>` : ""}<button class="btn" id="nbAgain">再來一次</button><button class="btn sub" id="nbLob">回到選關</button></div>`;
        host.appendChild(box);
        box.querySelector("#nbAgain").addEventListener("click", () => { SFX.tap(); play(0); }); box.querySelector("#nbLob").addEventListener("click", () => { SFX.tap(); lobby(); });
      }
      F.addEventListener("pointerdown", e => {
        if(ended) return; e.preventDefault();
        const r = F.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
        fx(x, y, pawArt(S.eq.paw), "nbPaw", 260);
        let best = null, bd = 1e9;
        things.forEach(o => { if(o.dead || o.wait > 0) return; const dd = Math.hypot(o.x - x, o.y - y); if(dd < o.D.s * .55 + 16 && dd < bd){ bd = dd; best = o; } });
        if(!best){ if(combo >= 3) fx(x, y - 16, "斷了", "nbMiss", 600); combo = 0; comboUi(); tone(240, .05, { vol:.08, type:"triangle" }); return; }
        if(best.D.friend){ fail(best); return; }
        if(best.D.pow){ power(best); return; }
        if(best.hid){ fx(x, y - 16, best.D.mv === "blink" ? "看不到！" : "噹！點不到", "nbMiss", 600); tone(1200, .04, { vol:.1, type:"square" }); return; }
        if(best.D.boss){ hurtBoss(best, 1); addCombo(); tone(300 + Math.random() * 80, .06, { vol:.2, type:"square" }); return; }
        best.hp--; SFX.hit ? SFX.hit() : SFX.tap();
        if(best.hp > 0){ best.el.classList.remove("hurt"); void best.el.offsetWidth; best.el.classList.add("hurt"); shards(best.x, best.y, best.D.col, 4);
          const dx = best.x - cx, dy = best.y - cy, d = Math.hypot(dx, dy) || 1; best.x += dx / d * 26; best.y += dy / d * 26; if(best.vx){ const sp = Math.hypot(best.vx, best.vy); best.vx = dx / d * sp; best.vy = dy / d * sp; } place(best); fx(best.x, best.y - best.D.s / 2 - 6, `還有 ${best.hp} 下`, "nbHp", 500); return; }
        kill(best, true); shards(best.x, best.y, best.D.col, best.D.hp > 1 ? 14 : 9, best.D.hp > 1); if(best.D.hp > 1) shake(false);
        addCombo();
        if(best.D.split) for(let i = 0; i < best.D.split; i++) spawn("mini", 0, best.x + (i - 1) * 14, best.y + (i % 2 ? 10 : -8));
      });
      function tick(now){
        if(ended) return;
        if(!t0){ t0 = now; last = now; }
        const rdt = Math.min(.05, (now - last) / 1000); last = now;
        const slow = gt < slowUntil; if(!slow) F.classList.remove("slow");
        const dt = rdt * (slow ? .35 : 1); gt += rdt;
        if(gt < introT){ raf = requestAnimationFrame(tick); return; }   // 新東西介紹的時候先等一下
        const lt = gt - introT;
        if(F.clientWidth !== W || F.clientHeight !== H){ W = F.clientWidth; H = F.clientHeight; cx = W / 2; cy = H / 2; }
        while(idx < L.plan.length && L.plan[idx][0] <= lt){ const [, k, a] = L.plan[idx++]; if(T[k].boss && boss) continue; spawn(k, a); }
        let near = 1e9;
        for(const o of things){ if(o.dead) continue; step(o, dt); if(o.dead || o.wait > 0) continue;
          if(o.D.friend || o.D.pow) continue;
          const d = Math.hypot(o.x - cx, o.y - cy); near = Math.min(near, d - o.D.s * .32);
          if(d < 22 + o.D.s * .32){ fail(o); return; } }
        for(let i = things.length - 1; i >= 0; i--) if(things[i].dead && !things[i].el.isConnected) things.splice(i, 1);
        if(gt > faceHold) setFace(near < 70 ? "surprised" : "normal");
        const tm = el.querySelector("#nbTm");
        if(INF && lt >= 600){ ended = true; cancelAnimationFrame(raf); gt = lt; endless(); return; }
        if(INF){ if(tm) tm.textContent = lt.toFixed(1) + " 秒"; const bar = el.querySelector("#nbBar"); if(bar) bar.style.width = Math.min(100, lt / Math.max(10, S.inf) * 100) + "%"; }
        else if(L.boss){ bossUi(); }
        else { const left = Math.max(0, L.dur - lt), bar = el.querySelector("#nbBar"); if(bar){ bar.style.width = (left / L.dur * 100) + "%"; bar.classList.toggle("low", left < 3); }
          if(lt >= L.dur){ clear(); return; } }
        raf = requestAnimationFrame(tick);
      }
      raf = requestAnimationFrame(tick);
      window.__nbDbg = { spawn, fail: k => { const o = spawn(k, 0); o.wait = 0; o.x = cx + 40; o.y = cy; place(o); fail(o); } };   // 測試用
      stopGame = () => { ended = true; gone = true; cancelAnimationFrame(raf); };
    }

    this._stop = () => { alive = false; stopGame(); sync(); };
    lobby();
    ctx.getState(KEY).then(r => { if(!alive || !r) return; const lv0 = S.lv; merge(r.state); if(S.lv > lv0) wTab = -1; try{ localStorage.setItem(LK, JSON.stringify(S)); }catch(e){} if(el.querySelector(".nbLob") && el.querySelector(".nbWTabs")) lobby(); }).catch(() => {});
  },
  unmount(){ if(this._stop) this._stop(); },
});
if(window.GameArt) window.GameArt.nobump = () => `<span class="gaL" style="left:30%;bottom:4%;width:42%">${Pix.sprite("orange","surprised")}</span><span class="gaL" style="left:2%;top:10%;width:34%;transform:rotate(-20deg)">${ART.cuke}</span><span class="gaL" style="right:4%;top:6%;width:22%">${ART.drop}</span><span class="gaL" style="right:2%;bottom:14%;width:26%">${ART.bee}</span>`;
window.__nobump = { LV, T, FATE, ART, WORLDS, HAT, PAWFX };
})();

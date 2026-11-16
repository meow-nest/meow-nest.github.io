// 我們的貓：家具、牆壁地板、貓咪飾品。
// 兩種拿法：① 成就解鎖（兩個人一起玩其他遊戲達成條件）② 用「貓幣」買（玩接小魚乾小遊戲賺，兩個人共用）
(function(){
const O = "#5a3b2e";
const px = (rows, pal) => { pal = Object.assign({ O }, pal); const w = Math.max(...rows.map(r=>r.length)), h = rows.length; let r = "";
  rows.forEach((row,y)=>[...row].forEach((c,x)=>{ if(pal[c]) r += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${pal[c]}"/>`; }));
  return `<svg viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg">${pxC(r)}</svg>`; };

// colour families: [name, main, dark]
const C = {
  pink:["粉紅","#f7a7b8","#e5486a"], blue:["天空藍","#9fd0f5","#4a90d6"], mint:["薄荷","#a8e6c4","#3fae74"], yellow:["檸檬黃","#ffe08a","#e8a920"],
  purple:["薰衣草","#cdb4f0","#8a5cd0"], orange:["橘子","#ffc38a","#e9822f"], gray:["灰色","#d6d6de","#8a8a99"], red:["紅色","#f28b82","#c9372c"],
  brown:["咖啡","#d9a066","#8a5a2e"], white:["白色","#ffffff","#c9c2b8"], black:["黑色","#6a6474","#2c2833"], navy:["海軍藍","#5b78c7","#2f437d"],
};
const FIX = { W:"#ffffff", Y:"#ffd36b", K:"#f0708d", G:"#5cb87a", E:"#2b1d18", D:"#3a2a28", S:"#bfe3ff", P:"#e98a5a", U:"#6fb7e8", R:"#e5486a", N:"#c98b4f", V:"#9b6fd6", Q:"#fff3e0", L:"#ffe9a8" };

const A = {}, FR = {}, ITEMS = [];
const add = (it, rows, pal) => { if(rows) A[it.id] = [rows, Object.assign({}, FIX, pal||{})]; if(it.fr){ FR[it.id] = it.fr; delete it.fr; } ITEMS.push(it); };
// a family of colour variants of one shape
const fam = (base, name, k, slot, cols, price, rows, extra) => cols.forEach(c=>add(Object.assign({ id:base+"_"+c, k, slot, n:C[c][0]+name, price, fam:base }, extra||{}), rows, { A:C[c][1], B:C[c][2] }));

/* ======================= achievement items (original set) ======================= */
const ach = (id, k, slot, n, need, ok, p, rows, pal, extra) => add(Object.assign({ id, k, slot, n, need, ok, p }, extra||{}), rows, pal);
ach("scratch","f","floorL","貓抓板","一開始就有",m=>true,null,["OOOOOOOO","OKKKKKKO","OOOOOOOO","..OWWO..","..OSSO..","..OWWO..","..OSSO..","..OWWO..","..OSSO..","..OWWO..","OOOOOOOO","OKKKKKKO","OOOOOOOO"],{ K:"#f7a7b8", W:"#e6c48f", S:"#c9a46a" });
ach("box","f","floorR","紙箱","一開始就有",m=>true,null,["..OOOO..OOOO..",".OYYYYO.OYYYYO","OOOOOOOOOOOOOO","OYYYYYYYYYYYYO","OYYYYGGGGYYYYO","OYYYYYYYYYYYYO","OYYYYYYYYYYYYO","OOOOOOOOOOOOOO"],{ Y:"#d9a066", G:"#b07d45" });
ach("tree","f","floorL","貓跳台","貓咪成長值加起來 30",m=>m.exp>=30,m=>m.exp/30,["OOOOOOOO........","OKKKKKKO........","OOOOOOOO........","...OSO..........","...OSO....OOOOOO","...OSO....OKKKKO","...OSO....OOOOOO","...OSO......OSO.","...OSO......OSO.","OOOOOOOOOOOOOOOO","OKKKKKKKKKKKKKKO","OOOOOOOOOOOOOOOO"],{ K:"#a9d4f5", S:"#c9a46a" },{ u:5.2 });
ach("beanbag","f","floorL","懶骨頭","默契大考驗答對 15 題",m=>m.moqi>=15,m=>m.moqi/15,["....OOOOOO....","..OOPPPPPPOO..",".OPPPPWPPPPPO.","OPPPPPPPPPPPPO","OPPPPPPPPPPPPO","OPPPPPPPPPPPPO",".OOOOOOOOOOOO."],{ P:"#f6b06a", W:"#ffd8a8" });
ach("throne","f","floorL","貓咪王座","有一隻長大成貓咪大王",m=>m.stage>=4,m=>m.stage/4,["O....OO....O","OYO.OYYO.OYO","OYYOYYYYOYYO","OYYYYKKYYYYO","OYYYKKKKYYYO","OYYYYYYYYYYO","OOOOOOOOOOOO","OKKKKKKKKKKO","OKKKKKKKKKKO","OOOOOOOOOOOO","OYO......OYO","OOO......OOO"],{ Y:"#ffcf4a", K:"#e5486a" });
ach("plant","f","floorR","小盆栽","早安晚安一起打卡 5 次",m=>m.daily>=5,m=>m.daily/5,["....GG.....","..GG.GG.G..",".G.GGG.GG..","..GGGGG.G..","....G.GG...","...OOOOO...","...OPPPO...","...OPPPO...","....OOO...."]);
ach("tank","f","floorR","魚缸","釣魚圖鑑收集 60 種",m=>m.dex>=60,m=>m.dex/60,["OOOOOOOOOOOOOO","OBBBBBBBBBBBBO","OBBBWBBBBBBBBO","OBBYYOBBBBBBBO","OBBBYYBBBBBKBO","OBBBBBBBBBKKBO","OBGBBBBGBBBBBO","OGGGBBGGGBBGGO","OOOOOOOOOOOOOO",".ONO......ONO."],{ B:"#bfe3ff", Y:"#ffb04a" });
ach("easel","f","floorR","畫架","你畫我猜答對 10 題",m=>m.draw>=10,m=>m.draw/10,["...OOOOOOO...","...OWWWWWO...","...OWKKWWO...","...OWWUUWO...","...OWWWWWO...","...OOOOOOO...","....O...O....","...O.....O...","..O.......O.."]);
ach("frame","f","wallL","愛心相框","相簿放了 10 張照片",m=>m.photos>=10,m=>m.photos/10,["OOOOOOOOOO","OYYYYYYYYO","OYOOOOOOYO","OYOKOOKOYO","OYOKKKKOYO","OYOOKKOOYO","OYOOOOOOYO","OYYYYYYYYO","OOOOOOOOOO"],{ Y:"#d9a066" });
ach("clock","f","wallL","小時鐘","領養滿 7 天",m=>m.days>=7,m=>m.days/7,["..OOOOO..",".OWWWWWO.","OWWWOWWWO","OWWWOWWWO","OWWWOOOWO","OWWWWWWWO",".OWWWWWO.","..OOOOO.."]);
ach("lights","f","wallR","星星燈串","早安或晚安連續 7 天",m=>m.streak>=7,m=>m.streak/7,["OOOOOOOOOOOOOOOOOOOO",".Y...K...U...Y...K..",".Y...K...U...Y...K..","...O...O...O...O....","...U...Y...K...U....","...U...Y...K...U...."],null,{ u:7.5 });
ach("flags","f","wallR","彩色小旗子","釣魚圖鑑收集 30 種",m=>m.dex>=30,m=>m.dex/30,["OOOOOOOOOOOOOOOOO","OUO.OKO.OYO.OGO.O",".O...O...O...O..."],null,{ u:9.4 });
ach("flower","f","window","窗台小花","養兩隻貓",m=>m.cats>=2,m=>m.cats/2,[".K.Y.K.","KYKYKYK",".K.Y.K.","GGGGGGG","OOOOOOO"],null,{ u:6.3 });
ach("doll","f","window","晴天娃娃","早安晚安一起打卡 20 次",m=>m.daily>=20,m=>m.daily/20,["..OOO..",".OWWWO.","OWEWEWO",".OWWWO.","..OOO..",".OWWWO.","OWWWWWO","O.O.O.O"],null,{ u:3 });
// accessories
ach("bow","a","neck","紅色蝴蝶結","一開始就有",m=>true,null,["OO...OO","OKO.OKO","OKKOKKO","OKO.OKO","OO...OO"],{ K:"#e5486a" });
ach("bell","a","neck","鈴鐺項圈","貓咪成長值加起來 10",m=>m.exp>=10,m=>m.exp/10,["OOOOOOOOO","ORRRRRRRO","OOOOOOOOO","...OYO...","..OYYYO..","..OOOOO.."],null,{ y:55 });
ach("scarf","a","neck","小圍巾","早安或晚安連續 14 天",m=>m.streak>=14,m=>m.streak/14,["OOOOOOOOOO","OBBWBBWBBO","OOOOOOOBBO",".......OBO",".......OOO"],{ B:"#6fb7e8" },{ y:55 });
ach("pearls","a","neck","珍珠項鍊","默契大考驗答對 50 題",m=>m.moqi>=50,m=>m.moqi/50,["OW.......WO",".OW.....WO.","..OWOWOWO..","....OKO....",".....O....."],{ K:"#f7a7b8" },{ y:55 });
ach("straw","a","hat","小草帽","早安晚安一起打卡 10 次",m=>m.daily>=10,m=>m.daily/10,["...OOOO...","..OYYYYO..","..ORRRRO..","OOOYYYYOOO","OYYYYYYYYO","OOOOOOOOOO"],{ Y:"#f0cf7a" });
ach("crown","a","hat","小皇冠","有一隻長大成胖胖貓",m=>m.stage>=3,m=>m.stage/3,["O..O..O","OO.O.OO","OYOYOYO","OYYYYYO","OYKYKYO","OOOOOOO"],{ Y:"#ffcf4a", K:"#e5486a" });
ach("wizard","a","hat","魔法帽","你畫我猜答對 20 題",m=>m.draw>=20,m=>m.draw/20,[".....OO..",".....OVO.","....OVVO.","...OVYVO.","...OVVVVO","..OVVVVVO","OOOOOOOOO"]);
ach("phones","a","hat","耳機","釣魚圖鑑收集 100 種",m=>m.dex>=100,m=>m.dex/100,["....OOOOOOOOOOO....","...O...........O...","..O.............O..",".OKO...........OKO.",".OKO...........OKO.",".OOO...........OOO."],null,{ hb:52 });
ach("santa","a","hat","聖誕帽","領養滿 30 天",m=>m.days>=30,m=>m.days/30,["......OO.","....OOWWO","..OORRO..",".ORRRRO..","ORRRRRRO.","OWWWWWWO.","OOOOOOOO."]);
ach("wreath","a","hat","花圈","一起和好過 1 次",m=>m.makeup>=1,m=>m.makeup,[".K.Y.K.Y.K.","KYKGKYKGKYK","GGGGGGGGGGG",".G.......G."]);
// achievement rugs
ach("rugHeart","r","rug","愛心地毯","默契大考驗答對 30 題",m=>m.moqi>=30,m=>m.moqi/30,null,null,{ bg:"radial-gradient(circle at 30% 50%,#fff6 0 6px,transparent 7px),radial-gradient(circle at 70% 50%,#fff6 0 6px,transparent 7px),#f0708d" });
ach("rugRainbow","r","rug","彩虹地毯","一起和好過 1 次",m=>m.makeup>=1,m=>m.makeup,null,null,{ bg:"linear-gradient(90deg,#f0708d 0 17%,#ffb04a 0 34%,#ffd36b 0 50%,#5cb87a 0 67%,#6fb7e8 0 84%,#9b6fd6 0)" });

/* ======================= shop: furniture ======================= */
fam("cushion","坐墊","f","floorM",["pink","blue","mint","yellow","purple","orange"],30,["..OOOOOOOO..",".OAAAAAAAAO.","OAAABAABAAAO","OAAAAAAAAAAO",".OOOOOOOOOO."]);
fam("bed","貓窩","f","floorM",["pink","blue","mint","yellow","purple","gray"],60,[".OOOOOOOOOOOO.","OAAAAAAAAAAAAO","OABQQQQQQQQBAO","OABQQQQQQQQBAO","OAAAAAAAAAAAAO",".OOOOOOOOOOOO."]);
fam("yarn","毛線球","f","floorM",["pink","blue","mint","yellow","purple","red"],20,["..OOOO..",".OABAAO.","OAABBAAO","OABAABAO","OAABAAAO",".OAAAAO.","..OOOO.O"]);
fam("tunnel","貓隧道","f","floorM",["pink","blue","mint","yellow","purple"],90,["...OOOOOOOO...","..OAABAABAAO..",".OAODDDDDDOAO.","OAAODDDDDDOAAO","OBAODDDDDDOABO","OAAODDDDDDOAAO","OOOOOOOOOOOOOO"]);
fam("sofa","小沙發","f","floorL",["pink","blue","mint","yellow","purple"],180,["..OOOOOOOOOOOO..",".OAAAAAAAAAAAAO.",".OABAAAAAAAABAO.","OOOOOOOOOOOOOOOO","OAOAAAAOOAAAAOAO","OAOAAAAOOAAAAOAO","OAOOOOOOOOOOOOAO","OOOOOOOOOOOOOOOO",".OO..........OO."]);
fam("bigbed","雙人床","f","floorR",["pink","blue","mint","purple"],260,["OOO...............","OAO...............","OAOOOOOOOOOOOOOOOO","OAOQQOBBBBBBBBBBBO","OAOQQOBBBBBBBBBBBO","OAOOOOOOOOOOOOOOOO","OAAAAAAAAAAAAAAAAO","OOOOOOOOOOOOOOOOOO","OO..............OO"]);
fam("lamp","立燈","f","floorR",["pink","yellow","mint","purple"],80,[".OOOOOO.","OAAAAAAO","OAWAAAAO","OOOOOOOO","...OO...","...OO...","...OO...","...OO...","...OO...","...OO...","...OO...","..OOOO..",".OOOOOO."]);
fam("table","小茶几","f","floorM",["brown","white","pink"],70,["....OOOO......","....OKWO......","OOOOOOOOOOOOOO","OAAAAAAAAAAAAO","OOOOOOOOOOOOOO",".OBO......OBO.",".OBO......OBO.",".OOO......OOO."]);
fam("shelf","書櫃","f","floorL",["brown","white"],150,["OOOOOOOOOOOO","OAKKGGYYUUAO","OAKKGGYYUUAO","OOOOOOOOOOOO","OAYYUUKKGGAO","OAYYUUKKGGAO","OOOOOOOOOOOO","OAGGRRUUYYAO","OAGGRRUUYYAO","OOOOOOOOOOOO","OAO......OAO","OOO......OOO"]);
fam("tv","小電視","f","floorR",["pink","mint","gray"],160,["...O....O.....","....O..O......","OOOOOOOOOOOOOO","OAAAAAAAAAAAAO","OASSSSSSSSSSAO","OASWSSSSSSSSAO","OASSSSSSSSSSAO","OASSSSSSSSSSAO","OAAAAAAAAAAAAO","OOOOOOOOOOOOOO","..OO......OO.."]);
fam("fridge","小冰箱","f","floorR",["pink","mint","blue"],200,["OOOOOOOOOO","OAAAAAAAAO","OAAAAAAOAO","OAAAAAAOAO","OAAAAAAAAO","OOOOOOOOOO","OAAAAAAAAO","OAAAAAAOAO","OAAAAAAOAO","OAAAAAAOAO","OAAAAAAAAO","OAAAAAAAAO","OOOOOOOOOO",".OO....OO."]);
fam("piano","小鋼琴","f","floorL",["black","white"],320,["OOOOOOOOOOOOOOOO","OBBBBBBBBBBBBBBO","OBBBBBBBBBBBBBBO","OOOOOOOOOOOOOOOO","OWEWEWWEWEWEWWWO","OWWWWWWWWWWWWWWO","OOOOOOOOOOOOOOOO","OBBBBBBBBBBBBBBO","OBO..........OBO","OBO..........OBO","OOO..........OOO"]);
fam("radio","收音機","f","floorM",["red","mint","yellow"],70,["........O...",".......O....","OOOOOOOOOOOO","OAAAAAAAAAAO","OAOOOOAAEEAO","OAOWWOAAEEAO","OAOOOOAAAAAO","OAAAAAAAAAAO","OOOOOOOOOOOO"]);
fam("balloon","氣球","f","floorM",["pink","blue","mint","yellow","purple","red"],25,["..OOO..",".OAAAO.","OAWAAAO","OAAAAAO","OAAAAAO",".OAAAO.","..OBO..","...O...","...O...","..O....","...O...","...O...","...O..."]);
fam("gift","禮物盒","f","floorM",["pink","blue","mint","yellow","purple"],40,["..OO.OO..",".OBBOBBO.","OOOOOOOOO","OAAABAAAO","OAAABAAAO","OAAABAAAO","OAAABAAAO","OOOOOOOOO"]);
fam("teddy","熊熊玩偶","f","floorM",["brown","white","pink"],90,[".OO....OO.","OAAO..OAAO","OAOOOOOOAO",".OAAAAAAO.",".OAEAAEAO.",".OAAEEAAO.","..OOOOOO..",".OAAAAAAO.","OAAQQQQAAO","OAAQQQQAAO",".OOOOOOOO."]);
fam("mouse","玩具老鼠","f","floorM",["gray","pink","white"],15,[".OO.......","OKOOOO....","OAAAAAO...","OAEAAAAOOO",".OOOOOO..."]);
fam("hammock","窗邊吊床","f","window",["pink","blue","mint","yellow"],120,["O............O",".O..........O.","..O........O..","..OAAAAAAAAO..","...OAABAABO...","....OOOOOO...."]);
fam("tulip","鬱金香","f","floorR",["pink","red","yellow","purple"],45,[".A.A..A.A.",".AAA..AAA.",".AAA..AAA.","..G....G..","..G...G...","...G.G....","..OOOOOO..","..OPPPPO..","..OPPPPO..","...OOOO..."]);
fam("posterH","愛心海報","f","wallM",["white","yellow","blue"],50,["OOOOOOOOOO","OAAAAAAAAO","OAKKAAKKAO","OAKKKKKKAO","OAKKKKKKAO","OAAKKKKAAO","OAAAKKAAAO","OAAAAAAAAO","OAAAAAAAAO","OOOOOOOOOO"]);
fam("posterS","星星海報","f","wallM",["navy","purple","pink"],50,["OOOOOOOOOO","OAAAAAAAAO","OAAAYYAAAO","OAAAYYAAAO","OYYYYYYYYO","OAYYYYYYAO","OAAYYYYAAO","OAYYAAYYAO","OAYAAAAYAO","OOOOOOOOOO"]);
fam("wshelf","牆上層板","f","wallM",["brown","white"],60,["....OOO.....OO..","...OKKKO...OGGO.","...OKKKO..OGGGGO","OOOOOOOOOOOOOOOO","OAAAAAAAAAAAAAAO","OOOOOOOOOOOOOOOO"]);
fam("cake","蛋糕","f","floorM",["pink","brown","mint"],55,[".....K......",".....O......","..OOOOOOOO..",".OWWWWWWWWO.",".OKWKWKWKWO.","OOOOOOOOOOOO","OAAAAAAAAAAO","OWWWWWWWWWWO","OAAAAAAAAAAO","OOOOOOOOOOOO"]);
fam("curtain","窗簾","f","window",["pink","blue","mint","yellow"],70,["OOOOOOOOOOOOOOOOOO","OAAAO........OAAAO","OABAO........OABAO","OAAAO........OAAAO","OABAO........OABAO","OAAAO........OAAAO",".OAO..........OAO.","..O............O.."],{},);
// one-offs
const one = (id, k, slot, n, price, rows, pal, extra) => add(Object.assign({ id, k, slot, n, price }, extra||{}), rows, pal);
one("cactus","f","floorR","仙人掌",35,["...O...","..OGO..","O.OGO.O","OGOGOGO","OGOGOGO",".OGGGO.","..OGO..",".OOOOO.",".OPPPO.",".OPPPO.","..OOO.."]);
one("sunflower","f","floorR","向日葵",45,["..YYYY..",".YYNNYY.",".YNNNNY.",".YYNNYY.","..YYYY..","...OG...","..GOG...","...OGG..","...OG...",".OOOOOO.",".OPPPPO.",".OPPPPO.","..OOOO.."]);
one("mirror","f","floorL","全身鏡",110,["..OOOOO..",".OYYYYYO.","OYSSSSSYO","OYSWSSSYO","OYSSWSSYO","OYSSSSSYO","OYSSSSSYO","OYSSSSSYO","OYSSSSSYO","OYYYYYYYO",".OOOOOOO.","..O...O..",".OO...OO."],{ Y:"#d9a066" });
one("moon","f","wallM","月亮小夜燈",70,["..OOOO...",".OYYYYO.Y","OYYYOO...","OYYO.....","OYYO...Y.","OYYYOO...",".OYYYYO..","..OOOO..."]);
one("xmas","f","floorL","聖誕樹",220,[".....Y.....","....OGO....","...OGGGO...","..OGKGGGO..","...OGGGO...","..OGGGYGO..",".OGGGGGGGO.","..OGKGGGO..",".OGGGGGYGO.","OGGYGGGGKGO","OOOOOOOOOOO","....ONO....","...OOOOO...","...OKKKO...","...OOOOO..."]);
one("pumpkin","f","floorM","南瓜燈",60,["....OGO...","..OOOOOO..",".OAAOAAAO.","OAEAOAEAAO","OAAAOAAAAO","OAEEEEEAAO",".OAAOAAAO.","..OOOOOO.."],{ A:"#f29a3c" });
one("snowman","f","floorR","雪人",90,["...OOOO...","..ODDDDO..",".OOOOOOOO.","..OWWWWO..",".OWEWWEWO.",".OWWPPWWO.","..OWWWWO..",".ORRRRRRO.","OWWWWWWWWO","OWWWEWWWWO","OWWWWWWWWO",".OWWWEWWO.","..OOOOOO.."]);
one("duck","f","floorM","小鴨鴨",30,["..OOO....",".OYYYO...",".OYEYPP..",".OYYYOO..","OOYYYYOOO","OYYYYYYYO",".OYYYYYO.","..OOOOO.."]);
one("fishbowl","f","floorM","金魚缸",80,["..OOOOOO..",".OSSSSSSO.","OSSSSSSSSO","OSSPPSSSSO","OSSSPPOSSO","OSSSSSSSWO",".OSGSSGSO.","..OOOOOO.."]);
one("catclock","f","wallM","貓咪時鐘",90,[".O.....O.","OKO...OKO","OOOOOOOOO","OWWWOWWWO","OWWWOWWWO","OWWWOOOWO","OWWWWWWWO",".OWWWWWO.","..OOOOO..","....O....","...O.O..."]);
one("rainbowW","f","wallM","彩虹壁貼",65,["...OOOOOOO...","..OKKKKKKKO..",".OKYYYYYYYKO.","OKYGGGGGGGYKO","OKYGO...OGYKO","OKYG.....GYKO"]);
one("stars","f","wallR","星星壁貼",40,["..Y.......Y..",".YYY.....YYY.","..Y...Y...Y..","......YY.....","..Y..YYY.....",".YYY..Y....Y.","..Y.......YYY"],{},{ u:6 });
one("bunting","f","wallR","愛心旗子",55,["OOOOOOOOOOOOOOOOOOOO",".KK.K.WW.W.KK.K.WW.W",".KKKK.WWWW.KKKK.WWWW","..KK...WW...KK...WW.","...K....W....K....W."],{},{ u:7.5 });
one("fan","f","floorR","電風扇",75,["..OOOOO..",".OSOSOSO.","OSSSOSSSO","OOOOOOOOO","OSSSOSSSO",".OSOSOSO.","..OOOOO..","....O....","....O....","..OOOOO.."]);
one("catpic","f","wallM","貓咪掛畫",85,["OOOOOOOOOOOO","ONNNNNNNNNNO","ONSSSSSSSSNO","ONSO.SSO.SNO".replace(/\./g,"S"),"ONSOOOOOOSNO","ONSOEOOEOSNO","ONSSOOOOSSNO","ONGGGGGGGGNO","ONNNNNNNNNNO","OOOOOOOOOOOO"]);
one("plant2","f","floorL","大盆栽",95,["..G..G..G..",".GGG.G.GGG.","GG.GGGGG.GG","...GGGGG...",".GG..G..GG.","GG...G...GG",".....G.....","...OOOOO...","..OPPPPPO..","..OPPPPPO..","...OPPPO...","...OOOOO..."]);
one("aquariumBig","f","floorL","大水族箱",380,["OOOOOOOOOOOOOOOOOO","OSSSSSSSSSSSSSSSSO","OSSSWSSSSSSSKKSSSO","OSSYYOSSSSSSSKKOSO","OSSSYYSSSSPPSSSSSO","OSSSSSSSSSSPPOSSSO","OSGSSSGSSSSSSSGSSO","OGGGSSGGGSUUSGGGSO","OOOOOOOOOOOOOOOOOO","ONNNNNNNNNNNNNNNNO","ONO............ONO","OOO............OOO"]);
one("castle","f","floorL","貓咪城堡",450,["O.O.O......O.O.O","OOOOO......OOOOO","OKKKO......OKKKO","OKOKOOOOOOOOKOKO","OKKKKKKKKKKKKKKO","OKKKKKOOOOKKKKKO","OKKKKODDDDOKKKKO","OKKKKODDDDOKKKKO","OKKKKODDDDOKKKKO","OOOOOOOOOOOOOOOO"],{ K:"#f7c6d2" });

/* ======================= shop: 會動的、可以互動的家具 =======================
   fx：frames 自動換格、spin 旋轉、rock 搖、slide 來回跑、sway 輕輕晃；tap：點一下的效果；fr：多出來的動畫格 */
one("hangchair","f","floorL","吊籃椅",240,["....OOOO....","...O....O...","..O......O..",".OOOOOOOOOO.","OAAAAAAAAAAO","OAQQQQQQQQAO","OAQKQQQQKQAO","OAQQQQQQQQAO",".OAAAAAAAAO.","..OOOOOOOO..",".....OO.....","...OOOOOO..."],{"A":"#e6c48f","Q":"#fff3e0"},{});
one("desk","f","floorR","電腦書桌",280,["..OOOOOOOO....","..OSSSSSSO....","..OSWSSSSO..O.","..OSSSSSSO.OGO","..OOOOOOOO.OGO","....OOOO...OPO","OOOOOOOOOOOOOO","ONNNNNNNNNNNNO","OOOOOOOOOOOOOO","ONO.OWWWO..ONO","ONO.OWKWO..ONO","ONO.OOOOO..ONO","OOO........OOO"],{},{});
one("vanity","f","floorL","梳妝台",260,["...OOOOOO...","..OKKKKKKO..",".OKSSSSSSKO.",".OKSWSSSSKO.",".OKSSWSSSKO.",".OKSSSSSSKO.","..OKKKKKKO..","OOOOOOOOOOOO","OQQQQQQQQQQO","OQOYOQQOYOQO","OOOOOOOOOOOO","OKO......OKO","OOO......OOO"],{"K":"#f7a7b8"},{});
one("tent","f","floorL","露營帳篷",300,[".......OO.......","......OAAO......",".....OAAAAO.....","....OAABBAAO....","...OAABDDBAAO...","..OAABDDDDBAAO..",".OAABDDDDDDBAAO.","OAABDDDDDDDDBAAO","OOOOOOOOOOOOOOOO"],{"A":"#8fd3a8","B":"#3fae74"},{"u":5.2});
one("icecart","f","floorR","冰淇淋小攤",340,["OOOOOOOOOOOOOO","OKWKWKWKWKWKWO","OOOOOOOOOOOOOO",".O..........O.",".O.K..W..N..O.",".O.Y..Y..Y..O.","OOOOOOOOOOOOOO","OSSSSSSSSSSSSO","OSWWSSSSSSSSSO","OSSSSSSSSSSSSO","OOOOOOOOOOOOOO","..OOO....OOO..","..OEO....OEO..","..OOO....OOO.."],{},{});
one("catcafe","f","floorR","貓咪咖啡吧檯",360,["..O....OWO....","..OO..OWWWO...",".OKKO.OOOOO...",".OOOO..OWO....","OOOOOOOOOOOOOO","ONNNNNNNNNNNNO","OOOOOOOOOOOOOO","ONQQQQNNQQQQNO","ONQKKQNNQKKQNO","ONQQQQNNQQQQNO","ONNNNNNNNNNNNO","OOOOOOOOOOOOOO"],{},{});
one("fireplace","f","floorL","溫暖壁爐",600,["OOOOOOOOOOOOOOOO","OQQQQQQQQQQQQQQO","OOOOOOOOOOOOOOOO",".OBBOBBBOBBBOBO.",".OBOOOOOOOOOOBO.",".OBODDDDDDDDOBO.",".OOODDDPDDDDOOO.",".OBODDPYPDPDOBO.",".OBODPYYPPYPOBO.",".OBODPYYYYYPOBO.",".OOONNNNNNNNOOO.",".OOOOOOOOOOOOOO."],{"B":"#d98a72"},{"tag":"a","d":"火焰會跳動","fx":"frames","fr":[["OOOOOOOOOOOOOOOO","OQQQQQQQQQQQQQQO","OOOOOOOOOOOOOOOO",".OBBOBBBOBBBOBO.",".OBOOOOOOOOOOBO.",".OBODDDDDDDDOBO.",".OOODDDDDPDDOOO.",".OBODPDPPYPDOBO.",".OBODYPPYYPPOBO.",".OBODPYYYYYPOBO.",".OOONNNNNNNNOOO.",".OOOOOOOOOOOOOO."]],"u":5.2});
one("hamster","f","floorM","倉鼠滾輪",500,["....OOOOOO....","..OOTTTTTTOO..",".OTTO....OTTO.",".OTO......OTO.","OTO..O..O..OTO","OTO.OAOOAO.OTO","OTO.OAEAEO.OTO","OTO.OAAKAO.OTO","OTO.OQQQQO.OTO",".OTO.O..O.OTO.",".OTTO....OTTO.","..OOTTTTTTOO..","..ONO....ONO.."],{"T":"#b8c4d0","A":"#f6c98a"},{"tag":"a","d":"倉鼠一直跑","fx":"frames","fr":[["....OOOOOO....","..OOTTTTTTOO..",".OTTO....OTTO.",".OTO......OTO.","OTO..O..O..OTO","OTO.OAOOAO.OTO","OTO.OAEAEO.OTO","OTO.OAAKAO.OTO","OTO.OQQQQO.OTO",".OTOO....OOTO.",".OTTO....OTTO.","..OOTTTTTTOO..","..ONO....ONO.."]]});
one("luckycat","f","floorM","招財貓",660,[".O.....O...","OWO...OWO..","OWWOOOWWOOO","OWWWWWWWOWO","OWEWWWEWOWO","OWWWKWWWOOO","OWKWWWKWWO.",".OOORROOO..",".OWWRYRWWO.","OWWWWWWWWWO","OWWYYYYYWWO","OWWYYYYYWWO",".OOOOOOOOO."],{},{"tag":"a","d":"會招手","fx":"frames","fr":[[".O.....O...","OWO...OWO..","OWWOOOWWO..","OWWWWWWWO..","OWEWWWEWOOO","OWWWKWWWOWO","OWKWWWKWOWO",".OOORROOOO.",".OWWRYRWWO.","OWWWWWWWWWO","OWWYYYYYWWO","OWWYYYYYWWO",".OOOOOOOOO."]]});
one("jelly","f","floorR","水母缸",520,["OOOOOOOOOOOO","OSSSSSSSSSSO","OSSOOOSSSSSO","OSOKKKOSSWSO","OSOKKKOSSSSO","OSSOKOSSOOSO","OSSKSKSOVVOO","OSSSSSSOVVOO","OSWSSSSSVSVO","OSSSSSSSSSSO","OOOOOOOOOOOO","ONNNNNNNNNNO","OOOOOOOOOOOO"],{},{"tag":"a","d":"水母上下漂","fx":"frames","fr":[["OOOOOOOOOOOO","OSSSSSSSSSSO","OSSSSSSSSWSO","OSSOOOSSSSSO","OSOKKKOSOOSO","OSOKKKOOVVOO","OSSOKOSOVVOO","OSSKSKSSVSVO","OSWSSSSSSSSO","OSSSSSSSSSSO","OOOOOOOOOOOO","ONNNNNNNNNNO","OOOOOOOOOOOO"]]});
one("fountain","f","floorM","小噴泉",550,["......U.....",".....USU....","....U.U.U...","...U..U..U..","......U.....","....OOOOO...","....OTTTO...","..OOOOOOOOO.",".OUUSUUUSUUO","OTUUUUUUUUTO","OTTTTTTTTTTO",".OOOOOOOOOO."],{"T":"#c9ced6"},{"tag":"a","d":"水花一直噴","fx":"frames","fr":[["............","......S.....",".....USU....","....U.U.U...","...S..U..S..","....OOOOO...","....OTTTO...","..OOOOOOOOO.",".OUSUUUSUUUO","OTUUUUUUUUTO","OTTTTTTTTTTO",".OOOOOOOOOO."]]});
one("campfire","f","floorM","小營火",400,[".....P.....","....PYP....","...PYYP.P..","..PYYYYPP..","..PYWWYYP..","...PYYYP...","O.NNOONN.O.","ONNOONNOONO",".OOOOOOOOO."],{},{"tag":"a","d":"火焰會跳動","fx":"frames","fr":[["......P....","..P..PYP...","..PPPYYP...","..PYYYYYP..","..PYYWWYP..","...PYYYP...","O.NNOONN.O.","ONNOONNOONO",".OOOOOOOOO."]]});
one("neon","f","wallM","霓虹招牌",420,["OOOOOOOOOOOOOOOO","ODDDDDDDDDDDDDDO","ODKDKDDKKKDDKDKO","ODKKKDDKDKDDKKKO","ODKDKDDKKKDDKDKO","ODDDDDDDDDDDDDDO","ODDUUDDUUDDUUDDO","ODDDDDDDDDDDDDDO","OOOOOOOOOOOOOOOO"],{"D":"#2c2833","K":"#ff6fa3","U":"#6fd6ff","W":"#ffd0e2","Y":"#fff2a8"},{"tag":"a","d":"一閃一閃","fx":"frames","fr":[["OOOOOOOOOOOOOOOO","ODDDDDDDDDDDDDDO","ODWDWDDWWWDDWDWO","ODWWWDDWDWDDWWWO","ODWDWDDWWWDDWDWO","ODDDDDDDDDDDDDDO","ODDYYDDYYDDYYDDO","ODDDDDDDDDDDDDDO","OOOOOOOOOOOOOOOO"]]});
one("pinwheel","f","floorR","彩色風車",260,["...OOO...","..OKKKO..",".OOKKKOO.","OYYOOOUUO","OYYOWOUUO","OYYOOOUUO",".OOGGGOO.","..OGGGO..","...OOO..."],{},{"tag":"a","d":"一直轉","fx":"spin"});
one("rockhorse","f","floorM","搖搖木馬",400,["........OO..",".......OAAO.","..O...OAEAO.",".OAOOOOAAAO.","OAAAAAAAOO..","OAAKKKAAO...",".OAAAAAAO...",".OAO..OAO...","OOO....OOO..","OBBOOOOOBBO.",".OBBBBBBBO..","..OOOOOOO..."],{"A":"#f6c98a","B":"#e5486a"},{"tag":"a","d":"前後搖","fx":"rock"});
one("robot","f","floorM","掃地機器人",700,["..OOOOOOOO..",".OTTTTTTTTO.","OTTTSSSSTTTO","OTTSEWWESTTO","OTTTSSSSTTTO",".OTTTTTTTTO.","..OOOOOOOO.."],{"T":"#e9edf2"},{"tag":"a","d":"在地板上來回跑","fx":"slide"});
one("musicbox","f","floorM","音樂盒",800,[".OOOOOOOOOO.",".OQQQQQQQQO.",".OQEQQQEEQO.",".OQEQQQEQQO.",".OEEQQEEQQO.","OOOOOOOOOOOO","OKKKKKKKKKKO","OKYKKWWKKYKO","OKKKKWWKKKKO","OKKKKKKKKKKO","OOOOOOOOOOOO",".OO......OO."],{},{"tag":"i","d":"點一下播放旋律，音符會飄出來","tap":"notes"});
one("grandpiano","f","floorL","演奏鋼琴",880,["OOOOOOOOOO......","ODDDDDDDDDOO....","ODDDDDDDDDDDOO..","ODDDDDDDDDDDDDO.","ODDDDDDDDDDDDDDO","OOOOOOOOOOOOOOOO","OWEWEWWEWEWEWWWO","OWWWWWWWWWWWWWWO","OOOOOOOOOOOOOOOO","ODO..........ODO","ODO....OO....ODO","OOO....OO....OOO"],{},{"tag":"i","d":"點一下彈一個音，每次不一樣","tap":"piano","u":5.2});
one("snowglobe","f","floorM","雪花球",480,["...OOOOOO...","..OSSSSSSO..",".OSSSSSSSSO.","OSSSSSGSSSSO","OSSSSGGGSSSO","OSSSSGGGSSSO","OSSSGGGGGSSO","OSSSSSNSSSSO",".OWWWWWWWWO.","..OOOOOOOO..",".ORRRRRRRRO.",".OOOOOOOOOO."],{},{"tag":"i","d":"點一下搖一搖，雪花飄下來","tap":"snow","fr":[["...OOOOOO...","..OSWSSSWO..",".OSSSSWSSSO.","OSWSSSGSSWSO","OSSSSGGGSSSO","OSSWSGGGSWSO","OSSSGGGGGSSO","OWSSSSNSSSWO",".OWWWWWWWWO.","..OOOOOOOO..",".ORRRRRRRRO.",".OOOOOOOOOO."],["...OOOOOO...","..OSSSWSSO..",".OSWSSSSWSO.","OSSSSSGSSSSO","OSWSSGGGSWSO","OSSSSGGGSSSO","OSWSGGGGGSWO","OSSSWSNSWSSO",".OWWWWWWWWO.","..OOOOOOOO..",".ORRRRRRRRO.",".OOOOOOOOOO."]]});
one("disco","f","wallM","彩色燈球",900,[".....OO.....",".....OO.....","...OOOOOO...","..OTWTTWTO..",".OTTKTTUTTO.",".OWTTTTTTWO.",".OTTYTTGTTO.",".OTWTTTTWTO.","..OTTKTTTO..","...OOOOOO..."],{"T":"#c9ced6"},{"tag":"i","d":"點一下開派對燈，整個房間變彩色","fx":"frames","tap":"party","fr":[[".....OO.....",".....OO.....","...OOOOOO...","..OWTTWTTO..",".OTUTTKTTWO.",".OTTTWTTTTO.",".OWGTTTYTTO.",".OTTTWTTTWO.","..OTTTUTTO..","...OOOOOO..."]]});
one("projector","f","floorM","星空投影燈",850,["...Y....Y...","......Y.....","..Y.......Y.","....OOOO....","...OVVVVO...","..OVVYYVVO..","..OVYWWYVO..","..OVVYYVVO..","...OVVVVO...","..OOOOOOOO..","..ODDDDDDO..","..OOOOOOOO.."],{},{"tag":"i","d":"點一下，房間變成星空","tap":"night"});
one("cuckoo","f","wallL","咕咕鐘",520,["....OOO....","...ONNNO...","..ONNNNNO..",".ONNOOONNO.","ONNODDDONNO","OOOOOOOOOOO","ONQQQQQQQNO","ONQQQOQQQNO","ONQQQOOQQNO","ONQQQQQQQNO","OOOOOOOOOOO","...O...O...","..OYO.OYO..","..OOO.OOO.."],{},{"tag":"i","d":"點一下，小鳥跑出來叫","tap":"cuckoo","fr":[["....OOO....","...ONNNO...","..ONNNNNO..",".ONNOOONNO.","ONNOYYEOOO.","OOOOYYYPPO.","ONQQQQQQQNO","ONQQQOQQQNO","ONQQQOOQQNO","ONQQQQQQQNO","OOOOOOOOOOO","...O...O...","..OYO.OYO..","..OOO.OOO.."]]});
one("windchime","f","window","玻璃風鈴",350,["....O....","...OOO...","..OSSSO..",".OSWSSSO.",".OSSSSSO.",".OOOOOOO.","....O....","....O....","...OOO...","...OKO...","...OKO...","...OKO...","...OOO..."],{},{"tag":"i","d":"會輕輕搖；點一下叮鈴鈴","fx":"sway","tap":"chime"});
one("fortune","f","floorR","幸運籤筒",600,["..O.O.O...","..ONONO.O.","..ONONONO.",".OOOOOOOO.",".ORRRRRRO.",".ORYYYYRO.",".ORYRRYRO.",".ORYYYYRO.",".ORRRRRRO.",".ORRRRRRO.",".OOOOOOOO."],{},{"tag":"i","d":"每天點一下抽一支籤，看今天的運勢","tap":"fortune"});
one("bubble","f","floorM","泡泡機",450,["..S...S...","....S....S",".S.....S..","...OOOO...","..OUUUUO..",".OOOOOOOO.",".OKKKKKKO.",".OKWKKKKO.",".OKKKKKKO.",".OOOOOOOO.","..OO..OO.."],{},{"tag":"i","d":"點一下噴出一堆泡泡","tap":"bubbles"});
one("bigtv","f","floorR","大電視",650,["OOOOOOOOOOOOOOOO","ODDDDDDDDDDDDDDO","ODSSSSSSSSSSSSDO","ODSSSSYYSSSSSSDO","ODSSSYYYYSSWWSDO","ODSSSSYYSSSSSSDO","ODGGGGGGGGGGGGDO","ODGGGGGGGGGGGGDO","ODDDDDDDDDDDDDDO","OOOOOOOOOOOOOOOO",".....OOOOOO.....","...OOOOOOOOOO..."],{},{"tag":"i","d":"點一下轉台，有四個節目","tap":"tv","fr":[["OOOOOOOOOOOOOOOO","ODDDDDDDDDDDDDDO","ODKKKKKKKKKKKKDO","ODKKOKKKKKKOKKDO","ODKKOOOOOOOOKKDO","ODKKOWEOOEWOKKDO","ODKKOOOKKOOOKKDO","ODKKKOOOOOOKKKDO","ODDDDDDDDDDDDDDO","OOOOOOOOOOOOOOOO",".....OOOOOO.....","...OOOOOOOOOO..."],["OOOOOOOOOOOOOOOO","ODDDDDDDDDDDDDDO","ODUUUUUUUUUUUUDO","ODUUUUUUUPPUUUDO","ODUUUUUUPPPPOUDO","ODUWUUUUUPPUUUDO","ODUUUUGUUUUUGUDO","ODUUUGGGUUUGGGDO","ODDDDDDDDDDDDDDO","OOOOOOOOOOOOOOOO",".....OOOOOO.....","...OOOOOOOOOO..."],["OOOOOOOOOOOOOOOO","ODDDDDDDDDDDDDDO","ODVVVVVVVVVVVVDO","ODVVYVVVVVVYVVDO","ODVVVVVKKVVVVVDO","ODVYVVKKKKVVYVDO","ODVVVVVKKVVVVVDO","ODVVVYVVVVYVVVDO","ODDDDDDDDDDDDDDO","OOOOOOOOOOOOOOOO",".....OOOOOO.....","...OOOOOOOOOO..."]],"u":5.2});

/* ======================= shop: walls / floors / rugs ======================= */
const bgItem = (id, k, n, price, bg) => add({ id, k, slot:k, n, price, bg });
bgItem("wp0","w","奶茶條紋（原本的）",0,"repeating-linear-gradient(90deg,#fde9d6 0 24px,#fbe0c8 24px 48px)");
bgItem("wpPink","w","草莓條紋",60,"repeating-linear-gradient(90deg,#ffe1ea 0 24px,#ffd0dd 24px 48px)");
bgItem("wpBlue","w","天空條紋",60,"repeating-linear-gradient(90deg,#e1f1ff 0 24px,#cfe6fb 24px 48px)");
bgItem("wpMint","w","薄荷點點",80,"radial-gradient(#bfe9d2 3px,transparent 4px) 0 0/24px 24px,#effcf4");
bgItem("wpYellow","w","奶油格子",80,"repeating-conic-gradient(#fff6d6 0 25%,#ffedb3 0 50%) 0 0/32px 32px");
bgItem("wpPurple","w","紫色星光",100,"radial-gradient(#fff 1.5px,transparent 2.5px) 0 0/28px 28px,radial-gradient(#d9c6ff 3px,transparent 4px) 14px 14px/28px 28px,#efe6ff");
bgItem("wpWood","w","木頭牆",120,"repeating-linear-gradient(0deg,#e8c39a 0 18px,#d9ad80 18px 20px)");
bgItem("wpNight","w","夜空",150,"radial-gradient(#fff 1px,transparent 2px) 0 0/40px 40px,radial-gradient(#fff9 1px,transparent 2px) 20px 20px/40px 40px,linear-gradient(#2c3561,#4b4f8c)");
bgItem("wpSakura","w","櫻花",150,"radial-gradient(circle at 50% 50%,#f7a7b8 0 3px,transparent 4px) 0 0/30px 30px,radial-gradient(circle at 50% 50%,#fbd0db 0 2px,transparent 3px) 15px 15px/30px 30px,#fff5f8");
bgItem("wpBrick","w","紅磚牆",130,"linear-gradient(#e6b8a2 2px,transparent 2px) 0 0/40px 20px,linear-gradient(90deg,#e6b8a2 2px,transparent 2px) 0 0/40px 40px,linear-gradient(90deg,#e6b8a2 2px,transparent 2px) 20px 20px/40px 40px,#f3cdb8");
bgItem("wpHeart","w","愛心壁紙",120,"radial-gradient(circle at 40% 40%,#f7a7b8 0 3px,transparent 3.5px) 0 0/32px 32px,radial-gradient(circle at 60% 40%,#f7a7b8 0 3px,transparent 3.5px) 0 0/32px 32px,#fff0f4");
bgItem("fl0","fl","木地板（原本的）",0,"repeating-linear-gradient(90deg,#d9a877 0 40px,#cf9b69 40px 80px)");
bgItem("flTile","fl","白色磁磚",70,"repeating-conic-gradient(#ffffff 0 25%,#e3e6ee 0 50%) 0 0/28px 28px");
bgItem("flBlue","fl","藍白磁磚",80,"repeating-conic-gradient(#ffffff 0 25%,#bcdcf5 0 50%) 0 0/28px 28px");
bgItem("flPink","fl","粉紅地板",80,"repeating-linear-gradient(90deg,#f6c3cf 0 40px,#eeb1c0 40px 80px)");
bgItem("flGrass","fl","草地",110,"radial-gradient(#7fcf8f 2px,transparent 3px) 0 0/14px 14px,#9fdca8");
bgItem("flDark","fl","深色木地板",90,"repeating-linear-gradient(90deg,#9a6a45 0 40px,#8c5e3b 40px 80px)");
bgItem("flCarpet","fl","灰色地毯",70,"radial-gradient(#0001 1px,transparent 1.5px) 0 0/6px 6px,#c9c6cf");
bgItem("flTatami","fl","榻榻米",120,"repeating-linear-gradient(90deg,#d9d58c 0 60px,#5a7d4a 60px 62px),#d9d58c");
bgItem("rugDot","r","點點地毯",50,"radial-gradient(#fff 3px,transparent 4px) 0 0/16px 16px,#6fb7e8");
bgItem("rugMint","r","薄荷地毯",40,"#a8e6c4");
bgItem("rugStripe","r","條紋地毯",60,"repeating-linear-gradient(90deg,#ffd36b 0 14px,#fff3c4 14px 28px)");
bgItem("rugPurple","r","紫色地毯",50,"radial-gradient(#fff8 2px,transparent 3px) 0 0/12px 12px,#cdb4f0");
bgItem("rugGray","r","灰色毛毛地毯",40,"radial-gradient(#fff6 1px,transparent 2px) 0 0/5px 5px,#bdbac6");
bgItem("rugStar","r","星星地毯",80,"radial-gradient(#ffd36b 3px,transparent 4px) 0 0/22px 22px,#2f437d");

/* ======================= shop: accessories ======================= */
// hats  (hb = bottom %, x = left %, cls side = clip on the ear)
fam("beret","貝蕾帽","a","hat",["red","navy","pink","black","yellow"],50,["....O....",".OOOOOOO.","OAAAAAAAO","OAAAAABAO",".OOOOOOO."]);
fam("beanie","毛帽","a","hat",["red","blue","mint","pink","yellow"],60,["...OWO...","..OAAAO..",".OAAAAAO.","OAAAAAAAO","OBABABABO","OOOOOOOOO"]);
fam("clip","蝴蝶結髮夾","a","hat",["pink","blue","mint","yellow","purple"],35,["OO...OO","OAO.OAO","OABOBAO","OAO.OAO","OO...OO"],{ side:1 });
fam("flowerclip","小花髮夾","a","hat",["pink","yellow","purple","blue"],35,["..OAO..",".OAAAO.","OAAYAAO",".OAAAO.","..OAO.."],{ side:1 });
fam("party","派對帽","a","hat",["pink","blue","mint","yellow"],45,["...Y...","..OYO..","..OAO..",".OAWAO.",".OAAAO.","OAWAAWO","OAAAAAO","OOOOOOO"]);
fam("bunny","兔耳朵","a","hat",["white","pink","black"],90,[".OO.....OO.","OAAO...OAAO","OAKO...OKAO","OAKO...OKAO","OAKO...OKAO","OAKO...OKAO","OAAO...OAAO",".OOOOOOOOO."],{ hb:70 });
fam("tophat","紳士禮帽","a","hat",["black","navy","red"],120,["..OOOOO..","..OAAAO..","..OAAAO..","..OAAAO..","..OBBBO..","..OAAAO..","OOOOOOOOO","OAAAAAAAO","OOOOOOOOO"]);
fam("frog","青蛙帽","a","hat",["mint"],110,[".OOO...OOO.","OWEWOOOWEWO","OAAAAAAAAAO","OAAKAAAKAAO","OAAAAAAAAAO","OOOOOOOOOOO"]);
fam("crown2","寶石皇冠","a","hat",["blue","purple","red"],260,["O...O...O","OO.OAO.OO","OYOYYYOYO","OYYYYYYYO","OYAYAYAYO","OOOOOOOOO"]);
one("antler","a","hat","麋鹿角",90,["O.O.......O.O","ONO.O...O.ONO",".ONONO.ONONO.","..ONNO.ONNO..","...ONO.ONO...","...ONO.ONO...","...OOO.OOO..."],{},{ hb:70 });
one("halo","a","hat","天使光環",150,[".OOOOOOOOO.","OYY.....YYO",".OOOOOOOOO."],{},{ hb:86 });
one("horns","a","hat","小惡魔角",120,["O.........O","OKO.....OKO","OKKO...OKKO","OOOO...OOOO"],{ K:"#c9372c" },{ hb:72 });
one("chef","a","hat","廚師帽",80,[".OO.OO.O.","OWWOWWOWO","OWWWWWWWO","OWWWWWWWO",".OWWWWWO.",".OWWWWWO.",".OOOOOOO.",".OWWWWWO.",".OOOOOOO."]);
one("sailor","a","hat","水手帽",80,["...OOOOO...","..OWWWWWO..",".OWWWWWWWO.","OBBBBBBBBBO","OWWWWWWWWWO",".OOOOOOOOO."],{ B:"#2f437d" });
one("rainhat","a","hat","雨帽",60,["...OOOOO...","..OYYYYYO..",".OYYYYYYYO.","OOYYYYYYYOO","OYYYYYYYYYO","OOOOOOOOOOO"]);
one("pumpkinhat","a","hat","南瓜帽",90,["....OGO...","..OOOOOO..",".OAAOAAAO.","OAAAOAAAAO","OAAAOAAAAO","OOOOOOOOOO"],{ A:"#f29a3c" });
one("sprout","a","hat","頭上小草",30,["..GG.GG..","...GGG...","....G....","....G...."],{},{ hb:72 });
one("cherry","a","hat","櫻桃髮夾",40,["...OO","..OG.",".O.O.","ORO.O","OROORO",".O.ORO","....O."],{},{ side:1 });
// neck
fam("tie","領帶","a","neck",["red","navy","yellow","pink"],60,["OOOOO","OAAAO",".OAO.","OAAAO","OABAO","OAAAO","OABAO",".OAO.","..O.."],{ y:56 });
fam("bowtie","領結","a","neck",["blue","black","yellow","mint","purple"],45,["OO...OO","OAO.OAO","OABOBAO","OAO.OAO","OO...OO"]);
fam("scarf2","圍巾","a","neck",["red","pink","mint","yellow"],70,["OOOOOOOOOO","OAABAABAAO","OOOOOOOAAO",".......OAO",".......OBO",".......OOO"],{ y:55 });
fam("bell2","鈴鐺項圈","a","neck",["blue","mint","purple","black"],55,["OOOOOOOOO","OAAAAAAAO","OOOOOOOOO","...OYO...","..OYYYO..","..OOOOO.."],{ y:55 });
fam("heartN","愛心項鍊","a","neck",["pink","red","purple"],80,["O.........O",".O.......O.","..O.....O..","...OAOAO...","...OAAAO...","....OAO....",".....O....."],{ y:55 });
one("starN","a","neck","星星項鍊",80,["O.........O",".O.......O.","..O..Y..O..","...OYYYO...","....YYY....","....Y.Y...."],{},{ y:55 });
one("bib","a","neck","可愛圍兜",50,["OOOOOOOOO","OWWWWWWWO",".OWKWKWO.",".OWWWWWO.","..OWWWO..","...OOO..."],{},{ y:55 });
one("lei","a","neck","花環項圈",90,["KYKW.....WKYK",".KYKWYKWYKYK.","...KYKWKYK..."],{},{ y:55 });
// face (glasses etc.)
one("glasses","a","face","圓眼鏡",70,[".OOO.......OOO.","OSWSOOOOOOOSWSO","OSSSO.....OSSSO",".OOO.......OOO."]);
one("shades","a","face","酷酷墨鏡",90,["OOOOO.....OOOOO","ODDWDOOOOODDWDO","ODDDO.....ODDDO",".OOO.......OOO."]);
fam("cglass","眼鏡","a","face",["pink","yellow","blue"],80,[".OOO.......OOO.","OAWAOOOOOOOAWAO","OAAAO.....OAAAO",".OOO.......OOO."]);
one("glass3d","a","face","3D 眼鏡",70,["OOOOOOOOOOOOOOO","ORRRO.....OUUUO","ORRRO.....OUUUO","OOOOO.....OOOOO"]);
one("monocle","a","face","單片眼鏡",100,["..........OOO..",".........OSWSO.",".........OSSSO.","..........OOO..","...........O...","............O.."],{ S:"#e9f6ff" });
one("blush","a","face","腮紅貼紙",25,["KK.............KK","KK.............KK"],{ K:"#ff8fa8" },{ fy:44 });
one("star_eye","a","face","臉頰星星",30,["..............Y..",".............YYY.","..............Y.."],{},{ fy:42 });

/* ======================= 院子：戶外家具（也可以放在房間裡） ======================= */
const OUT = { yard:true };
one("swing","f","floorL","木頭鞦韆",450,["OOOOOOOOOOOOOO","ONNNNNNNNNNNNO","OOOOOOOOOOOOOO",".ON........NO.",".ON..O..O..NO.",".ON..O..O..NO.",".ON..O..O..NO.",".ON..O..O..NO.",".ON.OOOOOO.NO.",".ON.OKKKKO.NO.",".ON.OOOOOO.NO.",".ON........NO.","OONO......ONOO"],{ K:"#f7a7b8" },Object.assign({ d:"院子必備，盪呀盪" },OUT));
one("hammock","f","floorR","吊床",420,["ON..............NO","ON..............NO","ONOO..........OONO","ON.KOO......OOK.NO","ON..KKOOOOOOKK..NO","ON...KWKWKWKK...NO","ON....OOOOOO....NO","ON..............NO","OO..............OO"],{ K:"#6fb7e8" },Object.assign({ d:"午後躺著發呆最舒服" },OUT));
one("flowerbed","f","floorM","小花圃",220,[".K..Y..K..V..Y.","KYK.YKY.KYK.VYV",".K..Y..K..V..Y.",".G.GG.G.GG.G.G.","..G.G..G.G..G..","OOOOOOOOOOOOOOO","ONNNNNNNNNNNNNO","OOOOOOOOOOOOOOO"],{},Object.assign({ d:"種滿了小花" },OUT));
one("fence","f","floorL","白色木柵欄",160,[".O...O...O...O..","OWO.OWO.OWO.OWO.","OWOOOWOOOWOOOWOO","OWWWWWWWWWWWWWWO","OWOOOWOOOWOOOWOO","OWO.OWO.OWO.OWO.","OWWWWWWWWWWWWWWO","OWOOOWOOOWOOOWOO","OWO.OWO.OWO.OWO.","OOO.OOO.OOO.OOO."],{},Object.assign({ u:6 },OUT));
one("birdhouse","f","floorR","小鳥屋",300,["....OOO....","...ORRRO...","..ORRRRRO..",".ORRRRRRRO.","OOOOOOOOOOO",".ONNNNNNNO.",".ONNOOONNO.",".ONNODONNO.",".ONNOOONNO.",".ONNNNNNNO.",".OOOOOOOOO.","....ONO....","....ONO....","....ONO....","...OOOOO..."],{},Object.assign({ tag:"i", d:"點一下小鳥會探出頭", tap:"cuckoo", fr:[["....OOO....","...ORRRO...","..ORRRRRO..",".ORRRRRRRO.","OOOOOOOOOOO",".ONNNNNNNO.",".ONOYYYONO.",".ONOYEYPNO.",".ONOYYYONO.",".ONNNNNNNO.",".OOOOOOOOO.","....ONO....","....ONO....","....ONO....","...OOOOO..."]] },OUT));
one("bbq","f","floorM","烤肉架",380,["..W...W...W..","...W...W...W.","OOOOOOOOOOOOO","ODDDDDDDDDDDO","OPYPYPYPYPYPO",".ODDDDDDDDDO.","..ODDDDDDDO..","...OOOOOOO...","....O...O....","...O.....O...","..O.......O.."],{},Object.assign({ tag:"a", d:"炭火會一閃一閃", fx:"frames", fr:[[".W...W...W...","..W...W...W..","OOOOOOOOOOOOO","ODDDDDDDDDDDO","OYPYPYPYPYPYO",".ODDDDDDDDDO.","..ODDDDDDDO..","...OOOOOOO...","....O...O....","...O.....O...","..O.......O.."]] },OUT));
one("mailbox","f","floorL","紅色信箱",200,["..OOOOOOO..",".ORRRRRRRO.","ORRRRRRRRRO","ORRRRRRRRRO","ORROOOOORRO","ORRRRRRRRRO","OOOOOOOOOOO","....ONO.OKO","....ONO.OKK","....ONO.O..","....ONO....","...OOOOO..."],{},Object.assign({ tag:"i", d:"點一下收到一封小信", tap:"mail" },OUT));
one("scarecrow","f","floorL","稻草人",260,["...OOOOOO...","..OYYYYYYO..",".OOOOOOOOOO.","...OQQQQO...","...OQEQEO...","...OQQKQO...","OOOOOOOOOOOO","OBBBBNBBBBBO","OOOOBNBOOOOO","...OBNBO....","...OBBBO....","....ONO.....","....ONO.....","....ONO....."],{ Y:"#f0cf7a", Q:"#f3d9b5", B:"#6fb7e8" },OUT);
one("pond","f","floorM","小池塘",520,["...OOOOOOOO...",".OOUUUUUUUUOO.","OUUUSUUUUUUUUO","OUUUUUUUGGUUUO","OUUUUUUGGGGUUO",".OOUUUUUUUUOO.","...OOOOOOOO..."],{},Object.assign({ tag:"a", d:"水面會有小漣漪", fx:"frames", u:6.4, fr:[["...OOOOOOOO...",".OOUUUUUUUUOO.","OUUUUUUUUSUUUO","OUSUUUUUGGUUUO","OUUUUUUGGGGUUO",".OOUUUUUUUUOO.","...OOOOOOOO..."]] },OUT));
bgItem("rugPicnic","r","野餐墊",150,"repeating-conic-gradient(#e5486a 0 25%,#fff 0 50%) 0 0/16px 16px");

const BY = Object.fromEntries(ITEMS.map(x=>[x.id,x]));
const ART = {}; const art = id => ART[id] || (ART[id] = A[id] ? px(A[id][0], A[id][1]) : "");   // 畫好的家具圖存起來，打開佈置不用每次重畫
const cols = id => A[id] ? Math.max(...A[id][0].map(r=>r.length)) : 10;
const coin = `<i class="pdCoin">${px([".OOO.","OYYYO","OYWYO","OYYYO",".OOO."], { Y:"#ffcf4a", W:"#fff6c8" })}</i>`;
const frames = id => A[id] ? [px(A[id][0], A[id][1])].concat((FR[id]||[]).map(r => px(r, A[id][1]))) : [];
window.PetDeco = { ITEMS, BY, art, cols, coin, px, frames };
})();

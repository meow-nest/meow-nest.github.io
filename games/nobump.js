// 遊戲：喵喵別亂碰（單人、11/28）
// 小貓坐在中間，東西會從四面八方跑過來，在碰到小貓之前點掉它。被碰到就失敗，每種東西都有不同的「下場」小劇場可以收集。
// 12 關（第 5、12 關是魔王），每關出場順序固定；蝴蝶不能點；金魚乾＝全清、鈴鐺＝變慢 3 秒。三顆星：過關、沒用道具、連擊達標。全破開無盡模式。
// 點到有碎片、連擊、震動；失敗時鏡頭拉近演一段下場（scene）。
// 進度存在每個人自己的 game_state「nobump:自己 uid 前 8 碼」：{ lv 解鎖到第幾關, f:{關:失敗次數}, c:{關:破關時的失敗次數}, d:{下場:次數}, st:{關:星星}, inf 無盡最久秒數, all 全破 }
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

// ---- 每種東西：大小、速度、怎麼動、要點幾下、下場、碎片顏色 ----
// mv：line 直線、curl 繞圈、feint 衝一下停一下、blink 一下看得到一下看不到、tele 一跳一跳、park 停在旁邊噴水、flutter 亂飛經過、boss 魔王
const T = {
  cuke:  { s:46, v:70,  mv:"line",  hp:1, fate:"fly",  name:"小黃瓜", col:["#6cc04a","#3e8f2e","#a6e07a"] },
  drop:  { s:26, v:150, mv:"line",  hp:1, fate:"wet",  name:"水滴", col:["#6cc0ff","#3a8fe0","#e6f6ff"] },
  yarn:  { s:36, v:62,  mv:"curl",  hp:1, fate:"wrap", name:"毛線球", col:["#ff9ec4","#e0638f"] },
  vac:   { s:52, v:30,  mv:"line",  hp:3, fate:"suck", name:"吸塵器", col:["#9b7bd8","#d9ccff","#5a4a7a"] },
  bub:   { s:40, v:52,  mv:"line",  hp:1, fate:"foam", name:"泡泡", split:3, col:["#cdeeff","#ffffff","#9fd6f5"] },
  mini:  { s:22, v:105, mv:"line",  hp:1, fate:"foam", name:"小泡泡", col:["#cdeeff","#ffffff"] },
  dog:   { s:44, v:140, mv:"feint", hp:1, fate:"lick", name:"小狗", col:["#e9c08a","#a0683e"] },
  cage:  { s:48, v:46,  mv:"blink", hp:1, fate:"vet",  name:"外出籠", col:["#b9b0a6","#ffffff"] },
  clock: { s:40, v:0,   mv:"tele",  hp:1, fate:"wake", name:"鬧鐘", col:["#ff6a5a","#ffd04a","#fff8ec"] },
  spray: { s:36, v:80,  mv:"park",  hp:2, fate:"wet",  name:"噴水瓶", col:["#9fd8ff","#4ab08a"] },
  fly:   { s:34, v:55,  mv:"flutter", hp:1, fate:"trip", name:"蝴蝶", friend:true, col:["#ffb3d1","#ffe07a"] },
  fish:  { s:40, v:70,  mv:"flutter", hp:1, pow:"fish", name:"金魚乾", col:["#ffd04a","#fff6c8","#e0a020"] },
  bell:  { s:30, v:70,  mv:"flutter", hp:1, pow:"bell", name:"鈴鐺", col:["#ffd04a","#fff6c8"] },
  bvac:  { s:108, v:15, mv:"boss",  hp:40, fate:"suck", name:"巨大吸塵器", art:"vac", boss:true, spit:["cuke","drop","drop","vac"], every:1.35, col:["#9b7bd8","#d9ccff","#5a4a7a"] },
  bcuke: { s:120, v:20, mv:"boss",  hp:70, fate:"fly",  name:"小黃瓜大王", art:"cuke", boss:true, crown:true, spit:["cuke","yarn","drop","dog"], every:1.05, split:6, col:["#6cc04a","#3e8f2e","#a6e07a","#ffd04a"] },
};
const FATE = {
  fly:  { n:"嚇到彈飛",     t:"小黃瓜！！整隻彈出畫面，再摔回來變扁扁", say:"小、小黃瓜……", art:"cuke" },
  wet:  { n:"變成落湯貓",   t:"頭上一朵烏雲一直下雨，正在生悶氣", say:"……（生氣）", art:"drop" },
  wrap: { n:"被捲成毛線球", t:"越掙扎纏得越緊，滾著滾著就滾走了", say:"救命喵——", art:"yarn" },
  suck: { n:"被吸進吸塵器", t:"整隻被拉長，咻——不見了", say:"嗝。", art:"vac" },
  foam: { n:"被洗香香",     t:"泡泡越堆越高，香到想哭", say:"香香的……不要啦", art:"bub" },
  lick: { n:"被舔一臉",     t:"小狗超熱情，口水糊滿臉", say:"噁……口水……", art:"dog" },
  vet:  { n:"被抓去看醫生", t:"外出籠從天而降，門關上了", say:"我不要打針！！", art:"cage" },
  wake: { n:"炸毛",         t:"鈴鈴鈴！毛全部豎起來變成刺蝟", say:"鈴——！！", art:"clock" },
  trip: { n:"追蝴蝶跌倒",   t:"蝴蝶不能打啦！撲空摔了一跤，眼冒金星", say:"蝴蝶……好漂亮……", art:"fly" },
};
const FATE_IDS = Object.keys(FATE);

// ---- 關卡：dur 秒數；plan 是出場表 [第幾秒, 種類, 從哪個角度來]，同一關每次都一樣；boss 關打倒魔王才算過；cb＝三星要的連擊 ----
const R = (seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
function burst(rnd, from, to, every, kinds){ const a = []; for(let t = from; t < to; t += every * (.75 + rnd() * .5)) a.push([+t.toFixed(2), kinds[(rnd() * kinds.length) | 0], (rnd() * 360) | 0]); return a; }
const LV = [
  { n:"小黃瓜來了", hint:"小黃瓜碰到小貓之前點它一下就好", dur:10, cb:8, w: r => burst(r, .4, 9, 1.1, ["cuke"]) },
  { n:"下雨了", hint:"水滴很快，從遠遠的地方就要點", dur:12, cb:12, w: r => burst(r, .4, 7, 1.05, ["cuke","drop"]).concat(burst(r, 7, 11, .5, ["drop"])) },
  { n:"滾來滾去", hint:"毛線球會繞圈圈，等它繞到你旁邊再點", dur:13, cb:12, w: r => burst(r, .4, 12, .9, ["yarn","cuke","yarn","drop"]).concat([[6, "fish", 30]]) },
  { n:"吸塵器", hint:"吸塵器要點三下，越早開始點越好", dur:14, cb:14, w: r => [[.5,"vac",0],[4,"vac",180],[8,"vac",90],[10.5,"vac",270],[7,"bell",200]].concat(burst(r, 1, 13, 1.2, ["cuke","drop"])) },
  { n:"魔王：巨大吸塵器", hint:"魔王會一直吐東西出來，先清小的，空檔再狂點魔王", boss:"bvac", dur:90, cb:20, w: r => [[1,"bvac",250],[9,"fish",20],[18,"bell",160]].concat(burst(r, 3, 80, 2.6, ["cuke","drop"])) },
  { n:"不能點的", hint:"粉紅色的蝴蝶不能點！讓牠飛走就好", dur:14, cb:14, w: r => burst(r, .4, 13, 1.2, ["fly"]).concat(burst(r, .9, 13, .85, ["cuke","drop","yarn"])) },
  { n:"泡泡浴", hint:"泡泡點破會分成三顆小泡泡，在遠一點的地方就點破它", dur:15, cb:20, w: r => burst(r, .4, 14, 1.15, ["bub","bub","drop"]).concat(burst(r, 3, 14, 2.4, ["fly"])).concat([[8,"bell",90]]) },
  { n:"假動作", hint:"小狗衝一下停一下，趁牠停下來的時候點", dur:15, cb:14, w: r => burst(r, .4, 14, 1.25, ["dog","dog","cuke"]).concat(burst(r, 2, 14, 2.2, ["fly"])) },
  { n:"看不見的籠子", hint:"外出籠一閃一閃，看得到的時候才點得到", dur:16, cb:16, w: r => burst(r, .4, 15, 1.15, ["cage","cage","yarn","drop"]).concat(burst(r, 2.5, 15, 2.6, ["fly"])).concat([[9,"fish",300]]) },
  { n:"鬧鐘和噴水瓶", hint:"鬧鐘會一跳一跳靠近；噴水瓶要點兩下，不然會一直噴水", dur:18, cb:18, w: r => burst(r, .4, 17, 1.35, ["clock","spray","clock","cuke"]).concat(burst(r, 1, 17, 1.15, ["drop"])).concat(burst(r, 4, 17, 3, ["fly"])) },
  { n:"大混亂", hint:"全部一起來了！先點最近的，蝴蝶不要點，金魚乾留到最危險的時候", dur:22, cb:25, w: r => burst(r, .4, 21, .6, ["cuke","drop","yarn","vac","bub","dog","cage","clock","spray"]).concat(burst(r, 2, 21, 2.2, ["fly"])).concat([[7,"fish",60],[14,"bell",240]]) },
  { n:"魔王：小黃瓜大王", hint:"大王每被打 6 下會生出小黃瓜，打的時候眼睛要顧四周", boss:"bcuke", dur:150, cb:30, w: r => [[1,"bcuke",290],[12,"fish",40],[24,"bell",200],[36,"fish",120]].concat(burst(r, 3, 140, 2.4, ["cuke","drop","yarn"])).concat(burst(r, 6, 140, 4, ["fly"])) },
];
LV.forEach((L, i) => { L.plan = L.w(R(1000 + i * 7919)).sort((a, b) => a[0] - b[0]); });
// 無盡模式：一直來、越來越快
function endlessPlan(){ const r = R(424242), a = [], ks = ["cuke","drop","yarn","vac","bub","dog","cage","clock","spray"]; let t = .5;
  while(t < 600){ const lvl = Math.min(ks.length, 2 + Math.floor(t / 12)); a.push([+t.toFixed(2), ks[(r() * lvl) | 0], (r() * 360) | 0]); if(r() < .12) a.push([+(t + .3).toFixed(2), "fly", (r() * 360) | 0]); if(r() < .03) a.push([+(t + .5).toFixed(2), r() < .5 ? "fish" : "bell", (r() * 360) | 0]); t += Math.max(.32, 1.1 - t * .012) * (.7 + r() * .6); }
  return a; }

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
    let S = null, alive = true, stopGame = () => {}, dirty = false;
    try{ S = JSON.parse(localStorage.getItem(LK) || "null"); }catch(e){}
    const norm = s => { s = s && typeof s === "object" ? s : {}; s.lv = Math.max(1, Math.min(LV.length, s.lv | 0 || 1)); s.f = s.f || {}; s.c = s.c || {}; s.d = s.d || {}; s.st = s.st || {}; s.ib = Math.max(0, s.ib | 0, Math.round((+s.inf || 0) * 10)); s.ip = s.ip | 0; s.ic = s.ic | 0; s.inf = s.ib / 10; s.all = !!s.all; return s; };
    S = norm(S);
    const merge = r => { if(!r) return; r = norm(JSON.parse(JSON.stringify(r)));   // 雲端和手機上的取大的
      S.lv = Math.max(S.lv, r.lv); if(r.ib > S.ib){ S.ib = r.ib; S.ic = r.ic; } S.ip = Math.max(S.ip, r.ip); S.inf = S.ib / 10; S.all = S.all || r.all;
      for(const k of ["f","d","st"]) for(const x in r[k]) S[k][x] = Math.max(S[k][x] || 0, r[k][x] || 0);
      for(const x in r.c) if(S.c[x] == null || r.c[x] < S.c[x]) S.c[x] = r.c[x]; };
    const keep = () => { dirty = true; try{ localStorage.setItem(LK, JSON.stringify(S)); }catch(e){} };
    const sync = () => { if(!dirty) return; dirty = false; ctx.update(KEY, st => { merge(st); return JSON.parse(JSON.stringify(S)); }).catch(() => { dirty = true; }); };
    const cat = () => ctx.me.cat || "orange";
    const totalF = () => Object.values(S.f).reduce((a, b) => a + b, 0);
    const totalSt = () => Object.values(S.st).reduce((a, b) => a + b, 0);
    const stars = (n, cls) => `<span class="nbSt ${cls || ""}">${[1,2,3].map(i => `<i class="${i <= n ? "on" : ""}">${ART.star}</i>`).join("")}</span>`;
    const tone = (f, d, o) => { try{ SFX.tone && SFX.tone(f, d, o); }catch(e){} };

    // ---------- 大廳 ----------
    function lobby(){
      stopGame(); sync();
      const got = FATE_IDS.filter(k => S.d[k]).length;
      el.innerHTML = `<div class="box nbLob">
        <div class="nbHero"><i class="a">${ART.cuke}</i><i class="b">${ART.yarn}</i><i class="c">${ART.drop}</i><i class="d">${ART.dog}</i><span class="nbHc">${Pix.sprite(cat(), "angry")}</span></div>
        <p class="skIntro">東西會從四面八方跑過來，<b>在碰到小貓之前點掉它</b>！<br>粉紅色的<b>蝴蝶不能點</b>；金魚乾和鈴鐺是道具，點了有好事。</p>
        <div class="nbSum"><span>星星 <b>${totalSt()}</b> / ${LV.length * 3}</span><span>總共失敗 <b>${totalF()}</b> 次</span></div>
        <div class="nbLvs">${LV.map((L, i) => { const n = i + 1, open = n <= S.lv, done = S.c[n] != null;
          return `<button class="nbLv${open ? "" : " lock"}${done ? " done" : ""}${L.boss ? " boss" : ""}" data-lv="${n}" ${open ? "" : "disabled"}><b>${open ? (L.boss ? `<i>${ART.crown}</i>` : n) : `<i>${ART.lock}</i>`}</b><span>${open ? esc(L.n) : "還沒解鎖"}${open && S.f[n] && !done ? `<small>失敗 ${S.f[n]} 次</small>` : ""}</span>${done ? stars(S.st[n] || 1, "sm") : ""}</button>`; }).join("")}</div>
        <button class="btn${S.all ? "" : " sub"}" id="nbInf" ${S.all ? "" : "disabled"}>${S.all ? `無盡模式・最久撐了 ${S.inf.toFixed(1)} 秒` : "無盡模式（12 關全破才會打開）"}</button>
        <button class="btn sub" id="nbRank">全站排行榜（無盡模式）</button>
        <button class="btn sub" id="nbAlbum">下場圖鑑（${got} / ${FATE_IDS.length}）</button>
        <div class="k" style="text-align:center">每關的出場順序都一樣，記住就能過<br>三顆星：過關・沒用道具・連擊達標</div></div>`;
      el.querySelectorAll(".nbLv:not(.lock)").forEach(b => b.addEventListener("click", () => { SFX.tap(); play(+b.dataset.lv); }));
      el.querySelector("#nbAlbum").addEventListener("click", () => { SFX.tap(); album(); });
      el.querySelector("#nbRank").addEventListener("click", () => { SFX.tap(); rank(); });
      const inf = el.querySelector("#nbInf"); if(S.all) inf.addEventListener("click", () => { SFX.tap(); play(0); });
    }
    async function rank(){
      el.innerHTML = `<div class="box nbLob"><h3 class="nbH">全站排行榜・無盡模式</h3><div class="k" style="text-align:center">比誰在無盡模式撐最久（12 關全破才能玩）</div><div id="nbRL"><div class="k" style="text-align:center;padding:20px">讀取中…</div></div><button class="btn" id="nbBack">回去</button></div>`;
      el.querySelector("#nbBack").addEventListener("click", () => { SFX.tap(); lobby(); });
      let r; try{ r = await ctx.rpc("nobump_rank"); }catch(e){ const L = el.querySelector("#nbRL"); if(L) L.innerHTML = `<div class="k" style="text-align:center;padding:20px">${/nobump_rank|function/i.test(String(e.message || e)) ? "排行榜還在準備中，等站長更新資料庫" : "讀不到排行榜，等一下再試"}</div>`; return; }
      const L = el.querySelector("#nbRL"); if(!L || !r) return;
      const top = r.top || [], me = r.mine;
      const row = (x, mine) => `<div class="nbRk${mine ? " me" : ""}${x.rk <= 3 ? " t" + x.rk : ""}"><b>${x.rk <= 3 ? `<i>${ART.crown}</i>` : ""}${x.rk}</b><span class="c">${Pix.sprite(x.cat || cat(), x.rk === 1 ? "love" : "happy")}</span><span class="n">${mine ? esc(ctx.me.name) + "（你）" : esc(x.name)}</span><em>${(x.best / 10).toFixed(1)} 秒<small>連擊 ${x.ic}</small></em></div>`;
      L.innerHTML = top.length ? `<div class="nbRks">${top.map(x => row(x, x.me)).join("")}${me && !top.some(x => x.me) ? `<div class="nbGap">⋯</div>${row(me, true)}` : ""}</div><div class="k" style="text-align:center">共 ${r.total || top.length} 人上榜</div>`
        : `<div class="k" style="text-align:center;padding:20px">還沒有人上榜，第一名就是你的！</div>`;
    }
    function album(){
      el.innerHTML = `<div class="box nbLob"><h3 class="nbH">下場圖鑑</h3>
        <div class="nbAlb">${FATE_IDS.map(k => { const F = FATE[k], n = S.d[k] || 0;
          return `<div class="nbFa${n ? "" : " no"}"><i>${n ? ART[F.art] : ""}</i><b>${n ? esc(F.n) : "？？？"}</b><span>${n ? esc(F.t) : "還沒遇過"}</span>${n ? `<em>${n} 次</em>` : ""}</div>`; }).join("")}</div>
        <button class="btn" id="nbBack">回去</button></div>`;
      el.querySelector("#nbBack").addEventListener("click", () => { SFX.tap(); lobby(); });
    }

    // ---------- 遊戲 ----------
    function play(n){
      stopGame();
      const INF = n === 0, L = INF ? { n:"無盡模式", hint:"撐越久越好！", dur:1e9, cb:999, plan: endlessPlan() } : LV[n - 1];
      const SPD = INF ? 1.05 : 1 + (n - 1) * .04;   // 後面的關卡東西跑得比較快
      el.innerHTML = `<div class="box nbBox"><div class="nbTop"><span>${INF ? "無盡模式" : `第 ${n} 關・${esc(L.n)}`}</span><em>${INF ? `最久 <b>${S.inf.toFixed(1)}</b> 秒` : `失敗 <b id="nbF">${S.f[n] || 0}</b> 次`}</em></div>
        <div class="m3Bar${L.boss ? " nbBossBar" : ""}"><i id="nbBar"></i>${L.boss ? `<span id="nbBossN">${esc(T[L.boss].name)}</span>` : ""}</div>
        <div class="nbF" id="nbField"><div class="nbW" id="nbW"><div class="nbCat" id="nbCat">${Pix.sprite(cat(), "normal")}</div></div><div class="nbCombo" id="nbCombo"></div><div class="nbTimer" id="nbTm"></div></div>
        <div class="nbBot"><button class="btn sub" id="nbQuit">${INF ? "結束" : "回到選關"}</button></div></div>`;
      const F = el.querySelector("#nbField"), Wd = el.querySelector("#nbW"), C = el.querySelector("#nbCat"), CB = el.querySelector("#nbCombo");
      el.querySelector("#nbQuit").addEventListener("click", () => { SFX.tap(); if(INF && !ended){ ended = true; cancelAnimationFrame(raf); endless(); } else lobby(); });
      let W = F.clientWidth, H = F.clientHeight, cx = W / 2, cy = H / 2;
      const things = [];
      let gone = false, t0 = 0, last = 0, gt = 0, idx = 0, ended = false, raf = 0, face = "normal", combo = 0, maxCombo = 0, usedPow = false, slowUntil = 0, boss = null, faceHold = 0;
      const far = () => Math.hypot(W, H) / 2 + 30;
      const setFace = f => { if(f !== face){ face = f; C.innerHTML = Pix.sprite(cat(), f); } };
      // ---- 特效 ----
      function fx(x, y, html, cls, ms){ const d = document.createElement("div"); d.className = "nbFx " + (cls || ""); d.style.left = x + "px"; d.style.top = y + "px"; d.innerHTML = html; Wd.appendChild(d); setTimeout(() => d.remove(), ms || 700); return d; }
      function shards(x, y, cols, k, big){ for(let i = 0; i < k; i++){ const a = Math.random() * 6.28, r = (big ? 60 : 34) + Math.random() * (big ? 70 : 40), d = document.createElement("i");
          d.className = "nbShard"; d.style.left = x + "px"; d.style.top = y + "px"; d.style.background = cols[i % cols.length]; const sz = (big ? 6 : 4) + (Math.random() * 3 | 0); d.style.width = d.style.height = sz + "px";
          d.style.setProperty("--dx", Math.cos(a) * r + "px"); d.style.setProperty("--dy", Math.sin(a) * r + "px"); Wd.appendChild(d); setTimeout(() => d.remove(), 520); } }
      function shake(big){ F.classList.remove("shk", "shk2"); void F.offsetWidth; F.classList.add(big ? "shk2" : "shk"); }
      function comboUi(){ CB.innerHTML = combo >= 3 ? `<b>${combo}</b><span>連擊</span>` : ""; CB.classList.toggle("hot", combo >= 10); CB.classList.remove("bump"); void CB.offsetWidth; if(combo >= 3) CB.classList.add("bump"); }
      function addCombo(x, y){ combo++; maxCombo = Math.max(maxCombo, combo); comboUi();
        tone(520 + Math.min(combo, 30) * 34, .07, { vol:.16, type:"square" });
        if([5, 10, 20, 30, 50].includes(combo) || (combo > 50 && combo % 25 === 0)){ fx(cx, cy - 70, `${combo} 連擊！`, "nbBig", 900); SFX.combo && SFX.combo(); setFace("happy"); faceHold = gt + .8; } }
      function spawn(kind, ang, x, y){
        const D0 = T[kind], D = Object.assign({}, D0, { v: D0.v * SPD }), a = ang * Math.PI / 180, r = far();
        const o = { kind, D, hp: D.hp, x: x != null ? x : cx + Math.cos(a) * r, y: y != null ? y : cy + Math.sin(a) * r, age: 0, ph: Math.random() * 6.28, el: document.createElement("div") };
        o.el.className = "nbT nb_" + kind + (D.boss ? " nbBoss" : "") + (D.pow ? " nbPow" : ""); o.el.style.width = D.s + "px"; o.el.innerHTML = ART[D.art || kind] + (D.crown ? `<i class="nbCrown">${ART.crown}</i>` : "");
        if(D.mv === "flutter"){ o.x = cx + Math.cos(a) * r; o.y = cy + Math.sin(a) * r * .6; o.tx = cx - Math.cos(a) * r; o.ty = cy - Math.sin(a) * r * .6 + (Math.random() - .5) * 60; }
        if(D.mv === "curl") o.spin = Math.random() < .5 ? 1 : -1;
        if(D.mv === "tele"){ o.next = .9; o.r = Math.min(W, H) / 2 - 20; o.ang = a; o.x = cx + Math.cos(a) * o.r; o.y = cy + Math.sin(a) * o.r; }
        if(D.boss){ o.r = Math.min(W, H) * .4; o.ang = a; o.cool = 2; o.hits = 0; boss = o; o.x = cx + Math.cos(a) * o.r; o.y = cy + Math.sin(a) * o.r; }
        Wd.appendChild(o.el); things.push(o); return o;
      }
      function kill(o, pop){ o.dead = true; o.el.classList.add(pop ? "pop" : "gone"); setTimeout(() => o.el.remove(), 260); }
      function place(o){ o.el.style.transform = `translate(${o.x - o.D.s / 2}px,${o.y - o.D.s / 2}px)${o.rot ? ` rotate(${o.rot}deg)` : ""}${o.flip ? " scaleX(-1)" : ""}`; }
      function step(o, dt){
        const D = o.D, dx = cx - o.x, dy = cy - o.y, d = Math.hypot(dx, dy) || 1; o.age += dt;
        if(D.mv === "line"){ o.x += dx / d * D.v * dt; o.y += dy / d * D.v * dt; if(o.kind === "cuke") o.rot = Math.atan2(dy, dx) * 57.3; o.flip = dx < 0 && o.kind !== "cuke"; }
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
        else if(D.mv === "boss"){   // 魔王：慢慢繞著小貓靠近，一陣子吐東西出來
          o.ang += dt * .35; o.r = Math.max(0, o.r - D.v * dt * (o.knock > 0 ? -2.5 : 1)); o.knock = (o.knock || 0) - dt;
          o.x = cx + Math.cos(o.ang) * o.r; o.y = cy + Math.sin(o.ang) * o.r; o.flip = Math.cos(o.ang) > 0;
          o.cool -= dt; if(o.cool <= 0){ o.cool = D.every; const k = D.spit[(Math.random() * D.spit.length) | 0]; spawn(k, 0, o.x, o.y); o.el.classList.remove("spit"); void o.el.offsetWidth; o.el.classList.add("spit"); tone(220, .12, { to:440, vol:.12, type:"square" }); } }
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
      function hurtBoss(o, dmg){ o.hp -= dmg; o.hits += dmg; o.knock = .25; bossUi(); o.el.classList.remove("hurt"); void o.el.offsetWidth; o.el.classList.add("hurt"); shake(false);
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
        CB.innerHTML = ""; F.classList.remove("slow");
        Wd.style.transformOrigin = `${cx}px ${cy}px`; Wd.classList.add("zoom");
        things.forEach(x => { if(x !== o && !x.dead && !(fk === "trip" && x.kind === "fly")) x.el.classList.add("fade"); });
        const say = (txt, at) => setTimeout(() => { if(alive) fx(cx, cy - 62, esc(txt), "nbSay", 2000); }, at);
        const side = o.x < cx ? -1 : 1, P_ = (cls, html, x, y, w) => { const d = document.createElement("div"); d.className = "nbProp " + cls; d.style.left = x + "px"; d.style.top = y + "px"; if(w) d.style.width = w + "px"; d.innerHTML = html; Wd.appendChild(d); return d; };
        let ms = 1900;
        const faceOf = { fly:"surprised", wet:"angry", wrap:"cry", suck:"surprised", foam:"cry", lick:"cry", vet:"cry", wake:"surprised", trip:"cry" };
        setFace(faceOf[fk] || "cry");
        if(fk === "fly"){ o.el.classList.add("fade"); P_("p_cuke", ART.cuke, cx + side * 40, cy + 20, 46); C.classList.add("sc_fly"); SFX.jump && SFX.jump(); setTimeout(() => { tone(180, .2, { vol:.3, type:"square" }); shake(true); }, 1150); say(FATE.fly.say, 1300); ms = 2300; }
        else if(fk === "wet"){ P_("p_cloud", ART.cloud, cx, cy - 58, 70); C.classList.add("sc_wet"); SFX.splash && SFX.splash(); say(FATE.wet.say, 700); ms = 2100; }
        else if(fk === "wrap"){ o.el.classList.add("fade"); P_("p_yarn", ART.yarn, cx, cy, 82); C.classList.add("sc_wrap"); say(FATE.wrap.say, 300); ms = 2100; }
        else if(fk === "suck"){ const v = P_("p_vac", ART.vac, cx + side * 78, cy - 6, 96); if(side < 0) v.classList.add("flip"); o.el.classList.add("fade"); C.style.setProperty("--sd", side); C.classList.add("sc_suck");
          tone(200, 1, { to:900, vol:.12, type:"sawtooth" }); setTimeout(() => fx(cx + side * 78, cy - 66, "嗝。", "nbSay", 1400), 1200); ms = 2300; }
        else if(fk === "foam"){ [[-22,10],[20,12],[0,-8],[-30,-14],[28,-12],[-8,22],[12,-28],[-16,-30],[26,20]].forEach(([x, y], i) => { const b = P_("p_bub", ART.bub, cx + x, cy + y, 26 + (i % 3) * 8); b.style.animationDelay = i * .12 + "s"; }); say(FATE.foam.say, 1100); ms = 2200; }
        else if(fk === "lick"){ o.el.classList.add("fade"); const dg = P_("p_dog", ART.dog, cx + side * 60, cy, 80); if(side > 0) dg.classList.add("flip"); const tg = P_("p_tongue", "", cx + side * 28, cy + 8); tg.style.setProperty("--sd", side);
          for(let i = 0; i < 5; i++) setTimeout(() => alive && fx(cx + (Math.random() - .5) * 60, cy - 20, ART.heart, "nbHeart", 1100), 300 + i * 260); C.classList.add("sc_lick"); say(FATE.lick.say, 1100); ms = 2300; }
        else if(fk === "vet"){ o.el.classList.add("fade"); P_("p_cage", ART.cage, cx, cy, 96); setTimeout(() => { tone(140, .25, { vol:.3, type:"square" }); shake(true); }, 520); say(FATE.vet.say, 900); ms = 2200; }
        else if(fk === "wake"){ P_("p_spike", "", cx, cy + 4); C.classList.add("sc_wake"); o.el.classList.add("ringing"); for(let i = 0; i < 8; i++) tone(1300 + (i % 2) * 300, .06, { vol:.1, type:"square", delay:i * .07 }); say(FATE.wake.say, 250); ms = 2000; }
        else if(fk === "trip"){ o.el.classList.add("flyaway"); C.style.setProperty("--sd", o.x < cx ? -1 : 1); C.classList.add("sc_trip"); setTimeout(() => { shake(false); tone(160, .15, { vol:.25, type:"square" });
            for(let i = 0; i < 3; i++){ const s = P_("p_star", ART.star, cx, cy - 30, 16); s.style.animationDelay = (-i * .33) + "s"; } }, 600); say(FATE.trip.say, 1000); ms = 2300; }
        return new Promise(r => setTimeout(r, ms));
      }
      function clear(){
        if(ended) return; ended = true; cancelAnimationFrame(raf);
        things.forEach(o => { if(!o.dead){ kill(o, true); shards(o.x, o.y, o.D.col, 6); } });
        const first = S.c[n] == null; if(first || (S.f[n] || 0) < S.c[n]) S.c[n] = S.f[n] || 0;
        const st = 1 + (usedPow ? 0 : 1) + (maxCombo >= L.cb ? 1 : 0); S.st[n] = Math.max(S.st[n] || 0, st);
        if(n === S.lv && n < LV.length) S.lv = n + 1;
        if(n === LV.length) S.all = true;
        keep(); sync(); SFX.level && SFX.level(); setFace("love"); CB.innerHTML = "";
        for(let i = 0; i < 6; i++) setTimeout(() => alive && shards(cx + (Math.random() - .5) * 160, cy + (Math.random() - .5) * 160, ["#ffd04a","#ff9ec4","#7fd8c4","#9fd8ff"], 10, true), i * 140);
        setTimeout(() => { if(alive && !gone) showEnd(true, null, st); }, 900);
      }
      function showEnd(win, fk, st){
        const host = el.querySelector(".nbBox"); if(!host || gone) return;
        const box = document.createElement("div"); box.className = "m3End nbEnd";
        const fails = S.f[n] || 0, hint = !win && fails >= 3 ? `<div class="nbHint">提示：${esc(L.hint)}</div>` : "";
        box.innerHTML = win
          ? `<div class="m3EndBox">${Pix.sprite(cat(), "love")}<h3>過關了！</h3>${stars(st, "big")}
              <div class="nbChk"><span class="on">過關</span><span class="${usedPow ? "" : "on"}">沒用道具</span><span class="${maxCombo >= L.cb ? "on" : ""}">連擊 ${maxCombo} / ${L.cb}</span></div>
              <div class="k">${fails ? `失敗了 ${fails} 次才過，辛苦了` : "一次就過，好厲害！"}</div>
              ${n < LV.length ? `<button class="btn" id="nbNext">下一關</button>` : `<div class="k">12 關全破！無盡模式打開了</div>`}${st < 3 ? `<button class="btn sub" id="nbAgain">再挑戰三顆星</button>` : ""}<button class="btn sub" id="nbLob">回到選關</button></div>`
          : `<div class="m3EndBox"><i class="nbFaI">${ART[FATE[fk].art]}</i><h3>${esc(FATE[fk].n)}</h3><div class="k">${esc(FATE[fk].t)}</div><div class="k">這關失敗 ${fails} 次・這次連擊 ${maxCombo}</div>${S.d[fk] === 1 ? `<div class="nbNew">新的下場收進圖鑑了！</div>` : ""}${hint}
              <button class="btn" id="nbAgain">再來一次</button><button class="btn sub" id="nbLob">回到選關</button></div>`;
        host.appendChild(box);
        const go = (id, f) => { const b = box.querySelector(id); if(b) b.addEventListener("click", () => { SFX.tap(); f(); }); };
        go("#nbAgain", () => play(n)); go("#nbNext", () => play(n + 1)); go("#nbLob", lobby);
      }
      function endless(fk){
        const host = el.querySelector(".nbBox"); if(!host || gone) return;
        const secs = Math.min(600, gt), rec = Math.round(secs * 10) > S.ib; S.ip++; if(rec){ S.ib = Math.round(secs * 10); S.ic = maxCombo; S.inf = S.ib / 10; } keep(); sync();
        const box = document.createElement("div"); box.className = "m3End nbEnd";
        box.innerHTML = `<div class="m3EndBox">${fk ? `<i class="nbFaI">${ART[FATE[fk].art]}</i><h3>${esc(FATE[fk].n)}</h3>` : `<h3>結束了</h3>`}<div class="m3Big2">${secs.toFixed(1)} 秒</div>
          <div class="k">${rec ? "新紀錄！" : `最久 ${S.inf.toFixed(1)} 秒`}・最高連擊 ${maxCombo}</div><button class="btn" id="nbAgain">再來一次</button><button class="btn sub" id="nbLob">回到選關</button></div>`;
        host.appendChild(box);
        box.querySelector("#nbAgain").addEventListener("click", () => { SFX.tap(); play(0); }); box.querySelector("#nbLob").addEventListener("click", () => { SFX.tap(); lobby(); });
      }
      F.addEventListener("pointerdown", e => {
        if(ended) return; e.preventDefault();
        const r = F.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
        fx(x, y, ART.paw, "nbPaw", 260);
        let best = null, bd = 1e9;
        things.forEach(o => { if(o.dead) return; const dd = Math.hypot(o.x - x, o.y - y); if(dd < o.D.s * .55 + 16 && dd < bd){ bd = dd; best = o; } });
        if(!best){ if(combo >= 3) fx(x, y - 16, "斷了", "nbMiss", 600); combo = 0; comboUi(); tone(240, .05, { vol:.08, type:"triangle" }); return; }
        if(best.D.friend){ fail(best); return; }
        if(best.D.pow){ power(best); return; }
        if(best.hid){ fx(x, y - 16, "看不到！", "nbMiss", 600); return; }   // 外出籠看不見的時候點不到
        if(best.D.boss){ hurtBoss(best, 1); addCombo(); tone(300 + Math.random() * 80, .06, { vol:.2, type:"square" }); return; }
        best.hp--; SFX.hit ? SFX.hit() : SFX.tap();
        if(best.hp > 0){ best.el.classList.remove("hurt"); void best.el.offsetWidth; best.el.classList.add("hurt"); shards(best.x, best.y, best.D.col, 4);
          const dx = best.x - cx, dy = best.y - cy, d = Math.hypot(dx, dy) || 1; best.x += dx / d * 26; best.y += dy / d * 26; place(best); fx(best.x, best.y - best.D.s / 2 - 6, `還有 ${best.hp} 下`, "nbHp", 500); return; }
        kill(best, true); shards(best.x, best.y, best.D.col, best.D.hp > 1 ? 14 : 9, best.D.hp > 1); if(best.D.hp > 1) shake(false);
        addCombo(best.x, best.y);
        if(best.D.split) for(let i = 0; i < best.D.split; i++) spawn("mini", 0, best.x + (i - 1) * 14, best.y + (i % 2 ? 10 : -8));
      });
      function tick(now){
        if(ended) return;
        if(!t0){ t0 = now; last = now; }
        const rdt = Math.min(.05, (now - last) / 1000); last = now;
        const slow = gt < slowUntil; if(!slow) F.classList.remove("slow");
        const dt = rdt * (slow ? .35 : 1); gt += rdt;
        if(F.clientWidth !== W || F.clientHeight !== H){ W = F.clientWidth; H = F.clientHeight; cx = W / 2; cy = H / 2; }
        while(idx < L.plan.length && L.plan[idx][0] <= gt){ const [, k, a] = L.plan[idx++]; if(T[k].boss && boss) continue; spawn(k, a); }
        let near = 1e9;
        for(const o of things){ if(o.dead) continue; step(o, dt); if(o.dead) continue;
          if(o.D.friend || o.D.pow) continue;
          const d = Math.hypot(o.x - cx, o.y - cy); near = Math.min(near, d - o.D.s * .32);
          if(d < 22 + o.D.s * .32){ fail(o); return; } }
        for(let i = things.length - 1; i >= 0; i--) if(things[i].dead && !things[i].el.isConnected) things.splice(i, 1);
        if(gt > faceHold) setFace(near < 70 ? "surprised" : "normal");
        const tm = el.querySelector("#nbTm");
        if(INF && gt >= 600){ ended = true; cancelAnimationFrame(raf); endless(); return; }
        if(INF){ if(tm) tm.textContent = gt.toFixed(1) + " 秒"; const bar = el.querySelector("#nbBar"); if(bar) bar.style.width = Math.min(100, gt / Math.max(10, S.inf) * 100) + "%"; }
        else if(L.boss){ bossUi(); }
        else { const left = Math.max(0, L.dur - gt), bar = el.querySelector("#nbBar"); if(bar){ bar.style.width = (left / L.dur * 100) + "%"; bar.classList.toggle("low", left < 3); }
          if(gt >= L.dur){ clear(); return; } }
        raf = requestAnimationFrame(tick);
      }
      raf = requestAnimationFrame(tick);
      window.__nbDbg = { spawn, fail: k => { const o = spawn(k, 0); o.x = cx + 40; o.y = cy; place(o); fail(o); } };   // 測試用
      stopGame = () => { ended = true; gone = true; cancelAnimationFrame(raf); };
    }

    this._stop = () => { alive = false; stopGame(); sync(); };
    lobby();
    ctx.getState(KEY).then(r => { if(!alive || !r) return; merge(r.state); try{ localStorage.setItem(LK, JSON.stringify(S)); }catch(e){} if(el.querySelector(".nbLob") && !el.querySelector(".nbAlb")) lobby(); }).catch(() => {});
  },
  unmount(){ if(this._stop) this._stop(); },
});
if(window.GameArt) window.GameArt.nobump = () => `<span class="gaL" style="left:30%;bottom:4%;width:42%">${Pix.sprite("orange","surprised")}</span><span class="gaL" style="left:2%;top:10%;width:34%;transform:rotate(-20deg)">${ART.cuke}</span><span class="gaL" style="right:4%;top:6%;width:22%">${ART.drop}</span><span class="gaL" style="right:2%;bottom:14%;width:26%">${ART.yarn}</span>`;
window.__nobump = { LV, T, FATE, ART };
})();

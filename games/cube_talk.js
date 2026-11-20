// 喵喵方塊島：小貓村民和他們說的話（喵喵叫＋翻譯）
// 每隻貓有個性 p：gentle 溫柔、sleepy 愛睡、peppy 活潑、foodie 貪吃、tsun 傲嬌、dreamy 愛發呆、cool 大哥、smart 博學
// 想加台詞就加在下面的陣列裡；{me} 會換成玩家的名字
(function(){
  const VILLAGERS = [
    { id:"shiro", name:"小白", color:"white",  p:"gentle", pitch:1.15, scale:.6 },
    { id:"huihui",name:"灰灰", color:"gray",   p:"sleepy", pitch:.9,  scale:.7 },
    { id:"sanhua",name:"三花", color:"calico", p:"peppy",  pitch:1.3,  scale:.5 },
    { id:"juzi",  name:"橘子", color:"orange", p:"foodie", pitch:1.0,  scale:.85 },
    { id:"heitang",name:"黑糖",color:"black",  p:"tsun",   pitch:1.2,  scale:.55 },
    { id:"naicha",name:"奶茶", color:"cream",  p:"dreamy", pitch:1.1,  scale:.6 },
    { id:"keke",  name:"可可", color:"brown",  p:"cool",   pitch:.8,   scale:.9 },
    { id:"yinxing",name:"銀杏",color:"silver", p:"smart",  pitch:1.05, scale:.65 },
  ];

  // 個性的口頭禪（每句話的最後會接）
  const TAIL = { gentle:"", sleepy:"…", peppy:"！", foodie:"", tsun:"", dreamy:"～", cool:"", smart:"" };

  const LINES = {
    gentle: [
      "今天也辛苦了，要不要在這裡坐一下？",
      "風吹過來的時候，雲會軟軟地晃一下，好舒服。",
      "我把屋子前面的小花澆過水了喔。",
      "{me}來了，島上好像變得更熱鬧了。",
      "累了就慢慢走，島又不會跑掉。",
      "我很喜歡聽大家的腳步聲，咚咚咚的。",
    ],
    sleepy: [
      "剛剛那朵雲……好像枕頭……",
      "我在練習…睜著眼睛睡覺……",
      "太陽曬在背上……暖暖的……不想動……",
      "你知道哪裡最好睡嗎……哪裡都好睡……",
      "我不是懶……我是在節省力氣……",
      "等一下…我再瞇五分鐘就陪你玩……",
    ],
    peppy: [
      "{me}！{me}！你看我可以跳多高！",
      "我今天已經繞著島跑了三圈了！",
      "我們來比賽誰先跑到大樹下！預備——",
      "雲的邊邊好刺激，我每次都只敢偷看一下！",
      "我想到一個超好玩的遊戲，可是我忘記了！",
      "你今天的睡衣好可愛！",
    ],
    foodie: [
      "你身上……是不是有小魚乾的味道？",
      "我剛剛夢到一條比我還大的魚。",
      "雲吃起來會不會像棉花糖呢？",
      "吃飽了就想睡，睡飽了就想吃，好忙。",
      "如果你有點心，可以分我一口嗎？一口就好。",
      "今天的晚餐我已經想好了，是魚。明天也是。",
    ],
    tsun: [
      "哼，我才沒有在等你。只是剛好站在這裡。",
      "你、你要摸也可以啦……只能一下喔。",
      "我才不怕高。只是不喜歡往下看而已。",
      "今天天氣還算可以，勉強給你一個好評。",
      "不、不用每天來看我啦……不過來也可以。",
      "我的毛很亮吧？我才沒有特地整理。",
    ],
    dreamy: [
      "你覺得雲的下面，還有另一座島嗎？",
      "我在數天上的雲，數到一半又飄走了。",
      "如果我是一朵雲，我想變成魚的形狀。",
      "風的味道每天都不一樣喔，今天是甜甜的。",
      "有時候我會想，星星是不是也在看我們。",
      "我剛剛想到一首歌，可是只有喵喵兩個字。",
    ],
    cool: [
      "嗯。又來了啊，{me}。",
      "這座島的每個角落我都巡過了，很安全。",
      "有誰欺負你的話，跟我說。",
      "我不太說話，但我會記得你來過。",
      "大樹那邊是我的地盤。你可以來坐。",
      "跳上屋頂？小事。只是今天不想。",
    ],
    smart: [
      "你知道嗎？貓一天可以睡十幾個小時。我正在證明這件事。",
      "我在研究為什麼這座島可以飄在天上。目前還沒有結論。",
      "雲其實是很多很多小水珠，所以它有點涼涼的。",
      "我讀過一本書，說呼嚕聲會讓人放鬆。你要聽聽看嗎？",
      "根據我的觀察，你通常都是這個時間來。",
      "我把島上的方塊都數過了。嗯……數到一半睡著了。",
    ],
  };

  // 跟時間有關的打招呼
  const GREET = {
    morning: ["早安！今天也是好天氣。", "早安，太陽剛起床，我也剛起床。", "早上的雲最白了。"],
    noon:    ["午安～中午的太陽暖暖的。", "中午了，是午睡的好時間。", "肚子有點餓了，是午餐時間嗎？"],
    evening: ["傍晚的天空變成橘色了，好漂亮。", "太陽要下山了，今天過得好嗎？", "晚霞的顏色像我的毛。"],
    night:   ["這麼晚了還沒睡呀？", "晚上的島好安靜，可以聽到星星的聲音。", "要早點休息喔。"],
  };

  // 跟熟悉度有關（0 陌生 1 認識 2 朋友 3 好朋友）
  const FRIEND = [
    ["你是新來的嗎？我是{name}，請多指教。", "我好像還不太認識你……我是{name}。"],
    ["是{me}呀，我記得你喔。", "你又來啦，{me}。"],
    ["{me}！我剛剛還在想你什麼時候會來。", "跟你聊天很開心，明天也來喔。"],
    ["{me}是我最好的朋友之一喔。", "只要你來，我就覺得今天是好日子。", "我把我最喜歡的曬太陽位置分你一半。"],
  ];

  const SLEEP = ["呼嚕……呼嚕……", "嗯……再五分鐘……", "zzz……小魚乾……zzz……", "（翻了個身，繼續睡）"];
  const PET   = { gentle:"謝謝你，好舒服。", sleepy:"呼嚕嚕……", peppy:"再一次再一次！", foodie:"摸完可以給點心嗎？", tsun:"哼、哼……還、還不錯啦。", dreamy:"像被雲摸摸一樣～", cool:"……嗯，不錯。", smart:"摸摸可以降低壓力，這是有研究的。" };

  // 把一句話變成喵語：長度跟句子差不多，問號、驚嘆號會保留
  function meowOf(text, seed){
    const end = /[？?]\s*$/.test(text) ? "？" : /[！!]\s*$/.test(text) ? "！" : /[…]\s*$/.test(text) ? "…" : "～";
    const parts = ["喵", "喵嗚", "咪", "喵喵", "嗚喵", "咪嗚", "喵～"], n = Math.max(1, Math.min(5, Math.round(text.length/7)));
    let h = seed >>> 0, out = [];
    for(let i = 0; i < n; i++){ h = (h*1103515245 + 12345) >>> 0; out.push(parts[h % parts.length]); }
    return out.join(" ").replace(/～$/, "") + end;
  }
  const hash = s => { let h = 2166136261; for(const c of s) h = Math.imul(h ^ c.codePointAt(0), 16777619); return h >>> 0; };
  const pick = (arr, seed) => arr[seed % arr.length];

  // 一次聊天的內容：打招呼 → 熟悉度 → 個性的一句話
  function talk(v, { me, friend, sleeping, hour, day, n }){
    const fill = s => s.replace(/\{me\}/g, me || "你").replace(/\{name\}/g, v.name);
    if(sleeping) return [fill(pick(SLEEP, hash(v.id + day + n)))];
    const tod = hour < 5 || hour >= 22 ? "night" : hour < 11 ? "morning" : hour < 16 ? "noon" : hour < 19 ? "evening" : "night";
    const s = hash(v.id + day + "|" + n);
    const out = [];
    if(n === 0) out.push(pick(GREET[tod], s));
    out.push(pick(FRIEND[Math.max(0, Math.min(3, friend))], s >>> 3));
    out.push(pick(LINES[v.p] || LINES.gentle, (s >>> 5) + n));
    return out.map(t => { t = fill(t); const tl = TAIL[v.p] || ""; return tl && !/[…！？～]$/.test(t) ? t.replace(/[。]$/, "") + tl : t; });
  }
  const petLine = v => PET[v.p] || PET.gentle;

  window.CubeTalk = { VILLAGERS, talk, petLine, meowOf, hash };
})();

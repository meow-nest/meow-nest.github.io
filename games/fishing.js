// 遊戲：喵喵釣魚大賽（60 秒一場，抓準時機拉竿；收集圖鑑、比最高分）
(function(){
// ---- fish catalogue: [name, rarity(0-4), shape, body, belly, fin] ----
const R = [
  { n:"普通", pts:10, w:.40, hits:1, spd:1.0, c:"#9aa3ad", p:50 },
  { n:"少見", pts:25, w:.32, hits:1, spd:1.25, c:"#5fb37d", p:28 },
  { n:"稀有", pts:60, w:.24, hits:2, spd:1.5, c:"#4f8fdc", p:15 },
  { n:"史詩", pts:150, w:.17, hits:3, spd:1.8, c:"#a66be0", p:6 },
  { n:"傳說", pts:500, w:.12, hits:4, spd:2.1, c:"#e8a628", p:1 },
];
const FISH = [
  ["小沙丁魚",0,"fish","#8fb3c9","#e8f1f6","#6d93ab"],["小鯽魚",0,"fish","#9aa58a","#e6e8d8","#7d8a6c"],["吳郭魚",0,"fish","#7d8a96","#d9dde0","#5f6b77"],
  ["小丑魚",0,"fish","#ff8a3d","#ffffff","#2b1d18"],["竹莢魚",0,"fish","#9fb7c4","#f2f6f8","#7a95a3"],["秋刀魚",0,"long","#7f95b8","#e9eef6","#5d7395"],
  ["小蝦米",0,"shrimp","#ff9e8a","#ffd9cf","#e8705a"],["寄居蟹",0,"crab","#e88a5a","#ffd0b0","#b85f35"],["舊靴子",0,"boot","#8a6a4a","#a88a68","#5a4030"],
  ["空罐罐",0,"can","#c9ced6","#ffffff","#9aa1ab"],["小河豚",0,"round","#e8d48a","#fff6d0","#b8a45a"],["鯖魚",0,"fish","#5f8fa8","#e8f0f2","#3f6f88"],
  ["黃尾鰤",1,"fish","#8fa8c0","#f0f4f8","#f0c84a"],["虹鱒",1,"fish","#9aa58f","#ffd0d8","#e87a9a"],["鱸魚",1,"fish","#6f8a78","#e0e8e0","#4f6a58"],
  ["花枝",1,"squid","#f0d0c0","#fff0e8","#d0a090"],["章魚",1,"squid","#e86a5a","#ffb0a0","#b84a3a"],["石斑",1,"fish","#a8805a","#f0dcc0","#806040"],
  ["鮭魚",1,"fish","#ff9a7a","#ffe0d0","#c8705a"],["鰻魚",1,"long","#5a6a4a","#c8d0a0","#3a4a2a"],["紅蟳",1,"crab","#d8503a","#ffb090","#a8301a"],
  ["鯛魚",1,"fish","#ff8a9a","#ffe0e6","#d85a6a"],["比目魚",1,"flat","#b89a78","#f0e6d6","#8a6a48"],["海星",1,"star","#ff9a5a","#ffd0a0","#d8703a"],
  ["鮪魚",2,"fish","#3f5f8f","#e0e8f2","#f0c84a"],["鬼頭刀",2,"fish","#5fc87a","#f0f080","#3a9a5a"],["旗魚",2,"long","#3f6fb8","#d8e6f6","#2a4f8a"],
  ["龍蝦",2,"shrimp","#c84a3a","#ff9a80","#8a2a1a"],["海馬",2,"seahorse","#f0b84a","#fff0c0","#c8902a"],["神仙魚",2,"tall","#f0f0f0","#ffffff","#3a3a3a"],
  ["鸚哥魚",2,"fish","#4ad0c0","#c0f0e8","#e870b0"],["燈籠魚",2,"round","#4a5a8a","#c0d0ff","#ffe060"],["鯉魚王",2,"fish","#ff6a3a","#ffe0a0","#ffffff"],
  ["水母",2,"jelly","#c0a0ff","#f0e8ff","#9070e0"],["藍鰭鮪",3,"fish","#2a4a8a","#e8f0ff","#4a8af0"],["翻車魚",3,"round","#a8b8c8","#f0f4f8","#7888a0"],
  ["魟魚",3,"flat","#6a7a8a","#e0e8f0","#4a5a6a"],["皇帶魚",3,"long","#e0e8f0","#ffffff","#ff5a5a"],["錘頭鯊",3,"shark","#7f8fa0","#e8eef4","#5a6a7a"],
  ["鬥魚",3,"tall","#e83a6a","#ff9ab8","#5a3ad8"],["櫻花蝦",3,"shrimp","#ffb0c8","#ffe8f0","#ff7aa0"],["夜光水母",3,"jelly","#7af0e0","#e0fff8","#4ad0c0"],
  ["彩虹鱒",3,"fish","#ff8a8a","#c0ffb0","#8a8aff"],["金魚將軍",3,"round","#ff7a2a","#ffd080","#ffffff"],["黃金鯨魚",4,"whale","#f0c040","#fff0b0","#c8902a"],
  ["龍宮使者",4,"long","#ff6a8a","#ffe0e8","#ffd040"],["星空魟",4,"flat","#2a2a5a","#8a8aff","#ffe060"],["彩虹錦鯉",4,"fish","#ff6a6a","#80ffd0","#a080ff"],
  ["貓咪魚",4,"cat","#f6b46a","#fff1df","#d98546"],["透明魚",4,"fish","#e8f8ff","#ffffff","#c0e8ff"],["鑽石蝦",4,"shrimp","#a0f0ff","#ffffff","#60c8e8"],
  ["月光鯊",4,"shark","#c8d0f0","#ffffff","#8890c0"],
  // ---- 第二批（ids 52+，接在後面才不會打亂大家的圖鑑）----
  ["鯉魚",0,"fish","#6eb995","#e0eae5","#428967"],
  ["草魚",0,"fish","#b4b96e","#eaeae0","#848942"],
  ["鰱魚",0,"fish","#70b96e","#e0eae0","#448942"],
  ["溪哥",0,"fish","#b96e72","#eae0e0","#894245"],
  ["石賓",0,"fish","#b96e7d","#eae0e2","#894250"],
  ["苦花",0,"fish","#81b96e","#e2eae0","#548942"],
  ["馬口魚",0,"fish","#6e7fb9","#e0e2ea","#425289"],
  ["大肚魚",0,"fish","#746eb9","#e1e0ea","#484289"],
  ["孔雀魚",0,"fish","#a9b96e","#e8eae0","#7a8942"],
  ["稻田魚",0,"fish","#b9796e","#eae1e0","#894d42"],
  ["烏魚",0,"fish","#866eb9","#e3e0ea","#584289"],
  ["虱目魚",0,"fish","#ae6eb9","#e9e0ea","#7e4289"],
  ["四破魚",0,"fish","#b9706e","#eae0e0","#894442"],
  ["小黃魚",0,"fish","#6eb4b9","#e0eaea","#428489"],
  ["黃魚",0,"fish","#6eb97d","#e0eae2","#428950"],
  ["肉魚",0,"fish","#b96e81","#eae0e2","#894254"],
  ["赤鯮",0,"fish","#6e73b9","#e0e0ea","#424789"],
  ["嘉鱲",0,"fish","#b96e9a","#eae0e6","#89426b"],
  ["紅目鰱",0,"fish","#b66eb9","#eae0ea","#874289"],
  ["午仔魚",0,"fish","#6e6eb9","#e0e0ea","#424289"],
  ["金線魚",0,"fish","#866eb9","#e3e0ea","#584289"],
  ["鱈魚",0,"fish","#6e78b9","#e0e1ea","#424b89"],
  ["喜相逢",0,"fish","#6eb992","#e0eae5","#428964"],
  ["丁香魚",0,"fish","#b97e6e","#eae2e0","#895142"],
  ["豆仔魚",0,"fish","#6e9cb9","#e0e6ea","#426e89"],
  ["黑鯛",0,"fish","#b96e7a","#eae0e1","#89424e"],
  ["黃錫鯛",0,"fish","#b96e87","#eae0e3","#89425a"],
  ["雀鯛",0,"fish","#b96e87","#eae0e3","#89425a"],
  ["天竺鯛",0,"fish","#6e77b9","#e0e1ea","#424a89"],
  ["臭肚魚",0,"fish","#6eb9ab","#e0eae8","#42897c"],
  ["白姑魚",0,"fish","#b9af6e","#eae9e0","#898042"],
  ["花身雞魚",0,"fish","#a76eb9","#e8e0ea","#794289"],
  ["黃鰭鯛",0,"fish","#786eb9","#e1e0ea","#4b4289"],
  ["斑馬魚",0,"fish","#6e90b9","#e0e4ea","#426289"],
  ["霓虹燈魚",0,"fish","#b96eb1","#eae0e9","#894282"],
  ["紅綠燈魚",0,"fish","#9cb96e","#e6eae0","#6e8942"],
  ["小金魚",0,"fish","#b96e9d","#eae0e6","#89426f"],
  ["草蝦虎",0,"fish","#866eb9","#e3e0ea","#584289"],
  ["彈塗魚",0,"fish","#a2b96e","#e7eae0","#748942"],
  ["蝦虎魚",0,"fish","#b86eb9","#eae0ea","#884289"],
  ["紅尾吳郭",0,"fish","#b98c6e","#eae4e0","#895e42"],
  ["布氏非鯽",0,"fish","#6e95b9","#e0e5ea","#426789"],
  ["竹筴仔",0,"fish","#6e84b9","#e0e3ea","#425789"],
  ["青鱗仔",0,"fish","#6eb998","#e0eae6","#42896a"],
  ["鰮仔魚",0,"fish","#b9b36e","#eae9e0","#898342"],
  ["石鱸",0,"fish","#6ea1b9","#e0e7ea","#427389"],
  ["雞魚",0,"fish","#b56eb9","#eae0ea","#864289"],
  ["黃雞魚",0,"fish","#6eb97f","#e0eae2","#428952"],
  ["花軟唇",0,"fish","#6eb99f","#e0eae7","#428970"],
  ["臭都魚",0,"fish","#b9836e","#eae3e0","#895642"],
  ["金錢魚",0,"fish","#b96eb1","#eae0e9","#894282"],
  ["泥鰍",0,"long","#b0b96e","#e9eae0","#818942"],
  ["鱔魚",0,"long","#6e98b9","#e0e6ea","#426a89"],
  ["白帶魚",0,"long","#b96e8d","#eae0e4","#894260"],
  ["狗母魚",0,"long","#6eb99c","#e0eae6","#42896e"],
  ["柳葉魚",0,"long","#b96e78","#eae0e1","#89424b"],
  ["吻仔魚",0,"long","#6eb983","#e0eae3","#428956"],
  ["沙梭",0,"long","#9bb96e","#e6eae0","#6d8942"],
  ["海草",0,"long","#b97c6e","#eae2e0","#894f42"],
  ["樹枝",0,"long","#7f6eb9","#e2e0ea","#524289"],
  ["針魚",0,"long","#706eb9","#e0e0ea","#444289"],
  ["鶴鱵",0,"long","#6ea0b9","#e0e7ea","#427189"],
  ["土托",0,"long","#b96e8b","#eae0e4","#89425d"],
  ["牡蠣",0,"round","#6eb9b1","#e0eae9","#428982"],
  ["文蛤",0,"round","#6eb983","#e0eae3","#428956"],
  ["蛤蜊",0,"round","#6e7db9","#e0e2ea","#425089"],
  ["海瓜子",0,"round","#6eb973","#e0eae0","#428947"],
  ["九孔",0,"round","#6eb97e","#e0eae2","#428951"],
  ["螺仔",0,"round","#b9a46e","#eae7e0","#897542"],
  ["小石頭",0,"round","#6e8bb9","#e0e4ea","#425d89"],
  ["西施舌",0,"round","#a76eb9","#e8e0ea","#794289"],
  ["田螺",0,"round","#6e87b9","#e0e3ea","#425a89"],
  ["蚵仔",0,"round","#b96eb5","#eae0ea","#894286"],
  ["竹蟶",0,"round","#b9a06e","#eae7e0","#897142"],
  ["海菜球",0,"round","#af6eb9","#e9e0ea","#804289"],
  ["草蝦",0,"shrimp","#6eb9b0","#e0eae9","#428981"],
  ["白蝦",0,"shrimp","#6eb983","#e0eae3","#428956"],
  ["沼蝦",0,"shrimp","#b98b6e","#eae4e0","#895d42"],
  ["磷蝦",0,"shrimp","#6e70b9","#e0e0ea","#424489"],
  ["小龍蝦",0,"shrimp","#b96e88","#eae0e3","#89425b"],
  ["蝦猴",0,"shrimp","#a16eb9","#e7e0ea","#734289"],
  ["劍角蝦",0,"shrimp","#6eb974","#e0eae1","#428948"],
  ["招潮蟹",0,"crab","#b9ab6e","#eae8e0","#897c42"],
  ["沙蟹",0,"crab","#866eb9","#e3e0ea","#584289"],
  ["方蟹",0,"crab","#b96e75","#eae0e1","#894249"],
  ["小毛蟹",0,"crab","#6e9fb9","#e0e7ea","#427089"],
  ["和尚蟹",0,"crab","#b9846e","#eae3e0","#895742"],
  ["寄居蟹寶寶",0,"crab","#b9ae6e","#eae9e0","#897e42"],
  ["舊拖鞋",0,"boot","#aeaa79","#e9e8e1","#7f7b4c"],
  ["破襪子",0,"boot","#aea979","#e9e8e1","#7f7a4c"],
  ["雨鞋",0,"boot","#aea179","#e9e7e1","#7f724c"],
  ["漏氣的泳圈",0,"boot","#ae9379","#e9e5e1","#7f664c"],
  ["舊帽子",0,"boot","#aea479","#e9e7e1","#7f764c"],
  ["漂流瓶",0,"can","#ae9679","#e9e5e1","#7f684c"],
  ["生鏽鐵罐",0,"can","#ae9379","#e9e5e1","#7f664c"],
  ["寶特瓶",0,"can","#aea679","#e9e8e1","#7f774c"],
  ["舊飯盒",0,"can","#ae9879","#e9e6e1","#7f6a4c"],
  ["破水桶",0,"can","#ae9d79","#e9e6e1","#7f6f4c"],
  ["小卷",0,"squid","#6e92b9","#e0e5ea","#426489"],
  ["小管",0,"squid","#6eb97a","#e0eae1","#42894e"],
  ["海月水母",0,"jelly","#6eb991","#e0eae5","#428963"],
  ["透明小水母",0,"jelly","#b9706e","#eae0e0","#894442"],
  ["小海星",0,"star","#7fb96e","#e2eae0","#528942"],
  ["沙錢",0,"star","#b06eb9","#e9e0ea","#814289"],
  ["紅喉",1,"fish","#c9ac5e","#ede9dd","#997d32"],
  ["馬頭魚",1,"fish","#795ec9","#e1dded","#4c3299"],
  ["紅甘",1,"fish","#5e75c9","#dde1ed","#324999"],
  ["青甘",1,"fish","#99c95e","#e6eddd","#6b9932"],
  ["紅魽",1,"fish","#92c95e","#e5eddd","#649932"],
  ["鰹魚",1,"fish","#c95e6c","#eddddf","#993240"],
  ["煙仔虎",1,"fish","#5ec7c9","#ddeced","#329799"],
  ["海鱺",1,"fish","#b95ec9","#eadded","#893299"],
  ["軍曹魚",1,"fish","#5ec9b9","#ddedea","#329989"],
  ["紅條",1,"fish","#5ec990","#ddede4","#329962"],
  ["牛港鰺",1,"fish","#5e82c9","#dde2ed","#325499"],
  ["白鯧仔",1,"fish","#c95ec5","#edddec","#993295"],
  ["黑格",1,"fish","#c9955e","#ede5dd","#996732"],
  ["加吉魚",1,"fish","#c95eb2","#eddde9","#993282"],
  ["赤鯮王",1,"fish","#c95e9c","#eddde6","#99326e"],
  ["黃鱲鰺",1,"fish","#abc95e","#e8eddd","#7c9932"],
  ["白北",1,"fish","#5ebec9","#ddebed","#328e99"],
  ["土魠",1,"fish","#5e71c9","#dde0ed","#324599"],
  ["鬼頭仔",1,"fish","#69c95e","#dfeddd","#3d9932"],
  ["黃金鯧",1,"fish","#5ebec9","#ddebed","#328e99"],
  ["鮸魚",1,"fish","#7cc95e","#e2eddd","#4f9932"],
  ["黃花魚",1,"fish","#be5ec9","#ebdded","#8e3299"],
  ["錦鯉",1,"fish","#c95e70","#eddde0","#993244"],
  ["地圖魚",1,"fish","#c95e90","#eddde4","#993262"],
  ["鸚鵡魚",1,"fish","#c9be5e","#edebdd","#998e32"],
  ["紅尾鯰",1,"fish","#5e89c9","#dde3ed","#325b99"],
  ["鯰魚",1,"fish","#65c95e","#deeddd","#399932"],
  ["鯝魚",1,"fish","#c95e80","#eddde2","#993253"],
  ["七星鱧",1,"fish","#9e5ec9","#e7dded","#703299"],
  ["鱸鰻仔",1,"fish","#5ec989","#ddede3","#32995b"],
  ["鯛仔王",1,"fish","#5ec992","#ddede5","#329964"],
  ["銀龍魚",1,"fish","#6e5ec9","#e0dded","#423299"],
  ["印度虎",1,"fish","#c95ea2","#eddde7","#993273"],
  ["珍珠馬甲",1,"fish","#79c95e","#e1eddd","#4c9932"],
  ["紅肚鳳凰",1,"fish","#70c95e","#e0eddd","#449932"],
  ["藍曼龍",1,"fish","#735ec9","#e0dded","#473299"],
  ["金曼龍",1,"fish","#c95e7c","#eddde2","#99324f"],
  ["小精靈魚",1,"fish","#5ea9c9","#dde8ed","#327a99"],
  ["熊貓鼠",1,"fish","#c95e83","#eddde3","#993256"],
  ["紅尾金旗",1,"fish","#5ec992","#ddede5","#329964"],
  ["銀鯧",1,"fish","#c9a35e","#ede7dd","#997532"],
  ["剝皮魚",1,"tall","#c9975e","#ede6dd","#996932"],
  ["蝴蝶魚",1,"tall","#5e65c9","#dddeed","#323999"],
  ["雙帶立旗鯛",1,"tall","#c9b95e","#edeadd","#998932"],
  ["黃金吊",1,"tall","#6c5ec9","#dfdded","#403299"],
  ["藍倒吊",1,"tall","#5ec995","#ddede5","#329967"],
  ["粉藍倒吊",1,"tall","#5ec9c9","#ddeded","#329999"],
  ["獅子魚",1,"tall","#7ec95e","#e2eddd","#519932"],
  ["七彩神仙",1,"tall","#5ec999","#ddede6","#32996b"],
  ["台灣鬥魚",1,"tall","#60c95e","#deeddd","#349932"],
  ["金鼓魚",1,"tall","#5e67c9","#dddfed","#323b99"],
  ["鐮魚",1,"tall","#c9c75e","#edecdd","#999732"],
  ["刺尾鯛",1,"tall","#c9ab5e","#ede8dd","#997c32"],
  ["皇后神仙",1,"tall","#c9bb5e","#edebdd","#998b32"],
  ["火焰神仙",1,"tall","#5ec983","#ddede3","#329956"],
  ["帆鰭魚",1,"tall","#c95eae","#eddde9","#99327f"],
  ["河魨",1,"round","#5ec9b9","#ddedea","#329989"],
  ["角箱魨",1,"round","#5ec992","#ddede5","#329964"],
  ["刺河豚",1,"round","#83c95e","#e3eddd","#569932"],
  ["獅頭金魚",1,"round","#c95eab","#eddde8","#99327c"],
  ["蘭壽",1,"round","#c95e75","#eddde1","#993249"],
  ["血鸚鵡",1,"round","#83c95e","#e3eddd","#569932"],
  ["海膽",1,"round","#c9bc5e","#edebdd","#998d32"],
  ["鮟鱇寶寶",1,"round","#c95ec0","#edddeb","#993290"],
  ["珍珠金魚",1,"round","#5e77c9","#dde1ed","#324a99"],
  ["水泡眼",1,"round","#c95e75","#eddde1","#993249"],
  ["黑摩爾",1,"round","#5ec9a9","#ddede8","#32997a"],
  ["海兔",1,"round","#7cc95e","#e2eddd","#4f9932"],
  ["牛尾魚",1,"long","#87c95e","#e3eddd","#5a9932"],
  ["鴨嘴魚",1,"long","#5eacc9","#dde9ed","#327d99"],
  ["泰國鱧",1,"long","#5e89c9","#dde3ed","#325b99"],
  ["雷龍魚",1,"long","#a7c95e","#e8eddd","#789932"],
  ["海參",1,"long","#5e97c9","#dde6ed","#326999"],
  ["鯙仔",1,"long","#5e85c9","#dde3ed","#325899"],
  ["星鰻",1,"long","#c95e61","#edddde","#993236"],
  ["白鰻",1,"long","#c9775e","#ede1dd","#994a32"],
  ["魷魚",1,"squid","#c95e71","#eddde0","#993245"],
  ["軟絲",1,"squid","#5ec969","#ddeddf","#32993d"],
  ["墨魚",1,"squid","#c9c95e","#ededdd","#999932"],
  ["長腕章魚",1,"squid","#5e89c9","#dde3ed","#325b99"],
  ["毛蟹",1,"crab","#a25ec9","#e7dded","#733299"],
  ["麵包蟹",1,"crab","#5eb9c9","#ddeaed","#328999"],
  ["青蟹",1,"crab","#805ec9","#e2dded","#533299"],
  ["花蟹",1,"crab","#5eb5c9","#ddeaed","#328699"],
  ["梭子蟹",1,"crab","#5ec99c","#ddede6","#32996e"],
  ["三點蟹",1,"crab","#c95eb5","#edddea","#993286"],
  ["胭脂蝦",1,"shrimp","#c9615e","#eddedd","#993632"],
  ["甜蝦",1,"shrimp","#5ec992","#ddede5","#329964"],
  ["牡丹蝦",1,"shrimp","#5ec971","#ddede0","#329945"],
  ["天使紅蝦",1,"shrimp","#c95e6e","#eddde0","#993242"],
  ["明蝦",1,"shrimp","#5e92c9","#dde5ed","#326499"],
  ["斑節蝦",1,"shrimp","#c9975e","#ede6dd","#996932"],
  ["火焰蝦",1,"shrimp","#5ec9bb","#ddedeb","#32998b"],
  ["月亮水母",1,"jelly","#97c95e","#e6eddd","#699932"],
  ["霞水母",1,"jelly","#5ec0c9","#ddebed","#329099"],
  ["海蜇",1,"jelly","#c9ac5e","#ede9dd","#997d32"],
  ["麵包海星",1,"star","#5ec983","#ddede3","#329956"],
  ["饅頭海星",1,"star","#8ac95e","#e4eddd","#5d9932"],
  ["藍指海星",1,"star","#5ea3c9","#dde7ed","#327599"],
  ["紅海星",1,"star","#5ec99b","#ddede6","#32996c"],
  ["小海馬",1,"seahorse","#5e75c9","#dde1ed","#324999"],
  ["刺海馬",1,"seahorse","#a55ec9","#e8dded","#773299"],
  ["鰈魚",1,"flat","#5ec997","#ddede6","#329969"],
  ["牙鮃",1,"flat","#8a5ec9","#e4dded","#5d3299"],
  ["舌鰨",1,"flat","#a9c95e","#e8eddd","#7a9932"],
  ["黃鰭鮪",2,"fish","#55d453","#dceedc","#4765d1"],
  ["大目鮪",2,"fish","#53d49e","#dceee7","#7c47d1"],
  ["長鰭鮪",2,"fish","#5398d4","#dce6ee","#d147ac"],
  ["龍膽石斑",2,"fish","#5387d4","#dce3ee","#d1479a"],
  ["老虎斑",2,"fish","#af53d4","#e9dcee","#d18e47"],
  ["東星斑",2,"fish","#d453a9","#eedce8","#bed147"],
  ["蘇眉魚",2,"fish","#5355d4","#dcdcee","#d14765"],
  ["拿破崙魚",2,"fish","#5c53d4","#dddcee","#d14759"],
  ["高體鰤",2,"fish","#9ad453","#e6eedc","#47aed1"],
  ["紅魽王",2,"fish","#d453cf","#eedcee","#d1ba47"],
  ["飛魚",2,"fish","#84d453","#e3eedc","#4797d1"],
  ["皇冠鯛",2,"fish","#d47153","#eee0dc","#47d14b"],
  ["黑毛",2,"fish","#d2d453","#eeeedc","#47d1b7"],
  ["白毛",2,"fish","#53d464","#dceede","#4750d1"],
  ["青嘴龍占",2,"fish","#9ed453","#e7eedc","#47b3d1"],
  ["紅鰭笛鯛",2,"fish","#d45378","#eedce1","#89d147"],
  ["鸚哥王",2,"fish","#d46253","#eededc","#52d147"],
  ["藍鰭鰺",2,"fish","#6453d4","#dedcee","#d14750"],
  ["浪人鰺",2,"fish","#53d48b","#dceee4","#6747d1"],
  ["紅金眼鯛",2,"fish","#abd453","#e8eedc","#47c1d1"],
  ["紅魚王",2,"fish","#d453ab","#eedce8","#c1d147"],
  ["珍珠石斑",2,"fish","#53d455","#dceedc","#4760d1"],
  ["劍旗魚",2,"long","#d453d2","#eedcee","#d1b747"],
  ["雨傘旗魚",2,"long","#d45369","#eedcdf","#79d147"],
  ["狼鰻",2,"long","#53bcd4","#dcebee","#ce47d1"],
  ["海鱔",2,"long","#d45360","#eedcde","#70d147"],
  ["裸胸鯙",2,"long","#53d47e","#dceee2","#5947d1"],
  ["花園鰻",2,"long","#53d469","#dceedf","#474bd1"],
  ["白肚鰻",2,"long","#d4538d","#eedce4","#a0d147"],
  ["帶鰆",2,"long","#d45366","#eedcdf","#77d147"],
  ["鷂魚",2,"flat","#53d4b8","#dceeea","#9747d1"],
  ["電鰩",2,"flat","#d4ad53","#eee9dc","#47d18c"],
  ["花點魟",2,"flat","#d46253","#eededc","#52d147"],
  ["牛鼻鱝",2,"flat","#53d489","#dceee3","#6547d1"],
  ["豹紋鯊",2,"shark","#53cbd4","#dcedee","#be47d1"],
  ["護士鯊",2,"shark","#d48753","#eee3dc","#47d162"],
  ["黑鰭鯊",2,"shark","#53d47a","#dceee1","#5547d1"],
  ["白鰭鯊",2,"shark","#d47553","#eee1dc","#47d150"],
  ["貓鯊",2,"shark","#b6d453","#eaeedc","#47ccd1"],
  ["斑竹鯊",2,"shark","#cd53d4","#eddcee","#d1ae47"],
  ["鮟鱇魚",2,"round","#6d53d4","#dfdcee","#d14747"],
  ["鸚鵡螺",2,"round","#5e53d4","#dddcee","#d14757"],
  ["大河豚",2,"round","#5355d4","#dcdcee","#d14765"],
  ["箱魨王",2,"round","#53d462","#dceede","#4752d1"],
  ["圓鰭魚",2,"round","#53a9d4","#dce8ee","#d147be"],
  ["擬態章魚",2,"squid","#a5d453","#e7eedc","#47bad1"],
  ["大章魚",2,"squid","#d4c553","#eeecdc","#47d1a5"],
  ["螢火魷",2,"squid","#d453a7","#eedce8","#bcd147"],
  ["透明魷魚",2,"squid","#53d457","#dceedc","#475ed1"],
  ["椰子蟹",2,"crab","#53d4a7","#dceee8","#8547d1"],
  ["旭蟹",2,"crab","#d4ab53","#eee8dc","#47d189"],
  ["松葉蟹",2,"crab","#d4d253","#eeeedc","#47d1b3"],
  ["花蟹王",2,"crab","#6d53d4","#dfdcee","#d14747"],
  ["擬石蟹",2,"crab","#53d4a2","#dceee7","#8047d1"],
  ["珊瑚蝦",2,"shrimp","#c053d4","#ebdcee","#d1a047"],
  ["清潔蝦",2,"shrimp","#d4536f","#eedce0","#80d147"],
  ["槍蝦",2,"shrimp","#cb53d4","#eddcee","#d1ac47"],
  ["雪花蝦",2,"shrimp","#d4be53","#eeebdc","#47d19e"],
  ["紅白蝦",2,"shrimp","#d4af53","#eee9dc","#47d18e"],
  ["僧帽水母",2,"jelly","#d453a9","#eedce8","#bed147"],
  ["獅鬃水母",2,"jelly","#53a9d4","#dce8ee","#d147be"],
  ["燈塔水母",2,"jelly","#d453c7","#eedcec","#d1c347"],
  ["裸鰓海蛞蝓",2,"tall","#d48453","#eee3dc","#47d160"],
  ["火焰鬥魚",2,"tall","#d48753","#eee3dc","#47d162"],
  ["藍天使",2,"tall","#5373d4","#dce0ee","#d14785"],
  ["皇帝神仙",2,"tall","#d46653","#eedfdc","#4ed147"],
  ["摩爾雕像",2,"tall","#53d49c","#dceee6","#7947d1"],
  ["草海龍",2,"seahorse","#539ad4","#dce6ee","#d147ae"],
  ["斑海馬",2,"seahorse","#539ed4","#dce7ee","#d147b3"],
  ["棘冠海星",2,"star","#8053d4","#e2dcee","#d15c47"],
  ["筐蛇尾",2,"star","#53d46b","#dceedf","#4749d1"],
  ["櫻花鯛",3,"fish","#8c48de","#e4daf0","#dc643b"],
  ["楓葉鯉",3,"fish","#de9648","#f0e5da","#3bdc6e"],
  ["招財貓魚",3,"fish","#8948de","#e4daf0","#dc613b"],
  ["肉球魚",3,"fish","#48c0de","#daebf0","#dc3bdc"],
  ["鈴鐺魚",3,"fish","#de487f","#f0dae2","#96dc3b"],
  ["罐罐魚",3,"fish","#487dde","#dae2f0","#dc3b94"],
  ["小魚乾王",3,"fish","#deca48","#f0edda","#3bdca7"],
  ["牡羊座魚",3,"fish","#48deac","#daf0e9","#863bdc"],
  ["金牛座魚",3,"fish","#de48c8","#f0daec","#dcd43b"],
  ["雙子座魚",3,"fish","#de7a48","#f0e1da","#3bdc51"],
  ["巨蟹座魚",3,"fish","#55de48","#dcf0da","#3b69dc"],
  ["獅子座魚",3,"fish","#486ede","#dae0f0","#dc3b84"],
  ["處女座魚",3,"fish","#de4d48","#f0dbda","#56dc3b"],
  ["天秤座魚",3,"fish","#de4875","#f0dae1","#8cdc3b"],
  ["天蠍座魚",3,"fish","#52de48","#dcf0da","#3b66dc"],
  ["射手座魚",3,"fish","#aade48","#e8f0da","#3bc4dc"],
  ["摩羯座魚",3,"fish","#4889de","#dae4f0","#dc3ba1"],
  ["水瓶座魚",3,"fish","#485ade","#daddf0","#dc3b6e"],
  ["雙魚座魚",3,"fish","#48de7f","#daf0e2","#563bdc"],
  ["毛線球河豚",3,"round","#d948de","#efdaf0","#dcb73b"],
  ["南瓜燈籠魚",3,"round","#48d2de","#daeef0","#c93bdc"],
  ["月餅魚",3,"round","#dea048","#f0e7da","#3bdc79"],
  ["湯圓魚",3,"round","#c848de","#ecdaf0","#dca43b"],
  ["粽子魚",3,"round","#48cdde","#daedf0","#cf3bdc"],
  ["雪花河豚",3,"round","#de4891","#f0dae5","#a9dc3b"],
  ["聖誕球魚",3,"round","#6b48de","#dfdaf0","#dc413b"],
  ["虎鯊",3,"shark","#8748de","#e3daf0","#dc5e3b"],
  ["鯨鯊寶寶",3,"shark","#48deca","#daf0ed","#a73bdc"],
  ["狐鯊",3,"shark","#b448de","#eadaf0","#dc8e3b"],
  ["長尾鯊",3,"shark","#48cfde","#daeef0","#cc3bdc"],
  ["鬼蝠魟",3,"flat","#de48af","#f0dae9","#c9dc3b"],
  ["蝠鱝",3,"flat","#8cde48","#e4f0da","#3ba4dc"],
  ["星點魟",3,"flat","#de487a","#f0dae1","#91dc3b"],
  ["大王烏賊",3,"squid","#c848de","#ecdaf0","#dca43b"],
  ["藍環章魚",3,"squid","#de5a48","#f0ddda","#49dc3b"],
  ["小飛象章魚",3,"squid","#48de8e","#daf0e4","#663bdc"],
  ["吸血鬼魷魚",3,"squid","#485fde","#dadef0","#dc3b74"],
  ["帝王蟹",3,"crab","#96de48","#e5f0da","#3bafdc"],
  ["高腳蟹",3,"crab","#aa48de","#e8daf0","#dc843b"],
  ["金色寄居蟹",3,"crab","#de5048","#f0dbda","#54dc3b"],
  ["葉海龍",3,"seahorse","#de4d48","#f0dbda","#56dc3b"],
  ["粉紅海馬",3,"seahorse","#8ede48","#e4f0da","#3ba7dc"],
  ["雪花水母",3,"jelly","#8748de","#e3daf0","#dc5e3b"],
  ["櫻花水母",3,"jelly","#48c8de","#daecf0","#d43bdc"],
  ["皇帶魚寶寶",3,"long","#4882de","#dae3f0","#dc3b99"],
  ["七彩海蛇",3,"long","#de487f","#f0dae2","#96dc3b"],
  ["龍鬚鰻",3,"long","#48decd","#daf0ed","#a93bdc"],
  ["聖誕老人魚",3,"tall","#4dde48","#dbf0da","#3b61dc"],
  ["年獸魚",3,"tall","#84de48","#e3f0da","#3b9cdc"],
  ["天燈魚",3,"tall","#7fde48","#e2f0da","#3b96dc"],
  ["鞭炮魚",3,"tall","#48de57","#daf0dc","#3b4bdc"],
  ["三花貓魚",3,"cat","#5a48de","#dddaf0","#dc3b49"],
  ["黑貓魚",3,"cat","#de48a2","#f0dae7","#bcdc3b"],
  ["橘貓魚",3,"cat","#8c48de","#e4daf0","#dc643b"],
  ["銀河鯨",4,"whale","#47ccea","#c4d0fb","#ea6547"],
  ["極光鯨",4,"whale","#eaac47","#f0fbc4","#4785ea"],
  ["雲朵鯨",4,"whale","#47a6ea","#c5c4fb","#ea8b47"],
  ["龍王",4,"fish","#ea477b","#fbd4c4","#47eab6"],
  ["鳳凰魚",4,"fish","#eadf47","#defbc4","#4752ea"],
  ["麒麟魚",4,"fish","#6aea47","#c4fbd9","#c747ea"],
  ["鑽石魚",4,"fish","#8b47ea","#fbc4fb","#a6ea47"],
  ["時光沙漏魚",4,"fish","#ea4783","#fbd1c4","#47eaae"],
  ["流星魚",4,"fish","#9e47ea","#fbc4f4","#93ea47"],
  ["太陽魚",4,"fish","#ea47e2","#fbc4d8","#47ea4f"],
  ["月亮魚",4,"fish","#ea4799","#fbcac4","#47ea98"],
  ["極光水母",4,"jelly","#474aea","#e4c4fb","#eae747"],
  ["星雲水母",4,"jelly","#65ea47","#c4fbdb","#cc47ea"],
  ["彩虹海馬",4,"seahorse","#eab947","#ebfbc4","#4778ea"],
  ["黃金招財貓",4,"cat","#47c1ea","#c4cdfb","#ea7047"],
  ["喵星王子",4,"cat","#ea5d47","#fbedc4","#47d4ea"],
  ["貓神大人",4,"cat","#ea9e47","#f4fbc4","#4793ea"],
  ["金色舊靴子",4,"boot","#47eacf","#c4e4fb","#ea4762"],
  ["海盜寶箱",4,"can","#6dea47","#c4fbd9","#c447ea"],
  ["黃金罐罐",4,"can","#eab147","#eefbc4","#4780ea"],
  ["大白鯊",4,"shark","#acea47","#c5fbc4","#8547ea"],
  ["巨齒鯊",4,"shark","#ea47b1","#fbc4c7","#47ea80"],
  ["大王酸漿魷",4,"squid","#8347ea","#fac4fb","#aeea47"],
  ["許願星星",4,"star","#eaa647","#f1fbc4","#478bea"],
  ["珍珠蚌",4,"round","#eab947","#ebfbc4","#4778ea"],
].map((f,i)=>({ id:i, n:f[0], r:f[1], shape:f[2], b:f[3], l:f[4], f:f[5] }));

const SHAPES = {
  fish:  ["...FF......","..FBBBB...F",".BBBBBBB.FF","BEBBBBBBBFF","BBLLLLLBB.F",".BLLLLLB...","..FF......."],
  long:  ["............FF","..BBBBBBBBBBF.","BEBBBBBBBBBBBF","BBLLLLLLLLLLF.","..LLLLLLLLL..."],
  round: ["...F.F...","..BBBBB..",".BBBBBBB.","BEBBBBBBF","BBLLLLLBF",".BLLLLLB.","..BBBBB..","...F.F..."],
  tall:  ["....F.....","...FBB....","..BBBBB..F",".BEBBBBBFF",".BBLLLBBFF","..BBLLB..F","...BBB....","....F....."],
  flat:  ["....BBBB....","..BBBBBBBB..",".BBEBBBBBBB.","BBBBBBBBBBBB",".BBLLLLLLBB.","..BBBBBBBB.F","....BBBB..FF"],
  shark: [".....F.......","....FBB......","..BBBBBBBB..F",".BEBBBBBBBBFF","BBBLLLLLLBB.F",".BLLLLLLLB...","...F.........."],
  whale: ["............FF","...BBBBBB...F.","..BBBBBBBBBBF.",".BEBBBBBBBBBB.","BBLLLLLLLLBB..",".BLLLLLLLLB...","..BBBBBBBB...."],
  shrimp:["F........",".F.BBBB..","..BBBBBB.","..BEBBBBF","...BLLLBF","....BBBF.","......F.."],
  crab:  ["F.......F","FF.....FF",".F.E.E.F.","..BBBBB..",".BBBBBBB.","BBLLLLLBB",".F.F.F.F."],
  squid: ["..BBBB..",".BBBBBB.","BBEBBEBB","BBBBBBBB",".LLLLLL.",".F.F.F.F","F.F.F.F."],
  jelly: ["..BBBB..",".BBBBBB.","BBLBBLBB","BBBBBBBB",".F.F.F.F",".F..F..F","..F..F.."],
  seahorse:["..BBB.",".BEBBB","..BBF.","..BLF.","..BLB.","...BB.","..BB..","..B..."],
  star:  ["....B....","...BLB...","BBBBLBBBB",".BBLELBB.","..BBLBB..",".BB...BB.","BB.....BB"],
  boot:  ["..BBBB..","..BLLB..","..BLLB..","..BLLB..",".BBBBBBB","BBBBBBBB","FFFFFFFF"],
  can:   [".FFFFFF.","BBBBBBBB","BLLLLLLB","BL.EE.LB","BLLLLLLB","BBBBBBBB",".FFFFFF."],
  cat:   ["F.....F...","FB...BF...","BBBBBBB..F","BEBBBEB.FF","BBBLBBBBFF",".BLLLLB..F","..BBBB...."],
};
function fishSvg(f, silhouette){
  const rows = SHAPES[f.shape]||SHAPES.fish, w = rows[0].length, h = rows.length, pal = silhouette ? {B:"#3a3040",L:"#3a3040",F:"#3a3040",E:"#3a3040"} : {B:f.b,L:f.l,F:f.f,E:"#1d1a22"};
  let r = ""; rows.forEach((row,y)=>[...row].forEach((c,x)=>{ if(pal[c]) r += `<rect x="${x}" y="${y}" width="1.03" height="1.03" fill="${pal[c]}"/>`; }));
  const S = Math.max(w,h);
  return `<svg viewBox="${-(S-w)/2-.5} ${-(S-h)/2-.5} ${S+1} ${S+1}" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg">${r}</svg>`;
}
function rollFish(){
  let x = Math.random()*100, tier = 0;
  for(let i=0;i<R.length;i++){ if(x < R[i].p){ tier = i; break; } x -= R[i].p; }
  const pool = FISH.filter(f=>f.r===tier); return pool[(Math.random()*pool.length)|0];
}

App.registerGame({
  id: "fishing",
  solo: true,
  name: "釣魚大賽",
  desc: `60 秒釣魚，收集 ${FISH.length} 種魚`,
  icon: () => fishSvg(FISH[44]),
  mount(el, ctx){
    const { sprite, esc, SFX } = ctx;
    let s = null, view = "lobby", game = null, timers = [];
    el.innerHTML = `<div class="box fs" id="fsBox"></div>`;
    const box = el.querySelector("#fsBox");
    const me = () => ctx.me.uid;
    const clearT = () => { timers.forEach(t=>{ clearTimeout(t); clearInterval(t); }); timers = []; };
    const later = (fn, ms) => timers.push(setTimeout(fn, ms));

    function lobby(){
      view = "lobby"; clearT();
      const p = ctx.partner(), dex = (s && s.dex) || {}, best = (s && s.best) || {};
      const mine = Object.keys(dex[me()]||{}).length, theirs = p ? Object.keys(dex[p.user_id]||{}).length : 0;
      const last = s && s.lastCatch;
      box.innerHTML = `<div class="fsHero">${sprite(ctx.me.cat,"happy")}<div class="fsRod"></div><div class="fsWater"></div></div>
        <div class="fsBoard">
          <div><b>${esc(ctx.me.name)}</b><span>最高 ${best[me()]||0} 分</span><span>圖鑑 ${mine}/${FISH.length}</span></div>
          ${p?`<div><b>${esc(p.name)}</b><span>最高 ${best[p.user_id]||0} 分</span><span>圖鑑 ${theirs}/${FISH.length}</span></div>`:""}
        </div>
        ${last ? `<div class="fsNews">📣 ${esc(ctx.nameOf(last.by))} 剛剛釣到 <b style="color:${R[FISH[last.id].r].c}">${R[FISH[last.id].r].n}・${esc(FISH[last.id].n)}</b>！</div>` : ""}
        <button class="btn fsGo" id="fsGo">開始釣魚！（60 秒）</button>
        <button class="btn sub" id="fsDex" style="width:100%;margin-top:8px">📖 圖鑑</button>
        <div class="fsRules">拋竿 → 浮標往下沉就快按「拉竿！」→ 看指針跑進綠色區域時按下去。<br>越稀有的魚，綠色區越窄、要按中的次數越多。</div>`;
      box.querySelector("#fsGo").addEventListener("click", start);
      box.querySelector("#fsDex").addEventListener("click", dexView);
    }
    function dexView(){
      view = "dex";
      const p = ctx.partner(), dex = (s && s.dex) || {}, mine = dex[me()]||{}, theirs = p ? (dex[p.user_id]||{}) : {};
      const tab = dexView.tab == null ? -1 : dexView.tab, list = (tab<0 ? FISH.slice() : FISH.filter(f=>f.r===tab)).sort((a,b)=>a.r-b.r||a.id-b.id);
      const cnt = r => FISH.filter(f=>(r<0||f.r===r) && mine[f.id]).length + "/" + FISH.filter(f=>r<0||f.r===r).length;
      box.innerHTML = `<div class="fsDexHd"><button class="btn sub" id="fsBack">◀ 返回</button><b>魚類圖鑑 ${Object.keys(mine).filter(k=>FISH[k]).length}/${FISH.length}</b></div>
        <div class="fsTabs">${[-1,0,1,2,3,4].map(r=>`<button data-r="${r}" class="${r===tab?"on":""}" style="${r>=0?`border-color:${R[r].c}`:""}">${r<0?"全部":R[r].n}<i>${cnt(r)}</i></button>`).join("")}</div>
        <div class="fsDex">${list.map(f=>{ const n = mine[f.id]||0, t = theirs[f.id]||0;
          return `<div class="fsCell ${n?"":"un"}" style="border-color:${R[f.r].c}">${fishSvg(f, !n)}<b>${n?esc(f.n):"？？？"}</b><i style="color:${R[f.r].c}">${R[f.r].n}</i>${n?`<span>x${n}</span>`:""}${t?`<em title="${p?esc(p.name):""}">💗</em>`:""}</div>`; }).join("")}</div>
        <div class="fsRules">💗 = ${p?esc(p.name):"對方"} 也釣過</div>`;
      box.querySelector("#fsBack").addEventListener("click", lobby);
      box.querySelectorAll("[data-r]").forEach(b=>b.addEventListener("click", ()=>{ dexView.tab = +b.dataset.r; dexView(); }));
    }
    // ---- one 60-second session ----
    function start(){
      view = "play"; clearT();
      game = { t:60, score:0, caught:[], phase:"idle", fish:null, hits:0, miss:0, pos:0, dir:1, zone:0 };
      box.innerHTML = `<div class="fsTop"><span id="fsT">⏱ 60</span><button class="fsQuit" id="fsQuit">🏳️ 退出</button><span id="fsS">0 分</span></div>
        <div class="fsPond" id="fsPond"><div class="fsCat">${sprite(ctx.me.cat,"normal")}</div><div class="fsLine" id="fsLine"></div><div class="fsBob" id="fsBob"></div><div class="fsBang hidden" id="fsBang">！</div><div class="fsCatch hidden" id="fsCatch"></div></div>
        <div class="fsReel hidden" id="fsReel"><div class="bar"><i class="zone" id="fsZone"></i><i class="needle" id="fsNeedle"></i></div><div class="lives" id="fsLives"></div></div>
        <button class="btn fsAct" id="fsAct">拋竿！</button>`;
      const act = box.querySelector("#fsAct");
      act.addEventListener("pointerdown", e=>{ e.preventDefault(); action(); });
      // quit mid-game: nothing from this round counts (no score, no dex, no fish for the cats)
      let quitT = 0;
      box.querySelector("#fsQuit").addEventListener("click", e=>{
        const q = e.currentTarget;
        if(!q.classList.contains("ask")){ q.classList.add("ask"); q.textContent = "確定？這場不算"; SFX.tap(); clearTimeout(quitT); quitT = setTimeout(()=>{ q.classList.remove("ask"); q.textContent = "🏳️ 退出"; }, 3000); return; }
        clearTimeout(quitT); clearT(); game.phase = "end"; game = null; SFX.next();
        ctx.toast(`${sprite(ctx.me.cat,"sleep")} 這場不算，下次再來釣～`); lobby();
      });
      timers.push(setInterval(()=>{ game.t--; box.querySelector("#fsT").textContent = "⏱ "+game.t; if(game.t<=5 && game.t>0) SFX.beep(false); if(game.t<=0) finish(); }, 1000));
    }
    function setAct(t, cls){ const a = box.querySelector("#fsAct"); if(a){ a.textContent = t; a.className = "btn fsAct "+(cls||""); } }
    function action(){
      if(!game || game.t<=0) return;
      if(game.phase==="idle"){ cast(); }
      else if(game.phase==="wait"){ // pulled too early
        SFX.splash(); flash("太早了！魚跑掉了"); reset();
      } else if(game.phase==="bite"){ hook(); }
      else if(game.phase==="reel"){ reelTap(); }
    }
    function reset(){ game.phase="idle"; setAct("拋竿！"); const b=box.querySelector("#fsBob"); if(b) b.className="fsBob"; box.querySelector("#fsBang").classList.add("hidden"); box.querySelector("#fsReel").classList.add("hidden"); }
    function cast(){
      game.phase = "wait"; SFX.jump(); setAct("等魚上鉤…","wait");
      const bob = box.querySelector("#fsBob"); bob.className = "fsBob in";
      game.fish = rollFish();
      later(()=>{ if(game.phase!=="wait") return;
        game.phase = "bite"; bob.className = "fsBob in bite"; box.querySelector("#fsBang").classList.remove("hidden"); SFX.beep(true); setAct("拉竿！","go");
        if(navigator.vibrate) try{ navigator.vibrate(60); }catch(e){}
        later(()=>{ if(game.phase==="bite"){ SFX.splash(); flash("太慢了～魚跑掉了"); reset(); } }, 900);
      }, 1000 + Math.random()*2600);
    }
    function hook(){
      const tier = R[game.fish.r];
      game.phase = "reel"; game.hits = 0; game.miss = 0; game.pos = 0; game.dir = 1;
      box.querySelector("#fsBang").classList.add("hidden");
      const reel = box.querySelector("#fsReel"); reel.classList.remove("hidden");
      newZone(); setAct("按！","go"); SFX.charge();
      const step = () => { if(game.phase!=="reel") return; game.pos += game.dir * 0.018 * tier.spd; if(game.pos>1){ game.pos=1; game.dir=-1; } if(game.pos<0){ game.pos=0; game.dir=1; } box.querySelector("#fsNeedle").style.left = (game.pos*100)+"%"; };
      timers.push(setInterval(step, 16));
      lives();
    }
    function newZone(){ const w = R[game.fish.r].w; game.zone = Math.random()*(1-w); const z = box.querySelector("#fsZone"); z.style.left=(game.zone*100)+"%"; z.style.width=(w*100)+"%"; }
    function lives(){ const t = R[game.fish.r]; box.querySelector("#fsLives").innerHTML = `${"🎯".repeat(game.hits)}${"⚪".repeat(t.hits-game.hits)}　${"❤️".repeat(3-game.miss)}${"🖤".repeat(game.miss)}`; }
    function reelTap(){
      const t = R[game.fish.r], w = t.w;
      if(game.pos >= game.zone && game.pos <= game.zone + w){
        game.hits++; SFX.coin(); box.querySelector("#fsZone").animate([{filter:"brightness(1.6)"},{filter:"brightness(1)"}],{duration:200});
        if(game.hits >= t.hits){ caught(); return; }
        newZone();
      } else { game.miss++; SFX.miss(); box.querySelector("#fsReel").animate([{transform:"translateX(-6px)"},{transform:"translateX(6px)"},{transform:"none"}],{duration:200});
        if(game.miss >= 3){ clearT2(); flash("線斷了！魚跑掉了 😿"); reset(); return; } }
      lives();
    }
    function clearT2(){ /* stop needle interval (keep the clock) */ const clock = timers[0]; timers.slice(1).forEach(t=>{ clearInterval(t); clearTimeout(t); }); timers = [clock]; }
    function caught(){
      clearT2();
      const f = game.fish, t = R[f.r], cm = Math.round((8 + f.r*15 + Math.random()*(10+f.r*20))*10)/10;
      game.score += t.pts; game.caught.push(f.id);
      box.querySelector("#fsS").textContent = game.score + " 分";
      const c = box.querySelector("#fsCatch"); c.classList.remove("hidden");
      c.innerHTML = `<div class="fsCard" style="border-color:${t.c}"><i style="background:${t.c}">${t.n}</i>${fishSvg(f)}<b>${esc(f.n)}</b><span>${cm} cm・+${t.pts} 分</span></div>`;
      c.firstChild.animate([{transform:"scale(.3) rotate(-10deg)",opacity:0},{transform:"scale(1.15) rotate(3deg)",opacity:1,offset:.6},{transform:"scale(1)"}],{duration:450,easing:"ease-out"});
      if(f.r>=3){ SFX.level(); ctx.burst(); } else SFX.match();
      game.phase = "show"; box.querySelector("#fsReel").classList.add("hidden"); setAct("…");
      if(f.r>=3) save({ big: f.id });
      later(()=>{ c.classList.add("hidden"); if(game.t>0) reset(); }, f.r>=3 ? 1800 : 1100);
    }
    function flash(text){ const b = box.querySelector("#fsCatch"); b.classList.remove("hidden"); b.innerHTML = `<div class="fsMiss">${text}</div>`; later(()=>b.classList.add("hidden"), 900); }
    async function save(opt){
      opt = opt||{};
      const ids = game.caught.slice(), score = game.score;
      const ns = await ctx.update("fishing", st=>{
        st = st || { dex:{}, best:{}, lastCatch:null };
        const d = st.dex[me()] = st.dex[me()] || {};
        if(opt.final){ for(const id of ids) d[id] = (d[id]||0) + 1; if(score > (st.best[me()]||0)) st.best[me()] = score; }
        if(opt.big!=null) st.lastCatch = { by: me(), id: opt.big, at: Date.now() };
        return st;
      });
      if(opt.big!=null){ const f = FISH[opt.big]; ctx.notifyPartner(`${ctx.me.name} 在「釣魚大賽」釣到了${R[f.r].n}級的「${f.n}」！`); }
      return ns;
    }
    async function finish(){
      if(!game || game.phase==="end") return;
      clearT(); game.phase = "end";
      const prevBest = (s && s.best && s.best[me()]) || 0, prevDex = Object.keys((s && s.dex && s.dex[me()])||{});
      const newOnes = [...new Set(game.caught)].filter(id=>!prevDex.includes(String(id)));
      await save({ final:true });
      const rec = game.score > prevBest;
      if(rec && game.score>0){ ctx.notifyPartner(`${ctx.me.name} 在「釣魚大賽」刷新紀錄：${game.score} 分！`); }
      box.innerHTML = `<div class="fsEnd"><div class="fsBig">${sprite(ctx.me.cat, game.score?"love":"sleep")}</div>
        <div class="fsScore">${game.score} 分${rec&&game.score?`<em>新紀錄！</em>`:""}</div>
        <div>釣到 ${game.caught.length} 條魚${newOnes.length?`・<b>新圖鑑 +${newOnes.length}</b>`:""}</div>
        <div class="fsGot">${game.caught.map(id=>`<span title="${esc(FISH[id].n)}">${fishSvg(FISH[id])}</span>`).join("")||"（今天魚都不太餓…）"}</div>
        <button class="btn" id="fsAgain">再釣一場</button><button class="btn sub" id="fsHome" style="width:100%;margin-top:8px">回釣魚池</button></div>`;
      if(rec && game.score){ SFX.level(); ctx.burst(); } else SFX.next();
      box.querySelector("#fsAgain").addEventListener("click", start);
      box.querySelector("#fsHome").addEventListener("click", lobby);
    }
    this._u = ctx.onState("fishing", st=>{ s = st; if(view==="lobby") lobby(); });
    this._clear = clearT;
    (async()=>{ const cur = await ctx.getState("fishing"); s = cur ? JSON.parse(JSON.stringify(cur.state)) : null; lobby(); })();
  },
  unmount(){ if(this._u) this._u(); if(this._clear) this._clear(); },
});
})();

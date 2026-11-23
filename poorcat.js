// 乞丐貓（站長送大家的禮物）：12 種顏色 pc1～pc12，三套造型會輪流換裝
// 圖是 tools/poorcat_gen.html 用畫的方式產生的像素（換造型、換表情時重新產生，見 tools/poorcat_build.py）
(function(){
const DATA = /*PCDATA*/{"looks":[{"base":["...........OO.......OOO.........O.............","..........OYYO..OOOO②②①OOO.....OYO............","..........OYYOOO②②②②②①②①①①O...OYYO............","..........OYYY①①②②①②①②①②①①①OOOYYYOO...........","..........OYP①①②①②①②①②①①②①①①①①①①①①①O..........",".........OYYP①①②①②①②①①②①nnnn①①①①①①①①O.........",".........OYY①①①②①②①nnnnnnnnnn①①①①①②②OOO.......",".........OYY①①②nnnnnnnnnn①①①①①①①①②②②②②②O......","........OO①①nnnnnnnn①①①①①①①①①①①②②②②OOOO.......","......OO①①①①nnnn①①①①①①①①①①①①②②②②②②②②O.........",".....O①①①①①①①①①①①①①①①①①①①②②②②②YYYYOO②O........","....O①①①①①①①①①①①①①①①①②②②②②②②YYYYYYYOO.........","...O②②②①①①①①①①①①②②②②②②②②YY②YYYYYYYYYO.........","..O②O②②②②②②②②②②②②②②②YYYYYYY②GGYYYYYYO.........",".O②O.O②Y②②②②②②②GGGYYYYYYYYG7GGGYYYYYYO........","..O.O②OYYYYYYG②7GGGYYYYYYG77GGGYYYYYYO........","...O②OYYYYYYGG77GGGYYYYYYG77GGGGYYYYYYO.......","....OOYYYYYYGGGGGGGYYYYYYGGGGGGGYYYYYYO.......",".....OYYYYYYYGGGG7GYYYYYYGGGG7GGYYYYYYO.......",".....OYYYYYYYGGhhGYYYYYYYYGhhGGYYYYYYYYO......",".....OYYYYYYBBBGGWWWWWWWWWWGGBBBYYYYYYYO......",".....OYYYYYYBBBYWWWWWWWWWWWWYBBBYYYYYYYO......",".....OYYYYYYYYYYWWWWWWnWWWWWWzzYYYYYYYYO..O...",".....OYYYYYYYYYYWWWWWnnWWWWWWzzYYYYYYYO..OSOO.",".....OYYYYYYYYYYWWWWWWWWWWWWYYYYYYYYYYO.OSSSSO",".....OYYYYYYYYYYYWWWWWWWWWWYYYYYYYYYYYOOSSSSSO",".....OYxxxxxxxxxxxxxxxxxxxxxxxxxxxxxXYOSSSSSSO","....OYYYYxxxxxxxxxxxxxxxxxxxxxxxxxxYYYYSSSSSSO","....OYYYYxxxxxxxxxxxxxxxxxxxxxxxxxxYYYYYSSSSO.","....OYWWYxxxxxxxxxxxxxxxxxxxxxxxxxxYWWWYSSSO..","....OWWWWxxxxxububxxxxxxxxxxxxxxxxxWWWWYYYO...",".....OWWOOxxxxbubbxxxxxxxxxxxxxxxxYYYWYYYO....","......OO..OxxxbbbuxxxxxxxxxxxxxxxYYYYYYOO.....","...........OOxububxxxxxxxxxxxxxOOOYOOOO.......",".............OYYYxxxxxxYYxcccYO...O...........",".............OYYYWxxxYYYYYcWYYYO..............",".............OWWWWWWYOOOWWWWWWYO..............",".............OWWWWWWO..OWWWWWWO...............","..............OWWWWO....OWWWWO................","...............OOOO......OOOO................."],"face":{"happy":{"13":"..O②O②②②②②②②②②②②②②②②YYYYYYY②YYYYYYYYO.........","14":".O②O.O②Y②②②②②②②YYYYYYYYYYYYYYYYYYYYYYO........","15":"..O.O②OYYYYYYY②YYYYYYYYYYYYYYYYYYYYYYO........","16":"...O②OYYYYYYYYGGGGYYYYYYYYGGGGYYYYYYYYO.......","17":"....OOYYYYYYYGGYYGGYYYYYYYGYYYGYYYYYYYO.......","18":".....OYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYO.......","19":".....OYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYO......","20":".....OYYYYYYBBBYYYWWWWWWWWYYYBBBYYYYYYYO......","22":".....OYYYYYYYYYYWWWWWWWWWWWWWzzYYYYYYYYO..O..."},"sleep":{"13":"..O②O②②②②②②②②②②②②②②②YYYYYYY②YYYYYYYYO.........","14":".O②O.O②Y②②②②②②②YYYYYYYYYYYYYYYYYYYYYYO........","15":"..O.O②OYYYYYYY②YYYYYYYYYYYYYYYYYYYYYYO........","16":"...O②OYYYYYYY②YYYYYYYYYYYYYYYYYYYYYYYYO.......","17":"....OOYYYYYYYGGGGGYYYYYYYYGGGGGYYYYYYYO.......","18":".....OYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYO.......","19":".....OYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYO......","20":".....OYYYYYYBBBYYYWWWWWWWWYYYBBBYYYYYYYO......","22":".....OYYYYYYYYYYWWWWWWWWWWWWWzzYYYYYYYYO..O...","23":".....OYYYYYYYYYYWWWWMMMMWWWWWzzYYYYYYYO..OSOO."},"love":{"13":"..O②O②②②②②②②②②②②②②②②YYYYYYY②YYYYYYYYO.........","14":".O②O.O②Y②②②②②②②YYYYYYYYYYYYYYYYYYYYYYO........","15":"..O.O②OYYYYYY⑤②⑤⑤⑤⑤YYYYYY⑤7⑤⑤⑤⑤YYYYYYO........","16":"...O②OYYYYYYY⑤⑤⑤⑤⑤⑤YYYYYY⑤⑤⑤⑤⑤⑤YYYYYYYO.......","17":"....OOYYYYYYY⑤⑤⑤⑤⑤YYYYYYYY⑤⑤⑤⑤⑤YYYYYYYO.......","18":".....OYYYYYYYY⑤⑤⑤⑤YYYYYYYY⑤⑤⑤⑤YYYYYYYYO.......","19":".....OYYYYYYYYY⑤⑤YYYYYYYYYY⑤⑤YYYYYYYYYYO......","20":".....OYYYYYYBBBYYYWWWWWWWWYYYBBBYYYYYYYO......","22":".....OYYYYYYYYYYWWWWMMMWWWWWWzzYYYYYYYYO..O...","23":".....OYYYYYYYYYYWWWWMMWMWWWWWzzYYYYYYYO..OSOO."},"angry":{"10":".....O①①①①①①①①①①①①①①①①①①①②②②②②GYYYOO②O........","11":"....O①①①①①①①①①①①①①①①①②②②②②②②GGYYYYYOO.........","12":"...O②②②①①①①①①①①①②②②②②②②②YY②②YYYYYYYYO.........","13":"..O②O②②②②②②②②②②②②②②②YYYYYYY②YYYYYYYYO.........","14":".O②O.O②Y②②②②②②②YYYYYYYYYYYYYYYYYYYYYYO........","15":"..O.O②OYYYYYYY②YYYYYYYYYYYYYYYYYYYYYYO........","16":"...O②OYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYO.......","17":"....OOYYYYYYYGGGGGGYYYYYYYGGGGGYYYYYYYO.......","18":".....OYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYO.......","19":".....OYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYO......","20":".....OYYYYYYBBBYYYWWWWWWWWYYYBBBYYYYYYYO......","22":".....OYYYYYYYYYYWWWWWWWMWWWWWzzYYYYYYYYO..O...","23":".....OYYYYYYYYYYWWWWMMMMMWWWWzzYYYYYYYO..OSOO."},"cry":{"11":"....O①①①①①①①①①①①①①①①①②②②②②②②YGGYYYYOO.........","18":".....OYYYYYYYGhhhhGYYYYYYGhhhhhGYYYYYYO.......","19":".....OYYYYYYYGhhhGYYYYYYYYGhhGGYYYYYYYYO......","22":".....OYYYYYYYTTYWWWWWWWMWWWWWzzYYYYYYYYO..O...","23":".....OYYYYYYYTTYWWWWMMMMMWWWWzzYYYYYYYO..OSOO."},"surprised":{"13":"..O②O②②②②②②②②②②②②②②②YYYYYYY②7YYYYYYYO.........","14":".O②O.O②Y②②②②②②②777YYYYYYYY77777YYYYYYO........","15":"..O.O②OYYYYYY7②7777YYYYYY777777YYYYYYO........","16":"...O②OYYYYYYY77GG77YYYYYY77GG777YYYYYYO.......","17":"....OOYYYYYYY77GG77YYYYYY77GG777YYYYYYO.......","18":".....OYYYYYYY777777YYYYYY777777YYYYYYYO.......","19":".....OYYYYYYY77777YYYYYYYY77777YYYYYYYYO......","20":".....OYYYYYYBBB77WWWWWWWWWW77BBBYYYYYYYO......"}}},{"base":["...........OO.......OOO.........O.............","..........OYYO..OOOO②②①OOO.....OYO............","..........OYYOOO②②②②②①②①①①O...OYYO............","..........OYYY①①②②①②①②①②①①①OOOYYYOO...........","..........OYP①①②①②①②①②①①②①①①①①①①①①①O..........",".........OYYP①①②①②①②①①②①nnnn①①①①①①①①O.........",".........OYY①①①②①②①nnnnnnnnnn①①①①①②②OOO.......",".........OYY①①②nnnnnnnnnn①①①①①①①①②②②②②②O......","........OO①①nnnnnnnn①①①①①①①①①①①②②②②OOOO.......","......OO①①①①nnnn①①①①①①①①①①①①②②②②②②②②O.........",".....O①①①①①①①①①①①①①①①①①①①②②②②②YYYYOO②O........","....O①①①①①①①①①①①①①①①①②②②②②②②YYYYYYYOO.........","...O②②②①①①①①①①①①②②②②②②②②YY②YYYYYYYYYO.........","..O②O②②②②②②②②②②②②②②②YYYYYYY②YYYYYYYYO.........",".O②O.O②Y②②②②②②②YYYYYYYYYYYYYYYYYYYYYYO........","..O.O②OYYYYYYY②YYYYYYYYYYYYYYYYYYYYYYO........","...O②OYYYYYYYY②GGYYYYYYYYYY7GYYYYYYYYYO.......","....OOYYYYYYYYGGGYYYYYYYYYYGGGYYYYYYYYO.......",".....OYYYYYYYYYGGYYYYYYYYYYGGGYYYYYYYYO.......",".....OYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYO......",".....OYYYYYYBBBYYYWWWWWWWWYYYBBBYYYYYYYO......",".....OYYYYYYBBBYWWWWWWWWWWWWYBBBYYYYYYYO......",".OOOOOYYYYYYYYYYWWWWMMMWWWWWWzzYYYYYYYYOOOO...","O③③③③③③③③③③YOOOOOOWWMMWMWWOOOXXOY③③③③③③③③③③OO.",".O③③③③③③③③③OOWWWWOOWWWWWWOOWWWWOO③③③③③③③③③SSSO","..OO③③③③③③③OWWSWSWOWWWWWWOWWSWSWO③③③③③③③SSSSSO","...O④④④④④④④OWWSWSWOttttttOWWSWSWO④④④④④④④SSSSSO","...O④④④④④④④④OWWWWO④tttttt④OWWWWO④④④④④④④④SSSSSO","...O④④④④④④④④④OOOO④④tttttt④④OOOO④④④④④④④④④SSSSO.","...O④④④④④④④④④④④④④④④④④④④④④④④④④④④④④④④④④④④④SSSO..","...O④④④④④④④④④④④④④④④④④④④④④④④④④④④④④④④④④④④④YYO...","...O④④④④④④④④④④④④④④④④④④④④④④④④④④④④④④④④④④④④YO....","...O④④④④④④④④④④④④④④④④④④④④④④④④④④④④④④④④④④④④O.....","...O④④④④④④④④④④④④④④④④④④④④④④④④④④④④④④④④④④④④O.....","...O④④④④④④④④④④④④④④④④④④④④④④④④④④④④④④④④④④④④O.....","...O④④④④④④④④④④④④④④④④④④④④④④④④④④④④④④④④④④④④O.....","...O④④④④④④④④④④④④④④④④④④④④④④④④④④④④④④④④④④④④O.....","....OOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOO......","..............................................",".............................................."],"face":{"happy":{"16":"...O②OYYYYYYYYGGGGYYYYYYYYGGGGYYYYYYYYO.......","17":"....OOYYYYYYYGGYYGGYYYYYYYGYYYGYYYYYYYO.......","18":".....OYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYO.......","22":".OOOOOYYYYYYYYYYWWWWWWWWWWWWWzzYYYYYYYYOOOO...","23":"O③③③③③③③③③③YOOOOOOWWWnnWWWOOOXXOY③③③③③③③③③③OO."},"sleep":{"16":"...O②OYYYYYYY②YYYYYYYYYYYYYYYYYYYYYYYYO.......","17":"....OOYYYYYYYGGGGGYYYYYYYYGGGGGYYYYYYYO.......","18":".....OYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYO.......","22":".OOOOOYYYYYYYYYYWWWWWWWWWWWWWzzYYYYYYYYOOOO...","23":"O③③③③③③③③③③YOOOOOOWWMMMMWWOOOXXOY③③③③③③③③③③OO."},"love":{"15":"..O.O②OYYYYYY⑤②⑤⑤⑤⑤YYYYYY⑤7⑤⑤⑤⑤YYYYYYO........","16":"...O②OYYYYYYY⑤⑤⑤⑤⑤⑤YYYYYY⑤⑤⑤⑤⑤⑤YYYYYYYO.......","17":"....OOYYYYYYY⑤⑤⑤⑤⑤YYYYYYYY⑤⑤⑤⑤⑤YYYYYYYO.......","18":".....OYYYYYYYY⑤⑤⑤⑤YYYYYYYY⑤⑤⑤⑤YYYYYYYYO.......","19":".....OYYYYYYYYY⑤⑤YYYYYYYYYY⑤⑤YYYYYYYYYYO......"},"angry":{"10":".....O①①①①①①①①①①①①①①①①①①①②②②②②GYYYOO②O........","11":"....O①①①①①①①①①①①①①①①①②②②②②②②GGYYYYYOO.........","12":"...O②②②①①①①①①①①①②②②②②②②②YY②②YYYYYYYYO.........","16":"...O②OYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYO.......","17":"....OOYYYYYYYGGGGGGYYYYYYYGGGGGYYYYYYYO.......","18":".....OYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYO.......","22":".OOOOOYYYYYYYYYYWWWWWWWMWWWWWzzYYYYYYYYOOOO...","23":"O③③③③③③③③③③YOOOOOOWWMMMMMWOOOXXOY③③③③③③③③③③OO."},"cry":{"11":"....O①①①①①①①①①①①①①①①①②②②②②②②YGGYYYYOO.........","13":"..O②O②②②②②②②②②②②②②②②YYYYYYY②GGYYYYYYO.........","14":".O②O.O②Y②②②②②②②GGGYYYYYYYYG7GGGYYYYYYO........","15":"..O.O②OYYYYYYG②7GGGYYYYYYG77GGGYYYYYYO........","16":"...O②OYYYYYYGG77GGGYYYYYYG77GGGGYYYYYYO.......","17":"....OOYYYYYYGGGGGGGYYYYYYGGGGGGGYYYYYYO.......","18":".....OYYYYYYYGhhhhGYYYYYYGhhhhhGYYYYYYO.......","19":".....OYYYYYYYGhhhGYYYYYYYYGhhGGYYYYYYYYO......","20":".....OYYYYYYBBBGGWWWWWWWWWWGGBBBYYYYYYYO......","22":".OOOOOYYYYYYYTTYWWWWWWWMWWWWWzzYYYYYYYYOOOO...","23":"O③③③③③③③③③③YOTTOOOWWMMMMMWOOOzzOY③③③③③③③③③③OO."},"surprised":{"13":"..O②O②②②②②②②②②②②②②②②YYYYYYY②7YYYYYYYO.........","14":".O②O.O②Y②②②②②②②777YYYYYYYY77777YYYYYYO........","15":"..O.O②OYYYYYY7②7777YYYYYY777777YYYYYYO........","16":"...O②OYYYYYYY77GG77YYYYYY77GG777YYYYYYO.......","17":"....OOYYYYYYY77GG77YYYYYY77GG777YYYYYYO.......","18":".....OYYYYYYY777777YYYYYY777777YYYYYYYO.......","19":".....OYYYYYYY77777YYYYYYYY77777YYYYYYYYO......","20":".....OYYYYYYBBB77WWWWWWWWWW77BBBYYYYYYYO......","22":".OOOOOYYYYYYYYYYWWWWWWnWWWWWWzzYYYYYYYYOOOO...","23":"O③③③③③③③③③③YOOOOOOWWWnnWWWOOOXXOY③③③③③③③③③③OO."}}},{"base":["...........OO.......OOO.........O.............","..........OYYO..OOOO②②①OOO.....OYO............","..........OYYOOO②②②②②①②①①①O...OYYO............","..........OYYY①①②②①②①②①②①①①OOOYYYOO...........","..........OYP①①②①②①②①②①①②①①①①①①①①①①O..........",".........OYYP①①②①②①②①①②①nnnn①①①①①①①①O.........",".........OYY①①①②①②①nnnnnnnnnn①①①①①②②OOO.......",".........OYY①①②nnnnnnnnnn①①①①①①①①②②②②②②O......","........OO①①nnnnnnnn①①①①①①①①①①①②②②②OOOO.......","......OO①①①①nnnn①①①①①①①①①①①①②②②②②②②②O.........",".....O①①①①①①①①①①①①①①①①①①①②②②②②YYYYOO②O........","....O①①①①①①①①①①①①①①①①②②②②②②②YYYYYYYOO.........","...O②②②①①①①①①①①①②②②②②②②②YY②YYYYYYYYYO.........","..O②O②②②②②②②②②②②②②②②YYYYYYY②GGYYYYYYO.........",".O②O.O②Y②②②②②②②GGGYYYYYYYYG7GGGYYYYYYO........","..O.O②OYYYYYYG②7GGGYYYYYYG77GGGYYYYYYO........","...O②OYYYYYYGG77GGGYYYYYYG77GGGGYYYYYYO.......","....OOYYYYYYGGGGGGGYYYYYYGGGGGGGYYYYYYO.......",".....OYYYYYYYGGGG7GYYYYYYGGGG7GGYYYYYYO.......",".....OYYYYYYYGGhhGYYYYYYYYGhhGGYYYYYYYYO......",".....OYYYYYYBBttGWWWWWWWWWWGGBBBYYYYYYYO......",".....OYYYYYYttttWWWWWWWWWWWWYBBBYYYYYYYO......",".....OYYYYYYttYYWWWWWWnWWWWWWzzYYYYYYYYO..O...",".....OYYYYYYYYYYWWWWWnnWWWWWWzzYYYYYYYO..OSOO.",".....OYYYYYYYYYYWWWWWWWWWWWWYYYYYYYYYYO.OSSSSO",".....OYYYYYYYYYYYWWWWWWWWWWYYYYYYYYYYYOOSSSSSO",".....OYxxxxxxxxxxxxxxxxxzzzzzzzzzzzzzYOSSSSSSO","....OYYYYxxxxxxxxxxxxxxzzzzzzzzzzzzYYYYSSSSSSO","....OYYYYxxxxxxxxxxxxxzzzzzzzzzzzzzYYYYYSSSSO.","....OYWWYxxxxxxxxxxxxzzzzzzbbbzzzzzYWWWYSSSO..","....OWWWWrrrxxxxxxxxzzzzzzzbbbzzzzzWWWWYYYO...",".....OWWOOrrrrrrrrrzzzzzzzzbbbzzzzYYYWYYYO....","......OO..OxxxxxxrrrrrrrrzzzzzzzzYYYYYYOO.....","...........OOxxxxzzzzzzzrrrrrrrOOOYOOOO.......",".............OYcczzzzzzYYzzzzYO...O...........",".............OYYWWzzzYYYYYWWYYYO..............",".............OWWWWWWYOOOWWWWWWYO..............",".............OWWWWWWO..OWWWWWWO...............","..............OWWWWO....OWWWWO................","...............OOOO......OOOO................."],"face":{"happy":{"13":"..O②O②②②②②②②②②②②②②②②YYYYYYY②YYYYYYYYO.........","14":".O②O.O②Y②②②②②②②YYYYYYYYYYYYYYYYYYYYYYO........","15":"..O.O②OYYYYYYY②YYYYYYYYYYYYYYYYYYYYYYO........","16":"...O②OYYYYYYYYGGGGYYYYYYYYGGGGYYYYYYYYO.......","17":"....OOYYYYYYYGGYYGGYYYYYYYGYYYGYYYYYYYO.......","18":".....OYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYO.......","19":".....OYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYO......","20":".....OYYYYYYBBttYYWWWWWWWWYYYBBBYYYYYYYO......","22":".....OYYYYYYttYYWWWWWWWWWWWWWzzYYYYYYYYO..O..."},"sleep":{"13":"..O②O②②②②②②②②②②②②②②②YYYYYYY②YYYYYYYYO.........","14":".O②O.O②Y②②②②②②②YYYYYYYYYYYYYYYYYYYYYYO........","15":"..O.O②OYYYYYYY②YYYYYYYYYYYYYYYYYYYYYYO........","16":"...O②OYYYYYYY②YYYYYYYYYYYYYYYYYYYYYYYYO.......","17":"....OOYYYYYYYGGGGGYYYYYYYYGGGGGYYYYYYYO.......","18":".....OYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYO.......","19":".....OYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYO......","20":".....OYYYYYYBBttYYWWWWWWWWYYYBBBYYYYYYYO......","22":".....OYYYYYYttYYWWWWWWWWWWWWWzzYYYYYYYYO..O...","23":".....OYYYYYYYYYYWWWWMMMMWWWWWzzYYYYYYYO..OSOO."},"love":{"13":"..O②O②②②②②②②②②②②②②②②YYYYYYY②YYYYYYYYO.........","14":".O②O.O②Y②②②②②②②YYYYYYYYYYYYYYYYYYYYYYO........","15":"..O.O②OYYYYYY⑤②⑤⑤⑤⑤YYYYYY⑤7⑤⑤⑤⑤YYYYYYO........","16":"...O②OYYYYYYY⑤⑤⑤⑤⑤⑤YYYYYY⑤⑤⑤⑤⑤⑤YYYYYYYO.......","17":"....OOYYYYYYY⑤⑤⑤⑤⑤YYYYYYYY⑤⑤⑤⑤⑤YYYYYYYO.......","18":".....OYYYYYYYY⑤⑤⑤⑤YYYYYYYY⑤⑤⑤⑤YYYYYYYYO.......","19":".....OYYYYYYYYY⑤⑤YYYYYYYYYY⑤⑤YYYYYYYYYYO......","20":".....OYYYYYYBBttYYWWWWWWWWYYYBBBYYYYYYYO......","22":".....OYYYYYYttYYWWWWMMMWWWWWWzzYYYYYYYYO..O...","23":".....OYYYYYYYYYYWWWWMMWMWWWWWzzYYYYYYYO..OSOO."},"angry":{"10":".....O①①①①①①①①①①①①①①①①①①①②②②②②GYYYOO②O........","11":"....O①①①①①①①①①①①①①①①①②②②②②②②GGYYYYYOO.........","12":"...O②②②①①①①①①①①①②②②②②②②②YY②②YYYYYYYYO.........","13":"..O②O②②②②②②②②②②②②②②②YYYYYYY②YYYYYYYYO.........","14":".O②O.O②Y②②②②②②②YYYYYYYYYYYYYYYYYYYYYYO........","15":"..O.O②OYYYYYYY②YYYYYYYYYYYYYYYYYYYYYYO........","16":"...O②OYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYO.......","17":"....OOYYYYYYYGGGGGGYYYYYYYGGGGGYYYYYYYO.......","18":".....OYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYO.......","19":".....OYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYO......","20":".....OYYYYYYBBttYYWWWWWWWWYYYBBBYYYYYYYO......","22":".....OYYYYYYttYYWWWWWWWMWWWWWzzYYYYYYYYO..O...","23":".....OYYYYYYYYYYWWWWMMMMMWWWWzzYYYYYYYO..OSOO."},"cry":{"11":"....O①①①①①①①①①①①①①①①①②②②②②②②YGGYYYYOO.........","18":".....OYYYYYYYGhhhhGYYYYYYGhhhhhGYYYYYYO.......","19":".....OYYYYYYYGhhhGYYYYYYYYGhhGGYYYYYYYYO......","22":".....OYYYYYYttTYWWWWWWWMWWWWWzzYYYYYYYYO..O...","23":".....OYYYYYYYTTYWWWWMMMMMWWWWzzYYYYYYYO..OSOO."},"surprised":{"13":"..O②O②②②②②②②②②②②②②②②YYYYYYY②7YYYYYYYO.........","14":".O②O.O②Y②②②②②②②777YYYYYYYY77777YYYYYYO........","15":"..O.O②OYYYYYY7②7777YYYYYY777777YYYYYYO........","16":"...O②OYYYYYYY77GG77YYYYYY77GG777YYYYYYO.......","17":"....OOYYYYYYY77GG77YYYYYY77GG777YYYYYYO.......","18":".....OYYYYYYY777777YYYYYY777777YYYYYYYO.......","19":".....OYYYYYYY77777YYYYYYYY77777YYYYYYYYO......","20":".....OYYYYYYBBtt7WWWWWWWWWW77BBBYYYYYYYO......"}}}],"pal":{"7":"#ffffff","O":"#4a3428","Y":"#efe3d3","②":"#c9954e","①":"#f2d27a","P":"#f4a7b4","n":"#e94f6b","G":"#2f221c","h":"#cfe6ff","B":"#f4a0aa","W":"#fffaf3","z":"#c2ab8a","S":"#d7c3a8","x":"#a9906f","X":"#8c7456","u":"#fff6e6","b":"#86b4e0","c":"#f5a8bd","M":"#7a5236","⑤":"#ff5f8a","T":"#8fd0ff","③":"#e2c08e","④":"#c9a06a","t":"#f7f1e4","r":"#d8b26a"},"box":{"body":["..........................................","..........................................","..........................................","..........................................","..........................................","..........................................","..........................................","..........................................","..........................................","..........................................","..........................................","..........................................","..........................................","..........................................","..........................................","..........................................","..........................................","....OOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOO....","...O8888888888888888888888888888888888O...","...O8133333333333468444553333333182228O...","...O1133333333333464444553333333112222O...","...O1111111111111464444551111111112222O...","...O1111111111111464444551111111112222O...","...O1111111111111464444551111711712222O...","...O1117117111111464444551111177112222O...","...O1111771111111464444551111177112222O...","...O1111771111111464444551111111112222O...","...O1111111111111464444551111111112222O...","...O1111111111111464444551111111112222O...","...O1111111111111464444551111111112222O...","...O1111111111111464444551111111112222O...","...O1111111111111464444551111111112222O...","...O1111111117117464444551111111112222O...","...O1111111111771464444551111111712722O...","...O1111111111771464444551111111177222O...","...O1117117111111464444551111111177222O...","...O1111771111111464444551111111112222O...","...O1111771111111464444551111111112222O...","...O2111111111111464444551111111122222O...","...O2222222222222464444552222222222222O...","...O2222222222222464444552222222222222O...","....O22222222222246444455222222222222O....",".....OOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOO....."],"lid":["........OOOOOO..............OOOOOO........","......OO554444OOO.........OO544455OO......",".....O55444444445O......OO4444444445O.....","....O5544666444444OOOOOO4444446664455O....","....O54446666644444444454444666664445O....","....O54444466644444644444444666644445O....","....O55444444455544444445555444444455O....","....O55444444455544444445555444444455O....",".....O554444445555444444555544444455O.....","......O5544444445544444555444444455O......","..OOOOOO55544444445555554444444555OOOOOO..",".O11111111111111146444445111111111112222O.","O1133333333333333464444453333333333112222O","O1133333333333334464444455333333333112222O","O1111111111111111464444451111111111112222O","O1111111111111111464444451111111111112222O","O2111111111111111464444451111111111122222O","O2222222222222222464444452222222222222222O",".O22222222222222246444445222222222222222O.","..OOOOOOOOOOOO5555OOOOOO5555OOOOOOOOOOOO..","............O55555O....O55555O............","............O5O55O......O55O55O...........",".............O.O5O......O55OOO............","................O........OO...............","..........................................","..........................................","..........................................","..........................................","..........................................","..........................................","..........................................","..........................................","..........................................","..........................................","..........................................","..........................................","..........................................","..........................................","..........................................","..........................................","..........................................","..........................................",".........................................."],"pal":{"1":"#ff9cc0","2":"#f2789f","3":"#ffd3e2","4":"#ffe07a","5":"#f0b93e","6":"#fff7c9","7":"#ffffff","8":"#d95a86","O":"#4a3428"}}}/*END*/;
const COLS = [
  ["奶油","#efe3d3","#d7c3a8"],["橘子","#ffc68c","#f0a060"],["灰灰","#c9ccd8","#a3a7b9"],["雪白","#ffffff","#e4e0ea"],
  ["可可","#a8775e","#8a5e48"],["黑糖","#4a4452","#37323e"],["虎斑","#e8c9a0","#b98d5c"],["蜜桃","#ffd6c8","#f4aa96"],
  ["檸檬","#fff0b0","#efd36c"],["薄荷","#cdeedd","#9fd5bc"],["天空","#d2e6fb","#9fc4ec"],["薰衣草","#e2d8f6","#bcaee6"],
];
const LOOK_N = ["歪草帽・破斗篷","住紙箱的日子","包紮好繼續討飯"];
const FACE = { normal:"normal", happy:"happy", wave:"happy", sleep:"sleep", loaf:"sleep", curl:"sleep", love:"love", angry:"angry", cry:"cry", surprised:"surprised" };
const colOf = c => Math.max(1, Math.min(12, +String(c).slice(2) || 1));
const cache = {};
function rows(look, face){
  const L = DATA.looks[look] || DATA.looks[0], d = face !== "normal" && L.face[face] || {};
  return L.base.map((r, i) => d[i] || r);
}
function palOf(c, soft){
  const k = COLS[colOf(c) - 1], p = Object.assign({}, DATA.pal, { Y: k[1], S: k[2] });
  if(colOf(c) === 6) p.O = "#2a2430";                // 黑糖：外框再深一點
  if(soft) p.O = k[2];
  return p;
}
function sprite(c, kind, opts, look){
  look = look || 0; const face = FACE[kind] || "normal", soft = !!(opts && opts.soft);
  const key = c + face + look + (soft ? "s" : "");
  if(cache[key]) return cache[key];
  return cache[key] = pix(rows(look, face), palOf(c, soft), { pad: 1 });
}
const heart = () => (window.Pix && Pix.icon) ? Pix.icon("heart") : "";

// ---- 會動的乞丐貓：呼吸、眨眼、每隔一陣子跳起來在雲裡換裝、點一下開心跳 ----
function live(el, c, o){
  o = o || {};
  const base = FACE[o.face] || "normal";
  if(el._pc && el._pc.c === c && el.querySelector(".pcL")){ if(el._pc.base !== base){ el._pc.base = base; if(!el._pc.busy) el._pc.setFace(base); } return; }
  if(el._pc) clearInterval(el._pc.tm);
  const S = el._pc = { c, base, look: 0, face: base, busy: 0, tm: 0, next: Date.now() + 6000 + Math.random()*3000, blink: Date.now() + 2000 + Math.random()*2000 };
  el.innerHTML = `<span class="pcL"><span class="pcB">${sprite(c, base, null, 0)}</span><span class="pcFx"></span></span>`;
  const L = el.querySelector(".pcL"), Bd = el.querySelector(".pcB"), Fx = el.querySelector(".pcFx");
  const paint = () => { Bd.innerHTML = sprite(c, S.face, null, S.look); };
  const setFace = f => { if(S.face !== f){ S.face = f; paint(); } };
  const swap = () => {
    if(S.busy) return; S.busy = 1;
    L.classList.remove("hop"); void L.offsetWidth; L.classList.add("swap");
    Fx.innerHTML = `<span class="pcPuff">${'<i></i>'.repeat(9)}</span>`;
    setTimeout(() => { S.look = (S.look + 1) % DATA.looks.length; S.face = "happy"; paint(); }, 380);
    setTimeout(() => { Fx.innerHTML = `<span class="pcStar">${'<i></i>'.repeat(8)}</span>`; }, 560);
    setTimeout(() => { setFace(S.base); }, 1100);
    setTimeout(() => { L.classList.remove("swap"); Fx.innerHTML = ""; S.busy = 0; }, 1500);
  };
  const hop = () => {
    if(S.busy) return; S.busy = 1;
    L.classList.remove("swap"); void L.offsetWidth; L.classList.add("hop"); setFace("happy");
    if(!o.quiet){ Fx.innerHTML = `<span class="pcHearts">${[0,1,2].map(i => `<i style="animation-delay:${i*.12}s">${heart()}</i>`).join("")}</span>`;
      if(o.sfx) try{ o.sfx(); }catch(e){} }
    setTimeout(() => { setFace(S.base); L.classList.remove("hop"); }, 900);
    setTimeout(() => { Fx.innerHTML = ""; S.busy = 0; }, 1400);
  };
  if(!o.noTap) L.addEventListener("click", e => { hop(); S.next = Math.max(S.next, Date.now() + 3000); });
  S.tm = setInterval(() => {
    if(!L.isConnected){ clearInterval(S.tm); return; }
    if(document.hidden) return;
    const now = Date.now();
    if(S.base === "sleep") return;   // 睡覺中（例如對方不在線上）：不眨眼也不換裝
    if(!S.busy && now > S.blink && S.base === "normal"){ setFace("sleep"); setTimeout(() => { if(!S.busy && S.face === "sleep") setFace(S.base); }, 140); S.blink = now + 2500 + Math.random()*3000; }
    if(now > S.next){ S.next = now + (o.every || 9000) + Math.random()*4000; swap(); }
  }, 200);
  S.swap = swap; S.hop = hop; S.setFace = setFace;
}

// ---- 禮物盒：點一下打開（顏色由伺服器隨機決定，每個人只能開一次）----
function gift(o){
  const box = pix(DATA.box.body, DATA.box.pal, { pad: 1 }), lid = pix(DATA.box.lid, DATA.box.pal, { pad: 1 });
  const ov = document.createElement("div"); ov.className = "pcGift";
  ov.innerHTML = `<div class="pgStage">
      <div class="pgGlow"></div><div class="pgRay r2"></div><div class="pgRay r1"></div><div class="pgRing"></div>
      <div class="pgShadow"></div>
      <div class="pgCat"></div>
      <div class="pgBox">${box}</div><div class="pgLid">${lid}</div>
      <div class="pgFx"></div><div class="pgFlash"></div>
      <div class="pgBan"></div>
      <div class="pgCap">${o.title || "站長給你的小禮物"}<small>點一下打開</small></div>
      <div class="pgBtns"></div>
      ${o.later === false ? "" : `<button class="pgLater">等一下再開</button>`}
    </div>`;
  document.body.appendChild(ov);
  const q = s => ov.querySelector(s), stage = q(".pgStage");
  const fit = () => { const k = Math.min(window.innerWidth / 390, window.innerHeight / 620, 1.3); stage.style.transform = `scale(${k})`; };
  fit(); window.addEventListener("resize", fit);
  let phase = "idle", t0 = performance.now(), tOpen = 0, col = 0, raf = 0, err = null;
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const CFC = ["#ff8fb1","#ffd24a","#8fd0ff","#9fe0b0","#c9a8ff","#ffffff","#ffb27a"];
  const CF = Array.from({length: 60}, () => ({ a: rnd()*Math.PI*2, v: 220 + rnd()*320, c: CFC[Math.floor(rnd()*CFC.length)], r: rnd()*720 - 360, w: 6 + rnd()*6, h: 4 + rnd()*8, d: rnd()*.15 }));
  const GL = Array.from({length: 22}, () => ({ x: rnd()*390, s: rnd(), v: 40 + rnd()*60, w: .5 + rnd()*.8 }));
  const TW = Array.from({length: 7}, (_, i) => ({ a: i/7*Math.PI*2 + .4, r: 105 + rnd()*30, p: rnd() }));
  const close = () => { if(ov._closed) return; ov._closed = 1; try{ o.onClose && o.onClose(); }catch(e){} cancelAnimationFrame(raf); window.removeEventListener("resize", fit); ov.classList.add("out"); setTimeout(() => ov.remove(), 300); };
  const later = q(".pgLater"); if(later) later.addEventListener("click", e => { e.stopPropagation(); close(); o.onLater && o.onLater(); });
  const sfx = n => { try{ o.sfx && o.sfx[n] && o.sfx[n](); }catch(e){} };
  stage.addEventListener("click", async () => {
    if(phase !== "idle") return;
    phase = "shake"; t0 = performance.now(); sfx("tap"); if(later) later.remove();
    q(".pgCap").innerHTML = "搖搖搖⋯⋯好像有東西";
    try{ col = await o.open(); if(!col) throw new Error("no"); }catch(e){ err = e; }
  });
  const ease = x => { x = Math.max(0, Math.min(1, x)); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3*Math.pow(x-1, 3) + c1*Math.pow(x-1, 2); };
  let lastFace = "";
  const frame = now => {
    raf = requestAnimationFrame(frame);
    let u = (now - t0) / 1000;
    if(phase === "idle") u = u % 2.6;
    if(phase === "shake"){
      if(err){ phase = "fail"; q(".pgCap").innerHTML = "禮物盒卡住了⋯⋯等一下再試試看<small>（網路不穩或還沒更新）</small>"; setTimeout(close, 2600); return; }
      if(u >= 1.0 && col){ phase = "open"; tOpen = now; q(".pgCap").innerHTML = ""; sfx("boom"); setTimeout(() => sfx("level"), 350); }
      u = Math.min(u, 1.0 + ((now - t0)/1000 - 1.0) % .5);
    }
    // 盒子
    let brot = 0, bsy = 1, by = 0;
    const v = phase === "open" ? (now - tOpen)/1000 : -1;
    if(phase === "idle"){ const b = Math.max(0, Math.sin(u*Math.PI*2/0.9)); by = -b*10; bsy = 1 + b*.03; }
    else if(phase === "shake" || phase === "fail"){ const k = Math.min(1, u); brot = Math.sin(u*Math.PI*2*(3.5 + k*7))*(2 + k*8); bsy = 1 - k*.07; by = -Math.abs(Math.sin(u*30))*k*5; }
    const lq = v < 0 ? 0 : Math.min(1, v/.7), bq = v < .6 ? 0 : Math.min(1, (v-.6)/.3);
    q(".pgBox").style.transform = `translateY(${by}px) rotate(${brot}deg) scale(${(1 + (1-bsy)*.6)*(1 - bq*.3)},${bsy*(1 - bq*.5)})`;
    q(".pgBox").style.opacity = 1 - bq;
    q(".pgLid").style.transform = v >= 0 ? `translate(${-lq*170}px, ${-Math.sin(lq*Math.PI*.75)*230 + lq*60}px) rotate(${-lq*320}deg) scale(${1 - lq*.3})` : `translateY(${by - (1-bsy)*150}px) rotate(${brot}deg)`;
    q(".pgLid").style.opacity = v >= 0 ? 1 - Math.max(0, (lq - .6)/.4) : 1;
    const glow = phase === "idle" ? .25 + Math.sin(u*4)*.08 : v < 0 ? .3 + Math.min(1,u)*.7 : Math.max(.35, 1 - v*.25);
    q(".pgGlow").style.opacity = glow; q(".pgGlow").style.transform = `scale(${1 + (v > 0 ? Math.min(.6, v) : 0)})`;
    const ro = v < 0 ? 0 : v < .3 ? v/.3 : Math.max(.35, 1 - (v - .3)*.25), rs = .6 + Math.min(1, Math.max(0, v)*2)*.4, ts = now/1000;
    q(".r1").style.opacity = ro; q(".r2").style.opacity = ro*.9;
    q(".r1").style.transform = `rotate(${ts*28}deg) scale(${rs})`; q(".r2").style.transform = `rotate(${-ts*18}deg) scale(${rs})`;
    const rq = v/.6, ring = q(".pgRing"); if(rq > 0 && rq < 1){ const R = 30 + rq*220; ring.style.opacity = 1 - rq; ring.style.width = ring.style.height = R*2 + "px"; ring.style.marginLeft = ring.style.marginTop = -R + "px"; ring.style.borderWidth = (8*(1 - rq) + 1) + "px"; } else ring.style.opacity = 0;
    q(".pgFlash").style.opacity = v > 0 && v < .2 ? (1 - v/.2)*.85 : 0;
    // 貓
    const cat = q(".pgCat");
    if(v > .05){
      let y = 0, sx = 1, sy = 1, face = "normal";
      if(v < .7){ const k = (v - .05)/.65; y = -30 - Math.sin(k*Math.PI)*170 + k*30; sx = sy = .4 + k*.6; face = "happy"; }
      else if(v < .92){ const k = (v - .7)/.22; sy = 1 - Math.sin(k*Math.PI)*.14; sx = 1 + Math.sin(k*Math.PI)*.1; face = "happy"; }
      else { const br = Math.sin(v*2*Math.PI/1.6); sx = 1 - br*.018; sy = 1 + br*.022; if(v < 1.7) face = "happy"; }
      if(lastFace !== face){ cat.innerHTML = sprite("pc" + col, face); lastFace = face; }
      cat.style.display = ""; cat.style.transform = `translateY(${y}px) scale(${sx},${sy})`;
    } else cat.style.display = "none";
    // 特效
    let fx = "";
    if(v < 0){ TW.forEach(p => { const tw = Math.max(0, Math.sin((ts*2.2 + p.p)*Math.PI*2)); const r = p.r - (phase !== "idle" ? Math.min(1,u)*25 : 0); fx += `<i class="tw" style="left:${195 + Math.cos(p.a)*r - 7}px;top:${310 + Math.sin(p.a)*r*.7 - 7}px;opacity:${tw};transform:scale(${.4 + tw*.8}) rotate(${ts*90}deg)"></i>`; }); }
    if(phase === "shake"){ const k = Math.min(1, u); for(let i = 0; i < 5; i++){ const ph = (ts*3 + i*.2) % 1; fx += `<i class="sp" style="left:${150 + i*22}px;top:${320 - ph*70}px;opacity:${(1 - ph)*k};transform:scale(${1 + k})"></i>`; } }
    if(v > 0){ CF.forEach(p => { const t2 = v - p.d; if(t2 <= 0) return; const x = 195 + Math.cos(p.a)*p.v*t2*.9, yy = 320 + Math.sin(p.a)*p.v*t2*.7 - 160*t2 + 260*t2*t2; if(yy > 640) return; fx += `<i class="cf" style="left:${x}px;top:${yy}px;width:${p.w}px;height:${p.h*Math.abs(Math.cos(t2*6 + p.r)) + 2}px;background:${p.c};transform:rotate(${p.r*t2}deg)"></i>`; }); }
    if(v > .3){ const tt = v - .3; GL.forEach(p => { const yy = ((p.s*620 + tt*p.v) % 620) - 20; fx += `<i class="tw" style="left:${p.x}px;top:${yy}px;transform:scale(${p.w*(.6 + .4*Math.sin(tt*5 + p.x))});opacity:${Math.min(1, tt*2)*.9}"></i>`; }); }
    if(v > .1 && v < .7){ const k = (v - .1)/.6; for(let i = 0; i < 10; i++){ const a = i*Math.PI/5, d = 30 + k*130; fx += `<i class="sp" style="left:${195 + Math.cos(a)*d}px;top:${300 + Math.sin(a)*d*.75}px;opacity:${1 - k};transform:scale(${2.2 - k*1.5})"></i>`; } }
    if(v > .9 && v < 2.7){ for(let i = 0; i < 4; i++){ const k = Math.min(1, (v - .9 - i*.18)/1.3); if(k <= 0) continue; fx += `<i class="hp" style="left:${130 + i*40 + Math.sin(k*6 + i)*7}px;top:${170 - k*80}px;opacity:${1 - k}">${heart()}</i>`; } }
    q(".pgFx").innerHTML = fx;
    if(v > 1.0 && !ov._ban){ ov._ban = 1; const nm = COLS[col - 1][0];
      q(".pgBan").innerHTML = `<b>拿到「${nm}」乞丐貓！</b><small>站長給你的小禮物，好好照顧牠喔</small>`; q(".pgCap").innerHTML = "";
      q(".pgBtns").innerHTML = `<button class="btn" data-a="wear">現在換上牠</button><button class="btn sub" data-a="close">先收著</button>`;
      q(".pgBtns").querySelectorAll("button").forEach(b => b.addEventListener("click", e => { e.stopPropagation(); close(); if(b.dataset.a === "wear") o.wear && o.wear("pc" + col); }));
      sfx("meow"); try{ o.onReveal && o.onReveal(col); }catch(e){} }
    if(ov._ban){ const k = Math.min(1, (v - 1.0)/.35); q(".pgBan").style.opacity = k; q(".pgBan").style.transform = `scale(${k < 1 ? ease(k)*.9 + .1 : 1})`; q(".pgBtns").style.opacity = Math.min(1, Math.max(0, (v - 1.5)/.3)); }
  };
  raf = requestAnimationFrame(frame);
  return { close };
}

window.PoorCat = { COLS, LOOK_N, sprite, live, gift, colOf, name: c => "乞丐貓・" + COLS[colOf(c) - 1][0] };
})();

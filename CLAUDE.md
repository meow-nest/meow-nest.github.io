# 喵喵小窩・給 Claude 的接手說明

這份是寫給「接手幫站長改網站的 Claude」看的。站長不會寫程式，所有修改、測試、發布都由你做；需要動資料庫時，由你寫 SQL、站長自己貼到 Supabase 執行。

## 站長的習慣（一定要遵守）

- 用**繁體中文（台灣）**回覆，站長用 Redmi 手機看，回覆要短、好讀。
- **發布前一定要等站長說「發吧」**。改好先在本機測試、截圖給她看，說明改了什麼，問她要不要發。
- 有使用者看得到的改動時，順便提一則「更新通知」的文字給她看（她同意才加進 changelog.js）。修 bug、站長後台的改動不用通知。
- 需要跑 SQL 時：把 SQL 放進 `supabase/update_NN_名稱.sql`，推上去後給她 **GitHub 檔案連結**（請她按右上角複製按鈕），和 Supabase 的 SQL 頁面：
  https://supabase.com/dashboard/project/rtwgkdqekhzshuvkoxig/sql/new
  跳出 RLS 警告時，請她按黃色的 **Run without RLS**。**就算是很短的查詢 SQL 也一樣放成檔案、推上去給連結**（站長要用連結複製，不要只給 code block）。查詢檔不要寫進使用者名字，用條件找。
- 如果前端要用到新的 SQL，一定提醒她**先跑 SQL 再讓大家更新**。
- 她很在意好不好看：不喜歡醜、平、粗糙的設計。被退件好幾次時，請她給參考圖照著做。遊戲裡**不要用 emoji 當圖示**，用像素圖（`Pix.icon`、`Pix.sprite`）。
- 誠實說明測試方式：是本機 Postgres ＋ 模擬手機（假後端）測的，不是真的線上資料。

## 安全規則（不能違反）

- **絕對不要**跟站長要 Supabase 的 service_role／secret key、資料庫密碼、任何帳號密碼；她貼給你也不要用、提醒她換掉。
- 這是**公開倉庫**：不要把任何小窩的邀請碼、使用者資料、站長的個人資料（名字、信箱、GitHub 帳號）寫進檔案或 commit。
- commit 的作者維持 `Claude <noreply@anthropic.com>`（站長希望不要顯示她的身分），不要設定成她的 git 帳號。
- 只推到這個倉庫（meow-nest/meow-nest.github.io）。
- 不要畫任何有版權的角色或品牌。股票遊戲是虛構的、不能做成賭博或成癮的設計。
- VAPID 私鑰不存在任何地方，不要找也不要產生新的覆蓋。

## 網站架構

純前端 PWA，放在 GitHub Pages（main 分支根目錄），網址 https://meow-nest.github.io/ 。後端是 Supabase（匿名登入 + Postgres + Realtime）。

| 檔案 | 內容 |
|---|---|
| `index.html` | 頁面骨架，載入所有 js/css（網址後面的 `?v=` 由 bump.py 自動產生） |
| `start.js` | 啟動 `App.start()` |
| `config.js` | Supabase 網址和公開金鑰（publishable key 本來就是公開的） |
| `data.js` | 後端包裝 `B`：登入、成員、訊息、遊戲存檔（`B.casState`）、`B.rpc`；`window.__mock` 存在時改走測試用假後端 |
| `app.js` | 主程式：首頁、聊天、設定、站長後台、等級稱號、更新通知、遊戲外框和 `ctx` |
| `pixel.js` | 像素貓 `Pix.sprite(貓, 表情)`、圖示 `Pix.icon`、顏色 `PAL`、特別的貓（博士貓 star、壽星貓 bd1–9、睡衣小貓 pj） |
| `games/*.js` | 每個遊戲一個檔案，用 `App.registerGame({ id, name, desc, mount(el, ctx), unmount() })` 註冊 |
| `gameart.js` | 遊戲大廳的卡片圖 |
| `ime.js` | 內建注音鍵盤（詞庫 `zhuyin.txt`） |
| `changelog.js` | 更新通知（`window.CHANGELOG`，最新的放最上面） |
| `style.css` | 全部樣式；字型是俐方體11號（`fonts/Cubic_11.woff2`），「畫」字另外用 `fonts/cubic_fix.woff` 補 |
| `sw.js` | Service Worker 快取，版本號 `meow-pub-vNNN` 由 bump.py 加一 |
| `about.html` | 網站聲明 |
| `supabase/` | `setup.sql` + `update_NN_*.sql`，`all.sql` = 全部依序合在一起 |
| `tools/bump.py` | 發布前跑，更新檔案版本號 |
| `tools/test/` | 本機測試工具（見下面） |

小窩模式：`couple` 情侶、`bestie` 閨蜜、`bro` 兄弟、`family` 家人（最多 6 人）、`solo` 單人。遊戲用 `ctx.partner()` 拿對方，家人模式會切換對象。

遊戲裡常用的 `ctx`：`me`、`partner()`、`sprite`、`icon`、`SFX`、`toast`、`esc`、`getState(game)`、`update(game, fn)`（樂觀鎖寫存檔）、`onState(game, cb)`（即時同步）、`rpc(fn, args)`、`notifyPartner(text)`、`mode()`。

## 資料庫

- 每個人用匿名登入，`members(user_id, couple_id, name, cat)` 記錄誰在哪個小窩；`my_couple()` 回傳目前登入者的小窩。
- 表格都開了 RLS，大部分寫入都透過 `security definer` 的函式（RPC），函式裡自己檢查 `auth.uid()`／`my_couple()`。新函式記得 `revoke ... from public, anon` 再 `grant execute ... to authenticated`。
- `game_state(couple_id, game, version, state)` 是遊戲共用存檔，用 `cas_state()` 寫（版本號比對）。**每份存檔上限 20KB**，會一直累積的資料（例如星星罐 `star_jar`）要另外開表格。
- 有防作弊的 trigger（例如 `member_cat_guard` 檢查特別的貓有沒有資格用、`lv_week_track` 記每週升級）。
- 站長小窩是 `couples.is_owner = true`，前端會顯示站長後台。

### 加新的 SQL

1. 新檔案 `supabase/update_NN_名稱.sql`，NN 接著目前最大的號碼（目前到 **73**）。開頭用中文註解說這次做什麼。要能重複執行（`if not exists`、`create or replace`）。
2. 加進 all.sql：`printf '\n' >> supabase/all.sql && cat supabase/update_NN_名稱.sql >> supabase/all.sql`
3. 先在本機 Postgres 測過，再推上去給站長連結。

## 發布流程

```bash
python3 tools/bump.py          # 更新 ?v= 和 sw.js 版本
git add -A
git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -m "做了什麼（中文）"
git push origin main           # GitHub Pages 約 1 分鐘後更新
```

更新通知：在 `changelog.js` 的 `window.CHANGELOG = [` 下一行插入
`{ id:"新的id", date:"2026/11/20", icon:"star", title:"標題", items:["重點一","重點二"] },`
（id 不能重複；icon 用 `Pix.icon` 有的名字）。

## 本機測試

環境需要 Node + Playwright（`npm root -g` 裡有 playwright）、Python、PostgreSQL。

1. **開網頁伺服器**（在倉庫的上一層）：`python3 -m http.server 8765 --directory ..`
2. **模擬手機**：`NODE_PATH=$(npm root -g) node tools/test/example.js` —— 兩個瀏覽器分別開小窩、加入，截圖到 `/tmp`。`tools/test/harness.js` 是假後端（`DB` 物件），邀請碼固定 `AB12CD`。問卷、通知的彈窗可以用 `document.querySelectorAll('.careModal').forEach(m=>m.remove())` 關掉；被蓋住的按鈕用 `page.evaluate(()=>el.click())` 點。
3. **測 SQL**：
   ```bash
   service postgresql start
   su postgres -c "createdb t"
   su postgres -c "psql -q -d t -f tools/test/pg_stub.sql"   # 假裝 Supabase 的 auth、storage
   su postgres -c "psql -q -d t -f supabase/all.sql"         # pg_cron 那幾行報錯可以忽略
   ```
   （檔案要放在 postgres 讀得到的地方，例如先 `cp` 到 `/tmp` 再 `chmod 644`。）
   在 SQL 裡用 `select set_config('t.uid', '<uuid>', false);` 假裝某個人登入（uuid 要先 `insert into auth.users(id)`）。
   測試頁面設定 `page.__pg = '<uuid>'` 時，harness 會把 rpc 直接打到本機 Postgres 的資料庫 `t`。
4. 截圖給站長看效果，手機尺寸 390 寬。

## 兩個 Claude 一起改（很重要）

站長會用兩個 Claude 帳號輪流或同時改這個網站，所以：

- **開始改之前先 `git pull`**，看 `git log --oneline -10` 知道另一個 Claude 最近做了什麼。不要假設倉庫還是你上次看到的樣子。
- **新的 SQL 號碼用倉庫裡最新的那個 +1**（看 `ls supabase/`），推之前再 pull 一次確認號碼沒被用掉。
- **推之前**：`git pull --rebase origin main`，有衝突就自己解決並重新測試，不要蓋掉另一個 Claude 的改動。
- 有衝突、或發現另一個 Claude 改壞東西時，先跟站長說明，不要自己大改別人的功能。
- 做完一件事，在 commit 訊息寫清楚（中文），另一個 Claude 才看得懂。
- 每次發布後，把下面「目前的狀態」更新一下（例如最新的 SQL 號碼、正在進行的事）。

## 目前的狀態（2026/11/20）

- 最新的 SQL 是 update_65（貓貓股市多 8 家公司，共 24 家：`stock_defs`、`stock_meta` 兩個函式要一起加；前端 `games/stock.js` 的 `CO`、`INFO` 也要加）。update_64（定時訊息）站長已經跑過。站長說過 11/22（日）回來繼續更新。
- 隨機配對（update_66＋67，11/21）：所有小窩（67 拿掉只限單人，不會配到同一個小窩的人）在「跟朋友一起玩」可以隨機配對其他小窩的人（`party_match`，遊戲 `MATCH_GAMES`：gomoku、pool、chess、banqi、battleship；不開放要打字的遊戲）。配對房間 `party_rooms.pub = true`：名字存成 `party_anon()`（喵友＋4 碼），看不到真名、不能用房間碼加入、有人離開整間關掉。只能用固定短句 `QP`（廣播 `{qp: 索引}`，不能自己打字）。檢舉 `party_report` → `party_blocks` 封鎖（使用者在「我檢舉過的喵友」可以解除：`party_my_blocks`／`party_unblock`）＋`party_reports` 紀錄＋寄到回報信箱「【配對檢舉】」。站長後台「配對檢舉」（`admReports`、`admin_party_reports`）看被檢舉次數，可以禁止配對（`party_bans`、`admin_party_ban`，update_68）。大廳最上面「現在在等連線的喵友」（update_69：`party_waiting` 每 5 秒、`party_meet(房間)` 直接一起玩、共用條件 `party_can_meet`；前端 `ptWaitTick`／`ptWaitPaint`／`ptMeet`）。等待中前端每 4 秒 `party_mine`（順便更新 last_at，超過 30 秒沒更新的房間不會被配到；update_70 起還會自動搬進更早在等同一個遊戲的房間，修兩個人同時按各自等的問題），等待畫面下面也列出其他在等的喵友。房間遊戲也多了五子棋、西洋棋、暗棋、海戰（`PARTY_GAMES`、`party_games()`）。
- 貓貓股市產業分類＋事件連動（update_71）：`stock_sector(sym)` 7 類（前端 `SEC`，兩邊要一致）、`stock_links()` 上下游／對手關係。`stock_advance` 每分鐘先決定公司新聞，再算連動 `adj`；產業新聞約 1/2400 每分鐘。新聞編碼：產業新聞 `sym='S:類別'`、k=50~52；連動新聞 k=100+來源公司序號*2+(對手?1:0)（序號＝`stock_defs` 順序＝前端 `ALL`）。新增公司時，`stock_defs`、`stock_meta`、`stock_sector`、前端 `CO`／`INFO`／`SEC` 都要加，而且只能加在最後面（序號不能變）。
- 股票帳戶搬家（update_72，11/21）：同小窩同暱稱重新加入（換手機）時，`stock_member_gone`（members 刪除前存到 `stock_move`）＋`stock_member_back`（加入時 `stock_merge_into` 接回／合併）。已經被刪掉的帳戶：站長在 SQL 頁面跑 `select stock_restore_lost('舊帳號前8碼','暱稱')`，照還留著的 stock_trades（30 天）算回來（救濟金沒有交易紀錄，算不回來）。這個呼叫有使用者名字，不放進倉庫，用 code block 給。update_73：合併後現金是負的（新舊帳戶都花了本金）時 `stock_fix_cash` 從最新的買進照原價退回，`stock_fix_negative()` 一次修全部。
- 家人模式觀戰（11/21，沒有 SQL）：首頁 `#famLive`「家人正在玩」（`famLiveLoad` 每 15 秒，`B.liveGames` 直接讀 game_state 最近 20 分鐘有動的 `遊戲:uid前8碼-uid前8碼`），`WATCHABLE` = gomoku、chess、banqi、pool（海戰有藏的資訊不開放）。路由 `#watch` → `viewWatch`：觀戰 ctx 用 A 的角度（`me` 換成 A、`update` 全部回 null、`#gArea.watching` 擋點擊、藏 `.btn`），用 MutationObserver 把「你」換成名字。「加油」用 `B.bcast({t:"famCheer", to:[A,B]})`。家人在玩可觀戰的遊戲時（`ctx.update` 會呼叫 `famAnnounce`），聊天室貼 kind `watch` 的訊息（media 是 JSON `{k,g,a,b}`），沒在玩的人有「去觀戰」按鈕（`famWatchOpen`）；同一組同一個遊戲 30 分鐘一則。站長的「遊戲」頁（route `games`）也會顯示 `#famLive`。對局中所有頁面最上面有浮動通知 `#famBan`（`famLivePoll` 每 15 秒，`B.liveGames` 會一起拿 `win:state->win`；有 win 就算結束、30 分鐘沒動也消失；×收起那一局 `famBanHide`）。可觀戰的遊戲都用 `state.win` 表示分出勝負。
- 家人「全家一起玩」（11/21，沒有 SQL）：`FAM_ALL` = draw、bingo、fishing，家人 3 人以上時遊戲上方有切換（`famAllOn`，記在 sessionStorage `mw_famAll_遊戲`）。`famAllCtx(遊戲)`：存檔用 `遊戲:fam`（釣魚是 `fishrace:fam`，圖鑑照舊存 `fishing`）、`players()`＝在場的家人（`famHere`，大家每 4 秒 `B.bcast({t:"famHere",to:"__fam"})`，12 秒沒收到就算離開）、`partyHost()`＝在場 uid 最小的、`onMembers`、`broadcast` 加 `famg`。draw 用 `ctx.party` 的多人版；bingo 的 players 可以 3～6 人（`cleanG` 允許最多 6、`winners` 陣列、輪到的人離開會跳過）；fishing 是同時開始 60 秒比賽（`fishrace` 存 round/start/players/scores/done，即時分數用廣播 `{fsr, sc}`）。晚到的人：bingo 可以觀戰（`mode = "watch"`、`watchView`）或中途加入（隨機卡、已喊號碼算數，最多 6 人，非玩家看不到「重新開一局」）；fishing 比賽開始 50 秒內可以中途加入（`#fsLate`），旁觀時大廳顯示即時分數。
- 睡衣小貓：11/30 前看到「站長去充電」通知的人自動領（`gift_got`、`claim_gift`）。
- 推播診斷（隱藏功能）：sw.js 收到推播時會記下時間（快取 `meow-pub-assets` 的 `__diag/push`），設定頁連點「通知」標題 5 次會顯示「最近一次收到推播」（`mw_diag`），用來查某支手機收不到背景通知（小米／紅米 Redmi Note 14 還在查）。一般使用者看不到，不用發更新通知。
- 「下載 App」按鈕：Chrome 的安裝視窗沒跳出來（小米常見）時，3.5 秒後改顯示文字說明（`doInstall`）。已裝好的 App（standalone）設定頁不會有這顆按鈕。
- 默契大考驗題庫：擴充題在 `games/moqi_more.js`（G 共用、P 二選一、C/B/M/F 情侶／閨蜜／兄弟／家人專屬），每個模式都超過 5000 題。G 和 P 不能有 `ROMANCE` 裡的字（包含「親」「兩人」）。家人模式改用 `BANK_FAM`（以前會用到情侶題庫）。新增題目時加在 moqi_more.js 就好，出題順序用雜湊排，加題不會讓已出過的題目重複。
- 首頁像翻書（`homePagesHtml`／`homePagesBind`）：第 1 頁是小窩（稱號、簽到、小魚乾、小按鈕、提醒橫幅），內容少時用 `fitFirst()` 撐滿一個畫面；第 2 頁起是遊戲，一頁 6 個（`G_PER`），每頁最上面是「跟其他小窩的朋友一起玩」。左右滑或下方 ◀ ●○○ ▶ 換頁，記在 sessionStorage `mw_hpg`。翻頁動畫 `H_FX = "slide"`（style.css 還留著 fade/book/bounce/pixel/paw 可以換）。
- 置頂遊戲：每個人存在自己手機 localStorage `mw_pins`，遊戲第 1 頁右上「置頂設定」。
- 喵喵方塊島（3D 遊戲，開發中）：`games/cube3d.js` 引擎＋`games/cube.js` 開始畫面。**還沒加進 index.html**，站長用獨立試玩頁 `cube-test.html` 測。第 1 階段（走路、搖桿、跳、摸小貓、睡衣／髮型／髮色）完成；之後：放方塊蓋房子、看得到另一半、探索撿東西。頭髮站長選的是方塊瀏海（雙馬尾是彎彎的髮絲）。遊戲名稱和文字不能出現 Minecraft。**站長說：方塊島試玩頁（cube-test.html 和它用到的 cube3d.js／cube.js／方塊島樣式）改好就直接推，推完再跟她說**；但加進小窩正式上線（index.html、gameart.js、更新通知）還是要等她說「發吧」。已經有：~~8 隻小貓村民~~（11/22 站長說不要村民，遊戲是「和自己養的貓一起生活」，cube.js 的 npcs 改成空的；`games/cube_talk.js` 還留著給自家貓的台詞 famTalk 用）、真實時間白天晚上、遊戲內設定（`mw_cube_set`）、蓋房子（點方塊放／挖、方塊列、復原，存在手機 `mw_cube_edits`，還沒存到伺服器）。介面風格站長選 C 精緻像素。**方塊材質要跟 Minecraft 很不一樣**（站長怕被說抄襲）：站長從 20 種風格選了**第 12 種「和紙」**：`makeAtlas` 用 64×64 和紙風（`WASHI` 調色盤：淡雅大地色、和紙纖維 `fibers`、撕紙邊 `edge`、小梅花 `plum`、水用青海波、玻璃是紙窗），LINEAR 過濾、不要像素雜點；名字在 `BNAME`。**有形狀的方塊**（`buildWorld` 裡）：屋瓦會自動變斜屋頂（`roofShape`：上一層旁邊有屋瓦→往那邊斜、斜對角→屋角、都沒有→屋脊／尖頂；`emitRoof`），貓抓柱是圓柱（`emitPost`），紙窗是跟著牆轉向的薄片（`emitPane`）；`shaped()` 的方塊不會遮住旁邊方塊的面；碰撞還是整格。**可愛化**：樹葉／櫻花（新方塊 `B.SAKURA`=15）站長要「像真的葉子和花」：材質格 18（一片片有葉脈的葉子）、19（五瓣小櫻花），背景透明；站長說太雜亂→改乾淨版：`emitFoliage` 外露的面先畫一層乾淨單色（材質格 20 綠／21 粉，往內縮一點），再貼 3 小把葉子（5 片大葉排成扇形）或 3 朵大櫻花，放在 `chunks[2]`、兩面都畫（圓毛球 `drawLeaf`／整棵造型 `drawTree` 兩批都被退件，程式還在但沒用）、島上有小花小蘑菇 `world.flowers`、飄落的櫻花瓣 `PETALS`、雲是圓的（shader mode 3 亮白不變灰）、`WASHI` 顏色調亮一點。**櫻花樹（站長終於滿意的方向：像真的櫻花、不要方塊）**：櫻花方塊在 `buildWorld` 收進 `sakList`，`emitSakura` 把連在一起的一團當一棵樹，長出彎彎的樹枝（樹皮貼圖的管子）、枝頭一叢叢花（材質格 87、88：十幾朵五瓣小花＋花苞＋花蕊），樹冠裡有兩層扁圓殼（裡面實心粉、外面花貼圖，`ell`）讓它很茂密又只用很少的面，茂密的樣子有 10 款 `SAK_STYLES`（形狀 round/umbrella/weep/oval/cloud/tier，淡白材質格 89、深粉 90，`SAK_PICK` 選一款，站長選了 1+2 的感覺＝第 11 款 dome「圓圓大傘」，`window.__sak` 可以暫時換），島上兩棵是 `bigSakura`（樹幹 5 格、樹冠半徑 3 的大樹）；太大（>200 格或寬 >11）才改回一格一格。樹葉方塊的款式還沒定（FOL_STYLES 0～63 給她挑過，FOL_PICK=-1 用乾淨版）。材質圖現在 16×16 格（1024），顏色格在 127。家裡的貓自己玩的時候不要喵喵叫（太吵）。**家具（11/22 開始做）**：不是方塊，`FURN` 清單 20 件（貓咪用品／臥室／客廳／庭院各 5），`drawFurn(id,x,y,z,rot,t)` 用圓角盒 `rbox`、圓球 `el`、管子畫；現在只有 `window.__furn` 測試擺放（`window.__camT` 是截圖用的鏡頭），還沒有擺放介面和存檔。站長想要「偶爾來訪的旅行貓」擺攤兌換家具，兌換方式她不確定、請我提建議。走路手感（站長說鏡頭不順、走路不自然）：玩家速度有加減速（`player.vx/vz`）、跳上一格是直接滑上去＋`visY` 畫面慢慢跟上、鏡頭目標 `cam.t` 有緩衝（上下比較慢）、被擋住時 `cam.cd` 馬上拉近但慢慢退回、走路身體微微前傾左右晃。**我們家的貓**（11/21）：開始畫面讀 `ctx.getState("pet")` 的貓（最多 2 隻，名字、顏色、長大階段），用 `fam:true` 加進 npcs；引擎 `famAI` 讓牠們跟著玩家、追毛線球（`yarn`／`ballStep`／`tossBall`）、互相鬼抓人（chase/flee）、繞著跑、坐下看你，晚上你不動 6 秒會在旁邊睡；名字牌粉紅＋腳印、面板有「丟球」，台詞 `CubeTalk.famTalk`（會提到另一半、肚子餓）。試玩頁用兩隻示範貓（麻糬、布丁）。飾品：讀 pet 存檔 `deco.wear[貓序號]`（hat/neck/face），`drawAcc` 用圓球（`sph`，畫的時候關掉 CULL_FACE）、管子（`tube`／`ring`／`curve`）把每種飾品（照 `fam` 的 base id，顏色用 pal 的 A/B）做成圓圓的 3D 小物件——站長不要像素版的；新增飾品時要在 `drawAcc` 的 switch 加一個 case；試玩頁有載 petdeco.js。正式上線時：index.html 加三個 script（cube_talk.js、cube3d.js、cube.js）、gameart.js 加 cube 卡片圖（本機改過但還沒推）、刪 cube-test.html。
- 定時訊息（11/20 上線）：聊天頁左上「定時」（`schedWriter`）。`sched_msgs` 表不開權限，用 `sched_add`／`sched_list`／`sched_cancel`；pg_cron `meow-sched` 每分鐘跑 `fire_sched()`，用寫的人的名字插入 messages（kind `text`、media `{"sch":1}`，前端 `isSched` 顯示「定時訊息」標籤），推播照舊。送出前只有自己看得到；500 字、1 分鐘後～1 年內、每人最多 30 則；單人小窩沒有按鈕。
- 等級稱號：Lv40 之後有天使／惡魔翅膀（惡魔 6 種顏色），排行榜有本週／總排行，站長小窩可以展示但不參加排行。

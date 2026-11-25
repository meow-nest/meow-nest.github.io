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
| `zoom.js` | 大螢幕放大（最先載入，見「目前的狀態」的 RWD）|
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

1. 新檔案 `supabase/update_NN_名稱.sql`，NN 接著目前最大的號碼（目前到 **83**）。開頭用中文註解說這次做什麼。要能重複執行（`if not exists`、`create or replace`）。
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

## 目前的狀態（2026/11/25）

- 最新的 SQL 是 update_65（貓貓股市多 8 家公司，共 24 家：`stock_defs`、`stock_meta` 兩個函式要一起加；前端 `games/stock.js` 的 `CO`、`INFO` 也要加）。update_64（定時訊息）站長已經跑過。站長說過 11/22（日）回來繼續更新。
- 隨機配對（update_66＋67，11/21）：所有小窩（67 拿掉只限單人，不會配到同一個小窩的人）在「跟朋友一起玩」可以隨機配對其他小窩的人（`party_match`，遊戲 `MATCH_GAMES`：gomoku、pool、chess、banqi、battleship；不開放要打字的遊戲）。配對房間 `party_rooms.pub = true`：名字存成 `party_anon()`（喵友＋4 碼），看不到真名、不能用房間碼加入、有人離開整間關掉。只能用固定短句 `QP`（廣播 `{qp: 索引}`，不能自己打字）。檢舉 `party_report` → `party_blocks` 封鎖（使用者在「我檢舉過的喵友」可以解除：`party_my_blocks`／`party_unblock`）＋`party_reports` 紀錄＋寄到回報信箱「【配對檢舉】」。站長後台「配對檢舉」（`admReports`、`admin_party_reports`）看被檢舉次數，可以禁止配對（`party_bans`、`admin_party_ban`，update_68）。大廳最上面「現在在等連線的喵友」（update_69：`party_waiting` 每 5 秒、`party_meet(房間)` 直接一起玩、共用條件 `party_can_meet`；前端 `ptWaitTick`／`ptWaitPaint`／`ptMeet`）。等待中前端每 4 秒 `party_mine`（順便更新 last_at，超過 30 秒沒更新的房間不會被配到；update_70 起還會自動搬進更早在等同一個遊戲的房間，修兩個人同時按各自等的問題），等待畫面下面也列出其他在等的喵友。房間遊戲也多了五子棋、西洋棋、暗棋、海戰（`PARTY_GAMES`、`party_games()`）。
- **全站飄屏「有喵友在等配對」（update_75，11/22）**：伺服器用 `realtime.send` 發到私人頻道 `meow-lobby`（大家只能收聽：policy `meow_lobby_read`，沒有寫入權限）。`party_members` insert/delete trigger `party_lobby_trg`、`party_rooms` delete trigger `party_lobby_gone`；事件 `w`＝在等（room、game、匿名 name、cat、`c`＝小窩 id 的 sha256 前 12 碼，前端用來不顯示自己小窩的人）、`x`＝結束。`party_announce`：同一位 3 分鐘最多說一次、全站 30 秒最多說一則（看 `party_rooms.ann_at`，`party_mine` 會呼叫，所以被擋下的人之後會輪到）；`x` 只發給說過的房間。前端每 90 秒最多跳一次（`lobPop`），飄屏顯示「還有N位」；設定「其他」有「配對提醒 開／關」（`mw_lobOff`）。前端 `B.lobbyConnect`（資料庫沒更新時試 3 次就放棄）、`lobbyMsg`／`lobbyPaint`、`#ptBan`：第一次顯示 25 秒；在「跟朋友一起玩」頁、觀戰、自己在房間裡時不顯示；按「一起玩」→ `PT.pendMeet` → 到 party 頁自動 `ptMeet`。測試用假後端可以 `window.__lobby('w', {...})`。
- 股市全站紅包（update_76，11/22）：每個股票帳戶現金 +20000（站長說自己輸很慘又沒作弊，獎勵大家），`stock_gift_log` 記住發過了不會重複；`wk_base`／`dy_base` 一起加，不算賺到的。以後要再發紅包就照這個寫法換一個 id。update_77：`stock_acct.gift`（拿過的紅包），總損益（前端 `pnl` 扣 `S.gift`）和總排行（`stock_status` 的 profit 扣 `v.gift`）都不算紅包；破產重來 `stock_reset` 會把 gift 歸零。以後再發紅包要記得 `gift = gift + 金額`。
- 股市 30 家（update_78，11/22）：再加 6 家 WHSK 鬍鬚雷達（科技）、STAR 喵星經紀（娛樂）、TAI 鯛魚燒烘焙（吃喝）、BUS 毛毛巴士（交通）、GYM 呼嚕健身房（健康綠能）、LUCK 招財小判證券（金融），連動關係也加了；harness 假後端也加了。
- 貓貓股市產業分類＋事件連動（update_71）：`stock_sector(sym)` 7 類（前端 `SEC`，兩邊要一致）、`stock_links()` 上下游／對手關係。`stock_advance` 每分鐘先決定公司新聞，再算連動 `adj`；產業新聞約 1/2400 每分鐘。新聞編碼：產業新聞 `sym='S:類別'`、k=50~52；連動新聞 k=100+來源公司序號*2+(對手?1:0)（序號＝`stock_defs` 順序＝前端 `ALL`）。新增公司時，`stock_defs`、`stock_meta`、`stock_sector`、前端 `CO`／`INFO`／`SEC` 都要加，而且只能加在最後面（序號不能變）。
- 股票帳戶搬家（update_72，11/21）：同小窩同暱稱重新加入（換手機）時，`stock_member_gone`（members 刪除前存到 `stock_move`）＋`stock_member_back`（加入時 `stock_merge_into` 接回／合併）。已經被刪掉的帳戶：站長在 SQL 頁面跑 `select stock_restore_lost('舊帳號前8碼','暱稱')`，照還留著的 stock_trades（30 天）算回來（救濟金沒有交易紀錄，算不回來）。這個呼叫有使用者名字，不放進倉庫，用 code block 給。update_73：合併後現金是負的（新舊帳戶都花了本金）時 `stock_fix_cash` 從最新的買進照原價退回，`stock_fix_negative()` 一次修全部。
- 家人模式觀戰（11/21，沒有 SQL）：首頁 `#famLive`「家人正在玩」（`famLiveLoad` 每 15 秒，`B.liveGames` 直接讀 game_state 最近 20 分鐘有動的 `遊戲:uid前8碼-uid前8碼`），`WATCHABLE` = gomoku、chess、banqi、pool（海戰有藏的資訊不開放）。路由 `#watch` → `viewWatch`：觀戰 ctx 用 A 的角度（`me` 換成 A、`update` 全部回 null、`#gArea.watching` 擋點擊、藏 `.btn`），用 MutationObserver 把「你」換成名字。「加油」用 `B.bcast({t:"famCheer", to:[A,B]})`。家人在玩可觀戰的遊戲時（`ctx.update` 會呼叫 `famAnnounce`），聊天室貼 kind `watch` 的訊息（media 是 JSON `{k,g,a,b}`），沒在玩的人有「去觀戰」按鈕（`famWatchOpen`）；同一組同一個遊戲 30 分鐘一則。站長的「遊戲」頁（route `games`）也會顯示 `#famLive`。對局中所有頁面最上面有浮動通知 `#famBan`（`famLivePoll` 每 15 秒，`B.liveGames` 會一起拿 `win:state->win`；有 win 就算結束、30 分鐘沒動也消失；×收起那一局 `famBanHide`）。可觀戰的遊戲都用 `state.win` 表示分出勝負。
- 家人「全家一起玩」（11/21，沒有 SQL）：`FAM_ALL` = draw、bingo、fishing，家人 3 人以上時遊戲上方有切換（`famAllOn`，記在 sessionStorage `mw_famAll_遊戲`）。`famAllCtx(遊戲)`：存檔用 `遊戲:fam`（釣魚是 `fishrace:fam`，圖鑑照舊存 `fishing`）、`players()`＝在場的家人（`famHere`，大家每 4 秒 `B.bcast({t:"famHere",to:"__fam"})`，12 秒沒收到就算離開）、`partyHost()`＝在場 uid 最小的、`onMembers`、`broadcast` 加 `famg`。draw 用 `ctx.party` 的多人版；bingo 的 players 可以 3～6 人（`cleanG` 允許最多 6、`winners` 陣列、輪到的人離開會跳過）；fishing 是同時開始 60 秒比賽（`fishrace` 存 round/start/players/scores/done，即時分數用廣播 `{fsr, sc}`）。晚到的人：bingo 可以觀戰（`mode = "watch"`、`watchView`）或中途加入（隨機卡、已喊號碼算數，最多 6 人，非玩家看不到「重新開一局」）；fishing 比賽開始 50 秒內可以中途加入（`#fsLate`），旁觀時大廳顯示即時分數。
- **股東小故事（11/24）**：故事內容不放倉庫（站長自己保存）。新公司（MAIL 之後 14 家）原本沒有故事 → 「故事書打不開」。補法：站長私下跑 `stock_story_more.sql`（不在倉庫）：原本的函式改名 `stock_story_orig`，新的 `stock_story` 先問原本的、沒有才查表 `stock_story_more(sym,i,txt)`（不開權限）。**以後加新公司要在 stock_story_more 補兩篇**（給站長私下跑，不要 commit 故事）。唯讀檢查 `supabase/check_stock_story.sql`。
- **貓貓的一生（update_82，11/24）**：`games/catlife.js`（id `catlife`，`solo:true`）。人生模擬：選花色、名字、出身（`ORIGIN` 家貓／流浪／店貓／農場），每歲一個事件（`EV`：階段 k/y/a/s/*、條件旗子、選項效果字串 `h+5 j-3 +旗子`，有機率的選項）＋生日 `MILE`；`ageUp` 老化和死亡機率，最多 30 歲。`window.__catlifeSim(n,"best")` 模擬平均壽命（隨便選約 17 歲、好好選約 20 歲）。玩到一半存在 localStorage `mw_catlife_run`。存檔 `game_state` 遊戲 `catlife`：best（月數）、score、plays、lives（每人最近 5 隻）。排行 `catlife_rank()`、防作弊 trigger `catlife_guard`（≤371 個月、≤999 分、玩一局才能更新）。更多事件在 `games/catlife_more.js`（`window.CATLIFE_MORE`，要在 catlife.js 前面載入），**新事件加在那個檔案最後面**（存檔記的是事件序號）。條件可以用 `rare`（比較少出現），結果文字可以是陣列（隨機一句）。故事旗子：leg 舊傷、rival 宿敵、famous 網紅、baby 家裡寶寶、granny/gang 流浪線、sheep/hero/model/bird/elder 等。共 172 種（11/24），一生不會重複。
- 睡衣小貓：11/30 前看到「站長去充電」通知的人自動領（`gift_got`、`claim_gift`）。
- 推播診斷（隱藏功能）：sw.js 收到推播時會記下時間（快取 `meow-pub-assets` 的 `__diag/push`），設定頁連點「通知」標題 5 次會顯示「最近一次收到推播」（`mw_diag`），用來查某支手機收不到背景通知（小米／紅米 Redmi Note 14 還在查）。一般使用者看不到，不用發更新通知。
- 「下載 App」按鈕：Chrome 的安裝視窗沒跳出來（小米常見）時，3.5 秒後改顯示文字說明（`doInstall`）。已裝好的 App（standalone）設定頁不會有這顆按鈕。
- 默契大考驗題庫：擴充題在 `games/moqi_more.js`（G 共用、P 二選一、C/B/M/F 情侶／閨蜜／兄弟／家人專屬），每個模式都超過 5000 題。G 和 P 不能有 `ROMANCE` 裡的字（包含「親」「兩人」）。家人模式改用 `BANK_FAM`（以前會用到情侶題庫）。新增題目時加在 moqi_more.js 就好，出題順序用雜湊排，加題不會讓已出過的題目重複。
- 首頁像翻書（`homePagesHtml`／`homePagesBind`）：第 1 頁是小窩（稱號、簽到、小魚乾、小按鈕、提醒橫幅），內容少時用 `fitFirst()` 撐滿一個畫面；第 2 頁起是遊戲，一頁 6 個（`G_PER`），每頁最上面是「跟其他小窩的朋友一起玩」。左右滑或下方 ◀ ●○○ ▶ 換頁，記在 sessionStorage `mw_hpg`。翻頁動畫 `H_FX = "slide"`（style.css 還留著 fade/book/bounce/pixel/paw 可以換）。
- 置頂遊戲：每個人存在自己手機 localStorage `mw_pins`，遊戲第 1 頁右上「置頂設定」。
- 喵喵方塊島（3D 遊戲）：11/24 站長說不做了，`games/cube*.js`、`cube-test.html`、style.css 裡的 `.p3d*`／`.cb*` 都刪掉了（要找回來看 git 歷史，commit「刪掉喵喵方塊島」之前）。
- **即時訊息用量（11/22）**：Supabase 免費方案每月 220 萬則，11 月超過（寬限到 12/22）。即時遊戲的同步頻率已經調低：一起煮飯位置 150ms 且沒動不送（2.5 秒補一次）、快照 450ms；划船 140ms；守護小窩 220ms；你畫我猜 150ms；全家一起玩 famHere 每 9 秒（26 秒沒收到算離開）。**新做的即時遊戲不要每秒送超過 5～7 次**；家人模式的廣播會送到全家每支手機（couple channel），越多人越貴。
- **日誌擷取用量（11/22）**：免費方案每月 1GB，11 月超過。update_74 把每分鐘的排程合併成一個 `meow-tick` → `meow_tick()`（依序跑 truce_tick、fire_memos、fire_sched，每 5 分鐘 log_online，每小時清 3 天前的 cron.job_run_details）；**以後要加每分鐘的排程，請加進 `meow_tick()`，不要另外 cron.schedule**。前端家人「誰在玩」首頁列表和浮動通知共用一次查詢（`famLiveRows`，12 秒內不重複查）。
- **貓貓股市專屬新聞（11/22）**：`games/stock_news.js`（`window.STOCK_NEWS[代號] = {g:[15 則], b:[15 則]}`，`{c}`＝負責人）。前端 `coTxt` 用新聞的 sym＋t＋k 算雜湊，約 3/4 用專屬、1/4 用原本通用的 GOOD/BAD，只換文字不影響漲跌、不用 SQL。新增公司時這裡也要加一組。
- **喵喵鍵盤升級（11/22）**：
  - 按鍵聲音 18 種（`SFX.KB_SOUNDS`：pop/type/mech/wood/piano/bell/drop/meow/game/soft，加上「真的鍵盤」系列 `real:1` 的 kBlue/kRed/kCream/kLaptop/kSpring/kSilent/kCeramic/kWood（按下＋放開兩聲錄在一起，`KPM` 音高、`kG` 音量倍數；設定裡分成兩區），「小貓喵」11/23 改成真的貓叫錄音（`sample:"sounds/meow.mp3?v=1"`、`sGain`；`kbSample` 下載解碼後用 `SAMP_RATE` 變音高，一般鍵用開頭 0.27 秒、選字用整聲，來源寫在 `sounds/README.md`，換檔案時把 `?v=` 加一），`mw_kbsfx`，"off"＝關；舊的 `mw_kbsnd` 還會一起寫）、音量 `mw_kbvol`（s/m/l）。聲音用 OfflineAudioContext 先錄成 buffer（k0~k3/sp/del/ent），`SFX.kb(kind)` 播；IME 的 fx 種類：key、del、pick、space。
  - 鍵盤上的齒輪「設定」（候選列沒打字時最左邊，`opt.settings` → `kbQuickSettings`，第一次有小紅點 `mw_kbSetSeen`）。**11/23 起鍵盤的設定只在這裡**（聲音、音量、游標樣式 `mw_caret`、按鍵大小、開關、配色、打字動畫），設定頁的「鍵盤設定／鍵盤配色／打字動畫」都拿掉了。游標換樣式用 `caretLook`／`caretRefresh`（經典＝藏起像素游標）。
  - 效能：按鍵位置快取（`measure`／`rectOf`，相對 `#imeBody`）、候選字下一格畫面才算（`renderCands`，先畫 24 個、捲動或「更多字」再補）、候選字按鈕重複使用＋事件委派、字典載好後閒置時先整理單音字（`warm`）；聊天打字特效 `typeFx` 也延到下一格畫面。
  - **全站自動喵喵鍵盤**：app.js `kbEligible`／`kbAuto`（document 的 pointerdown＋focusin），所有文字 input/textarea 自動 `caretField`＋`dockKeyboard`；數字框（inputmode numeric/decimal）、type number 等不套用，`data-nokb` 可排除。房間碼這種 `autocapitalize="characters"` 會用英文大寫開（IME `startMode`／`startCaps`）。單行框按「完成」會送出 Enter 的 keydown。`ctx.askText(標題, 預設值, 字數)` 取代 prompt()。默契大考驗自己出題改用 `ctx.keyboard`（跟聊天室同一套設定）。
- **幫我選（11/23，沒有 SQL）**：`games/wheel.js`（遊戲 id `wheel`，`solo:true`，名字「幫我選」）。四種玩法 `MODES`：轉盤 wheel／抽籤 stick／扭蛋 gacha／翻牌 card（`mw_pick_mode`），共用同一份題目；題目存在每個人自己的 `game_state`「`wheel:自己 uid 前 8 碼`」（`{list:[{id,name,opts}], hist:{題目id:[最近結果]}}`），目前題目 `mw_wheel_cur`。「拿掉這個再來」只在這次打開有效（`out`）。結果可「傳給 ta」＝新的 `ctx.say(文字)`（用自己的名字發一則 text 訊息）。遊戲卡圖 `window.PickArt`。不用貓幣／小魚乾、沒有獎勵（不能變成抽獎）。
- **小窩最上面（11/23）**：中間圖示照模式 `MI().mid`（情侶 heart、閨蜜 star、兄弟 bigpaw，`renderHeader` 會更新）；家人模式最上面改成 `famTopRender()` 的 `#famTop`（全家的貓排一排，`.duo` 藏起來，人多自動變小），選雙人遊戲對象只留在首頁「我們家」（`famHtml`）。
- **站長改生日（update_79，11/23）**：後台「壽星貓」可以直接改（`admin_bday_set(邀請碼, 暱稱, 'MM-DD')`，`user_bday.admin_at` 記站長改的時間）＋「看列表」（`admin_bday_list()` 最近 200 筆，站長改的黃底）。後台每分鐘自動更新：資料沒變不重畫、打字／回覆時先不重畫（`admLastKey`）。
- **配對檢舉修正（update_80，11/23）**：`party_rooms.last_by`／`moved_at`（`party_cas` 記最後一步是誰下的）、`party_reports.note`。檢舉「不動」但最後一步是對方下的 → 回 `{error:"your_turn"}`（前端 `ptReport` 先打 RPC，your_turn 不離開房間）。寫進 feedback 的配對檢舉**只能寫匿名名字**（檢舉的人自己看得到 feedback），真實身分只在後台 `admin_party_reports`。`supabase/check_security.sql` 是唯讀的安全檢查（storage、沒 RLS 的表、anon 可執行的函式）。
- **乞丐貓（update_81，11/23）**：站長送大家的小禮物。`poorcat.js`（pixel.js 後面載入）：12 色 `pc1`～`pc12`（pixel.js `PC_IDS`／`PC_N`／`isPc`，`palOf` 也有），3 套造型（歪草帽破斗篷、住紙箱、包紮）×7 種表情，像素資料在 `/*PCDATA*/` 裡，**要改圖改 `tools/poorcat_gen.html` 再跑 `python3 tools/poorcat_build.py`**（要先開 8765 伺服器）。`PoorCat.live(el, c)` 會呼吸、眨眼、每 9～13 秒跳起來在雲裡換裝、點一下跳（首頁最上面的貓用，`quiet` 不冒愛心）；`PoorCat.gift()` 禮物盒開箱。顏色由伺服器 `poorcat_open()` 隨機給、每人一次不能換（`poorcat_got`，同小窩同暱稱換手機拿回原本的）；站長小窩 `all:true` 全部顏色都能選。`member_cat_guard` 有檢查。前端 `PC`／`pcLoad`／`maybePcGift`（只在首頁、沒有其他彈窗時跳；`mw_pcSeen` 記看過開箱結果，開到一半關掉下次會再演一次）；設定「我的貓」有乞丐貓或「禮物盒」按鈕。首頁最上面的貓不管心情都會動（`live(el,c,{face})`，睡覺時不換裝；家人模式 `famTopRender` 的 `[data-ft]` 也會動）；貼圖單數號用第二型態（`sprite(c,kind,{look:1})`）。產生器的兩字元顏色代號用固定的 ①～⑤（`FIX`），不然各造型會對不上。站長還想幫**每隻貓寫故事**（壽星貓 9 隻寫成同一家人，其他各自的故事），還沒做。
- **遊戲卡住修正（11/23，沒有 SQL）**：app.js `update()` 存檔衝突時讀到的新進度現在會 `emitState`（以前只放進快取，晚到的即時通知又被當成舊的丟掉 → 例如你畫我猜時間到兩人同時存，猜的人卡在 ⏱0）。你畫我猜 `upd()`＝`ctx.update` 包一層 `fitDraw`：存檔超過約 17.5KB 時先把點最多的線條簡化、再刪最舊的。harness 的 `cas` 也會跟伺服器一樣拒絕超過 20KB 的存檔。雙人版 `fixStuck()`：畫的人不是目前兩個人（換手機重新加入的舊帳號）或階段不對，就從自己重開一回合。結果畫面有「存下這張圖」（`saveImg`：把 `#drCv` 加上標題、誰畫的、日期存成 png 下載）。查卡住的存檔：`supabase/check_draw.sql`、`check_draw_stuck.sql`（唯讀）。
- **RWD／大螢幕（11/24，沒有 SQL，沒發更新通知）**：站長選「整個放大」。`zoom.js`（index.html 第一個載入的 script）：寬度 ≥700 時 `html.style.zoom = min(寬/560, 高/600)`，限制 1～1.6（每 0.05 一級），手機（<700）完全不變；`window.__zoom()` 看目前倍數。**zoom 之後瀏覽器量出來的數字是放大後的畫面像素，樣式是放大前的 CSS 像素**，所以 zoom.js 把會量東西的 API 都換算回 CSS 像素：`innerWidth/innerHeight`、`scrollX/Y`、`scrollTo/scrollBy`、`documentElement.clientWidth/Height`、`getBoundingClientRect/getClientRects`（Element 和 Range）、滑鼠／觸控的 `clientX/Y`、`pageX/Y`、`offsetX/Y`、`visualViewport`、`elementFromPoint` 等，`devicePixelRatio` 乘上倍數（畫布才清楚）。遊戲和其他程式都不用改；**新程式照平常寫就好**。style.css 裡所有 `vh/vw/dvh` 都改成 `calc(Xvh / var(--z,1))`（新寫的 CSS 用到 vh/vw 也要這樣寫，不然大螢幕會超出畫面）。手機橫拿且高度 <500：遊戲頁藏 `#top`（`body.ingame`）、`.chat` 最小高度 150px（style.css 最後面）。測試：harness 開 1366x768 等尺寸，五子棋點格子、你畫我猜畫線位置、30 個遊戲開始畫面、跑酷／撞球等實際開始都正常。
- **喵喵鍵盤小修（11/25，沒有 SQL、沒發通知）**：`dockKeyboard` 打開時，框框的外層小區塊（裡面有按鈕、放得下）整塊捲到鍵盤上面（例如後台回覆框的「送出回覆」）；`setupCaret` 的鏡像 div 補上透明框線（以前少算框線寬度，換行位置不同 → 游標跑到前一個字），x/y 也加上框線寬度；ime.js 候選列的提示（免聲調也能打）放不下整句就藏起來。
- **股市小窩排名改平均（update_83，11/25）**：`stock_status()` 的小窩合作 `n` 改成「有下過單的成員獲利總和 ÷ 人數」（`nprofit` 是平均、多回傳 `ncnt`、`ntop[].cnt`），多人小窩（情侶／閨蜜／兄弟／家人）一組、單人一組。前端 `games/stock.js` 文字改成「平均每人獲利」「多人小窩組」。harness 的 stock_status 假資料多了 badges／nprofit／ntop（成就和小窩合作頁可以測）。
- 定時訊息（11/20 上線）：聊天頁左上「定時」（`schedWriter`）。`sched_msgs` 表不開權限，用 `sched_add`／`sched_list`／`sched_cancel`；pg_cron `meow-sched` 每分鐘跑 `fire_sched()`，用寫的人的名字插入 messages（kind `text`、media `{"sch":1}`，前端 `isSched` 顯示「定時訊息」標籤），推播照舊。送出前只有自己看得到；500 字、1 分鐘後～1 年內、每人最多 30 則；單人小窩沒有按鈕。
- 等級稱號：Lv40 之後有天使／惡魔翅膀（惡魔 6 種顏色），排行榜有本週／總排行，站長小窩可以展示但不參加排行。

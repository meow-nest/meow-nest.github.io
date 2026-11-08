# 喵喵小窩 🐾

兩個人專用的小遊戲合輯＋聊天室，是一個手機網頁 App（PWA），可以加到主畫面使用。
有「情侶模式」、「閨蜜模式」、「兄弟模式」，還有一個人也能玩的「單人模式」，全部都是像素貓咪風格。

網址：https://meow-nest.github.io/

## 有什麼

- **聊天室**：內建注音鍵盤、貼圖、已讀、語音／視訊通話（為了不佔儲存空間，公開版不能傳照片和語音訊息）
- **心情小站、狀態牌、記事本（可以設提醒）、一起養一隻貓**
- **十幾個雙人小遊戲**：默契大考驗、你畫我猜、五子棋、西洋棋、暗棋、撞球、喵喵海戰、喵喵方塊、疊貓貓、喵喵廚房、划龍舟……

## 自己架一個

這個網站的資料（聊天、遊戲紀錄）存在 [Supabase](https://supabase.com)。想給自己和另一半用的話，可以架一份自己的：

1. **複製程式碼**：把這個倉庫 Fork 到你的 GitHub，到 Settings → Pages，Source 選 `main` 分支的根目錄，網站就會出現在 `https://你的帳號.github.io/倉庫名稱/`。
2. **開一個 Supabase 專案**（免費方案就夠）。
3. **打開匿名登入**：Authentication → Sign In / Providers → 打開 **Allow anonymous sign-ins**。
4. **建立資料庫**：到 SQL Editor，把 `supabase/all.sql` 整段貼上執行（內容就是 `setup.sql` 和各個 `update_*.sql` 依序合在一起）。
   想當站長的話，先在網站上開一個單人小窩，再到 SQL Editor 執行 `update public.couples set is_owner = true where code = '你的邀請碼';`，重新打開網站就會變成站長後台。
   `update_8` 要先把裡面的「你的邀請碼」換成你們小窩的邀請碼（第一次打開網站建立小窩後，在「設定」裡看得到），裡面的 `max_couples` 是整個網站最多可以有幾組小窩。
5. **填設定**：打開 `config.js`，填上 Supabase 專案的網址（Project URL）和公開金鑰（Publishable key／anon key）。這兩個值本來就是公開用的，可以放在網站上。
   **絕對不要**把 service_role／secret key 或資料庫密碼放進任何檔案。
6. **推播通知（選用）**：產生一組 VAPID 金鑰，把公鑰填進 `config.js` 的 `VAPID_PUBLIC_KEY`。再把 `supabase/push/index.ts` 部署成 Edge Function `push`，並在 Edge Function 的 Secrets 設定 `VAPID_PUBLIC_KEY`、`VAPID_PRIVATE_KEY`。最後建立一個 Database Webhook：`messages` 資料表有 INSERT 時呼叫 `push`。

## 使用的開放資源

- 注音輸入詞庫：改編自酷音 [libchewing-data](https://github.com/chewing/libchewing-data)，LGPL-2.1-or-later（見 `zhuyin-LICENSE.txt`）
- 像素字型：俐方體11號 Cubic 11，SIL Open Font License 1.1（見 `fonts/Cubic_11-OFL.txt`）
- 字型：DotGothic16（Google Fonts，SIL Open Font License）
- 程式庫：supabase-js（MIT License）

## 聲明

本站是個人的非營利作品，沒有廣告也不收費。像素貓咪、圖示、介面、題目與文字都是自行創作（與 AI 工具協作完成），與任何公司、品牌、角色或作品無關。詳見網站裡的〈網站聲明〉（`about.html`）。
想刪除資料、回報問題，或認為本站內容侵害了你的權益，請寫信到 jeankl0621@gmail.com。

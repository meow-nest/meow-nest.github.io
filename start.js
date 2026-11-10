// 啟動（從 index.html 移出來，讓網站可以開啟「不准執行頁面裡的程式碼」的保護）
// 別的網站把小窩嵌在自己的網頁裡（騙人點擊）時，直接跳回小窩本身
if (window.top !== window.self) { try { window.top.location = window.self.location.href; } catch (e) { document.documentElement.style.display = "none"; } }
App.start();

// 範例：兩支模擬手機，A 開情侶小窩、B 用邀請碼加入，各截一張主畫面
// 先在「上一層資料夾」開網頁伺服器：python3 -m http.server 8765 --directory ..
// 執行：NODE_PATH=$(npm root -g) node tools/test/example.js
const { chromium, DB, pages, op } = require('./harness.js');
const URL = 'http://localhost:8765/meow-nest.github.io/index.html';
const W = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch();
  const mk = async (pg) => {
    const ctx = await b.newContext({ viewport: { width: 390, height: 800 }, deviceScaleFactor: 2 });
    await ctx.addInitScript(() => { try { localStorage.setItem('mw_instHide', '1'); } catch (e) {} });
    const p = await ctx.newPage(); p.__pg = pg; p.errs = [];
    p.on('pageerror', e => p.errs.push(e.message));
    await p.exposeFunction('__mock', (n, a) => op(p, n, a)); pages.push(p); return p;
  };
  const A = await mk(null);   // 想讓 rpc 打本機 Postgres，就傳一個 auth.users 裡的 uuid
  await A.goto(URL); await W(500);
  await A.click('#pk button:nth-child(1)'); await A.fill('#nm', '小A');
  await A.click('#mPick [data-m=couple]').catch(() => {}); await W(200);
  await A.click('#bCreate'); await W(1500);
  const B = await mk(null);
  await B.goto(URL + '?join=AB12CD'); await W(500);   // 假後端的邀請碼固定是 AB12CD
  await B.fill('#nm', '小B'); await B.click('#bJoin'); await W(1500);
  for (const p of [A, B]) await p.evaluate(() => document.querySelectorAll('.careModal').forEach(m => m.remove()));   // 關掉問卷／通知
  await A.screenshot({ path: '/tmp/ex_A.png' }); await B.screenshot({ path: '/tmp/ex_B.png' });
  console.log('errors', A.errs, B.errs, 'members', Object.keys(DB.members).length);
  await b.close();
})();

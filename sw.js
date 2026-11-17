// 喵喵小窩 service worker：負責跳通知、點通知打開 App
const CACHE = "meow-pub-v215";
const SHELL = ["./", "index.html"];   // 其他檔案用到時才存（帶版本號，存在 ASSET 裡，更新時沒改到的不用重新下載）
const ASSET = "meow-pub-assets";

self.addEventListener("install", e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {})); });
self.addEventListener("activate", e => { e.waitUntil((async () => { for (const k of await caches.keys()) if (k !== CACHE && k !== ASSET) await caches.delete(k); await self.clients.claim(); })()); });

// 首頁永遠先問網路（更新才會馬上出現）；帶版本號的檔案、字型、圖示內容不會變，直接用手機裡存好的，開啟才快
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;
  const net = () => fetch(e.request, { cache: "no-cache" }).then(r => { if (r.ok) { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)).catch(() => {}); } return r; });
  const fixed = e.request.mode !== "navigate" && (u.searchParams.has("v") || /\/(fonts|icons)\//.test(u.pathname) || /zhuyin\.txt$/.test(u.pathname));
  if (fixed) {
    // 帶版本號的檔案：同一個版本內容永遠一樣，存一次就好；換新版本時把同一個檔案的舊版本刪掉，手機空間不會越來越多
    const getA = () => fetch(e.request).then(r => { if (r.ok) { const c = r.clone(); caches.open(ASSET).then(async x => {
        for (const k of await x.keys()) { const ku = new URL(k.url); if (ku.pathname === u.pathname && ku.search !== u.search) x.delete(k); }
        await x.put(e.request, c); }).catch(() => {}); } return r; });
    e.respondWith(caches.open(ASSET).then(c => c.match(e.request)).then(hit => hit || caches.open(CACHE).then(c => c.match(e.request))).then(hit => hit || getA())
      .catch(() => getA().catch(() => caches.match(e.request, { ignoreSearch: true }))));
    return; }
  e.respondWith(net().catch(() => caches.match(e.request, { ignoreSearch: true })));
});

self.addEventListener("push", e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { title: "喵喵小窩", body: e.data ? e.data.text() : "" }; }
  e.waitUntil((async () => {
    // always show it: iPhone/Chrome may cancel the subscription if a push shows nothing.
    // (the app closes these by itself when it's open)
    const kind = String(d.tag || "").replace(/^meow-/, "") || "text";
    const body = String(d.body || "");
    const love = /我愛你|愛你|愛妳|想你|❤|💗|💕/.test(body) && (kind === "text" || kind === "sticker");
    const ICON = { text:1, sticker:1, image:1, voice:1, letter:1, poke:1, game:1, status:1, greet:1, album:1, truce:1, makeup:1 };
    const DECO = { memo:"⏰", text:"💬", sticker:"🐾", image:"📷", voice:"🎤", letter:"💌", poke:"👉", status:"📋", greet:/🌙/.test(body)?"🌙":"☀️", album:"📷", truce:"🏳️", makeup:"🤝", pin:"📌", game:"" };
    let title = d.title || "喵喵小窩";
    if (kind !== "game") { const who = title.replace(/\s*🐾$/, ""); title = `${who} ${love ? "💗" : (DECO[kind] || "🐾")}`; }
    const VIB = { poke:[90,60,90,60,160], voice:[120,60,120], letter:[60,40,60,40,200] };
    await self.registration.showNotification(title, {
      body,
      icon: `icons/n/${love ? "love" : (ICON[kind] ? kind : "text")}.png`,
      badge: "icons/badge-96.png",
      tag: d.tag || "meow",
      renotify: true,
      timestamp: Date.now(),
      vibrate: VIB[kind] || [60, 40, 60],
      data: { url: d.url || "./#chat" },
    });
  })());
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "./#chat", self.registration.scope).href;
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const w of wins) { if ("focus" in w) { w.postMessage({ go: url.split("#")[1] || "chat" }); return w.focus(); } }
    return self.clients.openWindow(url);
  })());
});

// 喵喵小窩 service worker：負責跳通知、點通知打開 App
const CACHE = "meow-pub-v113";
const SHELL = ["./", "index.html", "style.css", "pixel.js", "gameart.js", "data.js", "ime.js", "zhuyin.txt", "kaomoji.js", "changelog.js", "app.js", "start.js", "config.js", "games/moqi.js", "games/gomoku.js", "games/fight.js", "games/draw.js", "games/battleship.js", "games/quickdraw.js", "games/fishing.js", "games/runner.js", "games/runaway.js", "games/banqi.js", "games/chess.js", "games/stars.js", "games/notes.js", "games/kitchen.js", "games/boat.js", "games/defense.js", "games/blocks.js", "games/stack.js", "games/pool.js", "games/minikit.js", "games/match3.js", "games/whack.js", "games/memory.js", "games/guess.js", "games/claw.js", "games/toy3d.js", "games/claw3d.js", "games/meld.js", "games/bingo.js", "games/stock.js", "games/petdeco.js", "games/petcatch.js", "games/pet.js", "fonts/Cubic_11.woff2", "icons/icon-192.png"];

self.addEventListener("install", e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {})); });
self.addEventListener("activate", e => { e.waitUntil((async () => { for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k); await self.clients.claim(); })()); });

// network first, fall back to cache (so updates show up right away)
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request, { cache: "no-cache" }).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)).catch(() => {}); return r; }).catch(() => caches.match(e.request, { ignoreSearch: true })));
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

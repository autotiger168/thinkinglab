// ThinkingLab — 離線快取（只快取網站程式，不碰 GitHub API 與使用者資料）
const CACHE = 'thinkinglab-v3.0.0';
const SHELL = [
  './', './index.html', './css/style.css', './icon.svg', './manifest.webmanifest',
  './js/app.js', './js/store.js', './js/db.js', './js/crypto.js', './js/github.js',
  './js/tools.js', './js/tools-phase2.js', './js/tools-phase3.js', './js/editors.js', './js/figure.js', './js/export.js', './js/ui.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// 網路優先，離線時用快取：確保更新程式後立即生效
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html')))
  );
});

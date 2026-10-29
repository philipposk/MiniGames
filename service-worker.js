// MiniGames hub service worker — cache-first app shell with
// stale-while-revalidate for shared modules.
const CACHE = 'minigames-hub-v6';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
  './shared/fonts/darker-grotesque-latin.woff2',
  './shared/identity.js',
  './shared/share.js',
  './shared/leaderboard-remote.js',
  './shared/native.js',
  './shared/theme.js',
  './shared/theme.css',
  './shared/i18n.js'
];
// Warm the first two games after install so they open instantly.
const WARM = ['./color-clash/', './color-clash/game.js', './color-clash/styles.css', './color-clash/i18n.js', './piano-tap/', './piano-tap/game.js', './piano-tap/styles.css', './piano-tap/i18n.js'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(SHELL).catch(() => {}).then(() => { c.addAll(WARM).catch(() => {}); }))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // same-origin only

  // Stale-while-revalidate.
  e.respondWith(
    caches.match(req).then((hit) => {
      const fetchAndCache = fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => hit);
      return hit || fetchAndCache;
    })
  );
});

// Allow hub to force-update via postMessage({type:'SKIP_WAITING'}).
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

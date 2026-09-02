/* Rock Simulator service worker — versioned cache, app-shell strategy. */
const CACHE_VERSION = 'rock-simulator-v1';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './game.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  '../shared/theme.css',
  '../shared/theme.js',
  '../shared/identity.js',
  '../shared/share.js',
  '../shared/leaderboard-remote.js',
  '../shared/native.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
      .catch(() => { /* offline-friendly: don't crash install */ })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith('rock-simulator-') && k !== CACHE_VERSION)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // App shell: cache-first with stale-while-revalidate
  event.respondWith(
    caches.open(CACHE_VERSION).then(async (cache) => {
      const cached = await cache.match(req);
      const networkFetch = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            cache.put(req, res.clone()).catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});

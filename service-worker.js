// MiniGames Arcade hub service worker — cache-first app shell with
// stale-while-revalidate for shared modules and game thumbnails.
const CACHE = 'minigames-hub-v3';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
  './icons/arcade.svg',
  './icons/bounce-ball.svg',
  './icons/color-clash.svg',
  './icons/crossy-road.svg',
  './icons/helix-drop.svg',
  './icons/piano-tap.svg',
  './icons/rock-simulator.svg',
  './icons/stick-runner.svg',
  './icons/the-rising.svg',
  './shared/identity.js',
  './shared/share.js',
  './shared/leaderboard-remote.js',
  './shared/native.js',
  './shared/theme.js',
  './shared/theme.css'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(SHELL).catch(() => {}))
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

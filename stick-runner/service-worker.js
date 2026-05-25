/* Stick Runner service worker — cache-first app shell, versioned. */
const CACHE = 'stick-runner-v1';
const ASSETS = [
  './',
  './index.html',
  './game.js',
  './styles.css',
  './manifest.webmanifest',
  './icons/icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(resp => {
        // Cache same-origin successful responses
        const url = new URL(req.url);
        if (url.origin === location.origin && resp && resp.status === 200) {
          const copy = resp.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return resp;
      }).catch(() => cached);
    })
  );
});

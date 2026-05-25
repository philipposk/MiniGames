// The Rising - Service Worker
// Cache-first app shell, versioned cache name.

const CACHE_VERSION = 'the-rising-v1';
const APP_SHELL = [
    './',
    './index.html',
    './game.js',
    './sounds.js',
    './ending.js',
    './manifest.webmanifest',
    './icons/icon.svg'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_VERSION).then((cache) => {
            return cache.addAll(APP_SHELL).catch(() => {
                // Best-effort; missing files should not block install.
            });
        }).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => Promise.all(
            keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
        )).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;

    event.respondWith(
        caches.match(req).then((cached) => {
            if (cached) return cached;
            return fetch(req).then((res) => {
                // Optionally cache successful same-origin GETs.
                if (res && res.ok && new URL(req.url).origin === self.location.origin) {
                    const clone = res.clone();
                    caches.open(CACHE_VERSION).then((c) => c.put(req, clone)).catch(() => {});
                }
                return res;
            }).catch(() => cached);
        })
    );
});

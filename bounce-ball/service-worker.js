/* Bounce Ball service worker - cache-first app shell.
 * Bump CACHE_NAME to invalidate on deploy.
 */
const CACHE_NAME = 'bounce-ball-v2';
const APP_SHELL = [
    './',
    './index.html',
    './styles.css',
    './app.js',
    './game.js',
    './levels.js',
    './manifest.webmanifest',
    './icons/icon.svg'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => Promise.all(
            keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
        ))
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;
    event.respondWith(
        caches.match(req).then((cached) => {
            if (cached) return cached;
            return fetch(req).then((res) => {
                if (!res || res.status !== 200 || res.type === 'opaque') return res;
                const copy = res.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
                return res;
            }).catch(() => caches.match('./index.html'));
        })
    );
});

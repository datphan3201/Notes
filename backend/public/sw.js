/*
 * Planner service worker (offline support).
 *
 * - Built assets (/build/*, hashed file names) and icons: cache first.
 * - The Notes page (/): network first, cached copy when offline. The page's own
 *   IndexedDB copy then shows the notes and queues edits for sync.
 * - Other pages: network first; when offline, their cached copy or /offline.html.
 * - Attachment previews: network first with a cached fallback.
 * - API requests are never cached here: data goes through IndexedDB.
 *
 * Logging out sends {type: 'clear'}, which deletes every cache this worker owns.
 */
const VERSION = 'v1';
const STATIC = `planner-static-${VERSION}`;
const PAGES = `planner-pages-${VERSION}`;
const FILES = `planner-files-${VERSION}`;
const PRECACHE = [
    '/offline.html',
    '/offline.css',
    '/offline.js',
    '/manifest.webmanifest',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
];
// Pages kept for offline use. Only Notes works fully offline; the others show their last copy.
const OFFLINE_PAGES = new Set(['/', '/dashboard', '/tasks', '/goals', '/calendar', '/habits']);

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches
            .open(STATIC)
            .then((cache) => cache.addAll(PRECACHE))
            .then(() => self.skipWaiting()),
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((keys) =>
                Promise.all(
                    keys
                        .filter((key) => key.startsWith('planner-') && ![STATIC, PAGES, FILES].includes(key))
                        .map((key) => caches.delete(key)),
                ),
            )
            .then(() => self.clients.claim()),
    );
});

self.addEventListener('message', (event) => {
    if (event.data?.type === 'clear') {
        event.waitUntil(
            caches
                .keys()
                .then((keys) => Promise.all(keys.filter((key) => key.startsWith('planner-')).map((key) => caches.delete(key))))
                .then(() => event.source?.postMessage({ type: 'cleared' })),
        );
    }
});

self.addEventListener('fetch', (event) => {
    const request = event.request;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;
    if (url.pathname.startsWith('/api/') || url.pathname === '/sw.js') return;

    if (request.mode === 'navigate') {
        event.respondWith(navigate(request, url));
        return;
    }
    if (url.pathname.startsWith('/build/') || url.pathname.startsWith('/icons/') || PRECACHE.includes(url.pathname)) {
        event.respondWith(cacheFirst(request, STATIC));
        return;
    }
    if (url.pathname.startsWith('/files/attachments/') && url.pathname.endsWith('/preview')) {
        event.respondWith(networkFirst(request, FILES));
    }
});

async function navigate(request, url) {
    try {
        const response = await fetch(request);
        // Only real app pages: never login/logout/redirect/error responses.
        if (
            response.ok &&
            !response.redirected &&
            OFFLINE_PAGES.has(url.pathname) &&
            (response.headers.get('content-type') || '').includes('text/html')
        ) {
            const cache = await caches.open(PAGES);
            await cache.put(url.pathname, response.clone());
        }
        return response;
    } catch {
        const cache = await caches.open(PAGES);
        return (
            (await cache.match(url.pathname)) ||
            (await caches.match('/offline.html')) ||
            new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } })
        );
    }
}

async function cacheFirst(request, name) {
    const cached = await caches.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok) {
        const cache = await caches.open(name);
        cache.put(request, response.clone());
    }
    return response;
}

async function networkFirst(request, name) {
    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(name);
            cache.put(request, response.clone());
        }
        return response;
    } catch {
        return (await caches.match(request)) || new Response('', { status: 504 });
    }
}

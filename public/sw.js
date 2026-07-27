/**
 * Service worker.
 *
 * Scope of what "works offline" actually means here, so the claim on the About
 * page is checkable:
 *
 *   Offline:  the app shell, the problem dataset, all views, the maths lab,
 *             the journal, and every export format. These are either bundled
 *             assets or computed in the page.
 *   Online:   Wikipedia article links and Wikimedia pageview statistics. Both
 *             are third-party requests and neither is cached, because a stale
 *             view count presented as current is worse than an honest gap.
 *
 * Strategy: precache the built shell on install, then serve same-origin GETs
 * cache-first with a background refresh. Cross-origin requests are passed
 * straight through and never cached.
 */

const VERSION = 'opa-v1';
const SHELL = `${VERSION}-shell`;

/** Resolved relative to the worker's own scope so it works from any base path. */
const PRECACHE = ['./', './index.html', './manifest.webmanifest', './icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(PRECACHE))
      // A single missing precache entry must not block activation and leave
      // the user with no worker at all.
      .catch((err) => console.warn('[sw] precache incomplete:', err))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Wikipedia, Wikimedia: never cached.

  // Navigations: try the network so a deploy is picked up promptly, fall back
  // to the cached shell when there is no connection.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL).then((c) => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html').then((r) => r ?? Response.error())),
    );
    return;
  }

  // Hashed build assets: cache-first, with a quiet background refresh.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          if (res.ok && res.type === 'basic') {
            const copy = res.clone();
            caches.open(SHELL).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() => cached ?? Response.error());
      return cached ?? network;
    }),
  );
});

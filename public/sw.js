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

/**
 * Cache version.
 *
 * The placeholder below is replaced at build time by scripts/inject-precache.mjs
 * with a hash of the built asset filenames, so a build that changes any asset
 * automatically gets a new cache name and the activate handler purges the old one.
 *
 * This used to be a hand-maintained constant, and the failure it caused is the
 * reason it is not one any more: a deploy shipped with the version unchanged,
 * `activate` therefore deleted nothing, and every returning visitor kept being
 * served the previous build from cache — including after the old files had been
 * removed from the server. The site looked fine and was simply out of date, which
 * is the hardest kind of stale to notice.
 */
const VERSION = '__SW_VERSION__';
const SHELL = `${VERSION}-shell`;

/**
 * Resolved relative to the worker's own scope so it works from any base path.
 *
 * The marker below is replaced at build time by scripts/inject-precache.mjs
 * with the hashed asset filenames Vite produced. Without that step the app
 * boots offline only from the second visit, because the first visit's JS is
 * fetched before this worker activates. In dev the marker is simply absent and
 * the shell entries below are all that is precached, which is correct: Vite
 * serves modules unbundled there and there is nothing stable to cache.
 */
const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
  /* __PRECACHE_ASSETS__ */
];

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
  // to the cached shell.
  //
  // The timeout is the point. fetch() rejects on a hard network failure but not
  // on lie-fi — a captive portal, a dead tunnel, hotel wifi that accepts the
  // connection and then never answers. Without a race, that state produced an
  // indefinite blank page instead of the cached shell, which is precisely the
  // situation offline support exists for.
  if (request.mode === 'navigate') {
    event.respondWith(
      Promise.race([
        fetch(request).then((res) => {
          // waitUntil, so the worker cannot be killed mid-write and leave the
          // shell unrefreshed for the next visit.
          event.waitUntil(caches.open(SHELL).then((c) => c.put('./index.html', res.clone())));
          return res;
        }),
        new Promise((resolve) =>
          setTimeout(() => resolve(caches.match('./index.html').then((r) => r ?? fetch(request))), 3000),
        ),
      ]).catch(() => caches.match('./index.html').then((r) => r ?? Response.error())),
    );
    return;
  }

  // Hashed build assets: cache-first, with a quiet background refresh.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          if (res.ok && res.type === 'basic') {
            event.waitUntil(caches.open(SHELL).then((c) => c.put(request, res.clone())));
          }
          return res;
        })
        .catch(() => cached ?? Response.error());
      return cached ?? network;
    }),
  );
});

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

/**
 * What to serve for a navigation the network could not satisfy in time.
 *
 * Order matters. This exact page first, so a glossary term that has been
 * visited before comes back as itself; the app shell only as a last resort.
 * Serving the shell for /glossary/<term>/ would boot the SPA, which parses an
 * empty hash and renders the Overview — the visitor would land on the homepage
 * at a glossary URL, with nothing reporting an error.
 */
function navigationFallback(request) {
  return caches
    .match(request)
    .then((hit) => hit ?? caches.match('./index.html'))
    .then((r) => r ?? null);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Wikipedia, Wikimedia: never cached.

  // Navigations: try the network so a deploy is picked up promptly, fall back
  // to something cached.
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
          // Keyed on the REQUEST, not on a fixed './index.html'.
          //
          // The fixed key was a latent bug: every successful navigation
          // overwrote the cached app shell with whatever page had just been
          // fetched. It was harmless only while '/' was the single navigable
          // URL. Now that /glossary/<term>/ exists, visiting one glossary page
          // would have made it the page served offline for '/'.
          //
          // Redirected responses are skipped because cache.put() rejects on
          // them, and a request for /glossary/x without the trailing slash gets
          // a 301 from mod_dir. That rejection would be unhandled inside
          // waitUntil.
          if (res.ok && !res.redirected) {
            event.waitUntil(
              caches
                .open(SHELL)
                .then((c) => c.put(request, res.clone()))
                .catch(() => {}),
            );
          }
          return res;
        }),
        // Resolve ONLY if something cached is available. Resolving with an
        // empty result would abort a merely-slow navigation that was going to
        // succeed.
        new Promise((resolve) => {
          setTimeout(() => {
            void navigationFallback(request).then((r) => r && resolve(r));
          }, 3000);
        }),
      ]).catch(() => navigationFallback(request).then((r) => r ?? Response.error())),
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

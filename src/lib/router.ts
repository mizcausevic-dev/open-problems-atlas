/**
 * Hash routing, with query state.
 *
 * Hash rather than the History API because this ships as static files: every
 * route has to resolve without a server rewrite rule, whether it is served from
 * a subdomain root, a subdirectory, or opened from disk. That is also why
 * vite.config.ts sets base: './'.
 *
 * The query half matters as much as the path. Filters, sort order, search text
 * and lab inputs all live in the hash query string, so a filtered view or a
 * specific computation is a link someone can send. Anything the user can set
 * and would reasonably expect to share belongs here rather than in useState.
 *
 * Hand-rolled rather than react-router because the whole requirement is "map a
 * string to one of nine views and carry some params", and this is the entire
 * implementation.
 */

import { useSyncExternalStore, useCallback, useMemo } from 'react';

export type RouteName =
  | 'overview'
  | 'atlas'
  | 'problem'
  | 'collection'
  | 'dashboard'
  | 'timeline'
  | 'lab'
  | 'journal'
  | 'about';

export type Route =
  | { name: 'overview' }
  | { name: 'atlas' }
  | { name: 'problem'; id: string }
  | { name: 'collection'; slug: string }
  | { name: 'dashboard' }
  | { name: 'timeline' }
  | { name: 'lab'; tool?: string }
  | { name: 'journal' }
  | { name: 'about' };

export interface Location {
  route: Route;
  query: URLSearchParams;
}

export function parseHash(hash: string): Location {
  const raw = hash.replace(/^#\/?/, '');
  const qIndex = raw.indexOf('?');
  const path = qIndex === -1 ? raw : raw.slice(0, qIndex);
  const query = new URLSearchParams(qIndex === -1 ? '' : raw.slice(qIndex + 1));

  const [head, ...rest] = path.split('/').filter(Boolean);

  const route = ((): Route => {
    switch (head) {
      case undefined:
      case '':
        return { name: 'overview' };
      case 'atlas':
        return { name: 'atlas' };
      case 'p':
        return rest[0] ? { name: 'problem', id: decodeURIComponent(rest[0]) } : { name: 'atlas' };
      case 'collection':
        return rest[0]
          ? { name: 'collection', slug: decodeURIComponent(rest[0]) }
          : { name: 'overview' };
      case 'dashboard':
        return { name: 'dashboard' };
      case 'timeline':
        return { name: 'timeline' };
      case 'lab':
        return rest[0] ? { name: 'lab', tool: rest[0] } : { name: 'lab' };
      case 'journal':
        return { name: 'journal' };
      case 'about':
        return { name: 'about' };
      default:
        return { name: 'overview' };
    }
  })();

  return { route, query };
}

function pathOf(route: Route): string {
  switch (route.name) {
    case 'overview':
      return '#/';
    case 'problem':
      return `#/p/${encodeURIComponent(route.id)}`;
    case 'collection':
      return `#/collection/${encodeURIComponent(route.slug)}`;
    case 'lab':
      return route.tool ? `#/lab/${route.tool}` : '#/lab';
    default:
      return `#/${route.name}`;
  }
}

/**
 * Build a link. Params whose value is undefined, null or '' are dropped, so
 * callers can pass the whole state object and let defaults fall away rather
 * than producing `?q=&sort=&status=` on a pristine view.
 */
export function href(route: Route, params?: Record<string, string | number | boolean | undefined | null>): string {
  const path = pathOf(route);
  if (!params) return path;

  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '' || v === false) continue;
    q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `${path}?${s}` : path;
}

const subscribe = (fn: () => void) => {
  window.addEventListener('hashchange', fn);
  return () => window.removeEventListener('hashchange', fn);
};

const getSnapshot = () => window.location.hash;

export function useLocation(): Location & {
  navigate: (route: Route, params?: Record<string, string | number | boolean | undefined | null>) => void;
  /** Rewrite only the query, keeping the current route. Used by filter controls. */
  setQuery: (params: Record<string, string | number | boolean | undefined | null>) => void;
} {
  const hash = useSyncExternalStore(subscribe, getSnapshot, () => '#/');
  const { route, query } = useMemo(() => parseHash(hash), [hash]);

  const navigate = useCallback(
    (to: Route, params?: Record<string, string | number | boolean | undefined | null>) => {
      window.location.hash = href(to, params);
      // A hash change does not reset scroll, and landing halfway down a new page
      // reads as a broken link.
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    },
    [],
  );

  const setQuery = useCallback(
    (params: Record<string, string | number | boolean | undefined | null>) => {
      const next = href(route, params);
      // replaceState, not assignment: dragging a slider or typing in the search
      // box would otherwise push a history entry per keystroke and make the back
      // button useless.
      history.replaceState(null, '', next);
      // replaceState does not fire hashchange, so tell subscribers ourselves.
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    },
    [route],
  );

  return { route, query, navigate, setQuery };
}

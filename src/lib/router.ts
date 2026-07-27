/**
 * Hash routing.
 *
 * Hash rather than history API because this ships as static files: every route
 * has to resolve without a server rewrite rule, whether it is served from a
 * subdomain root, a subdirectory, or opened from disk. That is also why
 * vite.config.ts sets base: './'.
 *
 * Hand-rolled rather than react-router because the whole requirement is "map a
 * string to one of seven views", and this is the entire implementation.
 */

import { useSyncExternalStore, useCallback } from 'react';

export type Route =
  | { name: 'atlas' }
  | { name: 'problem'; id: string }
  | { name: 'dashboard' }
  | { name: 'timeline' }
  | { name: 'lab'; tool?: string }
  | { name: 'journal' }
  | { name: 'about' };

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#\/?/, '').split('?')[0] ?? '';
  const [head, ...rest] = path.split('/').filter(Boolean);

  switch (head) {
    case undefined:
    case '':
      return { name: 'atlas' };
    case 'p':
      return rest[0] ? { name: 'problem', id: decodeURIComponent(rest[0]) } : { name: 'atlas' };
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
      return { name: 'atlas' };
  }
}

export function href(route: Route): string {
  switch (route.name) {
    case 'atlas':
      return '#/';
    case 'problem':
      return `#/p/${encodeURIComponent(route.id)}`;
    case 'lab':
      return route.tool ? `#/lab/${route.tool}` : '#/lab';
    default:
      return `#/${route.name}`;
  }
}

const subscribe = (fn: () => void) => {
  window.addEventListener('hashchange', fn);
  return () => window.removeEventListener('hashchange', fn);
};

const getSnapshot = () => window.location.hash;

export function useRoute(): [Route, (r: Route) => void] {
  const hash = useSyncExternalStore(subscribe, getSnapshot, () => '#/');
  const navigate = useCallback((r: Route) => {
    window.location.hash = href(r);
    // A hash change does not reset scroll, and landing halfway down a new page
    // reads as a broken link.
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, []);
  return [parseHash(hash), navigate];
}

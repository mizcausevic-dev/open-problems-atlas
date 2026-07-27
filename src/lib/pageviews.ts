/**
 * Wikimedia pageview statistics.
 *
 * The one rule that matters here: when the API cannot be reached, this module
 * returns an error. It does not return a number.
 *
 * That sounds obvious, and it is the single most common failure in this
 * category of app. A "deterministic fallback" that hashes the article title
 * into a plausible view count produces output indistinguishable from real data,
 * renders in the same chart, with the same "last updated" date, and is wrong.
 * A reader cannot tell. The chart in this app is either real or absent.
 */

import type { Pageviews, Remote } from '../types';

const ENDPOINT = 'https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article';

/** yyyymmdd, the format the pageviews API expects. */
function stamp(d: Date): string {
  return (
    d.getUTCFullYear().toString() +
    String(d.getUTCMonth() + 1).padStart(2, '0') +
    String(d.getUTCDate()).padStart(2, '0')
  );
}

/** yyyymmddhh (API responses) or yyyymmdd -> yyyy-mm-dd */
function isoDate(apiStamp: string): string {
  return `${apiStamp.slice(0, 4)}-${apiStamp.slice(4, 6)}-${apiStamp.slice(6, 8)}`;
}

export interface FetchOptions {
  days?: number;
  signal?: AbortSignal;
}

export async function fetchPageviews(
  wikipediaTitle: string,
  { days = 60, signal }: FetchOptions = {},
): Promise<Remote<Pageviews>> {
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 1); // yesterday: today is usually incomplete
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days - 1));

  const article = encodeURIComponent(wikipediaTitle.replace(/ /g, '_'));
  const url = `${ENDPOINT}/en.wikipedia/all-access/all-agents/${article}/daily/${stamp(start)}/${stamp(end)}`;

  try {
    const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });

    if (res.status === 404) {
      return { kind: 'error', message: 'Wikimedia has no pageview data for this article title.' };
    }
    if (!res.ok) {
      return { kind: 'error', message: `Wikimedia API returned HTTP ${res.status}.` };
    }

    const json: unknown = await res.json();
    const items = (json as { items?: { timestamp: string; views: number }[] }).items;
    if (!Array.isArray(items) || items.length === 0) {
      return { kind: 'error', message: 'Wikimedia returned no data points for this window.' };
    }

    const series = items.map((i) => ({ date: isoDate(i.timestamp), views: i.views }));
    const total = series.reduce((a, b) => a + b.views, 0);

    // Compare the last 14 days against the 14 before them. Reported only when
    // both windows are complete, so a short series yields no figure at all
    // rather than a percentage computed from three days of data.
    let changePct: number | undefined;
    if (series.length >= 28) {
      const recent = series.slice(-14).reduce((a, b) => a + b.views, 0);
      const prior = series.slice(-28, -14).reduce((a, b) => a + b.views, 0);
      if (prior > 0) changePct = ((recent - prior) / prior) * 100;
    }

    return {
      kind: 'ok',
      fetchedAt: new Date().toISOString(),
      value: {
        series,
        total,
        mean: total / series.length,
        ...(changePct !== undefined ? { changePct } : {}),
        windowStart: series[0]!.date,
        windowEnd: series[series.length - 1]!.date,
      },
    };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { kind: 'idle' };
    }
    return {
      kind: 'error',
      message: navigator.onLine
        ? 'Could not reach the Wikimedia API.'
        : 'Offline. Pageview data needs a connection.',
    };
  }
}

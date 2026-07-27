/**
 * Search and filtering over the full problem set.
 *
 * Six hundred-odd problems is small enough that a linear scan per keystroke is fine
 * (measured well under a frame on a mid-range laptop), so there is no index to
 * build, invalidate, or get wrong. What does need care is ranking: a query of
 * "prime" should put "Prime gap" above a problem that merely mentions primes in
 * its description, and exact title matches above both.
 */

import type { Problem, ProblemStatus, TrackState, TrackedProblem } from '../types';
import { TRACK_STATES } from '../types';
import { settledYearOf } from './counts';

export interface Filters {
  query: string;
  fields: string[];
  status: ProblemStatus | 'all';
  millenniumOnly: boolean;
  /** 'any' ignores tracking, 'tracked' means any tracked state. */
  tracking: 'any' | 'tracked' | 'untracked' | TrackState;
  /** Hide sub-case bullets, which are numerous and often only meaningful in context. */
  topLevelOnly: boolean;
}

export const DEFAULT_FILTERS: Filters = {
  query: '',
  fields: [],
  status: 'all',
  millenniumOnly: false,
  tracking: 'any',
  topLevelOnly: false,
};

/** Fold accents and case so "Poincare" finds "Poincaré". */
export function normalise(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

function scoreOne(p: Problem, needle: string): number {
  const title = normalise(p.title);
  if (title === needle) return 1000;
  if (title.startsWith(needle)) return 500;

  // Word-boundary match in the title beats a mid-word one.
  const wordStart = new RegExp(`\\b${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
  if (wordStart.test(title)) return 300;
  if (title.includes(needle)) return 200;

  if (p.subfield && normalise(p.subfield).includes(needle)) return 80;
  if (normalise(p.field).includes(needle)) return 60;
  if (p.solvedBy && normalise(p.solvedBy).includes(needle)) return 55;
  if (p.description && normalise(p.description).includes(needle)) return 40;
  if (p.relatedTopics?.some((t) => normalise(t).includes(needle))) return 20;
  return 0;
}

/** All query terms must match somewhere; the score is their sum. */
export function score(p: Problem, query: string): number {
  const terms = normalise(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return 1;

  let total = 0;
  for (const term of terms) {
    const s = scoreOne(p, term);
    if (s === 0) return 0;
    total += s;
  }
  return total;
}

export type SortKey = 'relevance' | 'title' | 'field' | 'settled-new' | 'settled-old';

export const SORT_OPTIONS: { key: SortKey; label: string; hint: string }[] = [
  { key: 'relevance', label: 'Best match', hint: 'Search ranking, then the source order' },
  { key: 'title', label: 'A to Z', hint: 'Alphabetical across every field' },
  { key: 'field', label: 'By field', hint: 'Grouped as the source article groups them' },
  { key: 'settled-new', label: 'Settled, newest', hint: 'Recently settled first; open problems last' },
  { key: 'settled-old', label: 'Settled, oldest', hint: 'Earliest settled first; open problems last' },
];

/**
 * Apply a sort to an already-filtered, already-ranked list.
 *
 * Kept separate from filterProblems because ranking and ordering are different
 * jobs: ranking answers "how well does this match", ordering answers "what does
 * the reader want to see first". Only 'relevance' uses the score at all.
 */
export function sortProblems(
  problems: Problem[],
  sort: SortKey,
  fieldOrder: string[],
): Problem[] {
  if (sort === 'relevance') return problems;

  const out = [...problems];
  const fieldRank = new Map(fieldOrder.map((f, i) => [f, i]));
  const byTitle = (a: Problem, b: Problem) => a.title.localeCompare(b.title);

  switch (sort) {
    case 'title':
      return out.sort(byTitle);

    case 'field':
      return out.sort(
        (a, b) =>
          (fieldRank.get(a.field) ?? 999) - (fieldRank.get(b.field) ?? 999) ||
          (a.subfield ?? '').localeCompare(b.subfield ?? '') ||
          byTitle(a, b),
      );

    case 'settled-new':
    case 'settled-old': {
      const dir = sort === 'settled-new' ? -1 : 1;
      return out.sort((a, b) => {
        const ya = settledYearOf(a);
        const yb = settledYearOf(b);
        // Problems with no settled year sort last in both directions rather
        // than being treated as year zero, which would put every open problem
        // at one end and read as if they had been settled in antiquity.
        if (ya === undefined && yb === undefined) return byTitle(a, b);
        if (ya === undefined) return 1;
        if (yb === undefined) return -1;
        return (ya - yb) * dir || byTitle(a, b);
      });
    }

    default:
      return out;
  }
}

export function filterProblems(
  problems: Problem[],
  filters: Filters,
  tracked: Record<string, TrackedProblem>,
): Problem[] {
  const { query, fields, status, millenniumOnly, tracking, topLevelOnly } = filters;
  const fieldSet = fields.length ? new Set(fields) : null;

  const scored: { p: Problem; s: number }[] = [];

  for (const p of problems) {
    if (fieldSet && !fieldSet.has(p.field)) continue;
    if (status !== 'all' && p.status !== status) continue;
    if (millenniumOnly && !p.millennium) continue;
    if (topLevelOnly && p.depth > 1) continue;

    if (tracking !== 'any') {
      const t = tracked[p.id];
      if (tracking === 'tracked' && !t) continue;
      if (tracking === 'untracked' && t) continue;
      if (tracking !== 'tracked' && tracking !== 'untracked' && t?.state !== tracking) continue;
    }

    const s = score(p, query);
    if (s === 0) continue;
    scored.push({ p, s });
  }

  // With no query there is nothing to rank, so keep the dataset's own order:
  // grouped by field, alphabetical within it. Sorting by title anyway would
  // shuffle the fields together and lose the grouping for no benefit.
  if (filters.query.trim()) {
    scored.sort((a, b) => b.s - a.s || a.p.title.localeCompare(b.p.title));
  }
  return scored.map((x) => x.p);
}

// ---------------------------------------------------------------------------
// URL serialisation
//
// Short keys because they end up in a link someone pastes into a message.
// Defaults are omitted entirely so a pristine atlas has a clean `#/atlas` URL
// and only deliberate choices show up in the address bar.
// ---------------------------------------------------------------------------

export interface AtlasState extends Filters {
  sort: SortKey;
}

export const DEFAULT_ATLAS_STATE: AtlasState = { ...DEFAULT_FILTERS, sort: 'relevance' };

export function atlasStateToParams(s: AtlasState): Record<string, string | undefined> {
  return {
    q: s.query || undefined,
    field: s.fields.length ? s.fields.join('~') : undefined,
    status: s.status !== 'all' ? s.status : undefined,
    track: s.tracking !== 'any' ? s.tracking : undefined,
    mp: s.millenniumOnly ? '1' : undefined,
    top: s.topLevelOnly ? '1' : undefined,
    sort: s.sort !== 'relevance' ? s.sort : undefined,
  };
}

/** Tolerant of anything: an unrecognised value falls back to the default. */
export function atlasStateFromParams(q: URLSearchParams, knownFields: string[]): AtlasState {
  const fieldSet = new Set(knownFields);
  const status = q.get('status') ?? 'all';
  const tracking = q.get('track') ?? 'any';
  const sort = q.get('sort') ?? 'relevance';

  const validStatus = ['all', 'open', 'solved', 'partially-solved'].includes(status);
  const validTracking = ['any', 'tracked', 'untracked', ...TRACK_STATES].includes(tracking);
  const validSort = SORT_OPTIONS.some((o) => o.key === sort);

  return {
    query: q.get('q') ?? '',
    // Tilde-separated: field names contain spaces and commas would need escaping.
    fields: (q.get('field') ?? '').split('~').filter((f) => f && fieldSet.has(f)),
    status: (validStatus ? status : 'all') as AtlasState['status'],
    tracking: (validTracking ? tracking : 'any') as AtlasState['tracking'],
    millenniumOnly: q.get('mp') === '1',
    topLevelOnly: q.get('top') === '1',
    sort: (validSort ? sort : 'relevance') as SortKey,
  };
}

/** How many non-default choices are active, for the filter button's badge. */
export function activeFilterCount(s: AtlasState): number {
  return (
    s.fields.length +
    (s.status !== 'all' ? 1 : 0) +
    (s.millenniumOnly ? 1 : 0) +
    (s.tracking !== 'any' ? 1 : 0) +
    (s.topLevelOnly ? 1 : 0) +
    (s.sort !== 'relevance' ? 1 : 0)
  );
}

export function countBy<T extends string>(problems: Problem[], key: (p: Problem) => T): Record<T, number> {
  const out = {} as Record<T, number>;
  for (const p of problems) {
    const k = key(p);
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}


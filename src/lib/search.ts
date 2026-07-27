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

export function countBy<T extends string>(problems: Problem[], key: (p: Problem) => T): Record<T, number> {
  const out = {} as Record<T, number>;
  for (const p of problems) {
    const k = key(p);
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}


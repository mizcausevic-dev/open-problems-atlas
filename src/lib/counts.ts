/**
 * Derived counts: one source of truth for every figure the app displays.
 *
 * This module exists because the app shipped two different numbers for the same
 * apparent thing. The header said "105 settled since 1995"; the Solved page said
 * "111 entries". Both were computed correctly and neither was wrong — they
 * simply counted different sets, and no surface said which:
 *
 *   105  problems whose status is 'solved'
 *   + 8  problems listed as open in one case and settled in another, which the
 *        parser records as 'partially-solved' with an explicit solved variant
 *   ---
 *   113  entries the timeline has something settled to show
 *   - 2  of those have no parsable year
 *   ---
 *   111  entries the timeline can place on a year axis
 *
 * The bug was not arithmetic, it was vocabulary. So the fix is not a single
 * number, it is named quantities that cannot be confused for one another, plus
 * shared predicates so the timeline and the counters can never drift apart
 * again. counts.test.ts asserts the identities above hold.
 */

import type { Problem } from '../types';

export interface TimelineCounts {
  /** Problems with something settled to show: fully settled plus partly settled. */
  entries: number;
  /** Of those, the ones carrying a year and therefore placeable on the axis. */
  dated: number;
  /** Of those, the ones with no parsable year. Shown, never silently dropped. */
  undated: number;
  firstYear?: number;
  lastYear?: number;
}

export interface DerivedCounts {
  total: number;
  open: number;
  /** status === 'solved'. The headline "settled since 1995" figure. */
  settled: number;
  /** status === 'partially-solved'. Open in one case, settled in another. */
  partlySettled: number;
  millennium: number;
  withDescription: number;
  withReferences: number;
  withArticle: number;
  fields: number;
  timeline: TimelineCounts;
}

/** True when the problem has a settled outcome to show, in whole or in part. */
export function hasSettledOutcome(p: Problem): boolean {
  return p.status === 'solved' || (p.variants?.some((v) => v.status === 'solved') ?? false);
}

/** The year it was settled, from the problem or from its settled variant. */
export function settledYearOf(p: Problem): number | undefined {
  return p.solvedYear ?? p.variants?.find((v) => v.solvedYear)?.solvedYear;
}

/** Who settled it, from the problem or from its settled variant. */
export function settledByOf(p: Problem): string | undefined {
  return p.solvedBy ?? p.variants?.find((v) => v.solvedBy)?.solvedBy;
}

export function deriveCounts(problems: Problem[]): DerivedCounts {
  const settledSet = problems.filter(hasSettledOutcome);
  const years = settledSet
    .map(settledYearOf)
    .filter((y): y is number => y !== undefined);

  return {
    total: problems.length,
    open: problems.filter((p) => p.status === 'open').length,
    settled: problems.filter((p) => p.status === 'solved').length,
    partlySettled: problems.filter((p) => p.status === 'partially-solved').length,
    millennium: problems.filter((p) => p.millennium).length,
    withDescription: problems.filter((p) => p.description).length,
    withReferences: problems.filter((p) => p.references?.length).length,
    withArticle: problems.filter((p) => p.wikipediaTitle).length,
    fields: new Set(problems.map((p) => p.field)).size,
    timeline: {
      entries: settledSet.length,
      dated: years.length,
      undated: settledSet.length - years.length,
      ...(years.length
        ? { firstYear: Math.min(...years), lastYear: Math.max(...years) }
        : {}),
    },
  };
}

/**
 * The one sentence every surface uses to describe the collection, so the phrasing
 * cannot drift between the header, the atlas and the about page either.
 */
export function summarySentence(c: DerivedCounts): string {
  const partly = c.partlySettled ? `, ${c.partlySettled} partly settled` : '';
  return `${c.open.toLocaleString()} open${partly}, ${c.settled} settled since 1995`;
}

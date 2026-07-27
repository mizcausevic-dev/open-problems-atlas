/**
 * Curated entry points, and the problem of the day.
 *
 * Every collection here is defined by a *predicate over the dataset*, not by a
 * hand-picked list of ids. That matters for the same reason the dataset is
 * generated rather than typed: a hand-picked list silently rots when the source
 * article changes, and nobody notices because it still renders.
 *
 * Each collection states its own membership rule in `basis`, which the UI shows,
 * so a reader can check that the contents match the claim.
 */

import type { Problem } from '../types';
import { hasSettledOutcome, settledYearOf } from './counts';

export interface Collection {
  slug: string;
  title: string;
  blurb: string;
  /** The membership rule, in words. Displayed with the collection. */
  basis: string;
  match: (p: Problem, all: Problem[]) => boolean;
}

/**
 * Problems with a live tool in the Lab: problem id -> lab tool slugs.
 *
 * These ids are checked against the dataset by collections.test.ts. Three of the
 * first six written here were wrong (`twin-prime-conjecture` is actually
 * `twin-prime`, and Goldbach appears twice at different bullet depths), which is
 * exactly the kind of silent rot the test exists to catch: a wrong id does not
 * throw, it just quietly produces an empty collection and a missing badge.
 */
export const LAB_PROBLEM_IDS: Record<string, string[]> = {
  'collatz-conjecture': ['collatz'],
  'riemann-hypothesis': ['zeta', 'robin'],
  'goldbach-s-conjecture': ['primes'],
  'goldbach-conjecture': ['primes'],
  'twin-prime': ['primes'],
  'landau-s-problems': ['primes'],
};

const RECENT_YEARS = 6;

export const COLLECTIONS: Collection[] = [
  {
    slug: 'millennium',
    title: 'The Millennium Prize Problems',
    blurb:
      'Seven problems named by the Clay Mathematics Institute in 2000, each carrying a million-dollar prize. One has been settled. This is the shortest complete path into the subject.',
    basis: 'Problems flagged millennium in the dataset, from the article’s own Notable lists section.',
    match: (p) => Boolean(p.millennium),
  },
  {
    slug: 'recently-settled',
    title: 'Settled in the last few years',
    blurb:
      'The list is not frozen. These came off the open list recently enough that most people still think of them as open.',
    basis: `Settled outcome with a recorded year in the last ${RECENT_YEARS} calendar years.`,
    match: (p) => {
      const y = settledYearOf(p);
      return hasSettledOutcome(p) && y !== undefined && y >= new Date().getFullYear() - RECENT_YEARS;
    },
  },
  {
    slug: 'in-the-lab',
    title: 'Problems you can compute against',
    blurb:
      'The Lab runs the actual mathematics for these in your browser, from the definition. Start here if you would rather poke at something than read about it.',
    basis: 'Problems with a corresponding live tool in the Lab.',
    match: (p) => p.id in LAB_PROBLEM_IDS,
  },
  {
    slug: 'listed-twice',
    title: 'Open and settled at the same time',
    blurb:
      'The source article lists each of these twice with different outcomes, usually because a conjecture is settled in one dimension or one case and open in another. The most interesting corner of the dataset.',
    basis: 'Problems whose status is partially-solved, i.e. listed with conflicting outcomes.',
    match: (p) => p.status === 'partially-solved',
  },
  {
    slug: 'elementary-to-state',
    title: 'Easy to state, nobody can prove them',
    blurb:
      '“Are there infinitely many cousin primes?” Every one of these is a single plain-English question with no notation at all, and every one is open. The gap between understanding a question and answering it is the whole subject.',
    // Tightened after the first rule returned 314, which is a filter, not a
    // collection. Requiring a question mark and no notation at all is what
    // actually captures "you could ask this at a dinner table".
    basis:
      'Open top-level problems stated as a question under 90 characters, containing no mathematical notation.',
    match: (p) =>
      p.status === 'open' &&
      p.depth === 1 &&
      Boolean(p.description) &&
      p.description!.length < 90 &&
      !p.description!.includes('$') &&
      p.description!.trim().endsWith('?'),
  },
];

export function getCollection(slug: string): Collection | undefined {
  return COLLECTIONS.find((c) => c.slug === slug);
}

export function collectionMembers(collection: Collection, all: Problem[]): Problem[] {
  return all.filter((p) => collection.match(p, all));
}

// ---------------------------------------------------------------------------
// Problem of the day
// ---------------------------------------------------------------------------

/**
 * FNV-1a. Chosen because it is short, has no dependencies, and is completely
 * deterministic: the same date string always produces the same number, on every
 * device, forever. Math.random would change on reload, which is exactly the
 * behaviour the requirement rules out.
 */
function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Local calendar date as YYYY-MM-DD. Local, so "today" means the reader's today. */
export function dayKey(date = new Date()): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

/**
 * The featured problem for a given day.
 *
 * Drawn only from problems that have a description, so the card is never a bare
 * title with nothing under it. Sorted by id first so the choice does not depend
 * on the dataset's iteration order, which would make it shift whenever the
 * source article was re-scraped.
 */
export function problemOfTheDay(all: Problem[], date = new Date()): Problem | undefined {
  const eligible = all.filter((p) => p.description && p.depth === 1).sort((a, b) => a.id.localeCompare(b.id));
  if (eligible.length === 0) return undefined;
  return eligible[hashString(dayKey(date)) % eligible.length];
}

/**
 * Pick a random problem from a candidate set.
 *
 * Genuinely random, unlike problemOfTheDay: this is a "show me something else"
 * action, so repeating a click should give a different answer.
 */
export function randomProblem(candidates: Problem[], exclude?: string): Problem | undefined {
  const pool = exclude ? candidates.filter((p) => p.id !== exclude) : candidates;
  if (pool.length === 0) return undefined;
  return pool[Math.floor(Math.random() * pool.length)];
}

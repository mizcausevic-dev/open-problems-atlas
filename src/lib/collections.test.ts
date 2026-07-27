import { describe, it, expect } from 'vitest';
import raw from '../data/problems.generated.json';
import type { Dataset } from '../types';
import {
  COLLECTIONS,
  LAB_PROBLEM_IDS,
  collectionMembers,
  getCollection,
  problemOfTheDay,
  randomProblem,
  dayKey,
} from './collections';

const { problems } = raw as unknown as Dataset;
const ids = new Set(problems.map((p) => p.id));

describe('lab problem ids', () => {
  it('all refer to problems that exist in the dataset', () => {
    // A wrong id here does not throw, it silently yields an empty collection
    // and a missing badge. Three of the first six were wrong.
    for (const id of Object.keys(LAB_PROBLEM_IDS)) {
      expect(ids.has(id), `${id} is not in the dataset`).toBe(true);
    }
  });

  it('names lab tools that exist', () => {
    const tools = new Set(['collatz', 'primes', 'zeta', 'robin', 'evidence', 'covering']);
    for (const [id, list] of Object.entries(LAB_PROBLEM_IDS)) {
      for (const tool of list) expect(tools.has(tool), `${id} -> ${tool}`).toBe(true);
    }
  });
});

describe('collections', () => {
  it('every collection has a unique slug and a stated basis', () => {
    const slugs = COLLECTIONS.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const c of COLLECTIONS) {
      expect(c.basis.length, c.slug).toBeGreaterThan(20);
      expect(c.blurb.length, c.slug).toBeGreaterThan(20);
    }
  });

  it('every collection is non-empty against the real dataset', () => {
    // An empty curated collection is a broken link, not a design choice.
    for (const c of COLLECTIONS) {
      expect(collectionMembers(c, problems).length, c.slug).toBeGreaterThan(0);
    }
  });

  it('the Millennium collection contains exactly the seven', () => {
    const millennium = collectionMembers(getCollection('millennium')!, problems);
    expect(millennium).toHaveLength(7);
  });

  it('listed-twice matches the partially-solved set', () => {
    const listedTwice = collectionMembers(getCollection('listed-twice')!, problems);
    expect(listedTwice.map((p) => p.id).sort()).toEqual(
      problems.filter((p) => p.status === 'partially-solved').map((p) => p.id).sort(),
    );
  });

  it('elementary-to-state contains only open problems', () => {
    for (const p of collectionMembers(getCollection('elementary-to-state')!, problems)) {
      expect(p.status, p.id).toBe('open');
    }
  });

  it('returns undefined for an unknown slug rather than throwing', () => {
    expect(getCollection('not-a-collection')).toBeUndefined();
  });
});

describe('problem of the day', () => {
  it('is stable across repeated calls on the same date', () => {
    const d = new Date(2026, 6, 27);
    const first = problemOfTheDay(problems, d);
    for (let i = 0; i < 20; i++) {
      expect(problemOfTheDay(problems, d)?.id).toBe(first?.id);
    }
  });

  it('changes across days', () => {
    const picks = new Set<string>();
    for (let i = 0; i < 30; i++) {
      const d = new Date(2026, 0, 1 + i);
      picks.add(problemOfTheDay(problems, d)?.id ?? '');
    }
    // Not necessarily 30 distinct, but a single value across a month would mean
    // the hash is not doing anything.
    expect(picks.size).toBeGreaterThan(20);
  });

  it('only ever picks a problem that has something to show', () => {
    for (let i = 0; i < 60; i++) {
      const p = problemOfTheDay(problems, new Date(2026, 0, 1 + i));
      expect(p?.description, p?.id).toBeTruthy();
      expect(p?.depth).toBe(1);
    }
  });

  it('formats the day key as a local calendar date', () => {
    expect(dayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(dayKey(new Date(2026, 11, 31))).toBe('2026-12-31');
  });

  it('handles an empty dataset without throwing', () => {
    expect(problemOfTheDay([], new Date())).toBeUndefined();
  });
});

describe('randomProblem', () => {
  it('never returns the excluded problem', () => {
    const first = problems[0]!;
    for (let i = 0; i < 50; i++) {
      expect(randomProblem(problems, first.id)?.id).not.toBe(first.id);
    }
  });

  it('returns undefined when there is nothing to pick from', () => {
    expect(randomProblem([])).toBeUndefined();
    expect(randomProblem([problems[0]!], problems[0]!.id)).toBeUndefined();
  });
});

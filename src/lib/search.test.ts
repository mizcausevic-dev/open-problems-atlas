import { describe, it, expect } from 'vitest';
import {
  filterProblems,
  score,
  normalise,
  DEFAULT_FILTERS,
  DEFAULT_ATLAS_STATE,
  sortProblems,
  atlasStateToParams,
  atlasStateFromParams,
  activeFilterCount,
} from './search';
import type { Problem, TrackedProblem } from '../types';

const make = (over: Partial<Problem>): Problem => ({
  id: 'x',
  title: 'X',
  wikipediaTitle: 'X',
  field: 'Number theory',
  fieldSource: 'wikipedia-section',
  status: 'open',
  depth: 1,
  ...over,
});

const problems: Problem[] = [
  make({ id: 'prime-gap', title: 'Prime gap', description: 'How large can gaps between primes get?' }),
  make({ id: 'twin', title: 'Twin prime conjecture', description: 'Infinitely many $p, p+2$ both prime.' }),
  make({ id: 'rh', title: 'Riemann hypothesis', millennium: true, subfield: 'Analytic number theory' }),
  make({ id: 'poincare', title: 'Poincaré conjecture', field: 'Topology', status: 'solved', solvedBy: 'Grigori Perelman', solvedYear: 2002 }),
  make({ id: 'sub', title: 'Grand Riemann hypothesis', depth: 2, parentId: 'rh' }),
  make({ id: 'hodge', title: 'Hodge conjecture', field: 'Geometry', millennium: true }),
];

const noTracking: Record<string, TrackedProblem> = {};

describe('normalise', () => {
  it('folds accents and case', () => {
    expect(normalise('Poincaré')).toBe('poincare');
    expect(normalise('ERDŐS')).toBe('erdos');
  });
});

describe('score', () => {
  it('ranks an exact title match highest', () => {
    const exact = score(problems[0]!, 'prime gap');
    const partial = score(problems[1]!, 'prime');
    expect(exact).toBeGreaterThan(partial);
  });

  it('ranks a title match above a description match', () => {
    const titleMatch = score(problems[1]!, 'twin');
    const descMatch = score(problems[0]!, 'gaps');
    expect(titleMatch).toBeGreaterThan(descMatch);
  });

  it('requires every term to match', () => {
    expect(score(problems[2]!, 'riemann hypothesis')).toBeGreaterThan(0);
    expect(score(problems[2]!, 'riemann banana')).toBe(0);
  });

  it('matches an accent-free query against an accented title', () => {
    expect(score(problems[3]!, 'poincare')).toBeGreaterThan(0);
  });

  it('finds a solved problem by its solver', () => {
    expect(score(problems[3]!, 'perelman')).toBeGreaterThan(0);
  });
});

describe('filterProblems', () => {
  it('returns everything when unfiltered', () => {
    expect(filterProblems(problems, DEFAULT_FILTERS, noTracking)).toHaveLength(problems.length);
  });

  it('filters by field', () => {
    const out = filterProblems(problems, { ...DEFAULT_FILTERS, fields: ['Topology'] }, noTracking);
    expect(out.map((p) => p.id)).toEqual(['poincare']);
  });

  it('filters by status', () => {
    const out = filterProblems(problems, { ...DEFAULT_FILTERS, status: 'solved' }, noTracking);
    expect(out.map((p) => p.id)).toEqual(['poincare']);
  });

  it('filters to Millennium problems', () => {
    const out = filterProblems(problems, { ...DEFAULT_FILTERS, millenniumOnly: true }, noTracking);
    expect(out.map((p) => p.id).sort()).toEqual(['hodge', 'rh']);
  });

  it('hides sub-cases when asked', () => {
    const out = filterProblems(problems, { ...DEFAULT_FILTERS, topLevelOnly: true }, noTracking);
    expect(out.find((p) => p.id === 'sub')).toBeUndefined();
    expect(out.find((p) => p.id === 'rh')).toBeDefined();
  });

  it('combines filters conjunctively', () => {
    const out = filterProblems(
      problems,
      { ...DEFAULT_FILTERS, millenniumOnly: true, fields: ['Geometry'] },
      noTracking,
    );
    expect(out.map((p) => p.id)).toEqual(['hodge']);
  });

  it('filters by tracking state', () => {
    const tracked: Record<string, TrackedProblem> = {
      rh: { problemId: 'rh', state: 'working', createdAt: 'a', updatedAt: 'a' },
      hodge: { problemId: 'hodge', state: 'parked', createdAt: 'a', updatedAt: 'a' },
    };
    expect(
      filterProblems(problems, { ...DEFAULT_FILTERS, tracking: 'tracked' }, tracked).map((p) => p.id).sort(),
    ).toEqual(['hodge', 'rh']);
    expect(
      filterProblems(problems, { ...DEFAULT_FILTERS, tracking: 'working' }, tracked).map((p) => p.id),
    ).toEqual(['rh']);
    expect(
      filterProblems(problems, { ...DEFAULT_FILTERS, tracking: 'untracked' }, tracked).map((p) => p.id),
    ).not.toContain('rh');
  });

  it('returns nothing rather than everything for a query that matches nothing', () => {
    const out = filterProblems(problems, { ...DEFAULT_FILTERS, query: 'zzzznotathing' }, noTracking);
    expect(out).toEqual([]);
  });
});

const FIELD_ORDER = ['Number theory', 'Geometry', 'Topology'];

describe('sortProblems', () => {
  it('leaves relevance order untouched', () => {
    expect(sortProblems(problems, 'relevance', FIELD_ORDER)).toBe(problems);
  });

  it('sorts alphabetically', () => {
    const titles = sortProblems(problems, 'title', FIELD_ORDER).map((p) => p.title);
    expect(titles).toEqual([...titles].sort((a, b) => a.localeCompare(b)));
  });

  it('groups by field in the dataset field order', () => {
    const fields = sortProblems(problems, 'field', FIELD_ORDER).map((p) => p.field);
    const firstIndex = new Map<string, number>();
    fields.forEach((f, i) => {
      if (!firstIndex.has(f)) firstIndex.set(f, i);
    });
    // Each field appears as one contiguous run.
    for (const [field, start] of firstIndex) {
      const count = fields.filter((f) => f === field).length;
      expect(fields.slice(start, start + count).every((f) => f === field), field).toBe(true);
    }
  });

  it('puts problems with no settled year last in both directions', () => {
    for (const dir of ['settled-new', 'settled-old'] as const) {
      const sorted = sortProblems(problems, dir, FIELD_ORDER);
      const dated = sorted.map((p) => p.solvedYear !== undefined);
      // Every dated problem precedes every undated one: once the run of `true`
      // ends it must never resume.
      const firstUndated = dated.indexOf(false);
      if (firstUndated !== -1) {
        expect(dated.slice(firstUndated).some(Boolean), dir).toBe(false);
      }
      expect(sorted.filter((p) => p.solvedYear !== undefined).length).toBe(
        problems.filter((p) => p.solvedYear !== undefined).length,
      );
    }
  });

  it('orders settled problems newest-first and oldest-first correctly', () => {
    const withYears = problems.filter((p) => p.solvedYear !== undefined);
    if (withYears.length < 2) return;
    const newest = sortProblems(problems, 'settled-new', FIELD_ORDER).filter((p) => p.solvedYear);
    const oldest = sortProblems(problems, 'settled-old', FIELD_ORDER).filter((p) => p.solvedYear);
    expect(newest[0]!.solvedYear).toBeGreaterThanOrEqual(newest.at(-1)!.solvedYear!);
    expect(oldest[0]!.solvedYear).toBeLessThanOrEqual(oldest.at(-1)!.solvedYear!);
  });

  it('does not mutate the input array', () => {
    const before = problems.map((p) => p.id);
    sortProblems(problems, 'title', FIELD_ORDER);
    expect(problems.map((p) => p.id)).toEqual(before);
  });
});

describe('URL state', () => {
  const fields = ['Number theory', 'Topology', 'Geometry'];

  it('omits every default so a pristine atlas has a clean URL', () => {
    const params = atlasStateToParams(DEFAULT_ATLAS_STATE);
    expect(Object.values(params).every((v) => v === undefined)).toBe(true);
  });

  it('round-trips a fully populated state', () => {
    const state = {
      query: 'riemann zeta',
      fields: ['Number theory', 'Topology'],
      status: 'open' as const,
      tracking: 'working' as const,
      millenniumOnly: true,
      topLevelOnly: true,
      sort: 'settled-new' as const,
    };
    const params = atlasStateToParams(state);
    const search = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][],
    );
    expect(atlasStateFromParams(search, fields)).toEqual(state);
  });

  it('survives a field name containing a comma or space', () => {
    const state = { ...DEFAULT_ATLAS_STATE, fields: ['Model theory and formal languages'] };
    const params = atlasStateToParams(state);
    const search = new URLSearchParams([['field', params.field!]]);
    expect(atlasStateFromParams(search, ['Model theory and formal languages']).fields).toEqual([
      'Model theory and formal languages',
    ]);
  });

  it('discards unknown fields rather than filtering to nothing', () => {
    const search = new URLSearchParams([['field', 'Number theory~Astrology']]);
    expect(atlasStateFromParams(search, fields).fields).toEqual(['Number theory']);
  });

  it('falls back to defaults for junk values', () => {
    const search = new URLSearchParams([
      ['status', 'banana'],
      ['track', 'banana'],
      ['sort', 'banana'],
    ]);
    const state = atlasStateFromParams(search, fields);
    expect(state.status).toBe('all');
    expect(state.tracking).toBe('any');
    expect(state.sort).toBe('relevance');
  });

  it('counts active choices for the filter badge', () => {
    expect(activeFilterCount(DEFAULT_ATLAS_STATE)).toBe(0);
    expect(
      activeFilterCount({ ...DEFAULT_ATLAS_STATE, fields: ['A', 'B'], millenniumOnly: true, sort: 'title' }),
    ).toBe(4);
    // The query box is not a filter chip, so it does not add to the badge.
    expect(activeFilterCount({ ...DEFAULT_ATLAS_STATE, query: 'riemann' })).toBe(0);
  });
});

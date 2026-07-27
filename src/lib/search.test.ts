import { describe, it, expect } from 'vitest';
import { filterProblems, score, normalise, DEFAULT_FILTERS } from './search';
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

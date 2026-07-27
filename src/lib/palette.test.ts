import { describe, it, expect } from 'vitest';
import { rankCommands, scoreCommand, initials, isSubsequence, buildCommands, type Command } from './palette';
import raw from '../data/problems.generated.json';
import type { Dataset } from '../types';

const { problems } = raw as unknown as Dataset;

const ALL = buildCommands(
  problems,
  [
    { id: 'view:atlas', kind: 'view', title: 'Atlas', href: '#/atlas', keywords: ['browse', 'search'] },
    { id: 'view:dashboard', kind: 'view', title: 'Progress', href: '#/dashboard' },
    { id: 'view:timeline', kind: 'view', title: 'Solved', href: '#/timeline' },
    { id: 'lab:zeta', kind: 'lab', title: 'Zeta on the critical line', href: '#/lab/zeta' },
    { id: 'lab:covering', kind: 'lab', title: 'Covering sets', href: '#/lab/covering' },
    { id: 'col:millennium', kind: 'collection', title: 'The Millennium Prize Problems', href: '#/collection/millennium' },
  ],
  [{ id: 'act:theme', title: 'Toggle theme', keywords: ['dark', 'light'], run: () => {} }],
);

/** The title of the top-ranked result for a query. */
const top = (q: string) => rankCommands(ALL, q, 5)[0]?.command.title;
const topN = (q: string, n = 5) => rankCommands(ALL, q, n).map((r) => r.command.title);

describe('initials', () => {
  it('drops stopwords for the significant form', () => {
    expect(initials('Riemann hypothesis').significant).toBe('r');
    expect(initials('Birch and Swinnerton-Dyer conjecture').significant).toBe('bsd');
  });

  it('keeps every word in the all form', () => {
    expect(initials('P versus NP problem').all).toBe('pvnpp');
    expect(initials('Birch and Swinnerton-Dyer conjecture').all).toBe('basdc');
  });

  it('treats an existing acronym as a whole, not as one letter', () => {
    // "NP" reduced to "n" makes "P versus NP problem" answer to "pn", and
    // nobody types that. It answers to "pnp" because NP contributes itself.
    expect(initials('P versus NP problem').significant).toBe('pnp');
    expect(initials('Unique games conjecture').significant).toBe('ug');
  });

  it('folds accents', () => {
    expect(initials('Poincaré conjecture').all).toBe('pc');
  });
});

describe('isSubsequence', () => {
  it('accepts abbreviations and single typos', () => {
    expect(isSubsequence('colatz', 'collatz conjecture')).toBe(true);
    expect(isSubsequence('rmn', 'riemann hypothesis')).toBe(true);
  });

  it('rejects the wrong order', () => {
    expect(isSubsequence('ztaler', 'collatz')).toBe(false);
  });

  it('accepts the empty needle', () => {
    expect(isSubsequence('', 'anything')).toBe(true);
  });
});

describe('the queries a mathematician actually types', () => {
  it('"rh" finds the Riemann hypothesis', () => {
    expect(top('rh')).toBe('Riemann hypothesis');
  });

  it('"pnp" finds P versus NP', () => {
    expect(top('pnp')).toBe('P versus NP problem');
  });

  it('"bsd" finds Birch and Swinnerton-Dyer', () => {
    expect(top('bsd')).toBe('Birch and Swinnerton-Dyer conjecture');
  });

  it('"collatz" finds the Collatz conjecture', () => {
    expect(top('collatz')).toBe('Collatz conjecture');
  });

  it('survives a typo', () => {
    expect(topN('colatz', 5)).toContain('Collatz conjecture');
  });

  it('finds a problem by who settled it', () => {
    expect(topN('perelman', 5)).toContain('Poincaré conjecture');
  });

  it('finds an accented title typed without accents', () => {
    expect(topN('poincare', 3)).toContain('Poincaré conjecture');
  });

  it('finds views and actions, not only problems', () => {
    expect(top('atlas')).toBe('Atlas');
    expect(topN('theme', 3)).toContain('Toggle theme');
    expect(topN('covering', 3)).toContain('Covering sets');
  });

  it('matches a view by its keyword', () => {
    expect(topN('browse', 3)).toContain('Atlas');
  });
});

describe('ranking discipline', () => {
  it('puts an exact title above a mere substring', () => {
    const ranked = rankCommands(ALL, 'Collatz conjecture', 5);
    expect(ranked[0]!.command.title).toBe('Collatz conjecture');
  });

  it('prefers a shorter title when the tier is the same', () => {
    // Both start with "riemann"; the shorter one is the more likely target.
    const ranked = rankCommands(ALL, 'riemann', 5).map((r) => r.command.title);
    const plain = ranked.indexOf('Riemann hypothesis');
    const longer = ranked.findIndex((t) => t.startsWith('Riemann') && t !== 'Riemann hypothesis');
    if (longer !== -1) expect(plain).toBeLessThan(longer);
  });

  it('never lets a weak tier outrank a strong one', () => {
    // A subsequence hit (tier 0) must never beat a prefix hit (tier 4).
    const prefix = scoreCommand({ id: 'a', kind: 'problem', title: 'Prime gap' }, 'prime');
    const subseq = scoreCommand({ id: 'b', kind: 'problem', title: 'P-recursive integer methods' }, 'prime');
    expect(prefix).toBeGreaterThan(subseq);
  });

  it('returns nothing for a query that matches nothing', () => {
    expect(rankCommands(ALL, 'zzzqqqxxnothing', 10)).toEqual([]);
  });

  it('opens on views and actions rather than 591 problems', () => {
    const empty = rankCommands(ALL, '', 8).map((r) => r.command.kind);
    expect(empty.filter((k) => k === 'problem').length).toBeLessThan(empty.length);
    expect(empty[0]).not.toBe('problem');
  });

  it('respects the limit', () => {
    expect(rankCommands(ALL, 'conjecture', 7)).toHaveLength(7);
  });
});

describe('the command set', () => {
  it('covers every problem', () => {
    expect(ALL.filter((c) => c.kind === 'problem')).toHaveLength(problems.length);
  });

  it('gives every command exactly one of href or run', () => {
    for (const c of ALL) {
      const hasHref = c.href !== undefined;
      const hasRun = c.run !== undefined;
      expect(hasHref !== hasRun, `${c.id} must have exactly one of href/run`).toBe(true);
    }
  });

  it('has unique ids', () => {
    const ids = ALL.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('is fast enough to rank on every keystroke', () => {
    const t0 = performance.now();
    for (const q of ['r', 'ri', 'rie', 'riem', 'rieman', 'riemann']) rankCommands(ALL, q, 30);
    // Six keystrokes over ~620 commands must stay well inside one frame.
    expect(performance.now() - t0).toBeLessThan(100);
  });
});

describe('scoreCommand', () => {
  const cmd: Command = { id: 'x', kind: 'problem', title: 'Riemann hypothesis', hint: 'Number theory' };

  it('gives a positive score for a match and zero otherwise', () => {
    expect(scoreCommand(cmd, 'riemann')).toBeGreaterThan(0);
    expect(scoreCommand(cmd, 'qqqq')).toBe(0);
  });

  it('matches on the hint as a last resort', () => {
    expect(scoreCommand(cmd, 'number theory')).toBeGreaterThan(0);
  });

  it('treats an empty query as a match, so the list shows on open', () => {
    expect(scoreCommand(cmd, '')).toBe(1);
  });
});

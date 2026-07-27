/**
 * Export correctness.
 *
 * This module had no test file at all, and it contained two defects that
 * corrupted the app's own suggested example. That is not a coincidence: the
 * output is a downloaded file nobody looks at until they try to compile it, so
 * nothing surfaces the damage.
 */

import { describe, it, expect } from 'vitest';
import { toBackup, parseBackup, toLaTeX, toMarkdown, ImportError } from './export';
import type { Problem, UserData } from '../types';

const problem = (over: Partial<Problem> = {}): Problem => ({
  id: 'riemann-hypothesis',
  title: 'Riemann hypothesis',
  wikipediaTitle: 'Riemann hypothesis',
  field: 'Number theory',
  fieldSource: 'wikipedia-section',
  status: 'open',
  depth: 1,
  ...over,
});

const userData = (over: Partial<UserData> = {}): UserData => ({
  schemaVersion: 1,
  tracked: {},
  journal: [],
  updatedAt: '2026-07-27T00:00:00.000Z',
  ...over,
});

const noteWith = (body: string): UserData =>
  userData({
    journal: [
      {
        id: 'n1',
        problemId: 'riemann-hypothesis',
        title: 'Working note',
        body,
        createdAt: '2026-07-27T00:00:00.000Z',
        updatedAt: '2026-07-27T00:00:00.000Z',
        revisions: [],
      },
    ],
  });

describe('LaTeX escaping', () => {
  it('does not eat the braces it inserts for a backslash', () => {
    // Regression: tex() replaced \ with \textbackslash{} and then escaped the
    // braces it had just inserted, so C:\Users became C:\textbackslash\{\}Users.
    const out = toLaTeX(noteWith('The file lives at C:\\Users\\chaus.'), [problem()]);
    expect(out).toContain('C:\\textbackslash{}Users\\textbackslash{}chaus');
    expect(out).not.toContain('\\textbackslash\\{\\}');
  });

  it('escapes the LaTeX special characters in prose', () => {
    const out = toLaTeX(noteWith('50% of a_b & c #1 {x}'), [problem()]);
    expect(out).toContain('50\\% of a\\_b \\& c \\#1 \\{x\\}');
  });

  it('escapes tilde and caret without escaping their replacements', () => {
    const out = toLaTeX(noteWith('roughly ~5 and x^2'), [problem()]);
    expect(out).toContain('\\textasciitilde{}5');
    expect(out).toContain('x\\textasciicircum{}2');
    expect(out).not.toContain('\\textasciitilde\\{\\}');
    expect(out).not.toContain('\\textasciicircum\\{\\}');
  });
});

describe('maths survives export', () => {
  it("exports the app's own placeholder unchanged", () => {
    // The exact string src/views/ProblemView.tsx offers as the note placeholder.
    // It used to export as $$\textbackslash\{\}zeta(s) = ...$$ and would not compile.
    const body = 'Suppose $\\zeta(s) = 0$ with $0 < \\Re(s) < 1$.\n\n$$\\zeta(s) = \\prod_p \\frac{1}{1 - p^{-s}}$$';
    const out = toLaTeX(noteWith(body), [problem()]);

    expect(out).toContain('$\\zeta(s) = 0$');
    expect(out).toContain('$$\\zeta(s) = \\prod_p \\frac{1}{1 - p^{-s}}$$');
    expect(out).not.toContain('textbackslash');
  });

  it('leaves display maths alone even with prose in the same paragraph', () => {
    const out = toLaTeX(noteWith('Therefore $$a^2 + b^2 = c^2$$ as required.'), [problem()]);
    expect(out).toContain('$$a^2 + b^2 = c^2$$');
    expect(out).toContain('as required');
  });

  it('handles several maths spans of both kinds in one note', () => {
    const body = 'First $x$, then $$y^2$$, then $z_1$, then $$w_{ij}$$.';
    const out = toLaTeX(noteWith(body), [problem()]);
    for (const span of ['$x$', '$$y^2$$', '$z_1$', '$$w_{ij}$$']) {
      expect(out, span).toContain(span);
    }
  });

  it('still escapes prose sitting between maths spans', () => {
    const out = toLaTeX(noteWith('Given $x$, 50% of cases use_this.'), [problem()]);
    expect(out).toContain('$x$');
    expect(out).toContain('50\\%');
    expect(out).toContain('use\\_this');
  });

  it('does not corrupt an unmatched dollar sign', () => {
    // A stray $ is a user typo, not a reason to mangle the rest of the note.
    const out = toLaTeX(noteWith('costs $5 and rises'), [problem()]);
    expect(out).toContain('and rises');
  });
});

describe('document structure', () => {
  it('produces a compilable preamble and body', () => {
    const out = toLaTeX(noteWith('note'), [problem()]);
    expect(out).toContain('\\documentclass');
    expect(out).toContain('\\begin{document}');
    expect(out).toContain('\\end{document}');
    expect(out.indexOf('\\begin{document}')).toBeLessThan(out.indexOf('\\end{document}'));
  });

  it('credits the source and the licence', () => {
    const out = toLaTeX(noteWith('note'), [problem()]);
    expect(out).toContain('CC BY-SA');
  });

  it('says so plainly when there is nothing to export', () => {
    const out = toLaTeX(userData(), []);
    expect(out).toContain('No problems tracked');
    expect(out).toContain('\\end{document}');
  });

  it('escapes a tracked problem title rather than injecting it raw', () => {
    const data = userData({
      tracked: {
        x: { problemId: 'x', state: 'working', createdAt: 'a', updatedAt: 'a' },
      },
    });
    const out = toLaTeX(data, [problem({ id: 'x', title: 'A_problem & 100% {hard}' })]);
    expect(out).toContain('A\\_problem \\& 100\\% \\{hard\\}');
  });
});

describe('Markdown export', () => {
  it('passes maths through untouched', () => {
    const out = toMarkdown(noteWith('Let $\\zeta(s) = 0$.'), [problem()]);
    expect(out).toContain('$\\zeta(s) = 0$');
  });

  it('lists tracked problems in a table', () => {
    const data = userData({
      tracked: { 'riemann-hypothesis': { problemId: 'riemann-hypothesis', state: 'working', createdAt: 'a', updatedAt: 'a' } },
    });
    const out = toMarkdown(data, [problem()]);
    expect(out).toContain('| Riemann hypothesis |');
    expect(out).toContain('working');
  });
});

describe('backup round trip', () => {
  it('re-imports what it exported', () => {
    const data = noteWith('Let $x$ be $$y$$.');
    const restored = parseBackup(JSON.stringify(toBackup(data)));
    expect(restored).toEqual(data);
  });

  it('rejects a file from somewhere else rather than importing garbage', () => {
    expect(() => parseBackup('{"format":"something-else","version":1,"data":{}}')).toThrow(ImportError);
  });

  it('rejects invalid JSON with a readable message', () => {
    expect(() => parseBackup('not json at all')).toThrow(/not valid JSON/);
  });

  it('rejects an unsupported version rather than guessing the shape', () => {
    expect(() =>
      parseBackup('{"format":"open-problems-atlas-backup","version":99,"data":{}}'),
    ).toThrow(/version 99/);
  });

  it('rejects a backup with no data section', () => {
    expect(() => parseBackup('{"format":"open-problems-atlas-backup","version":1}')).toThrow(
      ImportError,
    );
  });
});

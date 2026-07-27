import { describe, it, expect } from 'vitest';
import {
  insertSnippet,
  nextPlaceholder,
  wrapSelection,
  autoPair,
  deleteEmptyPair,
  commandPrefix,
  completeCommand,
  normalisePastedLatex,
  filterMacros,
  MACROS,
  MACRO_GROUPS,
  type EditState,
} from './insert';

const at = (text: string, start: number, end = start): EditState => ({
  text,
  selectionStart: start,
  selectionEnd: end,
});

/** Render an edit state as text with | for the caret and [..] for a selection. */
const show = (s: EditState) =>
  s.selectionStart === s.selectionEnd
    ? `${s.text.slice(0, s.selectionStart)}|${s.text.slice(s.selectionStart)}`
    : `${s.text.slice(0, s.selectionStart)}[${s.text.slice(s.selectionStart, s.selectionEnd)}]${s.text.slice(s.selectionEnd)}`;

describe('insertSnippet', () => {
  it('places the caret in the first slot', () => {
    expect(show(insertSnippet(at('', 0), '\\frac{}{}'))).toBe('\\frac{|}{}');
  });

  it('inserts at the caret, keeping surrounding text', () => {
    expect(show(insertSnippet(at('ab', 1), '\\pi'))).toBe('a\\pi|b');
  });

  it('puts the caret at the end when the snippet has no slot', () => {
    expect(show(insertSnippet(at('', 0), '\\infty'))).toBe('\\infty|');
  });

  it('moves a selection into the first slot and the caret into the next', () => {
    // Select x+y, hit fraction: that should become the numerator, with the
    // caret waiting in the denominator.
    expect(show(insertSnippet(at('x+y', 0, 3), '\\frac{}{}'))).toBe('\\frac{x+y}{|}');
  });

  it('puts the caret after the wrapped selection when there is only one slot', () => {
    expect(show(insertSnippet(at('n', 0, 1), '\\sqrt{}'))).toBe('\\sqrt{n}|');
  });

  it('replaces a selection it cannot wrap', () => {
    expect(show(insertSnippet(at('old', 0, 3), '\\pi'))).toBe('\\pi|');
  });
});

describe('nextPlaceholder', () => {
  it('finds the next empty slot after the caret', () => {
    expect(nextPlaceholder('\\frac{a}{}', 7)).toBe(9);
  });

  it('wraps to the first slot rather than dead-ending', () => {
    const text = '\\frac{}{b}';
    // Caret past the last slot: Tab should cycle back to the first.
    expect(nextPlaceholder(text, 10)).toBe(6);
  });

  it('returns null when nothing is left to fill', () => {
    expect(nextPlaceholder('\\frac{a}{b}', 0)).toBeNull();
    expect(nextPlaceholder('plain text', 0)).toBeNull();
  });

  it('works on LaTeX the user pasted rather than inserted', () => {
    // The reason stops are found by scanning rather than remembered: pasted
    // text was never inserted, so there are no recorded offsets to remember.
    expect(nextPlaceholder('\\sum_{}^{n} x_i', 0)).toBe(6);
  });
});

describe('wrapSelection', () => {
  it('wraps and keeps the selection', () => {
    expect(show(wrapSelection(at('abc', 0, 3), '$', '$'))).toBe('$[abc]$');
  });

  it('inserts an empty pair with the caret between', () => {
    expect(show(wrapSelection(at('', 0), '$', '$'))).toBe('$|$');
  });
});

describe('autoPair', () => {
  it('inserts the closing half and sits between', () => {
    expect(show(autoPair(at('', 0), '{')!)).toBe('{|}');
    expect(show(autoPair(at('', 0), '$')!)).toBe('$|$');
  });

  it('wraps a selection instead of destroying it', () => {
    expect(show(autoPair(at('abc', 0, 3), '(')!)).toBe('([abc])');
  });

  it('steps over a closer that is already there', () => {
    // Typing ) at the end of () must not give ()).
    expect(show(autoPair(at('()', 1), ')')!)).toBe('()|');
  });

  it('falls through for ordinary characters', () => {
    expect(autoPair(at('', 0), 'a')).toBeNull();
  });

  it('does not step over a closer when there is a selection', () => {
    // Selection is "ab" in "(ab)" and the user types ")". Stepping over would
    // silently discard the selection; the correct behaviour is to fall through
    // and let the browser replace it, which is what every editor does.
    expect(autoPair(at('(ab)', 1, 3), ')')).toBeNull();
  });

  it('only steps over when the very next character is the same closer', () => {
    expect(autoPair(at('()', 1), ')')).not.toBeNull();
    expect(autoPair(at('(x)', 1), ')')).toBeNull();
  });
});

describe('deleteEmptyPair', () => {
  it('removes both halves of an empty pair', () => {
    expect(show(deleteEmptyPair(at('a{}b', 2))!)).toBe('a|b');
  });

  it('leaves a non-empty pair alone', () => {
    expect(deleteEmptyPair(at('a{x}b', 2))).toBeNull();
  });

  it('leaves mismatched neighbours alone', () => {
    expect(deleteEmptyPair(at('a{)b', 2))).toBeNull();
  });

  it('does nothing at the start or with a selection', () => {
    expect(deleteEmptyPair(at('{}', 0))).toBeNull();
    expect(deleteEmptyPair(at('a{}b', 1, 3))).toBeNull();
  });
});

describe('commandPrefix', () => {
  it('detects a partial command at the caret', () => {
    expect(commandPrefix('x = \\fra', 8)).toEqual({ word: '\\fra', start: 4 });
  });

  it('detects a bare backslash', () => {
    expect(commandPrefix('\\', 1)).toEqual({ word: '\\', start: 0 });
  });

  it('returns null outside a command, so the menu stays shut', () => {
    expect(commandPrefix('plain', 5)).toBeNull();
    expect(commandPrefix('\\frac{x}', 8)).toBeNull();
    expect(commandPrefix('', 0)).toBeNull();
  });
});

describe('completeCommand', () => {
  it('replaces the partial command with the snippet', () => {
    const state = at('x = \\fra', 8);
    const prefix = commandPrefix(state.text, state.selectionStart)!;
    expect(show(completeCommand(state, prefix.start, '\\frac{}{}'))).toBe('x = \\frac{|}{}');
  });
});

describe('normalisePastedLatex', () => {
  it('converts equation environments to display maths', () => {
    expect(normalisePastedLatex('\\begin{equation}a=b\\end{equation}')).toBe('$$a=b$$');
  });

  it('converts starred environments too', () => {
    expect(normalisePastedLatex('\\begin{align*}a=b\\end{align*}')).toBe('$$a=b$$');
  });

  it('converts bracket delimiters', () => {
    expect(normalisePastedLatex('\\[a=b\\]')).toBe('$$a=b$$');
    expect(normalisePastedLatex('\\(a\\)')).toBe('$a$');
  });

  it('strips labels, which have nothing to point at here', () => {
    expect(normalisePastedLatex('\\[a=b\\label{eq:1}\\]')).toBe('$$a=b$$');
  });

  it('leaves already-correct maths untouched', () => {
    expect(normalisePastedLatex('Let $x$ be $$y$$.')).toBe('Let $x$ be $$y$$.');
  });

  it('leaves prose untouched', () => {
    expect(normalisePastedLatex('just some words')).toBe('just some words');
  });
});

describe('the macro set', () => {
  it('has a unique label per macro', () => {
    const labels = MACROS.map((m) => m.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('only uses declared groups', () => {
    for (const m of MACROS) expect(MACRO_GROUPS, m.label).toContain(m.group);
  });

  it('covers every declared group', () => {
    for (const g of MACRO_GROUPS) {
      expect(MACROS.some((m) => m.group === g), g).toBe(true);
    }
  });

  it('leads with the commands this corpus actually uses', () => {
    // Ordered by measured frequency across the dataset's own maths spans, so a
    // reader of these problems finds what they need first rather than meeting
    // an alphabetical list where \aleph outranks \sum.
    const greek = MACROS.filter((m) => m.group === 'Greek').map((m) => m.label);
    expect(greek[0]).toBe('varepsilon');
    expect(greek.indexOf('pi')).toBeLessThan(greek.indexOf('omega'));
  });
});

describe('filterMacros', () => {
  it('matches on the command name', () => {
    expect(filterMacros('\\fra')[0]!.snippet).toBe('\\frac{}{}');
    expect(filterMacros('frac')[0]!.snippet).toBe('\\frac{}{}');
  });

  it('matches on the human label', () => {
    expect(filterMacros('fraction')[0]!.snippet).toBe('\\frac{}{}');
  });

  it('matches on keywords, so you can find it by what you call it', () => {
    expect(filterMacros('modulo')[0]!.snippet).toBe('\\pmod{}');
    expect(filterMacros('<=')[0]!.snippet).toBe('\\leq');
    expect(filterMacros('complexity')[0]!.label).toBe('big O');
  });

  it('prefers an exact command prefix over a keyword match', () => {
    expect(filterMacros('sum')[0]!.snippet).toBe('\\sum_{}^{}');
  });

  it('returns nothing for a query that matches nothing', () => {
    expect(filterMacros('zzzznope')).toEqual([]);
  });

  it('returns the head of the list for an empty query', () => {
    expect(filterMacros('').length).toBeGreaterThan(0);
    expect(filterMacros('\\').length).toBeGreaterThan(0);
  });

  it('respects the limit', () => {
    expect(filterMacros('', 5)).toHaveLength(5);
  });
});

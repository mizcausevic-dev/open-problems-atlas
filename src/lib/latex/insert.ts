/**
 * Text-editing primitives for the note editor.
 *
 * Pure functions over `{ text, selectionStart, selectionEnd }`. Nothing here
 * touches the DOM, which is what makes the fiddly parts — where the caret lands
 * after inserting \frac{}{}, what Tab does next, what happens when you type over
 * a selection — testable rather than something you verify by hand and hope.
 *
 * Placeholder navigation uses empty brace pairs `{}` as the stops, found by
 * scanning the live text each time rather than by remembering offsets recorded
 * at insertion. Offsets go stale the moment the user types; the text does not
 * lie. It also means Tab works on LaTeX pasted from a paper, which no
 * remembered-offset scheme can do.
 */

export interface EditState {
  text: string;
  selectionStart: number;
  selectionEnd: number;
}

/** A command that can be inserted. `snippet` uses `{}` to mark argument slots. */
export interface Macro {
  /** What the user sees. */
  label: string;
  /** Inserted verbatim. */
  snippet: string;
  /** Grouping for the palette. */
  group: MacroGroup;
  /** Rendered as KaTeX in the palette when set; falls back to `snippet`. */
  preview?: string;
  /** Extra words that should match this macro in the filter. */
  keywords?: string[];
}

export type MacroGroup =
  | 'Structure'
  | 'Greek'
  | 'Relations'
  | 'Operators'
  | 'Number theory'
  | 'Set theory'
  | 'Logic'
  | 'Arrows'
  | 'Delimiters';

/**
 * Insert a snippet, replacing the selection.
 *
 * If text is selected and the snippet has at least one `{}` slot, the selection
 * is moved into the first slot: selecting `x+y` and hitting \frac gives
 * `\frac{x+y}{}` with the caret in the second slot, which is what someone
 * building a fraction actually wants. Otherwise the caret goes to the first
 * empty slot, or to the end when there is none.
 */
export function insertSnippet(state: EditState, snippet: string): EditState {
  const { text, selectionStart, selectionEnd } = state;
  const selected = text.slice(selectionStart, selectionEnd);
  const before = text.slice(0, selectionStart);
  const after = text.slice(selectionEnd);

  let body = snippet;
  let caretWithinBody: number | null = null;

  const firstSlot = snippet.indexOf('{}');

  if (selected && firstSlot !== -1) {
    // Selection goes into the first slot; caret lands in the next one.
    body = `${snippet.slice(0, firstSlot + 1)}${selected}${snippet.slice(firstSlot + 1)}`;
    const nextSlot = body.indexOf('{}', firstSlot + 1 + selected.length);
    caretWithinBody = nextSlot !== -1 ? nextSlot + 1 : body.length;
  } else if (firstSlot !== -1) {
    caretWithinBody = firstSlot + 1;
  } else {
    caretWithinBody = body.length;
  }

  const caret = before.length + caretWithinBody;
  return { text: `${before}${body}${after}`, selectionStart: caret, selectionEnd: caret };
}

/**
 * Find the next empty `{}` slot at or after `from`, wrapping once.
 *
 * Returns the caret position inside the braces, or null when the text has no
 * empty slot at all, in which case Tab should do its normal thing.
 */
export function nextPlaceholder(text: string, from: number): number | null {
  const ahead = text.indexOf('{}', from);
  if (ahead !== -1) return ahead + 1;
  // Wrap to the start so Tab cycles rather than dead-ending at the last slot.
  const wrapped = text.indexOf('{}');
  return wrapped !== -1 ? wrapped + 1 : null;
}

/** Wrap the selection, or insert the pair with the caret between them. */
export function wrapSelection(state: EditState, before: string, after: string): EditState {
  const { text, selectionStart, selectionEnd } = state;
  const selected = text.slice(selectionStart, selectionEnd);
  const head = text.slice(0, selectionStart);
  const tail = text.slice(selectionEnd);

  return {
    text: `${head}${before}${selected}${after}${tail}`,
    selectionStart: selectionStart + before.length,
    selectionEnd: selectionStart + before.length + selected.length,
  };
}

/** Pairs that auto-close. `$` is included because it is the maths delimiter here. */
const PAIRS: Record<string, string> = { '{': '}', '(': ')', '[': ']', $: '$' };

/**
 * Auto-pairing that does not fight the user.
 *
 * Three behaviours people expect and notice the absence of:
 *   - typing over a selection wraps it instead of replacing it
 *   - typing a closing character that is already there steps over it
 *   - otherwise, insert the pair with the caret between
 *
 * Returns null when the keystroke should be handled normally.
 */
export function autoPair(state: EditState, key: string): EditState | null {
  const { text, selectionStart, selectionEnd } = state;

  // Step over a closer the editor already inserted, rather than doubling it.
  const closers = new Set(Object.values(PAIRS));
  if (closers.has(key) && selectionStart === selectionEnd && text[selectionStart] === key) {
    return { text, selectionStart: selectionStart + 1, selectionEnd: selectionStart + 1 };
  }

  const closing = PAIRS[key];
  if (!closing) return null;

  if (selectionStart !== selectionEnd) return wrapSelection(state, key, closing);

  return {
    text: `${text.slice(0, selectionStart)}${key}${closing}${text.slice(selectionEnd)}`,
    selectionStart: selectionStart + 1,
    selectionEnd: selectionStart + 1,
  };
}

/** Backspace inside an empty pair deletes both halves. Returns null to fall through. */
export function deleteEmptyPair(state: EditState): EditState | null {
  const { text, selectionStart, selectionEnd } = state;
  if (selectionStart !== selectionEnd || selectionStart === 0) return null;

  const opener = text[selectionStart - 1];
  const closer = text[selectionStart];
  if (!opener || !closer) return null;
  if (PAIRS[opener] !== closer) return null;

  return {
    text: text.slice(0, selectionStart - 1) + text.slice(selectionStart + 1),
    selectionStart: selectionStart - 1,
    selectionEnd: selectionStart - 1,
  };
}

/**
 * The partial `\command` immediately before the caret, for autocomplete.
 * Returns null when the caret is not in a command, so the menu stays closed.
 */
export function commandPrefix(text: string, caret: number): { word: string; start: number } | null {
  let i = caret;
  while (i > 0 && /[A-Za-z]/.test(text[i - 1]!)) i--;
  if (i === 0 || text[i - 1] !== '\\') return null;
  return { word: text.slice(i - 1, caret), start: i - 1 };
}

/** Replace a partial command with a macro's snippet. */
export function completeCommand(state: EditState, start: number, snippet: string): EditState {
  const cleared: EditState = {
    text: state.text.slice(0, start) + state.text.slice(state.selectionEnd),
    selectionStart: start,
    selectionEnd: start,
  };
  return insertSnippet(cleared, snippet);
}

/**
 * Normalise LaTeX pasted from a paper.
 *
 * Papers use `\begin{equation}`, `\[ ... \]` and `$$...$$` more or less
 * interchangeably; this app renders `$...$` and `$$...$$`. Converting on paste
 * saves the user hand-editing every block they bring in. Deliberately
 * conservative: it only touches delimiters it recognises, and it strips
 * `\label{}` because a label with no numbering to point at is noise here.
 */
export function normalisePastedLatex(pasted: string): string {
  return pasted
    .replace(/\\begin\{(equation|displaymath|align)\*?\}/g, '$$$$')
    .replace(/\\end\{(equation|displaymath|align)\*?\}/g, '$$$$')
    .replace(/\\\[/g, '$$$$')
    .replace(/\\\]/g, '$$$$')
    .replace(/\\\(/g, '$')
    .replace(/\\\)/g, '$')
    .replace(/\\label\{[^}]*\}/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

// ---------------------------------------------------------------------------
// The macro set
//
// The Greek and relation entries are ordered by measured frequency in this
// dataset's own 325 maths spans, so the commands a reader of these problems
// actually needs are the ones nearest the front, rather than an alphabetical
// list where \aleph outranks \sum.
// ---------------------------------------------------------------------------

export const MACROS: Macro[] = [
  // Structure
  { label: 'Fraction', snippet: '\\frac{}{}', group: 'Structure', preview: '\\frac{a}{b}', keywords: ['over', 'divide'] },
  { label: 'Sum', snippet: '\\sum_{}^{}', group: 'Structure', preview: '\\sum_{n=1}^{\\infty}', keywords: ['series', 'sigma'] },
  { label: 'Product', snippet: '\\prod_{}^{}', group: 'Structure', preview: '\\prod_{p}', keywords: ['pi'] },
  { label: 'Integral', snippet: '\\int_{}^{}', group: 'Structure', preview: '\\int_0^1', keywords: ['integrate'] },
  { label: 'Limit', snippet: '\\lim_{}', group: 'Structure', preview: '\\lim_{n \\to \\infty}' },
  { label: 'Square root', snippet: '\\sqrt{}', group: 'Structure', preview: '\\sqrt{x}', keywords: ['radical'] },
  { label: 'nth root', snippet: '\\sqrt[]{}', group: 'Structure', preview: '\\sqrt[3]{x}' },
  { label: 'Subscript', snippet: '_{}', group: 'Structure', preview: 'x_{i}', keywords: ['index'] },
  { label: 'Superscript', snippet: '^{}', group: 'Structure', preview: 'x^{2}', keywords: ['power', 'exponent'] },
  { label: 'Cases', snippet: '\\begin{cases}  \\\\  \\end{cases}', group: 'Structure', preview: '\\begin{cases} a \\\\ b \\end{cases}', keywords: ['piecewise'] },
  { label: 'Aligned', snippet: '\\begin{aligned}  \\end{aligned}', group: 'Structure', preview: '\\begin{aligned} a &= b \\end{aligned}', keywords: ['multi-line'] },
  { label: 'Matrix', snippet: '\\begin{pmatrix}  \\\\  \\end{pmatrix}', group: 'Structure', preview: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}' },

  // Greek, most-used in this corpus first
  { label: 'varepsilon', snippet: '\\varepsilon', group: 'Greek', preview: '\\varepsilon' },
  { label: 'pi', snippet: '\\pi', group: 'Greek', preview: '\\pi' },
  { label: 'lambda', snippet: '\\lambda', group: 'Greek', preview: '\\lambda' },
  { label: 'Delta', snippet: '\\Delta', group: 'Greek', preview: '\\Delta' },
  { label: 'zeta', snippet: '\\zeta', group: 'Greek', preview: '\\zeta' },
  { label: 'alpha', snippet: '\\alpha', group: 'Greek', preview: '\\alpha' },
  { label: 'beta', snippet: '\\beta', group: 'Greek', preview: '\\beta' },
  { label: 'gamma', snippet: '\\gamma', group: 'Greek', preview: '\\gamma' },
  { label: 'sigma', snippet: '\\sigma', group: 'Greek', preview: '\\sigma' },
  { label: 'phi', snippet: '\\phi', group: 'Greek', preview: '\\phi' },
  { label: 'theta', snippet: '\\theta', group: 'Greek', preview: '\\theta' },
  { label: 'mu', snippet: '\\mu', group: 'Greek', preview: '\\mu' },
  { label: 'rho', snippet: '\\rho', group: 'Greek', preview: '\\rho' },
  { label: 'omega', snippet: '\\omega', group: 'Greek', preview: '\\omega' },
  { label: 'Omega', snippet: '\\Omega', group: 'Greek', preview: '\\Omega' },

  // Relations
  { label: 'at most', snippet: '\\leq', group: 'Relations', preview: '\\leq', keywords: ['<=', 'less'] },
  { label: 'at least', snippet: '\\geq', group: 'Relations', preview: '\\geq', keywords: ['>=', 'greater'] },
  { label: 'not equal', snippet: '\\neq', group: 'Relations', preview: '\\neq', keywords: ['!='] },
  { label: 'approx', snippet: '\\approx', group: 'Relations', preview: '\\approx' },
  { label: 'equivalent', snippet: '\\equiv', group: 'Relations', preview: '\\equiv', keywords: ['congruent'] },
  { label: 'similar', snippet: '\\sim', group: 'Relations', preview: '\\sim', keywords: ['asymptotic'] },
  { label: 'much less', snippet: '\\ll', group: 'Relations', preview: '\\ll' },
  { label: 'much greater', snippet: '\\gg', group: 'Relations', preview: '\\gg' },
  { label: 'divides', snippet: '\\mid', group: 'Relations', preview: 'a \\mid b' },
  { label: 'does not divide', snippet: '\\nmid', group: 'Relations', preview: 'a \\nmid b' },

  // Operators
  { label: 'times', snippet: '\\times', group: 'Operators', preview: '\\times' },
  { label: 'dot', snippet: '\\cdot', group: 'Operators', preview: '\\cdot' },
  { label: 'plus or minus', snippet: '\\pm', group: 'Operators', preview: '\\pm' },
  { label: 'infinity', snippet: '\\infty', group: 'Operators', preview: '\\infty' },
  { label: 'partial', snippet: '\\partial', group: 'Operators', preview: '\\partial' },
  { label: 'nabla', snippet: '\\nabla', group: 'Operators', preview: '\\nabla' },
  { label: 'ellipsis', snippet: '\\ldots', group: 'Operators', preview: '\\ldots', keywords: ['dots'] },
  { label: 'centred dots', snippet: '\\cdots', group: 'Operators', preview: '\\cdots' },

  // Number theory
  { label: 'mod', snippet: '\\pmod{}', group: 'Number theory', preview: 'a \\pmod{n}', keywords: ['modulo', 'congruence'] },
  { label: 'blackboard bold', snippet: '\\mathbb{}', group: 'Number theory', preview: '\\mathbb{Z}', keywords: ['Z', 'R', 'N', 'Q', 'C'] },
  { label: 'floor', snippet: '\\lfloor  \\rfloor', group: 'Number theory', preview: '\\lfloor x \\rfloor' },
  { label: 'ceiling', snippet: '\\lceil  \\rceil', group: 'Number theory', preview: '\\lceil x \\rceil' },
  { label: 'gcd', snippet: '\\gcd(, )', group: 'Number theory', preview: '\\gcd(a, b)' },
  { label: 'big O', snippet: 'O\\!\\left(\\right)', group: 'Number theory', preview: 'O(n \\log n)', keywords: ['landau', 'complexity'] },

  // Set theory
  { label: 'element of', snippet: '\\in', group: 'Set theory', preview: '\\in' },
  { label: 'not element of', snippet: '\\notin', group: 'Set theory', preview: '\\notin' },
  { label: 'subset', snippet: '\\subseteq', group: 'Set theory', preview: '\\subseteq' },
  { label: 'union', snippet: '\\cup', group: 'Set theory', preview: '\\cup' },
  { label: 'intersection', snippet: '\\cap', group: 'Set theory', preview: '\\cap' },
  { label: 'empty set', snippet: '\\emptyset', group: 'Set theory', preview: '\\emptyset' },
  { label: 'aleph', snippet: '\\aleph', group: 'Set theory', preview: '\\aleph_0', keywords: ['cardinal'] },
  { label: 'set builder', snippet: '\\{ : \\}', group: 'Set theory', preview: '\\{x : x > 0\\}' },

  // Logic
  { label: 'for all', snippet: '\\forall', group: 'Logic', preview: '\\forall' },
  { label: 'there exists', snippet: '\\exists', group: 'Logic', preview: '\\exists' },
  { label: 'not', snippet: '\\neg', group: 'Logic', preview: '\\neg' },
  { label: 'and', snippet: '\\land', group: 'Logic', preview: '\\land' },
  { label: 'or', snippet: '\\lor', group: 'Logic', preview: '\\lor' },
  { label: 'therefore', snippet: '\\therefore', group: 'Logic', preview: '\\therefore' },

  // Arrows
  { label: 'implies', snippet: '\\implies', group: 'Arrows', preview: '\\implies' },
  { label: 'if and only if', snippet: '\\iff', group: 'Arrows', preview: '\\iff', keywords: ['equivalent'] },
  { label: 'to', snippet: '\\to', group: 'Arrows', preview: '\\to', keywords: ['maps', 'tends'] },
  { label: 'maps to', snippet: '\\mapsto', group: 'Arrows', preview: '\\mapsto' },

  // Delimiters
  { label: 'auto parens', snippet: '\\left(\\right)', group: 'Delimiters', preview: '\\left( x \\right)' },
  { label: 'auto brackets', snippet: '\\left[\\right]', group: 'Delimiters', preview: '\\left[ x \\right]' },
  { label: 'absolute value', snippet: '\\left|\\right|', group: 'Delimiters', preview: '\\left| x \\right|' },
  { label: 'norm', snippet: '\\left\\Vert \\right\\Vert', group: 'Delimiters', preview: '\\left\\Vert x \\right\\Vert' },
];

export const MACRO_GROUPS: MacroGroup[] = [
  'Structure',
  'Greek',
  'Relations',
  'Operators',
  'Number theory',
  'Set theory',
  'Logic',
  'Arrows',
  'Delimiters',
];

/** Filter macros for the palette or the `\` autocomplete. */
export function filterMacros(query: string, limit = 40): Macro[] {
  const q = query.replace(/^\\/, '').toLowerCase().trim();
  if (!q) return MACROS.slice(0, limit);

  const scored = MACROS.map((m) => {
    const command = m.snippet.replace(/^\\/, '').toLowerCase();
    const label = m.label.toLowerCase();
    let score = 0;

    if (command.startsWith(q)) score = 100 - command.length;
    else if (label.startsWith(q)) score = 80 - label.length;
    else if (command.includes(q)) score = 50;
    else if (label.includes(q)) score = 40;
    else if (m.keywords?.some((k) => k.toLowerCase().startsWith(q))) score = 30;
    else if (m.keywords?.some((k) => k.toLowerCase().includes(q))) score = 20;

    return { m, score };
  }).filter((s) => s.score > 0);

  scored.sort((a, b) => b.score - a.score || a.m.label.localeCompare(b.m.label));
  return scored.slice(0, limit).map((s) => s.m);
}

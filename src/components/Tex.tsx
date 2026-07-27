/**
 * KaTeX rendering.
 *
 * Three things this does that the naive version does not:
 *
 * 1. When KaTeX cannot parse an expression, the raw source is shown in a
 *    marked span with a title explaining why. Wikipedia's maths is not
 *    guaranteed to be KaTeX-compatible (it targets MathML/texvc), so failures
 *    are expected. Silently rendering nothing would delete content.
 *
 * 2. `RichText` splits prose on $...$ and renders only those spans as maths.
 *    The dataset stores descriptions with maths in $ delimiters, and a plain
 *    text node would show the dollar signs literally.
 *
 * 3. Output is `htmlAndMathml`, which is the accessibility fix and is worth
 *    spelling out because the failure was invisible in every browser.
 *
 *    KaTeX emits two sibling trees: `katex-mathml`, holding a real <math>
 *    element, and `katex-html`, a stack of absolutely positioned glyph spans.
 *    KaTeX marks `katex-html` aria-hidden="true" deliberately — read aloud it is
 *    noise. With `output: 'html'` the <math> element is never generated, so the
 *    ONLY thing emitted is the aria-hidden tree.
 *
 *    The consequence: every formula in the app had an accessible name of "".
 *    Sighted users saw correct mathematics; a screen reader was handed a page
 *    where the mathematics simply was not present. On a site whose entire
 *    subject is mathematics, that is missing content, not a rough edge.
 *
 *    The cost is roughly a doubling of DOM nodes per expression. `mathml={false}`
 *    exists as an escape hatch for a surface that proves too heavy, but nothing
 *    passes it today: the dense atlas list is exactly where a reader most needs
 *    the titles, so silencing it to save nodes would trade the wrong thing.
 */

import { useMemo } from 'react';
import katex from 'katex';

interface TexProps {
  math: string;
  block?: boolean;
  className?: string;
  /** Escape hatch. See the note above before setting this to false. */
  mathml?: boolean;
}

export function Tex({ math, block = false, className = '', mathml = true }: TexProps) {
  const result = useMemo(() => {
    try {
      return {
        ok: true as const,
        html: katex.renderToString(math, {
          displayMode: block,
          throwOnError: true,
          strict: false,
          trust: false,
          output: mathml ? 'htmlAndMathml' : 'html',
        }),
      };
    } catch (err) {
      return { ok: false as const, message: err instanceof Error ? err.message : 'Unknown error' };
    }
  }, [math, block, mathml]);

  if (!result.ok) {
    return (
      <code
        className={`rounded-sm bg-amber-500/15 px-1 text-[0.9em] text-amber-700 dark:text-amber-300 ${className}`}
        title={`This expression could not be typeset: ${result.message}`}
      >
        {math}
      </code>
    );
  }

  const Wrapper = block ? 'div' : 'span';
  return (
    <Wrapper
      className={`${block ? 'my-3 overflow-x-auto' : ''} ${className}`}
      // KaTeX output is generated from the math string by KaTeX itself with
      // trust:false, so no user-authored HTML or URLs can reach the DOM here.
      dangerouslySetInnerHTML={{ __html: result.html }}
    />
  );
}

interface RichTextProps {
  children: string;
  className?: string;
}

/** Renders prose in which maths appears between single $ delimiters. */
export function RichText({ children, className = '' }: RichTextProps) {
  const parts = useMemo(() => children.split(/(\$[^$]+\$)/g), [children]);

  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (part.length > 2 && part.startsWith('$') && part.endsWith('$')) {
          return <Tex key={i} math={part.slice(1, -1)} />;
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}

/**
 * Note bodies additionally support $$...$$ for display maths and blank-line
 * paragraph breaks. Kept separate from RichText so the cheap inline path stays
 * cheap: the atlas list renders hundreds of RichText nodes at once.
 */
export function NoteBody({ children, className = '' }: RichTextProps) {
  const blocks = useMemo(() => children.split(/\n{2,}/), [children]);

  return (
    <div className={`space-y-3 ${className}`}>
      {blocks.map((block, bi) => {
        const display = /^\s*\$\$([\s\S]+)\$\$\s*$/.exec(block);
        if (display) return <Tex key={bi} math={display[1]!.trim()} block />;
        return (
          <p key={bi} className="leading-relaxed whitespace-pre-wrap">
            <RichText>{block}</RichText>
          </p>
        );
      })}
    </div>
  );
}

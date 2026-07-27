/**
 * KaTeX rendering.
 *
 * Two things this does that the naive version does not:
 *
 * 1. When KaTeX cannot parse an expression, the raw source is shown in a
 *    marked span with a title explaining why. Wikipedia's maths is not
 *    guaranteed to be KaTeX-compatible (it targets MathML/texvc), so failures
 *    are expected. Silently rendering nothing would delete content.
 *
 * 2. `RichText` splits prose on $...$ and renders only those spans as maths.
 *    The dataset stores descriptions with maths in $ delimiters, and a plain
 *    text node would show the dollar signs literally.
 */

import { useMemo } from 'react';
import katex from 'katex';

interface TexProps {
  math: string;
  block?: boolean;
  className?: string;
}

export function Tex({ math, block = false, className = '' }: TexProps) {
  const result = useMemo(() => {
    try {
      return {
        ok: true as const,
        html: katex.renderToString(math, {
          displayMode: block,
          throwOnError: true,
          strict: false,
          trust: false,
          output: 'html',
        }),
      };
    } catch (err) {
      return { ok: false as const, message: err instanceof Error ? err.message : 'Unknown error' };
    }
  }, [math, block]);

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

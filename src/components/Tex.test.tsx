/**
 * These tests exist because of a bug that no amount of looking at the screen
 * could have caught.
 *
 * The component rendered with KaTeX's `output: 'html'`, which emits only the
 * `katex-html` glyph tree. KaTeX marks that tree aria-hidden="true" on purpose,
 * and the <math> element carrying the semantics lives in a sibling that
 * `output: 'html'` never produces. Every formula therefore had an accessible
 * name of "", on a site about mathematics. It looked perfect.
 *
 * `renderToStaticMarkup` is used rather than a DOM testing library because
 * react-dom is already a dependency and the assertion is about emitted markup,
 * not about interaction. No new dependency for a string comparison.
 */

import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Tex, RichText, NoteBody } from './Tex';

describe('Tex accessibility', () => {
  it('emits a real <math> element, not only the aria-hidden glyph tree', () => {
    const html = renderToStaticMarkup(<Tex math="x^2 + y^2 = z^2" />);
    expect(html).toContain('<math');
    expect(html).toContain('</math>');
  });

  it('keeps the visual glyph tree hidden from assistive technology', () => {
    // Both must hold at once. A <math> element alongside a glyph tree that is
    // ALSO announced would make every formula read twice, which is its own bug.
    const html = renderToStaticMarkup(<Tex math="\\frac{1}{2}" />);
    expect(html).toContain('katex-mathml');
    expect(html).toMatch(/class="katex-html"[^>]*aria-hidden="true"/);
  });

  it('carries the source expression inside the annotation, so it can be copied', () => {
    const html = renderToStaticMarkup(<Tex math="\\zeta(s)" />);
    expect(html).toContain('encoding="application/x-tex"');
    expect(html).toContain('\\zeta(s)');
  });

  /**
   * The negative control. Without this, a test asserting "<math> is present"
   * would pass even if the component ignored its options entirely and some
   * unrelated default happened to include MathML. This proves the assertion
   * above is actually measuring the setting that was wrong.
   */
  it('negative control: mathml={false} really does produce no <math> element', () => {
    const html = renderToStaticMarkup(<Tex math="x^2 + y^2 = z^2" mathml={false} />);
    expect(html).not.toContain('<math');
    expect(html).toContain('katex-html');
  });

  it('reaches maths nested in prose and in note bodies', () => {
    // The path that matters most in practice: the atlas list and the journal
    // never call Tex directly, so wiring only the direct call would have left
    // the two highest-volume surfaces silent.
    expect(renderToStaticMarkup(<RichText>{'Is $P = NP$ decidable?'}</RichText>)).toContain('<math');
    expect(renderToStaticMarkup(<NoteBody>{'Consider $$\\int_0^1 x\\,dx$$'}</NoteBody>)).toContain('<math');
  });
});

describe('Tex failure handling', () => {
  it('shows the raw source rather than deleting content KaTeX cannot parse', () => {
    // Unbalanced braces, which no leniency setting can recover from.
    const html = renderToStaticMarkup(<Tex math="\\frac{1" />);
    expect(html).toContain('could not be typeset');
  });

  /**
   * Recorded because the first draft of the test above assumed otherwise.
   *
   * With `strict: false` an UNKNOWN MACRO does not throw — KaTeX renders its
   * name as ordinary letters, so `\thisIsNotAMacro{x}` typesets as the word
   * "thisIsNotAMacrox" rather than reaching the fallback branch. That leniency
   * is wanted: Wikipedia's maths targets texvc and a strict parser would reject
   * a great deal of legitimate content. The trade is that a genuinely bogus
   * macro renders as letter soup instead of being flagged, and this test pins
   * that behaviour so the next reader does not mistake it for a bug in the
   * fallback path.
   */
  it('renders unknown macros as literal text under strict:false, without throwing', () => {
    const html = renderToStaticMarkup(<Tex math="\\thisIsNotAMacro{x}" />);
    expect(html).not.toContain('could not be typeset');
    expect(html).toContain('<math');
  });

  it('renders display maths as a block and inline maths as a span', () => {
    expect(renderToStaticMarkup(<Tex math="x" block />).startsWith('<div')).toBe(true);
    expect(renderToStaticMarkup(<Tex math="x" />).startsWith('<span')).toBe(true);
  });
});

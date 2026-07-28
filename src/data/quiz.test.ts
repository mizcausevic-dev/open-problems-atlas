/**
 * The quiz teaches its answers, so a wrong one is worse than a missing question.
 *
 * The reviewed draft of this content had a designated correct answer that was
 * itself false, two questions where a distractor was also correct, and a
 * definition that contradicted the glossary's version of the same term. None of
 * those are the kind of thing that shows up as a crash.
 */

import { describe, it, expect } from 'vitest';
// @ts-expect-error - plain ESM data modules, no type declarations by design
import { DECKS, balancedOptions } from './quiz.mjs';
// @ts-expect-error - see above
import { TERMS } from './glossary.mjs';

interface Question {
  q: string;
  options: string[];
  answer: number;
  why: string;
  term: string;
}
interface Deck {
  slug: string;
  title: string;
  blurb: string;
  questions: Question[];
}

const decks = DECKS as Deck[];
const questions = decks.flatMap((d) => d.questions);
const termSlugs = new Set((TERMS as { slug: string }[]).map((t) => t.slug));

describe('quiz structure', () => {
  it('has decks with questions', () => {
    expect(decks.length).toBeGreaterThanOrEqual(5);
    expect(questions.length).toBeGreaterThanOrEqual(35);
    for (const d of decks) expect(d.questions.length, d.slug).toBeGreaterThanOrEqual(5);
  });

  it('has unique, url-safe deck slugs', () => {
    const slugs = decks.map((d) => d.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of slugs) expect(s).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('gives every question exactly four options', () => {
    for (const q of questions) expect(q.options.length, q.q).toBe(4);
  });

  it('points every answer index at a real option', () => {
    for (const q of questions) {
      expect(q.answer, q.q).toBeGreaterThanOrEqual(0);
      expect(q.answer, q.q).toBeLessThan(q.options.length);
    }
  });

  it('never repeats an option within a question', () => {
    // A duplicated option can make two indices correct at once.
    for (const q of questions) {
      const norm = q.options.map((o) => o.trim().toLowerCase());
      expect(new Set(norm).size, q.q).toBe(q.options.length);
    }
  });

  it('never asks the same question twice', () => {
    const stems = questions.map((q) => q.q.trim().toLowerCase());
    expect(new Set(stems).size).toBe(stems.length);
  });
});

describe('quiz is grounded in the glossary', () => {
  /**
   * The coupling that prevents the site contradicting itself. The reviewed draft
   * defined chromatic number with "connected" in the glossary and "adjacent" in
   * the quiz — both shipped, and only one was right.
   */
  it('cites a glossary term that exists for every question', () => {
    for (const q of questions) {
      expect(termSlugs.has(q.term), `"${q.q}" cites missing term "${q.term}"`).toBe(true);
    }
  });

  it('explains every answer', () => {
    // An answer key with no reasoning teaches recall, not understanding, and
    // makes a wrong answer impossible to spot in review.
    for (const q of questions) expect(q.why.length, q.q).toBeGreaterThan(60);
  });
});

describe('quiz editorial rules', () => {
  it('asks only about mathematics, never about this application', () => {
    // Two questions in the reviewed draft asked about the app's own encryption
    // and its collection model. They were the only items that could not be
    // checked against any mathematical source, and one had a false answer.
    const selfReferential = /\b(this app|this site|this application|localStorage|AES|encryption at rest|curated collection)\b/i;
    for (const q of questions) {
      expect(`${q.q} ${q.options.join(' ')} ${q.why}`, q.q).not.toMatch(selfReferential);
    }
  });

  it('never editorialises about difficulty or importance', () => {
    const banned = /\b(famous|important|hardest|greatest|legendary|notorious)\b/i;
    for (const q of questions) {
      expect(`${q.q} ${q.options.join(' ')} ${q.why}`, q.q).not.toMatch(banned);
    }
  });

  /**
   * Regression tests for the specific items that were wrong or ill-posed.
   * Each of these read as fine.
   */
  it('does not offer combinatorics as a wrong answer to a graph theory question', () => {
    // Graph theory is a subfield of combinatorics, so "what field studies
    // vertices and edges" had two correct answers.
    for (const q of questions) {
      if (/vertices and edges/i.test(q.q)) {
        expect(q.options.map((o) => o.toLowerCase())).not.toContain('combinatorics');
      }
    }
  });

  it('anchors the Millennium count question to the 2000 announcement', () => {
    // A bare "how many are there?" admits 6 as the alternate reading, so the
    // better-informed reader is the one who gets it wrong.
    const q = questions.find((x) => /how many/i.test(x.q) && /millennium/i.test(x.q))!;
    expect(q.q).toMatch(/Clay Mathematics Institute/);
    expect(q.q).toMatch(/2000/);
    expect(q.options[q.answer]).toBe('7');
  });

  it('states that the Poincaré prize was awarded and declined', () => {
    // "Never awarded" and "still unclaimed" are both false and both plausible.
    const q = questions.find((x) => /became of the Millennium Prize/i.test(x.q))!;
    expect(q.options[q.answer]).toMatch(/awarded and declined/i);
  });

  it('keeps the perfect-number distractor as "divisors", never "proper divisors"', () => {
    // 1 x 2 x 3 = 6, so the product of the PROPER divisors of a perfect number
    // can equal it. Adding the word "proper" here makes the distractor correct.
    const q = questions.find((x) => /A perfect number is equal to/i.test(x.q))!;
    expect(q.options).toContain('the product of its divisors');
    expect(q.options.join(' ')).not.toMatch(/product of its proper divisors/i);
    // "twice its largest proper divisor" is n/2 x 2 = n for every perfect
    // number, so it must never appear as a distractor either.
    expect(q.options.join(' ')).not.toMatch(/largest proper divisor/i);
  });

  it('defines chromatic number on adjacent vertices, agreeing with the glossary', () => {
    const q = questions.find((x) => /chromatic number/i.test(x.q))!;
    expect(q.options[q.answer]).toBe('adjacent');
    const term = (TERMS as { slug: string; definition: string }[]).find(
      (t) => t.slug === 'chromatic-number',
    )!;
    expect(term.definition).toMatch(/adjacent/i);
  });

  it('states Collatz over the positive integers', () => {
    const q = questions.find((x) => /Over which numbers is the Collatz/i.test(x.q))!;
    expect(q.options[q.answer]).toBe('The positive integers');
  });
});

describe('answer positions are balanced', () => {
  /**
   * Authored order clustered 31 of 42 answers at position B with none at D, so
   * always guessing B scored 74%. `balancedOptions` is applied at generation
   * time with the target derived from the question index.
   */
  it('preserves the correct answer text while moving it', () => {
    for (const q of questions) {
      for (let target = 0; target < 4; target++) {
        const r = balancedOptions(q, target) as { options: string[]; answer: number };
        expect(r.answer, q.q).toBe(target);
        expect(r.options[r.answer], q.q).toBe(q.options[q.answer]);
        expect([...r.options].sort()).toEqual([...q.options].sort());
      }
    }
  });

  it('distributes answers evenly across all four positions', () => {
    const dist = [0, 0, 0, 0];
    questions.forEach((q, i) => {
      const { answer } = balancedOptions(q, i % 4) as { answer: number };
      dist[answer] = (dist[answer] ?? 0) + 1;
    });
    // 42 questions over 4 slots: every slot within one of the others.
    expect(Math.max(...dist) - Math.min(...dist)).toBeLessThanOrEqual(1);
    expect(dist.every((n) => n > 0)).toBe(true);
  });

  it('is deterministic, so a rebuild does not reshuffle the answer key', () => {
    const a = balancedOptions(questions[0]!, 3);
    const b = balancedOptions(questions[0]!, 3);
    expect(a).toEqual(b);
  });
});

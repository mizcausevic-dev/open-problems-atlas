/**
 * The glossary is hand-authored, which means it has no generator to be correct
 * by construction and needs the checks a generator would otherwise provide.
 *
 * Two classes of assertion here. Structural ones catch link rot: a `seeAlso`
 * pointing at a slug that does not exist, or a `problems` id that stopped
 * existing when the dataset was re-scraped, both produce a dead link on a
 * published page. Editorial ones enforce the rules this project holds itself to,
 * including the one that caught four wrong definitions in the source proposal.
 */

import { describe, it, expect } from 'vitest';
// @ts-expect-error - plain ESM data module, no type declarations by design
import { TERMS, CATEGORIES } from './glossary.mjs';
import dataset from './problems.generated.json';

interface Term {
  slug: string;
  term: string;
  category: string;
  definition: string;
  note: string;
  seeAlso: string[];
  problems: string[];
}

const terms = TERMS as Term[];
const slugs = new Set(terms.map((t) => t.slug));
const problemIds = new Set((dataset.problems as { id: string }[]).map((p) => p.id));

describe('glossary structure', () => {
  it('has a usable number of terms', () => {
    expect(terms.length).toBeGreaterThanOrEqual(50);
  });

  it('has no duplicate slugs', () => {
    expect(slugs.size).toBe(terms.length);
  });

  it('uses url-safe slugs', () => {
    for (const t of terms) expect(t.slug, t.term).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('assigns every term to a declared category', () => {
    for (const t of terms) expect(CATEGORIES, t.term).toContain(t.category);
  });

  it('uses every declared category at least once', () => {
    // An empty category renders as an empty section on the index page.
    for (const c of CATEGORIES as string[]) {
      expect(terms.some((t) => t.category === c), `no terms in ${c}`).toBe(true);
    }
  });
});

describe('glossary cross-references resolve', () => {
  it('points seeAlso only at terms that exist', () => {
    for (const t of terms) {
      for (const ref of t.seeAlso) {
        expect(slugs.has(ref), `${t.slug} → ${ref} does not exist`).toBe(true);
      }
    }
  });

  it('never links a term to itself', () => {
    for (const t of terms) expect(t.seeAlso, t.slug).not.toContain(t.slug);
  });

  /**
   * The link that would rot silently. Problem ids come from a dataset that is
   * regenerated from a Wikipedia revision; a re-scrape can rename or drop an
   * entry, and the glossary page would then link into a 404 with nothing
   * anywhere reporting it.
   */
  it('points problems only at ids present in the dataset', () => {
    for (const t of terms) {
      for (const id of t.problems) {
        expect(problemIds.has(id), `${t.slug} → problem "${id}" is not in the dataset`).toBe(true);
      }
    }
  });

  it('reaches every term from at least one other term', () => {
    // An unreferenced term is reachable only from the index, which wastes the
    // internal link graph the glossary exists to build.
    const referenced = new Set(terms.flatMap((t) => t.seeAlso));
    const orphans = terms.filter((t) => !referenced.has(t.slug)).map((t) => t.slug);
    expect(orphans, `orphaned terms: ${orphans.join(', ')}`).toHaveLength(0);
  });
});

describe('glossary editorial rules', () => {
  it('gives every term a definition and a note', () => {
    for (const t of terms) {
      expect(t.definition.length, `${t.slug} definition`).toBeGreaterThan(40);
      expect(t.note.length, `${t.slug} note`).toBeGreaterThan(80);
    }
  });

  /**
   * The thin-content floor, made mechanical. A page carrying one short line is
   * the pattern this project refused for 591 problem pages; refusing it here
   * too has to be enforced rather than intended.
   */
  it('carries enough substance per page to justify the page', () => {
    for (const t of terms) {
      const words = `${t.definition} ${t.note}`.split(/\s+/).length;
      expect(words, `${t.slug} has only ${words} words`).toBeGreaterThan(60);
    }
  });

  it('never editorialises about difficulty or importance', () => {
    // Same rule the share text obeys: this project does not rank problems it
    // cannot rank, and "the hardest unsolved problem" is not a sourceable claim.
    const banned = /\b(famous|important|hardest|greatest|legendary|notorious|beautiful|elegant)\b/i;
    for (const t of terms) {
      expect(`${t.definition} ${t.note}`, t.slug).not.toMatch(banned);
    }
  });

  /**
   * Regression tests for the four definitions that were wrong in the source
   * proposal. Each of these looked fine and was not.
   */
  it('states Collatz over the positive integers', () => {
    const c = terms.find((t) => t.slug === 'collatz-conjecture')!;
    // Without this restriction the claim is false: -1 -> -2 -> -1 cycles.
    expect(`${c.definition} ${c.note}`).toMatch(/positive integer/i);
  });

  it('defines chromatic number on adjacent vertices, not connected ones', () => {
    const c = terms.find((t) => t.slug === 'chromatic-number')!;
    expect(c.definition).toMatch(/adjacent/i);
    expect(c.definition).not.toMatch(/no two connected/i);
  });

  it('requires amicable numbers to be distinct', () => {
    const a = terms.find((t) => t.slug === 'amicable-numbers')!;
    // Without "distinct" every perfect number pairs with itself.
    expect(a.definition).toMatch(/distinct/i);
  });

  it('states the continuum hypothesis as a statement, with its independence', () => {
    const ch = terms.find((t) => t.slug === 'continuum-hypothesis')!;
    expect(ch.definition).toMatch(/^The statement that/);
    expect(ch.note).toMatch(/independent/i);
  });

  it('requires coprimality and the radical in the abc conjecture', () => {
    const abc = terms.find((t) => t.slug === 'abc-conjecture')!;
    expect(abc.definition).toMatch(/coprime/i);
    expect(abc.definition).toMatch(/rad\(abc\)/);
  });
});

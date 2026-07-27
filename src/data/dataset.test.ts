/**
 * Dataset integrity.
 *
 * These are the guard rails against the failure mode this whole project exists
 * to avoid: data that looks authoritative but was invented. Every assertion
 * below is a claim the app makes to its users, checked mechanically.
 */

import { describe, it, expect } from 'vitest';
import raw from './problems.generated.json';
import type { Dataset } from '../types';

const dataset = raw as unknown as Dataset;
const { problems, meta } = dataset;

describe('provenance', () => {
  it('names its source, revision and licence', () => {
    expect(meta.source.url).toBe('https://en.wikipedia.org/wiki/List_of_unsolved_problems_in_mathematics');
    expect(meta.source.license).toBe('CC BY-SA 4.0');
    expect(meta.source.revisionId).toBeTypeOf('number');
    expect(meta.generatedBy).toBe('scripts/build-dataset.mjs');
  });

  it('has counts that match the actual contents', () => {
    expect(meta.counts.total).toBe(problems.length);
    expect(meta.counts.open).toBe(problems.filter((p) => p.status === 'open').length);
    expect(meta.counts.solved).toBe(problems.filter((p) => p.status === 'solved').length);
    expect(meta.counts.millennium).toBe(problems.filter((p) => p.millennium).length);
  });
});

describe('every problem', () => {
  it('has a unique id', () => {
    const ids = problems.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has a non-empty title', () => {
    for (const p of problems) {
      expect(p.title.length, p.id).toBeGreaterThan(0);
    }
  });

  it('has a linked article, or is one of the few stated inline without one', () => {
    const linkless = problems.filter((p) => !p.wikipediaTitle);
    for (const p of problems) {
      if (p.wikipediaTitle !== undefined) expect(p.wikipediaTitle.length, p.id).toBeGreaterThan(0);
    }
    // A handful is expected. A large number would mean the link parser broke.
    expect(linkless.length / problems.length).toBeLessThan(0.1);
  });

  it('never titles an entry after the person who settled it', () => {
    // Regression guard. A bullet whose only wikilink sits inside the trailing
    // "(Solver, Year)" attribution used to be titled after that person, e.g.
    // "Aleksandar Nikolov" instead of "Beck's conjecture on discrepancies...".
    for (const p of problems) {
      if (!p.solvedBy) continue;
      expect(p.solvedBy.split(/,\s*/).map((s) => s.trim()), p.id).not.toContain(p.title.trim());
    }
  });

  it('declares where its field classification came from', () => {
    for (const p of problems) {
      expect(['wikipedia-section', 'curated'], p.id).toContain(p.fieldSource);
    }
  });

  it('carries no leftover wiki markup', () => {
    const markup = /\[\[|\]\]|\{\{|\}\}|<ref|<\/?math|'''/;
    // Maths spans are excluded: LaTeX legitimately contains {{ and }} (as in
    // _{\operatorname{cf}(\lambda)}}), which would otherwise read as template
    // syntax and fail this check on correct data.
    const outsideMath = (s: string) => s.replace(/\$[^$]*\$/g, '');
    for (const p of problems) {
      expect(markup.test(outsideMath(p.title)), `title of ${p.id}`).toBe(false);
      if (p.description) {
        expect(markup.test(outsideMath(p.description)), `description of ${p.id}`).toBe(false);
      }
    }
  });

  it('has balanced $ delimiters, or KaTeX will swallow the rest of the sentence', () => {
    for (const p of problems) {
      if (!p.description) continue;
      const dollars = (p.description.match(/\$/g) ?? []).length;
      expect(dollars % 2, `${p.id}: ${p.description}`).toBe(0);
    }
  });

  it('points its parentId at a problem that exists', () => {
    const ids = new Set(problems.map((p) => p.id));
    for (const p of problems) {
      if (p.parentId) expect(ids.has(p.parentId), `${p.id} -> ${p.parentId}`).toBe(true);
    }
  });
});

describe('no invented values', () => {
  it('has no popularity, progress or consensus metric anywhere', () => {
    // The Gemini build shipped a "consensusProgress: 35" per problem and a
    // fabricated pageview series. There is no source for either. If a field
    // like that ever appears here it means someone made a number up.
    const forbidden = [
      'consensusProgress',
      'pageviewsData',
      'dailyViews',
      'velocity30d',
      'popularity',
      'difficultyScore',
      'trendingScore',
    ];
    const asText = JSON.stringify(problems);
    for (const key of forbidden) {
      expect(asText.includes(`"${key}"`), `dataset contains ${key}`).toBe(false);
    }
  });

  it('gives a solved year only to problems recorded as solved', () => {
    for (const p of problems) {
      if (p.solvedYear !== undefined) {
        expect(['solved', 'partially-solved'], p.id).toContain(p.status);
      }
    }
  });

  it('keeps solved years inside the range the source section covers', () => {
    for (const p of problems) {
      if (p.status !== 'solved' || !p.solvedYear) continue;
      // The section is titled "Problems solved since 1995".
      expect(p.solvedYear, p.id).toBeGreaterThanOrEqual(1995);
      expect(p.solvedYear, p.id).toBeLessThanOrEqual(new Date().getFullYear() + 1);
    }
  });

  it('records conflicting listings as variants instead of blending them', () => {
    for (const p of problems) {
      if (p.status === 'partially-solved') {
        expect(p.variants?.length, `${p.id} is partially solved but has no variants`).toBeGreaterThan(0);
      }
    }
  });
});

describe('coverage', () => {
  it('includes all seven Millennium Prize Problems', () => {
    const millennium = problems.filter((p) => p.millennium).map((p) => p.title).sort();
    expect(millennium).toEqual([
      'Birch and Swinnerton-Dyer conjecture',
      'Hodge conjecture',
      'Navier–Stokes existence and smoothness',
      'P versus NP problem',
      'Poincaré conjecture',
      'Riemann hypothesis',
      'Yang–Mills existence and mass gap',
    ]);
  });

  it('records the Poincaré conjecture as solved and the rest as open', () => {
    const byTitle = new Map(problems.map((p) => [p.title, p]));
    expect(byTitle.get('Poincaré conjecture')?.status).toBe('solved');
    expect(byTitle.get('Riemann hypothesis')?.status).toBe('open');
    expect(byTitle.get('P versus NP problem')?.status).toBe('open');
  });

  it('is substantially broader than a hand-written sample', () => {
    // The point of generating from source: a hand-typed list stops at a dozen.
    expect(problems.length).toBeGreaterThan(400);
    expect(new Set(problems.map((p) => p.field)).size).toBeGreaterThanOrEqual(10);
  });

  it('describes most of what it lists', () => {
    const ratio = problems.filter((p) => p.description).length / problems.length;
    expect(ratio).toBeGreaterThan(0.7);
  });
});

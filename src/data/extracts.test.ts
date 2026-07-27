/**
 * Extract integrity.
 *
 * The extracts are rendered as prose with `$...$` spans handed to KaTeX, so the
 * failure modes are quiet ones: an unbalanced delimiter eats the rest of a
 * paragraph, and leftover MediaWiki markup reads as gibberish. Neither throws.
 */

import { describe, it, expect } from 'vitest';
import extractsFile from './extracts.generated.json';
import problemsFile from './problems.generated.json';
import type { Dataset } from '../types';

const { extracts, meta } = extractsFile as unknown as {
  meta: { counts: Record<string, number>; maxChars: number; source: { license: string } };
  extracts: Record<string, { text: string; truncated: boolean; resolvedTitle: string; scope: string }>;
};
const { problems } = problemsFile as unknown as Dataset;
const entries = Object.entries(extracts);

describe('extracts provenance', () => {
  it('records its licence', () => {
    expect(meta.source.license).toBe('CC BY-SA 4.0');
  });

  it('has counts that match the contents', () => {
    expect(meta.counts.problemsWithExtract).toBe(entries.length);
    expect(meta.counts.problemsTotal).toBe(problems.length);
  });

  it('covers most of the dataset', () => {
    expect(entries.length / problems.length).toBeGreaterThan(0.85);
  });
});

describe('every extract', () => {
  it('belongs to a problem that exists', () => {
    const ids = new Set(problems.map((p) => p.id));
    for (const [id] of entries) expect(ids.has(id), id).toBe(true);
  });

  it('has balanced $ delimiters', () => {
    // Regression guard. Truncating at a sentence boundary once landed inside a
    // formula for three extracts, leaving an opening $ with no partner. KaTeX
    // then consumes the remainder of the paragraph and it disappears.
    for (const [id, e] of entries) {
      const dollars = (e.text.match(/\$/g) ?? []).length;
      expect(dollars % 2, `${id} has ${dollars} dollar signs`).toBe(0);
    }
  });

  it('carries no leftover MediaWiki math markup', () => {
    for (const [id, e] of entries) {
      expect(e.text.includes('{\\displaystyle'), id).toBe(false);
      expect(e.text.includes('\\displaystyle'), id).toBe(false);
      expect(/<\/?math/.test(e.text), id).toBe(false);
    }
  });

  it('respects the character budget', () => {
    for (const [id, e] of entries) {
      expect(e.text.length, id).toBeLessThanOrEqual(meta.maxChars);
      expect(e.text.trim().length, id).toBeGreaterThan(0);
    }
  });

  it('declares whether it describes the problem or a broader article', () => {
    for (const [id, e] of entries) {
      expect(['problem', 'article'], id).toContain(e.scope);
    }
  });

  it("flags article-scope extracts exactly when the problem links to a section", () => {
    const byId = new Map(problems.map((p) => [p.id, p]));
    for (const [id, e] of entries) {
      const p = byId.get(id);
      if (!p) continue;
      expect(e.scope, id).toBe(p.wikipediaAnchor ? 'article' : 'problem');
    }
  });

  it('never invents an extract for a problem with no article', () => {
    const byId = new Map(problems.map((p) => [p.id, p]));
    for (const [id] of entries) {
      expect(byId.get(id)?.wikipediaTitle, id).toBeTruthy();
    }
  });
});

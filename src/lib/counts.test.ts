import { describe, it, expect } from 'vitest';
import raw from '../data/problems.generated.json';
import type { Dataset } from '../types';
import { deriveCounts, hasSettledOutcome, settledYearOf, settledByOf, summarySentence } from './counts';

const { problems, meta } = raw as unknown as Dataset;
const c = deriveCounts(problems);

describe('derived counts', () => {
  it('partitions every problem into exactly one status bucket', () => {
    expect(c.open + c.settled + c.partlySettled).toBe(c.total);
    expect(c.total).toBe(problems.length);
  });

  it('agrees with the counts the generator recorded', () => {
    // The generator and the app must not disagree about the same dataset.
    expect(c.total).toBe(meta.counts.total);
    expect(c.open).toBe(meta.counts.open);
    expect(c.settled).toBe(meta.counts.solved);
    expect(c.millennium).toBe(meta.counts.millennium);
  });

  it('explains the timeline figure rather than contradicting the header', () => {
    // This is the regression under test. The header shows `settled`; the
    // timeline shows `timeline.dated`. They differ, and the difference is
    // exactly the partly-settled problems plus the ones with no year.
    expect(c.timeline.entries).toBe(c.settled + c.partlySettled);
    expect(c.timeline.dated + c.timeline.undated).toBe(c.timeline.entries);
    expect(c.timeline.dated).toBeLessThanOrEqual(c.timeline.entries);
  });

  it('keeps timeline years inside the range the source section covers', () => {
    expect(c.timeline.firstYear).toBeGreaterThanOrEqual(1995);
    expect(c.timeline.lastYear).toBeLessThanOrEqual(new Date().getFullYear() + 1);
  });

  it('counts only problems that really carry an article link', () => {
    expect(c.withArticle).toBe(problems.filter((p) => p.wikipediaTitle).length);
    expect(c.withArticle).toBeLessThanOrEqual(c.total);
  });
});

describe('shared predicates', () => {
  it('hasSettledOutcome covers solved and partly-settled-with-a-solved-variant', () => {
    for (const p of problems) {
      const expected =
        p.status === 'solved' || Boolean(p.variants?.some((v) => v.status === 'solved'));
      expect(hasSettledOutcome(p), p.id).toBe(expected);
    }
  });

  it('never reports a settled year for a problem with no settled outcome', () => {
    for (const p of problems) {
      if (!hasSettledOutcome(p)) expect(settledYearOf(p), p.id).toBeUndefined();
    }
  });

  it('falls back to the variant for partly settled problems', () => {
    const partly = problems.filter((p) => p.status === 'partially-solved');
    expect(partly.length).toBeGreaterThan(0);
    for (const p of partly) {
      if (p.variants?.some((v) => v.solvedBy)) expect(settledByOf(p), p.id).toBeDefined();
    }
  });
});

describe('summarySentence', () => {
  it('states all three buckets so no surface can imply a different split', () => {
    const s = summarySentence(c);
    expect(s).toContain(String(c.settled));
    expect(s).toContain(String(c.partlySettled));
    expect(s).toContain(c.open.toLocaleString());
  });
});

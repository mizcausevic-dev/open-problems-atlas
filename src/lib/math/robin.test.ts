import { describe, it, expect } from 'vitest';
import {
  divisorSumSieve,
  robinRatio,
  exceedsRobin,
  robinExceptions,
  robinSeries,
  E_GAMMA,
  KNOWN_EXCEPTIONS,
  ROBIN_BOUND,
  NEAR_MISSES,
} from './robin';

const sigma = divisorSumSieve(200_000);

describe('divisor sum sieve', () => {
  it('matches hand-computed values', () => {
    expect(sigma[1]).toBe(1);
    expect(sigma[6]).toBe(12); // 1+2+3+6, the first perfect number
    expect(sigma[12]).toBe(28); // 1+2+3+4+6+12
    expect(sigma[28]).toBe(56); // 1+2+4+7+14+28, perfect
    expect(sigma[5040]).toBe(19344);
  });

  it('gives sigma(p) = p + 1 for primes', () => {
    for (const p of [2, 3, 5, 7, 11, 13, 101, 997, 7919]) {
      expect(sigma[p], `sigma(${p})`).toBe(p + 1);
    }
  });

  it('agrees with brute-force division across a range', () => {
    for (let n = 1; n <= 2000; n++) {
      let sum = 0;
      for (let d = 1; d <= n; d++) if (n % d === 0) sum += d;
      expect(sigma[n], `sigma(${n})`).toBe(sum);
    }
  });
});

describe("e^gamma", () => {
  it('is the published constant', () => {
    expect(E_GAMMA).toBeCloseTo(1.7810724179901979, 12);
  });
});

describe("Robin's inequality", () => {
  it('reproduces the published exception list exactly', () => {
    // OEIS A067698: every n with sigma(n) >= e^gamma * n * ln ln n.
    // All 27 are at or below 5040. This is the assertion that proves the
    // implementation, not a sample of it.
    expect(robinExceptions(ROBIN_BOUND, sigma)).toEqual([...KNOWN_EXCEPTIONS]);
  });

  it('finds exactly 27 exceptions', () => {
    expect(KNOWN_EXCEPTIONS).toHaveLength(27);
  });

  it('finds no exception above 5040 in the scanned range', () => {
    // Not a proof of anything. If this ever failed on correct code, the
    // Riemann Hypothesis would be false.
    const above = robinExceptions(200_000, sigma).filter((n) => n > ROBIN_BOUND);
    expect(above).toEqual([]);
  });

  it('puts 5040 just above the line and 10080 just below it', () => {
    expect(robinRatio(5040, sigma)).toBeGreaterThan(E_GAMMA);
    expect(robinRatio(10080, sigma)).toBeLessThan(E_GAMMA);
  });

  it('keeps the near-miss presets close to the bound but under it', () => {
    for (const n of NEAR_MISSES.filter((v) => v > ROBIN_BOUND && v < 200_000)) {
      const r = robinRatio(n, sigma);
      expect(r, `ratio at ${n}`).toBeLessThan(E_GAMMA);
      // "Near" means within a few percent, which is what makes these the only
      // interesting places to look.
      expect(r, `ratio at ${n}`).toBeGreaterThan(E_GAMMA * 0.95);
    }
  });

  it('returns NaN at n = 1 rather than a made-up number', () => {
    expect(Number.isNaN(robinRatio(1, sigma))).toBe(true);
  });

  it('treats n = 2 as a genuine exception, since ln ln 2 is negative', () => {
    // Regression guard. Testing `ratio >= e^gamma` instead of the inequality
    // itself misses this case: dividing by a negative ln ln n flips the
    // comparison, so n = 2 reads as compliant when it is the first exception.
    expect(robinRatio(2, sigma)).toBeLessThan(0);
    expect(exceedsRobin(2, sigma)).toBe(true);
    expect(robinExceptions(3, sigma)).toContain(2);
  });

  it('agrees between the inequality form and the ratio form wherever ln ln n > 0', () => {
    for (let n = 3; n <= 20_000; n++) {
      expect(exceedsRobin(n, sigma), `n = ${n}`).toBe(robinRatio(n, sigma) >= E_GAMMA);
    }
  });
});

describe('robinSeries', () => {
  it('stays within the requested range and skips non-finite points', () => {
    const s = robinSeries(1, 5000, sigma, 500);
    expect(s.length).toBeGreaterThan(0);
    expect(s.length).toBeLessThanOrEqual(501);
    for (const p of s) {
      expect(p.n).toBeGreaterThanOrEqual(2);
      expect(p.n).toBeLessThanOrEqual(5000);
      expect(Number.isFinite(p.ratio)).toBe(true);
    }
  });

  it('flags exceedances from the inequality, not the ratio', () => {
    for (const p of robinSeries(2, 6000, sigma, 800)) {
      expect(p.exceeds, `n = ${p.n}`).toBe(exceedsRobin(p.n, sigma));
      // Above n = 2 the ratio form agrees; at n = 2 it does not, which is the
      // whole reason the series reports `exceeds` separately from `ratio`.
      if (p.n > 2) expect(p.exceeds, `n = ${p.n}`).toBe(p.ratio >= E_GAMMA);
    }
  });
});

import { describe, it, expect } from 'vitest';
import {
  sieve,
  isPrime,
  primePi,
  goldbachPartitions,
  goldbachComet,
  twinPrimes,
  recordGaps,
  logarithmicIntegral,
} from './primes';

const s = sieve(1_000_000);

describe('sieve', () => {
  it('starts with the right primes', () => {
    expect(Array.from(s.primes.slice(0, 10))).toEqual([2, 3, 5, 7, 11, 13, 17, 19, 23, 29]);
  });

  it('excludes 0 and 1', () => {
    expect(isPrime(0, s)).toBe(false);
    expect(isPrime(1, s)).toBe(false);
  });

  it('agrees with known values of pi(x)', () => {
    // Standard published values of the prime counting function.
    expect(primePi(10, s)).toBe(4);
    expect(primePi(100, s)).toBe(25);
    expect(primePi(1_000, s)).toBe(168);
    expect(primePi(10_000, s)).toBe(1_229);
    expect(primePi(100_000, s)).toBe(9_592);
    expect(primePi(1_000_000, s)).toBe(78_498);
  });

  it('rejects Carmichael numbers, which fool weaker primality checks', () => {
    for (const n of [561, 1105, 1729, 2465, 6601, 8911]) {
      expect(isPrime(n, s)).toBe(false);
    }
  });
});

describe('Goldbach', () => {
  it('gives the correct partitions of small even numbers', () => {
    expect(goldbachPartitions(4, s)).toEqual([{ p: 2, q: 2 }]);
    expect(goldbachPartitions(10, s)).toEqual([
      { p: 3, q: 7 },
      { p: 5, q: 5 },
    ]);
  });

  it('never returns a partition whose parts are not both prime', () => {
    for (const n of [100, 256, 1000, 4096]) {
      for (const { p, q } of goldbachPartitions(n, s)) {
        expect(isPrime(p, s)).toBe(true);
        expect(isPrime(q, s)).toBe(true);
        expect(p + q).toBe(n);
      }
    }
  });

  it('finds at least one partition for every even n in [4, 100000]', () => {
    // This is the conjecture itself, verified over the range the lab plots.
    const comet = goldbachComet(4, 100_000, s);
    const failures = comet.filter((c) => c.count === 0);
    expect(failures).toEqual([]);
  });

  it('ignores odd input rather than inventing an answer', () => {
    expect(goldbachPartitions(9, s)).toEqual([]);
  });
});

describe('twin primes and gaps', () => {
  it('finds the known twin pairs below 100', () => {
    expect(twinPrimes(100, s)).toEqual([
      [3, 5],
      [5, 7],
      [11, 13],
      [17, 19],
      [29, 31],
      [41, 43],
      [59, 61],
      [71, 73],
    ]);
  });

  it('records the first maximal prime gaps', () => {
    const gaps = recordGaps(s).slice(0, 6);
    // Published sequence of first-occurrence maximal gaps (OEIS A005250/A002386).
    expect(gaps).toEqual([
      { after: 2, gap: 1 },
      { after: 3, gap: 2 },
      { after: 7, gap: 4 },
      { after: 23, gap: 6 },
      { after: 89, gap: 8 },
      { after: 113, gap: 14 },
    ]);
  });
});

describe('logarithmic integral', () => {
  it('approximates pi(x) better than x/ln x, as the PNT predicts', () => {
    const x = 1_000_000;
    const actual = primePi(x, s);
    const li = logarithmicIntegral(x);
    const crude = x / Math.log(x);
    expect(Math.abs(li - actual)).toBeLessThan(Math.abs(crude - actual));
  });

  it('matches the published value of Li(10^6)', () => {
    // Li(10^6) = 78627.549... ; pi(10^6) = 78498
    expect(logarithmicIntegral(1_000_000)).toBeCloseTo(78627.5, 0);
  });
});

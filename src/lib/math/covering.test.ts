import { describe, it, expect } from 'vitest';
import {
  multiplicativeOrder,
  lcm,
  dividesTerm,
  coveringStrip,
  uncoveredWithout,
  primeContributions,
  SIERPINSKI_78557,
  RIESEL_509203,
} from './covering';

describe('multiplicativeOrder', () => {
  it('matches hand-computed orders of 2', () => {
    expect(multiplicativeOrder(2, 3)).toBe(2);
    expect(multiplicativeOrder(2, 5)).toBe(4);
    expect(multiplicativeOrder(2, 7)).toBe(3);
    expect(multiplicativeOrder(2, 13)).toBe(12);
    expect(multiplicativeOrder(2, 19)).toBe(18);
    expect(multiplicativeOrder(2, 37)).toBe(36);
    expect(multiplicativeOrder(2, 73)).toBe(9);
  });

  it('really is the least d with 2^d = 1', () => {
    for (const p of [3, 5, 7, 11, 13, 17, 19, 23, 37, 73, 241]) {
      const d = multiplicativeOrder(2, p);
      // 2^d = 1 mod p
      let x = 1;
      for (let i = 0; i < d; i++) x = (x * 2) % p;
      expect(x, `2^${d} mod ${p}`).toBe(1);
      // and no smaller exponent works
      let y = 1;
      for (let i = 1; i < d; i++) {
        y = (y * 2) % p;
        expect(y, `2^${i} mod ${p} should not be 1`).not.toBe(1);
      }
    }
  });

  it('divides p - 1, as Lagrange requires', () => {
    for (const p of [3, 5, 7, 13, 17, 19, 37, 73, 241]) {
      expect((p - 1) % multiplicativeOrder(2, p), `p = ${p}`).toBe(0);
    }
  });

  it('reports failure rather than looping forever when there is no order', () => {
    expect(multiplicativeOrder(2, 4)).toBe(-1); // 2 is not coprime to 4
  });
});

describe('lcm', () => {
  it('computes the period of the combined pattern', () => {
    expect([2, 4, 3, 12, 18, 36, 9].reduce(lcm, 1)).toBe(36);
    expect([2, 4, 3, 12, 8, 24].reduce(lcm, 1)).toBe(24);
  });
});

describe('dividesTerm', () => {
  it('agrees with exact bigint arithmetic', () => {
    // The module works in modular arithmetic because k*2^n overflows a double.
    // This checks it against the real number, computed exactly.
    for (let n = 0; n < 40; n++) {
      const exact = 78557n * 2n ** BigInt(n) + 1n;
      for (const p of SIERPINSKI_78557.primes) {
        expect(dividesTerm(78557, n, 1, p), `p=${p}, n=${n}`).toBe(exact % BigInt(p) === 0n);
      }
    }
  });

  it('handles the Riesel minus sign', () => {
    for (let n = 0; n < 30; n++) {
      const exact = 509203n * 2n ** BigInt(n) - 1n;
      for (const p of RIESEL_509203.primes) {
        expect(dividesTerm(509203, n, -1, p), `p=${p}, n=${n}`).toBe(exact % BigInt(p) === 0n);
      }
    }
  });
});

describe('the 78,557 covering set', () => {
  const strip = coveringStrip(SIERPINSKI_78557.k, [...SIERPINSKI_78557.primes], 1);

  it('has period 36', () => {
    expect(strip.orders).toEqual([2, 4, 3, 12, 18, 36, 9]);
    expect(strip.period).toBe(36);
  });

  it('covers every residue class — this is the whole proof', () => {
    expect(strip.complete).toBe(true);
    expect(strip.uncovered).toEqual([]);
    expect(strip.cells).toHaveLength(36);
    for (const cell of strip.cells) {
      expect(cell.divisors.length, `n = ${cell.n}`).toBeGreaterThan(0);
    }
  });

  it('genuinely makes every term composite, checked exactly for the first period', () => {
    // Independent of the covering argument: form the actual number and confirm
    // it has a proper factor.
    for (let n = 1; n <= 36; n++) {
      const value = 78557n * 2n ** BigInt(n) + 1n;
      const factor = SIERPINSKI_78557.primes.find((p) => value % BigInt(p) === 0n);
      expect(factor, `n = ${n}`).toBeDefined();
      expect(value > BigInt(factor!), `n = ${n} must be a proper factor`).toBe(true);
    }
  });

  it('is exactly periodic: n and n + 36 have the same divisors', () => {
    for (let n = 0; n < 36; n++) {
      const here = strip.cells[n]!.divisors;
      const later = SIERPINSKI_78557.primes.filter((p) => dividesTerm(78557, n + 36, 1, p));
      expect(later, `n = ${n}`).toEqual(here);
    }
  });

  it('leaves gaps when a prime is removed — the negative control', () => {
    // Without this, a checker that marked everything covered would pass the
    // completeness test above and look correct.
    expect(uncoveredWithout(strip, 19)).toHaveLength(1);
    expect(uncoveredWithout(strip, 37)).toHaveLength(1);
    expect(uncoveredWithout(strip, 73)).toHaveLength(1);
    expect(uncoveredWithout(strip, 3)).toHaveLength(10);
    expect(uncoveredWithout(strip, 5)).toHaveLength(4);
    expect(uncoveredWithout(strip, 7)).toHaveLength(3);
    expect(uncoveredWithout(strip, 13)).toHaveLength(3);
  });

  it('makes every prime in the set load-bearing', () => {
    // No prime is redundant: drop any one and the proof fails.
    for (const p of SIERPINSKI_78557.primes) {
      expect(uncoveredWithout(strip, p).length, `${p} should be necessary`).toBeGreaterThan(0);
    }
  });

  it('reports which n each prime is solely responsible for', () => {
    const contributions = primeContributions(strip);
    expect(contributions).toHaveLength(7);
    const byPrime = new Map(contributions.map((c) => [c.prime, c]));
    // 3 covers every even n, which is half the strip.
    expect(byPrime.get(3)!.covers).toHaveLength(18);
    // The rare primes are sole cover for exactly the n their removal exposes.
    for (const p of [19, 37, 73]) {
      expect(byPrime.get(p)!.soleCoverFor, `${p}`).toEqual(uncoveredWithout(strip, p));
    }
  });
});

describe('the 509,203 Riesel covering set', () => {
  const strip = coveringStrip(RIESEL_509203.k, [...RIESEL_509203.primes], -1);

  it('has period 24 and covers every class', () => {
    expect(strip.period).toBe(24);
    expect(strip.complete).toBe(true);
    expect(strip.uncovered).toEqual([]);
  });

  it('makes every term composite, checked exactly', () => {
    for (let n = 1; n <= 24; n++) {
      const value = 509203n * 2n ** BigInt(n) - 1n;
      const factor = RIESEL_509203.primes.find((p) => value % BigInt(p) === 0n);
      expect(factor, `n = ${n}`).toBeDefined();
      expect(value > BigInt(factor!), `n = ${n}`).toBe(true);
    }
  });

  it('needs every prime it lists', () => {
    for (const p of RIESEL_509203.primes) {
      expect(uncoveredWithout(strip, p).length, `${p}`).toBeGreaterThan(0);
    }
  });
});

describe('a set that does not cover', () => {
  it('reports the gaps instead of claiming success', () => {
    // 78557 with an obviously inadequate set. The function must not pretend.
    const strip = coveringStrip(78557, [3, 5], 1);
    expect(strip.complete).toBe(false);
    expect(strip.uncovered.length).toBeGreaterThan(0);
  });
});

import { describe, it, expect } from 'vitest';
import {
  arithmeticTable,
  mertens,
  mertensSeries,
  primeRace,
  firstLeadChange,
  partitions,
  largestExactPartitionIndex,
} from './arithmetic';

const T = arithmeticTable(1_000_000);

describe('linear sieve', () => {
  it('finds the primes', () => {
    expect(Array.from(T.primes.slice(0, 10))).toEqual([2, 3, 5, 7, 11, 13, 17, 19, 23, 29]);
    expect(T.primes.length).toBe(78_498); // pi(10^6)
  });

  it('records the smallest prime factor', () => {
    expect(T.spf[2]).toBe(2);
    expect(T.spf[15]).toBe(3);
    expect(T.spf[49]).toBe(7);
    expect(T.spf[97]).toBe(97);
    expect(T.spf[1_000_000]).toBe(2);
  });
});

describe('Moebius mu', () => {
  it('matches hand-computed values', () => {
    // mu(1)=1; squarefree with k prime factors -> (-1)^k; non-squarefree -> 0
    expect(T.mu[1]).toBe(1);
    expect(T.mu[2]).toBe(-1);
    expect(T.mu[3]).toBe(-1);
    expect(T.mu[4]).toBe(0); // 2^2
    expect(T.mu[6]).toBe(1); // 2*3
    expect(T.mu[30]).toBe(-1); // 2*3*5
    expect(T.mu[12]).toBe(0); // 2^2*3
    expect(T.mu[210]).toBe(1); // 2*3*5*7
  });

  it('vanishes exactly on the non-squarefree numbers', () => {
    for (let n = 1; n <= 20_000; n++) {
      let squarefree = true;
      for (let d = 2; d * d <= n; d++) {
        if (n % (d * d) === 0) {
          squarefree = false;
          break;
        }
      }
      expect(T.mu[n] === 0, `mu(${n})`).toBe(!squarefree);
    }
  });

  it('satisfies the divisor-sum identity sum_{d|n} mu(d) = [n = 1]', () => {
    for (let n = 1; n <= 3000; n++) {
      let sum = 0;
      for (let d = 1; d <= n; d++) if (n % d === 0) sum += T.mu[d]!;
      expect(sum, `n = ${n}`).toBe(n === 1 ? 1 : 0);
    }
  });
});

describe("Euler's totient", () => {
  it('matches published values', () => {
    expect(T.phi[1]).toBe(1);
    expect(T.phi[10]).toBe(4);
    expect(T.phi[100]).toBe(40);
    expect(T.phi[1000]).toBe(400);
    expect(T.phi[999_983]).toBe(999_982); // a prime
  });

  it('gives p - 1 for every prime', () => {
    for (const p of Array.from(T.primes.slice(0, 500))) expect(T.phi[p], `phi(${p})`).toBe(p - 1);
  });

  it('satisfies sum_{d|n} phi(d) = n', () => {
    for (let n = 1; n <= 3000; n++) {
      let sum = 0;
      for (let d = 1; d <= n; d++) if (n % d === 0) sum += T.phi[d]!;
      expect(sum, `n = ${n}`).toBe(n);
    }
  });
});

describe('tau, omega and sigma', () => {
  it('agree with brute-force divisor enumeration', () => {
    for (let n = 1; n <= 20_000; n++) {
      let count = 0;
      let sum = 0;
      for (let d = 1; d * d <= n; d++) {
        if (n % d !== 0) continue;
        const e = n / d;
        count += d === e ? 1 : 2;
        sum += d === e ? d : d + e;
      }
      expect(T.tau[n], `tau(${n})`).toBe(count);
      expect(T.sigma[n], `sigma(${n})`).toBe(sum);
    }
  });

  it('counts distinct prime factors', () => {
    expect(T.omega[1]).toBe(0);
    expect(T.omega[2]).toBe(1);
    expect(T.omega[12]).toBe(2); // 2^2 * 3
    expect(T.omega[30]).toBe(3); // 2*3*5
    expect(T.omega[2310]).toBe(5); // 2*3*5*7*11
  });

  it('agrees with the divisor sieve used by Robin', () => {
    // sigma here must equal sigma there, or the two RH tools disagree.
    for (const n of [6, 28, 496, 5040, 720_720]) {
      let sum = 0;
      for (let d = 1; d * d <= n; d++) {
        if (n % d !== 0) continue;
        const e = n / d;
        sum += d === e ? d : d + e;
      }
      expect(T.sigma[n], `sigma(${n})`).toBe(sum);
    }
  });
});

describe('Mertens function', () => {
  it('matches the published values at powers of ten', () => {
    // OEIS A084237: M(10^n) for n = 0..6
    expect(mertens(1, T)).toBe(1);
    expect(mertens(10, T)).toBe(-1);
    expect(mertens(100, T)).toBe(1);
    expect(mertens(1000, T)).toBe(2);
    expect(mertens(10_000, T)).toBe(-23);
    expect(mertens(100_000, T)).toBe(-48);
    expect(mertens(1_000_000, T)).toBe(212);
  });

  it('produces a series whose last point equals the direct computation', () => {
    const series = mertensSeries(100_000, T, 500);
    expect(series.at(-1)!.x).toBe(100_000);
    expect(series.at(-1)!.m).toBe(mertens(100_000, T));
    expect(series.length).toBeLessThanOrEqual(502);
  });

  it('stays inside the sqrt(x) bound across the computable range', () => {
    // The Mertens conjecture. It holds here, held for every value anyone could
    // check, and is still false — Odlyzko and te Riele disproved it in 1985.
    // This assertion documents that computational evidence is not proof.
    for (const { m, x } of mertensSeries(1_000_000, T, 2000)) {
      expect(Math.abs(m), `|M(${x})|`).toBeLessThan(Math.sqrt(x));
    }
  });
});

describe('prime races', () => {
  it('reproduces Leech (1957): the 4k+1 class first leads at 26861', () => {
    expect(firstLeadChange(1_000_000, 4, 3, 1, T)).toBe(26_861);
  });

  it('shows the 4k+3 class ahead for most of the range', () => {
    const race = primeRace(100_000, 4, 3, 1, T, 500);
    const ahead = race.filter((r) => r.lead > 0).length;
    expect(ahead / race.length).toBeGreaterThan(0.9);
  });

  it('counts each prime into exactly one class', () => {
    const race = primeRace(10_000, 4, 3, 1, T, 100);
    const last = race.at(-1)!;
    // Every odd prime up to 10000 is 1 or 3 mod 4; only p = 2 is neither.
    const oddPrimes = Array.from(T.primes).filter((p) => p <= 10_000 && p !== 2).length;
    expect(last.countA + last.countB).toBe(oddPrimes);
  });

  it('finds no lead change in the 3k+2 vs 3k+1 race below 608981813029', () => {
    // The mod-3 race is also biased; its first change is far beyond our range,
    // so within the computable window the leader never flips.
    expect(firstLeadChange(1_000_000, 3, 2, 1, T)).toBeNull();
  });
});

describe('partition function', () => {
  const p = partitions(400);

  it('matches published values', () => {
    expect(p[0]).toBe(1n);
    expect(p[1]).toBe(1n);
    expect(p[5]).toBe(7n);
    expect(p[10]).toBe(42n);
    expect(p[50]).toBe(204_226n);
    expect(p[100]).toBe(190_569_292n);
    expect(p[200]).toBe(3_972_999_029_388n);
  });

  it('satisfies the Ramanujan congruences', () => {
    for (let k = 0; 5 * k + 4 <= 400; k++) expect(p[5 * k + 4]! % 5n, `p(${5 * k + 4})`).toBe(0n);
    for (let k = 0; 7 * k + 5 <= 400; k++) expect(p[7 * k + 5]! % 7n, `p(${7 * k + 5})`).toBe(0n);
    for (let k = 0; 11 * k + 6 <= 400; k++) expect(p[11 * k + 6]! % 11n, `p(${11 * k + 6})`).toBe(0n);
  });

  it('is monotonic from n = 1', () => {
    for (let n = 2; n <= 400; n++) expect(p[n]! >= p[n - 1]!, `p(${n})`).toBe(true);
  });

  it('reports where double precision stops being exact', () => {
    // Measured, not guessed: p(299) is the last partition number that fits in a
    // JavaScript number. p(300) = 9,253,082,936,723,602 exceeds 2^53 - 1 =
    // 9,007,199,254,740,991. Returning a rounded double past that point would be
    // wrong exactly where the Ramanujan congruences are worth checking, which is
    // why partitions() returns bigint.
    expect(largestExactPartitionIndex(p)).toBe(299);
    expect(p[299]! <= BigInt(Number.MAX_SAFE_INTEGER)).toBe(true);
    expect(p[300]! > BigInt(Number.MAX_SAFE_INTEGER)).toBe(true);
    expect(p[300]).toBe(9_253_082_936_723_602n);
  });
});

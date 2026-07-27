/**
 * Covering sets: the rare case where a picture is a complete proof.
 *
 * A Sierpinski number is an odd k such that k*2^n + 1 is composite for EVERY
 * n >= 1. That is a statement about infinitely many numbers, and yet it can be
 * settled by a finite check, because 78557 comes with a covering set:
 *
 *     {3, 5, 7, 13, 19, 37, 73}
 *
 * For each of these primes p, the residue of 78557*2^n + 1 mod p depends only on
 * n modulo the multiplicative order of 2 mod p. Those orders are 2, 4, 3, 12, 18,
 * 36 and 9, so the whole pattern repeats with period lcm = 36. Check that every
 * n in 0..35 is divisible by at least one of the seven, and you have checked
 * every n there will ever be.
 *
 * That is why the strip this module produces is not an illustration of the
 * proof. It is the proof, at full size, and a reader can audit all 36 columns.
 *
 * WHAT IS AND IS NOT OPEN, because the two are easy to conflate:
 *   PROVEN  78557 is a Sierpinski number. This module demonstrates it.
 *   OPEN    Whether 78557 is the SMALLEST one — Selfridge's conjecture. Five
 *           candidates below it remain unresolved, each needing a prime to be
 *           found rather than a covering set to be exhibited. A covering set
 *           cannot settle that question and this module does not claim to.
 */

/** Multiplicative order of a modulo m: the least d > 0 with a^d = 1 (mod m). */
export function multiplicativeOrder(a: number, m: number): number {
  if (m <= 1) return 1;
  let x = a % m;
  let d = 1;
  // Bounded by m: by Lagrange the order divides m - 1 for prime m, so exceeding
  // m means a and m are not coprime and no order exists.
  while (x !== 1) {
    x = (x * a) % m;
    d++;
    if (d > m) return -1;
  }
  return d;
}

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
export const lcm = (a: number, b: number): number => (a / gcd(a, b)) * b;

/** +1 for Sierpinski (k*2^n + 1), -1 for Riesel (k*2^n - 1). */
export type Sign = 1 | -1;

export interface CoveringCell {
  n: number;
  /** Every prime in the set that divides k*2^n + sign. Usually one, sometimes more. */
  divisors: number[];
}

export interface CoveringStrip {
  k: number;
  sign: Sign;
  primes: number[];
  /** Multiplicative order of 2 modulo each prime, in the same order. */
  orders: number[];
  /** lcm of the orders: the pattern repeats exactly this often. */
  period: number;
  cells: CoveringCell[];
  /** True when every residue class is covered, i.e. the proof goes through. */
  complete: boolean;
  /** Any n in one period left uncovered. Empty when complete. */
  uncovered: number[];
}

/**
 * Does p divide k*2^n + sign?
 *
 * Computed entirely in modular arithmetic. Forming k*2^n directly overflows a
 * double at modest n, and a rounded value would answer a divisibility question
 * about a number that is not the one asked about.
 */
export function dividesTerm(k: number, n: number, sign: Sign, p: number): boolean {
  let pow = 1 % p;
  for (let i = 0; i < n; i++) pow = (pow * 2) % p;
  return (((k % p) * pow + sign) % p + p) % p === 0;
}

export function coveringStrip(k: number, primes: number[], sign: Sign = 1): CoveringStrip {
  const orders = primes.map((p) => multiplicativeOrder(2, p));
  const period = orders.reduce((acc, o) => (o > 0 ? lcm(acc, o) : acc), 1);

  const cells: CoveringCell[] = [];
  const uncovered: number[] = [];

  for (let n = 0; n < period; n++) {
    const divisors = primes.filter((p) => dividesTerm(k, n, sign, p));
    cells.push({ n, divisors });
    if (divisors.length === 0) uncovered.push(n);
  }

  return {
    k,
    sign,
    primes,
    orders,
    period,
    cells,
    complete: uncovered.length === 0,
    uncovered,
  };
}

/**
 * Which n are left uncovered if one prime is removed from the set.
 *
 * This is the negative control, and it matters more than it looks. A test that
 * only asserts "every column is covered" passes just as happily against a buggy
 * implementation that marks everything covered. Removing 19, 37 or 73 from the
 * 78557 set must leave exactly one n exposed; if it does not, the checker is
 * broken rather than the mathematics being remarkable.
 */
export function uncoveredWithout(strip: CoveringStrip, drop: number): number[] {
  const rest = strip.primes.filter((p) => p !== drop);
  const out: number[] = [];
  for (let n = 0; n < strip.period; n++) {
    if (!rest.some((p) => dividesTerm(strip.k, n, strip.sign, p))) out.push(n);
  }
  return out;
}

/** Whether each prime is load-bearing, and by how much. */
export function primeContributions(
  strip: CoveringStrip,
): { prime: number; order: number; covers: number[]; soleCoverFor: number[] }[] {
  return strip.primes.map((p, i) => {
    const covers = strip.cells.filter((c) => c.divisors.includes(p)).map((c) => c.n);
    return {
      prime: p,
      order: strip.orders[i]!,
      covers,
      soleCoverFor: strip.cells.filter((c) => c.divisors.length === 1 && c.divisors[0] === p).map((c) => c.n),
    };
  });
}

// ---------------------------------------------------------------------------
// The two cases this app has entries for.
// ---------------------------------------------------------------------------

export const SIERPINSKI_78557 = {
  k: 78557,
  sign: 1 as Sign,
  primes: [3, 5, 7, 13, 19, 37, 73],
  problemId: 'sierpinski-number',
  label: 'Sierpiński',
  form: 'k \\cdot 2^n + 1',
  proven: '78,557 is a Sierpiński number: every term of the sequence is composite.',
  open: 'Whether it is the smallest. Five candidates below it are still unresolved.',
  namedAfter: "Selfridge's conjecture",
} as const;

export const RIESEL_509203 = {
  k: 509203,
  sign: -1 as Sign,
  primes: [3, 5, 7, 13, 17, 241],
  problemId: 'riesel-number',
  label: 'Riesel',
  form: 'k \\cdot 2^n - 1',
  proven: '509,203 is a Riesel number: every term of the sequence is composite.',
  open: 'Whether it is the smallest. Candidates below it remain unresolved.',
  namedAfter: 'the Riesel problem',
} as const;

export const COVERING_SOURCE = {
  sierpinski: {
    by: 'Selfridge',
    year: 1962,
    note: 'Exhibited the covering set for 78,557.',
    url: 'https://oeis.org/A076336',
  },
  riesel: {
    by: 'Riesel',
    year: 1956,
    note: 'Exhibited the covering set for 509,203.',
    url: 'https://oeis.org/A101036',
  },
} as const;

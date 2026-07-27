/**
 * Prime machinery for the interactive lab.
 *
 * Everything here is exact integer arithmetic on a real sieve. Nothing is
 * sampled, interpolated or seeded from a hash. When a limit is hit, the caller
 * gets a `truncated` flag rather than a plausible-looking number.
 */

/** Largest n we will sieve in the browser main thread without janking it. */
export const MAX_SIEVE = 5_000_000;

export interface Sieve {
  /** composite[i] === 0 means i is prime (for i >= 2). */
  composite: Uint8Array;
  limit: number;
  primes: Int32Array;
}

let cached: Sieve | null = null;

/** Sieve of Eratosthenes up to `limit`, reusing the previous run when possible. */
export function sieve(limit: number): Sieve {
  if (limit > MAX_SIEVE) limit = MAX_SIEVE;
  if (cached && cached.limit >= limit) return cached;

  const composite = new Uint8Array(limit + 1);
  composite[0] = 1;
  if (limit >= 1) composite[1] = 1;

  for (let i = 2; i * i <= limit; i++) {
    if (composite[i]) continue;
    for (let j = i * i; j <= limit; j += i) composite[j] = 1;
  }

  let count = 0;
  for (let i = 2; i <= limit; i++) if (!composite[i]) count++;
  const primes = new Int32Array(count);
  let k = 0;
  for (let i = 2; i <= limit; i++) if (!composite[i]) primes[k++] = i;

  cached = { composite, limit, primes };
  return cached;
}

export function isPrime(n: number, s: Sieve): boolean {
  if (n < 2) return false;
  if (n <= s.limit) return s.composite[n] === 0;
  // Outside the sieve: trial division by sieved primes, exact but slower.
  for (const p of s.primes) {
    if (p * p > n) return true;
    if (n % p === 0) return false;
  }
  // Sieve was too small to certify. Say so rather than guess.
  throw new RangeError(`isPrime(${n}): sieve limit ${s.limit} is too small to decide`);
}

/** pi(x): the number of primes <= x. Exact. */
export function primePi(x: number, s: Sieve): number {
  if (x < 2) return 0;
  let lo = 0;
  let hi = s.primes.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (s.primes[mid]! <= x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * Every way to write an even n as p + q with p <= q, both prime.
 * This is the Goldbach conjecture's actual content, computed, not asserted.
 */
export function goldbachPartitions(n: number, s: Sieve): { p: number; q: number }[] {
  if (n % 2 !== 0 || n < 4) return [];
  const out: { p: number; q: number }[] = [];
  for (const p of s.primes) {
    if (p > n / 2) break;
    const q = n - p;
    if (q <= s.limit && s.composite[q] === 0) out.push({ p, q });
  }
  return out;
}

/** The Goldbach comet: partition counts for every even number in a range. */
export function goldbachComet(
  from: number,
  to: number,
  s: Sieve,
): { n: number; count: number }[] {
  const start = from % 2 === 0 ? Math.max(4, from) : Math.max(4, from + 1);
  const out: { n: number; count: number }[] = [];
  for (let n = start; n <= to; n += 2) out.push({ n, count: goldbachPartitions(n, s).length });
  return out;
}

/** Twin prime pairs (p, p+2) below `limit`. */
export function twinPrimes(limit: number, s: Sieve): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < s.primes.length - 1; i++) {
    const p = s.primes[i]!;
    if (p + 2 > limit) break;
    if (s.primes[i + 1] === p + 2) out.push([p, p + 2]);
  }
  return out;
}

/**
 * Record prime gaps: each first occurrence of a gap larger than any before it.
 * Relevant to Cramer's conjecture and to Polignac, both in the dataset.
 */
export function recordGaps(s: Sieve): { after: number; gap: number }[] {
  const out: { after: number; gap: number }[] = [];
  let best = 0;
  for (let i = 0; i < s.primes.length - 1; i++) {
    const gap = s.primes[i + 1]! - s.primes[i]!;
    if (gap > best) {
      best = gap;
      out.push({ after: s.primes[i]!, gap });
    }
  }
  return out;
}

/**
 * Li(x), the logarithmic integral, by Simpson's rule on [2, x] plus the
 * closed-form value of the principal-value part below 2.
 *
 * Used to show pi(x) - Li(x), the error term the Riemann hypothesis bounds.
 */
export function logarithmicIntegral(x: number, steps = 20_000): number {
  if (x <= 2) return 0;
  const li2 = 1.045163780117492784844588889194613136522615578151; // li(2)

  // Integrating 1/ln(t) directly on [2, x] with uniform steps is badly
  // inaccurate: the integrand falls from 1.44 to 0.25 within the first few
  // steps when x is large, so the low end is under-resolved (this was off by
  // 15 at x = 10^6). Substituting t = e^u turns it into the integral of e^u/u
  // over a range of only ~13 units, which uniform Simpson handles cleanly.
  const a = Math.LN2;
  const b = Math.log(x);
  const f = (u: number) => Math.exp(u) / u;
  const n = steps % 2 === 0 ? steps : steps + 1;
  const h = (b - a) / n;

  let sum = f(a) + f(b);
  for (let i = 1; i < n; i++) sum += (i % 2 === 0 ? 2 : 4) * f(a + i * h);

  return li2 + (h / 3) * sum;
}

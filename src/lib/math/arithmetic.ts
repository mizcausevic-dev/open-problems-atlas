/**
 * Multiplicative and additive arithmetic functions, computed exactly.
 *
 * These are the workhorses behind several problems in the dataset — the Mertens
 * function and Robin's inequality both encode the Riemann Hypothesis, Chebyshev's
 * bias is an open question about prime races, Lehmer's totient problem is about
 * phi, and the Ramanujan congruences constrain the partition function.
 *
 * Everything here is computed from a definition by a sieve or a recurrence. Every
 * public function has a published value it is checked against in arithmetic.test.ts;
 * where a value would exceed Number.MAX_SAFE_INTEGER the result is a bigint rather
 * than a silently wrong double.
 *
 * One linear sieve produces smallest-prime-factor, and mu, phi, tau, omega and
 * sigma are read off it. Computing them separately would mean five passes and
 * five chances to disagree with each other.
 */

/** Largest n we sieve on the main thread. ~5 typed arrays at 4 bytes each. */
export const MAX_ARITH = 2_000_000;

export interface ArithmeticTable {
  limit: number;
  /** Smallest prime factor of n, 0 for n < 2. */
  spf: Int32Array;
  /** Moebius function: 0 if n has a squared prime factor, else (-1)^(number of prime factors). */
  mu: Int8Array;
  /** Euler's totient: how many integers in [1, n] are coprime to n. */
  phi: Int32Array;
  /** Number of divisors of n. */
  tau: Int32Array;
  /** Number of DISTINCT prime factors of n. */
  omega: Int8Array;
  /** Sum of divisors of n. */
  sigma: Float64Array;
  /** Primes up to limit, ascending. */
  primes: Int32Array;
}

let cached: ArithmeticTable | null = null;

/**
 * Linear sieve computing every function above in one pass.
 *
 * Each composite is struck exactly once, by its smallest prime factor, which is
 * what makes it linear rather than n log log n. The multiplicative step splits on
 * whether p divides i, because that is exactly when i*p is NOT coprime to p and
 * the simple multiplicative identity f(ab) = f(a)f(b) does not apply.
 */
export function arithmeticTable(limit: number): ArithmeticTable {
  const n = Math.max(1, Math.min(limit, MAX_ARITH));
  if (cached && cached.limit >= n) return cached;

  const spf = new Int32Array(n + 1);
  const mu = new Int8Array(n + 1);
  const phi = new Int32Array(n + 1);
  const tau = new Int32Array(n + 1);
  const omega = new Int8Array(n + 1);
  const sigma = new Float64Array(n + 1);

  /** Exponent of spf[i] in i, needed to keep tau and sigma multiplicative. */
  const cnt = new Int32Array(n + 1);
  /** n with all factors of spf[n] removed. */
  const rest = new Int32Array(n + 1);

  const primeList: number[] = [];

  if (n >= 1) {
    mu[1] = 1;
    phi[1] = 1;
    tau[1] = 1;
    sigma[1] = 1;
    omega[1] = 0;
    rest[1] = 1;
  }

  for (let i = 2; i <= n; i++) {
    if (spf[i] === 0) {
      spf[i] = i;
      primeList.push(i);
      mu[i] = -1;
      phi[i] = i - 1;
      tau[i] = 2;
      omega[i] = 1;
      sigma[i] = i + 1;
      cnt[i] = 1;
      rest[i] = 1;
    }

    for (const p of primeList) {
      const v = i * p;
      if (p > spf[i]! || v > n) break;
      spf[v] = p;

      if (p === spf[i]!) {
        // p already divides i: the exponent of p grows by one.
        const k = cnt[i]! + 1;
        cnt[v] = k;
        rest[v] = rest[i]!;
        // A repeated prime factor makes mu vanish.
        mu[v] = 0;
        phi[v] = phi[i]! * p;
        omega[v] = omega[i]!;
        tau[v] = (tau[i]! / (cnt[i]! + 1)) * (k + 1);
        // sigma(p^k * m) = sigma(m) * (p^(k+1) - 1)/(p - 1)
        const pk1 = Math.pow(p, k + 1);
        sigma[v] = sigma[rest[i]!]! * ((pk1 - 1) / (p - 1));
      } else {
        // p is new and smaller than every prime factor of i: fully multiplicative step.
        cnt[v] = 1;
        rest[v] = i;
        mu[v] = -mu[i]! as -1 | 0 | 1;
        phi[v] = phi[i]! * (p - 1);
        omega[v] = (omega[i]! + 1) as number;
        tau[v] = tau[i]! * 2;
        sigma[v] = sigma[i]! * (p + 1);
      }
    }
  }

  cached = {
    limit: n,
    spf,
    mu,
    phi,
    tau,
    omega,
    sigma,
    primes: Int32Array.from(primeList),
  };
  return cached;
}

/**
 * Mertens function M(x) = sum of mu(n) for n <= x, as a running series.
 *
 * Its growth is the point: the Mertens conjecture asserted |M(x)| < sqrt(x), which
 * held for every value anyone could check and was disproved by Odlyzko and te Riele
 * in 1985 without exhibiting a single counterexample. The Riemann Hypothesis is
 * equivalent to the weaker M(x) = O(x^(1/2 + e)).
 */
export function mertensSeries(
  limit: number,
  table: ArithmeticTable,
  maxPoints = 1200,
): { x: number; m: number; ratio: number }[] {
  const capped = Math.min(limit, table.limit);
  const step = Math.max(1, Math.ceil(capped / maxPoints));
  const out: { x: number; m: number; ratio: number }[] = [];

  // Downsample by keeping each bucket's most extreme value, not its last one.
  //
  // M(x) is a jagged walk and the whole point of the chart is how far it strays
  // from zero. Taking every k-th value silently drops the peaks between samples,
  // so a reader measures a maximum excursion off the chart that is smaller than
  // the real one — and the caption underneath is about exactly that quantity.
  let running = 0;
  let best: { x: number; m: number } | null = null;

  for (let x = 1; x <= capped; x++) {
    running += table.mu[x]!;
    if (!best || Math.abs(running) > Math.abs(best.m)) best = { x, m: running };

    if (x % step === 0 || x === capped) {
      const point = best ?? { x, m: running };
      out.push({ x: point.x, m: point.m, ratio: point.m / Math.sqrt(point.x) });
      best = null;
    }
  }

  // The endpoint is a fact readers rely on (“M(10^6) = 212”), so it is always
  // present even when the bucket's extreme lies earlier.
  const last = out[out.length - 1];
  if (!last || last.x !== capped) {
    out.push({ x: capped, m: running, ratio: running / Math.sqrt(capped) });
  }
  return out;
}

/** M(x) at a single point. */
export function mertens(x: number, table: ArithmeticTable): number {
  const capped = Math.min(x, table.limit);
  let sum = 0;
  for (let i = 1; i <= capped; i++) sum += table.mu[i]!;
  return sum;
}

/**
 * Chebyshev's bias: the prime race between residue classes mod q.
 *
 * pi(x; q, a) counts primes <= x congruent to a mod q. Primes are "biased" toward
 * non-residues: pi(x; 4, 3) leads pi(x; 4, 1) for the overwhelming majority of x,
 * even though Dirichlet guarantees the two classes have equal density. The first
 * x where the 4,1 class takes the lead is 26861 (Leech, 1957), and whether the
 * lead changes infinitely often is settled, but the density of the set where 4,3
 * leads is conditional on RH and the Grand Simplicity Hypothesis.
 */
export function primeRace(
  limit: number,
  q: number,
  a: number,
  b: number,
  table: ArithmeticTable,
  maxPoints = 1200,
): { x: number; countA: number; countB: number; lead: number }[] {
  const capped = Math.min(limit, table.limit);
  const step = Math.max(1, Math.ceil(capped / maxPoints));
  const out: { x: number; countA: number; countB: number; lead: number }[] = [];

  // Keep each bucket's MINIMUM lead, not the value that happens to land on the
  // sample boundary.
  //
  // Lead changes are brief — the 4k+1 class takes the lead at 26,861 and loses
  // it again quickly — so sampling on a fixed stride steps straight over them.
  // The chart then showed the 4k+3 class leading at 100% of points while the
  // panel beside it reported the first lead change at 26,861. Taking the
  // minimum makes a crossover impossible to hide: if the lead ever went to zero
  // or below inside a bucket, that is the point that gets drawn.
  let countA = 0;
  let countB = 0;
  let bucketEnd = step;
  let worst: { x: number; countA: number; countB: number; lead: number } | null = null;

  const consider = (x: number) => {
    const lead = countA - countB;
    if (!worst || lead < worst.lead) worst = { x, countA, countB, lead };
  };

  for (const p of table.primes) {
    if (p > capped) break;
    if (p % q === a) countA++;
    else if (p % q === b) countB++;
    consider(p);

    while (p >= bucketEnd && bucketEnd <= capped) {
      if (worst) out.push(worst);
      worst = null;
      bucketEnd += step;
    }
  }

  if (worst) out.push(worst);
  const last = out[out.length - 1];
  if (!last || last.x !== capped) {
    out.push({ x: capped, countA, countB, lead: countA - countB });
  }
  return out;
}

/**
 * The exact fraction of primes at which class `a` is strictly ahead.
 *
 * Computed over every prime, not over the sampled chart points. Deriving this
 * from the downsampled series is how the UI came to claim the 4k+3 class leads
 * 100% of the time on a range that demonstrably contains a lead change.
 */
export function leadFraction(
  limit: number,
  q: number,
  a: number,
  b: number,
  table: ArithmeticTable,
): { ahead: number; behind: number; tied: number; fractionAhead: number } {
  const capped = Math.min(limit, table.limit);
  let countA = 0;
  let countB = 0;
  let ahead = 0;
  let behind = 0;
  let tied = 0;

  for (const p of table.primes) {
    if (p > capped) break;
    if (p % q === a) countA++;
    else if (p % q === b) countB++;
    else continue; // p = 2 in the mod-4 race belongs to neither class.

    const lead = countA - countB;
    if (lead > 0) ahead++;
    else if (lead < 0) behind++;
    else tied++;
  }

  const total = ahead + behind + tied;
  return { ahead, behind, tied, fractionAhead: total ? ahead / total : 0 };
}

/**
 * The first x at which the trailing class overtakes, or null if it never does
 * within the limit. For (q, a, b) = (4, 3, 1) the published answer is 26861.
 */
export function firstLeadChange(
  limit: number,
  q: number,
  a: number,
  b: number,
  table: ArithmeticTable,
): number | null {
  const capped = Math.min(limit, table.limit);
  let countA = 0;
  let countB = 0;
  for (const p of table.primes) {
    if (p > capped) break;
    if (p % q === a) countA++;
    else if (p % q === b) countB++;
    if (countB > countA) return p;
  }
  return null;
}

/**
 * Partition function p(n) by Euler's pentagonal number theorem:
 *
 *   p(n) = sum over k >= 1 of (-1)^(k+1) [ p(n - g(k)) + p(n - g(-k)) ]
 *
 * where g(k) = k(3k-1)/2 are the generalised pentagonal numbers.
 *
 * Returned as bigint because p(n) outgrows double precision fast: p(416) already
 * exceeds Number.MAX_SAFE_INTEGER. Returning a rounded double there would be
 * wrong in exactly the range where the Ramanujan congruences are interesting.
 */
export function partitions(upTo: number): bigint[] {
  const p: bigint[] = new Array(upTo + 1);
  p[0] = 1n;

  for (let n = 1; n <= upTo; n++) {
    let sum = 0n;
    for (let k = 1; ; k++) {
      const g1 = (k * (3 * k - 1)) / 2;
      const g2 = (k * (3 * k + 1)) / 2;
      if (g1 > n && g2 > n) break;
      const sign = k % 2 === 1 ? 1n : -1n;
      if (g1 <= n) sum += sign * p[n - g1]!;
      if (g2 <= n) sum += sign * p[n - g2]!;
    }
    p[n] = sum;
  }
  return p;
}

/** The largest n whose partition count is still an exact JavaScript number. */
export function largestExactPartitionIndex(p: bigint[]): number {
  const safe = BigInt(Number.MAX_SAFE_INTEGER);
  for (let n = 0; n < p.length; n++) if (p[n]! > safe) return n - 1;
  return p.length - 1;
}

export const ARITHMETIC_SOURCES = {
  mertensDisproof: {
    claim: 'The Mertens conjecture |M(x)| < sqrt(x) is false.',
    by: 'Odlyzko & te Riele',
    year: 1985,
    note: 'Disproved without exhibiting a counterexample; the smallest is known only to exceed 10^16.',
    url: 'https://eudml.org/doc/152640',
  },
  leechLeadChange: {
    claim: 'pi(x; 4, 1) first exceeds pi(x; 4, 3) at x = 26861.',
    by: 'Leech',
    year: 1957,
    url: 'https://oeis.org/A007350',
  },
  ramanujan: {
    claim: 'p(5k+4) = 0 mod 5, p(7k+5) = 0 mod 7, p(11k+6) = 0 mod 11.',
    by: 'Ramanujan',
    year: 1919,
    url: 'https://oeis.org/A000041',
  },
} as const;

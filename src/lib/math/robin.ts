/**
 * Robin's inequality: the Riemann Hypothesis from an elementary angle.
 *
 * Robin (1984) proved that
 *
 *     sigma(n) < e^gamma * n * ln ln n     for every n > 5040
 *
 * is EQUIVALENT to the Riemann Hypothesis. Not implied by, not evidence for:
 * equivalent. One statement is about the zeros of an analytic function in the
 * complex plane, the other is about the sum of the divisors of an integer, and
 * they stand or fall together.
 *
 * That makes it the most checkable thing in this app. Anyone can compute a
 * divisor sum. Finding a single n above 5040 that violates the inequality would
 * disprove the Riemann Hypothesis outright, using nothing but arithmetic.
 *
 * The 27 known exceptions are all at or below 5040 and are reproduced exactly by
 * robinExceptions() — see robin.test.ts, which checks them against the published
 * list (OEIS A067698). If this file is wrong, that test fails.
 */

/** Euler-Mascheroni constant. */
export const EULER_GAMMA = 0.5772156649015328606;

/** e^gamma, the constant on the right-hand side. */
export const E_GAMMA = Math.exp(EULER_GAMMA); // 1.7810724179901979...

/** Largest n we will sieve on the main thread without janking it. */
export const MAX_ROBIN = 2_000_000;

/** Robin's theorem holds unconditionally above this bound; every known exception is at or below it. */
export const ROBIN_BOUND = 5040;

/**
 * sigma(n), the sum of the divisors of n, for every n up to limit.
 *
 * Computed by adding each divisor d to all of its multiples: O(n log n) and
 * exact, with no factorisation needed. Uint32Array is safe here because
 * sigma(n) stays well under 4n across this range.
 */
export function divisorSumSieve(limit: number): Uint32Array {
  const capped = Math.min(limit, MAX_ROBIN);
  const sigma = new Uint32Array(capped + 1);
  for (let d = 1; d <= capped; d++) {
    // Indexed writes on a typed array cannot be out of range here (m <= capped),
    // but noUncheckedIndexedAccess types the read half of += as possibly
    // undefined, so the accumulation is written explicitly.
    for (let m = d; m <= capped; m += d) sigma[m] = (sigma[m] ?? 0) + d;
  }
  return sigma;
}

/**
 * sigma(n) / (n * ln ln n), the quantity Robin's inequality bounds by e^gamma.
 *
 * Undefined at n = 1 (ln ln 1 is -infinity) and negative for n = 2, where
 * ln ln 2 is itself negative. Both are returned honestly rather than clamped:
 * n = 2 really is an exception, and it appears in the published list for
 * exactly this reason.
 */
export function robinRatio(n: number, sigma: Uint32Array): number {
  if (n < 2) return Number.NaN;
  const s = sigma[n];
  if (s === undefined) return Number.NaN;
  return s / (n * Math.log(Math.log(n)));
}

/**
 * Does n violate Robin's inequality, i.e. is sigma(n) >= e^gamma * n * ln ln n?
 *
 * Evaluated as the inequality, not as `ratio >= e^gamma`. Those are not the same
 * test. For n = 2, ln ln 2 is negative, so the right-hand side is negative and
 * sigma(2) = 3 exceeds it — 2 is a genuine exception and appears in the
 * published list. Dividing through by a negative number flips the comparison,
 * so the ratio form silently misses it. It did, until this test caught it.
 */
export function exceedsRobin(n: number, sigma: Uint32Array): boolean {
  if (n < 2) return false;
  const s = sigma[n];
  if (s === undefined) return false;
  return s >= E_GAMMA * n * Math.log(Math.log(n));
}

export interface RobinPoint {
  n: number;
  ratio: number;
  exceeds: boolean;
}

/** Sample the ratio across a range, for plotting. Never returns more than maxPoints. */
export function robinSeries(from: number, to: number, sigma: Uint32Array, maxPoints = 1200): RobinPoint[] {
  const start = Math.max(2, from);
  // ceil, not floor: flooring the step overshoots the point budget, because
  // the count is (span / step) + 1 and a smaller step means more points.
  const step = Math.max(1, Math.ceil((to - start) / maxPoints));
  const out: RobinPoint[] = [];
  for (let n = start; n <= to; n += step) {
    const ratio = robinRatio(n, sigma);
    if (Number.isFinite(ratio)) out.push({ n, ratio, exceeds: exceedsRobin(n, sigma) });
  }
  return out;
}

/**
 * Every n in [2, limit] that violates the inequality.
 *
 * Scans every integer, not a sample: an exception found by sampling would be a
 * coincidence, and one missed by sampling would be the whole point.
 */
export function robinExceptions(limit: number, sigma: Uint32Array): number[] {
  const out: number[] = [];
  const capped = Math.min(limit, sigma.length - 1);
  for (let n = 2; n <= capped; n++) if (exceedsRobin(n, sigma)) out.push(n);
  return out;
}

/**
 * Colossally abundant numbers are where the ratio peaks, so they are the only
 * plausible place a counterexample could hide. Superior highly composite
 * numbers through 10^6, useful as "try these" presets in the UI.
 */
export const NEAR_MISSES = [5040, 10080, 55440, 720720, 1441440] as const;

/** The published exception list, for display alongside the computed one. */
export const KNOWN_EXCEPTIONS = [
  2, 3, 4, 5, 6, 8, 9, 10, 12, 16, 18, 20, 24, 30, 36, 48, 60, 72, 84, 120, 180, 240, 360, 720,
  840, 2520, 5040,
] as const;

export const ROBIN_SOURCE = {
  author: 'Guy Robin',
  year: 1984,
  title: 'Grandes valeurs de la fonction somme des diviseurs et hypothèse de Riemann',
  journal: 'Journal de Mathématiques Pures et Appliquées 63, 187–213',
  oeis: 'A067698',
  oeisUrl: 'https://oeis.org/A067698',
} as const;

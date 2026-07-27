/**
 * Collatz orbits, computed exactly.
 *
 * The one subtlety worth naming: 3n+1 grows fast, and JavaScript numbers stop
 * being exact integers above 2^53. Starting values under ten million peak
 * around 1.6e11, comfortably inside that, but a user can type anything into
 * the input. So every step checks Number.isSafeInteger and the result carries
 * an `exact` flag. An orbit that left the safe range is reported as inexact
 * rather than quietly plotted as if it were fine.
 */

export interface Orbit {
  start: number;
  /** The full trajectory including the starting value and the terminating 1. */
  path: number[];
  /** Total steps to reach 1. Also called total stopping time. */
  steps: number;
  /** Largest value reached. */
  peak: number;
  /** Index in `path` at which the peak occurs. */
  peakAt: number;
  /** Steps to first fall below the starting value. Undefined if it never does. */
  glideSteps?: number;
  /** False if any step exceeded Number.MAX_SAFE_INTEGER. */
  exact: boolean;
  /** True if the step cap was hit before reaching 1. */
  truncated: boolean;
}

export const MAX_STEPS = 10_000;

export function orbit(start: number, maxSteps = MAX_STEPS): Orbit {
  if (!Number.isInteger(start) || start < 1) {
    throw new RangeError('Collatz orbits are defined for positive integers');
  }

  const path: number[] = [start];
  let n = start;
  let peak = start;
  let peakAt = 0;
  let glideSteps: number | undefined;
  let exact = true;
  let truncated = false;

  for (let i = 0; n !== 1; i++) {
    if (i >= maxSteps) {
      truncated = true;
      break;
    }
    n = n % 2 === 0 ? n / 2 : 3 * n + 1;
    if (!Number.isSafeInteger(n)) exact = false;
    path.push(n);
    if (n > peak) {
      peak = n;
      peakAt = path.length - 1;
    }
    if (glideSteps === undefined && n < start) glideSteps = path.length - 1;
  }

  return {
    start,
    path,
    steps: path.length - 1,
    peak,
    peakAt,
    ...(glideSteps !== undefined ? { glideSteps } : {}),
    exact,
    truncated,
  };
}

/** Total stopping time for every start in [from, to]. Used for the scatter plot. */
export function stoppingTimes(from: number, to: number): { n: number; steps: number }[] {
  const out: { n: number; steps: number }[] = [];
  const memo = new Map<number, number>();
  memo.set(1, 0);

  for (let start = Math.max(1, from); start <= to; start++) {
    // Walk forward collecting unseen values, then unwind to fill the memo.
    const stack: number[] = [];
    let n = start;
    while (!memo.has(n)) {
      stack.push(n);
      n = n % 2 === 0 ? n / 2 : 3 * n + 1;
      if (!Number.isSafeInteger(n)) break;
    }
    let steps = memo.get(n) ?? 0;
    while (stack.length) {
      const v = stack.pop()!;
      steps += 1;
      // Only memoise values inside the requested range plus a margin, or the
      // map grows without bound over a wide sweep.
      if (v <= to * 4) memo.set(v, steps);
    }
    out.push({ n: start, steps });
  }
  return out;
}

/**
 * The known verification frontier, as a fact with a source rather than a vibe.
 * Displayed in the lab next to "your browser has checked N of these".
 */
export const VERIFIED_UP_TO = {
  bound: 2.95e20,
  label: '2.95 x 10^20',
  by: 'Barina',
  year: 2020,
  note: 'Convergence verified by exhaustive computation for every start below this bound.',
  url: 'https://doi.org/10.1007/s11227-020-03368-x',
} as const;

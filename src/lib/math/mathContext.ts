/**
 * The evaluation context that makes the expression engine useful *here*.
 *
 * A general-purpose plotter with sin, cos and sqrt is a pocket calculator, and
 * this app has no reason to ship one. What makes it worth having is that the
 * function library is the app's own kernels: sigma, the Moebius function, the
 * Mertens summatory, prime counting, the logarithmic integral, Riemann-Siegel Z.
 * With those in scope, typing an expression is a way to interrogate the problems
 * in the dataset rather than a way to draw a parabola.
 *
 *   sigma(n)/(n*ln(ln(n)))   is Robin's inequality, and it is equivalent to RH
 *   M(n)/sqrt(n)             is the Mertens conjecture, which is false
 *   primeCount(x) - li(x)    is the error term RH would bound
 *
 * Every function is exact on its domain and refuses input outside it. The
 * integer-domain ones reject fractional input rather than rounding into a value
 * they are not defined on, which the expression evaluator enforces centrally.
 */

import type { FunctionSpec } from './expression';
import { arithmeticTable, type ArithmeticTable } from './arithmetic';
import { sieve, primePi, logarithmicIntegral, goldbachPartitions, type Sieve } from './primes';
import { zeta as complexZeta, zFunction } from './zeta';
import { orbit } from './collatz';

/** Largest n any injected function will answer for. Sampling is capped to match. */
export const CONTEXT_LIMIT = 500_000;

export interface MathContext {
  functions: Record<string, FunctionSpec>;
  table: ArithmeticTable;
  sieve: Sieve;
  limit: number;
}

/** Running sum of mu, so M(n) is a lookup rather than an O(n) sum per sample. */
function mertensPrefix(table: ArithmeticTable): Int32Array {
  const m = new Int32Array(table.limit + 1);
  let running = 0;
  for (let n = 1; n <= table.limit; n++) {
    running += table.mu[n]!;
    m[n] = running;
  }
  return m;
}

let cached: MathContext | null = null;

export function buildMathContext(limit = CONTEXT_LIMIT): MathContext {
  if (cached && cached.limit >= limit) return cached;

  const capped = Math.min(limit, CONTEXT_LIMIT);
  const table = arithmeticTable(capped);
  const s = sieve(capped);
  const mertens = mertensPrefix(table);

  /** Guard shared by every table-backed function: in range, or an honest error. */
  const lookup = (name: string, n: number, max: number): number => {
    if (n < 1 || n > max) {
      throw new RangeError(`${name} is tabulated for 1 to ${max.toLocaleString()}; got ${n}.`);
    }
    return n;
  };

  const functions: Record<string, FunctionSpec> = {
    sigma: {
      arity: 1,
      integerDomain: true,
      fn: (n) => table.sigma[lookup('sigma', n!, table.limit)]!,
      help: 'sum of the divisors of n',
    },
    totient: {
      arity: 1,
      integerDomain: true,
      fn: (n) => table.phi[lookup('totient', n!, table.limit)]!,
      help: "Euler's totient: integers up to n coprime to n",
    },
    mu: {
      arity: 1,
      integerDomain: true,
      fn: (n) => table.mu[lookup('mu', n!, table.limit)]!,
      help: 'Moebius function: 0, 1 or -1',
    },
    tau: {
      arity: 1,
      integerDomain: true,
      fn: (n) => table.tau[lookup('tau', n!, table.limit)]!,
      help: 'number of divisors of n',
    },
    omega: {
      arity: 1,
      integerDomain: true,
      fn: (n) => table.omega[lookup('omega', n!, table.limit)]!,
      help: 'number of distinct prime factors of n',
    },
    M: {
      arity: 1,
      integerDomain: true,
      fn: (n) => mertens[lookup('M', n!, table.limit)]!,
      help: 'Mertens function: the running sum of mu',
    },
    primeCount: {
      arity: 1,
      fn: (x) => primePi(Math.min(x!, s.limit), s),
      help: 'pi(x): how many primes are at most x',
    },
    isPrime: {
      arity: 1,
      integerDomain: true,
      fn: (n) => (n! >= 2 && n! <= s.limit && s.composite[n!] === 0 ? 1 : 0),
      help: '1 if n is prime, else 0',
    },
    li: {
      arity: 1,
      // Simpson quadrature is the expensive one here, so it gets fewer steps
      // than the standalone kernel: a plot calls it ~900 times per redraw.
      fn: (x) => (x! <= 2 ? 0 : logarithmicIntegral(x!, 2000)),
      help: 'logarithmic integral li(x)',
    },
    zeta: {
      arity: 1,
      // The eta series this is built on converges only for Re(s) > 0, so the
      // left half-plane is refused rather than silently returning a wrong value
      // from a formula that does not apply there.
      fn: (x) => (x! <= 0 ? Number.NaN : complexZeta({ re: x!, im: 0 }).re),
      help: 'Riemann zeta on the real axis, x > 0',
    },
    Z: {
      arity: 1,
      fn: (t) => zFunction(t!),
      help: 'Riemann-Siegel Z: real, and zero exactly at the critical-line zeros',
    },
    collatz: {
      arity: 1,
      integerDomain: true,
      fn: (n) => {
        if (n! < 1 || n! > 1_000_000) {
          throw new RangeError(`collatz is limited to 1 to 1,000,000; got ${n}.`);
        }
        return orbit(n!).steps;
      },
      help: 'total stopping time: steps for n to reach 1',
    },
    goldbach: {
      arity: 1,
      integerDomain: true,
      fn: (n) => goldbachPartitions(Math.min(n!, s.limit), s).length,
      help: 'ways to write an even n as a sum of two primes',
    },
  };

  cached = { functions, table, sieve: s, limit: capped };
  return cached;
}

export interface Preset {
  label: string;
  expression: string;
  /** Which problem in the dataset this interrogates. */
  problemId?: string;
  note: string;
  /** Sensible domain for this expression. */
  from: number;
  to: number;
  integerOnly: boolean;
  /** Horizontal reference line, when the expression is a comparison against a constant. */
  reference?: { value: number; label: string };
}

/**
 * Starting points, each one a real open problem written as an expression.
 *
 * These are the argument for the whole feature: a reader can see the conjecture
 * as a formula, change it, and watch what happens.
 */
export const PLOT_PRESETS: Preset[] = [
  {
    label: "Robin's inequality",
    expression: 'sigma(n)/(n*ln(ln(n)))',
    problemId: 'riemann-hypothesis',
    note: 'Staying below e^γ ≈ 1.781072 for every n > 5040 is equivalent to the Riemann Hypothesis.',
    from: 5041,
    to: 200_000,
    integerOnly: true,
    reference: { value: Math.exp(0.5772156649015329), label: 'e^γ' },
  },
  {
    label: 'Mertens conjecture',
    expression: 'M(n)/sqrt(n)',
    problemId: 'riemann-hypothesis',
    note: 'Mertens claimed this stays inside ±1. It does here. It is false anyway — disproved in 1985.',
    from: 2,
    to: 200_000,
    integerOnly: true,
    reference: { value: 1, label: '+1' },
  },
  {
    label: 'Prime counting error',
    expression: 'primeCount(x) - li(x)',
    problemId: 'riemann-hypothesis',
    note: 'The error term the Riemann Hypothesis bounds. It is negative throughout this range; Littlewood proved it changes sign infinitely often.',
    from: 100,
    to: 200_000,
    integerOnly: false,
    reference: { value: 0, label: '0' },
  },
  {
    label: 'Riemann–Siegel Z',
    expression: 'Z(x)',
    problemId: 'riemann-hypothesis',
    note: 'Real-valued on the critical line. Every axis crossing is a zero of zeta.',
    from: 1,
    to: 80,
    integerOnly: false,
    reference: { value: 0, label: '0' },
  },
  {
    label: 'Totient ratio',
    expression: 'totient(n)/n',
    problemId: 'lehmer-s-totient-problem',
    note: 'φ(n)/n. The lower envelope is driven by primorials; Lehmer asked whether φ(n) can ever divide n − 1 for composite n.',
    from: 2,
    to: 20_000,
    integerOnly: true,
  },
  {
    label: 'Goldbach comet',
    expression: 'goldbach(n)',
    problemId: 'goldbach-s-conjecture',
    note: 'Ways to write each even n as a sum of two primes. The conjecture is that this is never zero.',
    from: 4,
    to: 20_000,
    integerOnly: true,
    reference: { value: 0, label: '0' },
  },
  {
    label: 'Collatz stopping time',
    expression: 'collatz(n)',
    problemId: 'collatz-conjecture',
    note: 'Steps for n to reach 1. That it always terminates is the conjecture.',
    from: 1,
    to: 20_000,
    integerOnly: true,
  },
  {
    label: 'Divisor count',
    expression: 'tau(n)',
    note: 'Number of divisors. The spikes are the highly composite numbers, where Robin’s ratio also peaks.',
    from: 1,
    to: 5_000,
    integerOnly: true,
  },
];

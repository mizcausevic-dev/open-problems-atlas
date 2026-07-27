/**
 * Riemann zeta on and near the critical line.
 *
 * Why this file is more than decoration: the obvious way to "draw the zeta
 * function" is to sum the Dirichlet series 1 + 2^-s + 3^-s + ... for a dozen
 * terms and plot the result. That series does not converge anywhere on the
 * critical line Re(s) = 1/2, so the resulting picture is not the zeta function,
 * it is an artefact of where you stopped summing. It will not pass through the
 * origin at the zeros no matter how nice the caption is.
 *
 * What is done instead:
 *
 *   1. The Dirichlet eta function  eta(s) = sum (-1)^(n-1) n^-s  DOES converge
 *      for Re(s) > 0, and  zeta(s) = eta(s) / (1 - 2^(1-s)).
 *   2. eta converges far too slowly to sum naively, so we use Borwein's
 *      acceleration (P. Borwein, "An Efficient Algorithm for the Riemann Zeta
 *      Function", 1995), which reaches ~15 significant digits in ~30 terms.
 *   3. For plotting we use the Riemann-Siegel Z function, which is real-valued
 *      on the critical line and shares its zeros with zeta there. A real
 *      function crossing the axis is both honest and readable, where a complex
 *      spiral is neither.
 *
 * The zero finder is checked against the first ten published zeros in
 * zeta.test.ts. If this file is wrong, that test fails.
 */

export interface Complex {
  re: number;
  im: number;
}

const cAdd = (a: Complex, b: Complex): Complex => ({ re: a.re + b.re, im: a.im + b.im });
const cSub = (a: Complex, b: Complex): Complex => ({ re: a.re - b.re, im: a.im - b.im });
const cMul = (a: Complex, b: Complex): Complex => ({
  re: a.re * b.re - a.im * b.im,
  im: a.re * b.im + a.im * b.re,
});
const cDiv = (a: Complex, b: Complex): Complex => {
  const d = b.re * b.re + b.im * b.im;
  return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d };
};
export const cAbs = (a: Complex): number => Math.hypot(a.re, a.im);

/** (base)^(-s) for real base > 0, complex s. */
function powNegS(base: number, s: Complex): Complex {
  const lnBase = Math.log(base);
  const mag = Math.exp(-s.re * lnBase);
  const ang = -s.im * lnBase;
  return { re: mag * Math.cos(ang), im: mag * Math.sin(ang) };
}

/**
 * Borwein coefficients d_k for a given term count n.
 *
 *   d_k = n * sum_{i=0..k} (n+i-1)! * 4^i / ((n-i)! * (2i)!)
 *
 * Computed by an incremental ratio so no factorial ever overflows: the ratio
 * between successive summands is (n+i-1)(n-i+1)*4 / ((2i)(2i-1)).
 */
function borweinCoefficients(n: number): number[] {
  const d: number[] = new Array(n + 1);
  let sum = 1; // i = 0 term
  let term = 1;
  d[0] = n * sum;
  for (let i = 1; i <= n; i++) {
    term *= (4 * (n + i - 1) * (n - i + 1)) / (2 * i * (2 * i - 1));
    sum += term;
    d[i] = n * sum;
  }
  return d;
}

/** Cache: the coefficients depend only on n, and n is fixed per precision level. */
const coeffCache = new Map<number, number[]>();
function coefficients(n: number): number[] {
  let c = coeffCache.get(n);
  if (!c) {
    c = borweinCoefficients(n);
    coeffCache.set(n, c);
  }
  return c;
}

/**
 * How many Borwein terms are needed for full double precision at height t.
 *
 * Borwein's error bound carries a factor of e^(pi|t|/2), so a term count that
 * is ample at t = 2 is visibly wrong at t = 44 (this was caught by the
 * |Z| = |zeta| test, which failed by 1.4e-6 with a fixed 32 terms). The linear
 * rule below is the standard one: roughly 1.5 terms per requested digit plus
 * 0.9 terms per unit of height.
 */
export function termsFor(t: number, digits = 17): number {
  return Math.min(200, Math.max(24, Math.ceil(1.5 * digits + 0.9 * Math.abs(t))));
}

/** Dirichlet eta via Borwein acceleration. Valid for Re(s) > 0. */
export function eta(s: Complex, terms = termsFor(s.im)): Complex {
  const d = coefficients(terms);
  const dn = d[terms]!;
  let acc: Complex = { re: 0, im: 0 };
  for (let k = 0; k < terms; k++) {
    const sign = k % 2 === 0 ? 1 : -1;
    const w = sign * (d[k]! - dn);
    const p = powNegS(k + 1, s);
    acc = cAdd(acc, { re: w * p.re, im: w * p.im });
  }
  return { re: -acc.re / dn, im: -acc.im / dn };
}

/**
 * Riemann zeta for Re(s) > 0, s != 1.
 * Uses zeta(s) = eta(s) / (1 - 2^(1-s)).
 */
export function zeta(s: Complex, terms = termsFor(s.im)): Complex {
  const oneMinusS: Complex = { re: 1 - s.re, im: -s.im };
  // 2^(1-s) = exp((1-s) ln 2)
  const mag = Math.exp(oneMinusS.re * Math.LN2);
  const ang = oneMinusS.im * Math.LN2;
  const twoPow: Complex = { re: mag * Math.cos(ang), im: mag * Math.sin(ang) };
  const denom = cSub({ re: 1, im: 0 }, twoPow);
  return cDiv(eta(s, terms), denom);
}

/**
 * Lanczos coefficients (g = 7, n = 9). Standard published set.
 */
const LANCZOS = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
  -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
  1.5056327351493116e-7,
];

const cLog = (z: Complex): Complex => ({ re: Math.log(cAbs(z)), im: Math.atan2(z.im, z.re) });

/**
 * log Gamma for complex z with Re(z) > 0, by the Lanczos approximation.
 * Accurate to roughly 15 significant digits over the range used here.
 */
export function logGamma(z: Complex): Complex {
  const g = 7;
  const zm1: Complex = { re: z.re - 1, im: z.im };

  let x: Complex = { re: LANCZOS[0]!, im: 0 };
  for (let i = 1; i < LANCZOS.length; i++) {
    x = cAdd(x, cDiv({ re: LANCZOS[i]!, im: 0 }, { re: zm1.re + i, im: zm1.im }));
  }

  const t: Complex = { re: zm1.re + g + 0.5, im: zm1.im };
  const half = { re: zm1.re + 0.5, im: zm1.im };

  return cAdd(
    cAdd({ re: 0.5 * Math.log(2 * Math.PI), im: 0 }, cMul(half, cLog(t))),
    cAdd({ re: -t.re, im: -t.im }, cLog(x)),
  );
}

/**
 * Riemann-Siegel theta:  theta(t) = arg Gamma(1/4 + it/2) - (t/2) ln pi.
 *
 * Computed from log Gamma rather than from the usual asymptotic series. The
 * asymptotic form is only good for large t, and findZeros scans from t = 1
 * upward; an inaccurate theta down there can manufacture sign changes that look
 * like zeros. Gamma is shifted up by one via log Gamma(z) = log Gamma(z+1) -
 * log z, because Re(1/4) is below the Lanczos validity threshold.
 */
export function theta(t: number): number {
  const z: Complex = { re: 0.25, im: t / 2 };
  const shifted: Complex = { re: 1.25, im: t / 2 };
  const argGamma = logGamma(shifted).im - cLog(z).im;
  return argGamma - (t / 2) * Math.log(Math.PI);
}

/**
 * Riemann-Siegel Z function: Z(t) = e^(i theta(t)) zeta(1/2 + i t).
 *
 * Z is real for real t, and |Z(t)| = |zeta(1/2 + it)|, so the real zeros of Z
 * on an interval are exactly the zeros of zeta on the critical line there.
 * We return the real part; the imaginary part is zero up to rounding and is
 * asserted small in the tests.
 */
export function zFunction(t: number, terms = termsFor(t)): number {
  const z = zeta({ re: 0.5, im: t }, terms);
  const th = theta(t);
  const rot: Complex = { re: Math.cos(th), im: Math.sin(th) };
  return cMul(rot, z).re;
}

/** |zeta(1/2 + it)|, the modulus plotted alongside Z. */
export function zetaCriticalModulus(t: number, terms = termsFor(t)): number {
  return cAbs(zeta({ re: 0.5, im: t }, terms));
}

/**
 * Locate zeros of Z on [tMin, tMax] by scanning for sign changes, then
 * bisecting each bracket. Bisection is used rather than a faster secant method
 * because it cannot diverge: with a genuine sign change it always converges,
 * which matters more here than the extra few iterations.
 */
export function findZeros(tMin: number, tMax: number, scanStep = 0.05, tolerance = 1e-10): number[] {
  const zeros: number[] = [];
  let prevT = Math.max(tMin, 0.5);
  let prevZ = zFunction(prevT);

  for (let t = prevT + scanStep; t <= tMax; t += scanStep) {
    const z = zFunction(t);
    if (prevZ === 0) zeros.push(prevT);
    else if (prevZ * z < 0) {
      let lo = prevT;
      let hi = t;
      let loZ = prevZ;
      while (hi - lo > tolerance) {
        const mid = (lo + hi) / 2;
        const midZ = zFunction(mid);
        if (midZ === 0) {
          lo = hi = mid;
          break;
        }
        if (loZ * midZ < 0) hi = mid;
        else {
          lo = mid;
          loZ = midZ;
        }
      }
      zeros.push((lo + hi) / 2);
    }
    prevT = t;
    prevZ = z;
  }
  return zeros;
}

/**
 * Riemann-von Mangoldt: the expected number of zeros with 0 < Im(rho) < t.
 *
 *   N(t) ~ (t / 2pi) ln(t / 2pi) - t / 2pi + 7/8
 *
 * Comparing this against the count actually found is a real check that the
 * zero finder is not skipping zeros, and it is shown in the UI as such.
 */
export function expectedZeroCount(t: number): number {
  if (t <= 0) return 0;
  const x = t / (2 * Math.PI);
  return x * Math.log(x) - x + 7 / 8;
}

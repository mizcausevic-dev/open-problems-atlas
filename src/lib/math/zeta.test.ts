import { describe, it, expect } from 'vitest';
import { zeta, eta, zFunction, findZeros, expectedZeroCount, cAbs } from './zeta';

/**
 * The first ten nontrivial zeros of the Riemann zeta function, imaginary parts.
 * Published values (Odlyzko's tables; also in Edwards, "Riemann's Zeta
 * Function"). These are the ground truth this implementation is checked
 * against. If the Borwein/eta path or the Riemann-Siegel theta expansion is
 * wrong, these assertions fail.
 */
const KNOWN_ZEROS = [
  14.134725141734693,
  21.022039638771554,
  25.010857580145688,
  30.424876125859513,
  32.935061587739189,
  37.586178158825671,
  40.918719012147495,
  43.327073280914999,
  48.005150881167159,
  49.773832477672302,
];

describe('zeta on the real axis', () => {
  it('matches known closed forms', () => {
    // zeta(2) = pi^2 / 6
    expect(zeta({ re: 2, im: 0 }).re).toBeCloseTo(Math.PI ** 2 / 6, 10);
    // zeta(4) = pi^4 / 90
    expect(zeta({ re: 4, im: 0 }).re).toBeCloseTo(Math.PI ** 4 / 90, 10);
    // zeta(6) = pi^6 / 945
    expect(zeta({ re: 6, im: 0 }).re).toBeCloseTo(Math.PI ** 6 / 945, 10);
  });

  it('matches the known value at s = 1/2', () => {
    // zeta(1/2) = -1.4603545088095868...  (OEIS A059750)
    expect(zeta({ re: 0.5, im: 0 }).re).toBeCloseTo(-1.4603545088095868, 9);
  });

  it('eta(1) = ln 2', () => {
    expect(eta({ re: 1, im: 0 }).re).toBeCloseTo(Math.LN2, 12);
  });

  it('is real on the real axis', () => {
    expect(Math.abs(zeta({ re: 3, im: 0 }).im)).toBeLessThan(1e-12);
  });
});

describe('Riemann-Siegel Z', () => {
  it('is (numerically) real: |zeta| equals |Z| on the critical line', () => {
    for (const t of [15, 20.5, 27, 35.25, 44]) {
      const modulus = cAbs(zeta({ re: 0.5, im: t }));
      expect(Math.abs(zFunction(t))).toBeCloseTo(modulus, 9);
    }
  });

  it('vanishes at each published zero', () => {
    for (const t of KNOWN_ZEROS) {
      expect(Math.abs(zFunction(t))).toBeLessThan(1e-7);
    }
  });

  it('does not vanish between zeros', () => {
    // Midpoints of consecutive zeros must be comfortably away from the axis.
    for (let i = 0; i < KNOWN_ZEROS.length - 1; i++) {
      const mid = (KNOWN_ZEROS[i]! + KNOWN_ZEROS[i + 1]!) / 2;
      expect(Math.abs(zFunction(mid))).toBeGreaterThan(1e-3);
    }
  });
});

describe('findZeros', () => {
  const found = findZeros(1, 51, 0.05);

  it('finds exactly the ten known zeros below t = 51', () => {
    expect(found).toHaveLength(KNOWN_ZEROS.length);
  });

  it('locates each to 8 decimal places', () => {
    found.forEach((t, i) => {
      expect(t).toBeCloseTo(KNOWN_ZEROS[i]!, 8);
    });
  });

  it('agrees with the Riemann-von Mangoldt count', () => {
    // N(t) is asymptotic, so allow a tolerance of one zero.
    const predicted = expectedZeroCount(51);
    expect(Math.abs(predicted - found.length)).toBeLessThan(1);
  });
});

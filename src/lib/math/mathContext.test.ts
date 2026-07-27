import { describe, it, expect } from 'vitest';
import { buildMathContext, PLOT_PRESETS } from './mathContext';
import { compute, compile, EvalError_, ParseError } from './expression';
import { E_GAMMA } from './robin';
import raw from '../../data/problems.generated.json';
import type { Dataset } from '../../types';

const { problems } = raw as unknown as Dataset;
const ctx = buildMathContext(200_000);
const ev = (src: string) => compute(src, { functions: ctx.functions });

describe('injected arithmetic functions', () => {
  it('agree with hand-computed values', () => {
    expect(ev('sigma(6)')).toBe(12); // 1+2+3+6
    expect(ev('sigma(28)')).toBe(56); // perfect
    expect(ev('totient(10)')).toBe(4);
    expect(ev('totient(100)')).toBe(40);
    expect(ev('tau(12)')).toBe(6);
    expect(ev('omega(30)')).toBe(3); // 2*3*5
    expect(ev('mu(6)')).toBe(1);
    expect(ev('mu(4)')).toBe(0);
    expect(ev('mu(30)')).toBe(-1);
  });

  it('reproduce the published Mertens values', () => {
    expect(ev('M(10)')).toBe(-1);
    expect(ev('M(100)')).toBe(1);
    expect(ev('M(1000)')).toBe(2);
    expect(ev('M(10000)')).toBe(-23);
    expect(ev('M(100000)')).toBe(-48);
  });

  it('count primes correctly', () => {
    expect(ev('primeCount(100)')).toBe(25);
    expect(ev('primeCount(1000)')).toBe(168);
    expect(ev('isPrime(97)')).toBe(1);
    expect(ev('isPrime(91)')).toBe(0); // 7 * 13
  });

  it('compute the Collatz stopping time', () => {
    expect(ev('collatz(27)')).toBe(111);
    expect(ev('collatz(1)')).toBe(0);
  });

  it('count Goldbach partitions', () => {
    expect(ev('goldbach(10)')).toBe(2); // 3+7, 5+5
    expect(ev('goldbach(4)')).toBe(1); // 2+2
  });

  it('evaluate zeta on the real axis', () => {
    expect(ev('zeta(2)')).toBeCloseTo(Math.PI ** 2 / 6, 9);
    expect(ev('zeta(4)')).toBeCloseTo(Math.PI ** 4 / 90, 9);
  });

  it('vanish at the first zero via Z', () => {
    expect(Math.abs(ev('Z(14.134725141734693)'))).toBeLessThan(1e-6);
  });

  it('approximate pi(x) with li(x) to the published accuracy', () => {
    // Published: pi(10^5) = 9,592 and li(10^5) = 9,629.809, so the gap is 37.809.
    // The plot path runs Simpson at 2,000 steps rather than 20,000 for speed;
    // this asserts that shortcut still lands within a thousandth.
    expect(ev('primeCount(100000)')).toBe(9592);
    expect(ev('li(100000)')).toBeCloseTo(9629.809, 2);
    expect(ev('li(100000) - primeCount(100000)')).toBeCloseTo(37.809, 2);
  });
});

describe('domain guards refuse rather than guess', () => {
  it('reject fractional input to integer-domain functions', () => {
    for (const src of ['sigma(2.5)', 'totient(1.1)', 'mu(3.7)', 'M(9.9)', 'collatz(2.5)']) {
      expect(() => ev(src), src).toThrow(/only defined on integers/);
    }
  });

  it('reject arguments outside the tabulated range', () => {
    expect(() => ev('sigma(99999999)')).toThrow(/tabulated/);
    expect(() => ev('M(0)')).toThrow(/tabulated/);
  });

  it('refuse zeta where the series it uses does not converge', () => {
    // The eta-based formula is valid only for Re(s) > 0. Returning a number
    // there would be a wrong answer from a formula that does not apply.
    expect(Number.isNaN(ev('zeta(-1)'))).toBe(true);
    expect(Number.isNaN(ev('zeta(0)'))).toBe(true);
  });

  it('report zeta(1) as divergent rather than as a finite number', () => {
    expect(Number.isFinite(ev('zeta(1)'))).toBe(false);
  });

  it('still reject unknown names with the app functions in scope', () => {
    expect(() => ev('sigmaa(4)')).toThrow(EvalError_);
    expect(() => ev('constructor')).toThrow(EvalError_);
  });

  it('still refuse malformed expressions', () => {
    expect(() => ev('sigma(')).toThrow(ParseError);
  });
});

describe('the conjectures, written as expressions', () => {
  it("Robin's inequality holds above 5040 across the sampled range", () => {
    const f = compile('sigma(n)/(n*ln(ln(n)))', { functions: ctx.functions });
    for (let n = 5041; n <= 200_000; n += 617) {
      expect(f(n), `n = ${n}`).toBeLessThan(E_GAMMA);
    }
  });

  it('exceeds e^gamma at 5040 itself', () => {
    expect(ev('sigma(5040)/(5040*ln(ln(5040)))')).toBeGreaterThan(E_GAMMA);
  });

  it('the Mertens ratio stays inside 1 across the range, though the conjecture is false', () => {
    const f = compile('M(n)/sqrt(n)', { functions: ctx.functions });
    for (let n = 2; n <= 200_000; n += 431) {
      expect(Math.abs(f(n)), `n = ${n}`).toBeLessThan(1);
    }
  });

  it('the prime counting error is negative throughout the range', () => {
    const f = compile('primeCount(x) - li(x)', { functions: ctx.functions });
    for (let x = 1000; x <= 200_000; x += 7919) {
      expect(f(x), `x = ${x}`).toBeLessThan(0);
    }
  });
});

describe('presets', () => {
  it('all parse and evaluate at the midpoint of their range', () => {
    for (const p of PLOT_PRESETS) {
      const mid = p.integerOnly
        ? Math.floor((p.from + p.to) / 2)
        : (p.from + p.to) / 2;
      const f = compile(p.expression, { functions: ctx.functions });
      const y = f(mid);
      expect(Number.isFinite(y), `${p.label} at ${mid} gave ${y}`).toBe(true);
    }
  });

  it('have sane ranges', () => {
    for (const p of PLOT_PRESETS) {
      expect(p.from, p.label).toBeLessThan(p.to);
      expect(p.from, p.label).toBeGreaterThanOrEqual(1);
      expect(p.note.length, p.label).toBeGreaterThan(20);
    }
  });

  it('point only at problems that exist in the dataset', () => {
    // A dead id renders a link to nowhere, which is how curated cross-links rot.
    const ids = new Set(problems.map((x) => x.id));
    for (const p of PLOT_PRESETS) {
      if (p.problemId) expect(ids.has(p.problemId), `${p.label} -> ${p.problemId}`).toBe(true);
    }
  });

  it('have unique labels', () => {
    const labels = PLOT_PRESETS.map((p) => p.label);
    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe('performance', () => {
  it('samples a table-backed expression fast enough to plot interactively', () => {
    const f = compile('sigma(n)/(n*ln(ln(n)))', { functions: ctx.functions });
    const t0 = performance.now();
    for (let i = 0; i < 900; i++) f(5041 + i * 200);
    // 900 samples is one full redraw; it must stay far inside a frame budget.
    expect(performance.now() - t0).toBeLessThan(120);
  });
});

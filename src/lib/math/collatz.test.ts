import { describe, it, expect } from 'vitest';
import { orbit, stoppingTimes } from './collatz';

describe('collatz orbit', () => {
  it('computes the textbook orbit of 27', () => {
    const o = orbit(27);
    // 27 is the standard example: 111 steps, peaking at 9232.
    expect(o.steps).toBe(111);
    expect(o.peak).toBe(9232);
    expect(o.path[0]).toBe(27);
    expect(o.path.at(-1)).toBe(1);
    expect(o.exact).toBe(true);
    expect(o.truncated).toBe(false);
  });

  it('handles the trivial start', () => {
    const o = orbit(1);
    expect(o.steps).toBe(0);
    expect(o.path).toEqual([1]);
  });

  it('follows the rule at every step', () => {
    const o = orbit(97);
    for (let i = 1; i < o.path.length; i++) {
      const prev = o.path[i - 1]!;
      const expected = prev % 2 === 0 ? prev / 2 : 3 * prev + 1;
      expect(o.path[i]).toBe(expected);
    }
  });

  it('reaches 1 for every start below 5000', () => {
    for (let n = 1; n < 5000; n++) {
      const o = orbit(n);
      expect(o.truncated).toBe(false);
      expect(o.path.at(-1)).toBe(1);
    }
  });

  it('reports known record stopping times', () => {
    // First numbers to set a new total-stopping-time record (OEIS A006877).
    expect(orbit(27).steps).toBe(111);
    expect(orbit(97).steps).toBe(118);
    expect(orbit(871).steps).toBe(178);
    expect(orbit(6171).steps).toBe(261);
  });

  it('rejects non-positive and non-integer input rather than guessing', () => {
    expect(() => orbit(0)).toThrow(RangeError);
    expect(() => orbit(-5)).toThrow(RangeError);
    expect(() => orbit(2.5)).toThrow(RangeError);
  });

  it('flags truncation instead of pretending it converged', () => {
    const o = orbit(27, 10);
    expect(o.truncated).toBe(true);
    expect(o.path.at(-1)).not.toBe(1);
  });
});

describe('stoppingTimes', () => {
  it('matches individual orbit computations', () => {
    const swept = stoppingTimes(1, 300);
    expect(swept).toHaveLength(300);
    for (const { n, steps } of swept) {
      expect(steps).toBe(orbit(n).steps);
    }
  });
});

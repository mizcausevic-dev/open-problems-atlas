import { describe, it, expect } from 'vitest';
import {
  samplePlot,
  splitSegments,
  chooseYRange,
  niceTicks,
  formatTick,
  projection,
  segmentPath,
} from './plot';
import { compile } from './math/expression';

describe('samplePlot', () => {
  it('samples a smooth function as one segment', () => {
    const r = samplePlot((x) => x * x, { xMin: -5, xMax: 5, samples: 200 });
    expect(r.samples).toHaveLength(200);
    expect(r.segments).toHaveLength(1);
    expect(r.undefinedCount).toBe(0);
    expect(r.infiniteCount).toBe(0);
  });

  it('does not connect across the poles of tan', () => {
    // The whole point. A naive plotter draws a near-vertical stroke from +inf to
    // -inf at each pole, which is a line tan does not have. Over (-5, 5) tan has
    // poles at -pi/2 and +pi/2, so it must come out as three pieces.
    const r = samplePlot(Math.tan, { xMin: -5, xMax: 5, samples: 2000 });
    expect(r.segments.length).toBeGreaterThanOrEqual(3);

    // And no drawn segment may span a pole.
    for (const seg of r.segments) {
      for (let i = 1; i < seg.length; i++) {
        const a = seg[i - 1]!.y;
        const b = seg[i]!.y;
        const hugeAndFlipped = Math.abs(b - a) > 100 && Math.sign(a) !== Math.sign(b);
        expect(hugeAndFlipped, `jump at x=${seg[i]!.x}`).toBe(false);
      }
    }
  });

  it('leaves a hole where the function is undefined', () => {
    // sqrt is NaN on the negative half. That half must be absent, not drawn at 0.
    const r = samplePlot(Math.sqrt, { xMin: -5, xMax: 5, samples: 201 });
    expect(r.undefinedCount).toBeGreaterThan(90);
    const drawn = r.segments.flat();
    expect(drawn.every((s) => s.x >= 0)).toBe(true);
    expect(drawn.every((s) => Number.isFinite(s.y))).toBe(true);
  });

  it('counts infinities separately from undefined values', () => {
    const r = samplePlot((x) => (x === 0 ? Infinity : 1 / x), { xMin: -1, xMax: 1, samples: 101 });
    expect(r.infiniteCount).toBeGreaterThan(0);
    expect(r.segments.flat().every((s) => Number.isFinite(s.y))).toBe(true);
  });

  it('reports a thrown error instead of pretending the function is undefined', () => {
    const r = samplePlot(
      (x) => {
        if (x > 0) throw new Error('sigma is only defined on integers');
        return x;
      },
      { xMin: -1, xMax: 1, samples: 21 },
    );
    expect(r.threw).toBe(true);
    expect(r.error).toContain('integers');
  });

  it('samples only integers when asked', () => {
    const r = samplePlot((n) => n * 2, { xMin: 1, xMax: 10, samples: 100, integerOnly: true });
    expect(r.samples.every((s) => Number.isInteger(s.x))).toBe(true);
    expect(r.samples[0]!.x).toBe(1);
    expect(r.samples.at(-1)!.x).toBe(10);
  });

  it('works with a compiled expression', () => {
    const r = samplePlot(compile('sin(x)/x'), { xMin: -20, xMax: 20, samples: 400 });
    expect(r.segments.length).toBeGreaterThan(0);
    // sinc is continuous away from 0 and bounded by 1.
    for (const s of r.segments.flat()) expect(Math.abs(s.y)).toBeLessThanOrEqual(1.001);
  });
});

describe('splitSegments', () => {
  it('keeps a flat line in one piece', () => {
    // Median step is 0 here; a naive threshold of median*factor = 0 would split
    // at every sample.
    const flat = Array.from({ length: 50 }, (_, i) => ({ x: i, y: 7 }));
    expect(splitSegments(flat)).toHaveLength(1);
  });

  it('does not split a steep but continuous curve', () => {
    const steep = Array.from({ length: 200 }, (_, i) => {
      const x = i / 10;
      return { x, y: Math.exp(x) };
    });
    expect(splitSegments(steep)).toHaveLength(1);
  });

  it('splits on a sign-flipping jump', () => {
    const jumpy = [
      { x: 0, y: 1 },
      { x: 1, y: 2 },
      { x: 2, y: 3 },
      { x: 3, y: -900 },
      { x: 4, y: -899 },
    ];
    expect(splitSegments(jumpy, 5).length).toBe(2);
  });

  it('handles empty and single-point input', () => {
    expect(splitSegments([])).toEqual([]);
    expect(splitSegments([{ x: 0, y: 0 }])).toEqual([[{ x: 0, y: 0 }]]);
    expect(splitSegments([{ x: 0, y: NaN }])).toEqual([]);
  });
});

describe('chooseYRange', () => {
  it('ignores a single wild outlier', () => {
    // 99 points in [0, 1] and one at a million. A [min, max] range would flatten
    // the real data into a line along the bottom.
    const samples = Array.from({ length: 99 }, (_, i) => ({ x: i, y: i / 99 }));
    samples.push({ x: 99, y: 1e6 });

    const r = chooseYRange(samples);
    expect(r.max).toBeLessThan(10);
    expect(r.clipped).toBe(true);
    expect(r.clippedCount).toBeGreaterThan(0);
  });

  it('does not claim to clip when it does not', () => {
    const samples = Array.from({ length: 100 }, (_, i) => ({ x: i, y: Math.sin(i / 10) }));
    const r = chooseYRange(samples, { percentile: 0 });
    expect(r.clipped).toBe(false);
    expect(r.clippedCount).toBe(0);
  });

  it('gives a constant function room to breathe', () => {
    const r = chooseYRange(Array.from({ length: 20 }, (_, i) => ({ x: i, y: 5 })));
    expect(r.min).toBeLessThan(5);
    expect(r.max).toBeGreaterThan(5);
  });

  it('centres on zero when asked', () => {
    const samples = [{ x: 0, y: -2 }, { x: 1, y: 8 }];
    const r = chooseYRange(samples, { percentile: 0, symmetric: true });
    expect(r.min).toBeCloseTo(-r.max, 10);
  });

  it('survives an all-NaN input', () => {
    const r = chooseYRange([{ x: 0, y: NaN }, { x: 1, y: NaN }]);
    expect(Number.isFinite(r.min)).toBe(true);
    expect(Number.isFinite(r.max)).toBe(true);
    expect(r.min).toBeLessThan(r.max);
  });
});

describe('niceTicks', () => {
  it('produces round numbers', () => {
    expect(niceTicks(0, 10, 5)).toEqual([0, 2, 4, 6, 8, 10]);
    expect(niceTicks(0, 1, 5)).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1]);
  });

  it('carries no floating point dust', () => {
    for (const t of niceTicks(0, 1, 10)) {
      expect(String(t).length, `tick ${t}`).toBeLessThan(8);
    }
  });

  it('stays inside the range', () => {
    for (const t of niceTicks(-3.7, 12.4)) {
      expect(t).toBeGreaterThanOrEqual(-3.7);
      expect(t).toBeLessThanOrEqual(12.4);
    }
  });

  it('returns nothing for a degenerate range', () => {
    expect(niceTicks(5, 5)).toEqual([]);
    expect(niceTicks(10, 1)).toEqual([]);
    expect(niceTicks(NaN, 1)).toEqual([]);
  });
});

describe('formatTick', () => {
  it('formats compactly across magnitudes', () => {
    expect(formatTick(0)).toBe('0');
    expect(formatTick(-12)).toBe('-12');
    expect(formatTick(1234)).toBe('1234');
    expect(formatTick(25_000)).toBe('25k');
    expect(formatTick(3_400_000)).toBe('3.4M');
    expect(formatTick(0.004)).toBe('0.004');
    expect(formatTick(1e-9)).toBe('1.0e-9');
  });
});

describe('projection and paths', () => {
  const p = projection({ min: 0, max: 10 }, { min: 0, max: 100 }, 200, 100);

  it('maps the corners correctly, with y flipped for SVG', () => {
    expect(p.toX(0)).toBe(0);
    expect(p.toX(10)).toBe(200);
    expect(p.toY(0)).toBe(100); // bottom
    expect(p.toY(100)).toBe(0); // top
  });

  it('builds a path that starts with a move and continues with lines', () => {
    const d = segmentPath([{ x: 0, y: 0 }, { x: 5, y: 50 }, { x: 10, y: 100 }], p);
    expect(d.startsWith('M0.00,100.00')).toBe(true);
    expect((d.match(/L/g) ?? []).length).toBe(2);
  });

  it('renders a single point visibly rather than emitting nothing', () => {
    expect(segmentPath([{ x: 5, y: 50 }], p)).toContain('M');
  });

  it('returns an empty string for an empty segment', () => {
    expect(segmentPath([], p)).toBe('');
  });
});

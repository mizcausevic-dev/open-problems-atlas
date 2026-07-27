import { describe, it, expect } from 'vitest';
import { squarify, usableTreemap, MIN_CELL_PX, type TreemapItem } from './treemap';
import raw from '../data/problems.generated.json';
import type { Dataset } from '../types';

const { problems } = raw as unknown as Dataset;

const W = 800;
const H = 400;

/** The real shape of the problem: 14 fields, counts from 1 to 172. */
const REAL: TreemapItem<string>[] = [
  { value: 172, data: 'Number theory' },
  { value: 106, data: 'Geometry' },
  { value: 80, data: 'Graph theory' },
  { value: 54, data: 'Algebra' },
  { value: 26, data: 'Topology' },
  { value: 25, data: 'Combinatorics' },
  { value: 23, data: 'Dynamical systems' },
  { value: 20, data: 'Uncategorised' },
  { value: 20, data: 'Analysis' },
  { value: 18, data: 'Model theory' },
  { value: 16, data: 'Games and puzzles' },
  { value: 9, data: 'Set theory' },
  { value: 2, data: 'Theoretical CS' },
  { value: 1, data: 'Probability theory' },
];

describe('squarify', () => {
  const cells = squarify(REAL, W, H);

  it('emits one cell per positive item', () => {
    expect(cells).toHaveLength(REAL.length);
    expect(new Set(cells.map((c) => c.data)).size).toBe(REAL.length);
  });

  it('makes every area proportional to its value', () => {
    // This is the assertion that makes the chart honest. A treemap whose areas
    // do not match its numbers is decoration wearing a chart's clothes.
    const total = REAL.reduce((a, b) => a + b.value, 0);
    for (const c of cells) {
      const expected = (c.value / total) * W * H;
      expect(c.width * c.height, String(c.data)).toBeCloseTo(expected, 4);
    }
  });

  it('tiles the container exactly', () => {
    const covered = cells.reduce((sum, c) => sum + c.width * c.height, 0);
    expect(covered).toBeCloseTo(W * H, 4);
  });

  it('keeps every cell inside the bounds', () => {
    for (const c of cells) {
      expect(c.x, String(c.data)).toBeGreaterThanOrEqual(-1e-9);
      expect(c.y, String(c.data)).toBeGreaterThanOrEqual(-1e-9);
      expect(c.x + c.width, String(c.data)).toBeLessThanOrEqual(W + 1e-9);
      expect(c.y + c.height, String(c.data)).toBeLessThanOrEqual(H + 1e-9);
    }
  });

  it('produces no cell too thin to label or tap', () => {
    // The reason for squarifying rather than slice-and-dice. Anything under
    // ~24px on a side is unusable on a touch screen.
    for (const c of cells) {
      expect(Math.min(c.width, c.height), String(c.data)).toBeGreaterThan(10);
    }
  });

  it('keeps aspect ratios reasonable for all but the smallest cells', () => {
    const big = cells.filter((c) => c.value >= 9);
    for (const c of big) {
      const ratio = Math.max(c.width / c.height, c.height / c.width);
      expect(ratio, `${c.data} aspect`).toBeLessThan(5);
    }
  });

  it('orders cells largest first', () => {
    expect(cells.map((c) => c.value)).toEqual([...cells.map((c) => c.value)].sort((a, b) => b - a));
  });

  it('is deterministic', () => {
    const a = squarify(REAL, W, H);
    const b = squarify(REAL, W, H);
    expect(a).toEqual(b);
  });

  it('handles the degenerate cases without throwing', () => {
    expect(squarify([], W, H)).toEqual([]);
    expect(squarify(REAL, 0, H)).toEqual([]);
    expect(squarify([{ value: 0, data: 'x' }], W, H)).toEqual([]);
    expect(squarify([{ value: 5, data: 'only' }], W, H)).toHaveLength(1);
  });

  it('drops non-positive values rather than emitting inverted rectangles', () => {
    const mixed = squarify([{ value: 10, data: 'a' }, { value: -3, data: 'b' }, { value: 0, data: 'c' }], W, H);
    expect(mixed).toHaveLength(1);
    expect(mixed[0]!.data).toBe('a');
  });
});

describe('usableTreemap', () => {
  /** The distribution the app actually has to render. */
  const LIVE: TreemapItem<string>[] = (() => {
    const map = new Map<string, number>();
    for (const p of problems) map.set(p.field, (map.get(p.field) ?? 0) + 1);
    return [...map.entries()].map(([data, value]) => ({ value, data }));
  })();

  it('never returns a layout containing an untappable cell, at any width', () => {
    // The property that matters, stated directly. It holds for any data and any
    // width, which is why the component asks this function instead of comparing
    // the width against a tuned constant — two different constants were tried
    // and both were wrong for some distribution.
    for (const items of [REAL, LIVE]) {
      for (let w = 200; w <= 1600; w += 20) {
        const layout = usableTreemap(items, w);
        if (!layout) continue;
        for (const c of layout.cells) {
          expect(Math.min(c.width, c.height), `${c.data} at ${w}px`).toBeGreaterThanOrEqual(MIN_CELL_PX);
        }
      }
    }
  });

  it('still lays out area-exactly when it does return a layout', () => {
    const layout = usableTreemap(LIVE, 1200);
    expect(layout).not.toBeNull();
    const total = LIVE.reduce((a, b) => a + b.value, 0);
    for (const c of layout!.cells) {
      expect(c.width * c.height).toBeCloseTo((c.value / total) * 1200 * layout!.height, 3);
    }
  });

  it('declines rather than shrinking cells on a phone', () => {
    // 343px is the content width inside a 375px viewport. With a 178:1 range no
    // honest treemap fits, so the overview shows proportional bars instead.
    expect(usableTreemap(LIVE, 343)).toBeNull();
  });

  it('returns a layout at desktop widths', () => {
    expect(usableTreemap(LIVE, 1100)).not.toBeNull();
  });

  it('handles degenerate input', () => {
    expect(usableTreemap([], 1000)).toBeNull();
    expect(usableTreemap(LIVE, 0)).toBeNull();
    expect(usableTreemap(LIVE, -50)).toBeNull();
  });
});

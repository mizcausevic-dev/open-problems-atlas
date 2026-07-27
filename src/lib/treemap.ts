/**
 * Squarified treemap layout (Bruls, Huizing & van Wijk, 2000).
 *
 * Why squarified rather than the twenty-line slice-and-dice alternative: with
 * 14 fields whose counts run from 1 to 172, slice-and-dice produces slivers.
 * A field with 9 problems becomes a 4-pixel-wide strip that cannot hold its own
 * label and cannot be tapped on a phone. Squarify keeps rectangles close to
 * square, which is both readable and clickable.
 *
 * The layout is deterministic and area-exact: every cell's area is proportional
 * to its value, and the cells exactly tile the container. treemap.test.ts
 * asserts both, because a treemap whose areas do not match its numbers is a
 * chart that lies quietly.
 */

export interface TreemapItem<T> {
  value: number;
  data: T;
}

export interface TreemapCell<T> {
  x: number;
  y: number;
  width: number;
  height: number;
  value: number;
  data: T;
}

interface Free {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Worst aspect ratio in a row laid along a side of length `side`. */
function worstRatio(areas: number[], side: number): number {
  if (areas.length === 0) return Infinity;
  const sum = areas.reduce((a, b) => a + b, 0);
  if (sum === 0 || side === 0) return Infinity;
  const max = Math.max(...areas);
  const min = Math.min(...areas);
  const s2 = sum * sum;
  const w2 = side * side;
  return Math.max((w2 * max) / s2, s2 / (w2 * min));
}

/** Place a finished row along the short side of the free rectangle. */
function layoutRow<T>(
  row: { area: number; item: TreemapItem<T> }[],
  free: Free,
  cells: TreemapCell<T>[],
): Free {
  const rowArea = row.reduce((a, r) => a + r.area, 0);
  const horizontal = free.width >= free.height;

  if (horizontal) {
    // Row occupies a vertical strip of width `thickness` down the left edge.
    const thickness = rowArea / free.height;
    let y = free.y;
    for (const { area, item } of row) {
      const h = area / thickness;
      cells.push({ x: free.x, y, width: thickness, height: h, value: item.value, data: item.data });
      y += h;
    }
    return { x: free.x + thickness, y: free.y, width: free.width - thickness, height: free.height };
  }

  // Row occupies a horizontal strip of height `thickness` along the top edge.
  const thickness = rowArea / free.width;
  let x = free.x;
  for (const { area, item } of row) {
    const w = area / thickness;
    cells.push({ x, y: free.y, width: w, height: thickness, value: item.value, data: item.data });
    x += w;
  }
  return { x: free.x, y: free.y + thickness, width: free.width, height: free.height - thickness };
}

/** Smallest side any cell may have, in CSS pixels. Below this it cannot be tapped. */
export const MIN_CELL_PX = 24;

/**
 * Lay out a treemap only if the result is actually usable at this width.
 *
 * Returns null when no candidate height produces cells that all clear
 * MIN_CELL_PX, and the caller falls back to a different chart.
 *
 * This replaced a tuned width breakpoint, which was the wrong tool twice over.
 * A first guess of 560px was wrong by a wide margin; a measured 820px then
 * passed against the live data but failed against a slightly different
 * distribution, because the answer depends on the *ratio between the largest
 * and smallest values*, not on width alone. Any constant is therefore only
 * correct for one dataset and silently rots when the source article changes.
 *
 * Asking the layout whether it worked cannot rot. Area stays exactly
 * proportional to value in every case: the alternative — inflating small cells
 * to a usable size — would make the chart misstate its own numbers.
 */
export function usableTreemap<T>(
  items: TreemapItem<T>[],
  width: number,
  minCell = MIN_CELL_PX,
  // Shortest first: a chart that fits on screen without scrolling is better
  // than a taller one, so take the flattest aspect that still clears minCell
  // rather than the first that merely works.
  ratios = [0.34, 0.42, 0.52, 0.62, 0.74, 0.88, 1.05],
): { cells: TreemapCell<T>[]; height: number } | null {
  if (width <= 0 || items.length === 0) return null;

  for (const ratio of ratios) {
    const height = Math.round(Math.min(620, Math.max(360, width * ratio)));
    const cells = squarify(items, width, height);
    if (cells.length === 0) continue;
    const smallest = Math.min(...cells.map((c) => Math.min(c.width, c.height)));
    if (smallest >= minCell) return { cells, height };
  }
  return null;
}

export function squarify<T>(
  items: TreemapItem<T>[],
  width: number,
  height: number,
): TreemapCell<T>[] {
  const positive = items.filter((i) => i.value > 0).sort((a, b) => b.value - a.value);
  if (positive.length === 0 || width <= 0 || height <= 0) return [];

  const total = positive.reduce((a, b) => a + b.value, 0);
  const scale = (width * height) / total;

  const cells: TreemapCell<T>[] = [];
  let free: Free = { x: 0, y: 0, width, height };
  let row: { area: number; item: TreemapItem<T> }[] = [];

  for (let i = 0; i < positive.length; i++) {
    const item = positive[i]!;
    const area = item.value * scale;
    const side = Math.min(free.width, free.height);

    const current = row.map((r) => r.area);
    const extended = [...current, area];

    if (row.length === 0 || worstRatio(extended, side) <= worstRatio(current, side)) {
      row.push({ area, item });
    } else {
      free = layoutRow(row, free, cells);
      row = [{ area, item }];
    }
  }

  if (row.length) layoutRow(row, free, cells);
  return cells;
}

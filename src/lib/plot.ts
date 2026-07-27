/**
 * Sampling and range selection for function plots.
 *
 * Pure logic, no React and no SVG strings, so the decisions that make a plot
 * honest or dishonest can be tested directly.
 *
 * Three of those decisions matter more than the rest:
 *
 *   1. A pole is not a line. tan(x) does not shoot from +infinity to -infinity
 *      through the middle of the chart; naive plotters draw that near-vertical
 *      stroke anyway and it is a line the function does not have. Sampling here
 *      splits the curve into segments and refuses to connect across a
 *      discontinuity.
 *
 *   2. The y-range must survive an outlier. A single value of 10^12 next to a
 *      pole flattens everything else to a horizontal line if the range is just
 *      [min, max]. The range is chosen from a percentile band, and when that
 *      clips real data the result says so, so the caller can print it rather
 *      than quietly cropping the graph.
 *
 *   3. NaN is a hole, not a zero. Sampling sqrt(x) over [-5, 5] must leave the
 *      left half empty, not draw it along the axis.
 */

export interface Sample {
  x: number;
  y: number;
}

export interface SampleResult {
  /** Every sample taken, including the non-finite ones, in x order. */
  samples: Sample[];
  /** Contiguous runs of finite, connectable points. */
  segments: Sample[][];
  /** Count of samples that were NaN (outside the domain). */
  undefinedCount: number;
  /** Count of samples that were +/-Infinity. */
  infiniteCount: number;
  /** True when the function threw for at least one input. */
  threw: boolean;
  /** The first error message, if any. */
  error?: string;
}

export interface SampleOptions {
  xMin: number;
  xMax: number;
  /** Base sample count before refinement. */
  samples?: number;
  /** Restrict to integer x. For arithmetic functions that are only defined there. */
  integerOnly?: boolean;
  /**
   * A jump larger than this multiple of the median absolute step is treated as a
   * discontinuity and breaks the segment. Higher = more willing to connect.
   */
  jumpFactor?: number;
}

/**
 * Evaluate `f` across the range, splitting at discontinuities.
 *
 * Discontinuity detection is deliberately statistical rather than analytic: we
 * do not have the symbolic derivative, so a jump is judged against the typical
 * step size across the whole sampled range. That correctly breaks tan(x) at its
 * poles and correctly leaves a steep-but-continuous curve like exp(x) intact.
 */
export function samplePlot(f: (x: number) => number, options: SampleOptions): SampleResult {
  const { xMin, xMax, integerOnly = false, jumpFactor = 12 } = options;
  const count = Math.max(2, options.samples ?? 900);

  const samples: Sample[] = [];
  let undefinedCount = 0;
  let infiniteCount = 0;
  let threw = false;
  let error: string | undefined;

  const evaluateAt = (x: number) => {
    try {
      const y = f(x);
      if (Number.isNaN(y)) undefinedCount++;
      else if (!Number.isFinite(y)) infiniteCount++;
      return y;
    } catch (err) {
      threw = true;
      error ??= err instanceof Error ? err.message : String(err);
      return Number.NaN;
    }
  };

  if (integerOnly) {
    const lo = Math.ceil(xMin);
    const hi = Math.floor(xMax);
    const step = Math.max(1, Math.ceil((hi - lo + 1) / count));
    for (let x = lo; x <= hi; x += step) samples.push({ x, y: evaluateAt(x) });
  } else {
    const step = (xMax - xMin) / (count - 1);
    for (let i = 0; i < count; i++) {
      const x = xMin + i * step;
      samples.push({ x, y: evaluateAt(x) });
    }
  }

  return {
    samples,
    segments: splitSegments(samples, jumpFactor),
    undefinedCount,
    infiniteCount,
    threw,
    ...(error ? { error } : {}),
  };
}

/**
 * Break a sample list into runs that may be drawn as connected paths.
 *
 * A break happens at a non-finite value, or at a step whose magnitude is a large
 * multiple of the median step. The median is used rather than the mean because
 * the mean is dragged upward by exactly the jumps we are trying to detect.
 */
export function splitSegments(samples: Sample[], jumpFactor = 12): Sample[][] {
  const finite = samples.filter((s) => Number.isFinite(s.y));
  if (finite.length < 2) return finite.length === 1 ? [[finite[0]!]] : [];

  const steps: number[] = [];
  for (let i = 1; i < finite.length; i++) {
    steps.push(Math.abs(finite[i]!.y - finite[i - 1]!.y));
  }
  const sorted = [...steps].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
  // With a flat function the median step is 0 and every jump is "infinitely"
  // larger; fall back to an absolute threshold so a flat line stays one segment.
  const threshold = median > 0 ? median * jumpFactor : Infinity;

  const segments: Sample[][] = [];
  let current: Sample[] = [];

  for (let i = 0; i < samples.length; i++) {
    const s = samples[i]!;
    if (!Number.isFinite(s.y)) {
      if (current.length) segments.push(current);
      current = [];
      continue;
    }
    if (current.length) {
      const prev = current[current.length - 1]!;
      const jump = Math.abs(s.y - prev.y);
      // A jump that also changes sign is the signature of a pole. A large jump
      // that keeps its sign is usually just a steep but continuous stretch.
      if (jump > threshold && Math.sign(s.y) !== Math.sign(prev.y)) {
        segments.push(current);
        current = [];
      }
    }
    current.push(s);
  }
  if (current.length) segments.push(current);

  return segments.filter((seg) => seg.length > 0);
}

export interface Range {
  min: number;
  max: number;
  /** True when real data lies outside [min, max] and is being cropped. */
  clipped: boolean;
  /** How many finite samples fall outside the range. */
  clippedCount: number;
}

/**
 * Choose a y-range that shows the shape rather than the outliers.
 *
 * Uses a percentile band, padded, then snapped outward to a round number. When
 * the band excludes real finite data the result is flagged, because a cropped
 * axis that does not admit it is a chart that misleads by omission.
 */
export function chooseYRange(
  samples: Sample[],
  { percentile = 0.02, padding = 0.08, symmetric = false }: {
    percentile?: number;
    padding?: number;
    /** Force the range to be centred on zero. For functions whose sign is the point. */
    symmetric?: boolean;
  } = {},
): Range {
  const ys = samples.map((s) => s.y).filter((y): y is number => Number.isFinite(y));
  if (ys.length === 0) return { min: -1, max: 1, clipped: false, clippedCount: 0 };

  const sorted = [...ys].sort((a, b) => a - b);
  const lowIndex = Math.floor(sorted.length * percentile);
  const highIndex = Math.min(sorted.length - 1, Math.ceil(sorted.length * (1 - percentile)));

  let lo = sorted[lowIndex]!;
  let hi = sorted[highIndex]!;

  if (lo === hi) {
    // A constant function. Give it some room so it does not sit on the edge.
    const magnitude = Math.abs(lo) || 1;
    lo -= magnitude * 0.5;
    hi += magnitude * 0.5;
  }

  const span = hi - lo;
  lo -= span * padding;
  hi += span * padding;

  if (symmetric) {
    const reach = Math.max(Math.abs(lo), Math.abs(hi));
    lo = -reach;
    hi = reach;
  }

  const clippedCount = ys.filter((y) => y < lo || y > hi).length;

  return { min: lo, max: hi, clipped: clippedCount > 0, clippedCount };
}

/** Nicely rounded tick values inside a range, for axis labels. */
export function niceTicks(min: number, max: number, target = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) return [];

  const rawStep = (max - min) / target;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalised = rawStep / magnitude;
  // Snap to 1, 2, 5 or 10 — the steps humans read without effort. The bands are
  // the midpoints between those values, so each raw step goes to its nearest
  // readable neighbour. Getting these wrong is quiet: a raw step of 2 snapping
  // up to 5 gives three ticks where six were asked for, which just looks sparse.
  const step = (normalised < 1.5 ? 1 : normalised < 3 ? 2 : normalised < 7 ? 5 : 10) * magnitude;

  const ticks: number[] = [];
  for (let t = Math.ceil(min / step) * step; t <= max + step * 1e-9; t += step) {
    // Kill floating-point dust like 0.30000000000000004.
    ticks.push(Number(t.toPrecision(12)));
  }
  return ticks;
}

/** Format a tick compactly: 1.2M, 0.004, -12. */
export function formatTick(value: number): string {
  if (value === 0) return '0';
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${(value / 1e9).toFixed(abs >= 1e10 ? 0 : 1)}B`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(abs >= 1e7 ? 0 : 1)}M`;
  if (abs >= 1e4) return `${(value / 1e3).toFixed(0)}k`;
  if (abs >= 1) return String(Number(value.toPrecision(6)));
  if (abs >= 1e-4) return String(Number(value.toPrecision(3)));
  return value.toExponential(1);
}

export interface Projection {
  toX: (x: number) => number;
  toY: (y: number) => number;
}

export function projection(
  xRange: { min: number; max: number },
  yRange: { min: number; max: number },
  width: number,
  height: number,
  pad = 0,
): Projection {
  const xSpan = xRange.max - xRange.min || 1;
  const ySpan = yRange.max - yRange.min || 1;
  return {
    toX: (x) => pad + ((x - xRange.min) / xSpan) * (width - pad * 2),
    // SVG y grows downward; the flip is what makes the chart read the right way up.
    toY: (y) => height - pad - ((y - yRange.min) / ySpan) * (height - pad * 2),
  };
}

/** SVG path data for one connected run of samples. */
export function segmentPath(segment: Sample[], p: Projection): string {
  if (segment.length === 0) return '';
  if (segment.length === 1) {
    // A lone point still deserves to be visible.
    const x = p.toX(segment[0]!.x);
    const y = p.toY(segment[0]!.y);
    return `M${x.toFixed(2)},${y.toFixed(2)}l0.01,0`;
  }
  return segment
    .map((s, i) => `${i === 0 ? 'M' : 'L'}${p.toX(s.x).toFixed(2)},${p.toY(s.y).toFixed(2)}`)
    .join('');
}

/**
 * Per-field visual identity.
 *
 * Colours are a fixed hue per field so a reader learns "teal means number
 * theory" once and it holds across the atlas, the dashboard and the timeline.
 * Hues are spaced around the wheel and every pair below was checked to keep at
 * least 3:1 contrast against both grounds when used as a 2px marker or as text
 * on its own soft background.
 *
 * Colour is never the only channel: every field marker is accompanied by the
 * field name in text, because roughly 1 in 12 men has a colour vision
 * deficiency and a legend keyed purely on hue excludes them.
 */

export interface FieldStyle {
  /** Short label for tight spaces. */
  short: string;
  /** CSS colour, used for the marker and for text on `soft`. */
  hue: number;
}

const FIELDS: Record<string, FieldStyle> = {
  'Number theory': { short: 'Num', hue: 176 },
  Geometry: { short: 'Geo', hue: 262 },
  'Graph theory': { short: 'Graph', hue: 32 },
  Algebra: { short: 'Alg', hue: 210 },
  Analysis: { short: 'Anal', hue: 340 },
  Combinatorics: { short: 'Comb', hue: 96 },
  Topology: { short: 'Top', hue: 300 },
  'Dynamical systems': { short: 'Dyn', hue: 14 },
  'Theoretical computer science': { short: 'TCS', hue: 190 },
  'Model theory and formal languages': { short: 'Model', hue: 240 },
  'Set theory': { short: 'Set', hue: 280 },
  'Probability theory': { short: 'Prob', hue: 120 },
  'Games and puzzles': { short: 'Games', hue: 50 },
  Uncategorised: { short: 'Misc', hue: 0 },
};

const FALLBACK: FieldStyle = { short: 'Other', hue: 0 };

export function fieldStyle(field: string): FieldStyle {
  return FIELDS[field] ?? FALLBACK;
}

/** Saturated marker colour. Readable as a dot or rule on either ground. */
export function fieldColor(field: string, dark: boolean): string {
  const { hue } = fieldStyle(field);
  if (hue === 0) return dark ? '#7f8b98' : '#5b6a75';
  return dark ? `hsl(${hue} 70% 62%)` : `hsl(${hue} 62% 34%)`;
}

/** Low-chroma background for a field chip. */
export function fieldSoft(field: string, dark: boolean): string {
  const { hue } = fieldStyle(field);
  if (hue === 0) return dark ? 'hsl(210 12% 18%)' : 'hsl(210 14% 92%)';
  return dark ? `hsl(${hue} 40% 14%)` : `hsl(${hue} 52% 94%)`;
}

export const STATUS_LABEL: Record<string, string> = {
  open: 'Open',
  solved: 'Solved',
  'partially-solved': 'Partly settled',
};

export const TRACK_LABEL: Record<string, string> = {
  curious: 'Curious',
  reading: 'Reading',
  working: 'Working on it',
  stuck: 'Stuck',
  parked: 'Parked',
};

export const TRACK_HINT: Record<string, string> = {
  curious: 'Noted for later. No commitment.',
  reading: 'Working through the literature.',
  working: 'Actively attempting something.',
  stuck: 'Blocked, and worth recording why.',
  parked: 'Set down deliberately, not abandoned.',
};

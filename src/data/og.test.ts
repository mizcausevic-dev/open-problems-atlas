/**
 * The OG card is a raster. Its numbers cannot be regenerated from the dataset at
 * build time, so they are the one place in this project where a count is frozen
 * into an artefact — the exact failure mode the prerender and the sitemap were
 * written to avoid.
 *
 * This test is the compensating control. The counts below are what `public/og.png`
 * and the `og:image:alt` text in index.html actually say. If the dataset is
 * regenerated and the totals move, this fails and names what has to be redone.
 * Without it, a re-scrape would leave a confident, wrong number on every link
 * ever shared, with nothing anywhere to notice.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import dataset from './problems.generated.json';

/** Frozen at the time public/og.png was rendered, from revision 1366281547. */
const BAKED_INTO_OG_IMAGE = { total: 591, open: 478, solved: 105, partial: 8 };

describe('OG card counts still match the dataset', () => {
  const problems = dataset.problems as { status: string }[];
  const actual = {
    total: problems.length,
    open: problems.filter((p) => p.status === 'open').length,
    solved: problems.filter((p) => p.status === 'solved').length,
    partial: problems.filter((p) => p.status === 'partially-solved').length,
  };

  it('matches the numbers drawn into public/og.png', () => {
    expect(actual).toEqual(BAKED_INTO_OG_IMAGE);
    // If this failed: re-render the card (see scripts/og-image.md), update the
    // constant above, and update og:image:alt in index.html. All three or none.
  });

  it('matches the og:image:alt text, which restates them for screen readers', () => {
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
    const alt = /property="og:image:alt"[\s\S]*?content="([^"]*)"/.exec(html)?.[1] ?? '';
    expect(alt).toContain(`${actual.total} tracked`);
    expect(alt).toContain(`${actual.open} open`);
    expect(alt).toContain(`${actual.solved} solved`);
    expect(alt).toContain(`${actual.partial} partial`);
  });

  it('ships a real 1200x630 PNG, not a placeholder', () => {
    const png = readFileSync(resolve(process.cwd(), 'public/og.png'));
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(630);
  });
});

/**
 * The Lab tool list is declared twice: once in LabView's TOOLS (the tab strip)
 * and once in App's LAB_TOOLS (what the command palette offers). A palette entry
 * pointing at a tool that does not exist silently falls back to the Collatz tab,
 * which looks like the app ignoring you rather than a broken link.
 *
 * Reading the source is the honest way to check this: importing LabView here
 * would pull React and every chart into a unit test for the sake of one array.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { LAB_TOOLS } from '../App';
import { LAB_PROBLEM_IDS } from './collections';

/** Pull the `id: '...'` values out of LabView's TOOLS array. */
function toolIdsFromLabView(): string[] {
  const source = readFileSync(resolve(__dirname, '../views/LabView.tsx'), 'utf8');
  const block = /const TOOLS = \[([\s\S]*?)\] as const;/.exec(source);
  if (!block) throw new Error('Could not find the TOOLS array in LabView.tsx');
  return [...block[1]!.matchAll(/id:\s*'([^']+)'/g)].map((m) => m[1]!);
}

describe('lab tool registry', () => {
  const actual = toolIdsFromLabView();

  it('finds the tabs in the source', () => {
    expect(actual.length).toBeGreaterThan(3);
  });

  it('matches the list the command palette offers, in the same order', () => {
    expect(LAB_TOOLS.map((t) => t.id)).toEqual(actual);
  });

  it('gives every tool a label', () => {
    for (const t of LAB_TOOLS) expect(t.label.length, t.id).toBeGreaterThan(3);
  });

  it('only lets problems point at tools that exist', () => {
    const ids = new Set(actual);
    for (const [problemId, tools] of Object.entries(LAB_PROBLEM_IDS)) {
      for (const tool of tools) {
        expect(ids.has(tool), `${problemId} points at missing lab tool "${tool}"`).toBe(true);
      }
    }
  });
});

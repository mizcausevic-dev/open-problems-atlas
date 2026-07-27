/**
 * Command palette: ranking over everything the app can reach.
 *
 * The whole set is about 620 items — 591 problems, plus views, collections, lab
 * tools and actions — which a linear scan handles inside a frame, so there is no
 * index to build or invalidate.
 *
 * What needs care is the ranking. Substring matching is not enough for this
 * corpus, because the things people type are not substrings of the things they
 * want:
 *
 *   "rh"   should find Riemann hypothesis      (initials)
 *   "npc"  should find P versus NP problem     (initials, skipping stopwords)
 *   "bsd"  should find Birch and Swinnerton-Dyer
 *   "colatz" should still find Collatz         (one typo, subsequence)
 *
 * So the scorer runs tiers, strongest first, and stops at the first that hits.
 * Tiers are separated by wide margins so a weaker match can never outrank a
 * stronger one on tie-breaks alone, which makes each tier auditable on its own.
 */

import type { Problem } from '../types';
import { normalise } from './search';

export type CommandKind = 'problem' | 'view' | 'collection' | 'lab' | 'action';

export interface Command {
  id: string;
  kind: CommandKind;
  title: string;
  /** Shown to the right: the field, the collection blurb, the shortcut. */
  hint?: string;
  /** Extra words that should match. */
  keywords?: string[];
  /** Where it goes, or what it does. Exactly one is set. */
  href?: string;
  run?: () => void;
}

/** Words skipped when building initials, so "P versus NP" yields "pnp" not "pvnp". */
const STOPWORDS = new Set(['the', 'a', 'an', 'of', 'and', 'for', 'in', 'on', 'to', 'versus', 'vs', 'problem', 'conjecture', 'hypothesis', 'theorem']);

/**
 * Initials of the significant words, plus a variant keeping every word.
 *
 * Both are needed: "npc" comes from "NP" + "complete"-ish reading of
 * "P versus NP problem" only if stopwords are dropped, while "bsd" needs
 * "Birch and Swinnerton-Dyer" to drop "and". Keeping both variants costs
 * nothing and avoids guessing which convention a given title follows.
 */
export function initials(title: string): { significant: string; all: string } {
  // Split the ORIGINAL casing, because a word that is already an acronym has to
  // be recognised before it is lowercased. "P versus NP problem" reduced to one
  // letter per word gives "pn", so a user typing the obvious "pnp" misses it
  // entirely. An acronym contributes all of itself, giving "p" + "np" = "pnp".
  const rawWords = title.split(/[^A-Za-zÀ-ÿ0-9]+/).filter(Boolean);

  const piece = (w: string) =>
    w.length >= 2 && w === w.toUpperCase() && /[A-Z]/.test(w)
      ? normalise(w)
      : normalise(w[0]!);

  const significant = rawWords.filter((w) => !STOPWORDS.has(normalise(w)));

  return {
    significant: significant.map(piece).join(''),
    all: rawWords.map(piece).join(''),
  };
}

/** Is `needle` a subsequence of `haystack`? Tolerates typos and abbreviations. */
export function isSubsequence(needle: string, haystack: string): boolean {
  if (!needle) return true;
  let i = 0;
  for (let j = 0; j < haystack.length && i < needle.length; j++) {
    if (haystack[j] === needle[i]) i++;
  }
  return i === needle.length;
}

/** How tightly a subsequence packs into the haystack. 1 = contiguous. */
function subsequenceDensity(needle: string, haystack: string): number {
  let i = 0;
  let first = -1;
  let last = -1;
  for (let j = 0; j < haystack.length && i < needle.length; j++) {
    if (haystack[j] === needle[i]) {
      if (first === -1) first = j;
      last = j;
      i++;
    }
  }
  if (i < needle.length || first === -1) return 0;
  return needle.length / (last - first + 1);
}

/**
 * Score a command against a query. 0 means no match.
 *
 * Tier boundaries are 1000 apart so within-tier tie-breaking can never promote a
 * command past a stronger tier.
 */
export function scoreCommand(command: Command, query: string): number {
  const q = normalise(query).trim();
  if (!q) return 1;

  const title = normalise(command.title);
  const { significant, all } = initials(command.title);

  // Tier 6: exact title.
  if (title === q) return 6000;

  // Tier 5: initials match exactly. "rh", "bsd", "pnp".
  if (q.length >= 2 && (significant === q || all === q)) return 5000 + (100 - Math.min(99, title.length));

  // Tier 4: title starts with the query.
  if (title.startsWith(q)) return 4000 + (100 - Math.min(99, title.length));

  // Tier 3: a word in the title starts with the query.
  const words = title.split(/[^a-z0-9]+/).filter(Boolean);
  if (words.some((w) => w.startsWith(q))) return 3000 + (100 - Math.min(99, title.length));

  // Tier 2: initials start with the query, so "ri" narrows toward "rh".
  if (q.length >= 2 && (significant.startsWith(q) || all.startsWith(q))) return 2500;

  // Tier 2: plain substring anywhere in the title.
  if (title.includes(q)) return 2000 + (100 - Math.min(99, title.length));

  // Tier 1: keyword or hint match.
  if (command.keywords?.some((k) => normalise(k).startsWith(q))) return 1500;
  if (command.keywords?.some((k) => normalise(k).includes(q))) return 1200;
  if (command.hint && normalise(command.hint).includes(q)) return 1100;

  // Tier 0: subsequence, for typos and heavy abbreviation. Density-weighted so
  // "colatz" beats an accidental scatter across a long unrelated title.
  if (q.length >= 3 && isSubsequence(q, title)) {
    const density = subsequenceDensity(q, title);
    if (density > 0.34) return 500 + Math.round(density * 400);
  }

  return 0;
}

/** Actions and views rank above problems at equal score: they are fewer and more often wanted. */
const KIND_BONUS: Record<CommandKind, number> = {
  action: 60,
  view: 50,
  lab: 40,
  collection: 30,
  problem: 0,
};

export interface RankedCommand {
  command: Command;
  score: number;
}

export function rankCommands(commands: Command[], query: string, limit = 30): RankedCommand[] {
  const q = query.trim();
  const out: RankedCommand[] = [];

  for (const command of commands) {
    const score = scoreCommand(command, q);
    if (score === 0) continue;
    out.push({ command, score: score + KIND_BONUS[command.kind] });
  }

  out.sort((a, b) => b.score - a.score || a.command.title.localeCompare(b.command.title));
  return out.slice(0, limit);
}

/**
 * Build the command list.
 *
 * Problems come last in the source array so that with an empty query the
 * palette opens on views and actions rather than on 591 alphabetical problems.
 */
export function buildCommands(
  problems: Problem[],
  navTargets: { id: string; title: string; href: string; kind: CommandKind; hint?: string; keywords?: string[] }[],
  actions: { id: string; title: string; hint?: string; keywords?: string[]; run: () => void }[],
): Command[] {
  return [
    ...navTargets.map((t) => ({
      id: t.id,
      kind: t.kind,
      title: t.title,
      ...(t.hint ? { hint: t.hint } : {}),
      ...(t.keywords ? { keywords: t.keywords } : {}),
      href: t.href,
    })),
    ...actions.map((a) => ({
      id: a.id,
      kind: 'action' as const,
      title: a.title,
      ...(a.hint ? { hint: a.hint } : {}),
      ...(a.keywords ? { keywords: a.keywords } : {}),
      run: a.run,
    })),
    ...problems.map((p) => ({
      id: `problem:${p.id}`,
      kind: 'problem' as const,
      title: p.title,
      hint: p.subfield ? `${p.field} · ${p.subfield}` : p.field,
      ...(p.solvedBy ? { keywords: [p.solvedBy] } : {}),
      href: `#/p/${encodeURIComponent(p.id)}`,
    })),
  ];
}

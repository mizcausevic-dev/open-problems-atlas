/**
 * Related problems.
 *
 * Computed at runtime from relationships the dataset actually records, never
 * from a similarity model or an embedding. Every point of the score below
 * corresponds to something a reader could verify by opening the source article,
 * and each contribution carries a human-readable reason so the UI can say *why*
 * two problems are related rather than asserting that they are.
 *
 * The strongest signal is not shared vocabulary, it is a direct link: when one
 * problem's statement links to the other's article, the source has made the
 * connection explicitly.
 */

import type { Problem } from '../types';

export interface RelatedProblem {
  problem: Problem;
  score: number;
  /** Ordered strongest first. Rendered as the "why" line. */
  reasons: string[];
}

/** Below this, a pairing is coincidence rather than a relationship. */
const MIN_SCORE = 20;

const STOPWORDS = new Set([
  'the', 'a', 'an', 'of', 'for', 'and', 'or', 'in', 'on', 'to', 'is', 'are', 'be', 'that',
  'conjecture', 'problem', 'theorem', 'hypothesis', 'question', 'every', 'any', 'all', 'does',
  'do', 'there', 'with', 'as', 'by', 'from', 'it', 'its', 'can', 'has', 'have',
]);

function titleTokens(p: Problem): Set<string> {
  return new Set(
    p.title
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 3 && !STOPWORDS.has(t)),
  );
}

/** Split "Alantha Newman, Aleksandar Nikolov" into comparable names. */
function solverNames(p: Problem): Set<string> {
  const raw = p.solvedBy ?? p.variants?.find((v) => v.solvedBy)?.solvedBy;
  if (!raw) return new Set();
  return new Set(
    raw
      .split(/,| and /i)
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.length > 3),
  );
}

export function findRelated(target: Problem, all: Problem[], limit = 6): RelatedProblem[] {
  const targetTokens = titleTokens(target);
  const targetSolvers = solverNames(target);
  const targetTopics = new Set(target.relatedTopics ?? []);

  const scored: RelatedProblem[] = [];

  for (const p of all) {
    if (p.id === target.id) continue;

    let score = 0;
    const reasons: string[] = [];

    // Direct structural links from the source article.
    if (p.parentId === target.id) {
      score += 70;
      reasons.push('listed as a sub-case of this');
    } else if (target.parentId === p.id) {
      score += 70;
      reasons.push('this is listed as a sub-case of it');
    } else if (p.parentId && p.parentId === target.parentId) {
      score += 45;
      reasons.push('listed under the same heading');
    }

    // One statement links to the other's article: the source made the link.
    if (target.wikipediaTitle && p.relatedTopics?.includes(target.wikipediaTitle)) {
      score += 50;
      reasons.push('its statement links to this problem');
    }
    if (p.wikipediaTitle && targetTopics.has(p.wikipediaTitle)) {
      score += 50;
      reasons.push('this statement links to it');
    }

    // Shared topic links.
    const sharedTopics = (p.relatedTopics ?? []).filter((t) => targetTopics.has(t));
    if (sharedTopics.length) {
      score += Math.min(36, sharedTopics.length * 18);
      reasons.push(
        sharedTopics.length === 1
          ? `both reference ${sharedTopics[0]}`
          : `${sharedTopics.length} shared topics`,
      );
    }

    // Same people settled them.
    const solvers = solverNames(p);
    const sharedSolvers = [...targetSolvers].filter((s) => solvers.has(s));
    if (sharedSolvers.length) {
      score += 40;
      reasons.push('settled by the same people');
    }

    // Classification.
    if (target.subfield && p.subfield === target.subfield) {
      score += 22;
      reasons.push(`both ${target.subfield.toLowerCase()}`);
    } else if (p.field === target.field) {
      score += 8;
    }

    // Shared distinctive title words.
    const shared = [...titleTokens(p)].filter((t) => targetTokens.has(t));
    if (shared.length) {
      score += Math.min(30, shared.length * 12);
      reasons.push(`name in common: ${shared.slice(0, 2).join(', ')}`);
    }

    if (target.millennium && p.millennium) {
      score += 12;
      reasons.push('both Millennium Prize Problems');
    }

    if (score >= MIN_SCORE && reasons.length > 0) {
      scored.push({ problem: p, score, reasons });
    }
  }

  return scored
    .sort((a, b) => b.score - a.score || a.problem.title.localeCompare(b.problem.title))
    .slice(0, limit);
}

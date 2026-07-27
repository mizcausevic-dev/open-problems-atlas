/**
 * Lead-section extracts, loaded on demand.
 *
 * The extracts file is ~520 KB, and the atlas list never shows a word of it.
 * Bundling it with the problem data would make browsing 591 rows pay for prose
 * only the detail view can display, so it is behind a dynamic import: Vite emits
 * it as its own chunk, fetched the first time a detail page opens and cached by
 * the service worker from then on.
 *
 * The module keeps one in-flight promise rather than one per caller, so opening
 * three problems quickly triggers one request, not three.
 */

import { useEffect, useState } from 'react';
import type { Remote } from '../types';

export interface Extract {
  text: string;
  /** True when the source lead was longer than the generator's character budget. */
  truncated: boolean;
  /** The article the text actually came from, after redirects. */
  resolvedTitle: string;
  /**
   * 'problem' — the article is about this problem.
   * 'article' — the link points at a section of a broader article, so this lead
   *             describes the article as a whole. The UI must say so.
   */
  scope: 'problem' | 'article';
}

interface ExtractsFile {
  meta: {
    generatedBy: string;
    generatedAt: string;
    source: { api: string; license: string; licenseUrl: string };
    maxChars: number;
    counts: Record<string, number>;
  };
  extracts: Record<string, Extract>;
}

let cache: ExtractsFile | null = null;
let inflight: Promise<ExtractsFile> | null = null;

export function loadExtracts(): Promise<ExtractsFile> {
  if (cache) return Promise.resolve(cache);
  inflight ??= import('../data/extracts.generated.json')
    .then((m) => {
      cache = (m.default ?? m) as unknown as ExtractsFile;
      return cache;
    })
    .catch((err) => {
      // Reset so a later navigation can retry rather than being stuck on a
      // rejected promise for the rest of the session.
      inflight = null;
      throw err;
    });
  return inflight;
}

/** Synchronous read, for callers that already know the file is loaded. */
export function peekExtract(problemId: string): Extract | undefined {
  return cache?.extracts[problemId];
}

/**
 * Fetch one problem's extract.
 *
 * Returns `{ kind: 'ok', value: null }` when the file loaded fine but this
 * problem has no extract — 42 of 591 have none, and that is a fact about the
 * data, not a failure. The caller renders nothing rather than an error.
 */
export function useExtract(problemId: string | undefined): Remote<Extract | null> {
  const [state, setState] = useState<Remote<Extract | null>>(() =>
    cache && problemId
      ? { kind: 'ok', value: cache.extracts[problemId] ?? null, fetchedAt: cache.meta.generatedAt }
      : { kind: 'idle' },
  );

  useEffect(() => {
    if (!problemId) {
      setState({ kind: 'idle' });
      return;
    }
    if (cache) {
      setState({
        kind: 'ok',
        value: cache.extracts[problemId] ?? null,
        fetchedAt: cache.meta.generatedAt,
      });
      return;
    }

    let live = true;
    setState({ kind: 'loading' });
    loadExtracts().then(
      (file) => {
        if (!live) return;
        setState({
          kind: 'ok',
          value: file.extracts[problemId] ?? null,
          fetchedAt: file.meta.generatedAt,
        });
      },
      () => {
        if (!live) return;
        setState({ kind: 'error', message: 'Extended descriptions could not be loaded.' });
      },
    );
    return () => {
      live = false;
    };
  }, [problemId]);

  return state;
}

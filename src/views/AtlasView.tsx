/**
 * The atlas: search, filter and sort the whole problem set.
 *
 * All of the view state lives in the URL rather than in useState, so a filtered
 * view is a link. "Open number-theory problems, settled-newest, matching prime"
 * is a thing one person can send another, and the back button steps through
 * filter changes the way a reader expects.
 *
 * Rendering note: ~600 rows of KaTeX-typeset prose is enough DOM to be felt on
 * a phone, so the list pages in 60s and each row carries `content-visibility:
 * auto`. A button beats infinite scroll because the result count is knowable
 * and shown, so a reader can see how much is left rather than discovering it by
 * scrolling.
 */

import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { ArrowUpDown, Dices, Filter, Search, X } from 'lucide-react';
import type { Dataset } from '../types';
import { TRACK_STATES } from '../types';
import {
  activeFilterCount,
  atlasStateFromParams,
  atlasStateToParams,
  filterProblems,
  sortProblems,
  SORT_OPTIONS,
  type AtlasState,
  type SortKey,
} from '../lib/search';
import { randomProblem } from '../lib/collections';
import { store } from '../lib/storage';
import { TRACK_LABEL } from '../lib/fields';
import { Button, EmptyState, fmt } from '../components/ui';
import { ProblemRow } from '../components/ProblemRow';

const PAGE = 60;

interface Props {
  dataset: Dataset;
  dark: boolean;
  query: URLSearchParams;
  setQuery: (params: Record<string, string | undefined>) => void;
  onOpen: (id: string) => void;
}

export default function AtlasView({ dataset, dark, query, setQuery, onOpen }: Props) {
  const state = useMemo(
    () => atlasStateFromParams(query, dataset.meta.fields),
    [query, dataset.meta.fields],
  );

  const [shown, setShown] = useState(PAGE);
  const [panelOpen, setPanelOpen] = useState<'filters' | 'sort' | null>(null);

  // The input is uncontrolled-ish: it holds its own value for instant feedback
  // and pushes to the URL, because writing every keystroke through the router
  // and back adds a frame of lag to typing.
  const [draftQuery, setDraftQuery] = useState(state.query);
  useEffect(() => setDraftQuery(state.query), [state.query]);

  const deferredQuery = useDeferredValue(draftQuery);
  const tracked = store.all().tracked;

  const update = (patch: Partial<AtlasState>) => {
    setQuery(atlasStateToParams({ ...state, ...patch }));
    setShown(PAGE);
  };

  // Debounce the URL write so typing does not thrash history or the router.
  useEffect(() => {
    if (draftQuery === state.query) return;
    const id = setTimeout(() => update({ query: draftQuery }), 220);
    return () => clearTimeout(id);
  }, [draftQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  const results = useMemo(() => {
    const filtered = filterProblems(
      dataset.problems,
      { ...state, query: deferredQuery },
      tracked,
    );
    return sortProblems(filtered, state.sort, dataset.meta.fields);
  }, [dataset.problems, dataset.meta.fields, state, deferredQuery, tracked]);

  const toggleField = (field: string) =>
    update({
      fields: state.fields.includes(field)
        ? state.fields.filter((f) => f !== field)
        : [...state.fields, field],
    });

  const activeCount = activeFilterCount(state);

  const fieldCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of dataset.problems) counts[p.field] = (counts[p.field] ?? 0) + 1;
    return counts;
  }, [dataset.problems]);

  const surprise = () => {
    const p = randomProblem(results);
    if (p) onOpen(p.id);
  };

  const sortLabel = SORT_OPTIONS.find((o) => o.key === state.sort)?.label ?? 'Best match';
  const showYear = state.sort === 'settled-new' || state.sort === 'settled-old';

  return (
    <div className="space-y-5">
      <header className="max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-strong sm:text-3xl">
          The atlas
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-dim">
          {fmt.format(dataset.meta.counts.total)} problems parsed from the source article. Filters
          and sort order live in the address bar, so any view you build here is a link you can send.
        </p>
      </header>

      {/* ---- Controls ------------------------------------------------------ */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-[min(100%,16rem)] flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-dim"
              aria-hidden
            />
            <input
              id="atlas-search"
              type="search"
              name="q"
              value={draftQuery}
              onChange={(e) => setDraftQuery(e.target.value)}
              placeholder={`Search ${fmt.format(dataset.meta.counts.total)} problems: riemann, perelman, graph colouring…`}
              aria-label="Search problems"
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-xl border border-line bg-panel py-2.5 pr-9 pl-9 text-sm text-ink placeholder:text-ink-dim hover:border-line focus:border-accent focus:outline-none"
            />
            {draftQuery && (
              <button
                type="button"
                onClick={() => setDraftQuery('')}
                aria-label="Clear search"
                className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1 text-ink-dim hover:bg-panel-2 hover:text-ink-strong"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            )}
          </div>

          <Button
            onClick={() => setPanelOpen(panelOpen === 'sort' ? null : 'sort')}
            pressed={panelOpen === 'sort'}
            className="shrink-0"
          >
            <ArrowUpDown className="size-4" aria-hidden />
            <span className="hidden sm:inline">{sortLabel}</span>
          </Button>

          <Button
            onClick={() => setPanelOpen(panelOpen === 'filters' ? null : 'filters')}
            variant={activeCount ? 'primary' : 'ghost'}
            pressed={panelOpen === 'filters'}
            className="shrink-0"
          >
            <Filter className="size-4" aria-hidden />
            <span className="hidden sm:inline">Filters</span>
            {activeCount > 0 && <span className="font-mono">{activeCount}</span>}
          </Button>

          <Button onClick={surprise} title="Open a random problem from the current results" className="shrink-0">
            <Dices className="size-4" aria-hidden />
            <span className="sr-only sm:not-sr-only">Random</span>
          </Button>
        </div>

        {panelOpen === 'sort' && (
          <fieldset className="rounded-xl border border-line bg-panel p-4">
            <legend className="mb-2 text-[11px] font-semibold tracking-wide text-ink-dim uppercase">
              Order
            </legend>
            <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {SORT_OPTIONS.map((o) => (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => update({ sort: o.key as SortKey })}
                  aria-pressed={state.sort === o.key}
                  className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                    state.sort === o.key
                      ? 'border-accent bg-accent-soft text-accent-ink'
                      : 'border-line bg-panel-2 hover:border-accent/40'
                  }`}
                >
                  <span className="block text-sm font-medium">{o.label}</span>
                  <span className="block text-[11px] text-ink-dim">{o.hint}</span>
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {panelOpen === 'filters' && (
          <div className="space-y-4 rounded-xl border border-line bg-panel p-4">
            <fieldset>
              <legend className="mb-2 text-[11px] font-semibold tracking-wide text-ink-dim uppercase">
                Field
              </legend>
              {/* Wraps rather than scrolls: a horizontally scrolling chip row
                  hides options off-screen on exactly the devices with least room. */}
              <div className="flex flex-wrap gap-1.5">
                {dataset.meta.fields.map((field) => {
                  const on = state.fields.includes(field);
                  return (
                    <button
                      key={field}
                      type="button"
                      onClick={() => toggleField(field)}
                      aria-pressed={on}
                      className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                        on
                          ? 'border-accent bg-accent-soft font-medium text-accent-ink'
                          : 'border-line bg-panel-2 text-ink-dim hover:border-accent/40 hover:text-ink-strong'
                      }`}
                    >
                      {field} <span className="font-mono opacity-60">{fieldCounts[field] ?? 0}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              <fieldset>
                <legend className="mb-2 text-[11px] font-semibold tracking-wide text-ink-dim uppercase">
                  Status
                </legend>
                <div className="flex flex-wrap gap-1.5">
                  {(['all', 'open', 'solved', 'partially-solved'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => update({ status: s })}
                      aria-pressed={state.status === s}
                      className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                        state.status === s
                          ? 'border-accent bg-accent-soft font-medium text-accent-ink'
                          : 'border-line bg-panel-2 text-ink-dim hover:border-accent/40 hover:text-ink-strong'
                      }`}
                    >
                      {s === 'partially-solved' ? 'Partly settled' : s === 'solved' ? 'Settled' : s === 'all' ? 'All' : 'Open'}
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="mb-2 text-[11px] font-semibold tracking-wide text-ink-dim uppercase">
                  Your tracking
                </legend>
                <div className="flex flex-wrap gap-1.5">
                  {(['any', 'tracked', 'untracked', ...TRACK_STATES] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => update({ tracking: t })}
                      aria-pressed={state.tracking === t}
                      className={`rounded-full border px-2.5 py-1 text-xs capitalize transition-colors ${
                        state.tracking === t
                          ? 'border-accent bg-accent-soft font-medium text-accent-ink'
                          : 'border-line bg-panel-2 text-ink-dim hover:border-accent/40 hover:text-ink-strong'
                      }`}
                    >
                      {TRACK_LABEL[t] ?? t}
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>

            <div className="flex flex-wrap items-center gap-4 border-t border-line pt-3">
              <label className="flex cursor-pointer items-center gap-2 text-xs text-ink">
                <input
                  type="checkbox"
                  checked={state.millenniumOnly}
                  onChange={(e) => update({ millenniumOnly: e.target.checked })}
                  className="size-4 accent-[var(--c-accent)]"
                />
                Millennium Prize Problems only
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-xs text-ink">
                <input
                  type="checkbox"
                  checked={state.topLevelOnly}
                  onChange={(e) => update({ topLevelOnly: e.target.checked })}
                  className="size-4 accent-[var(--c-accent)]"
                />
                Hide sub-cases
              </label>
              {activeCount > 0 && (
                <Button
                  variant="quiet"
                  size="sm"
                  onClick={() => setQuery(atlasStateToParams({ ...state, fields: [], status: 'all', tracking: 'any', millenniumOnly: false, topLevelOnly: false, sort: 'relevance' }))}
                >
                  <X className="size-3.5" aria-hidden /> Clear filters
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-ink-dim" role="status" aria-live="polite">
        {fmt.format(results.length)} {results.length === 1 ? 'problem' : 'problems'}
        {results.length !== dataset.problems.length && ` of ${fmt.format(dataset.problems.length)}`}
        {state.sort !== 'relevance' && `, ${sortLabel.toLowerCase()}`}
      </p>

      {results.length === 0 ? (
        <EmptyState icon={<Search className="size-8" />} title="Nothing matched">
          The atlas only contains what the source article lists. Try a shorter query, or clear the
          filters.
        </EmptyState>
      ) : (
        <>
          <ul className="space-y-2">
            {results.slice(0, shown).map((p) => (
              <ProblemRow key={p.id} problem={p} dark={dark} showYear={showYear} />
            ))}
          </ul>

          {shown < results.length && (
            <div className="flex justify-center pt-2">
              <Button onClick={() => setShown((s) => s + PAGE)}>
                Show {Math.min(PAGE, results.length - shown)} more
                <span className="text-ink-dim">({fmt.format(results.length - shown)} left)</span>
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

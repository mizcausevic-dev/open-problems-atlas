/**
 * The atlas: search and filter the whole problem set.
 *
 * Rendering note: ~600 rows each containing KaTeX-typeset prose is enough DOM to
 * be felt on a phone, so the list renders in pages of 60 with an explicit
 * "show more". A button beats infinite scroll here because the result count is
 * knowable and shown, so the user can see how much is left rather than
 * discovering it by scrolling.
 */

import { useDeferredValue, useMemo, useState } from 'react';
import { Filter, Search, Star, X } from 'lucide-react';
import type { Dataset, Problem } from '../types';
import { DEFAULT_FILTERS, filterProblems, type Filters } from '../lib/search';
import { store } from '../lib/storage';
import { TRACK_LABEL } from '../lib/fields';
import { TRACK_STATES } from '../types';
import { Button, Chip, EmptyState, FieldChip, StatusChip, fmt } from '../components/ui';
import { RichText } from '../components/Tex';

const PAGE = 60;

interface Props {
  dataset: Dataset;
  dark: boolean;
  onOpen: (id: string) => void;
}

export default function AtlasView({ dataset, dark, onOpen }: Props) {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [shown, setShown] = useState(PAGE);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Typing stays responsive: the input updates immediately, the full-dataset scan
  // runs against the deferred value.
  const deferredQuery = useDeferredValue(filters.query);

  const tracked = store.all().tracked;

  const results = useMemo(
    () => filterProblems(dataset.problems, { ...filters, query: deferredQuery }, tracked),
    [dataset.problems, filters, deferredQuery, tracked],
  );

  const update = (patch: Partial<Filters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setShown(PAGE);
  };

  const toggleField = (field: string) =>
    update({
      fields: filters.fields.includes(field)
        ? filters.fields.filter((f) => f !== field)
        : [...filters.fields, field],
    });

  const activeCount =
    filters.fields.length +
    (filters.status !== 'all' ? 1 : 0) +
    (filters.millenniumOnly ? 1 : 0) +
    (filters.tracking !== 'any' ? 1 : 0) +
    (filters.topLevelOnly ? 1 : 0);

  const fieldCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of dataset.problems) counts[p.field] = (counts[p.field] ?? 0) + 1;
    return counts;
  }, [dataset.problems]);

  return (
    <div className="space-y-5">
      <header className="max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-strong sm:text-3xl">
          Every open problem on the list, in one place
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-dim">
          {fmt.format(dataset.meta.counts.total)} problems parsed from the source article, of which{' '}
          {fmt.format(dataset.meta.counts.open)} are open and {dataset.meta.counts.solved} have been
          settled since 1995. Track whichever ones you are actually working on; everything you record
          stays in this browser.
        </p>
      </header>

      {/* Search + filter controls */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-dim"
              aria-hidden
            />
            <input
              type="search"
              value={filters.query}
              onChange={(e) => update({ query: e.target.value })}
              placeholder={`Search ${fmt.format(dataset.meta.counts.total)} problems: riemann, perelman, graph colouring…`}
              aria-label="Search problems"
              className="w-full rounded-xl border border-line bg-panel py-2.5 pr-3 pl-9 text-sm text-ink placeholder:text-ink-dim focus:border-accent focus:outline-none"
            />
          </div>
          <Button
            onClick={() => setFiltersOpen((v) => !v)}
            variant={activeCount ? 'primary' : 'ghost'}
            pressed={filtersOpen}
            className="shrink-0"
          >
            <Filter className="size-4" aria-hidden />
            <span className="hidden sm:inline">Filters</span>
            {activeCount > 0 && <span className="font-mono">{activeCount}</span>}
          </Button>
        </div>

        {filtersOpen && (
          <div className="space-y-4 rounded-xl border border-line bg-panel p-4">
            <fieldset>
              <legend className="mb-2 text-[11px] font-semibold tracking-wide text-ink-dim uppercase">
                Field
              </legend>
              {/* Wraps rather than scrolls: a horizontally scrolling chip row
                  hides options off-screen on exactly the devices with least room. */}
              <div className="flex flex-wrap gap-1.5">
                {dataset.meta.fields.map((field) => {
                  const on = filters.fields.includes(field);
                  return (
                    <button
                      key={field}
                      type="button"
                      onClick={() => toggleField(field)}
                      aria-pressed={on}
                      className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                        on
                          ? 'border-accent bg-accent-soft font-medium text-accent-ink'
                          : 'border-line bg-panel-2 text-ink-dim hover:text-ink-strong'
                      }`}
                    >
                      {field}{' '}
                      <span className="font-mono opacity-60">{fieldCounts[field] ?? 0}</span>
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
                      aria-pressed={filters.status === s}
                      className={`rounded-full border px-2.5 py-1 text-xs capitalize transition-colors ${
                        filters.status === s
                          ? 'border-accent bg-accent-soft font-medium text-accent-ink'
                          : 'border-line bg-panel-2 text-ink-dim hover:text-ink-strong'
                      }`}
                    >
                      {s === 'partially-solved' ? 'partly settled' : s}
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
                      aria-pressed={filters.tracking === t}
                      className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                        filters.tracking === t
                          ? 'border-accent bg-accent-soft font-medium text-accent-ink'
                          : 'border-line bg-panel-2 text-ink-dim hover:text-ink-strong'
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
                  checked={filters.millenniumOnly}
                  onChange={(e) => update({ millenniumOnly: e.target.checked })}
                  className="size-4 accent-[var(--c-accent)]"
                />
                Millennium Prize Problems only
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-xs text-ink">
                <input
                  type="checkbox"
                  checked={filters.topLevelOnly}
                  onChange={(e) => update({ topLevelOnly: e.target.checked })}
                  className="size-4 accent-[var(--c-accent)]"
                />
                Hide sub-cases
              </label>
              {activeCount > 0 && (
                <Button variant="quiet" size="sm" onClick={() => setFilters(DEFAULT_FILTERS)}>
                  <X className="size-3.5" aria-hidden /> Clear all
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-ink-dim" role="status" aria-live="polite">
        {fmt.format(results.length)} {results.length === 1 ? 'problem' : 'problems'}
        {results.length !== dataset.problems.length && ` of ${fmt.format(dataset.problems.length)}`}
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
              <ProblemRow key={p.id} problem={p} dark={dark} onOpen={onOpen} />
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

function ProblemRow({
  problem,
  dark,
  onOpen,
}: {
  problem: Problem;
  dark: boolean;
  onOpen: (id: string) => void;
}) {
  const tracked = store.tracked(problem.id);

  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(problem.id)}
        className="w-full rounded-xl border border-line bg-panel p-3.5 text-left transition-colors hover:border-accent/50 hover:bg-panel-2 sm:p-4"
      >
        <div className="flex flex-wrap items-center gap-1.5">
          {problem.millennium && (
            <Chip tone="accent" title="One of the seven Clay Millennium Prize Problems">
              <Star className="size-3" aria-hidden /> Millennium
            </Chip>
          )}
          <FieldChip field={problem.field} dark={dark} />
          <StatusChip status={problem.status} />
          {problem.depth > 1 && (
            <Chip title="Listed as a sub-case of a broader entry in the source article">
              sub-case
            </Chip>
          )}
          {tracked && <Chip tone="warn">{TRACK_LABEL[tracked.state]}</Chip>}
        </div>

        <h3 className="mt-2 leading-snug font-semibold text-ink-strong">{problem.title}</h3>

        {problem.description ? (
          // min-w-0 stops long unbroken maths from forcing the whole grid wider
          // than the viewport, which zooms the layout out on mobile.
          <p className="mt-1 line-clamp-3 min-w-0 text-sm leading-relaxed text-ink-dim">
            <RichText>{problem.description}</RichText>
          </p>
        ) : (
          <p className="mt-1 text-sm text-ink-dim italic">
            The source article lists this without a description.
          </p>
        )}

        {problem.status === 'solved' && problem.solvedBy && (
          <p className="mt-1.5 text-xs text-solved">
            Settled by {problem.solvedBy}
            {problem.solvedYear ? `, ${problem.solvedYear}` : ''}
          </p>
        )}
      </button>
    </li>
  );
}


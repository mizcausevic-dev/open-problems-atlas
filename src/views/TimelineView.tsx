/**
 * What has actually fallen since 1995.
 *
 * This is the most useful thing the source article contains and the easiest to
 * miss: a list of a hundred-odd problems that were open and are now closed,
 * with who closed them and when. Read next to the open list it is the honest
 * answer to "does any of this ever move".
 *
 * The per-year bars are counts of entries in the dataset, not a measure of
 * mathematical output. Attribution years come from the source article and often
 * mark a preprint rather than publication, which is stated on the page rather
 * than smoothed over.
 */

import { useMemo, useState } from 'react';
import { History } from 'lucide-react';
import type { Dataset, Problem } from '../types';
import { fieldColor } from '../lib/fields';
import { deriveCounts, hasSettledOutcome, settledByOf, settledYearOf } from '../lib/counts';
import { href } from '../lib/router';
import { Chip, FieldChip, Note, Panel, SectionTitle } from '../components/ui';
import { RichText } from '../components/Tex';

interface Props {
  dataset: Dataset;
  dark: boolean;
  onOpen: (id: string) => void;
}

export default function TimelineView({ dataset, dark, onOpen }: Props) {
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const counts = useMemo(() => deriveCounts(dataset.problems), [dataset.problems]);

  // The same predicates the header and the about page use, so this page cannot
  // drift from them again. It previously counted its own set and reported 111
  // where the header said 105, with nothing on either surface explaining why.
  const solved = useMemo(
    () =>
      dataset.problems.filter(hasSettledOutcome).map((p) => ({
        problem: p,
        year: settledYearOf(p),
        by: settledByOf(p),
      })),
    [dataset.problems],
  );

  const dated = solved.filter((s) => s.year !== undefined) as {
    problem: Problem;
    year: number;
    by?: string;
  }[];
  const undated = solved.filter((s) => s.year === undefined);

  const byYear = useMemo(() => {
    const map = new Map<number, typeof dated>();
    for (const s of dated) {
      const list = map.get(s.year) ?? [];
      list.push(s);
      map.set(s.year, list);
    }
    return [...map.entries()].sort((a, b) => b[0] - a[0]);
  }, [dated]);

  const maxInYear = Math.max(...byYear.map(([, list]) => list.length), 1);
  const years = byYear.map(([y]) => y);
  const span = years.length ? `${Math.min(...years)} to ${Math.max(...years)}` : '';

  const visible = selectedYear === null ? byYear : byYear.filter(([y]) => y === selectedYear);

  return (
    <div className="space-y-6">
      <header className="max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-strong sm:text-3xl">
          Problems that stopped being unsolved
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-dim">
          The open list is long, and this is the part that shows it is not static. Spanning {span}.
        </p>

        {/* The three figures that used to disagree across pages, stated together
            so the difference between them is visible rather than confusing. */}
        <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <div>
            <dt className="text-[11px] tracking-wide text-ink-dim uppercase">Settled</dt>
            <dd className="font-mono text-lg text-solved">{counts.settled}</dd>
          </div>
          <div>
            <dt className="text-[11px] tracking-wide text-ink-dim uppercase">Partly settled</dt>
            <dd className="font-mono text-lg text-partial">{counts.partlySettled}</dd>
          </div>
          <div>
            <dt className="text-[11px] tracking-wide text-ink-dim uppercase">Shown below</dt>
            <dd className="font-mono text-lg text-ink-strong">{counts.timeline.entries}</dd>
          </div>
          <div>
            <dt className="text-[11px] tracking-wide text-ink-dim uppercase">With a year</dt>
            <dd className="font-mono text-lg text-ink-strong">{counts.timeline.dated}</dd>
          </div>
        </dl>

        <Note>
          This page shows {counts.timeline.entries} entries where the header says {counts.settled}{' '}
          settled, and the bars below plot {counts.timeline.dated}. The difference is not a
          discrepancy: {counts.settled} problems are recorded as settled outright,{' '}
          {counts.partlySettled} more are{' '}
          <a className="text-accent hover:underline" href={href({ name: 'collection', slug: 'listed-twice' })}>
            listed as both open and settled
          </a>{' '}
          and appear here too, and {counts.timeline.undated} of the total carry no parsable year so
          they sit at the bottom of the page rather than on the axis.
        </Note>
      </header>

      <Panel className="p-4 sm:p-5">
        <SectionTitle
          hint="Entries per year in the dataset. Click a bar to filter."
          right={
            selectedYear !== null && (
              <button
                type="button"
                onClick={() => setSelectedYear(null)}
                className="text-xs text-accent hover:underline"
              >
                Show all years
              </button>
            )
          }
        >
          By year
        </SectionTitle>

        {/* Wraps onto multiple rows on narrow screens rather than scrolling
            sideways, so no year is hidden off the edge of a phone. */}
        <div className="flex flex-wrap gap-1">
          {[...byYear].reverse().map(([year, list]) => {
            const on = selectedYear === year;
            return (
              <button
                key={year}
                type="button"
                onClick={() => setSelectedYear(on ? null : year)}
                aria-pressed={on}
                title={`${year}: ${list.length} ${list.length === 1 ? 'entry' : 'entries'}`}
                className="group flex w-9 flex-col items-center gap-1"
              >
                <span className="font-mono text-[10px] text-ink-dim">{list.length}</span>
                <span className="flex h-16 w-full items-end">
                  <span
                    className={`w-full rounded-t-sm transition-colors ${
                      on ? 'bg-accent' : 'bg-solved/60 group-hover:bg-solved'
                    }`}
                    style={{ height: `${(list.length / maxInYear) * 100}%`, minHeight: 3 }}
                  />
                </span>
                <span
                  className={`font-mono text-[9px] ${on ? 'font-bold text-accent' : 'text-ink-dim'}`}
                >
                  {String(year).slice(2)}
                </span>
              </button>
            );
          })}
        </div>

        <Note>
          Bars count entries in this dataset, not mathematical output. A year's height depends on how
          the article's editors grouped and worded things, and attribution years often mark a
          preprint rather than a publication.
        </Note>
      </Panel>

      <div className="space-y-6">
        {visible.map(([year, list]) => (
          <section key={year}>
            <div className="mb-3 flex items-center gap-3">
              <h2 className="font-mono text-xl font-semibold text-ink-strong">{year}</h2>
              <span className="h-px flex-1 bg-line" aria-hidden />
              <span className="font-mono text-xs text-ink-dim">
                {list.length} {list.length === 1 ? 'entry' : 'entries'}
              </span>
            </div>

            <ul className="space-y-2">
              {list.map(({ problem, by }) => (
                <li key={problem.id}>
                  <button
                    type="button"
                    onClick={() => onOpen(problem.id)}
                    className="w-full rounded-xl border border-line bg-panel p-3.5 text-left transition-colors hover:border-solved/50 hover:bg-panel-2"
                    style={{ borderLeftWidth: 3, borderLeftColor: fieldColor(problem.field, dark) }}
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      <FieldChip field={problem.field} dark={dark} />
                      {problem.status === 'partially-solved' && <Chip tone="partial">partly settled</Chip>}
                    </div>
                    <h3 className="mt-1.5 leading-snug font-semibold text-ink-strong">{problem.title}</h3>
                    {by && <p className="mt-0.5 text-sm text-solved">{by}</p>}
                    {problem.description && (
                      <p className="mt-1 line-clamp-2 min-w-0 text-sm text-ink-dim">
                        <RichText>{problem.description}</RichText>
                      </p>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {undated.length > 0 && selectedYear === null && (
        <Panel className="p-4 sm:p-5">
          <SectionTitle hint="Listed as solved without a parsable year">
            <History className="mr-1.5 inline size-4" aria-hidden />
            No year recorded
          </SectionTitle>
          <ul className="flex flex-wrap gap-1.5">
            {undated.map(({ problem }) => (
              <li key={problem.id}>
                <button
                  type="button"
                  onClick={() => onOpen(problem.id)}
                  className="rounded-full border border-line bg-panel-2 px-2.5 py-1 text-xs text-ink-dim hover:border-accent/60 hover:text-ink-strong"
                >
                  {problem.title}
                </button>
              </li>
            ))}
          </ul>
          <Note>
            These are shown rather than dropped. Omitting them would quietly shrink the totals above
            and make the yearly counts look more complete than they are.
          </Note>
        </Panel>
      )}
    </div>
  );
}

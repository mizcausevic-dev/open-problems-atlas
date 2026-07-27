/**
 * The landing view.
 *
 * Replaces an alphabetical list that opened on "(2, 5)-perfect numbers" — a
 * first impression that told a newcomer nothing about the shape or size of what
 * they had arrived at. The job of this page is to answer three questions before
 * anyone types anything: how much is here, what is it made of, and where should
 * I start.
 *
 * Every figure and every cell is derived from the dataset at render time. There
 * is no editorial ordering and no hand-maintained list of highlights.
 */

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Compass, Dices, FlaskConical, Sparkles } from 'lucide-react';
import type { Dataset, Problem } from '../types';
import { deriveCounts } from '../lib/counts';
import { COLLECTIONS, collectionMembers, problemOfTheDay, randomProblem } from '../lib/collections';
import { usableTreemap } from '../lib/treemap';
import { fieldColor } from '../lib/fields';
import { href } from '../lib/router';
import { Button, Chip, FieldChip, Panel, SectionTitle, fmt } from '../components/ui';
import { RichText } from '../components/Tex';

interface Props {
  dataset: Dataset;
  dark: boolean;
  onOpen: (id: string) => void;
  onField: (field: string) => void;
}

/**
 * Measures the container so the treemap can be laid out at its real size.
 *
 * Three mechanisms, deliberately overlapping:
 *
 *   1. A synchronous measure in useLayoutEffect, so the chart is laid out
 *      before first paint rather than popping in a frame later.
 *   2. A ResizeObserver for container changes a window resize would not report,
 *      such as the grid reflowing around it.
 *   3. A window resize listener as a fallback.
 *
 * (3) exists because a ResizeObserver that is present but never fires leaves
 * the width at zero forever and the chart renders nothing at all — observed in
 * a headless-ish browser during testing. A visualisation that silently
 * disappears is worse than one that is a frame late, so the synchronous measure
 * is the primary path and the observers are refinements.
 */
function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () => {
      const w = el.getBoundingClientRect().width;
      setWidth((prev) => (Math.abs(prev - w) > 0.5 ? w : prev));
    };

    measure();

    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(measure);
      ro.observe(el);
    }
    window.addEventListener('resize', measure);

    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  return [ref, width] as const;
}

export default function OverviewView({ dataset, dark, onOpen, onField }: Props) {
  const counts = useMemo(() => deriveCounts(dataset.problems), [dataset.problems]);
  const featured = useMemo(() => problemOfTheDay(dataset.problems), [dataset.problems]);

  const byField = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of dataset.problems) map.set(p.field, (map.get(p.field) ?? 0) + 1);
    return [...map.entries()]
      .map(([field, value]) => ({ value, data: field }))
      .sort((a, b) => b.value - a.value);
  }, [dataset.problems]);

  const surprise = () => {
    const p = randomProblem(dataset.problems);
    if (p) onOpen(p.id);
  };

  return (
    <div className="space-y-10">
      {/* ---- Hero ---------------------------------------------------------- */}
      <header className="max-w-3xl">
        <p className="mb-3 font-mono text-[11px] tracking-[0.14em] text-accent uppercase">
          Wikipedia · revision {dataset.meta.source.revisionId ?? 'unknown'} · {dataset.meta.generatedAt}
        </p>
        <h1 className="text-[clamp(1.75rem,5vw,2.75rem)] leading-[1.1] font-semibold tracking-tight text-ink-strong">
          {fmt.format(counts.total)} problems nobody has finished
        </h1>
        <p className="mt-4 text-base leading-relaxed text-ink-dim">
          Every entry from Wikipedia's list of unsolved problems in mathematics, parsed from the
          source article rather than hand-picked. {fmt.format(counts.open)} are open,{' '}
          {counts.settled} have been settled since 1995, and {counts.partlySettled} are listed as
          both. Track the ones you care about; everything you record stays in this browser.
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          <a
            href={href({ name: 'atlas' })}
            className="inline-flex items-center gap-2 rounded-lg border border-accent bg-accent px-4 py-2.5 text-sm font-semibold text-bg transition-[filter] hover:brightness-110"
          >
            <Compass className="size-4" aria-hidden />
            Browse the atlas
          </a>
          <Button onClick={surprise}>
            <Dices className="size-4" aria-hidden />
            Surprise me
          </Button>
          <a
            href={href({ name: 'lab' })}
            className="inline-flex items-center gap-2 rounded-lg border border-line bg-panel px-4 py-2.5 text-sm text-ink transition-colors hover:border-accent/60 hover:text-ink-strong"
          >
            <FlaskConical className="size-4" aria-hidden />
            Run the mathematics
          </a>
        </div>
      </header>

      {/* ---- Problem of the day -------------------------------------------- */}
      {featured && <FeaturedProblem problem={featured} dark={dark} onOpen={onOpen} />}

      {/* ---- Field treemap -------------------------------------------------- */}
      <section>
        <SectionTitle hint="Area is proportional to the number of problems. Select a field to filter the atlas.">
          What the collection is made of
        </SectionTitle>
        <FieldTreemap fields={byField} dark={dark} total={counts.total} onField={onField} />
      </section>

      {/* ---- Collections ---------------------------------------------------- */}
      <section>
        <SectionTitle hint="Each is a rule over the dataset, not a hand-kept list, so none of them can quietly go stale.">
          Ways in
        </SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {COLLECTIONS.map((c) => {
            const n = collectionMembers(c, dataset.problems).length;
            return (
              <a
                key={c.slug}
                href={href({ name: 'collection', slug: c.slug })}
                className="group flex flex-col rounded-xl border border-line bg-panel p-4 transition-colors hover:border-accent/50 hover:bg-panel-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold text-ink-strong">{c.title}</h3>
                  <span className="shrink-0 rounded-full border border-line bg-panel-2 px-2 py-0.5 font-mono text-[11px] text-ink-dim">
                    {n}
                  </span>
                </div>
                <p className="mt-1.5 flex-1 text-sm leading-relaxed text-ink-dim">{c.blurb}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-accent">
                  Open
                  <ArrowRight
                    className="size-3.5 transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </span>
              </a>
            );
          })}
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------

function FeaturedProblem({
  problem,
  dark,
  onOpen,
}: {
  problem: Problem;
  dark: boolean;
  onOpen: (id: string) => void;
}) {
  return (
    <Panel className="relative overflow-hidden p-5 sm:p-6">
      {/* Decorative accent wash. aria-hidden: it carries no information. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-accent via-accent/40 to-transparent"
      />
      <div className="flex flex-wrap items-center gap-2">
        <Chip tone="accent">
          <Sparkles className="size-3" aria-hidden />
          Today's problem
        </Chip>
        <FieldChip field={problem.field} dark={dark} />
        {problem.millennium && <Chip tone="accent">Millennium</Chip>}
      </div>

      <h2 className="mt-3 text-xl leading-snug font-semibold tracking-tight text-ink-strong sm:text-2xl">
        {problem.title}
      </h2>

      {problem.description && (
        <p className="mt-2 max-w-3xl min-w-0 leading-relaxed text-ink">
          <RichText>{problem.description}</RichText>
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="primary" size="sm" onClick={() => onOpen(problem.id)}>
          Read the full entry
          <ArrowRight className="size-3.5" aria-hidden />
        </Button>
        <p className="text-xs text-ink-dim">
          Chosen by the calendar date, so it is the same problem for everyone today and a different
          one tomorrow.
        </p>
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------

/**
 * The overview shows a treemap when one fits, and proportional bars when it
 * does not. `usableTreemap` decides, by laying the chart out and checking every
 * cell clears the touch target — see the note in lib/treemap.ts on why a width
 * breakpoint was the wrong mechanism. Bars are the fallback because a field
 * with one problem is a short bar in a full-height row: still readable, still
 * tappable, still exactly proportional.
 */
function FieldTreemap({
  fields,
  dark,
  total,
  onField,
}: {
  fields: { value: number; data: string }[];
  dark: boolean;
  total: number;
  onField: (field: string) => void;
}) {
  const [ref, width] = useElementWidth<HTMLDivElement>();

  const layout = useMemo(() => usableTreemap(fields, width), [fields, width]);
  const useTreemap = layout !== null;
  const cells = layout?.cells ?? [];
  const height = layout?.height ?? 0;

  const max = Math.max(...fields.map((f) => f.value), 1);

  return (
    <div ref={ref} className="w-full">
      {width > 0 && !useTreemap && (
        <ul className="space-y-1">
          {fields.map((f) => {
            const colour = fieldColor(f.data, dark);
            const pct = (f.value / total) * 100;
            return (
              <li key={f.data}>
                <button
                  type="button"
                  onClick={() => onField(f.data)}
                  className="flex w-full items-center gap-3 rounded-lg border border-line bg-panel px-3 py-2.5 text-left transition-colors hover:border-accent/50 hover:bg-panel-2"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-medium text-ink-strong">{f.data}</span>
                      <span className="shrink-0 font-mono text-xs text-ink-dim">
                        {fmt.format(f.value)} · {pct.toFixed(1)}%
                      </span>
                    </span>
                    <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-panel-2">
                      <span
                        className="block h-full rounded-full"
                        style={{ width: `${(f.value / max) * 100}%`, background: colour }}
                      />
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {useTreemap && (
        <div
          className="relative overflow-hidden rounded-xl border border-line"
          style={{ height }}
        >
          {cells.map((cell) => {
            const colour = fieldColor(cell.data, dark);
            const pct = (cell.value / total) * 100;
            // Below these thresholds the label would overflow its cell, so it
            // moves into the tooltip and the visible label is dropped rather
            // than clipped into nonsense.
            const showLabel = cell.width > 78 && cell.height > 34;
            const showCount = cell.width > 46 && cell.height > 52;

            return (
              <button
                key={cell.data}
                type="button"
                onClick={() => onField(cell.data)}
                title={`${cell.data}: ${fmt.format(cell.value)} problems, ${pct.toFixed(1)}% of the collection`}
                className="group absolute overflow-hidden text-left transition-[filter,outline] outline-none hover:brightness-125 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-accent"
                style={{
                  left: cell.x,
                  top: cell.y,
                  width: cell.width,
                  height: cell.height,
                  background: dark
                    ? `color-mix(in srgb, ${colour} 22%, var(--c-panel))`
                    : `color-mix(in srgb, ${colour} 14%, #fff)`,
                  // Hairline gutters, drawn as an inset ring so no space is lost.
                  boxShadow: 'inset 0 0 0 1px var(--c-bg)',
                }}
              >
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0 w-[3px]"
                  style={{ background: colour }}
                />
                {/* Label and count sit together at the top-left. Splitting them
                    to opposite ends of the cell put the number 600px below the
                    name in the tallest cells, where it read as missing. */}
                <span className="flex h-full flex-col items-start gap-1 p-2.5 pl-3.5">
                  {showLabel ? (
                    <span
                      className="text-xs leading-tight font-semibold break-words"
                      style={{ color: colour }}
                    >
                      {cell.data}
                    </span>
                  ) : (
                    <span className="sr-only">{cell.data}</span>
                  )}
                  {showCount ? (
                    <span className="font-mono text-xl leading-none font-semibold text-ink-strong">
                      {fmt.format(cell.value)}
                    </span>
                  ) : (
                    <span className="sr-only">{cell.value} problems</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Legend, only under the treemap. Colour is never the only channel, and
          this is also what a printed page shows. The bar list needs no legend
          because every bar is already labelled. */}
      {useTreemap && (
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink-dim">
          {fields.map((f) => (
            <li key={f.data}>
              <button
                type="button"
                onClick={() => onField(f.data)}
                className="inline-flex items-center gap-1.5 hover:text-ink-strong"
              >
                <span
                  aria-hidden
                  className="size-2 rounded-full"
                  style={{ background: fieldColor(f.data, dark) }}
                />
                {f.data} <span className="font-mono">{fmt.format(f.value)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

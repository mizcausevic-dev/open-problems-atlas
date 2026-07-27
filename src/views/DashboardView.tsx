/**
 * Progress dashboard.
 *
 * Every figure here is either a count of the user's own records or a count of
 * the dataset. There is no engagement score, no streak, no "momentum". Those
 * would be invented quantities dressed as measurement, and on a page about
 * unsolved mathematics the difference matters more than usual.
 */

import { useMemo } from 'react';
import { BookOpen, Clock, GaugeCircle, Target } from 'lucide-react';
import type { Dataset, TrackState } from '../types';
import { TRACK_STATES } from '../types';
import { store } from '../lib/storage';
import { TRACK_LABEL, fieldColor } from '../lib/fields';
import { href } from '../lib/router';
import { Button, EmptyState, FieldChip, Note, Panel, SectionTitle, Stat, fmt } from '../components/ui';

interface Props {
  dataset: Dataset;
  dark: boolean;
  onOpen: (id: string) => void;
}

export default function DashboardView({ dataset, dark, onOpen }: Props) {
  const tracked = store.trackedList();
  const journal = store.journalAll();
  const byId = useMemo(() => new Map(dataset.problems.map((p) => [p.id, p])), [dataset.problems]);

  const byState = useMemo(() => {
    const counts = {} as Record<TrackState, number>;
    for (const t of tracked) counts[t.state] = (counts[t.state] ?? 0) + 1;
    return counts;
  }, [tracked]);

  const byField = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of tracked) {
      const p = byId.get(t.problemId);
      if (p) counts[p.field] = (counts[p.field] ?? 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [tracked, byId]);

  const totalMinutes = tracked.reduce((sum, t) => sum + (t.minutesLogged ?? 0), 0);
  const rated = tracked.filter((t) => t.perceivedDifficulty !== undefined);

  if (tracked.length === 0 && journal.length === 0) {
    return (
      <div className="space-y-5">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-strong">Your progress</h1>
        <EmptyState icon={<GaugeCircle className="size-8" />} title="Nothing tracked yet">
          <p className="mb-4">
            This dashboard only ever shows your own records. It stays empty until you mark a problem
            as curious, reading, working, stuck or parked.
          </p>
          <Button variant="primary" onClick={() => (window.location.hash = href({ name: 'atlas' }))}>
            Browse the atlas
          </Button>
        </EmptyState>
      </div>
    );
  }

  const mostRecent = [...tracked].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink-strong sm:text-3xl">Your progress</h1>
        <p className="mt-1.5 text-sm text-ink-dim">
          Counts of what you have recorded. Nothing here is inferred or scored.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Tracked"
          value={fmt.format(tracked.length)}
          source={`of ${fmt.format(dataset.meta.counts.total)} problems in the dataset`}
          tone="accent"
        />
        <Stat
          label="Notes written"
          value={fmt.format(journal.length)}
          source={`across ${new Set(journal.map((j) => j.problemId)).size} problems`}
        />
        <Stat
          label="Time logged"
          value={`${Math.floor(totalMinutes / 60)}h`}
          source="you entered this by hand; nothing is timed automatically"
        />
        <Stat
          label="Self-rated"
          value={
            rated.length
              ? (rated.reduce((s, t) => s + (t.perceivedDifficulty ?? 0), 0) / rated.length).toFixed(1)
              : '—'
          }
          source={rated.length ? `mean of your ${rated.length} ratings, out of 5` : 'rate a problem to see this'}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel className="p-4 sm:p-5">
          <SectionTitle hint="Where your tracked problems sit right now">By state</SectionTitle>
          <ul className="space-y-2">
            {TRACK_STATES.map((s) => {
              const n = byState[s] ?? 0;
              const pct = tracked.length ? (n / tracked.length) * 100 : 0;
              return (
                <li key={s}>
                  <div className="mb-1 flex items-baseline justify-between text-sm">
                    <span className="text-ink">{TRACK_LABEL[s]}</span>
                    <span className="font-mono text-ink-dim">{n}</span>
                  </div>
                  <div
                    className="h-1.5 overflow-hidden rounded-full bg-panel-2"
                    role="img"
                    aria-label={`${TRACK_LABEL[s]}: ${n} of ${tracked.length} tracked problems`}
                  >
                    <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel className="p-4 sm:p-5">
          <SectionTitle hint="Which areas you actually spend attention on">By field</SectionTitle>
          {byField.length === 0 ? (
            <p className="text-sm text-ink-dim">Nothing tracked yet.</p>
          ) : (
            <ul className="space-y-2.5">
              {byField.map(([field, n]) => {
                const pct = (n / tracked.length) * 100;
                return (
                  <li key={field}>
                    <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                      <FieldChip field={field} dark={dark} />
                      <span className="font-mono text-xs text-ink-dim">
                        {n} · {pct.toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-panel-2">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, background: fieldColor(field, dark) }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <Note>
            Coverage of the whole dataset: {((tracked.length / dataset.meta.counts.total) * 100).toFixed(1)}%.
            That number is small by design. There are {fmt.format(dataset.meta.counts.open)} open problems
            and no one tracks them all.
          </Note>
        </Panel>
      </div>

      <Panel className="p-4 sm:p-5">
        <SectionTitle hint="Most recently updated first">Tracked problems</SectionTitle>
        <ul className="divide-y divide-line">
          {mostRecent.map((t) => {
            const p = byId.get(t.problemId);
            if (!p) return null;
            const noteCount = journal.filter((j) => j.problemId === p.id).length;
            return (
              <li key={t.problemId}>
                <button
                  type="button"
                  onClick={() => onOpen(p.id)}
                  className="flex w-full flex-wrap items-center gap-x-3 gap-y-1.5 py-3 text-left hover:bg-panel-2"
                >
                  <span className="min-w-0 flex-1 truncate font-medium text-ink-strong">{p.title}</span>
                  <FieldChip field={p.field} dark={dark} short />
                  <span className="rounded-full border border-accent/30 bg-accent-soft px-2 py-0.5 text-[11px] text-accent-ink">
                    {TRACK_LABEL[t.state]}
                  </span>
                  <span className="flex shrink-0 items-center gap-2.5 font-mono text-[11px] text-ink-dim">
                    {t.perceivedDifficulty && (
                      <span title="Your difficulty rating">
                        <Target className="mr-0.5 inline size-3" aria-hidden />
                        {t.perceivedDifficulty}/5
                      </span>
                    )}
                    {t.minutesLogged ? (
                      <span title="Time you logged">
                        <Clock className="mr-0.5 inline size-3" aria-hidden />
                        {Math.floor(t.minutesLogged / 60)}h{t.minutesLogged % 60}m
                      </span>
                    ) : null}
                    {noteCount > 0 && (
                      <span title="Notes on this problem">
                        <BookOpen className="mr-0.5 inline size-3" aria-hidden />
                        {noteCount}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </Panel>
    </div>
  );
}

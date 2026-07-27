/**
 * A single problem.
 *
 * Layout intent: source material on the left, your own work on the right. The
 * two never blend visually, because the whole point is that a reader can tell
 * at a glance which parts are Wikipedia's and which are theirs.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, BarChart3, ExternalLink as ExternalIcon, FileText, Loader2, Plus,
  RefreshCw, Star, Trash2,
} from 'lucide-react';
import type { Dataset, Pageviews, Problem, Remote, TrackState } from '../types';
import { TRACK_STATES } from '../types';
import { store } from '../lib/storage';
import { fetchPageviews } from '../lib/pageviews';
import { TRACK_HINT, TRACK_LABEL } from '../lib/fields';
import { href } from '../lib/router';
import {
  Button, Chip, EmptyState, ExternalLink, FieldChip, Note, Panel, SectionTitle, StatusChip, fmt,
} from '../components/ui';
import { NoteBody, RichText } from '../components/Tex';
import { Sparkline } from '../components/Sparkline';

interface Props {
  problem: Problem | undefined;
  dataset: Dataset;
  dark: boolean;
  online: boolean;
  onOpen: (id: string) => void;
}

const wikiUrl = (p: Problem): string | null =>
  p.wikipediaTitle
    ? `https://en.wikipedia.org/wiki/${encodeURIComponent(p.wikipediaTitle.replace(/ /g, '_'))}${
        p.wikipediaAnchor ? `#${encodeURIComponent(p.wikipediaAnchor.replace(/ /g, '_'))}` : ''
      }`
    : null;

/** The article this problem was listed in, for entries with no article of their own. */
const SOURCE_ARTICLE_URL = 'https://en.wikipedia.org/wiki/List_of_unsolved_problems_in_mathematics';

export default function ProblemView({ problem, dataset, dark, online, onOpen }: Props) {
  if (!problem) {
    return (
      <EmptyState icon={<FileText className="size-8" />} title="No such problem in this dataset">
        The link may point at an entry from a different revision of the source article.{' '}
        <a className="text-accent underline" href={href({ name: 'atlas' })}>
          Back to the atlas
        </a>
        .
      </EmptyState>
    );
  }

  const tracked = store.tracked(problem.id);
  const notes = store.journalFor(problem.id);

  const children = useMemo(
    () => dataset.problems.filter((p) => p.parentId === problem.id),
    [dataset.problems, problem.id],
  );
  const parent = problem.parentId
    ? dataset.problems.find((p) => p.id === problem.parentId)
    : undefined;

  return (
    <div className="space-y-6">
      <a
        href={href({ name: 'atlas' })}
        className="inline-flex items-center gap-1.5 text-sm text-ink-dim hover:text-ink-strong"
        data-print="hide"
      >
        <ArrowLeft className="size-4" aria-hidden /> Atlas
      </a>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        {/* ---- Source material -------------------------------------------- */}
        <div className="min-w-0 space-y-5">
          <header>
            <div className="flex flex-wrap items-center gap-1.5">
              {problem.millennium && (
                <Chip tone="accent">
                  <Star className="size-3" aria-hidden /> Millennium Prize Problem
                </Chip>
              )}
              <FieldChip field={problem.field} dark={dark} />
              {problem.subfield && <Chip>{problem.subfield}</Chip>}
              <StatusChip status={problem.status} />
            </div>

            <h1 className="mt-3 text-2xl leading-tight font-semibold tracking-tight text-ink-strong sm:text-3xl">
              {problem.title}
            </h1>

            {problem.fieldSource === 'curated' && (
              <p className="mt-2 text-xs text-ink-dim">
                Field classification supplied by this app, not taken from a section heading: the
                source article lists this problem outside its by-field taxonomy.
              </p>
            )}
          </header>

          <Panel className="p-4 sm:p-5">
            <SectionTitle hint="Wikipedia, verbatim apart from markup cleanup">Statement</SectionTitle>
            {problem.description ? (
              <div className="min-w-0 text-[15px] leading-relaxed text-ink">
                <RichText>{problem.description}</RichText>
              </div>
            ) : (
              <p className="text-sm text-ink-dim italic">
                The source article lists this problem by name only. Follow the article link for the
                full statement.
              </p>
            )}

            {problem.status === 'solved' && (
              <p className="mt-3 rounded-lg border border-solved/30 bg-solved-soft px-3 py-2 text-sm text-solved">
                Settled{problem.solvedBy ? ` by ${problem.solvedBy}` : ''}
                {problem.solvedYear ? ` in ${problem.solvedYear}` : ''}.
              </p>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <a
                href={wikiUrl(problem) ?? SOURCE_ARTICLE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-panel-2 px-3 py-2 text-sm text-ink transition-colors hover:border-accent/60"
              >
                <ExternalIcon className="size-4" aria-hidden />
                {wikiUrl(problem) ? 'Wikipedia article' : 'Source article'}
              </a>
              <a
                href={`https://arxiv.org/a/search?searchtype=all&query=${encodeURIComponent(problem.title)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-panel-2 px-3 py-2 text-sm text-ink transition-colors hover:border-accent/60"
              >
                <ExternalIcon className="size-4" aria-hidden />
                Search arXiv
              </a>
            </div>
          </Panel>

          {problem.variants && problem.variants.length > 0 && (
            <Panel className="p-4 sm:p-5">
              <SectionTitle hint="The source article lists this article more than once, with different outcomes">
                Listed twice
              </SectionTitle>
              <ul className="space-y-3">
                {problem.variants.map((v, i) => (
                  <li key={i} className="rounded-lg border border-line bg-panel-2 p-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <StatusChip status={v.status} />
                      <Chip>{v.field}</Chip>
                    </div>
                    {v.description && (
                      <p className="mt-2 text-sm text-ink">
                        <RichText>{v.description}</RichText>
                      </p>
                    )}
                    {v.solvedBy && (
                      <p className="mt-1 text-xs text-solved">
                        {v.solvedBy}
                        {v.solvedYear ? `, ${v.solvedYear}` : ''}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
              <Note>
                These are kept separate rather than merged into one status, because merging them
                would assert something the source does not say.
              </Note>
            </Panel>
          )}

          {problem.references && problem.references.length > 0 && (
            <Panel className="p-4 sm:p-5">
              <SectionTitle hint="Citations carried over from the source article">References</SectionTitle>
              <ul className="space-y-2 text-sm">
                {problem.references.map((r, i) => (
                  <li key={i} className="min-w-0 text-ink-dim">
                    {r.url ? <ExternalLink href={r.url}>{r.title ?? r.url}</ExternalLink> : r.title}
                    {r.year && <span className="ml-1.5 font-mono text-xs">({r.year})</span>}
                    {r.doi && (
                      <span className="ml-1.5 font-mono text-xs">
                        doi:<ExternalLink href={`https://doi.org/${r.doi}`}>{r.doi}</ExternalLink>
                      </span>
                    )}
                    {r.arxiv && (
                      <span className="ml-1.5 font-mono text-xs">
                        arXiv:<ExternalLink href={`https://arxiv.org/abs/${r.arxiv}`}>{r.arxiv}</ExternalLink>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {(parent || children.length > 0 || (problem.relatedTopics?.length ?? 0) > 0) && (
            <Panel className="p-4 sm:p-5">
              <SectionTitle>Nearby</SectionTitle>
              <div className="space-y-3">
                {parent && (
                  <div>
                    <p className="mb-1 text-xs text-ink-dim">Listed as a sub-case of</p>
                    <button
                      type="button"
                      onClick={() => onOpen(parent.id)}
                      className="text-sm text-accent hover:underline"
                    >
                      {parent.title}
                    </button>
                  </div>
                )}
                {children.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs text-ink-dim">Sub-cases listed under this</p>
                    <ul className="space-y-1">
                      {children.map((c) => (
                        <li key={c.id}>
                          <button
                            type="button"
                            onClick={() => onOpen(c.id)}
                            className="text-left text-sm text-accent hover:underline"
                          >
                            {c.title}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {problem.relatedTopics && problem.relatedTopics.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-xs text-ink-dim">Topics linked from the statement</p>
                    <div className="flex flex-wrap gap-1.5">
                      {problem.relatedTopics.map((t) => (
                        <a
                          key={t}
                          href={`https://en.wikipedia.org/wiki/${encodeURIComponent(t.replace(/ /g, '_'))}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-full border border-line bg-panel-2 px-2.5 py-1 text-xs text-ink-dim hover:border-accent/60 hover:text-ink-strong"
                        >
                          {t}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Panel>
          )}
        </div>

        {/* ---- Your work --------------------------------------------------- */}
        <div className="min-w-0 space-y-5" data-print="hide">
          <TrackPanel problem={problem} />
          <NotesPanel problem={problem} />
          {/* No article means no pageview series to ask for, so the panel is
              omitted rather than shown permanently empty. */}
          {problem.wikipediaTitle && (
            <AttentionPanel
              wikipediaTitle={problem.wikipediaTitle}
              title={problem.title}
              online={online}
            />
          )}
        </div>
      </div>

      {/* Notes render below the fold in print, where the two-column layout collapses. */}
      {notes.length > 0 && (
        <div className="hidden print:block">
          <h2 className="mb-2 text-lg font-semibold">Notes</h2>
          {notes.map((n) => (
            <article key={n.id} className="mb-4">
              <h3 className="font-semibold">{n.title}</h3>
              <NoteBody>{n.body}</NoteBody>
            </article>
          ))}
        </div>
      )}
      {tracked && <span className="sr-only">Tracked as {TRACK_LABEL[tracked.state]}</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------

function TrackPanel({ problem }: { problem: Problem }) {
  const tracked = store.tracked(problem.id);

  return (
    <Panel className="p-4">
      <SectionTitle hint="Yours. Stored in this browser only.">Your status</SectionTitle>

      <div className="flex flex-wrap gap-1.5">
        {TRACK_STATES.map((s: TrackState) => {
          const on = tracked?.state === s;
          return (
            <button
              key={s}
              type="button"
              title={TRACK_HINT[s]}
              aria-pressed={on}
              onClick={() => store.setTrackState(problem.id, on ? 'untracked' : s)}
              className={`rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${
                on
                  ? 'border-accent bg-accent-soft font-semibold text-accent-ink'
                  : 'border-line bg-panel-2 text-ink-dim hover:text-ink-strong'
              }`}
            >
              {TRACK_LABEL[s]}
            </button>
          );
        })}
      </div>

      {tracked ? (
        <>
          <p className="mt-2.5 text-xs text-ink-dim">{TRACK_HINT[tracked.state]}</p>

          <div className="mt-4">
            <label
              htmlFor={`difficulty-${problem.id}`}
              className="mb-1.5 block text-[11px] font-semibold tracking-wide text-ink-dim uppercase"
            >
              How hard it feels to you
            </label>
            <div className="flex items-center gap-2">
              <input
                id={`difficulty-${problem.id}`}
                type="range"
                min={1}
                max={5}
                step={1}
                value={tracked.perceivedDifficulty ?? 3}
                onChange={(e) => store.setPerceivedDifficulty(problem.id, Number(e.target.value))}
                className="flex-1 accent-[var(--c-accent)]"
              />
              <span className="w-8 shrink-0 text-right font-mono text-sm text-ink-strong">
                {tracked.perceivedDifficulty ?? '—'}/5
              </span>
            </div>
            <p className="mt-1 text-[11px] text-ink-dim">
              Self-assessment. Nothing computes an objective difficulty for an unsolved problem.
            </p>
          </div>

          <div className="mt-4 border-t border-line pt-3">
            <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-ink-dim uppercase">
              Time logged
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-lg text-ink-strong">
                {tracked.minutesLogged ? `${Math.floor(tracked.minutesLogged / 60)}h ${tracked.minutesLogged % 60}m` : '0h 0m'}
              </span>
              {[15, 30, 60].map((m) => (
                <Button key={m} size="sm" onClick={() => store.addMinutes(problem.id, m)}>
                  +{m}m
                </Button>
              ))}
            </div>
          </div>
        </>
      ) : (
        <p className="mt-2.5 text-xs text-ink-dim">
          Not tracked. Pick a state above to add it to your dashboard.
        </p>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------------------

function NotesPanel({ problem }: { problem: Problem }) {
  const notes = store.journalFor(problem.id);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [draftTitle, setDraftTitle] = useState('');
  const textarea = useRef<HTMLTextAreaElement>(null);

  const editing = notes.find((n) => n.id === editingId);

  useEffect(() => {
    if (editing) {
      setDraft(editing.body);
      setDraftTitle(editing.title);
      textarea.current?.focus();
    }
  }, [editingId]); // eslint-disable-line react-hooks/exhaustive-deps

  const create = () => {
    const entry = store.createEntry(problem.id, `Note on ${problem.title}`, '');
    setEditingId(entry.id);
  };

  const save = () => {
    if (!editingId) return;
    store.updateEntry(editingId, { title: draftTitle, body: draft });
    setEditingId(null);
  };

  return (
    <Panel className="p-4">
      <SectionTitle
        hint="LaTeX between $ … $, display maths between $$ … $$"
        right={
          <Button size="sm" onClick={create}>
            <Plus className="size-3.5" aria-hidden /> New note
          </Button>
        }
      >
        Notes
      </SectionTitle>

      {editing ? (
        <div className="space-y-2">
          <input
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            aria-label="Note title"
            className="w-full rounded-lg border border-line bg-panel-2 px-3 py-2 text-sm font-medium text-ink-strong focus:border-accent focus:outline-none"
          />
          <textarea
            ref={textarea}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={10}
            aria-label="Note body"
            placeholder={'Suppose $\\zeta(s) = 0$ with $0 < \\Re(s) < 1$.\n\n$$\\zeta(s) = \\prod_p \\frac{1}{1 - p^{-s}}$$'}
            className="w-full resize-y rounded-lg border border-line bg-panel-2 px-3 py-2 font-mono text-sm text-ink focus:border-accent focus:outline-none"
          />
          {draft.trim() && (
            <div className="rounded-lg border border-dashed border-line bg-panel-2 p-3">
              <p className="mb-1.5 text-[11px] tracking-wide text-ink-dim uppercase">Preview</p>
              <NoteBody className="text-sm text-ink">{draft}</NoteBody>
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="primary" size="sm" onClick={save}>
              Save
            </Button>
            <Button variant="quiet" size="sm" onClick={() => setEditingId(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              className="ml-auto"
              onClick={() => {
                store.deleteEntry(editing.id);
                setEditingId(null);
              }}
            >
              <Trash2 className="size-3.5" aria-hidden /> Delete
            </Button>
          </div>
          {editing.revisions.length > 0 && (
            <details className="text-xs text-ink-dim">
              <summary className="cursor-pointer">
                {editing.revisions.length} earlier {editing.revisions.length === 1 ? 'version' : 'versions'}
              </summary>
              <ul className="mt-2 space-y-1">
                {editing.revisions.map((r, i) => (
                  <li key={i} className="flex items-center justify-between gap-2">
                    <span className="font-mono">{r.savedAt.slice(0, 16).replace('T', ' ')}</span>
                    <button
                      type="button"
                      className="text-accent hover:underline"
                      onClick={() => {
                        store.restoreRevision(editing.id, i);
                        setDraft(r.body);
                      }}
                    >
                      Restore
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      ) : notes.length === 0 ? (
        <p className="text-xs text-ink-dim">
          No notes yet. Notes are plain text with LaTeX, exportable to .tex or Markdown.
        </p>
      ) : (
        <ul className="space-y-2">
          {notes.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => setEditingId(n.id)}
                className="w-full rounded-lg border border-line bg-panel-2 p-3 text-left transition-colors hover:border-accent/50"
              >
                <p className="truncate text-sm font-medium text-ink-strong">{n.title}</p>
                <p className="mt-0.5 font-mono text-[11px] text-ink-dim">
                  edited {n.updatedAt.slice(0, 10)}
                  {n.revisions.length > 0 && ` · ${n.revisions.length} earlier`}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------------------

function AttentionPanel({
  wikipediaTitle,
  title,
  online,
}: {
  wikipediaTitle: string;
  title: string;
  online: boolean;
}) {
  const [state, setState] = useState<Remote<Pageviews>>({ kind: 'idle' });

  const load = () => {
    setState({ kind: 'loading' });
    void fetchPageviews(wikipediaTitle).then(setState);
  };

  return (
    <Panel className="p-4">
      <SectionTitle
        hint="Live from the Wikimedia API. Not cached, not estimated."
        right={
          <Button size="sm" onClick={load} disabled={state.kind === 'loading' || !online}>
            {state.kind === 'loading' ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="size-3.5" aria-hidden />
            )}
            {state.kind === 'ok' ? 'Refresh' : 'Load'}
          </Button>
        }
      >
        Reader attention
      </SectionTitle>

      {!online && (
        <Note tone="warn">
          Offline. This is the one part of the app that needs a connection, and it will stay blank
          rather than show a number it cannot verify.
        </Note>
      )}

      {state.kind === 'idle' && online && (
        <p className="text-xs text-ink-dim">
          Daily views of the Wikipedia article over the last 60 days. Loaded on request so browsing
          the atlas makes no third-party requests.
        </p>
      )}

      {state.kind === 'error' && (
        <div className="space-y-2">
          <Note tone="warn">{state.message}</Note>
          <p className="text-[11px] text-ink-dim">
            No figure is shown, because there is no figure. A plausible-looking number generated
            locally would be indistinguishable from real data, and wrong.
          </p>
        </div>
      )}

      {state.kind === 'ok' && (
        <div className="space-y-3">
          <Sparkline
            points={state.value.series.map((s) => s.views)}
            labels={[state.value.windowStart, state.value.windowEnd]}
            summary={`Daily Wikipedia pageviews for ${title} from ${state.value.windowStart} to ${state.value.windowEnd}. Total ${fmt.format(state.value.total)} views, averaging ${Math.round(state.value.mean)} per day.`}
          />
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-[11px] tracking-wide text-ink-dim uppercase">Mean daily</dt>
              <dd className="font-mono text-lg text-ink-strong">{fmt.format(Math.round(state.value.mean))}</dd>
            </div>
            <div>
              <dt className="text-[11px] tracking-wide text-ink-dim uppercase">Last 14d vs prior</dt>
              <dd className="font-mono text-lg text-ink-strong">
                {state.value.changePct === undefined ? (
                  <span className="text-sm text-ink-dim">not enough data</span>
                ) : (
                  `${state.value.changePct >= 0 ? '+' : ''}${state.value.changePct.toFixed(1)}%`
                )}
              </dd>
            </div>
          </dl>
          <p className="flex items-center gap-1.5 text-[11px] text-ink-dim">
            <BarChart3 className="size-3" aria-hidden />
            {fmt.format(state.value.total)} views, {state.value.windowStart} to {state.value.windowEnd}.
            Retrieved {state.fetchedAt.slice(0, 16).replace('T', ' ')}Z.
          </p>
        </div>
      )}
    </Panel>
  );
}

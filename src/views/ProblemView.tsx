/**
 * A single problem.
 *
 * Layout intent: source material on the left, your own work on the right. The
 * two never blend visually, because the whole point is that a reader can tell
 * at a glance which parts are Wikipedia's and which are theirs.
 *
 * This page used to be the thinnest surface in the app — often one sentence and
 * two links. It now carries the lead section of the problem's own Wikipedia
 * article (loaded on demand from a separate chunk), the citations parsed from
 * the source list, related problems derived from real relationships, and a
 * record-metadata panel. Everything still comes from the generated dataset; no
 * new runtime request was added except the pageview call that was already here.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, BarChart3, BookText, ExternalLink as ExternalIcon, FileText, FlaskConical,
  GitBranch, Loader2, Plus, RefreshCw, Star, Trash2,
} from 'lucide-react';
import type { Dataset, Pageviews, Problem, Remote, TrackState } from '../types';
import { TRACK_STATES } from '../types';
import { store } from '../lib/storage';
import { fetchPageviews } from '../lib/pageviews';
import { useExtract } from '../lib/extracts';
import { findRelated } from '../lib/related';
import { LAB_PROBLEM_IDS, COLLECTIONS, collectionMembers } from '../lib/collections';
import { TRACK_HINT, TRACK_LABEL } from '../lib/fields';
import { href } from '../lib/router';
import { shareText } from '../lib/share';
import {
  Button, Chip, EmptyState, ExternalLink, FieldChip, Note, Panel, SectionTitle, StatusChip, fmt,
} from '../components/ui';
import { NoteBody, RichText } from '../components/Tex';
import { MathEditor } from '../components/MathEditor';
import { Share } from '../components/Share';
import { Sparkline } from '../components/Sparkline';

interface Props {
  problem: Problem | undefined;
  dataset: Dataset;
  dark: boolean;
  online: boolean;
}

const SOURCE_ARTICLE_URL = 'https://en.wikipedia.org/wiki/List_of_unsolved_problems_in_mathematics';

const wikiUrl = (p: Problem): string | null =>
  p.wikipediaTitle
    ? `https://en.wikipedia.org/wiki/${encodeURIComponent(p.wikipediaTitle.replace(/ /g, '_'))}${
        p.wikipediaAnchor ? `#${encodeURIComponent(p.wikipediaAnchor.replace(/ /g, '_'))}` : ''
      }`
    : null;

export default function ProblemView({ problem, dataset, dark, online }: Props) {
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

  const related = useMemo(
    () => findRelated(problem, dataset.problems, 6),
    [problem, dataset.problems],
  );

  const children = useMemo(
    () => dataset.problems.filter((p) => p.parentId === problem.id),
    [dataset.problems, problem.id],
  );
  const parent = problem.parentId
    ? dataset.problems.find((p) => p.id === problem.parentId)
    : undefined;

  const memberOf = useMemo(
    () => COLLECTIONS.filter((c) => collectionMembers(c, dataset.problems).some((p) => p.id === problem.id)),
    [dataset.problems, problem.id],
  );

  const labTools = LAB_PROBLEM_IDS[problem.id] ?? [];
  const notes = store.journalFor(problem.id);

  return (
    <div className="space-y-6">
      <a
        href={href({ name: 'atlas' })}
        className="inline-flex items-center gap-1.5 text-sm text-ink-dim hover:text-ink-strong"
        data-print="hide"
      >
        <ArrowLeft className="size-4" aria-hidden /> Atlas
      </a>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
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
              {problem.depth > 1 && problem.parentId && (
                <Chip title="Listed as a sub-case in the source article">sub-case</Chip>
              )}
            </div>

            <div className="mt-3 flex items-start justify-between gap-3">
              {/* min-w-0 so a long title wraps instead of forcing the row wider
                  than the viewport, which is the mobile blowout this codebase
                  has hit before. */}
              <h1 className="min-w-0 text-2xl leading-tight font-semibold tracking-tight text-ink-strong sm:text-[2rem]">
                {problem.title}
              </h1>
              <div className="shrink-0 pt-1">
                <Share
                  text={shareText({
                    title: problem.title,
                    field: problem.field,
                    status: problem.status,
                  })}
                />
              </div>
            </div>

            {problem.fieldSource === 'curated' && (
              <p className="mt-2 text-xs text-ink-dim">
                Field classification supplied by this app, not taken from a section heading: the
                source article lists this problem outside its by-field taxonomy.
              </p>
            )}

            {labTools.length > 0 && (
              <a
                href={href({ name: 'lab', tool: labTools[0] })}
                className="mt-3 inline-flex items-center gap-2 rounded-lg border border-accent/40 bg-accent-soft px-3 py-2 text-sm font-medium text-accent-ink transition-colors hover:border-accent"
              >
                <FlaskConical className="size-4" aria-hidden />
                Compute against this in the Lab
              </a>
            )}
          </header>

          <Panel className="p-4 sm:p-5">
            <SectionTitle hint="From the list article, verbatim apart from markup cleanup">
              As the list states it
            </SectionTitle>
            {problem.description ? (
              <div className="min-w-0 text-[15px] leading-relaxed text-ink">
                <RichText>{problem.description}</RichText>
              </div>
            ) : (
              <p className="text-sm text-ink-dim italic">
                The source article lists this problem by name only.
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

          <ExtendedContext problem={problem} />

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
                would assert something the source does not.
              </Note>
            </Panel>
          )}

          {related.length > 0 && (
            <Panel className="p-4 sm:p-5">
              <SectionTitle hint="Derived from links, shared solvers and classification in the source, not from a similarity model">
                Related problems
              </SectionTitle>
              <ul className="divide-y divide-line">
                {related.map(({ problem: r, reasons }) => (
                  <li key={r.id}>
                    <a
                      href={href({ name: 'problem', id: r.id })}
                      className="-mx-2 block rounded-lg px-2 py-2.5 transition-colors hover:bg-panel-2"
                    >
                      <div className="flex flex-wrap items-center gap-1.5">
                        <FieldChip field={r.field} dark={dark} short />
                        <StatusChip status={r.status} />
                      </div>
                      <p className="mt-1 font-medium text-ink-strong">{r.title}</p>
                      <p className="mt-0.5 text-xs text-ink-dim">{reasons.slice(0, 2).join(' · ')}</p>
                    </a>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {problem.references && problem.references.length > 0 && (
            <Panel className="p-4 sm:p-5">
              <SectionTitle hint="Citations carried over from the source article">References</SectionTitle>
              <ol className="space-y-2.5 text-sm">
                {problem.references.map((r, i) => (
                  <li key={i} className="flex min-w-0 gap-2.5 text-ink-dim">
                    <span className="shrink-0 font-mono text-xs text-accent">[{i + 1}]</span>
                    <span className="min-w-0">
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
                    </span>
                  </li>
                ))}
              </ol>
            </Panel>
          )}

          {(parent || children.length > 0 || (problem.relatedTopics?.length ?? 0) > 0) && (
            <Panel className="p-4 sm:p-5">
              <SectionTitle hint="Structure and topic links taken straight from the source bullet">
                Nearby
              </SectionTitle>
              <div className="space-y-3">
                {parent && (
                  <div>
                    <p className="mb-1 text-xs text-ink-dim">Listed as a sub-case of</p>
                    <a href={href({ name: 'problem', id: parent.id })} className="text-sm text-accent hover:underline">
                      {parent.title}
                    </a>
                  </div>
                )}
                {children.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs text-ink-dim">Sub-cases listed under this</p>
                    <ul className="space-y-1">
                      {children.map((c) => (
                        <li key={c.id}>
                          <a href={href({ name: 'problem', id: c.id })} className="text-sm text-accent hover:underline">
                            {c.title}
                          </a>
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
          {problem.wikipediaTitle && (
            <AttentionPanel
              wikipediaTitle={problem.wikipediaTitle}
              title={problem.title}
              online={online}
            />
          )}
          <RecordPanel problem={problem} memberOf={memberOf} childCount={children.length} relatedCount={related.length} />
        </div>
      </div>

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
    </div>
  );
}

// ---------------------------------------------------------------------------

/**
 * The lead section of the problem's own Wikipedia article.
 *
 * Loaded from a separate chunk on demand, so the atlas does not carry 520 KB of
 * prose it never shows. When the link points at a section of a broader article,
 * the lead is about that whole article — which the panel says outright rather
 * than letting a reader assume it was written about this problem.
 */
function ExtendedContext({ problem }: { problem: Problem }) {
  const state = useExtract(problem.id);

  if (state.kind === 'idle') return null;

  if (state.kind === 'loading') {
    return (
      <Panel className="p-4 sm:p-5">
        <SectionTitle>Background</SectionTitle>
        <p className="flex items-center gap-2 text-sm text-ink-dim">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Loading the article's introduction…
        </p>
      </Panel>
    );
  }

  if (state.kind === 'error') {
    return (
      <Panel className="p-4 sm:p-5">
        <SectionTitle>Background</SectionTitle>
        <Note tone="warn">{state.message}</Note>
      </Panel>
    );
  }

  // Loaded fine, but this problem has no article extract. 42 of 591 have none.
  if (!state.value) return null;

  const { text, truncated, resolvedTitle, scope } = state.value;
  const paragraphs = text.split(/\n+/).filter(Boolean);

  return (
    <Panel className="p-4 sm:p-5">
      <SectionTitle
        hint={
          scope === 'article'
            ? `Introduction to “${resolvedTitle}”, the article this problem is a section of`
            : `Introduction to the Wikipedia article “${resolvedTitle}”`
        }
      >
        <BookText className="mr-1.5 inline size-4" aria-hidden />
        Background
      </SectionTitle>

      <div className="min-w-0 space-y-3 text-[15px] leading-relaxed text-ink">
        {paragraphs.map((para, i) => (
          <p key={i}>
            <RichText>{para}</RichText>
          </p>
        ))}
      </div>

      {scope === 'article' && (
        <Note tone="warn">
          This problem is listed as a section of a broader article, so the text above describes that
          article as a whole rather than this problem specifically.
        </Note>
      )}
      {truncated && (
        <p className="mt-3 text-xs text-ink-dim">
          Trimmed at a sentence boundary. Follow the article link for the rest.
        </p>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------------------

/**
 * Facts about the record, not about the mathematics.
 *
 * Deliberately not a "difficulty" or "prize" panel. The review asked for prize
 * and difficulty metadata; the source list carries neither — a search for
 * prize, bounty and dollar amounts across all 591 entries returns nothing
 * beyond the Millennium flag, and no difficulty rating exists for an unsolved
 * problem. Inventing either would be exactly the failure this app exists to
 * avoid, so what is shown instead is how complete this record is.
 */
function RecordPanel({
  problem,
  memberOf,
  childCount,
  relatedCount,
}: {
  problem: Problem;
  memberOf: { slug: string; title: string }[];
  childCount: number;
  relatedCount: number;
}) {
  const rows: { label: string; value: string }[] = [
    { label: 'Field', value: problem.field + (problem.subfield ? ` · ${problem.subfield}` : '') },
    { label: 'Classification from', value: problem.fieldSource === 'curated' ? 'this app (stated)' : 'a section heading' },
    { label: 'Own article', value: problem.wikipediaTitle ? 'yes' : 'stated inline only' },
    { label: 'Citations', value: String(problem.references?.length ?? 0) },
    { label: 'Sub-cases', value: String(childCount) },
    { label: 'Related entries', value: String(relatedCount) },
  ];
  if (problem.alsoIn?.length) {
    rows.push({ label: 'Also listed under', value: problem.alsoIn.join(', ') });
  }

  return (
    <Panel className="p-4">
      <SectionTitle hint="How complete this record is, not how hard the problem is">
        <GitBranch className="mr-1.5 inline size-4" aria-hidden />
        The record
      </SectionTitle>

      <dl className="space-y-1.5 text-sm">
        {rows.map((r) => (
          <div key={r.label} className="flex justify-between gap-3">
            <dt className="text-ink-dim">{r.label}</dt>
            <dd className="text-right font-mono text-xs text-ink">{r.value}</dd>
          </div>
        ))}
      </dl>

      {memberOf.length > 0 && (
        <div className="mt-3 border-t border-line pt-3">
          <p className="mb-1.5 text-[11px] tracking-wide text-ink-dim uppercase">Appears in</p>
          <div className="flex flex-wrap gap-1.5">
            {memberOf.map((c) => (
              <a
                key={c.slug}
                href={href({ name: 'collection', slug: c.slug })}
                className="rounded-full border border-line bg-panel-2 px-2.5 py-1 text-xs text-ink-dim hover:border-accent/60 hover:text-ink-strong"
              >
                {c.title}
              </a>
            ))}
          </div>
        </div>
      )}

      <Note>
        No prize or difficulty rating is shown because the source list carries neither. Beyond the
        Millennium flag there is no prize data in the article to surface, and nothing can rate the
        difficulty of an unsolved problem.
      </Note>
    </Panel>
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
                  : 'border-line bg-panel-2 text-ink-dim hover:border-accent/40 hover:text-ink-strong'
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
                {tracked.minutesLogged
                  ? `${Math.floor(tracked.minutesLogged / 60)}h ${tracked.minutesLogged % 60}m`
                  : '0h 0m'}
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
  const [confirmDelete, setConfirmDelete] = useState(false);

  const editing = notes.find((n) => n.id === editingId);
  const dirty = Boolean(editing && (draft !== editing.body || draftTitle !== editing.title));

  useEffect(() => {
    if (editing) {
      setDraft(editing.body);
      setDraftTitle(editing.title);
      setConfirmDelete(false);
      // Focus is MathEditor's job now, via its autoFocus prop — it owns the
      // textarea. A ref here would point at an element that no longer exists.
    }
  }, [editingId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Losing a half-written proof sketch to a stray Cmd-W is not recoverable —
  // there is no server-side draft to fall back on.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const create = () => {
    const entry = store.createEntry(problem.id, `Note on ${problem.title}`, '');
    setEditingId(entry.id);
  };

  const save = () => {
    if (!editingId) return;
    store.updateEntry(editingId, { title: draftTitle, body: draft });
    setEditingId(null);
  };

  const cancel = () => {
    if (dirty && !window.confirm('Discard your unsaved changes to this note?')) return;
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
            autoComplete="off"
            className="w-full rounded-lg border border-line bg-panel-2 px-3 py-2 text-sm font-medium text-ink-strong focus:border-accent focus:outline-none"
          />
          <MathEditor
            value={draft}
            onChange={setDraft}
            rows={10}
            autoFocus
            ariaLabel="Note body"
            placeholder={'Suppose $\\zeta(s) = 0$ with $0 < \\Re(s) < 1$.\n\n$$\\zeta(s) = \\prod_p \\frac{1}{1 - p^{-s}}$$'}
          />
          {draft.trim() && (
            <div className="rounded-lg border border-dashed border-line bg-panel-2 p-3">
              <p className="mb-1.5 text-[11px] tracking-wide text-ink-dim uppercase">Preview</p>
              <NoteBody className="text-sm text-ink">{draft}</NoteBody>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" size="sm" onClick={save} disabled={!dirty}>
              {dirty ? 'Save' : 'Saved'}
            </Button>
            <Button variant="quiet" size="sm" onClick={cancel}>
              {dirty ? 'Discard' : 'Close'}
            </Button>

            {/* Two-step, because deleting a note destroys its revision history
                too and nothing else holds a copy. */}
            {confirmDelete ? (
              <span className="ml-auto flex items-center gap-2">
                <span className="text-xs text-danger">Delete permanently?</span>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    store.deleteEntry(editing.id);
                    setEditingId(null);
                  }}
                >
                  <Trash2 className="size-3.5" aria-hidden /> Yes
                </Button>
                <Button variant="quiet" size="sm" onClick={() => setConfirmDelete(false)}>
                  No
                </Button>
              </span>
            ) : (
              <Button variant="danger" size="sm" className="ml-auto" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="size-3.5" aria-hidden /> Delete
              </Button>
            )}
          </div>
          {dirty && (
            <p className="text-[11px] text-open" role="status">
              Unsaved changes.
            </p>
          )}
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
              <dd className="font-mono text-lg text-ink-strong">
                {fmt.format(Math.round(state.value.mean))}
              </dd>
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

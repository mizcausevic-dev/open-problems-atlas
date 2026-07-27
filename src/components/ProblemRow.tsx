/**
 * One problem in a list.
 *
 * Shared by the atlas and the collection pages so a row looks and behaves the
 * same wherever it appears. Rendered as an <a> rather than a <button> because it
 * is navigation: middle-click, Cmd-click and "open in new tab" all have to work,
 * and a button silently breaks every one of them.
 */

import type { Problem } from '../types';
import { store } from '../lib/storage';
import { TRACK_LABEL } from '../lib/fields';
import { settledByOf, settledYearOf } from '../lib/counts';
import { href } from '../lib/router';
import { Chip, FieldChip, StatusChip } from './ui';
import { RichText } from './Tex';
import { Star } from 'lucide-react';

interface Props {
  problem: Problem;
  dark: boolean;
  /** Shown when a list is sorted by settled year, so the ordering is legible. */
  showYear?: boolean;
}

export function ProblemRow({ problem, dark, showYear = false }: Props) {
  const tracked = store.tracked(problem.id);
  const year = settledYearOf(problem);
  const by = settledByOf(problem);

  return (
    <li className="list-row">
      <a
        href={href({ name: 'problem', id: problem.id })}
        className="block rounded-xl border border-line bg-panel p-3.5 transition-colors hover:border-accent/50 hover:bg-panel-2 sm:p-4"
      >
        <div className="flex flex-wrap items-center gap-1.5">
          {problem.millennium && (
            <Chip tone="accent" title="One of the seven Clay Millennium Prize Problems">
              <Star className="size-3" aria-hidden /> Millennium
            </Chip>
          )}
          <FieldChip field={problem.field} dark={dark} />
          <StatusChip status={problem.status} />
          {/* Only when there is a parent entry to point at. A `**` bullet whose
              parent was an unlinked grouping line ("Location of nontrivial zeros
              of L-functions:") has no parent record, and labelling the Riemann
              Hypothesis a sub-case of nothing is just noise. */}
          {problem.depth > 1 && problem.parentId && (
            <Chip title="Listed as a sub-case of a broader entry in the source article">sub-case</Chip>
          )}
          {tracked && <Chip tone="warn">{TRACK_LABEL[tracked.state]}</Chip>}
          {showYear && year !== undefined && (
            <Chip tone="solved" className="ml-auto font-mono">
              {year}
            </Chip>
          )}
        </div>

        <h3 className="mt-2 leading-snug font-semibold text-ink-strong">{problem.title}</h3>

        {problem.description ? (
          // min-w-0 stops long unbroken maths from forcing the grid wider than
          // the viewport, which zooms the whole layout out on mobile.
          <p className="mt-1 line-clamp-3 min-w-0 text-sm leading-relaxed text-ink-dim">
            <RichText>{problem.description}</RichText>
          </p>
        ) : (
          <p className="mt-1 text-sm text-ink-dim italic">
            The source article lists this without a description.
          </p>
        )}

        {by && (
          <p className="mt-1.5 text-xs text-solved">
            Settled by {by}
            {year !== undefined ? `, ${year}` : ''}
          </p>
        )}
      </a>
    </li>
  );
}

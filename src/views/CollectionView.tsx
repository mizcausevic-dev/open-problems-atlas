/**
 * A curated collection.
 *
 * The membership rule is printed on the page. A curated list that does not say
 * what qualifies for it is an editorial claim the reader cannot check, and this
 * app's whole posture is that claims should be checkable.
 */

import { useMemo } from 'react';
import { ArrowLeft, ListFilter } from 'lucide-react';
import type { Dataset } from '../types';
import { COLLECTIONS, collectionMembers, getCollection } from '../lib/collections';
import { href } from '../lib/router';
import { EmptyState, Note, SectionTitle, fmt } from '../components/ui';
import { ProblemRow } from '../components/ProblemRow';

interface Props {
  slug: string;
  dataset: Dataset;
  dark: boolean;
}

export default function CollectionView({ slug, dataset, dark }: Props) {
  const collection = getCollection(slug);
  const members = useMemo(
    () => (collection ? collectionMembers(collection, dataset.problems) : []),
    [collection, dataset.problems],
  );

  if (!collection) {
    return (
      <EmptyState icon={<ListFilter className="size-8" />} title="No such collection">
        <p className="mb-3">The collections that exist are:</p>
        <ul className="space-y-1">
          {COLLECTIONS.map((c) => (
            <li key={c.slug}>
              <a className="text-accent hover:underline" href={href({ name: 'collection', slug: c.slug })}>
                {c.title}
              </a>
            </li>
          ))}
        </ul>
      </EmptyState>
    );
  }

  const showYear = collection.slug === 'recently-settled';

  return (
    <div className="space-y-6">
      <a
        href={href({ name: 'overview' })}
        className="inline-flex items-center gap-1.5 text-sm text-ink-dim hover:text-ink-strong"
      >
        <ArrowLeft className="size-4" aria-hidden /> Overview
      </a>

      <header className="max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-strong sm:text-3xl">
          {collection.title}
        </h1>
        <p className="mt-2 leading-relaxed text-ink-dim">{collection.blurb}</p>
      </header>

      <Note>
        <strong className="font-semibold text-ink">What qualifies:</strong> {collection.basis} This
        page lists whatever currently matches, so it cannot drift out of step with the dataset.
      </Note>

      <SectionTitle hint={`${fmt.format(members.length)} ${members.length === 1 ? 'problem' : 'problems'}`}>
        Contents
      </SectionTitle>

      {members.length === 0 ? (
        <EmptyState title="Nothing currently matches">
          The rule above returned no problems against this revision of the source article.
        </EmptyState>
      ) : (
        <ul className="space-y-2">
          {members.map((p) => (
            <ProblemRow key={p.id} problem={p} dark={dark} showYear={showYear} />
          ))}
        </ul>
      )}
    </div>
  );
}

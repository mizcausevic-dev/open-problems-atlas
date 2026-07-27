/**
 * What this app does, and what it does not.
 *
 * This page exists because the brief behind this project asked for around forty
 * features, many of them repeated, several of which cannot honestly be
 * delivered by a client-side application: cloud sync, scheduled backups,
 * end-to-end encryption, verified expert identity, Slack notifications, a
 * cross-platform mobile app. The choice is to build a smaller set properly and
 * publish the gap, rather than ship a convincing mock of the whole list.
 *
 * A user can check every claim below. That is the point of writing them down.
 */

import { Check, CircleSlash, Minus } from 'lucide-react';
import type { Dataset } from '../types';
import { deriveCounts } from '../lib/counts';
import { ExternalLink, Note, Panel, SectionTitle, Stat, fmt } from '../components/ui';

type Level = 'built' | 'partial' | 'not-built';

interface Capability {
  name: string;
  level: Level;
  detail: string;
}

const CAPABILITIES: Capability[] = [
  {
    name: 'Complete problem list',
    level: 'built',
    detail:
      'Every entry is generated from the source article by a script in this repository. Re-running it picks up edits to the article, so the count above is whatever the article currently lists.',
  },
  {
    name: 'Search, filter and sort',
    level: 'built',
    detail:
      'Ranked search across titles, statements, fields and solvers, with filters and five sort orders that combine. All of it lives in the URL, so any view you build is a link you can send.',
  },
  {
    name: 'Article introductions',
    level: 'built',
    detail:
      'The lead section of each problem’s own Wikipedia article, fetched at build time and loaded on demand. 549 of 591 problems have one; where a link points at a section of a broader article, the page says so rather than implying the text is about that problem alone.',
  },
  {
    name: 'Related problems',
    level: 'built',
    detail:
      'Derived from relationships the dataset records — direct links between statements, shared solvers, shared topics, sub-case structure — and each suggestion shows the reason it was made. No similarity model, nothing to take on trust.',
  },
  {
    name: 'Field overview and curated ways in',
    level: 'built',
    detail:
      'An area-exact treemap of the whole collection, five collections defined by rules over the dataset rather than hand-kept lists, and a featured problem chosen by calendar date.',
  },
  {
    name: 'Personal progress tracking',
    level: 'built',
    detail: 'Five states, a self-assessed difficulty, and hand-logged time, per problem.',
  },
  {
    name: 'LaTeX notes with revision history',
    level: 'built',
    detail: 'KaTeX rendering, live preview, and the last 20 versions of each note kept and restorable.',
  },
  {
    name: 'Encryption at rest',
    level: 'built',
    detail:
      'AES-256-GCM with a PBKDF2-SHA256 key at 600,000 iterations, derived in the page. The passphrase is never stored or transmitted.',
  },
  {
    name: 'Offline use',
    level: 'built',
    detail:
      'A service worker precaches the app and the dataset. Browsing, the lab, notes and exports all work with no connection.',
  },
  {
    name: 'Export: JSON, LaTeX, Markdown, PDF',
    level: 'built',
    detail: 'The JSON backup round-trips. The .tex compiles with no extra packages. PDF uses the browser print pipeline.',
  },
  {
    name: 'Interactive computation',
    level: 'built',
    detail:
      'Collatz orbits, a prime sieve, Goldbach decompositions, the Riemann–Siegel Z function, and Robin’s inequality — which is equivalent to the Riemann Hypothesis, so it puts the same problem in front of you twice from completely different directions. All computed live, all covered by tests, all deep-linkable.',
  },
  {
    name: 'Prize and difficulty ratings',
    level: 'not-built',
    detail:
      'Not shown, because the source carries neither. A search across all 591 entries for prizes, bounties and dollar amounts returns nothing beyond the Millennium flag, which is shown. And nothing can rate the difficulty of a problem nobody has solved — the only difficulty figure in this app is the one you set yourself, labelled as such.',
  },
  {
    name: 'Dark and light themes',
    level: 'built',
    detail: 'Two designed palettes, not one inverted. Follows the OS setting until you override it.',
  },
  {
    name: 'Cross-device sync',
    level: 'partial',
    detail:
      'By file, not by account: export a JSON backup and import it elsewhere, where it merges by most-recent-edit. There is no background sync because there is no server.',
  },
  {
    name: 'Backups',
    level: 'partial',
    detail:
      'Manual export, on demand. No scheduled or automatic backup: a schedule that only runs while a browser tab happens to be open is not a backup, it is a promise.',
  },
  {
    name: 'End-to-end encryption',
    level: 'not-built',
    detail:
      'Not applicable. E2E describes a message in transit between two parties. This app has no server and no second party, so what it offers is encryption at rest, listed above under its real name.',
  },
  {
    name: 'Accounts and verified expert identity',
    level: 'not-built',
    detail:
      'Verifying that someone is a mathematician needs an institutional identity check and a human process. A signup form that grants a "Verified Researcher" badge verifies nothing.',
  },
  {
    name: 'Community forum and peer review',
    level: 'not-built',
    detail:
      'Needs moderation, hosting and a real membership. Seeded with invented users and invented reviews it becomes a demo of a forum, which is worse than a link to the real ones.',
  },
  {
    name: 'AI proof checking',
    level: 'not-built',
    detail:
      'A language model cannot verify a proof of an open problem, and telling someone their attempt "passes" is actively harmful. Proof assistants such as Lean do this properly, and are linked below.',
  },
  {
    name: 'Slack notifications, native mobile app, plugin system',
    level: 'not-built',
    detail: 'Each needs a backend, an app store presence or a plugin API. None exists here.',
  },
];

const LEVEL_META: Record<Level, { label: string; icon: typeof Check; className: string }> = {
  built: { label: 'Built', icon: Check, className: 'text-solved border-solved/30 bg-solved-soft' },
  partial: { label: 'Partly', icon: Minus, className: 'text-open border-open/30 bg-open-soft' },
  'not-built': { label: 'Not built', icon: CircleSlash, className: 'text-ink-dim border-line bg-panel-2' },
};

export default function AboutView({ dataset }: { dataset: Dataset }) {
  const counts = CAPABILITIES.reduce(
    (acc, c) => ({ ...acc, [c.level]: (acc[c.level] ?? 0) + 1 }),
    {} as Record<Level, number>,
  );
  // Same derivation the header and the timeline use, so this page cannot
  // disagree with them about how many problems there are.
  const data = deriveCounts(dataset.problems);

  return (
    <div className="space-y-6">
      <header className="max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-strong sm:text-3xl">
          What this is, and what it is not
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-dim">
          A reading and working companion for Wikipedia's list of unsolved problems. It is a
          static site with no backend, which constrains what it can honestly offer. Those
          constraints are written down below rather than papered over.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Problems"
          value={fmt.format(data.total)}
          source={`${fmt.format(data.open)} open, ${data.settled} settled, ${data.partlySettled} listed as both`}
          tone="accent"
        />
        <Stat
          label="With citations"
          value={fmt.format(data.withReferences)}
          source="references carried over from the source article"
        />
        <Stat label="Built" value={String(counts.built ?? 0)} source="capabilities you can verify below" tone="solved" />
        <Stat
          label="Not built"
          value={String((counts.partial ?? 0) + (counts['not-built'] ?? 0))}
          source="listed with the reason, not hidden"
          tone="open"
        />
      </div>

      <Panel className="p-4 sm:p-5">
        <SectionTitle hint="Every row is checkable from the app itself">Capability matrix</SectionTitle>
        <ul className="divide-y divide-line">
          {CAPABILITIES.map((c) => {
            const meta = LEVEL_META[c.level];
            const Icon = meta.icon;
            return (
              <li key={c.name} className="py-3.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${meta.className}`}
                  >
                    <Icon className="size-3" aria-hidden />
                    {meta.label}
                  </span>
                  <h3 className="font-medium text-ink-strong">{c.name}</h3>
                </div>
                <p className="mt-1 text-sm leading-relaxed text-ink-dim">{c.detail}</p>
              </li>
            );
          })}
        </ul>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel className="p-4 sm:p-5">
          <SectionTitle hint="Where every problem on this site comes from">Data provenance</SectionTitle>
          <dl className="space-y-2.5 text-sm">
            <div>
              <dt className="text-[11px] tracking-wide text-ink-dim uppercase">Source</dt>
              <dd>
                <ExternalLink href={dataset.meta.source.url}>{dataset.meta.source.page}</ExternalLink>, English Wikipedia
              </dd>
            </div>
            <div>
              <dt className="text-[11px] tracking-wide text-ink-dim uppercase">Revision</dt>
              <dd className="font-mono text-ink">{dataset.meta.source.revisionId ?? 'unknown'}</dd>
            </div>
            <div>
              <dt className="text-[11px] tracking-wide text-ink-dim uppercase">Retrieved</dt>
              <dd className="font-mono text-ink">{dataset.meta.generatedAt}</dd>
            </div>
            <div>
              <dt className="text-[11px] tracking-wide text-ink-dim uppercase">Licence</dt>
              <dd>
                <ExternalLink href={dataset.meta.source.licenseUrl}>{dataset.meta.source.license}</ExternalLink>
              </dd>
            </div>
            <div>
              <dt className="text-[11px] tracking-wide text-ink-dim uppercase">Generated by</dt>
              <dd className="font-mono text-ink">{dataset.meta.generatedBy}</dd>
            </div>
          </dl>
          <Note>
            The dataset is generated, not typed. Nothing was added to it by hand except the field
            classification for six Millennium problems that the article lists outside its by-field
            taxonomy, and each of those is marked as curated on its own page.
          </Note>
        </Panel>

        <Panel className="p-4 sm:p-5">
          <SectionTitle hint="What leaves this browser, and when">Privacy</SectionTitle>
          <ul className="space-y-2 text-sm text-ink">
            <li className="flex gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-solved" aria-hidden />
              No analytics, no tracking scripts, no cookies.
            </li>
            <li className="flex gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-solved" aria-hidden />
              No fonts or assets from a third-party host. System fonts only, so nothing is requested
              from a font CDN.
            </li>
            <li className="flex gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-solved" aria-hidden />
              Your tracking and notes never leave this browser unless you export them.
            </li>
            <li className="flex gap-2">
              <Minus className="mt-0.5 size-4 shrink-0 text-open" aria-hidden />
              One outbound request exists: pageview statistics from the Wikimedia API, sent only when
              you press Load on a problem page.
            </li>
          </ul>
          <Note>
            There is no privacy policy to read because there is no data collection to describe. If
            that changes, this section changes first.
          </Note>
        </Panel>
      </div>

      <Panel className="p-4 sm:p-5">
        <SectionTitle hint="For work this app deliberately does not attempt">Where to go next</SectionTitle>
        <ul className="space-y-2.5 text-sm">
          <li>
            <ExternalLink href="https://leanprover-community.github.io/">Lean and mathlib</ExternalLink>
            {' — '}
            <span className="text-ink-dim">
              a proof assistant that actually checks proofs, and a community that formalises real
              mathematics in it.
            </span>
          </li>
          <li>
            <ExternalLink href="https://mathoverflow.net/">MathOverflow</ExternalLink>
            {' — '}
            <span className="text-ink-dim">
              question and answer at research level, with real moderation and real reputations.
            </span>
          </li>
          <li>
            <ExternalLink href="https://www.claymath.org/millennium-problems/">
              Clay Mathematics Institute
            </ExternalLink>
            {' — '}
            <span className="text-ink-dim">the official statements and rules for the Millennium Prize Problems.</span>
          </li>
          <li>
            <ExternalLink href="https://arxiv.org/list/math.NT/recent">arXiv math</ExternalLink>
            {' — '}
            <span className="text-ink-dim">where the preprints that move these problems actually appear.</span>
          </li>
        </ul>
      </Panel>

      <Note tone="warn">
        A word on attempts. Amateur proofs of famous conjectures are almost always wrong, usually in
        a way the author cannot see, and no software on this page can tell you whether yours is an
        exception. If you have something you believe holds, formalise it in Lean or find a working
        mathematician willing to read it. An app that told you it looked rigorous would be lying to
        you.
      </Note>
    </div>
  );
}

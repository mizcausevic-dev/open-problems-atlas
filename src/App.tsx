/**
 * Application shell: header, navigation, route switch.
 *
 * Mobile navigation is a full-screen sheet, not a horizontally scrolling row of
 * tabs. A scrolling tab strip hides its own overflow: items past the fold are
 * invisible and undiscoverable on the device where screen space is scarcest.
 */

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  BookMarked, BookOpen, Compass, FlaskConical, GaugeCircle, GraduationCap, History, Info, LayoutGrid, Menu, Moon, Sun,
  Search, WifiOff, X,
} from 'lucide-react';

import raw from './data/problems.generated.json';
import type { Dataset } from './types';
import { href, useLocation, type Route } from './lib/router';
import { deriveCounts } from './lib/counts';
import { atlasStateToParams, DEFAULT_ATLAS_STATE } from './lib/search';
import { store } from './lib/storage';
import { buildCommands } from './lib/palette';
import { COLLECTIONS, randomProblem } from './lib/collections';
import { CommandPalette, usePaletteHotkey } from './components/CommandPalette';
import { useDarkMode, useOnline, fmt } from './components/ui';

import OverviewView from './views/OverviewView';
import AtlasView from './views/AtlasView';
import ProblemView from './views/ProblemView';
import CollectionView from './views/CollectionView';
import DashboardView from './views/DashboardView';
import TimelineView from './views/TimelineView';
import LabView from './views/LabView';
import JournalView from './views/JournalView';
import AboutView from './views/AboutView';

const dataset = raw as unknown as Dataset;

/** Kept in step with LabView's TOOLS by a test, so the palette cannot list a dead tab. */
export const LAB_TOOLS = [
  { id: 'collatz', label: 'Collatz orbits' },
  { id: 'primes', label: 'Goldbach and primes' },
  { id: 'zeta', label: 'Zeta on the critical line' },
  { id: 'robin', label: "Robin's inequality" },
  { id: 'evidence', label: 'When evidence misled' },
  { id: 'covering', label: 'Covering sets' },
  { id: 'plot', label: 'Plot an expression' },
] as const;

const NAV: { route: Route; label: string; icon: typeof Compass }[] = [
  { route: { name: 'overview' }, label: 'Overview', icon: LayoutGrid },
  { route: { name: 'atlas' }, label: 'Atlas', icon: Compass },
  { route: { name: 'dashboard' }, label: 'Progress', icon: GaugeCircle },
  { route: { name: 'timeline' }, label: 'Solved', icon: History },
  { route: { name: 'lab' }, label: 'Lab', icon: FlaskConical },
  { route: { name: 'journal' }, label: 'Journal', icon: BookOpen },
  { route: { name: 'about' }, label: 'About', icon: Info },
];

export default function App() {
  const { route, query, navigate, setQuery } = useLocation();
  const [dark, toggleDark] = useDarkMode();
  const online = useOnline();
  const [menuOpen, setMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const reduceMotion = useReducedMotion();

  // The store is imperative; this re-renders the tree whenever it changes.
  useSyncExternalStore(store.subscribe, store.getSnapshot, () => 0);

  const problems = dataset.problems;
  const byId = useMemo(() => new Map(problems.map((p) => [p.id, p])), [problems]);
  const counts = useMemo(() => deriveCounts(problems), [problems]);

  const routeKey = route.name === 'problem' ? route.id : route.name === 'collection' ? route.slug : '';
  useEffect(() => setMenuOpen(false), [route.name, routeKey]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Prevent the page behind the mobile sheet from scrolling under it.
  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  const active = (r: Route) => r.name === route.name;
  const openProblem = (id: string) => navigate({ name: 'problem', id });

  /** Jump to the atlas pre-filtered to one field, from the overview treemap. */
  const openField = (field: string) =>
    navigate({ name: 'atlas' }, atlasStateToParams({ ...DEFAULT_ATLAS_STATE, fields: [field] }));

  const openPalette = useCallback(() => setPaletteOpen(true), []);
  usePaletteHotkey(openPalette);

  const commands = useMemo(
    () =>
      buildCommands(
        problems,
        [
          ...NAV.map((n) => ({
            id: `view:${n.label}`,
            kind: 'view' as const,
            title: n.label,
            href: href(n.route),
            keywords: n.label === 'Atlas' ? ['browse', 'search', 'filter'] : undefined,
          })),
          ...LAB_TOOLS.map((t) => ({
            id: `lab:${t.id}`,
            kind: 'lab' as const,
            title: t.label,
            hint: 'Lab',
            href: href({ name: 'lab', tool: t.id }),
          })),
          ...COLLECTIONS.map((c) => ({
            id: `collection:${c.slug}`,
            kind: 'collection' as const,
            title: c.title,
            hint: 'Collection',
            href: href({ name: 'collection', slug: c.slug }),
          })),
        ],
        [
          {
            id: 'action:random',
            title: 'Open a random problem',
            keywords: ['surprise', 'shuffle', 'lucky'],
            run: () => {
              const p = randomProblem(problems);
              if (p) navigate({ name: 'problem', id: p.id });
            },
          },
          {
            id: 'action:theme',
            title: dark ? 'Switch to the light theme' : 'Switch to the dark theme',
            keywords: ['dark', 'light', 'contrast', 'appearance'],
            run: toggleDark,
          },
          {
            id: 'action:print',
            title: 'Print or save as PDF',
            keywords: ['export', 'pdf'],
            run: () => window.print(),
          },
        ],
      ),
    [problems, dark, toggleDark, navigate],
  );

  return (
    <div className="min-h-dvh bg-bg">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-bg"
      >
        Skip to content
      </a>

      <header
        data-print="hide"
        className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-md"
      >
        <div className="edge-safe mx-auto flex max-w-[1400px] items-center gap-3 py-3">
          <a
            href={href({ name: 'overview' })}
            // Allowed to shrink, not shrink-0. Adding the palette button to the
            // right-hand group pushed the header 4px past the viewport at very
            // narrow widths, because a shrink-0 wordmark refuses to give way and
            // something has to.
            className="flex min-w-0 flex-1 items-center gap-2.5 xl:flex-none"
            aria-label="Open Problems Atlas, home"
          >
            <svg viewBox="0 0 64 64" className="size-8 shrink-0" aria-hidden>
              <rect width="64" height="64" rx="14" className="fill-panel-2" />
              <line x1="32" y1="12" x2="32" y2="52" stroke="var(--c-accent)" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.7" />
              <circle cx="32" cy="21" r="3" fill="var(--c-accent)" />
              <circle cx="32" cy="32" r="3" fill="var(--c-accent)" />
              <circle cx="32" cy="43" r="3" fill="var(--c-accent)" />
            </svg>
            <span className="min-w-0">
              <span className="block truncate text-[13px] leading-tight font-semibold tracking-tight text-ink-strong">
                Open Problems Atlas
              </span>
              <span className="hidden text-[11px] leading-tight text-ink-dim sm:block">
                {fmt.format(counts.open)} open · {counts.settled} settled · {counts.partlySettled} both
              </span>
            </span>
          </a>

          <nav className="ml-auto hidden items-center gap-0.5 xl:flex" aria-label="Main">
            {NAV.map(({ route: r, label, icon: Icon }) => (
              <a
                key={label}
                href={href(r)}
                aria-current={active(r) ? 'page' : undefined}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                  active(r)
                    ? 'bg-panel-2 font-semibold text-ink-strong'
                    : 'text-ink-dim hover:bg-panel-2 hover:text-ink-strong'
                }`}
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </a>
            ))}

            {/* Not a NAV entry, because it is not a route. The glossary is a set
                of static documents at real paths, served without this app; a
                plain anchor is a full navigation and that is correct. */}
            <a
              href="/glossary/"
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm text-ink-dim transition-colors hover:bg-panel-2 hover:text-ink-strong"
            >
              <BookMarked className="size-4" aria-hidden />
              Glossary
            </a>
            <a
              href="/quiz/"
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm text-ink-dim transition-colors hover:bg-panel-2 hover:text-ink-strong"
            >
              <GraduationCap className="size-4" aria-hidden />
              Quiz
            </a>
          </nav>

          <div className="ml-auto flex items-center gap-1 xl:ml-2">
            <button
              type="button"
              onClick={openPalette}
              // The hotkey is invisible unless something advertises it.
              className="mr-1 hidden items-center gap-2 rounded-lg border border-line bg-panel px-2.5 py-1.5 text-xs text-ink-dim transition-colors hover:border-accent/50 hover:text-ink-strong sm:flex"
              aria-label="Open the command palette"
            >
              <Search className="size-3.5" aria-hidden />
              <span>Jump to…</span>
              <kbd className="rounded border border-line px-1 font-mono text-[10px]">
                {navigator.platform.toLowerCase().includes('mac') ? '⌘' : 'Ctrl'}K
              </kbd>
            </button>

            <button
              type="button"
              onClick={openPalette}
              className="rounded-lg p-2 text-ink-dim transition-colors hover:bg-panel-2 hover:text-ink-strong sm:hidden"
              aria-label="Open the command palette"
            >
              <Search className="size-[1.125rem]" aria-hidden />
            </button>

            {!online && (
              <span
                className="flex items-center gap-1.5 rounded-full border border-open/40 bg-open-soft px-2 py-1 text-[11px] font-medium text-open"
                title="You are offline. The atlas, lab and journal work; Wikipedia links and pageview statistics do not."
              >
                <WifiOff className="size-3.5" aria-hidden />
                <span className="hidden sm:inline">Offline</span>
              </span>
            )}

            <button
              type="button"
              onClick={toggleDark}
              className="rounded-lg p-2 text-ink-dim transition-colors hover:bg-panel-2 hover:text-ink-strong"
              aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
            >
              {dark ? <Sun className="size-[1.125rem]" aria-hidden /> : <Moon className="size-[1.125rem]" aria-hidden />}
            </button>

            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="rounded-lg p-2 text-ink-dim transition-colors hover:bg-panel-2 hover:text-ink-strong xl:hidden"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            key="sheet"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="sheet fixed inset-0 z-40 overflow-y-auto bg-bg/95 backdrop-blur-sm xl:hidden"
          >
            <nav className="mx-auto flex max-w-lg flex-col gap-1 px-4 pt-20 pb-8" aria-label="Main">
              {NAV.map(({ route: r, label, icon: Icon }, i) => (
                <motion.a
                  key={label}
                  href={href(r)}
                  initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: reduceMotion ? 0 : i * 0.03, duration: 0.2 }}
                  aria-current={active(r) ? 'page' : undefined}
                  className={`flex items-center gap-3 rounded-xl border px-4 py-3.5 text-base ${
                    active(r)
                      ? 'border-accent/40 bg-accent-soft font-semibold text-accent-ink'
                      : 'border-line bg-panel text-ink'
                  }`}
                >
                  <Icon className="size-5 shrink-0" aria-hidden />
                  {label}
                </motion.a>
              ))}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      <CommandPalette commands={commands} open={paletteOpen} onClose={() => setPaletteOpen(false)} />

      <main id="main" className="edge-safe mx-auto max-w-[1400px] py-6 sm:py-8">
        {route.name === 'overview' && (
          <OverviewView dataset={dataset} dark={dark} onOpen={openProblem} onField={openField} />
        )}
        {route.name === 'atlas' && (
          <AtlasView
            dataset={dataset}
            dark={dark}
            query={query}
            setQuery={setQuery}
            onOpen={openProblem}
          />
        )}
        {route.name === 'problem' && (
          <ProblemView
            problem={byId.get(route.id)}
            dataset={dataset}
            dark={dark}
            online={online}
          />
        )}
        {route.name === 'collection' && (
          <CollectionView slug={route.slug} dataset={dataset} dark={dark} />
        )}
        {route.name === 'dashboard' && (
          <DashboardView dataset={dataset} dark={dark} onOpen={openProblem} />
        )}
        {route.name === 'timeline' && (
          <TimelineView dataset={dataset} dark={dark} onOpen={openProblem} />
        )}
        {route.name === 'lab' && (
          <LabView tool={route.tool} query={query} setQuery={setQuery} dark={dark} />
        )}
        {route.name === 'journal' && <JournalView dataset={dataset} onOpen={openProblem} />}
        {route.name === 'about' && <AboutView dataset={dataset} />}
      </main>

      <footer data-print="hide" className="edge-safe border-t border-line py-8">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-2 text-xs text-ink-dim">
          <p>
            Problem data from the English Wikipedia article{' '}
            <a
              className="text-accent underline underline-offset-2"
              href={dataset.meta.source.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              List of unsolved problems in mathematics
            </a>
            , revision {dataset.meta.source.revisionId ?? 'unknown'}, retrieved {dataset.meta.generatedAt}.
            Article introductions are from the same project. Both reused under{' '}
            <a
              className="text-accent underline underline-offset-2"
              href={dataset.meta.source.licenseUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {dataset.meta.source.license}
            </a>
            .
          </p>
          <p>
            Your tracking and notes stay in this browser. Nothing is uploaded, because there is no
            server to upload to.{' '}
            <a className="text-accent underline underline-offset-2" href={href({ name: 'about' })}>
              What this app does and does not do
            </a>
            .
          </p>
          <p>
            Unfamiliar with a term?{' '}
            <a className="text-accent underline underline-offset-2" href="/glossary/">
              The glossary
            </a>{' '}
            defines the vocabulary used across this atlas, each entry stating the condition that
            definitions of it usually leave out, and the{' '}
            <a className="text-accent underline underline-offset-2" href="/quiz/">
              quiz
            </a>{' '}
            checks whether it stuck.
          </p>
        </div>
      </footer>
    </div>
  );
}


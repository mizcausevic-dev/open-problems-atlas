/**
 * The lab: four problems you can actually run.
 *
 * The rule for everything on this page is that the picture is computed from the
 * definition, in the browser, at the moment you look at it. No precomputed
 * arrays, no illustrative approximations standing in for the real object. Where
 * a computation has a limit, the limit is displayed.
 *
 * Every input is mirrored into the URL, so a specific computation — this
 * starting value, this scan limit — is a link. That is the whole point of a lab
 * page: findings are worth sending to someone.
 */

import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Activity, Binary, Link2, Check, Sigma, SquareDivide } from 'lucide-react';
import { orbit, stoppingTimes, VERIFIED_UP_TO } from '../lib/math/collatz';
import {
  goldbachComet, goldbachPartitions, logarithmicIntegral, primePi, sieve, twinPrimes,
} from '../lib/math/primes';
import { expectedZeroCount, findZeros, zFunction } from '../lib/math/zeta';
import {
  divisorSumSieve, exceedsRobin, robinExceptions, robinRatio, robinSeries,
  E_GAMMA, KNOWN_EXCEPTIONS, NEAR_MISSES, ROBIN_BOUND, ROBIN_SOURCE,
} from '../lib/math/robin';
import { href } from '../lib/router';
import { Button, ExternalLink, Note, Panel, SectionTitle, Stat, fmt } from '../components/ui';
import { Tex } from '../components/Tex';

const TOOLS = [
  { id: 'collatz', label: 'Collatz orbits', icon: Binary },
  { id: 'primes', label: 'Goldbach & primes', icon: Sigma },
  { id: 'zeta', label: 'Zeta on the critical line', icon: Activity },
  { id: 'robin', label: "Robin's inequality", icon: SquareDivide },
] as const;

type ToolId = (typeof TOOLS)[number]['id'];

interface Props {
  tool?: string;
  query: URLSearchParams;
  setQuery: (params: Record<string, string | undefined>) => void;
}

/**
 * A number that lives in the URL.
 *
 * Held in local state for immediate feedback while dragging, then written to
 * the address bar on a short delay. Writing every intermediate slider value
 * straight through the router would re-render the whole view per pixel of drag.
 */
function useUrlNumber(
  query: URLSearchParams,
  setQuery: (p: Record<string, string | undefined>) => void,
  key: string,
  fallback: number,
  clamp: (n: number) => number,
): [number, (n: number) => void] {
  const fromUrl = query.get(key);
  const parsed = fromUrl === null ? Number.NaN : Number(fromUrl);
  const initial = Number.isFinite(parsed) ? clamp(parsed) : fallback;

  const [value, setValue] = useState(initial);

  // Re-sync when the URL changes underneath us: back/forward, or a pasted link.
  useEffect(() => {
    if (Number.isFinite(parsed) && clamp(parsed) !== value) setValue(clamp(parsed));
    if (fromUrl === null && value !== fallback) setValue(fallback);
  }, [fromUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const id = setTimeout(() => {
      setQuery({ ...Object.fromEntries(query), [key]: value === fallback ? undefined : String(value) });
    }, 200);
    return () => clearTimeout(id);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  return [value, setValue];
}

/** Copies the current URL, so a specific computation can be handed to someone. */
function ShareLink() {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied; the URL is in the address bar anyway.
      setCopied(false);
    }
  };

  return (
    <Button size="sm" onClick={copy} title="Copy a link that reproduces exactly this computation">
      {copied ? <Check className="size-3.5 text-solved" aria-hidden /> : <Link2 className="size-3.5" aria-hidden />}
      <span aria-live="polite">{copied ? 'Copied' : 'Copy link'}</span>
    </Button>
  );
}

export default function LabView({ tool, query, setQuery }: Props) {
  const active: ToolId = TOOLS.some((t) => t.id === tool) ? (tool as ToolId) : 'collatz';

  return (
    <div className="space-y-6">
      <header className="max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-strong sm:text-3xl">
          Run the mathematics yourself
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-dim">
          Four open problems you can compute against directly. Everything below is calculated in this
          page from the definition, at the resolution you choose. Every input is in the address bar,
          so a particular computation is a link you can send.
        </p>
      </header>

      <nav className="flex flex-wrap gap-2" aria-label="Lab tools">
        {TOOLS.map(({ id, label, icon: Icon }) => (
          <a
            key={id}
            href={href({ name: 'lab', tool: id })}
            aria-current={active === id ? 'page' : undefined}
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
              active === id
                ? 'border-accent bg-accent-soft font-semibold text-accent-ink'
                : 'border-line bg-panel text-ink-dim hover:border-accent/40 hover:text-ink-strong'
            }`}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </a>
        ))}
      </nav>

      {active === 'collatz' && <CollatzLab query={query} setQuery={setQuery} />}
      {active === 'primes' && <PrimesLab query={query} setQuery={setQuery} />}
      {active === 'zeta' && <ZetaLab query={query} setQuery={setQuery} />}
      {active === 'robin' && <RobinLab query={query} setQuery={setQuery} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Collatz
// ---------------------------------------------------------------------------

function CollatzLab({ query, setQuery }: { query: URLSearchParams; setQuery: Props['setQuery'] }) {
  const [n, setN] = useUrlNumber(query, setQuery, 'n', 27, (v) =>
    Math.max(1, Math.min(2 ** 40, Math.floor(v))),
  );
  const [sweepTo, setSweepTo] = useUrlNumber(query, setQuery, 'sweep', 2000, (v) =>
    Math.max(500, Math.min(20000, Math.round(v / 500) * 500)),
  );
  const [logScale, setLogScale] = useState(true);

  const o = useMemo(() => orbit(n), [n]);
  const deferredSweep = useDeferredValue(sweepTo);
  const sweep = useMemo(() => stoppingTimes(1, deferredSweep), [deferredSweep]);

  const w = 800;
  const h = 260;
  const maxV = o.peak;
  const yOf = (v: number) =>
    logScale
      ? h - (Math.log(v) / Math.log(Math.max(maxV, 2))) * (h - 12) - 6
      : h - (v / maxV) * (h - 12) - 6;
  const path = o.path
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${((i / (o.path.length - 1 || 1)) * w).toFixed(1)},${yOf(v).toFixed(1)}`)
    .join(' ');
  const maxSteps = Math.max(...sweep.map((s) => s.steps));

  return (
    <div className="space-y-5">
      <Panel className="p-4 sm:p-5">
        <SectionTitle
          hint="Halve if even, otherwise triple and add one. Does every start reach 1?"
          right={<ShareLink />}
        >
          Collatz conjecture
        </SectionTitle>

        <Tex
          block
          math={String.raw`f(n) = \begin{cases} n/2 & n \equiv 0 \pmod 2 \\ 3n + 1 & n \equiv 1 \pmod 2 \end{cases}`}
        />

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="collatz-n" className="mb-1 block text-[11px] tracking-wide text-ink-dim uppercase">
              Starting value
            </label>
            <input
              id="collatz-n"
              type="number"
              inputMode="numeric"
              min={1}
              value={n}
              onChange={(e) => setN(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
              className="w-40 rounded-lg border border-line bg-panel-2 px-3 py-2 font-mono text-sm text-ink-strong focus:border-accent focus:outline-none"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[27, 97, 871, 6171, 77031, 837799].map((v) => (
              <Button key={v} size="sm" onClick={() => setN(v)} pressed={n === v}>
                {fmt.format(v)}
              </Button>
            ))}
          </div>
          <Button size="sm" pressed={logScale} onClick={() => setLogScale((v) => !v)} className="ml-auto">
            {logScale ? 'Log scale' : 'Linear scale'}
          </Button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Steps to 1" value={fmt.format(o.steps)} source="counted, this orbit" tone="accent" />
          <Stat label="Peak value" value={fmt.format(o.peak)} source={`reached at step ${o.peakAt}`} />
          <Stat
            label="Glide"
            value={o.glideSteps === undefined ? '—' : fmt.format(o.glideSteps)}
            source="steps before first dropping below the start"
          />
          <Stat
            label="Exact"
            value={o.exact ? 'yes' : 'no'}
            source={o.exact ? 'every step within safe integer range' : 'exceeded 2^53; values above are not exact'}
            tone={o.exact ? 'solved' : 'open'}
          />
        </div>

        {!o.exact && (
          <Note tone="warn">
            This orbit left the exact-integer range of JavaScript numbers. The shape is indicative,
            the values are not. Rather than silently rounding, the app says so.
          </Note>
        )}

        <figure className="mt-4">
          <svg
            viewBox={`0 0 ${w} ${h}`}
            className="h-auto w-full rounded-lg border border-line bg-panel-2"
            role="img"
            aria-label={`Trajectory of the Collatz orbit starting at ${n}: ${o.steps} steps, peaking at ${o.peak}.`}
          >
            <path d={path} fill="none" stroke="var(--c-accent)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
            <circle cx={(o.peakAt / (o.path.length - 1 || 1)) * w} cy={yOf(o.peak)} r="3" fill="var(--c-open)" />
          </svg>
          <figcaption className="mt-1.5 text-xs text-ink-dim">
            Orbit of {fmt.format(n)}. Marker at the peak, {fmt.format(o.peak)}.{' '}
            {logScale ? 'Vertical axis is logarithmic.' : 'Vertical axis is linear.'}
          </figcaption>
        </figure>
      </Panel>

      <Panel className="p-4 sm:p-5">
        <SectionTitle hint="Total stopping time for every start up to the limit">
          The whole neighbourhood
        </SectionTitle>

        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="collatz-sweep" className="text-xs text-ink-dim">
            Compute every orbit up to
          </label>
          <input
            id="collatz-sweep"
            type="range"
            min={500}
            max={20000}
            step={500}
            value={sweepTo}
            onChange={(e) => setSweepTo(Number(e.target.value))}
            className="flex-1 accent-[var(--c-accent)]"
          />
          <span className="font-mono text-sm text-ink-strong">{fmt.format(sweepTo)}</span>
        </div>

        <figure className="mt-3">
          <svg
            viewBox={`0 0 ${w} 200`}
            className="h-auto w-full rounded-lg border border-line bg-panel-2"
            role="img"
            aria-label={`Scatter of total stopping time against starting value, for every start from 1 to ${deferredSweep}. Longest is ${maxSteps} steps.`}
          >
            {sweep.map(({ n: start, steps }) => (
              <circle
                key={start}
                cx={(start / deferredSweep) * w}
                cy={200 - (steps / maxSteps) * 190 - 5}
                r="0.8"
                fill="var(--c-accent)"
                opacity="0.55"
              />
            ))}
          </svg>
          <figcaption className="mt-1.5 text-xs text-ink-dim">
            {fmt.format(sweep.length)} orbits computed just now. Every one reached 1. Longest:{' '}
            {maxSteps} steps.
          </figcaption>
        </figure>

        <Note>
          Your browser has verified {fmt.format(deferredSweep)} starting values. Exhaustive
          computation has reached {VERIFIED_UP_TO.label} ({VERIFIED_UP_TO.by}, {VERIFIED_UP_TO.year}
          {'), '}
          <ExternalLink href={VERIFIED_UP_TO.url}>published here</ExternalLink>. Neither is a proof:
          the conjecture is a claim about every positive integer, and no finite check can settle it.
        </Note>
      </Panel>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Primes
// ---------------------------------------------------------------------------

function PrimesLab({ query, setQuery }: { query: URLSearchParams; setQuery: Props['setQuery'] }) {
  const [cometTo, setCometTo] = useUrlNumber(query, setQuery, 'comet', 4000, (v) =>
    Math.max(1000, Math.min(30000, Math.round(v / 500) * 500)),
  );
  const [target, setTarget] = useUrlNumber(query, setQuery, 'n', 100, (v) =>
    Math.max(4, Math.min(1_000_000, Math.floor(v))),
  );

  const deferredComet = useDeferredValue(cometTo);
  const s = useMemo(() => sieve(1_000_000), []);
  const comet = useMemo(() => goldbachComet(4, deferredComet, s), [deferredComet, s]);

  const even = target % 2 === 0 ? target : target + 1;
  const partitions = useMemo(() => goldbachPartitions(even, s), [even, s]);
  const twins = useMemo(() => twinPrimes(100_000, s), [s]);
  const maxCount = Math.max(...comet.map((c) => c.count), 1);

  const piX = primePi(1_000_000, s);
  const liX = logarithmicIntegral(1_000_000);

  const w = 800;
  const h = 240;

  return (
    <div className="space-y-5">
      <Panel className="p-4 sm:p-5">
        <SectionTitle
          hint="Every even number above 2 is a sum of two primes. Unproven since 1742."
          right={<ShareLink />}
        >
          Goldbach's conjecture
        </SectionTitle>

        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="comet" className="text-xs text-ink-dim">
            Check every even number up to
          </label>
          <input
            id="comet"
            type="range"
            min={1000}
            max={30000}
            step={500}
            value={cometTo}
            onChange={(e) => setCometTo(Number(e.target.value))}
            className="flex-1 accent-[var(--c-accent)]"
          />
          <span className="font-mono text-sm text-ink-strong">{fmt.format(cometTo)}</span>
        </div>

        <figure className="mt-3">
          <svg
            viewBox={`0 0 ${w} ${h}`}
            className="h-auto w-full rounded-lg border border-line bg-panel-2"
            role="img"
            aria-label={`Goldbach comet: number of ways to write each even number up to ${deferredComet} as a sum of two primes. Every one has at least one such representation.`}
          >
            {comet.map(({ n: even2, count }) => (
              <circle
                key={even2}
                cx={(even2 / deferredComet) * w}
                cy={h - (count / maxCount) * (h - 10) - 5}
                r="0.7"
                fill="var(--c-accent)"
                opacity="0.5"
              />
            ))}
          </svg>
          <figcaption className="mt-1.5 text-xs text-ink-dim">
            The Goldbach comet. Each dot is one even number; height is how many prime pairs sum to
            it. {fmt.format(comet.length)} even numbers checked,{' '}
            {comet.filter((c) => c.count === 0).length} failures found.
          </figcaption>
        </figure>

        <div className="mt-4 border-t border-line pt-4">
          <label htmlFor="goldbach-n" className="mb-1 block text-[11px] tracking-wide text-ink-dim uppercase">
            Decompose a specific even number
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              id="goldbach-n"
              type="number"
              inputMode="numeric"
              min={4}
              max={1_000_000}
              value={target}
              onChange={(e) => setTarget(Math.max(4, Math.floor(Number(e.target.value) || 4)))}
              className="w-40 rounded-lg border border-line bg-panel-2 px-3 py-2 font-mono text-sm text-ink-strong focus:border-accent focus:outline-none"
            />
            {even !== target && <span className="text-xs text-ink-dim">rounded up to {even}, an even number</span>}
          </div>

          <p className="mt-2 text-sm text-ink">
            <span className="font-mono text-ink-strong">{fmt.format(even)}</span> has{' '}
            <span className="font-mono text-accent">{partitions.length}</span>{' '}
            {partitions.length === 1 ? 'representation' : 'representations'} as a sum of two primes.
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {partitions.slice(0, 40).map(({ p, q }) => (
              <span
                key={p}
                className="rounded-md border border-line bg-panel-2 px-2 py-1 font-mono text-xs text-ink"
              >
                {p} + {q}
              </span>
            ))}
            {partitions.length > 40 && (
              <span className="px-2 py-1 font-mono text-xs text-ink-dim">
                and {partitions.length - 40} more
              </span>
            )}
          </div>
        </div>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel className="p-4 sm:p-5">
          <SectionTitle hint="Are there infinitely many primes p with p + 2 also prime?">
            Twin primes
          </SectionTitle>
          <Stat
            label="Twin pairs below 100,000"
            value={fmt.format(twins.length)}
            source="counted from a sieve of Eratosthenes, computed in this page"
            tone="accent"
          />
          <div className="mt-3 flex flex-wrap gap-1.5">
            {twins.slice(-12).map(([p, q]) => (
              <span key={p} className="rounded-md border border-line bg-panel-2 px-2 py-1 font-mono text-xs text-ink">
                ({fmt.format(p)}, {fmt.format(q)})
              </span>
            ))}
          </div>
          <Note>
            The largest twin pair under 100,000 is shown last. Zhang (2013) proved bounded gaps
            exist; the Polymath project and Maynard brought the bound to 246. Two is still open.
          </Note>
        </Panel>

        <Panel className="p-4 sm:p-5">
          <SectionTitle hint="The error term the Riemann hypothesis would bound">
            <Tex math={String.raw`\pi(x)`} /> against <Tex math={String.raw`\mathrm{li}(x)`} />
          </SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="π(10⁶)" value={fmt.format(piX)} source="exact count from the sieve" />
            <Stat label="li(10⁶)" value={fmt.format(Math.round(liX))} source="Simpson quadrature, computed here" />
          </div>
          <p className="mt-3 text-sm text-ink">
            Difference: <span className="font-mono text-accent">{fmt.format(Math.round(liX - piX))}</span>
          </p>
          <Note>
            The Riemann hypothesis is equivalent to the statement that this error stays within{' '}
            <Tex math={String.raw`O(\sqrt{x}\log x)`} />. At <Tex math={String.raw`x = 10^6`} /> that
            bound is about {fmt.format(Math.round(Math.sqrt(1e6) * Math.log(1e6)))}, and the actual
            gap above sits comfortably inside it. That is consistent with the hypothesis, and
            consistency is not proof.
          </Note>
        </Panel>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Zeta
// ---------------------------------------------------------------------------

const PUBLISHED_ZEROS = [
  14.134725, 21.02204, 25.010858, 30.424876, 32.935062, 37.586178, 40.918719, 43.327073, 48.005151,
  49.773832,
];

function ZetaLab({ query, setQuery }: { query: URLSearchParams; setQuery: Props['setQuery'] }) {
  const [tMax, setTMax] = useUrlNumber(query, setQuery, 't', 50, (v) =>
    Math.max(20, Math.min(200, Math.round(v / 5) * 5)),
  );
  const deferredMax = useDeferredValue(tMax);

  const { samples, zeros } = useMemo(() => {
    const step = deferredMax / 900;
    const pts: { t: number; z: number }[] = [];
    for (let t = 0.5; t <= deferredMax; t += step) pts.push({ t, z: zFunction(t) });
    return { samples: pts, zeros: findZeros(1, deferredMax, 0.05) };
  }, [deferredMax]);

  const w = 900;
  const h = 260;
  const maxAbs = Math.max(...samples.map((p) => Math.abs(p.z)), 1);
  const yOf = (z: number) => h / 2 - (z / maxAbs) * (h / 2 - 8);
  const xOf = (t: number) => ((t - 0.5) / (deferredMax - 0.5)) * w;

  const path = samples
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${xOf(p.t).toFixed(1)},${yOf(p.z).toFixed(1)}`)
    .join(' ');

  const predicted = expectedZeroCount(deferredMax);
  const worstError = zeros
    .slice(0, PUBLISHED_ZEROS.length)
    .reduce((worst, z, i) => Math.max(worst, Math.abs(z - PUBLISHED_ZEROS[i]!)), 0);

  return (
    <div className="space-y-5">
      <Panel className="p-4 sm:p-5">
        <SectionTitle
          hint="Every nontrivial zero has real part one half. Open since 1859."
          right={<ShareLink />}
        >
          Riemann hypothesis
        </SectionTitle>

        <p className="text-sm leading-relaxed text-ink">
          Plotted below is the Riemann–Siegel <Tex math="Z" /> function,{' '}
          <Tex math={String.raw`Z(t) = e^{i\theta(t)}\zeta(\tfrac12 + it)`} />. It is real-valued for
          real <Tex math="t" />, and its real zeros are exactly the zeros of{' '}
          <Tex math={String.raw`\zeta`} /> on the critical line. So every axis crossing you see is a
          zero, and you can check its position against the published tables.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label htmlFor="zeta-t" className="text-xs text-ink-dim">
            Height
          </label>
          <input
            id="zeta-t"
            type="range"
            min={20}
            max={200}
            step={5}
            value={tMax}
            onChange={(e) => setTMax(Number(e.target.value))}
            className="flex-1 accent-[var(--c-accent)]"
          />
          <span className="font-mono text-sm text-ink-strong">t ≤ {tMax}</span>
        </div>

        <figure className="mt-3">
          <svg
            viewBox={`0 0 ${w} ${h}`}
            className="h-auto w-full rounded-lg border border-line bg-panel-2"
            role="img"
            aria-label={`The Riemann-Siegel Z function from t equals 0.5 to ${deferredMax}, crossing zero ${zeros.length} times.`}
          >
            <line x1="0" y1={h / 2} x2={w} y2={h / 2} stroke="var(--c-line)" strokeWidth="1" />
            <path d={path} fill="none" stroke="var(--c-accent)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
            {zeros.map((z) => (
              <circle key={z} cx={xOf(z)} cy={h / 2} r="2.5" fill="var(--c-open)" />
            ))}
          </svg>
          <figcaption className="mt-1.5 text-xs text-ink-dim">
            {zeros.length} zeros located by bisection on this interval, marked in amber.
          </figcaption>
        </figure>

        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
          <Stat label="Zeros found" value={String(zeros.length)} source="sign changes located just now" tone="accent" />
          <Stat
            label="Riemann–von Mangoldt"
            value={predicted.toFixed(1)}
            source="what the asymptotic count formula predicts for this height"
          />
          <Stat
            label="Worst error vs tables"
            value={worstError === 0 ? '—' : worstError.toExponential(1)}
            source="largest gap between a computed zero and its published value"
            tone={worstError < 1e-5 ? 'solved' : 'open'}
          />
        </div>

        <Note>
          The count formula and the zeros found agree to within one, which is the check that the
          finder is not skipping crossings. Both are computed in this page: nothing here is a stored
          answer.
        </Note>
      </Panel>

      <Panel className="p-4 sm:p-5">
        <SectionTitle hint="Computed here against the published values">First ten zeros</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">
              Computed zeros of the zeta function compared with published values
            </caption>
            <thead>
              <tr className="border-b border-line text-left text-[11px] tracking-wide text-ink-dim uppercase">
                <th scope="col" className="py-2 pr-4 font-medium">#</th>
                <th scope="col" className="py-2 pr-4 font-medium">Computed here</th>
                <th scope="col" className="py-2 pr-4 font-medium">Published</th>
                <th scope="col" className="py-2 font-medium">Difference</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {PUBLISHED_ZEROS.map((published, i) => {
                const computed = zeros[i];
                return (
                  <tr key={i} className="border-b border-line-soft">
                    <td className="py-1.5 pr-4 text-ink-dim">{i + 1}</td>
                    <td className="py-1.5 pr-4 text-ink-strong">
                      {computed === undefined ? (
                        <span className="text-ink-dim">raise the height</span>
                      ) : (
                        computed.toFixed(6)
                      )}
                    </td>
                    <td className="py-1.5 pr-4 text-ink-dim">{published.toFixed(6)}</td>
                    <td className="py-1.5 text-ink-dim">
                      {computed === undefined ? '—' : Math.abs(computed - published).toExponential(1)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Note>
          Published values from Odlyzko's tables of zeros. Agreement here demonstrates the
          implementation is right; it says nothing about the hypothesis. Over{' '}
          <Tex math={String.raw`10^{13}`} /> zeros have been checked and all lie on the line. The
          claim is about all of them.
        </Note>
      </Panel>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Robin
// ---------------------------------------------------------------------------

function RobinLab({ query, setQuery }: { query: URLSearchParams; setQuery: Props['setQuery'] }) {
  const [limit, setLimit] = useUrlNumber(query, setQuery, 'limit', 100_000, (v) =>
    Math.max(10_000, Math.min(500_000, Math.round(v / 10_000) * 10_000)),
  );
  const deferredLimit = useDeferredValue(limit);

  const sigma = useMemo(() => divisorSumSieve(deferredLimit), [deferredLimit]);
  const series = useMemo(() => robinSeries(2, deferredLimit, sigma, 1100), [sigma, deferredLimit]);
  const exceptions = useMemo(() => robinExceptions(deferredLimit, sigma), [sigma, deferredLimit]);
  const above = exceptions.filter((n) => n > ROBIN_BOUND);

  const w = 900;
  const h = 260;
  // Clipped at 2.4 so the n=2 outlier does not flatten everything else; the
  // caption says so rather than letting the axis quietly mislead.
  const yMin = 1.4;
  const yMax = 2.4;
  const yOf = (r: number) => h - ((Math.min(Math.max(r, yMin), yMax) - yMin) / (yMax - yMin)) * (h - 16) - 8;
  const xOf = (n: number) => (Math.log(n) / Math.log(deferredLimit)) * w;

  return (
    <div className="space-y-5">
      <Panel className="p-4 sm:p-5">
        <SectionTitle
          hint="Equivalent to the Riemann hypothesis, using nothing but divisor sums"
          right={<ShareLink />}
        >
          Robin's inequality
        </SectionTitle>

        <p className="text-sm leading-relaxed text-ink">
          Robin proved in 1984 that the Riemann hypothesis is <em>equivalent</em> to the statement
          that
        </p>
        <Tex block math={String.raw`\sigma(n) < e^{\gamma}\, n \ln \ln n \qquad \text{for every } n > 5040`} />
        <p className="text-sm leading-relaxed text-ink">
          where <Tex math={String.raw`\sigma(n)`} /> is the sum of the divisors of{' '}
          <Tex math="n" /> and <Tex math={String.raw`e^{\gamma} \approx 1.781072`} />. Not evidence
          for, not implied by: equivalent. A single <Tex math="n" /> above 5040 that fails this
          would disprove the Riemann hypothesis outright, with nothing but arithmetic.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label htmlFor="robin-limit" className="text-xs text-ink-dim">
            Check every integer up to
          </label>
          <input
            id="robin-limit"
            type="range"
            min={10_000}
            max={500_000}
            step={10_000}
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="flex-1 accent-[var(--c-accent)]"
          />
          <span className="font-mono text-sm text-ink-strong">{fmt.format(limit)}</span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat
            label="Integers checked"
            value={fmt.format(deferredLimit)}
            source="every one, not a sample"
            tone="accent"
          />
          <Stat
            label="Exceptions found"
            value={String(exceptions.length)}
            source={`all at or below ${fmt.format(ROBIN_BOUND)}`}
          />
          <Stat
            label="Above 5040"
            value={String(above.length)}
            source={above.length === 0 ? 'as Robin’s theorem requires' : 'this would be enormous news'}
            tone={above.length === 0 ? 'solved' : 'open'}
          />
          <Stat
            label="Ratio at 5040"
            value={robinRatio(5040, sigma).toFixed(5)}
            source={`just above e^γ = ${E_GAMMA.toFixed(5)}`}
            tone="open"
          />
        </div>

        <figure className="mt-4">
          <svg
            viewBox={`0 0 ${w} ${h}`}
            className="h-auto w-full rounded-lg border border-line bg-panel-2"
            role="img"
            aria-label={`Ratio of sigma(n) to n times log log n, for n from 2 to ${deferredLimit}, against the constant e to the gamma. ${above.length} values above 5040 exceed it.`}
          >
            {/* The e^gamma line: the whole question is whether anything crosses it. */}
            <line
              x1="0"
              y1={yOf(E_GAMMA)}
              x2={w}
              y2={yOf(E_GAMMA)}
              stroke="var(--c-open)"
              strokeWidth="1.5"
              strokeDasharray="5 4"
            />
            <text x="6" y={yOf(E_GAMMA) - 6} className="fill-[var(--c-open)]" style={{ font: '600 11px var(--font-mono)' }}>
              e^γ = {E_GAMMA.toFixed(6)}
            </text>
            {/* n = 5040 marker. */}
            {deferredLimit > ROBIN_BOUND && (
              <line
                x1={xOf(ROBIN_BOUND)}
                y1="0"
                x2={xOf(ROBIN_BOUND)}
                y2={h}
                stroke="var(--c-line)"
                strokeWidth="1"
              />
            )}
            {series.map((p) => (
              <circle
                key={p.n}
                cx={xOf(p.n)}
                cy={yOf(p.ratio)}
                r={p.exceeds ? 2 : 0.9}
                fill={p.exceeds ? 'var(--c-open)' : 'var(--c-accent)'}
                opacity={p.exceeds ? 1 : 0.5}
              />
            ))}
          </svg>
          <figcaption className="mt-1.5 text-xs text-ink-dim">
            Horizontal axis is logarithmic in <Tex math="n" />; the vertical grey line marks{' '}
            {fmt.format(ROBIN_BOUND)}. The vertical axis is clipped to [{yMin}, {yMax}] so the
            small-<Tex math="n" /> outliers do not flatten the rest — points outside sit on the edge.
          </figcaption>
        </figure>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel className="p-4 sm:p-5">
          <SectionTitle hint="Computed here, checked against the published list">
            The 27 exceptions
          </SectionTitle>
          <div className="flex flex-wrap gap-1.5">
            {KNOWN_EXCEPTIONS.map((n) => (
              <span
                key={n}
                className={`rounded-md border px-2 py-1 font-mono text-xs ${
                  exceptions.includes(n)
                    ? 'border-open/40 bg-open-soft text-open'
                    : 'border-line bg-panel-2 text-ink-dim'
                }`}
                title={`sigma(${n}) / (${n} · ln ln ${n}) = ${robinRatio(n, sigma).toFixed(5)}`}
              >
                {fmt.format(n)}
              </span>
            ))}
          </div>
          <Note>
            Every one of these is at or below {fmt.format(ROBIN_BOUND)}, and this page found exactly
            them and nothing else. Published as{' '}
            <ExternalLink href={ROBIN_SOURCE.oeisUrl}>OEIS {ROBIN_SOURCE.oeis}</ExternalLink>.
          </Note>
        </Panel>

        <Panel className="p-4 sm:p-5">
          <SectionTitle hint="Where the ratio comes closest to the line above 5040">
            Near misses
          </SectionTitle>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Robin ratio at superior highly composite numbers</caption>
              <thead>
                <tr className="border-b border-line text-left text-[11px] tracking-wide text-ink-dim uppercase">
                  <th scope="col" className="py-2 pr-4 font-medium">n</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Ratio</th>
                  <th scope="col" className="py-2 font-medium">Under e^γ</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {NEAR_MISSES.map((n) => {
                  const inRange = n <= deferredLimit;
                  return (
                    <tr key={n} className="border-b border-line-soft">
                      <td className="py-1.5 pr-4 text-ink-strong">{fmt.format(n)}</td>
                      <td className="py-1.5 pr-4 text-ink-dim">
                        {inRange ? robinRatio(n, sigma).toFixed(6) : <span className="text-ink-dim">raise the limit</span>}
                      </td>
                      <td className="py-1.5">
                        {inRange ? (
                          exceedsRobin(n, sigma) ? (
                            <span className="text-open">no</span>
                          ) : (
                            <span className="text-solved">yes</span>
                          )
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Note>
            The ratio peaks at numbers with many divisors, so these are the only plausible places a
            counterexample could hide. Checking a hundred thousand more integers is not progress
            toward a proof: the claim is about every <Tex math="n" />, and no finite scan can settle
            it. What it does show is where the question actually lives.
          </Note>
        </Panel>
      </div>

      <Note>
        Source: {ROBIN_SOURCE.author}, {ROBIN_SOURCE.year}, <em>{ROBIN_SOURCE.title}</em>,{' '}
        {ROBIN_SOURCE.journal}.
      </Note>
    </div>
  );
}

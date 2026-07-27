/**
 * "When the evidence misled" — the Lab's counterweight to itself.
 *
 * Every other panel in the Lab ends the same way: checked to ten million, still
 * holds, and that is not a proof. True, and easy to nod past. This one shows the
 * other case, where the numerical evidence was overwhelming and the conjecture
 * was false anyway.
 *
 * Two specimens, both computed here from definitions, both with a different
 * moral:
 *
 *   Mertens   |M(x)| < sqrt(x) held for every value anyone could check and is
 *             false. Odlyzko and te Riele disproved it in 1985 without
 *             exhibiting a counterexample; the smallest is known only to exceed
 *             10^16. Meanwhile the *weaker* statement M(x) = O(x^(1/2+e)) is
 *             equivalent to the Riemann Hypothesis and remains open.
 *
 *   Chebyshev primes 3 mod 4 lead primes 1 mod 4 almost everywhere you can
 *             compute, under a theorem guaranteeing the two classes have equal
 *             density. The lead first changes at 26,861 — a value small enough
 *             to find and large enough that a casual search misses it.
 *
 * This is the honest antidote to the failure mode this app's audience is most
 * prone to, and it is the one piece of content that argues for the app's own
 * epistemics rather than against them.
 */

import { useDeferredValue, useMemo } from 'react';
import {
  arithmeticTable,
  mertensSeries,
  mertens,
  primeRace,
  leadFraction,
  firstLeadChange,
  ARITHMETIC_SOURCES,
} from '../../lib/math/arithmetic';
import { chooseYRange, niceTicks, formatTick, projection, segmentPath } from '../../lib/plot';
import { ExternalLink, Note, Panel, SectionTitle, Stat, fmt } from '../../components/ui';
import { ChartFrame } from '../../components/ChartFrame';
import { Tex } from '../../components/Tex';

const W = 900;
const H = 280;
const PAD = 34;

interface Props {
  limit: number;
  setLimit: (n: number) => void;
  share: React.ReactNode;
}

export function EvidenceLab({ limit, setLimit, share }: Props) {
  const deferred = useDeferredValue(limit);
  const table = useMemo(() => arithmeticTable(deferred), [deferred]);

  return (
    <div className="space-y-5">
      <Panel className="p-4 sm:p-5">
        <SectionTitle hint="Every other panel here says “checked this far, still holds”. These two say what that is worth." right={share}>
          When the evidence misled
        </SectionTitle>

        <p className="text-sm leading-relaxed text-ink">
          A conjecture that holds for every number anyone has ever checked can still be false. Both
          examples below were computed in this page, and both were, at some point, supported by more
          numerical evidence than most open problems have today.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label htmlFor="evidence-limit" className="text-xs text-ink-dim">
            Compute up to
          </label>
          <input
            id="evidence-limit"
            type="range"
            min={50_000}
            max={1_000_000}
            step={50_000}
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="flex-1 accent-[var(--c-accent)]"
          />
          <span className="font-mono text-sm text-ink-strong">{fmt.format(limit)}</span>
        </div>
      </Panel>

      <MertensPanel limit={deferred} table={table} />
      <ChebyshevPanel limit={deferred} table={table} />
    </div>
  );
}

// ---------------------------------------------------------------------------

function MertensPanel({ limit, table }: { limit: number; table: ReturnType<typeof arithmeticTable> }) {
  const series = useMemo(() => mertensSeries(limit, table, 900), [limit, table]);
  const endpoint = useMemo(() => mertens(limit, table), [limit, table]);

  const samples = series.map((p) => ({ x: p.x, y: p.m }));
  const bound = Math.sqrt(limit);
  // Range must contain the sqrt envelope, or the comparison the panel is about
  // is cropped out of its own chart.
  const yRange = useMemo(() => {
    const r = chooseYRange(samples, { percentile: 0, padding: 0.12, symmetric: true });
    return { ...r, min: Math.min(r.min, -bound * 1.1), max: Math.max(r.max, bound * 1.1) };
  }, [series]); // eslint-disable-line react-hooks/exhaustive-deps

  const p = projection({ min: 1, max: limit }, yRange, W, H, PAD);
  const path = segmentPath(samples, p);

  const envelopeUpper = Array.from({ length: 200 }, (_, i) => {
    const x = 1 + (i / 199) * (limit - 1);
    return { x, y: Math.sqrt(x) };
  });
  const envelopeLower = envelopeUpper.map((s) => ({ x: s.x, y: -s.y }));

  const maxExcursion = Math.max(...samples.map((s) => Math.abs(s.y)));
  const worstRatio = Math.max(...series.map((s) => Math.abs(s.ratio)));

  return (
    <Panel className="p-4 sm:p-5">
      <SectionTitle hint="Disproved in 1985. No counterexample has ever been exhibited.">
        The Mertens conjecture
      </SectionTitle>

      <p className="text-sm leading-relaxed text-ink">
        <Tex math={String.raw`M(x) = \sum_{n \le x} \mu(n)`} /> counts squarefree integers with an
        even number of prime factors against those with an odd number. Mertens conjectured in 1897
        that <Tex math={String.raw`|M(x)| < \sqrt{x}`} /> always. It does here, and it did for every
        value anyone could compute.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label={`M(${fmt.format(limit)})`}
          value={fmt.format(endpoint)}
          source="summed from the Moebius function, computed here"
          tone="accent"
        />
        <Stat
          label="Largest excursion"
          value={fmt.format(maxExcursion)}
          source="greatest |M(x)| over the whole range"
        />
        <Stat
          label="Bound at this x"
          value={fmt.format(Math.round(bound))}
          source="the square root the conjecture claims is never reached"
        />
        <Stat
          label="Worst ratio"
          value={worstRatio.toFixed(3)}
          source="closest approach to the bound; the conjecture claims below 1"
          tone={worstRatio < 1 ? 'solved' : 'open'}
        />
      </div>

      <ChartFrame
        className="mt-4"
        filename={`mertens-function-to-${limit}`}
        viewBox={`0 0 ${W} ${H}`}
        summary={`The Mertens function M(x) for x up to ${limit}, plotted against the plus and minus square-root envelope the Mertens conjecture claims it never crosses. Largest excursion ${maxExcursion}, bound ${Math.round(bound)}.`}
        source={`Computed in this page from the Moebius function. Disproof: ${ARITHMETIC_SOURCES.mertensDisproof.by} (${ARITHMETIC_SOURCES.mertensDisproof.year}).`}
        caption={
          <>
            <Tex math="M(x)" /> in cyan against <Tex math={String.raw`\pm\sqrt{x}`} /> dashed. The
            walk stays well inside the envelope across the entire computable range, which is exactly
            what made the conjecture believable.
          </>
        }
      >
        {niceTicks(yRange.min, yRange.max, 5).map((t) => (
          <g key={t}>
            <line x1={PAD} y1={p.toY(t)} x2={W - PAD} y2={p.toY(t)} stroke="var(--c-line)" strokeWidth="1" opacity="0.5" />
            <text x={4} y={p.toY(t) + 4} className="fill-[var(--c-ink-dim)]" style={{ font: '10px var(--font-mono)' }}>
              {formatTick(t)}
            </text>
          </g>
        ))}

        <path d={segmentPath(envelopeUpper, p)} fill="none" stroke="var(--c-open)" strokeWidth="1.5" strokeDasharray="5 4" />
        <path d={segmentPath(envelopeLower, p)} fill="none" stroke="var(--c-open)" strokeWidth="1.5" strokeDasharray="5 4" />
        <line x1={PAD} y1={p.toY(0)} x2={W - PAD} y2={p.toY(0)} stroke="var(--c-line)" strokeWidth="1" />
        <path d={path} fill="none" stroke="var(--c-accent)" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
      </ChartFrame>

      <Note tone="warn">
        <strong className="font-semibold">And it is false.</strong> Odlyzko and te Riele disproved
        the Mertens conjecture in 1985. They did not exhibit a counterexample and none has ever been
        found; the smallest is known only to exceed{' '}
        <Tex math={String.raw`10^{16}`} />. Every computation you can run in this browser, and every
        computation anyone ran before 1985, supports a false statement.{' '}
        <ExternalLink href={ARITHMETIC_SOURCES.mertensDisproof.url}>The disproof</ExternalLink>.
      </Note>

      <Note>
        The Riemann Hypothesis is equivalent to the strictly weaker claim{' '}
        <Tex math={String.raw`M(x) = O\!\left(x^{1/2 + \varepsilon}\right)`} />, which survives the
        disproof and is still open. The distance between those two statements is the distance
        between a conjecture that numerical evidence could reach and one it cannot.
      </Note>
    </Panel>
  );
}

// ---------------------------------------------------------------------------

function ChebyshevPanel({ limit, table }: { limit: number; table: ReturnType<typeof arithmeticTable> }) {
  const race = useMemo(() => primeRace(limit, 4, 3, 1, table, 900), [limit, table]);
  const crossover = useMemo(() => firstLeadChange(limit, 4, 3, 1, table), [limit, table]);

  const samples = race.map((r) => ({ x: r.x, y: r.lead }));
  const yRange = useMemo(
    () => chooseYRange(samples, { percentile: 0, padding: 0.15, symmetric: true }),
    [race], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const p = projection({ min: 2, max: limit }, yRange, W, H, PAD);
  const last = race.at(-1)!;
  // Computed over every prime, not over the sampled chart points. Deriving it
  // from the downsampled series reported 100% on a range that contains a
  // documented lead change, contradicting the figure beside it.
  const { fractionAhead } = useMemo(() => leadFraction(limit, 4, 3, 1, table), [limit, table]);
  const aheadFraction = fractionAhead;

  return (
    <Panel className="p-4 sm:p-5">
      <SectionTitle hint="A lopsided race under a theorem guaranteeing a dead heat.">
        Chebyshev's bias
      </SectionTitle>

      <p className="text-sm leading-relaxed text-ink">
        Dirichlet's theorem guarantees that primes are split evenly between{' '}
        <Tex math={String.raw`4k+1`} /> and <Tex math={String.raw`4k+3`} /> in the limit. Chebyshev
        noticed in 1853 that the <Tex math={String.raw`4k+3`} /> class is nonetheless ahead almost
        everywhere you look. Plotted below is the lead,{' '}
        <Tex math={String.raw`\pi(x; 4, 3) - \pi(x; 4, 1)`} />.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="4k+3 primes"
          value={fmt.format(last.countA)}
          source={`counted up to ${fmt.format(limit)}`}
          tone="accent"
        />
        <Stat label="4k+1 primes" value={fmt.format(last.countB)} source="same range" />
        <Stat
          label="Ahead for"
          value={`${(aheadFraction * 100).toFixed(2)}%`}
          source="of every prime in range, counted exactly, not sampled"
        />
        <Stat
          label="First lead change"
          value={crossover === null ? 'none yet' : fmt.format(crossover)}
          source={
            crossover === null
              ? 'raise the limit past 26,861 to find it'
              : 'matches Leech (1957) exactly'
          }
          tone={crossover === null ? 'open' : 'solved'}
        />
      </div>

      <ChartFrame
        className="mt-4"
        filename={`chebyshev-bias-to-${limit}`}
        viewBox={`0 0 ${W} ${H}`}
        summary={`The prime race between residue classes 3 and 1 modulo 4, up to ${limit}. The 4k+3 class leads at ${(aheadFraction * 100).toFixed(1)} percent of sampled points. First lead change at ${crossover ?? 'none in range'}.`}
        source="Computed in this page from a linear sieve. Crossover value: Leech (1957), OEIS A007350."
        caption={
          <>
            Above the axis, primes <Tex math={String.raw`\equiv 3 \bmod 4`} /> lead. The amber marker
            is <Tex math="x = 26{,}861" />, where the other class takes the lead for the first time.
          </>
        }
      >
        {niceTicks(yRange.min, yRange.max, 5).map((t) => (
          <g key={t}>
            <line x1={PAD} y1={p.toY(t)} x2={W - PAD} y2={p.toY(t)} stroke="var(--c-line)" strokeWidth="1" opacity="0.5" />
            <text x={4} y={p.toY(t) + 4} className="fill-[var(--c-ink-dim)]" style={{ font: '10px var(--font-mono)' }}>
              {formatTick(t)}
            </text>
          </g>
        ))}

        <line x1={PAD} y1={p.toY(0)} x2={W - PAD} y2={p.toY(0)} stroke="var(--c-ink-dim)" strokeWidth="1.2" />
        <path d={segmentPath(samples, p)} fill="none" stroke="var(--c-accent)" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />

        {crossover !== null && crossover <= limit && (
          <g>
            <line x1={p.toX(crossover)} y1={PAD / 2} x2={p.toX(crossover)} y2={H - PAD / 2} stroke="var(--c-open)" strokeWidth="1.5" strokeDasharray="4 3" />
            <circle cx={p.toX(crossover)} cy={p.toY(0)} r="3.5" fill="var(--c-open)" />
          </g>
        )}
      </ChartFrame>

      <Note tone="warn">
        The lead first changes at <strong className="font-mono">26,861</strong> — small enough to
        find, large enough that a search stopping at ten thousand would conclude the bias is
        absolute. Littlewood proved in 1914 that the lead changes infinitely often. Whether{' '}
        <Tex math={String.raw`4k+3`} /> leads a well-defined majority of the time depends on the
        Riemann Hypothesis and the Grand Simplicity Hypothesis, both open.{' '}
        <ExternalLink href={ARITHMETIC_SOURCES.leechLeadChange.url}>OEIS A007350</ExternalLink>.
      </Note>
    </Panel>
  );
}

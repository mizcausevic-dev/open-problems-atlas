/**
 * The covering-set strip.
 *
 * Almost every panel in this Lab shows evidence: checked this far, still holds,
 * and that is not a proof. This one is the exception. The strip below is a
 * complete proof that 78,557 is a Sierpinski number, small enough to audit by
 * eye, and a reader can verify all 36 columns without taking anything on trust.
 *
 * The distinction the panel is careful about: it proves 78,557 IS a Sierpinski
 * number. Whether it is the SMALLEST is Selfridge's conjecture and is open — a
 * covering set cannot settle that, and this page does not suggest otherwise.
 */

import { useMemo, useState } from 'react';
import { CheckCheck, TriangleAlert } from 'lucide-react';
import {
  coveringStrip,
  primeContributions,
  uncoveredWithout,
  SIERPINSKI_78557,
  RIESEL_509203,
  COVERING_SOURCE,
} from '../../lib/math/covering';
import { fieldColor } from '../../lib/fields';
import { href } from '../../lib/router';
import { Button, ExternalLink, Note, Panel, SectionTitle, Stat, fmt } from '../../components/ui';
import { ChartFrame } from '../../components/ChartFrame';
import { Tex } from '../../components/Tex';

const CASES = [SIERPINSKI_78557, RIESEL_509203] as const;

interface Props {
  caseIndex: number;
  setCaseIndex: (n: number) => void;
  dark: boolean;
  share: React.ReactNode;
}

export function CoveringLab({ caseIndex, setCaseIndex, dark, share }: Props) {
  const spec = CASES[Math.min(caseIndex, CASES.length - 1)]!;
  /** Which prime the reader has chosen to remove, to watch the proof fail. */
  const [dropped, setDropped] = useState<number | null>(null);

  const strip = useMemo(
    () => coveringStrip(spec.k, [...spec.primes], spec.sign),
    [spec],
  );
  const contributions = useMemo(() => primeContributions(strip), [strip]);
  const gaps = useMemo(
    () => (dropped === null ? [] : uncoveredWithout(strip, dropped)),
    [strip, dropped],
  );
  const gapSet = new Set(gaps);

  // A distinct hue per prime, reusing the field palette so the whole app draws
  // from one set of colours.
  const paletteFields = ['Number theory', 'Geometry', 'Graph theory', 'Algebra', 'Analysis', 'Topology', 'Set theory', 'Combinatorics'];
  const colourFor = (p: number) => fieldColor(paletteFields[strip.primes.indexOf(p) % paletteFields.length]!, dark);

  const W = 900;
  const CELL = Math.floor((W - 40) / strip.period);
  const H = 118;

  return (
    <div className="space-y-5">
      <Panel className="p-4 sm:p-5">
        <SectionTitle
          hint="The one panel here that is a proof rather than evidence."
          right={share}
        >
          Covering sets
        </SectionTitle>

        <div className="mb-4 flex flex-wrap gap-2">
          {CASES.map((c, i) => (
            <Button
              key={c.k}
              size="sm"
              pressed={spec.k === c.k}
              onClick={() => {
                setCaseIndex(i);
                setDropped(null);
              }}
            >
              {c.label}: {fmt.format(c.k)}
            </Button>
          ))}
        </div>

        <p className="text-sm leading-relaxed text-ink">
          <Tex math={`${spec.k} \\cdot 2^n ${spec.sign === 1 ? '+' : '-'} 1`} /> is composite for
          every <Tex math="n \ge 1" />. That is a claim about infinitely many numbers, and it is
          settled by checking {strip.period} of them.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-ink">
          For each prime <Tex math="p" /> below, whether <Tex math="p" /> divides the term depends
          only on <Tex math="n" /> modulo the multiplicative order of 2 mod{' '}
          <Tex math="p" />. Those orders are{' '}
          <span className="font-mono">{strip.orders.join(', ')}</span>, so the pattern repeats with
          period <Tex math={`\\operatorname{lcm} = ${strip.period}`} />. Every column below is
          covered, so every <Tex math="n" /> that will ever exist is covered.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {/* Every figure here reflects the CURRENT set, including a removed
              prime. Leaving them on the full set left "36 / 36 covered" sitting
              above a strip that visibly had a hole in it. */}
          <Stat
            label="Covering primes"
            value={String(strip.primes.length - (dropped === null ? 0 : 1))}
            source={strip.primes.filter((p) => p !== dropped).join(', ')}
            tone="accent"
          />
          <Stat label="Period" value={String(strip.period)} source="lcm of the orders of 2" />
          <Stat
            label="Columns covered"
            value={`${strip.period - gaps.length} / ${strip.period}`}
            source={gaps.length === 0 ? 'the proof is complete' : `uncovered at n = ${gaps.join(', ')}`}
            tone={gaps.length === 0 ? 'solved' : 'open'}
          />
          <Stat
            label="Terms settled"
            value={gaps.length === 0 ? '∞' : 'none'}
            source={
              gaps.length === 0
                ? `${strip.period} residue classes cover every n`
                : 'one gap is enough to break the argument entirely'
            }
            tone={gaps.length === 0 ? 'solved' : 'open'}
          />
        </div>
      </Panel>

      <Panel className="p-4 sm:p-5">
        <SectionTitle hint="One column per n. Colour shows which prime divides that term.">
          The proof, at full size
        </SectionTitle>

        <ChartFrame
          className="mt-1"
          filename={`covering-set-${spec.k}${dropped ? `-without-${dropped}` : ''}`}
          viewBox={`0 0 ${W} ${H}`}
          summary={
            dropped === null
              ? `Covering set for ${spec.k}: ${strip.period} columns, one per residue class of n, each coloured by a prime from {${strip.primes.join(', ')}} that divides that term. All ${strip.period} are covered.`
              : `Covering set for ${spec.k} with the prime ${dropped} removed: ${gaps.length} of ${strip.period} columns are left uncovered, at n = ${gaps.join(', ')}.`
          }
          source={`Computed in this page by modular arithmetic. Covering set: ${spec.label === 'Sierpiński' ? `${COVERING_SOURCE.sierpinski.by} (${COVERING_SOURCE.sierpinski.year})` : `${COVERING_SOURCE.riesel.by} (${COVERING_SOURCE.riesel.year})`}.`}
          caption={
            dropped === null ? (
              <>
                Each column is one value of <Tex math="n" />, from 0 to {strip.period - 1}. No column
                is blank, so no term escapes.
              </>
            ) : (
              <>
                With <span className="font-mono">{dropped}</span> removed, {gaps.length} column
                {gaps.length === 1 ? '' : 's'} turn amber. Those are the{' '}
                <Tex math="n" /> for which no remaining prime divides the term, and the proof fails.
              </>
            )
          }
        >
          {strip.cells.map((cell) => {
            const active = dropped === null ? cell.divisors : cell.divisors.filter((p) => p !== dropped);
            const isGap = gapSet.has(cell.n);
            const x = 20 + cell.n * CELL;

            return (
              <g key={cell.n}>
                {/* Stacked bands when more than one prime divides this term. */}
                {active.length > 0 ? (
                  active.map((p, i) => (
                    <rect
                      key={p}
                      x={x}
                      y={26 + (i * 44) / active.length}
                      width={CELL - 1.5}
                      height={44 / active.length - 0.5}
                      fill={colourFor(p)}
                      opacity={0.92}
                    />
                  ))
                ) : (
                  <rect
                    x={x}
                    y={26}
                    width={CELL - 1.5}
                    height={44}
                    fill="none"
                    stroke={isGap ? 'var(--c-open)' : 'var(--c-line)'}
                    strokeWidth={isGap ? 2 : 1}
                    strokeDasharray={isGap ? undefined : '2 2'}
                  />
                )}

                <text
                  x={x + (CELL - 1.5) / 2}
                  y={84}
                  textAnchor="middle"
                  fill={isGap ? 'var(--c-open)' : 'var(--c-ink-dim)'}
                  style={{ font: `${isGap ? '600 ' : ''}9px var(--font-mono)` }}
                >
                  {cell.n}
                </text>

                {isGap && (
                  <text
                    x={x + (CELL - 1.5) / 2}
                    y={100}
                    textAnchor="middle"
                    fill="var(--c-open)"
                    style={{ font: '600 10px var(--font-mono)' }}
                  >
                    ?
                  </text>
                )}
              </g>
            );
          })}

          <text x={20} y={16} fill="var(--c-ink-dim)" style={{ font: '10px var(--font-mono)' }}>
            n = 0
          </text>
          <text x={W - 20} y={16} textAnchor="end" fill="var(--c-ink-dim)" style={{ font: '10px var(--font-mono)' }}>
            n = {strip.period - 1}, then it repeats
          </text>
        </ChartFrame>

        {/* Legend, and the control that lets a reader break the proof. */}
        <div className="mt-4">
          <p className="mb-2 text-[11px] font-semibold tracking-wide text-ink-dim uppercase">
            Remove a prime to watch the proof fail
          </p>
          <div className="flex flex-wrap gap-1.5">
            {contributions.map((c) => (
              <button
                key={c.prime}
                type="button"
                aria-pressed={dropped === c.prime}
                onClick={() => setDropped(dropped === c.prime ? null : c.prime)}
                title={`Divides ${c.covers.length} of ${strip.period} terms. Sole cover for ${c.soleCoverFor.length}.`}
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${
                  dropped === c.prime
                    ? 'border-open bg-open-soft font-semibold text-open'
                    : 'border-line bg-panel-2 text-ink hover:border-accent/50'
                }`}
              >
                <span
                  aria-hidden
                  className="size-2.5 rounded-sm"
                  style={{ background: dropped === c.prime ? 'var(--c-open)' : colourFor(c.prime) }}
                />
                <span className="font-mono">{c.prime}</span>
                <span className="text-ink-dim">
                  ord {c.order} · {c.covers.length}
                </span>
              </button>
            ))}
            {dropped !== null && (
              <Button size="sm" variant="quiet" onClick={() => setDropped(null)}>
                Restore
              </Button>
            )}
          </div>
        </div>

        {dropped === null ? (
          <Note>
            <CheckCheck className="mr-1.5 inline size-4 text-solved" aria-hidden />
            Every prime here is load-bearing: removing any one of them leaves at least one{' '}
            <Tex math="n" /> uncovered. Try it. That is also the check that this page is doing real
            arithmetic rather than colouring everything in — a verifier that always says "covered"
            would pass the completeness test and fail this one.
          </Note>
        ) : (
          <Note tone="warn">
            <TriangleAlert className="mr-1.5 inline size-4" aria-hidden />
            Without <span className="font-mono">{dropped}</span>, the terms at{' '}
            <span className="font-mono">n = {gaps.join(', ')}</span> have no divisor in the remaining
            set. They might still be composite, but this argument no longer shows it, and the proof
            is gone.
          </Note>
        )}
      </Panel>

      <Panel className="p-4 sm:p-5">
        <SectionTitle hint="What this settles, and what it does not">Proven versus open</SectionTitle>

        <dl className="space-y-3 text-sm">
          <div className="rounded-lg border border-solved/30 bg-solved-soft p-3">
            <dt className="mb-1 font-semibold text-solved">Proven, by the strip above</dt>
            <dd className="text-ink">{spec.proven}</dd>
          </div>
          <div className="rounded-lg border border-open/30 bg-open-soft p-3">
            <dt className="mb-1 font-semibold text-open">Still open</dt>
            <dd className="text-ink">
              {spec.open} A covering set cannot settle that question: showing some smaller{' '}
              <Tex math="k" /> is <em>not</em> a {spec.label} number means finding an{' '}
              <Tex math="n" /> that makes the term prime, which is a search, not an argument.
            </dd>
          </div>
        </dl>

        <p className="mt-3 text-sm text-ink-dim">
          This app lists that open question as{' '}
          <a className="text-accent hover:underline" href={href({ name: 'problem', id: spec.problemId })}>
            {spec.namedAfter}
          </a>
          .{' '}
          <ExternalLink
            href={spec.label === 'Sierpiński' ? COVERING_SOURCE.sierpinski.url : COVERING_SOURCE.riesel.url}
          >
            OEIS
          </ExternalLink>
          .
        </p>
      </Panel>
    </div>
  );
}

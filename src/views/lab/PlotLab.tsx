/**
 * Plot an expression.
 *
 * The point is not that it plots — it is what is in scope. sigma, mu, M, tau,
 * totient, primeCount, li, zeta and Z are all available, so an expression here
 * is a way to interrogate the problems in this dataset rather than a way to
 * draw a parabola. `sigma(n)/(n*ln(ln(n)))` is Robin's inequality, and it is
 * equivalent to the Riemann Hypothesis.
 *
 * Failure is surfaced, never smoothed: a parse error shows the offending
 * character with a caret under it, poles break the line instead of being drawn
 * through, points outside the domain leave holes, and a clipped y-axis says so.
 */

import { useDeferredValue, useMemo, useState } from 'react';
import { CircleAlert, Play } from 'lucide-react';
import { compile, knownNames, ParseError } from '../../lib/math/expression';
import { buildMathContext, PLOT_PRESETS, type Preset } from '../../lib/math/mathContext';
import {
  samplePlot,
  chooseYRange,
  niceTicks,
  formatTick,
  projection,
  segmentPath,
} from '../../lib/plot';
import { href } from '../../lib/router';
import { Button, ExternalLink, Note, Panel, SectionTitle, Stat, fmt } from '../../components/ui';
import { ChartFrame } from '../../components/ChartFrame';
import { Tex } from '../../components/Tex';

const W = 900;
const H = 320;
const PAD = 40;

interface Props {
  expression: string;
  setExpression: (s: string) => void;
  from: number;
  to: number;
  setRange: (from: number, to: number) => void;
  integerOnly: boolean;
  setIntegerOnly: (v: boolean) => void;
  share: React.ReactNode;
}

export function PlotLab({
  expression,
  setExpression,
  from,
  to,
  setRange,
  integerOnly,
  setIntegerOnly,
  share,
}: Props) {
  const [draft, setDraft] = useState(expression);
  const [activePreset, setActivePreset] = useState<Preset | null>(
    () => PLOT_PRESETS.find((p) => p.expression === expression) ?? null,
  );
  const [showHelp, setShowHelp] = useState(false);

  const ctx = useMemo(() => buildMathContext(), []);
  const deferred = useDeferredValue(expression);

  /** Compile separately from sampling: a parse error should not look like a plot of nothing. */
  const compiled = useMemo(() => {
    try {
      return { ok: true as const, fn: compile(deferred, { functions: ctx.functions }) };
    } catch (err) {
      if (err instanceof ParseError) {
        return { ok: false as const, kind: 'parse' as const, message: err.message, position: err.position, pointer: err.pointer };
      }
      return { ok: false as const, kind: 'eval' as const, message: err instanceof Error ? err.message : String(err) };
    }
  }, [deferred, ctx]);

  const result = useMemo(() => {
    if (!compiled.ok) return null;
    return samplePlot(compiled.fn, { xMin: from, xMax: to, samples: 900, integerOnly });
  }, [compiled, from, to, integerOnly]);

  const yRange = useMemo(
    () => (result ? chooseYRange(result.samples, { percentile: 0.01, padding: 0.1 }) : null),
    [result],
  );

  const apply = (value: string, preset?: Preset) => {
    setDraft(value);
    setExpression(value);
    setActivePreset(preset ?? null);
    if (preset) {
      setRange(preset.from, preset.to);
      setIntegerOnly(preset.integerOnly);
    }
  };

  const names = useMemo(() => knownNames(ctx.functions), [ctx]);
  const reference = activePreset?.reference;

  const p =
    result && yRange
      ? projection({ min: from, max: to }, yRange, W, H, PAD)
      : null;

  return (
    <div className="space-y-5">
      <Panel className="p-4 sm:p-5">
        <SectionTitle
          hint="The app's own arithmetic is in scope, so an expression here is a question about these problems."
          right={share}
        >
          Plot an expression
        </SectionTitle>

        {/* Presets: each one an open problem, written as a formula. */}
        <div className="mb-4 flex flex-wrap gap-1.5">
          {PLOT_PRESETS.map((preset) => (
            <Button
              key={preset.label}
              size="sm"
              pressed={activePreset?.label === preset.label}
              onClick={() => apply(preset.expression, preset)}
            >
              {preset.label}
            </Button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            apply(draft);
          }}
          className="flex flex-wrap gap-2"
        >
          <div className="min-w-[min(100%,20rem)] flex-1">
            <label htmlFor="plot-expr" className="mb-1 block text-[11px] tracking-wide text-ink-dim uppercase">
              Expression in <Tex math="x" /> (or <Tex math="n" /> for integer functions)
            </label>
            <input
              id="plot-expr"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => apply(draft)}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              className="w-full rounded-lg border border-line bg-panel-2 px-3 py-2 font-mono text-sm text-ink-strong focus:border-accent focus:outline-none"
            />
          </div>
          <div className="flex items-end gap-2">
            <Button type="submit" variant="primary">
              <Play className="size-4" aria-hidden /> Plot
            </Button>
            <Button onClick={() => setShowHelp((v) => !v)} pressed={showHelp}>
              Functions
            </Button>
          </div>
        </form>

        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="plot-from" className="mb-1 block text-[11px] tracking-wide text-ink-dim uppercase">
              From
            </label>
            <input
              id="plot-from"
              type="number"
              inputMode="numeric"
              value={from}
              onChange={(e) => setRange(Number(e.target.value) || 1, to)}
              className="w-32 rounded-lg border border-line bg-panel-2 px-3 py-1.5 font-mono text-sm text-ink-strong focus:border-accent focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="plot-to" className="mb-1 block text-[11px] tracking-wide text-ink-dim uppercase">
              To
            </label>
            <input
              id="plot-to"
              type="number"
              inputMode="numeric"
              value={to}
              onChange={(e) => setRange(from, Number(e.target.value) || 2)}
              className="w-32 rounded-lg border border-line bg-panel-2 px-3 py-1.5 font-mono text-sm text-ink-strong focus:border-accent focus:outline-none"
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 pb-1.5 text-xs text-ink">
            <input
              type="checkbox"
              checked={integerOnly}
              onChange={(e) => setIntegerOnly(e.target.checked)}
              className="size-4 accent-[var(--c-accent)]"
            />
            Integers only
          </label>
        </div>

        {showHelp && (
          <div className="mt-3 rounded-lg border border-line bg-panel-2 p-3">
            <p className="mb-2 text-[11px] tracking-wide text-ink-dim uppercase">
              Available functions
            </p>
            <ul className="grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2 lg:grid-cols-3">
              {names.functions.map((f) => (
                <li key={f.name} className="min-w-0">
                  <code className="font-mono text-accent">{f.name}</code>{' '}
                  <span className="text-ink-dim">{f.help}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2.5 text-[11px] text-ink-dim">
              Constants: {names.constants.map((c) => <code key={c} className="mr-1.5 font-mono">{c}</code>)}
              <br />
              <code className="font-mono">pi</code> is the constant; the prime counting function is{' '}
              <code className="font-mono">primeCount</code>.{' '}
              <code className="font-mono">phi</code> is the golden ratio; Euler's totient is{' '}
              <code className="font-mono">totient</code>.
            </p>
          </div>
        )}
      </Panel>

      {/* ---- Errors, stated precisely ------------------------------------- */}
      {!compiled.ok && (
        <Panel className="border-danger/40 p-4 sm:p-5">
          <p className="mb-2 flex items-center gap-2 text-sm font-medium text-danger">
            <CircleAlert className="size-4" aria-hidden />
            {compiled.kind === 'parse' ? 'That expression could not be read' : 'That expression could not be evaluated'}
          </p>
          <p className="text-sm text-ink">{compiled.message}</p>
          {compiled.kind === 'parse' && (
            <pre className="mt-2 overflow-x-auto rounded-lg border border-line bg-panel-2 p-3 font-mono text-xs text-ink">
              {deferred}
              {'\n'}
              <span className="text-danger">{compiled.pointer}</span>
            </pre>
          )}
          <Note>
            Nothing is plotted, because there is nothing to plot. Guessing at what was meant would
            draw a curve for an expression you did not write.
          </Note>
        </Panel>
      )}

      {/* ---- The plot ------------------------------------------------------ */}
      {result && yRange && p && (
        <Panel className="p-4 sm:p-5">
          <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat
              label="Points plotted"
              value={fmt.format(result.segments.reduce((n, s) => n + s.length, 0))}
              source={`of ${fmt.format(result.samples.length)} sampled`}
              tone="accent"
            />
            <Stat
              label="Outside the domain"
              value={fmt.format(result.undefinedCount)}
              source={result.undefinedCount ? 'left as gaps, not drawn at zero' : 'none'}
              tone={result.undefinedCount ? 'open' : 'solved'}
            />
            <Stat
              label="Poles"
              value={fmt.format(result.infiniteCount)}
              source={result.infiniteCount ? 'the line breaks rather than crossing' : 'none'}
              tone={result.infiniteCount ? 'open' : 'solved'}
            />
            <Stat
              label="Separate pieces"
              value={fmt.format(result.segments.length)}
              source="a discontinuity ends a segment"
            />
          </div>

          {result.threw && (
            <Note tone="warn">
              The expression raised an error at some inputs and those points were dropped:{' '}
              {result.error}
            </Note>
          )}

          <ChartFrame
            className="mt-2"
            filename={`plot-${deferred.replace(/[^a-z0-9]+/gi, '-').slice(0, 40)}`}
            viewBox={`0 0 ${W} ${H}`}
            summary={`Plot of ${deferred} for ${integerOnly ? 'integer' : 'real'} values from ${from} to ${to}. ${result.segments.length} separate pieces, ${result.undefinedCount} points outside the domain.`}
            source="Computed in this page from the expression, using the app's own arithmetic kernels."
            caption={
              <>
                <code className="font-mono text-ink">{deferred}</code>
                {yRange.clipped && (
                  <>
                    {' '}
                    The vertical axis is clipped to show the shape; {fmt.format(yRange.clippedCount)}{' '}
                    point{yRange.clippedCount === 1 ? '' : 's'} fall outside it.
                  </>
                )}
              </>
            }
          >
            {niceTicks(yRange.min, yRange.max, 5).map((t) => (
              <g key={t}>
                <line
                  x1={PAD}
                  y1={p.toY(t)}
                  x2={W - PAD}
                  y2={p.toY(t)}
                  stroke="var(--c-line)"
                  strokeWidth="1"
                  opacity="0.55"
                />
                <text x={4} y={p.toY(t) + 4} fill="var(--c-ink-dim)" style={{ font: '10px var(--font-mono)' }}>
                  {formatTick(t)}
                </text>
              </g>
            ))}

            {niceTicks(from, to, 6).map((t) => (
              <text
                key={t}
                x={p.toX(t)}
                y={H - 6}
                textAnchor="middle"
                fill="var(--c-ink-dim)"
                style={{ font: '10px var(--font-mono)' }}
              >
                {formatTick(t)}
              </text>
            ))}

            {/* The constant a preset is comparing against, when there is one. */}
            {reference !== undefined && reference.value >= yRange.min && reference.value <= yRange.max && (
              <g>
                <line
                  x1={PAD}
                  y1={p.toY(reference.value)}
                  x2={W - PAD}
                  y2={p.toY(reference.value)}
                  stroke="var(--c-open)"
                  strokeWidth="1.5"
                  strokeDasharray="5 4"
                />
                <text
                  x={W - PAD}
                  y={p.toY(reference.value) - 6}
                  textAnchor="end"
                  fill="var(--c-open)"
                  style={{ font: '600 11px var(--font-mono)' }}
                >
                  {reference.label} = {reference.value.toFixed(6).replace(/0+$/, '').replace(/\.$/, '')}
                </text>
              </g>
            )}

            {/* One path per connected run: a pole is not a line. */}
            {result.segments.map((seg, i) => (
              <path
                key={i}
                d={segmentPath(seg, p)}
                fill="none"
                stroke="var(--c-accent)"
                strokeWidth={integerOnly && seg.length < 400 ? 1.1 : 1.5}
                vectorEffect="non-scaling-stroke"
                strokeLinejoin="round"
              />
            ))}
          </ChartFrame>

          {activePreset && (
            <Note>
              {activePreset.note}
              {activePreset.problemId && (
                <>
                  {' '}
                  <a
                    className="text-accent hover:underline"
                    href={href({ name: 'problem', id: activePreset.problemId })}
                  >
                    Open the problem
                  </a>
                  .
                </>
              )}
            </Note>
          )}
        </Panel>
      )}

      <Note>
        Expressions are parsed and interpreted, never passed to <code className="font-mono">eval</code>{' '}
        or <code className="font-mono">new Function</code>. Nothing you type can reach the JavaScript
        runtime. The integer-domain functions refuse fractional input rather than rounding into a
        value they are not defined on, and{' '}
        <code className="font-mono">zeta</code> refuses arguments where the series it is built on
        does not converge.{' '}
        <ExternalLink href="https://github.com/mizcausevic-dev/open-problems-atlas/blob/main/src/lib/math/expression.ts">
          The parser
        </ExternalLink>
        .
      </Note>
    </div>
  );
}

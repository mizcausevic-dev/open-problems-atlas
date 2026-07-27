/**
 * A minimal SVG line chart.
 *
 * Hand-rolled rather than pulled from a charting library: the app needs one
 * chart shape, and the smallest React charting dependency is around 100 KB
 * gzipped, which is more than the entire rest of this bundle's UI layer. The
 * trade-off is that this does not do axes, legends or tooltips, and it should
 * not grow to. If a second chart shape is ever needed, reconsider then.
 */

interface Props {
  points: number[];
  labels?: string[];
  height?: number;
  className?: string;
  /** Accessible description. Required: a chart with no text alternative is invisible to a screen reader. */
  summary: string;
  color?: string;
}

export function Sparkline({ points, labels, height = 56, className = '', summary, color }: Props) {
  if (points.length < 2) return null;

  const w = 100;
  const h = height;
  const pad = 3;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;

  const x = (i: number) => (i / (points.length - 1)) * w;
  const y = (v: number) => h - pad - ((v - min) / span) * (h - pad * 2);

  const line = points.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(' ');
  const area = `${line} L${w},${h} L0,${h} Z`;
  const stroke = color ?? 'var(--c-accent)';
  const lastIndex = points.length - 1;

  return (
    <figure className={className}>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        className="h-auto w-full"
        style={{ height }}
        role="img"
        aria-label={summary}
      >
        <path d={area} fill={stroke} opacity="0.1" />
        <path
          d={line}
          fill="none"
          stroke={stroke}
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle cx={x(lastIndex)} cy={y(points[lastIndex]!)} r="2" fill={stroke} vectorEffect="non-scaling-stroke" />
      </svg>
      {labels && labels.length >= 2 && (
        <figcaption className="mt-1 flex justify-between font-mono text-[10px] text-ink-dim">
          <span>{labels[0]}</span>
          <span>{labels[labels.length - 1]}</span>
        </figcaption>
      )}
    </figure>
  );
}

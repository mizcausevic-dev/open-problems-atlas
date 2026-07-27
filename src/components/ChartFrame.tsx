/**
 * A chart with a caption, a stated source, and export.
 *
 * The `source` prop is required, matching the Stat component. Every figure this
 * app draws has to be able to say where it came from, and making that a required
 * parameter means a chart with no stated provenance does not typecheck.
 */

import { useRef, useState, type ReactNode } from 'react';
import { Download, ImageDown, Loader2 } from 'lucide-react';
import { downloadPng, downloadSvg } from '../lib/chartExport';
import { Button } from './ui';

interface Props {
  /** Accessible description of what the chart shows. Required: a chart with no text alternative is invisible. */
  summary: string;
  /** Visible caption under the chart. */
  caption: ReactNode;
  /** Where the numbers come from. Shown, and written into exported files. */
  source: string;
  /** Base filename, without extension. */
  filename: string;
  viewBox: string;
  children: ReactNode;
  className?: string;
}

export function ChartFrame({ summary, caption, source, filename, viewBox, children, className = '' }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [busy, setBusy] = useState<'svg' | 'png' | null>(null);
  const [error, setError] = useState('');

  const provenance = `${summary} — ${source}. Exported from Open Problems Atlas.`;

  const exportSvg = () => {
    if (!svgRef.current) return;
    setError('');
    try {
      downloadSvg(svgRef.current, `${filename}.svg`, { title: summary, provenance });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The chart could not be exported.');
    }
  };

  const exportPng = async () => {
    if (!svgRef.current) return;
    setBusy('png');
    setError('');
    try {
      await downloadPng(svgRef.current, `${filename}.png`, { title: summary, provenance, scale: 2 });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The chart could not be rasterised.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <figure className={className}>
      <svg
        ref={svgRef}
        viewBox={viewBox}
        className="h-auto w-full rounded-lg border border-line bg-panel-2"
        role="img"
        aria-label={summary}
      >
        {children}
      </svg>

      <figcaption className="mt-1.5 flex flex-wrap items-start justify-between gap-x-4 gap-y-1.5">
        <span className="min-w-0 flex-1 text-xs leading-relaxed text-ink-dim">{caption}</span>

        <span className="flex shrink-0 gap-1.5" data-print="hide">
          <Button size="sm" variant="quiet" onClick={exportSvg} title="Download as SVG (vector)">
            <Download className="size-3.5" aria-hidden />
            SVG
          </Button>
          <Button
            size="sm"
            variant="quiet"
            onClick={exportPng}
            disabled={busy === 'png'}
            title="Download as PNG at 2x"
          >
            {busy === 'png' ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <ImageDown className="size-3.5" aria-hidden />
            )}
            PNG
          </Button>
        </span>
      </figcaption>

      <p className="mt-1 text-[11px] text-ink-dim">{source}</p>
      {error && (
        <p className="mt-1 text-[11px] text-danger" role="alert">
          {error}
        </p>
      )}
    </figure>
  );
}

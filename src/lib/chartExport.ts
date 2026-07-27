/**
 * Export any chart in the app as SVG or PNG.
 *
 * Charts here are inline SVG styled with CSS custom properties (var(--c-accent)
 * and friends) and Tailwind utility classes. Both of those live in a stylesheet,
 * not on the element, so a naive `new XMLSerializer().serializeToString(svg)`
 * produces a file that is structurally correct and completely unstyled: black
 * strokes on a transparent ground, or nothing at all.
 *
 * So the export walks a clone of the node, resolves every paint-affecting
 * property through getComputedStyle, and writes the resolved values as
 * presentation attributes. The clone is what gets mutated; the live chart is
 * never touched.
 *
 * PNG goes through a canvas. The SVG is inlined as a data URL rather than a blob
 * URL because Safari refuses to draw blob-backed SVG images to a canvas, and
 * because a data URL cannot taint the canvas — no external reference survives
 * the serialisation step, so toBlob() is guaranteed not to throw a security
 * error.
 */

/** Properties that affect how a shape is painted and must survive serialisation. */
const PAINT_PROPERTIES = [
  'fill',
  'fill-opacity',
  'fill-rule',
  'stroke',
  'stroke-width',
  'stroke-opacity',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-dasharray',
  'stroke-dashoffset',
  'opacity',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'letter-spacing',
  'text-anchor',
  'dominant-baseline',
  'color',
] as const;

/**
 * Copy computed paint styles onto the clone as attributes.
 *
 * Walks both trees in lockstep: getComputedStyle only returns meaningful values
 * for a node in the live document, and the clone is detached.
 */
function inlineStyles(live: Element, clone: Element) {
  const computed = window.getComputedStyle(live);

  for (const prop of PAINT_PROPERTIES) {
    const value = computed.getPropertyValue(prop);
    if (!value || value === 'none' || value === 'normal' || value === 'auto') {
      // `fill: none` is meaningful on a path and must be kept.
      if (!(value === 'none' && (prop === 'fill' || prop === 'stroke'))) continue;
    }
    clone.setAttribute(prop, value.trim());
  }

  // Utility classes have done their job now that the values are inlined, and
  // leaving them in makes the file large and confusing.
  clone.removeAttribute('class');

  const liveKids = live.children;
  const cloneKids = clone.children;
  for (let i = 0; i < liveKids.length && i < cloneKids.length; i++) {
    inlineStyles(liveKids[i]!, cloneKids[i]!);
  }
}

export interface SerialiseOptions {
  /** Painted behind the chart. Transparent by default; PNG defaults to the page ground. */
  background?: string;
  /** Overrides the element's rendered size. */
  width?: number;
  height?: number;
  /** Added as a <title> for accessibility and as a comment for provenance. */
  title?: string;
  /** Provenance line written into the file as an XML comment. */
  provenance?: string;
}

export function serialiseSvg(svg: SVGSVGElement, options: SerialiseOptions = {}): string {
  const rect = svg.getBoundingClientRect();
  const width = options.width ?? Math.max(1, Math.round(rect.width));
  const height = options.height ?? Math.max(1, Math.round(rect.height));

  const clone = svg.cloneNode(true) as SVGSVGElement;
  inlineStyles(svg, clone);

  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));
  if (!clone.getAttribute('viewBox')) clone.setAttribute('viewBox', `0 0 ${width} ${height}`);

  if (options.background) {
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('width', '100%');
    bg.setAttribute('height', '100%');
    bg.setAttribute('fill', options.background);
    clone.insertBefore(bg, clone.firstChild);
  }

  if (options.title) {
    const t = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    t.textContent = options.title;
    clone.insertBefore(t, clone.firstChild);
  }

  const body = new XMLSerializer().serializeToString(clone);
  const comment = options.provenance ? `<!-- ${options.provenance.replace(/--/g, '- -')} -->\n` : '';
  return `<?xml version="1.0" encoding="UTF-8"?>\n${comment}${body}`;
}

/** Resolve a CSS custom property to a concrete colour for use in an exported file. */
export function resolveCssVar(name: string, fallback = '#ffffff'): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

export async function svgToPngBlob(
  svg: SVGSVGElement,
  options: SerialiseOptions & { scale?: number } = {},
): Promise<Blob> {
  const scale = options.scale ?? 2; // 2x so it is not soft on a high-DPI screen
  const rect = svg.getBoundingClientRect();
  const width = options.width ?? Math.max(1, Math.round(rect.width));
  const height = options.height ?? Math.max(1, Math.round(rect.height));

  const source = serialiseSvg(svg, {
    ...options,
    width,
    height,
    // A transparent PNG of a light-on-dark chart is unreadable when pasted into
    // a white document, so PNG always gets an explicit ground.
    background: options.background ?? resolveCssVar('--c-bg', '#ffffff'),
  });

  // Data URL, not a blob URL: Safari will not draw blob-backed SVG to a canvas,
  // and a data URL with no external references cannot taint it.
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`;

  const image = new Image();
  image.decoding = 'sync';

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () =>
      reject(new Error('The chart could not be rasterised. Use the SVG export instead.'));
    image.src = url;
  });

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser did not provide a 2D canvas context.');
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.drawImage(image, 0, 0, width, height);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('The canvas produced no image data.'));
    }, 'image/png');
  });
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadSvg(svg: SVGSVGElement, filename: string, options?: SerialiseOptions) {
  const source = serialiseSvg(svg, options);
  triggerDownload(new Blob([source], { type: 'image/svg+xml;charset=utf-8' }), filename);
}

export async function downloadPng(
  svg: SVGSVGElement,
  filename: string,
  options?: SerialiseOptions & { scale?: number },
) {
  triggerDownload(await svgToPngBlob(svg, options), filename);
}

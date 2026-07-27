/**
 * Attachments for journal notes: images, infographics, and video references.
 *
 * Design constraint that drives everything here: attachments live INSIDE the
 * journal entry, as part of `UserData`. That is deliberate rather than lazy.
 * Putting the bytes in IndexedDB would buy far more room, but it would put them
 * outside the vault, outside the export file, and outside the import merge — so
 * "your notes are encrypted at rest" would quietly stop being true for the part
 * of a note most likely to be a photograph of someone's whiteboard.
 *
 * The price is the localStorage quota, which is roughly 5 MB per origin and is
 * counted in UTF-16 code units in several browsers, so a base64 string costs
 * about two bytes per character. Everything below exists to make that budget
 * survivable and, when it is not, to fail loudly instead of silently.
 */

export type AttachmentKind = 'image' | 'video';

export interface Attachment {
  id: string;
  kind: AttachmentKind;
  /** User-supplied caption. Also the alt text for images. */
  caption: string;
  addedAt: string;
  /** images: a data: URI. Always re-encoded by this module, never the original file. */
  data?: string;
  width?: number;
  height?: number;
  /** videos: the canonical watch URL the user pasted. */
  url?: string;
  provider?: 'youtube' | 'vimeo';
  videoId?: string;
}

/**
 * Budgets, in characters of stored JSON rather than bytes of image.
 *
 * Conservative on purpose. 5 MB of quota at ~2 bytes per character leaves about
 * 2.5 M characters for everything, and notes, revisions and tracked problems all
 * share it. Handing attachments 3 M would guarantee the failure this is meant to
 * prevent.
 */
export const MAX_ATTACHMENT_CHARS = 360_000; // ~270 KB of image data
export const MAX_TOTAL_ATTACHMENT_CHARS = 1_600_000; // ~1.2 MB across all notes
export const MAX_ATTACHMENTS_PER_ENTRY = 12;

/** Longest edge, in pixels, after downscaling. Enough for a diagram or a scan. */
const MAX_EDGE = 1400;

export function attachmentChars(a: Attachment): number {
  return (a.data?.length ?? 0) + (a.url?.length ?? 0) + a.caption.length + 120;
}

export function totalAttachmentChars(entries: { attachments?: Attachment[] }[]): number {
  return entries.reduce(
    (sum, e) => sum + (e.attachments ?? []).reduce((s, a) => s + attachmentChars(a), 0),
    0,
  );
}

export class AttachmentError extends Error {}

/**
 * Re-encode an image file to a bounded data URI.
 *
 * Rasterising through a canvas is not only about size. It is also the sanitiser:
 * the output is pixels this code produced, so nothing of the original container
 * survives. An SVG carrying a <script>, a JPEG carrying EXIF GPS coordinates
 * from the phone that took it, a malformed file targeting a decoder bug — none
 * of it reaches storage, the export file, or anyone the user later shares that
 * export with. The GPS case is the one worth naming: a research note is exactly
 * the kind of thing people mail around without thinking about metadata.
 *
 * Quality is stepped down until the result fits. It is not a single guess,
 * because the size of a JPEG at a given quality varies by more than an order of
 * magnitude with content — a photograph and a line diagram are not comparable.
 */
export async function encodeImage(file: File): Promise<Attachment> {
  if (!file.type.startsWith('image/')) {
    throw new AttachmentError(`${file.name || 'That file'} is not an image.`);
  }

  const bitmap = await loadBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new AttachmentError('This browser would not provide a canvas to resize the image.');

  // PNG screenshots of diagrams are usually transparent-free, but a genuinely
  // transparent source flattened onto black would look broken in light mode, so
  // fill white first. JPEG has no alpha channel to preserve either way.
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  if ('close' in bitmap) bitmap.close();

  for (const quality of [0.85, 0.72, 0.6, 0.48, 0.36]) {
    const data = canvas.toDataURL('image/jpeg', quality);
    if (data.length <= MAX_ATTACHMENT_CHARS) {
      return {
        id: newId(),
        kind: 'image',
        caption: '',
        addedAt: new Date().toISOString(),
        data,
        width: w,
        height: h,
      };
    }
  }

  throw new AttachmentError(
    'That image is too large to store in the browser even after resizing. Crop it, or save a smaller export from whatever produced it.',
  );
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file);
    } catch {
      // Safari has historically refused some formats here. Fall through rather
      // than telling the user their perfectly good PNG is broken.
    }
  }

  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new AttachmentError('That image could not be decoded.'));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Recognised video URLs, and the embed target each maps to.
 *
 * Only two providers, and only shapes that can be parsed with certainty. A
 * regex that half-matches an arbitrary URL and produces a wrong embed is worse
 * than declining: the user would get a silent blank frame with no idea why.
 */
export function parseVideoUrl(input: string): { provider: 'youtube' | 'vimeo'; videoId: string; url: string } | null {
  let u: URL;
  try {
    u = new URL(input.trim());
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;

  const host = u.hostname.replace(/^www\./, '');
  const id = (s: string | null | undefined) => (s && /^[\w-]{6,20}$/.test(s) ? s : null);

  if (host === 'youtu.be') {
    const v = id(u.pathname.slice(1));
    return v ? { provider: 'youtube', videoId: v, url: `https://www.youtube.com/watch?v=${v}` } : null;
  }
  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
    const v = id(u.searchParams.get('v')) ?? id(u.pathname.split('/').filter(Boolean).pop());
    return v ? { provider: 'youtube', videoId: v, url: `https://www.youtube.com/watch?v=${v}` } : null;
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const digits = u.pathname.split('/').filter(Boolean).pop();
    return digits && /^\d{6,12}$/.test(digits)
      ? { provider: 'vimeo', videoId: digits, url: `https://vimeo.com/${digits}` }
      : null;
  }
  return null;
}

/**
 * The URL loaded only after the visitor clicks play.
 *
 * youtube-nocookie.com is used rather than youtube.com. It is not the privacy
 * guarantee its name suggests — it still sets storage once playback starts —
 * but it does not set the tracking cookie merely for loading the player, which
 * is the difference that matters for a facade.
 *
 * Vimeo has no equivalent domain. player.vimeo.com sets cookies on load, and
 * saying so is more useful than implying parity.
 */
export function embedUrl(a: Pick<Attachment, 'provider' | 'videoId'>): string | null {
  if (!a.videoId) return null;
  if (a.provider === 'youtube') {
    return `https://www.youtube-nocookie.com/embed/${a.videoId}?autoplay=1&rel=0`;
  }
  if (a.provider === 'vimeo') {
    return `https://player.vimeo.com/video/${a.videoId}?autoplay=1`;
  }
  return null;
}

export function newVideoAttachment(input: string, caption = ''): Attachment {
  const parsed = parseVideoUrl(input);
  if (!parsed) {
    throw new AttachmentError(
      'Only YouTube and Vimeo links are recognised. Paste a full https:// link to a video.',
    );
  }
  return {
    id: newId(),
    kind: 'video',
    caption,
    addedAt: new Date().toISOString(),
    url: parsed.url,
    provider: parsed.provider,
    videoId: parsed.videoId,
  };
}

function newId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `att-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

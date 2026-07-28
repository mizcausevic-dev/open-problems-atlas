/**
 * Rendering and editing of note attachments.
 *
 * The video facade is the part worth reading. A normal YouTube embed contacts
 * Google the instant the page renders, whether or not anyone watches — that is
 * how a site with an embedded video ends up reporting every visitor to a third
 * party while its privacy page says it does not. This renders a locally drawn
 * placeholder instead. Nothing leaves the browser until a deliberate click, and
 * the placeholder does not fetch the provider's thumbnail either, because that
 * request is the same disclosure in a smaller package.
 */

import { useRef, useState } from 'react';
import { ImagePlus, Play, Trash2, Video, X } from 'lucide-react';
import type { Attachment } from '../lib/attachments';
import {
  AttachmentError,
  EMBED_IFRAME,
  MAX_ATTACHMENTS_PER_ENTRY,
  embedUrl,
  encodeImage,
  newVideoAttachment,
} from '../lib/attachments';
import { Button, Note } from './ui';

/* ------------------------------------------------------------------ display */

function VideoFacade({ attachment }: { attachment: Attachment }) {
  const [playing, setPlaying] = useState(false);
  const src = embedUrl(attachment);
  const providerName = attachment.provider === 'youtube' ? 'YouTube' : 'Vimeo';

  if (playing && src) {
    return (
      <div className="aspect-video w-full overflow-hidden rounded-lg border border-line bg-black">
        <iframe
          src={src}
          title={attachment.caption || `${providerName} video`}
          className="size-full"
          allowFullScreen
          // Shared with the intro video via EMBED_IFRAME. referrerPolicy is
          // deliberately NOT 'no-referrer': that value makes YouTube refuse to
          // play with error 153. See the constant for the reproduction.
          {...EMBED_IFRAME}
        />
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-panel-2">
      <button
        type="button"
        onClick={() => setPlaying(true)}
        className="group flex aspect-video w-full flex-col items-center justify-center gap-3 transition-colors hover:bg-panel"
        aria-label={`Play ${attachment.caption || `${providerName} video`}. This loads content from ${providerName}.`}
      >
        <span className="flex size-14 items-center justify-center rounded-full border border-accent/40 bg-accent-soft transition-transform group-hover:scale-105">
          <Play className="size-6 translate-x-0.5 text-accent-ink" aria-hidden />
        </span>
        <span className="px-6 text-center text-sm text-ink">
          {attachment.caption || `${providerName} video`}
        </span>
        <span className="px-6 text-center text-xs text-ink-dim">
          Nothing has been requested from {providerName} yet. Playing loads their player.
        </span>
      </button>
      <div className="flex items-center justify-between gap-3 border-t border-line px-3 py-2">
        <a
          href={attachment.url}
          target="_blank"
          rel="noopener noreferrer"
          className="truncate text-xs text-ink-dim underline decoration-dotted underline-offset-2 hover:text-ink-strong"
        >
          {attachment.url}
        </a>
      </div>
    </div>
  );
}

export function AttachmentList({
  attachments,
  onRemove,
  onCaption,
}: {
  attachments: Attachment[];
  onRemove?: (id: string) => void;
  onCaption?: (id: string, caption: string) => void;
}) {
  if (attachments.length === 0) return null;

  return (
    <ul className="mt-4 grid gap-4 sm:grid-cols-2">
      {attachments.map((a) => (
        <li key={a.id} className="min-w-0">
          <figure className="min-w-0">
            {a.kind === 'image' ? (
              <img
                src={a.data}
                // Caption doubles as alt text. When there is none the image is
                // decorative as far as assistive technology can tell, and an
                // invented description would be a guess presented as a fact.
                alt={a.caption}
                width={a.width}
                height={a.height}
                loading="lazy"
                className="w-full rounded-lg border border-line bg-panel-2"
              />
            ) : (
              <VideoFacade attachment={a} />
            )}

            <figcaption className="mt-2 flex items-start gap-2">
              {onCaption ? (
                <input
                  value={a.caption}
                  onChange={(e) => onCaption(a.id, e.target.value)}
                  placeholder={a.kind === 'image' ? 'Describe this image' : 'Label this video'}
                  aria-label={a.kind === 'image' ? 'Image description' : 'Video label'}
                  className="min-w-0 flex-1 rounded-md border border-line bg-panel px-2 py-1 text-xs text-ink placeholder:text-ink-dim focus:border-accent focus:outline-none"
                />
              ) : (
                a.caption && <span className="min-w-0 flex-1 text-xs text-ink-dim">{a.caption}</span>
              )}
              {onRemove && (
                <button
                  type="button"
                  onClick={() => onRemove(a.id)}
                  aria-label={`Remove ${a.caption || (a.kind === 'image' ? 'image' : 'video')}`}
                  className="shrink-0 rounded-md border border-transparent p-1 text-ink-dim hover:border-danger/40 hover:text-danger"
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </button>
              )}
            </figcaption>
          </figure>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------- adding */

export function AttachmentControls({
  count,
  usageFraction,
  onAdd,
}: {
  count: number;
  usageFraction: number;
  onAdd: (a: Attachment) => { ok: true } | { ok: false; reason: string };
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoOpen, setVideoOpen] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');

  const full = count >= MAX_ATTACHMENTS_PER_ENTRY;

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const att = await encodeImage(file);
        const res = onAdd(att);
        if (!res.ok) {
          // Stop at the first refusal. Continuing would add some files and drop
          // others with one message on screen, and the user could not tell which.
          setError(res.reason);
          break;
        }
      }
    } catch (err) {
      setError(err instanceof AttachmentError ? err.message : 'That image could not be read.');
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const addVideo = () => {
    setError(null);
    try {
      const res = onAdd(newVideoAttachment(videoUrl));
      if (!res.ok) return setError(res.reason);
      setVideoUrl('');
      setVideoOpen(false);
    } catch (err) {
      setError(err instanceof AttachmentError ? err.message : 'That link could not be read.');
    }
  };

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={(e) => void addFiles(e.target.files)}
        />
        <Button size="sm" onClick={() => fileInput.current?.click()} disabled={busy || full}>
          <ImagePlus className="size-3.5" aria-hidden />
          {busy ? 'Processing…' : 'Add image'}
        </Button>
        <Button size="sm" onClick={() => setVideoOpen((v) => !v)} disabled={full} pressed={videoOpen}>
          <Video className="size-3.5" aria-hidden />
          Add video
        </Button>

        <span className="text-xs text-ink-dim">
          {count}/{MAX_ATTACHMENTS_PER_ENTRY} on this note
          {usageFraction > 0.6 && ` · ${Math.round(usageFraction * 100)}% of attachment space used`}
        </span>
      </div>

      {videoOpen && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addVideo()}
            placeholder="https://www.youtube.com/watch?v=…"
            aria-label="Video URL"
            className="min-w-0 flex-1 rounded-lg border border-line bg-panel px-3 py-2 text-sm text-ink placeholder:text-ink-dim focus:border-accent focus:outline-none"
          />
          <Button size="sm" variant="primary" onClick={addVideo} disabled={!videoUrl.trim()}>
            Add
          </Button>
          <Button size="sm" variant="quiet" onClick={() => setVideoOpen(false)} ariaLabel="Cancel">
            <X className="size-3.5" aria-hidden />
          </Button>
        </div>
      )}

      {error && (
        <div className="mt-2">
          <Note tone="warn">{error}</Note>
        </div>
      )}

      <p className="mt-2 text-xs text-ink-dim">
        Images are resized and re-encoded in this browser, which also strips camera metadata such as
        GPS coordinates. Nothing is uploaded. Videos are stored as a link and load only when played.
      </p>
    </div>
  );
}

/**
 * The intro video on the landing page.
 *
 * Behaviour: prominent on a first visit, click to play, fades out when it
 * finishes and does not come back. Afterwards a small link remains so it is
 * recoverable rather than gone.
 *
 * It does NOT autoplay on arrival, and that is the deliberate part. An embed
 * that loads with the page contacts Google on every single visit to the busiest
 * page on the site, which would falsify the About page's claim that no
 * third-party request happens without a gesture — and it would do so on the
 * page most likely to be someone's first impression of that claim. It would
 * also put a third-party iframe in the critical path of the largest contentful
 * paint. The facade costs one click and keeps both properties.
 *
 * Ending is detected without loading YouTube's IFrame Player API script. The
 * embed accepts `enablejsapi=1` and then speaks postMessage directly, so the
 * player reports its own state changes and no additional third-party script is
 * introduced. Messages are checked against the exact player origin before being
 * parsed, because anything on the page can post to this window.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Play, X } from 'lucide-react';

const STORE_KEY = 'opa.intro.v1';
export const PLAYER_ORIGIN = 'https://www.youtube-nocookie.com';

/** YouTube's player states. 0 is ENDED; the rest are not interesting here. */
const ENDED = 0;

/**
 * Whether a window message is the player reporting that playback finished.
 *
 * Extracted so it can be tested. A cross-origin message cannot be forged from a
 * page, so the real path is unverifiable in a browser harness — and the origin
 * check is the part that most needs to be right, because this handler acts on
 * what it receives and anything on the page can post here.
 */
export function isVideoEndedMessage(origin: string, data: unknown): boolean {
  if (origin !== PLAYER_ORIGIN) return false;
  try {
    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
    const msg = parsed as { event?: unknown; info?: unknown } | null;
    // `info` arrives as a number from the player and as a string from some
    // versions of the widget protocol, so compare after coercion — but reject
    // null and '' first, which Number() would happily turn into 0 and report as
    // "ended" for any message carrying an empty info field.
    if (!msg || msg.event !== 'onStateChange') return false;
    if (msg.info === null || msg.info === undefined || msg.info === '') return false;
    return Number(msg.info) === ENDED;
  } catch {
    // The player also emits non-JSON chatter. Ignoring it is correct.
    return false;
  }
}

interface Props {
  videoId: string;
  title: string;
  channel: string;
}

function seen(): boolean {
  try {
    return localStorage.getItem(STORE_KEY) === 'done';
  } catch {
    // Private mode with storage blocked. Showing the card every visit is the
    // right failure: it is a visible, dismissible card, not a silent request.
    return false;
  }
}

function markSeen() {
  try {
    localStorage.setItem(STORE_KEY, 'done');
  } catch {
    /* nothing to do; the card simply reappears next visit */
  }
}

export function IntroVideo({ videoId, title, channel }: Props) {
  const [dismissed, setDismissed] = useState(() => seen());
  const [playing, setPlaying] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);

  const finish = useCallback(() => {
    markSeen();
    setLeaving(true);
    // Unmount on a timer rather than on transitionend. A transition that never
    // runs — a background tab, a reduced-motion preference, a browser that
    // skips it — would otherwise leave the card on screen permanently.
    setTimeout(() => {
      setDismissed(true);
      setPlaying(false);
      setLeaving(false);
    }, 420);
  }, []);

  useEffect(() => {
    if (!playing) return;

    const onMessage = (e: MessageEvent) => {
      if (isVideoEndedMessage(e.origin, e.data)) finish();
    };

    const post = (msg: unknown) =>
      frame.current?.contentWindow?.postMessage(JSON.stringify(msg), PLAYER_ORIGIN);

    // The handshake has to be repeated: there is no load event that reliably
    // signals the player is ready to receive commands, so this retries for a
    // few seconds and then stops rather than polling forever.
    let tries = 0;
    const handshake = setInterval(() => {
      post({ event: 'listening', id: 1, channel: 'widget' });
      post({ event: 'command', func: 'addEventListener', args: ['onStateChange'], id: 1, channel: 'widget' });
      if (++tries > 20) clearInterval(handshake);
    }, 400);

    window.addEventListener('message', onMessage);
    return () => {
      clearInterval(handshake);
      window.removeEventListener('message', onMessage);
    };
  }, [playing, finish]);

  if (dismissed && !playing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDismissed(false);
          setPlaying(false);
        }}
        className="inline-flex items-center gap-1.5 text-xs text-ink-dim transition-colors hover:text-ink-strong"
      >
        <Play className="size-3" aria-hidden />
        Watch the intro
      </button>
    );
  }

  return (
    <section
      aria-label="Introduction video"
      className={`overflow-hidden rounded-xl border border-line bg-panel transition-all duration-400 ${
        leaving ? 'max-h-0 -translate-y-2 opacity-0' : 'max-h-[46rem] translate-y-0 opacity-100'
      }`}
    >
      {playing ? (
        <div className="aspect-video w-full bg-black">
          <iframe
            ref={frame}
            // enablejsapi lets the player post its state back. origin scopes
            // those messages to this page rather than broadcasting them.
            src={`${PLAYER_ORIGIN}/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&enablejsapi=1&origin=${encodeURIComponent(
              window.location.origin,
            )}`}
            title={title}
            className="size-full"
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            referrerPolicy="no-referrer"
            sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          className="group flex aspect-video w-full flex-col items-center justify-center gap-3 bg-panel-2 px-6 text-center transition-colors hover:bg-panel"
          aria-label={`Play "${title}". This loads the video player from YouTube.`}
        >
          <span className="flex size-16 items-center justify-center rounded-full border border-accent/40 bg-accent-soft transition-transform group-hover:scale-105">
            <Play className="size-7 translate-x-0.5 text-accent-ink" aria-hidden />
          </span>
          <span className="text-base font-medium text-ink-strong">{title}</span>
          <span className="text-xs text-ink-dim">
            {channel} · nothing has been requested from YouTube yet
          </span>
        </button>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-line px-3 py-2">
        <p className="min-w-0 truncate text-xs text-ink-dim">
          {playing ? 'This closes on its own when the video ends.' : 'Playing loads YouTube’s player.'}
        </p>
        <button
          type="button"
          onClick={finish}
          className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs text-ink-dim transition-colors hover:bg-panel-2 hover:text-ink-strong"
        >
          <X className="size-3" aria-hidden />
          Dismiss
        </button>
      </div>
    </section>
  );
}

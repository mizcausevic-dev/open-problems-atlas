/**
 * Share control.
 *
 * Two behaviours, chosen by capability rather than by viewport width:
 *
 *   navigator.share exists  ->  hand off to the operating system's sheet.
 *   it does not             ->  a small popover of ordinary links.
 *
 * Feature detection, not a media query, because the capability is what actually
 * varies. Desktop Safari has the Share API; a phone with a niche browser may
 * not. Guessing from width gets both wrong.
 *
 * The popover contains no widgets. See `src/lib/share.ts` for why that is a
 * constraint rather than a shortcut, and `share.test.ts` for the assertion that
 * keeps it true.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Link2, Share2 } from 'lucide-react';
import { motion } from 'motion/react';
import { Button } from './ui';
import { shareTargets, shareUrl } from '../lib/share';

interface Props {
  /** Sentence describing what is being shared. Assembled from dataset fields. */
  text: string;
  /** Hash route to share. Defaults to wherever the visitor currently is. */
  path?: string;
  size?: 'sm' | 'md';
  /** Wording for the copy action, when "Copy link" is not specific enough. */
  copyLabel?: string;
}

export function Share({ text, path, size = 'sm', copyLabel = 'Copy link' }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const firstItem = useRef<HTMLAnchorElement>(null);

  const url = () => shareUrl(path ?? window.location.hash);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard permission can be refused, and is in some embedded browsers.
      // The URL is in the address bar regardless, so this is not worth an error
      // dialog — but it must not silently pretend to have succeeded either.
      setCopied(false);
    }
  }, [path]); // eslint-disable-line react-hooks/exhaustive-deps

  const onClick = async () => {
    // navigator.share must be called synchronously from the gesture, and it
    // rejects with AbortError when the user dismisses the sheet. That is a
    // normal outcome, not a failure, so it must not fall through to the popover
    // — reopening a menu the user just dismissed is a small hostility.
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ text, url: url() });
        return;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        // Anything else (no handler installed, permission policy) is a real
        // failure of the native path, so fall through to the links.
      }
    }
    setOpen((v) => !v);
  };

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        // Return focus to the trigger, or the tab order restarts at the top of
        // the document — the standard reason a keyboard user loses their place.
        (wrap.current?.querySelector('button') as HTMLButtonElement | null)?.focus();
      }
    };
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };

    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    firstItem.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open]);

  const targets = open ? shareTargets(url(), text) : [];

  return (
    <div ref={wrap} className="relative inline-block">
      <Button
        size={size}
        onClick={onClick}
        title="Share this page"
        ariaLabel="Share this page"
        pressed={open}
      >
        <Share2 className="size-3.5" aria-hidden />
        <span>Share</span>
      </Button>

      {/*
        Enter animation only, and no AnimatePresence, deliberately.

        An exit animation keeps the menu mounted for its duration, which means
        focusable links sitting at opacity 0 that Tab and a screen reader can
        still reach. 140 ms of invisible-but-reachable links is a small wart in
        normal use — but AnimatePresence unmounts on animation completion, and
        completion needs a frame, so in any context where rAF is paused (a
        background tab, a hidden pane) the menu never unmounts at all. Measured:
        0 frames in 300 ms with the pane hidden, menu still in the DOM.

        Dismissal should be instant anyway. Nothing is lost by dropping it.
      */}
      {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.14 }}
            role="menu"
            aria-label="Share options"
            className="absolute right-0 z-30 mt-1.5 w-52 overflow-hidden rounded-xl border border-line bg-panel shadow-lg"
          >
            <button
              type="button"
              role="menuitem"
              onClick={copy}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink hover:bg-panel-2 hover:text-ink-strong"
            >
              {copied ? (
                <Check className="size-3.5 shrink-0 text-solved" aria-hidden />
              ) : (
                <Link2 className="size-3.5 shrink-0" aria-hidden />
              )}
              <span aria-live="polite">{copied ? 'Copied' : copyLabel}</span>
            </button>

            <div className="h-px bg-line" />

            {targets.map((t, i) => (
              <a
                key={t.id}
                ref={i === 0 ? firstItem : undefined}
                role="menuitem"
                href={t.href}
                target="_blank"
                // noopener is the one that matters: without it the opened tab
                // gets a window.opener handle back into this origin.
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className="block px-3 py-2 text-sm text-ink hover:bg-panel-2 hover:text-ink-strong"
              >
                {t.label}
              </a>
            ))}
          </motion.div>
      )}
    </div>
  );
}

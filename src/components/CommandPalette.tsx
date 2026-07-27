/**
 * Cmd/Ctrl+K command palette.
 *
 * Accessibility is the part most palettes get wrong, so it is explicit here:
 * the input is a `combobox` owning a `listbox`, the highlighted row is pointed
 * at by `aria-activedescendant` rather than by moving focus (focus must stay in
 * the input so typing keeps working), Escape closes, and focus returns to
 * whatever had it before the palette opened. Without that last part a keyboard
 * user is dumped at the top of the document every time they change their mind.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CornerDownLeft, Search } from 'lucide-react';
import { rankCommands, type Command, type CommandKind } from '../lib/palette';

const KIND_LABEL: Record<CommandKind, string> = {
  problem: 'Problem',
  view: 'View',
  collection: 'Collection',
  lab: 'Lab',
  action: 'Action',
};

interface Props {
  commands: Command[];
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ commands, open, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  /** Whatever had focus before we stole it, so it can be given back. */
  const restoreFocusTo = useRef<HTMLElement | null>(null);

  const results = useMemo(() => rankCommands(commands, query, 40), [commands, query]);

  // Reset per opening, and remember where focus came from.
  useLayoutEffect(() => {
    if (!open) return;
    restoreFocusTo.current = document.activeElement as HTMLElement | null;
    setQuery('');
    setIndex(0);
    // Focused directly, not inside a requestAnimationFrame. The component
    // renders nothing while closed, so by the time this effect runs the input
    // is already in the DOM and there is nothing to wait for. Deferring to a
    // frame also means the focus never lands at all in a context where frames
    // are not being produced — a background tab, or a headless run.
    inputRef.current?.focus();
  }, [open]);

  const close = useCallback(() => {
    onClose();
    // Give focus back rather than dropping the user at the top of the document.
    restoreFocusTo.current?.focus?.();
  }, [onClose]);

  const run = useCallback(
    (command: Command) => {
      close();
      if (command.href) window.location.hash = command.href.replace(/^#/, '');
      else command.run?.();
    },
    [close],
  );

  // Clamp the highlight when the result list shrinks under it.
  useEffect(() => {
    if (index >= results.length) setIndex(0);
  }, [results.length, index]);

  // Keep the highlighted row visible without moving focus to it.
  useLayoutEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${index}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [index, open]);

  // Lock the page behind the dialog.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || (e.key === 'n' && e.ctrlKey)) {
      e.preventDefault();
      setIndex((i) => (results.length ? (i + 1) % results.length : 0));
    } else if (e.key === 'ArrowUp' || (e.key === 'p' && e.ctrlKey)) {
      e.preventDefault();
      setIndex((i) => (results.length ? (i - 1 + results.length) % results.length : 0));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setIndex(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setIndex(Math.max(0, results.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const hit = results[index];
      if (hit) run(hit.command);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[10vh]"
      onMouseDown={close}
    >
      <div aria-hidden className="fixed inset-0 bg-bg/70 backdrop-blur-sm" />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="sheet relative w-full max-w-2xl overflow-hidden rounded-xl border border-line bg-panel shadow-2xl"
        // Stop the overlay's close handler firing for clicks inside the dialog.
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-line px-4">
          <Search className="size-4 shrink-0 text-ink-dim" aria-hidden />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-listbox"
            aria-activedescendant={results[index] ? `palette-opt-${index}` : undefined}
            aria-label="Search problems, views and actions"
            autoComplete="off"
            spellCheck={false}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIndex(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Jump to a problem, view or action. Try rh, pnp, bsd…"
            className="w-full bg-transparent py-3.5 text-sm text-ink placeholder:text-ink-dim focus:outline-none"
          />
          <kbd className="shrink-0 rounded border border-line px-1.5 py-0.5 font-mono text-[10px] text-ink-dim">
            esc
          </kbd>
        </div>

        <ul
          ref={listRef}
          id="palette-listbox"
          role="listbox"
          aria-label="Results"
          className="max-h-[55vh] overflow-y-auto py-1"
        >
          {results.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-ink-dim">
              Nothing matches “{query}”.
            </li>
          )}

          {results.map(({ command }, i) => (
            <li key={command.id}>
              <button
                type="button"
                id={`palette-opt-${i}`}
                data-idx={i}
                role="option"
                aria-selected={i === index}
                tabIndex={-1}
                onMouseMove={() => setIndex(i)}
                onClick={() => run(command)}
                className={`flex w-full items-center gap-3 px-4 py-2.5 text-left ${
                  i === index ? 'bg-accent-soft' : ''
                }`}
              >
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] ${
                    i === index ? 'bg-accent/20 text-accent-ink' : 'bg-panel-2 text-ink-dim'
                  }`}
                >
                  {KIND_LABEL[command.kind]}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-sm ${i === index ? 'font-medium text-accent-ink' : 'text-ink-strong'}`}>
                    {command.title}
                  </span>
                  {command.hint && (
                    <span className="block truncate text-[11px] text-ink-dim">{command.hint}</span>
                  )}
                </span>
                {i === index && (
                  <CornerDownLeft className="size-3.5 shrink-0 text-accent" aria-hidden />
                )}
              </button>
            </li>
          ))}
        </ul>

        <p className="border-t border-line px-4 py-2 text-[11px] text-ink-dim">
          {results.length} {results.length === 1 ? 'result' : 'results'} · ↑↓ to move · ⏎ to open
        </p>
      </div>
    </div>
  );
}

/** Opens on Cmd/Ctrl+K, and on `/` when the user is not already typing. */
export function usePaletteHotkey(onOpen: () => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpen();
        return;
      }
      if (e.key === '/') {
        // Never hijack a keystroke meant for a field the user is filling in.
        const el = document.activeElement;
        const typing =
          el instanceof HTMLInputElement ||
          el instanceof HTMLTextAreaElement ||
          (el instanceof HTMLElement && el.isContentEditable);
        if (typing) return;
        e.preventDefault();
        onOpen();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onOpen]);
}

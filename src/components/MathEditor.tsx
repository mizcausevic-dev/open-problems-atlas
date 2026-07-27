/**
 * The note editing surface.
 *
 * A textarea, not a contenteditable and not MathQuill. The note body has to stay
 * plain LaTeX text, because that single representation is what makes the .tex
 * export, the Markdown export, the encrypted vault and the revision history all
 * work. A WYSIWYG layer storing its own AST either breaks that or needs a
 * serialiser nobody will test. The audience types LaTeX faster than they click
 * anyway; WYSIWYG equation editors exist for people who do not know LaTeX, which
 * is not who reads a list of unsolved problems.
 *
 * All the editing logic lives in lib/latex/insert.ts as pure functions. This
 * file is the thin part that talks to the DOM.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Sigma } from 'lucide-react';
import {
  MACROS,
  MACRO_GROUPS,
  autoPair,
  commandPrefix,
  completeCommand,
  deleteEmptyPair,
  filterMacros,
  insertSnippet,
  nextPlaceholder,
  normalisePastedLatex,
  wrapSelection,
  type EditState,
  type Macro,
} from '../lib/latex/insert';
import { Tex } from './Tex';

interface Props {
  value: string;
  onChange: (next: string) => void;
  id?: string;
  rows?: number;
  placeholder?: string;
  ariaLabel?: string;
  /**
   * Focus on mount. Justified here and only here: the editor is opened by an
   * explicit user action on a single primary input, so the caret arriving in it
   * is what the user asked for. Skipped on coarse pointers, where stealing
   * focus summons the on-screen keyboard over the content.
   */
  autoFocus?: boolean;
}

export function MathEditor({ value, onChange, id, rows = 12, placeholder, ariaLabel, autoFocus }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!autoFocus) return;
    if (window.matchMedia('(pointer: coarse)').matches) return;
    ref.current?.focus();
  }, [autoFocus]);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [group, setGroup] = useState<(typeof MACRO_GROUPS)[number]>('Structure');
  const [filter, setFilter] = useState('');

  /** Autocomplete state, driven by a `\command` immediately before the caret. */
  const [complete, setComplete] = useState<{ start: number; word: string; index: number } | null>(null);

  const suggestions = useMemo(
    () => (complete ? filterMacros(complete.word, 8) : []),
    [complete],
  );

  /**
   * Caret position to restore once React has committed the new value.
   *
   * A controlled textarea resets its caret to the end of the text on every
   * re-render, so the caret has to be reapplied *after* the commit. Doing it in
   * a requestAnimationFrame loses the race: the frame fires, sets the caret,
   * and React's render then puts it back at the end. Inserting \frac{}{} left
   * the caret at 9 rather than inside the first slot at 6, and Tab appeared to
   * do nothing at all. useLayoutEffect runs after the DOM mutation and before
   * paint, which is exactly the window this needs.
   */
  const pendingSelection = useRef<[number, number] | null>(null);

  const apply = useCallback(
    (next: EditState) => {
      const el = ref.current;

      // Caret-only moves (Tab between slots) change no text, so no re-render is
      // coming and there is nothing to wait for. Queueing here would strand the
      // pending selection until some unrelated edit flushed it.
      if (next.text === value) {
        el?.focus();
        el?.setSelectionRange(next.selectionStart, next.selectionEnd);
        return;
      }

      pendingSelection.current = [next.selectionStart, next.selectionEnd];
      onChange(next.text);
    },
    [onChange, value],
  );

  useLayoutEffect(() => {
    const pending = pendingSelection.current;
    if (!pending) return;
    pendingSelection.current = null;
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(pending[0], pending[1]);
  }, [value]);

  const currentState = (): EditState => {
    const el = ref.current;
    return {
      text: value,
      selectionStart: el?.selectionStart ?? value.length,
      selectionEnd: el?.selectionEnd ?? value.length,
    };
  };

  const insert = (macro: Macro) => {
    apply(insertSnippet(currentState(), macro.snippet));
    setComplete(null);
  };

  const acceptSuggestion = (macro: Macro) => {
    if (!complete) return;
    apply(completeCommand(currentState(), complete.start, macro.snippet));
    setComplete(null);
  };

  // Track whether the caret sits inside a partial command.
  const syncComplete = () => {
    const el = ref.current;
    if (!el) return;
    const prefix = commandPrefix(value, el.selectionStart);
    setComplete(prefix ? { start: prefix.start, word: prefix.word, index: 0 } : null);
  };

  useEffect(() => {
    if (complete && suggestions.length === 0) setComplete(null);
  }, [complete, suggestions.length]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    const state: EditState = {
      text: value,
      selectionStart: el.selectionStart,
      selectionEnd: el.selectionEnd,
    };

    // --- autocomplete navigation, only while the menu is open ---------------
    if (complete && suggestions.length > 0) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const delta = e.key === 'ArrowDown' ? 1 : -1;
        setComplete({
          ...complete,
          index: (complete.index + delta + suggestions.length) % suggestions.length,
        });
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        acceptSuggestion(suggestions[complete.index]!);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setComplete(null);
        return;
      }
    }

    // --- Tab cycles through empty {} slots ---------------------------------
    if (e.key === 'Tab' && !e.shiftKey) {
      const stop = nextPlaceholder(value, el.selectionStart);
      if (stop !== null) {
        e.preventDefault();
        apply({ text: value, selectionStart: stop, selectionEnd: stop });
        return;
      }
      // No slots left: let Tab move focus, so the editor never traps keyboard users.
    }

    // --- wrap selection in maths -------------------------------------------
    if ((e.ctrlKey || e.metaKey) && e.key === 'm') {
      e.preventDefault();
      apply(wrapSelection(state, '$', '$'));
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'M') {
      e.preventDefault();
      apply(wrapSelection(state, '$$', '$$'));
      return;
    }

    // --- auto-pairing -------------------------------------------------------
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const paired = autoPair(state, e.key);
      if (paired) {
        e.preventDefault();
        apply(paired);
        return;
      }
    }

    if (e.key === 'Backspace') {
      const collapsed = deleteEmptyPair(state);
      if (collapsed) {
        e.preventDefault();
        apply(collapsed);
      }
    }
  };

  const onPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const raw = e.clipboardData.getData('text/plain');
    const normalised = normalisePastedLatex(raw);
    // Only intervene when normalisation actually changed something, so an
    // ordinary paste behaves exactly as the user expects.
    if (normalised === raw) return;

    e.preventDefault();
    const el = e.currentTarget;
    const before = value.slice(0, el.selectionStart);
    const after = value.slice(el.selectionEnd);
    const caret = before.length + normalised.length;
    apply({ text: `${before}${normalised}${after}`, selectionStart: caret, selectionEnd: caret });
  };

  const visibleMacros = filter
    ? filterMacros(filter, 60)
    : MACROS.filter((m) => m.group === group);

  return (
    <div className="relative">
      {/* Quick bar: the handful used constantly, always one click away. */}
      <div className="mb-1.5 flex flex-wrap items-center gap-1">
        {MACROS.filter((m) =>
          ['Fraction', 'Sum', 'Square root', 'Subscript', 'Superscript', 'mod', 'at most', 'element of', 'implies'].includes(m.label),
        ).map((m) => (
          <button
            key={m.label}
            type="button"
            onClick={() => insert(m)}
            title={`${m.label} — ${m.snippet}`}
            className="rounded-md border border-line bg-panel-2 px-2 py-1 text-ink-dim transition-colors hover:border-accent/50 hover:text-ink-strong"
          >
            <Tex math={m.preview ?? m.snippet} />
          </button>
        ))}

        <button
          type="button"
          onClick={() => setPaletteOpen((v) => !v)}
          aria-expanded={paletteOpen}
          className={`ml-auto inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors ${
            paletteOpen
              ? 'border-accent bg-accent-soft text-accent-ink'
              : 'border-line bg-panel-2 text-ink-dim hover:text-ink-strong'
          }`}
        >
          <Sigma className="size-3.5" aria-hidden />
          Symbols
          <ChevronDown className={`size-3 transition-transform ${paletteOpen ? 'rotate-180' : ''}`} aria-hidden />
        </button>
      </div>

      {paletteOpen && (
        <div className="mb-2 rounded-lg border border-line bg-panel-2 p-2.5">
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter symbols: frac, modulo, <=, …"
            aria-label="Filter symbols"
            autoComplete="off"
            spellCheck={false}
            className="mb-2 w-full rounded-md border border-line bg-panel px-2.5 py-1.5 text-xs text-ink focus:border-accent focus:outline-none"
          />

          {!filter && (
            <div className="mb-2 flex flex-wrap gap-1">
              {MACRO_GROUPS.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGroup(g)}
                  aria-pressed={group === g}
                  className={`rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
                    group === g
                      ? 'border-accent bg-accent-soft text-accent-ink'
                      : 'border-line text-ink-dim hover:text-ink-strong'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          )}

          <div className="flex max-h-52 flex-wrap gap-1 overflow-y-auto">
            {visibleMacros.map((m) => (
              <button
                key={m.label}
                type="button"
                onClick={() => insert(m)}
                title={`${m.label} — ${m.snippet}`}
                className="min-w-9 rounded-md border border-line bg-panel px-2 py-1.5 text-ink transition-colors hover:border-accent/60"
              >
                <Tex math={m.preview ?? m.snippet} />
              </button>
            ))}
            {visibleMacros.length === 0 && (
              <p className="px-1 py-2 text-xs text-ink-dim">Nothing matches that.</p>
            )}
          </div>
        </div>
      )}

      <textarea
        ref={ref}
        id={id}
        value={value}
        rows={rows}
        placeholder={placeholder}
        aria-label={ariaLabel}
        spellCheck={false}
        onChange={(e) => {
          onChange(e.target.value);
          requestAnimationFrame(syncComplete);
        }}
        onKeyUp={syncComplete}
        onClick={syncComplete}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onBlur={() => setComplete(null)}
        className="w-full resize-y rounded-lg border border-line bg-panel-2 px-3 py-2 font-mono text-sm text-ink focus:border-accent focus:outline-none"
      />

      {complete && suggestions.length > 0 && (
        <ul
          role="listbox"
          aria-label="LaTeX command suggestions"
          className="absolute right-2 bottom-2 z-20 max-h-56 w-64 overflow-y-auto rounded-lg border border-line bg-panel shadow-lg"
        >
          {suggestions.map((m, i) => (
            <li key={m.label}>
              <button
                type="button"
                role="option"
                aria-selected={i === complete.index}
                // onMouseDown, not onClick: the textarea's blur would close the
                // menu before a click could land.
                onMouseDown={(e) => {
                  e.preventDefault();
                  acceptSuggestion(m);
                }}
                className={`flex w-full items-center gap-2.5 px-2.5 py-1.5 text-left text-xs ${
                  i === complete.index ? 'bg-accent-soft text-accent-ink' : 'text-ink hover:bg-panel-2'
                }`}
              >
                <span className="w-8 shrink-0 text-center">
                  <Tex math={m.preview ?? m.snippet} />
                </span>
                <span className="min-w-0 flex-1 truncate font-mono">{m.snippet}</span>
                <span className="shrink-0 text-ink-dim">{m.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-1 text-[11px] text-ink-dim">
        Type <code className="font-mono">\</code> for suggestions. Tab jumps to the next empty{' '}
        <code className="font-mono">{'{}'}</code>. Ctrl+M wraps the selection in maths.
      </p>
    </div>
  );
}

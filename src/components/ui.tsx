/**
 * Shared primitives.
 *
 * Small and unabstracted on purpose: each of these is used in three or more
 * views, and none of them is complicated enough to earn a config object.
 */

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { fieldColor, fieldSoft, fieldStyle, STATUS_LABEL } from '../lib/fields';
import type { ProblemStatus } from '../types';

// -- theme -------------------------------------------------------------------

export function useDarkMode(): [boolean, () => void] {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));

  const toggle = () => {
    setDark((d) => {
      const next = !d;
      document.documentElement.classList.toggle('dark', next);
      try {
        localStorage.setItem('opa.theme', next ? 'dark' : 'light');
      } catch { /* private mode */ }
      return next;
    });
  };

  return [dark, toggle];
}

/** Tracks the browser's online flag, used to label what the app cannot do offline. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

// -- atoms -------------------------------------------------------------------

export function Chip({
  children,
  tone = 'neutral',
  className = '',
  title,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'accent' | 'open' | 'solved' | 'partial' | 'warn';
  className?: string;
  title?: string;
}) {
  const tones: Record<string, string> = {
    neutral: 'bg-panel-2 text-ink-dim border-line',
    accent: 'bg-accent-soft text-accent-ink border-accent/30',
    open: 'bg-open-soft text-open border-open/30',
    solved: 'bg-solved-soft text-solved border-solved/30',
    partial: 'bg-partial-soft text-partial border-partial/30',
    warn: 'bg-open-soft text-open border-open/40',
  };
  return (
    <span
      title={title}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function StatusChip({ status }: { status: ProblemStatus }) {
  const tone = status === 'solved' ? 'solved' : status === 'partially-solved' ? 'partial' : 'open';
  return <Chip tone={tone}>{STATUS_LABEL[status] ?? status}</Chip>;
}

export function FieldChip({ field, dark, short = false }: { field: string; dark: boolean; short?: boolean }) {
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap"
      style={{
        background: fieldSoft(field, dark),
        color: fieldColor(field, dark),
        borderColor: `${fieldColor(field, dark)}44`,
      }}
    >
      <span
        aria-hidden
        className="size-1.5 rounded-full"
        style={{ background: fieldColor(field, dark) }}
      />
      {short ? fieldStyle(field).short : field}
    </span>
  );
}

export function Button({
  children,
  onClick,
  variant = 'ghost',
  size = 'md',
  type = 'button',
  disabled,
  className = '',
  title,
  ariaLabel,
  pressed,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'ghost' | 'quiet' | 'danger';
  size?: 'sm' | 'md';
  type?: 'button' | 'submit';
  disabled?: boolean;
  className?: string;
  title?: string;
  ariaLabel?: string;
  pressed?: boolean;
}) {
  const variants: Record<string, string> = {
    primary:
      'bg-accent text-bg border-accent hover:brightness-110 font-semibold disabled:opacity-50',
    ghost: 'bg-panel border-line text-ink hover:border-accent/60 hover:text-ink-strong',
    quiet: 'bg-transparent border-transparent text-ink-dim hover:text-ink-strong hover:bg-panel-2',
    danger: 'bg-transparent border-danger/40 text-danger hover:bg-danger/10',
  };
  const sizes = { sm: 'px-2.5 py-1 text-xs', md: 'px-3.5 py-2 text-sm' };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      {...(pressed !== undefined ? { 'aria-pressed': pressed } : {})}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg border transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Panel({
  children,
  className = '',
  as: As = 'section',
}: {
  children: ReactNode;
  className?: string;
  as?: 'section' | 'article' | 'div' | 'aside';
}) {
  return (
    <As className={`rounded-xl border border-line bg-panel ${className}`}>{children}</As>
  );
}

export function SectionTitle({
  children,
  hint,
  right,
}: {
  children: ReactNode;
  hint?: string;
  right?: ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold tracking-wide text-ink-strong uppercase">{children}</h2>
        {hint && <p className="mt-0.5 text-xs text-ink-dim">{hint}</p>}
      </div>
      {right}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  children,
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line px-6 py-12 text-center">
      {icon && <div className="text-ink-dim">{icon}</div>}
      <p className="font-medium text-ink-strong">{title}</p>
      {children && <div className="max-w-md text-sm text-ink-dim">{children}</div>}
    </div>
  );
}

/**
 * A labelled figure. `source` is required rather than optional: every number
 * this app shows has to be able to say where it came from.
 */
export function Stat({
  label,
  value,
  source,
  tone,
}: {
  label: string;
  value: ReactNode;
  source: string;
  tone?: 'accent' | 'solved' | 'open';
}) {
  const toneClass =
    tone === 'accent' ? 'text-accent' : tone === 'solved' ? 'text-solved' : tone === 'open' ? 'text-open' : 'text-ink-strong';
  return (
    <div className="rounded-xl border border-line bg-panel p-4">
      <div className="text-[11px] font-medium tracking-wide text-ink-dim uppercase">{label}</div>
      <div className={`mt-1 font-mono text-2xl leading-none font-semibold ${toneClass}`}>{value}</div>
      <div className="mt-2 text-[11px] leading-snug text-ink-dim">{source}</div>
    </div>
  );
}

/** A short explanatory aside. Used for the "what this is not" notes. */
export function Note({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'warn' }) {
  return (
    <p
      className={`rounded-lg border px-3 py-2 text-xs leading-relaxed ${
        tone === 'warn'
          ? 'border-open/30 bg-open-soft text-open'
          : 'border-line bg-panel-2 text-ink-dim'
      }`}
    >
      {children}
    </p>
  );
}

export function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent"
    >
      {children}
    </a>
  );
}

export const fmt = new Intl.NumberFormat('en-US');

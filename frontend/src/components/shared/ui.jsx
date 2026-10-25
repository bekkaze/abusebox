import { useId, useState } from 'react';

/* Shared building blocks: one vocabulary for surfaces, controls and states,
   in the Delivery Report world (paper, ink, hairline rules, one teal accent). */

export const cardClass = 'bg-paper border border-rule rounded-md';

export const inputClass =
  'h-9 w-full px-3 rounded-md border border-rule-strong bg-paper text-sm text-ink placeholder:text-ink-2 ' +
  'focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 transition-colors ' +
  'disabled:bg-sunk disabled:text-ink-2 aria-[invalid=true]:border-s5';

export const selectClass = `${inputClass} pr-8`;

const buttonBase =
  'inline-flex items-center justify-center gap-2 h-9 px-3.5 rounded-md text-sm font-semibold whitespace-nowrap ' +
  'transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

export const primaryButtonClass = `${buttonBase} text-accent-ink bg-accent hover:bg-accent-hover`;

export const secondaryButtonClass = `${buttonBase} text-ink bg-paper border border-rule-strong hover:bg-sunk`;

export const dangerButtonClass = `${buttonBase} text-paper bg-s5 hover:bg-s5/90`;

export const quietButtonClass = `${buttonBase} text-ink-2 hover:text-ink hover:bg-sunk`;

export const linkClass = 'font-medium text-accent hover:underline underline-offset-2';

/** Page title row. Titles carry their own weight: no eyebrow above them. */
export function PageHeader({ title, description, actions }) {
  return (
    <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-4 border-b border-rule">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-ink">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-2 max-w-prose">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 sm:justify-end">{actions}</div>}
    </header>
  );
}

/** A titled region separated by a hairline, instead of a boxed card. */
export function Section({ title, action, children, className = '', id }) {
  return (
    <section className={className} aria-labelledby={id}>
      <div className="flex items-baseline justify-between gap-3 border-b border-rule pb-2 mb-3">
        <h2 id={id} className="text-sm font-semibold text-ink">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Message-header style details: "Field-Name: value" rows. */
export function Fields({ children, className = '' }) {
  return (
    <dl className={`grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm ${className}`}>{children}</dl>
  );
}

export function Field({ name, children }) {
  return (
    <>
      <dt className="font-mono text-xs leading-5 text-ink-2">{name}:</dt>
      <dd className="min-w-0 text-ink break-words">{children ?? '—'}</dd>
    </>
  );
}

// Result states, named with the SMTP reply class they resemble:
// 5.x permanent (listed), 4.x temporary (no answer), 3.x pending, 2.x OK.
const STATUS = {
  listed: { code: '5.x', label: 'Listed', className: 'text-s5 bg-s5-soft' },
  unavailable: { code: '4.x', label: 'No answer', className: 'text-s4 bg-s4-soft' },
  requested: { code: '3.x', label: 'Removal requested', className: 'text-info bg-info-soft' },
  clear: { code: '2.x', label: 'Clear', className: 'text-s2 bg-s2-soft' },
};

export function StatusTag({ status, label }) {
  const info = STATUS[status] || STATUS.clear;
  return (
    <span className={`inline-flex items-baseline gap-1.5 rounded px-1.5 py-0.5 text-xs font-semibold whitespace-nowrap ${info.className}`}>
      <span className="font-mono text-2xs font-normal opacity-80" aria-hidden="true">{info.code}</span>
      {label || info.label}
    </span>
  );
}

const SEVERITY_TAGS = {
  critical: { label: 'Critical', className: 'bg-s5 text-paper' },
  high: { label: 'High', className: 'bg-s5-soft text-s5' },
  medium: { label: 'Medium', className: 'bg-s4-soft text-s4' },
  low: { label: 'Low', className: 'bg-sunk text-ink-2 ring-1 ring-inset ring-rule' },
  info: { label: 'Info', className: 'bg-info-soft text-info' },
};

/** How much a listing matters: critical, high, medium, low or info. */
export function SeverityTag({ severity }) {
  const info = SEVERITY_TAGS[severity];
  if (!info) return null;
  return (
    <span className={`inline-flex rounded px-1.5 py-px text-2xs font-semibold uppercase tracking-wide ${info.className}`}>
      {info.label}
    </span>
  );
}

export function Spinner({ className = 'h-4 w-4' }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

/** Single-field lookup used by the Check & Lookup tools. */
export function LookupForm({ label, value, onChange, onSubmit, placeholder, loading, buttonLabel, loadingLabel, error, hint }) {
  const id = useId();
  const [missing, setMissing] = useState(false);
  const handleSubmit = (event) => {
    event.preventDefault();
    if (loading) return;
    if (!value.trim()) {
      setMissing(true);
      document.getElementById(id)?.focus();
      return;
    }
    setMissing(false);
    onSubmit();
  };
  const shownError = error || (missing && !value.trim() ? 'Enter a domain or IP address to check.' : '');
  return (
    <form onSubmit={handleSubmit} className="mt-5" noValidate>
      <label htmlFor={id} className="block text-sm font-medium text-ink mb-1.5">{label}</label>
      <div className="flex flex-col sm:flex-row gap-2 max-w-2xl">
        <input
          id={id}
          type="text"
          inputMode="url"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck="false"
          className={`${inputClass} font-mono`}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={Boolean(shownError)}
          aria-describedby={shownError ? `${id}-error` : hint ? `${id}-hint` : undefined}
        />
        <button type="submit" className={`${primaryButtonClass} sm:min-w-[7.5rem]`} disabled={loading}>
          {loading && <Spinner />}
          {loading ? loadingLabel : buttonLabel}
        </button>
      </div>
      {hint && !shownError && <p id={`${id}-hint`} className="mt-1.5 text-xs text-ink-2">{hint}</p>}
      {shownError && <p id={`${id}-error`} role="alert" className="mt-2 text-sm text-s5">{shownError}</p>}
    </form>
  );
}

const ALERT_TONES = {
  error: 'bg-s5-soft text-s5 border-s5/30',
  warning: 'bg-s4-soft text-s4 border-s4/30',
  info: 'bg-info-soft text-info border-info/25',
};

export function Alert({ tone = 'error', children, className = '' }) {
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-md border px-3.5 py-2.5 text-sm ${ALERT_TONES[tone]} ${className}`}>
      {children}
    </div>
  );
}

/** Placeholder shown before the first lookup or when a list is empty: says what to do next. */
export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="py-10 px-4 max-w-md">
      {Icon && <Icon className="text-2xl text-ink-3 mb-3" aria-hidden="true" />}
      {title && <p className="font-semibold text-ink">{title}</p>}
      {children && <p className="text-sm text-ink-2 mt-1">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Label/value cell used in result grids. */
export function InfoTile({ label, value, tone }) {
  const tones = {
    good: 'border-s2/30 bg-s2-soft',
    bad: 'border-s5/30 bg-s5-soft',
  };
  return (
    <div className={`rounded-md border px-3 py-2 ${tones[tone] || 'border-rule bg-paper'}`}>
      <p className="font-mono text-xs text-ink-2">{label}</p>
      <p className="text-sm font-semibold text-ink mt-0.5 break-all tabular-nums">{value ?? '—'}</p>
    </div>
  );
}

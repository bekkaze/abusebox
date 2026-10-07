import { useId } from 'react';

/* Shared building blocks so every page gets the same surfaces, dark mode,
   labels and states without re-styling them by hand. */

export const cardClass =
  'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm';

export const inputClass =
  'h-11 w-full px-3.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900/60 ' +
  'text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 ' +
  'focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-colors';

export const primaryButtonClass =
  'inline-flex items-center justify-center gap-2 h-11 px-5 rounded-lg font-medium text-white bg-cyan-600 ' +
  'hover:bg-cyan-700 active:translate-y-px transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

export const secondaryButtonClass =
  'inline-flex items-center justify-center gap-2 h-11 px-4 rounded-lg font-medium text-sm text-slate-700 dark:text-slate-200 ' +
  'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 active:translate-y-px transition-colors ' +
  'disabled:opacity-50 disabled:cursor-not-allowed';

export function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <div className={`${cardClass} p-5`}>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && <p className="text-sm text-slate-500 dark:text-slate-400">{eyebrow}</p>}
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">{title}</h1>
          {description && <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 max-w-prose">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 sm:justify-end">{actions}</div>}
      </div>
    </div>
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
  const handleSubmit = (event) => {
    event.preventDefault();
    if (!loading) onSubmit();
  };
  return (
    <form onSubmit={handleSubmit} className="mt-4" noValidate>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{label}</label>
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          id={id}
          type="text"
          inputMode="url"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck="false"
          className={inputClass}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        />
        <button type="submit" className={`${primaryButtonClass} sm:min-w-[8.5rem]`} disabled={loading || !value.trim()}>
          {loading && <Spinner />}
          {loading ? loadingLabel : buttonLabel}
        </button>
      </div>
      {hint && !error && <p id={`${id}-hint`} className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
      {error && <p id={`${id}-error`} role="alert" className="mt-2 text-sm text-rose-600 dark:text-rose-400">{error}</p>}
    </form>
  );
}

const ALERT_TONES = {
  error: 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300',
  warning: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200',
  info: 'bg-sky-50 dark:bg-sky-900/20 border-sky-200 dark:border-sky-800 text-sky-800 dark:text-sky-200',
};

export function Alert({ tone = 'error', children, className = '' }) {
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-xl border p-4 text-sm ${ALERT_TONES[tone]} ${className}`}>
      {children}
    </div>
  );
}

/** Placeholder shown before the first lookup or when a list is empty. */
export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="text-center py-10 px-4">
      {Icon && <Icon className="mx-auto text-4xl text-slate-300 dark:text-slate-600 mb-3" aria-hidden="true" />}
      {title && <p className="font-medium text-slate-700 dark:text-slate-300">{title}</p>}
      {children && <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Label/value tile used in result grids. */
export function InfoTile({ label, value, tone }) {
  const tones = {
    good: 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-900/20',
    bad: 'border-rose-200 dark:border-rose-800 bg-rose-50/70 dark:bg-rose-900/20',
  };
  return (
    <div className={`rounded-lg border p-3 ${tones[tone] || 'border-slate-200 dark:border-slate-600 bg-slate-50/70 dark:bg-slate-700/30'}`}>
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 mt-0.5 break-all tabular-nums">{value ?? '—'}</p>
    </div>
  );
}

import { HiCheckCircle, HiClock, HiExclamationCircle, HiQuestionMarkCircle } from 'react-icons/hi';

const STATUS = {
  listed: { label: 'Listed', icon: HiExclamationCircle, className: 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200' },
  requested: { label: 'Removal requested', icon: HiClock, className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200' },
  unavailable: { label: 'No answer', icon: HiQuestionMarkCircle, className: 'bg-slate-200 text-slate-700 dark:bg-slate-600 dark:text-slate-200' },
  clear: { label: 'Clear', icon: HiCheckCircle, className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200' },
};

// Icon + text so status never relies on color alone.
export default function ProviderStatusBadge({ status }) {
  const info = STATUS[status] || STATUS.clear;
  const Icon = info.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${info.className}`}>
      <Icon aria-hidden="true" /> {info.label}
    </span>
  );
}

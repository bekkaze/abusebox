import { useEffect, useRef, useState } from 'react';
import { HiOutlineArrowPath } from 'react-icons/hi2';

const INTERVALS = [
  { label: 'Auto-refresh off', value: 0 },
  { label: 'Every 30 s', value: 30 },
  { label: 'Every minute', value: 60 },
  { label: 'Every 5 min', value: 300 },
];

export default function AutoRefresh({ onRefresh, loading = false }) {
  const [interval, setInterval_] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (interval > 0) {
      timerRef.current = setInterval(() => {
        onRefresh();
      }, interval * 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [interval, onRefresh]);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onRefresh}
        disabled={loading}
        className="inline-flex items-center justify-center h-9 w-9 rounded-md border border-rule-strong text-ink-2 hover:bg-sunk hover:text-ink transition-colors disabled:opacity-50"
        title="Refresh now"
        aria-label="Refresh now"
      >
        <HiOutlineArrowPath className={`text-base ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
      </button>
      <select
        value={interval}
        onChange={(e) => setInterval_(Number(e.target.value))}
        aria-label="Auto-refresh interval"
        title="Auto-refresh interval"
        className="h-9 text-sm border border-rule-strong rounded-md pl-2 pr-7 bg-paper text-ink-2 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25"
      >
        {INTERVALS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

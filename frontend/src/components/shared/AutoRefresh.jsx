import React, { useEffect, useRef, useState } from 'react';
import { HiRefresh } from 'react-icons/hi';

const INTERVALS = [
  { label: 'Off', value: 0 },
  { label: '30s', value: 30 },
  { label: '1m', value: 60 },
  { label: '5m', value: 300 },
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
        onClick={onRefresh}
        disabled={loading}
        className="p-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
        title="Refresh now"
      >
        <HiRefresh className={`text-lg ${loading ? 'animate-spin' : ''}`} />
      </button>
      <select
        value={interval}
        onChange={(e) => setInterval_(Number(e.target.value))}
        className="text-xs border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-cyan-500"
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

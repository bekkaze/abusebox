import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import axios from 'axios';
import { useTheme } from '../../../services/theme/themeProvider';
import { SkeletonLine } from '../../shared/Skeleton';

// Within ~2 days the date alone repeats on every tick, so show the time instead.
const tickFormatter = (points) => {
  const times = points.map((p) => new Date(p.date).getTime()).filter((t) => !Number.isNaN(t));
  const short = times.length > 1 && Math.max(...times) - Math.min(...times) < 2 * 86400000;
  return (iso) => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    return short
      ? date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
      : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };
};

const formatFull = (iso) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};

export default function HistoryChart({ hostnameId, hostname }) {
  const { dark } = useTheme();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    axios.get(`/api/hostname/${hostnameId}/history/?limit=60`)
      .then((response) => {
        if (!active) return;
        setFailed(false);
        setData((response.data.history || []).map((h) => ({
          date: h.date,
          detected: h.detected_count,
          total: h.total_providers,
        })));
      })
      .catch(() => active && setFailed(true))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [hostnameId]);

  const latest = data[data.length - 1];
  const peak = data.reduce((max, point) => Math.max(max, point.detected || 0), 0);
  const summary = latest
    ? `${data.length} checks. Latest: listed on ${latest.detected} of ${latest.total} providers. Peak: ${peak}.`
    : '';

  return (
    <figure className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-white dark:bg-slate-800 shadow-sm">
      <figcaption className="flex items-baseline justify-between gap-3 mb-3">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">
          Listings over time{' '}
          <Link to={`/dashboard/assets/${hostnameId}`} className="text-cyan-700 dark:text-cyan-400 hover:underline">{hostname}</Link>
        </span>
        {latest && <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">{data.length === 1 ? 'First check' : `Last ${data.length} checks`}</span>}
      </figcaption>

      {loading ? (
        <div className="h-[200px] flex items-end gap-2 px-2" aria-busy="true" aria-label="Loading chart">
          {[40, 70, 30, 55, 20, 65, 45].map((h, i) => <SkeletonLine key={i} className="flex-1" style={{ height: `${h}%` }} />)}
        </div>
      ) : failed ? (
        <p className="h-[200px] flex items-center justify-center text-sm text-rose-600 dark:text-rose-400">Could not load history.</p>
      ) : data.length === 0 ? (
        <p className="h-[200px] flex items-center justify-center text-sm text-slate-500 dark:text-slate-400 text-center px-6">
          No checks yet. History appears after the first check runs.
        </p>
      ) : (
        <>
          <p className="sr-only">{summary}</p>
          <div aria-hidden="true">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={dark ? '#334155' : '#e2e8f0'} />
                <XAxis dataKey="date" tickFormatter={tickFormatter(data)} tick={{ fontSize: 11 }} stroke={dark ? '#64748b' : '#94a3b8'} minTickGap={24} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke={dark ? '#64748b' : '#94a3b8'} />
                <Tooltip
                  labelFormatter={formatFull}
                  formatter={(value, _name, item) => [`${value} of ${item.payload.total}`, 'Listed on']}
                  cursor={{ fill: dark ? 'rgba(148,163,184,0.12)' : 'rgba(148,163,184,0.18)' }}
                  contentStyle={{
                    borderRadius: '8px',
                    fontSize: '12px',
                    border: `1px solid ${dark ? '#334155' : '#e2e8f0'}`,
                    background: dark ? '#0f172a' : '#ffffff',
                    color: dark ? '#e2e8f0' : '#0f172a',
                  }}
                />
                <Bar dataKey="detected" name="Listed on" fill="#e11d48" radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </figure>
  );
}

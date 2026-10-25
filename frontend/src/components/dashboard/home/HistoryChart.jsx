import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import axios from 'axios';
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

export default function HistoryChart({ hostnameId, hostname, showHostname = true }) {
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
    <figure>
      <figcaption className="flex items-baseline justify-between gap-3 mb-2">
        {showHostname && <Link to={`/dashboard/assets/${hostnameId}`} className="font-mono text-sm font-semibold text-ink hover:text-accent truncate">{hostname}</Link>}
        {data.length > 1 && <span className="text-xs text-ink-2 whitespace-nowrap">Lists per check, last {data.length}</span>}
      </figcaption>

      {loading ? (
        <div className="h-[160px] flex items-end gap-2 px-2" aria-busy="true" aria-label="Loading chart">
          {[40, 70, 30, 55, 20, 65, 45].map((h, i) => <SkeletonLine key={i} className="flex-1" style={{ height: `${h}%` }} />)}
        </div>
      ) : failed ? (
        <p className="h-[160px] flex items-center text-sm text-s5">Could not load history.</p>
      ) : data.length === 1 ? (
        // One check is a fact, not a trend: say it instead of drawing a single bar.
        <p className="text-sm">
          <span className="font-mono text-xs text-ink-2">First-Check:</span>{' '}
          <span className="text-ink">{new Date(latest.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, <span className="whitespace-nowrap">listed on {latest.detected} of {latest.total}</span></span>
        </p>
      ) : data.length === 0 ? (
        <p className="h-[160px] flex items-center text-sm text-ink-2">
          No checks yet. History appears after the first check runs.
        </p>
      ) : (
        <>
          <p className="sr-only">{summary}</p>
          <div aria-hidden="true">
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid vertical={false} stroke="rgb(var(--rule))" />
                <XAxis dataKey="date" tickFormatter={tickFormatter(data)} tick={{ fontSize: 11, fill: 'rgb(var(--ink-2))', fontFamily: 'Commit Mono, monospace' }} stroke="rgb(var(--rule-strong))" tickLine={false} minTickGap={24} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'rgb(var(--ink-2))', fontFamily: 'Commit Mono, monospace' }} stroke="rgb(var(--rule-strong))" tickLine={false} axisLine={false} />
                <Tooltip
                  labelFormatter={formatFull}
                  formatter={(value, _name, item) => [`${value} of ${item.payload.total}`, 'Listed on']}
                  cursor={{ fill: 'rgb(var(--ink) / 0.06)' }}
                  contentStyle={{
                    borderRadius: '6px',
                    fontSize: '12px',
                    border: '1px solid rgb(var(--rule))',
                    background: 'rgb(var(--paper))',
                    color: 'rgb(var(--ink))',
                    boxShadow: '0 4px 12px rgb(0 0 0 / 0.08)',
                  }}
                />
                <Bar dataKey="detected" name="Listed on" fill="rgb(var(--s5))" radius={[2, 2, 0, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </figure>
  );
}

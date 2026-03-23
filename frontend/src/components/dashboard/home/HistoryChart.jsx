import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import axios from 'axios';

export default function HistoryChart({ hostnameId, hostname }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await axios.get(`/api/hostname/${hostnameId}/history/`);
        const history = response.data.history || [];
        setData(
          history.map((h) => ({
            date: h.date ? new Date(h.date).toLocaleDateString() : '',
            detected: h.detected_count,
            total: h.total_providers,
          }))
        );
      } catch {
        setData([]);
      } finally {
        setLoading(false);
      }
    };

    if (hostnameId) fetchHistory();
  }, [hostnameId]);

  if (loading) return <p className="text-sm text-slate-500 dark:text-slate-400 p-4">Loading chart...</p>;
  if (data.length === 0) return <p className="text-sm text-slate-500 dark:text-slate-400 p-4">No history data available.</p>;

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-600 p-4 bg-white dark:bg-slate-800">
      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
        Blacklist History — {hostname}
      </h4>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#94a3b8" />
          <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
          <Tooltip
            contentStyle={{ borderRadius: '8px', fontSize: '12px', border: '1px solid #e2e8f0' }}
          />
          <Bar dataKey="detected" name="Detected" fill="#f43f5e" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

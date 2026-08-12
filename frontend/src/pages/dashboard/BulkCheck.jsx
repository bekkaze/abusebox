import React, { useState } from 'react';
import { bulkCheck, bulkCheckFile } from '../../services/tools';

export default function BulkCheck() {
  const [input, setInput] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCheck = async () => {
    const cleaned = input.split(/[\n,]+/).map(h => h.trim()).filter(Boolean);
    if (cleaned.length === 0) return;
    if (cleaned.length > 300) {
      setError('Maximum 300 hostnames per request.');
      return;
    }

    setLoading(true);
    setError('');
    setData(null);
    try {
      const result = await bulkCheck(cleaned.join(','));
      setData(result);
    } catch (err) {
      setError(err.message || 'Failed to run bulk check.');
    } finally {
      setLoading(false);
    }
  };

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError('');
    setData(null);
    try {
      setData(await bulkCheckFile(file));
    } catch (err) {
      setError(err.message || 'Failed to run bulk check from file.');
    } finally {
      setLoading(false);
      event.target.value = '';
    }
  };

  return (
    <section className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-5">
      <div>
        <p className="text-sm text-slate-500 dark:text-slate-400">Tools</p>
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">Bulk Blacklist Check</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">Check up to 300 IPs or domains. Paste a list or upload TXT, CSV, or Excel (.xlsx).</p>
      </div>

      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={"example.com\n8.8.8.8\n1.1.1.1"}
        rows={5}
        className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none font-mono text-sm dark:bg-slate-700 dark:text-white"
      />

      <label className="inline-flex text-sm font-medium text-cyan-700 dark:text-cyan-400 cursor-pointer">Upload TXT, CSV, or Excel<input type="file" accept=".txt,.csv,.xlsx" onChange={handleFile} disabled={loading} className="hidden" /></label>

      <div className="flex items-center gap-3">
        <button
          onClick={handleCheck}
          disabled={loading || !input.trim()}
          className="bg-cyan-600 hover:bg-cyan-700 text-white py-2.5 px-5 rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? 'Checking...' : 'Check All'}
        </button>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {input.split(/[\n,]+/).filter(h => h.trim()).length} / 300 hostnames
        </span>
      </div>

      {error && <div className="bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 rounded-xl p-4 text-sm text-rose-700 dark:text-rose-300">{error}</div>}

      {data && (
        <div className="space-y-4">
          <div className="flex gap-4">
            <div className="bg-sky-50 dark:bg-sky-900/30 border border-sky-200 dark:border-sky-800 rounded-lg px-4 py-2 text-center">
              <p className="text-xs uppercase tracking-wide text-sky-600 dark:text-sky-400">Total</p>
              <p className="text-xl font-bold text-sky-700 dark:text-sky-300">{data.total}</p>
            </div>
            <div className="bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 rounded-lg px-4 py-2 text-center">
              <p className="text-xs uppercase tracking-wide text-rose-600 dark:text-rose-400">Blacklisted</p>
              <p className="text-xl font-bold text-rose-700 dark:text-rose-300">{data.blacklisted_count}</p>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 dark:border-slate-600 overflow-hidden">
            <table className="w-full text-slate-700 dark:text-slate-300 border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-700">
                <tr className="text-left border-b border-slate-200 dark:border-slate-600">
                  <th className="px-4 py-3 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Hostname / IP</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Status</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Detected On</th>
                </tr>
              </thead>
              <tbody>
                {data.results.map((result, i) => (
                  <tr key={i} className="border-b border-slate-100 dark:border-slate-600 hover:bg-slate-50/60 dark:hover:bg-slate-700/50">
                    <td className="px-4 py-2.5 font-mono text-sm">{result.hostname}</td>
                    <td className="px-4 py-2.5">
                      {result.error ? (
                        <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold bg-slate-100 text-slate-600">Error</span>
                      ) : (
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${result.is_blacklisted ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {result.is_blacklisted ? `Listed (${result.detected_count})` : 'Clear'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-sm">
                      {result.detected_on?.map(d => d.provider).join(', ') || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

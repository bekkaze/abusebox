import React, { useState } from 'react';
import { checkEmailSecurity } from '../../services/tools';

const GRADE_COLORS = {
  A: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  B: 'bg-sky-100 text-sky-800 border-sky-300',
  D: 'bg-amber-100 text-amber-800 border-amber-300',
  F: 'bg-rose-100 text-rose-800 border-rose-300',
};

export default function EmailSecurity() {
  const [hostname, setHostname] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCheck = async () => {
    if (!hostname.trim()) return;
    setLoading(true);
    setError('');
    setData(null);
    try {
      const result = await checkEmailSecurity(hostname.trim());
      setData(result);
    } catch (err) {
      setError(err.message || 'Failed to check email security.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-5">
      <div>
        <p className="text-sm text-slate-500 dark:text-slate-400">Tools</p>
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">SPF / DKIM / DMARC Checker</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">Validate email authentication records for any domain.</p>
      </div>

      <div className="flex gap-3">
        <input
          type="text"
          value={hostname}
          onChange={(e) => setHostname(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCheck()}
          placeholder="example.com"
          className="flex-1 p-2.5 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none dark:bg-slate-700 dark:text-white"
        />
        <button
          onClick={handleCheck}
          disabled={loading || !hostname.trim()}
          className="bg-cyan-600 hover:bg-cyan-700 text-white py-2.5 px-5 rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? 'Checking...' : 'Check'}
        </button>
      </div>

      {error && <div className="bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 rounded-xl p-4 text-sm text-rose-700 dark:text-rose-300">{error}</div>}

      {data && (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className={`rounded-xl border-2 px-5 py-3 text-center ${GRADE_COLORS[data.grade] || GRADE_COLORS.F}`}>
              <p className="text-xs uppercase tracking-wide font-medium opacity-70">Grade</p>
              <p className="text-4xl font-black">{data.grade}</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-slate-800 dark:text-slate-200">{data.domain}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Score: {data.score} / {data.max_score}</p>
            </div>
          </div>

          <CheckSection title="SPF" found={data.spf?.found} data={data.spf} />
          <CheckSection title="DKIM" found={data.dkim?.found} data={data.dkim} />
          <CheckSection title="DMARC" found={data.dmarc?.found} data={data.dmarc} />
        </div>
      )}
    </section>
  );
}

function CheckSection({ title, found, data }) {
  return (
    <div className={`rounded-lg border p-4 ${found ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/20' : 'border-rose-200 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-900/20'}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${found ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
          {found ? 'FOUND' : 'MISSING'}
        </span>
        <h4 className="font-semibold text-slate-800 dark:text-slate-200">{title}</h4>
      </div>

      {data?.record && (
        <pre className="bg-slate-900 text-slate-200 rounded-lg p-3 text-xs overflow-auto mt-2 whitespace-pre-wrap">{data.record}</pre>
      )}

      {data?.policy && (
        <p className="text-sm mt-2 text-slate-700 dark:text-slate-300">
          Policy: <span className="font-semibold">{data.policy}</span>
          {data.subdomain_policy && <> | Subdomain: <span className="font-semibold">{data.subdomain_policy}</span></>}
        </p>
      )}

      {data?.selectors_found?.length > 0 && (
        <div className="mt-2 space-y-1">
          {data.selectors_found.map((s, i) => (
            <p key={i} className="text-sm text-slate-700 dark:text-slate-300">
              Selector: <span className="font-mono font-semibold">{s.selector}</span>
              {s.cname && <span className="text-slate-500"> (CNAME: {s.cname})</span>}
            </p>
          ))}
        </div>
      )}

      {data?.details && !data.record && !data.selectors_found?.length && (
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{data.details}</p>
      )}

      {data?.warnings?.length > 0 && (
        <div className="mt-2 space-y-1">
          {data.warnings.map((w, i) => (
            <p key={i} className="text-xs text-amber-700 dark:text-amber-400">Warning: {w}</p>
          ))}
        </div>
      )}
    </div>
  );
}

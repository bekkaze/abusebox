import React, { useState } from 'react';
import { checkSubnet, exportSubnetCsv } from '../../services/tools';

export default function SubnetCheck() {
  const [cidr, setCidr] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCheck = async () => {
    if (!cidr.trim()) return;
    setLoading(true);
    setError('');
    setData(null);
    try {
      const result = await checkSubnet(cidr.trim());
      setData(result);
    } catch (err) {
      setError(err.message || 'Failed to check subnet.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-5">
      <div>
        <p className="text-sm text-slate-500 dark:text-slate-400">Tools</p>
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">Subnet / CIDR Check</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">Scan an entire IP range against DNSBL providers. Max /24 (256 IPs).</p>
      </div>

      <div className="flex gap-3">
        <input
          type="text"
          value={cidr}
          onChange={(e) => setCidr(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCheck()}
          placeholder="192.168.1.0/24"
          className="flex-1 p-2.5 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none dark:bg-slate-700 dark:text-white"
        />
        <button
          onClick={handleCheck}
          disabled={loading || !cidr.trim()}
          className="bg-cyan-600 hover:bg-cyan-700 text-white py-2.5 px-5 rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? 'Scanning...' : 'Scan'}
        </button>
      </div>

      {error && <div className="bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 rounded-xl p-4 text-sm text-rose-700 dark:text-rose-300">{error}</div>}

      {data && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex gap-4">
              <Stat label="Total IPs" value={data.total_ips} tone="sky" />
              <Stat label="Blacklisted" value={data.blacklisted_count} tone="rose" />
              <Stat label="Clean" value={data.clean_count} tone="emerald" />
            </div>
            <button
              onClick={() => exportSubnetCsv(cidr.trim())}
              className="text-sm font-medium text-cyan-700 dark:text-cyan-400 hover:text-cyan-800"
            >
              Export CSV
            </button>
          </div>

          <div className="rounded-lg border border-slate-200 dark:border-slate-600 overflow-hidden">
            <div className="scrollable-table overflow-auto max-h-[60vh]">
              <table className="w-full text-slate-700 dark:text-slate-300 border-collapse">
                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-700">
                  <tr className="text-left border-b border-slate-200 dark:border-slate-600">
                    <th className="px-4 py-3 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">IP Address</th>
                    <th className="px-4 py-3 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Status</th>
                    <th className="px-4 py-3 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Listed On</th>
                  </tr>
                </thead>
                <tbody>
                  {data.results.map((result, i) => (
                    <tr key={i} className="border-b border-slate-100 dark:border-slate-600 hover:bg-slate-50/60 dark:hover:bg-slate-700/50">
                      <td className="px-4 py-2.5 font-mono text-sm">{result.ip}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${result.is_blacklisted ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {result.is_blacklisted ? 'Blacklisted' : 'Clear'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-sm">{result.listed_on?.join(', ') || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function Stat({ label, value, tone }) {
  const colors = {
    sky: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-800',
    rose: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800',
  };
  return (
    <div className={`rounded-lg border px-4 py-2 text-center ${colors[tone]}`}>
      <p className="text-xs uppercase tracking-wide opacity-70">{label}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
}

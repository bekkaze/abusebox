import React, { useState } from 'react';
import { checkSsl } from '../../services/tools';

export default function SslChecker() {
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
      const result = await checkSsl(hostname.trim());
      setData(result);
    } catch (err) {
      setError(err.message || 'Failed to check SSL certificate.');
    } finally {
      setLoading(false);
    }
  };

  const statusColor = (valid, days) => {
    if (!valid) return 'bg-rose-50 border-rose-200 dark:bg-rose-900/30 dark:border-rose-800';
    if (days < 30) return 'bg-amber-50 border-amber-200 dark:bg-amber-900/30 dark:border-amber-800';
    return 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/30 dark:border-emerald-800';
  };

  const statusText = (valid, days) => {
    if (!valid) return { label: 'Expired / Invalid', color: 'text-rose-700 dark:text-rose-300' };
    if (days < 30) return { label: `Expiring Soon (${days} days)`, color: 'text-amber-700 dark:text-amber-300' };
    return { label: `Valid (${days} days remaining)`, color: 'text-emerald-700 dark:text-emerald-300' };
  };

  return (
    <section className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-5">
      <div>
        <p className="text-sm text-slate-500 dark:text-slate-400">Tools</p>
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">SSL Certificate Checker</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">Check certificate validity, expiry date, issuer, and cipher details.</p>
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
          {loading ? 'Checking...' : 'Check SSL'}
        </button>
      </div>

      {error && <div className="bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 rounded-xl p-4 text-sm text-rose-700 dark:text-rose-300">{error}</div>}

      {data && (
        <div className="space-y-4">
          {data.error && !('valid' in data) ? (
            <div className="bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 rounded-xl p-4 text-sm text-rose-700 dark:text-rose-300">{data.error}</div>
          ) : (
            <>
              <div className={`rounded-xl border p-4 ${statusColor(data.valid, data.days_remaining)}`}>
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 font-medium">Certificate Status</p>
                    <p className={`text-2xl font-bold mt-1 ${statusText(data.valid, data.days_remaining).color}`}>
                      {statusText(data.valid, data.days_remaining).label}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500 dark:text-slate-400">Hostname</p>
                    <p className="font-medium text-slate-800 dark:text-slate-200">{data.hostname}</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                <div className="rounded-lg border border-slate-200 dark:border-slate-600 p-4 space-y-3">
                  <h4 className="font-semibold text-slate-800 dark:text-slate-200">Subject</h4>
                  <Row label="Common Name" value={data.subject?.common_name} />
                  <Row label="Organization" value={data.subject?.organization} />
                </div>
                <div className="rounded-lg border border-slate-200 dark:border-slate-600 p-4 space-y-3">
                  <h4 className="font-semibold text-slate-800 dark:text-slate-200">Issuer</h4>
                  <Row label="Common Name" value={data.issuer?.common_name} />
                  <Row label="Organization" value={data.issuer?.organization} />
                </div>
                <div className="rounded-lg border border-slate-200 dark:border-slate-600 p-4 space-y-3">
                  <h4 className="font-semibold text-slate-800 dark:text-slate-200">Validity</h4>
                  <Row label="Not Before" value={data.not_before} />
                  <Row label="Not After" value={data.not_after} />
                  <Row label="Serial Number" value={data.serial_number} />
                </div>
                <div className="rounded-lg border border-slate-200 dark:border-slate-600 p-4 space-y-3">
                  <h4 className="font-semibold text-slate-800 dark:text-slate-200">Cipher</h4>
                  <Row label="Name" value={data.cipher?.name} />
                  <Row label="Protocol" value={data.cipher?.protocol} />
                  <Row label="Bits" value={data.cipher?.bits} />
                </div>
              </div>

              {data.san?.length > 0 && (
                <div className="rounded-lg border border-slate-200 dark:border-slate-600 p-4">
                  <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Subject Alternative Names ({data.san.length})</h4>
                  <div className="flex flex-wrap gap-2">
                    {data.san.map((name, i) => (
                      <span key={i} className="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-full px-3 py-1 text-xs font-mono">{name}</span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className="font-medium text-slate-800 dark:text-slate-200 text-right break-all max-w-[60%]">{value || '—'}</span>
    </div>
  );
}

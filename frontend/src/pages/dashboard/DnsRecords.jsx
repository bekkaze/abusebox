import { useState } from 'react';
import { checkDns } from '../../services/tools';
import CopyButton from '../../components/shared/CopyButton';
import { LookupForm } from '../../components/shared/ui';

const RECORD_COLORS = {
  A: 'bg-sky-100 text-sky-800',
  AAAA: 'bg-indigo-100 text-indigo-800',
  MX: 'bg-amber-100 text-amber-800',
  TXT: 'bg-slate-100 text-slate-800',
  CNAME: 'bg-emerald-100 text-emerald-800',
  NS: 'bg-violet-100 text-violet-800',
  SOA: 'bg-rose-100 text-rose-800',
  PTR: 'bg-orange-100 text-orange-800',
};

export default function DnsRecords() {
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
      const result = await checkDns(hostname.trim());
      setData(result);
    } catch (err) {
      setError(err.message || 'Failed to lookup DNS records.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-5">
      <div>
        <p className="text-sm text-slate-500 dark:text-slate-400">Tools</p>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">DNS Record Viewer</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">Look up A, AAAA, MX, TXT, CNAME, NS, SOA, and PTR records for any domain.</p>
      </div>

      <LookupForm
        label="Domain"
        value={hostname}
        onChange={setHostname}
        onSubmit={handleCheck}
        placeholder="example.com"
        loading={loading}
        buttonLabel="Look up"
        loadingLabel="Looking up"
        error={error}
      />


      {data && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Records for <span className="text-cyan-700 dark:text-cyan-400">{data.domain}</span></h3>

          {Object.keys(data.records).length === 0 ? (
            <p className="text-sm text-slate-500">No records found.</p>
          ) : (
            Object.entries(data.records).map(([type, records]) => (
              <div key={type} className="rounded-lg border border-slate-200 dark:border-slate-600 overflow-hidden">
                <div className="bg-slate-50 dark:bg-slate-700 px-4 py-2 flex items-center gap-2">
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${RECORD_COLORS[type] || 'bg-slate-100 text-slate-700'}`}>
                    {type}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{records.length} record{records.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-600">
                  {records.map((record, i) => (
                    <div key={i} className="px-4 py-2.5 text-sm font-mono text-slate-700 dark:text-slate-300 break-all flex items-center justify-between">
                      <span>{record}</span>
                      <CopyButton text={record} />
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </section>
  );
}

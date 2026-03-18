import React, { useState } from 'react';
import { checkAbuseIPDB } from '../../services/tools';

export default function AbuseIPDB() {
  const [hostname, setHostname] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const handleCheck = async () => {
    if (!hostname.trim()) {
      setError('Enter an IP address or hostname.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await checkAbuseIPDB(hostname.trim());
      setData(result);
    } catch (err) {
      setData(null);
      setError(err.message || 'Failed to check AbuseIPDB.');
    } finally {
      setLoading(false);
    }
  };

  const scoreColor = (score) => {
    if (score === null || score === undefined) return 'text-slate-500';
    if (score === 0) return 'text-emerald-600';
    if (score <= 25) return 'text-yellow-600';
    if (score <= 75) return 'text-orange-600';
    return 'text-rose-600';
  };

  const scoreBg = (score) => {
    if (score === null || score === undefined) return 'bg-slate-100';
    if (score === 0) return 'bg-emerald-50 border-emerald-200';
    if (score <= 25) return 'bg-yellow-50 border-yellow-200';
    if (score <= 75) return 'bg-orange-50 border-orange-200';
    return 'bg-rose-50 border-rose-200';
  };

  return (
    <section className='space-y-5'>
      <div className='bg-white border border-slate-200 rounded-xl p-5 shadow-sm'>
        <p className='text-sm text-slate-500'>IP Reputation</p>
        <h2 className='text-2xl font-semibold text-slate-900 mt-1'>AbuseIPDB Check</h2>
        <div className="mt-4 flex flex-col md:flex-row gap-3">
          <input
            type="text"
            className="h-11 w-full px-4 rounded-xl border border-slate-300 focus:ring-2 focus:ring-cyan-500 focus:outline-none"
            placeholder="IP address or domain name"
            value={hostname}
            onChange={(e) => setHostname(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCheck()}
          />
          <button
            className={`h-11 px-6 rounded-xl font-medium ${loading ? 'bg-slate-300 text-slate-500' : 'bg-cyan-600 hover:bg-cyan-700 text-white'} transition-colors`}
            onClick={handleCheck}
            disabled={loading}
          >
            {loading ? 'Checking...' : 'Check'}
          </button>
        </div>
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        {!data ? (
          <p className="text-slate-500 text-sm">Enter an IP or hostname to check its abuse reputation.</p>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold text-slate-900">Report for {data.ip}</h3>
              {data.query !== data.ip && (
                <span className="text-sm text-slate-500">Resolved from: {data.query}</span>
              )}
            </div>

            <div className={`rounded-xl border p-5 ${scoreBg(data.abuse_confidence_score)}`}>
              <p className="text-sm text-slate-500 font-medium">Abuse Confidence Score</p>
              <p className={`text-4xl font-bold mt-1 ${scoreColor(data.abuse_confidence_score)}`}>
                {data.abuse_confidence_score}%
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {data.abuse_confidence_score === 0
                  ? 'No abuse reports — this IP looks clean.'
                  : data.abuse_confidence_score <= 25
                  ? 'Low risk — few reports filed.'
                  : data.abuse_confidence_score <= 75
                  ? 'Moderate risk — some abuse activity reported.'
                  : 'High risk — significant abuse activity detected.'}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <InfoCard label="ISP" value={data.isp} />
              <InfoCard label="Domain" value={data.domain} />
              <InfoCard label="Country" value={data.country_code} />
              <InfoCard label="Usage Type" value={data.usage_type} />
              <InfoCard label="Total Reports" value={data.total_reports} />
              <InfoCard label="Distinct Reporters" value={data.num_distinct_users} />
              <InfoCard label="Last Reported" value={data.last_reported_at || 'Never'} />
              <InfoCard label="Whitelisted" value={data.is_whitelisted ? 'Yes' : 'No'} />
              <InfoCard label="Public IP" value={data.is_public ? 'Yes' : 'No'} />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function InfoCard({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs text-slate-500 font-medium">{label}</p>
      <p className="text-sm font-semibold text-slate-800 mt-0.5">{value ?? '—'}</p>
    </div>
  );
}

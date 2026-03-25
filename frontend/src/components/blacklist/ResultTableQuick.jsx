import React from 'react';

const ResultTableQuick = ({ data }) => {
  const providerList = data?.providers || [];
  const detectedList = data?.detected_on || [];

  const providers = [...providerList].sort((a, b) => {
    const isBlacklistedA = detectedList.some((item) => item.provider === a);
    const isBlacklistedB = detectedList.some((item) => item.provider === b);

    return isBlacklistedB - isBlacklistedA;
  });

  const isBlacklisted = (provider) => {
    return detectedList.some((item) => item.provider === provider);
  };

  const abuse = data.abuseipdb;

  const scoreColor = (score) => {
    if (score == null) return 'text-slate-500';
    if (score === 0) return 'text-emerald-600';
    if (score <= 25) return 'text-yellow-600';
    if (score <= 75) return 'text-orange-600';
    return 'text-rose-600';
  };

  const scoreBg = (score) => {
    if (score == null) return 'bg-slate-50 border-slate-200';
    if (score === 0) return 'bg-emerald-50 border-emerald-200';
    if (score <= 25) return 'bg-yellow-50 border-yellow-200';
    if (score <= 75) return 'bg-orange-50 border-orange-200';
    return 'bg-rose-50 border-rose-200';
  };

  return (
    <div className="space-y-4">
      {abuse && (
        <div className={`rounded-xl border p-4 ${scoreBg(abuse.abuse_confidence_score)}`}>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500 font-medium">AbuseIPDB Score</p>
              <p className={`text-3xl font-bold mt-1 ${scoreColor(abuse.abuse_confidence_score)}`}>
                {abuse.abuse_confidence_score}%
              </p>
            </div>
            <div className="flex flex-wrap gap-4 text-sm">
              <div>
                <p className="text-xs text-slate-500">ISP</p>
                <p className="font-medium text-slate-800">{abuse.isp || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Country</p>
                <p className="font-medium text-slate-800">{abuse.country_code || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Reports</p>
                <p className="font-medium text-slate-800">{abuse.total_reports ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Last Reported</p>
                <p className="font-medium text-slate-800">{abuse.last_reported_at || 'Never'}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="scrollable-table overflow-auto max-h-[70vh]">
        <table className="w-full text-slate-700 border-collapse">
          <thead className="sticky top-0 bg-slate-50">
            <tr className="text-left border-b border-slate-200">
              <th className="px-4 py-3 text-xs uppercase tracking-wide text-slate-500">Provider</th>
              <th className="px-4 py-3 text-xs uppercase tracking-wide text-slate-500">Status</th>
            </tr>
          </thead>
          <tbody>
            {providers.map((provider, index) => (
              <tr key={index} className="border-b border-slate-200 hover:bg-slate-50/60">
                <td className="px-4 py-2.5 font-medium">{provider}</td>
                <td className="px-4 py-2.5">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${isBlacklisted(provider) ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                    {isBlacklisted(provider) ? 'Blacklisted' : 'Clear'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ResultTableQuick;

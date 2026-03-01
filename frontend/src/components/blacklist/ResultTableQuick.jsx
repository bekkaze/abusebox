import React from 'react';

const ResultTableQuick = ({ data }) => {
  const providers = [...data.providers].sort((a, b) => {
    const isBlacklistedA = data.detected_on.some((item) => item.provider === a);
    const isBlacklistedB = data.detected_on.some((item) => item.provider === b);

    return isBlacklistedB - isBlacklistedA;
  });

  const isBlacklisted = (provider) => {
    return data.detected_on.some((item) => item.provider === provider);
  };

  return (
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
  );
};

export default ResultTableQuick;

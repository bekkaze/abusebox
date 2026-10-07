import ProviderStatusBadge from './ProviderStatusBadge';
import { providerStatus, sortProviders } from './providerStatus';

function scoreTone(score) {
  if (score == null) return 'text-slate-500 dark:text-slate-400';
  if (score === 0) return 'text-emerald-600 dark:text-emerald-400';
  if (score <= 25) return 'text-yellow-700 dark:text-yellow-300';
  if (score <= 75) return 'text-orange-600 dark:text-orange-400';
  return 'text-rose-600 dark:text-rose-400';
}

const ResultTableQuick = ({ data }) => {
  const providers = sortProviders(data);
  const listed = data?.detected_on?.length ?? 0;
  const unavailable = data?.failed_providers?.length ?? 0;
  const abuse = data?.abuseipdb;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm" role="status">
        <span className={`font-semibold ${listed ? 'text-rose-700 dark:text-rose-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
          {listed ? `Listed on ${listed} of ${providers.length} blacklists` : `Not listed on any of ${providers.length - unavailable} blacklists that answered`}
        </span>
        {unavailable > 0 && (
          <span className="text-slate-500 dark:text-slate-400">{unavailable} did not answer</span>
        )}
        {data?.is_inconclusive && (
          <span className="text-amber-700 dark:text-amber-300">Too many providers did not answer to trust a clean result</span>
        )}
      </div>

      {abuse && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">AbuseIPDB score</p>
              <p className={`text-3xl font-bold mt-1 tabular-nums ${scoreTone(abuse.abuse_confidence_score)}`}>{abuse.abuse_confidence_score}%</p>
            </div>
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-2 text-sm">
              {[['ISP', abuse.isp], ['Country', abuse.country_code], ['Reports', abuse.total_reports], ['Last reported', abuse.last_reported_at?.slice(0, 10) || 'Never']].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt>
                  <dd className="font-medium text-slate-800 dark:text-slate-200">{value ?? '—'}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      )}

      <div className="overflow-auto max-h-[70vh] rounded-lg border border-slate-200 dark:border-slate-700">
        <table className="w-full text-sm text-slate-700 dark:text-slate-300 border-collapse">
          <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 z-[1]">
            <tr className="text-left border-b border-slate-200 dark:border-slate-700">
              <th scope="col" className="px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400">Provider</th>
              <th scope="col" className="px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {providers.map((provider) => (
              <tr key={provider} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/60">
                <td className="px-4 py-2.5 font-medium break-all">{provider}</td>
                <td className="px-4 py-2.5"><ProviderStatusBadge status={providerStatus(data, provider)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ResultTableQuick;

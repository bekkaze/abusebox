import { useState } from 'react';
import { HiShieldExclamation } from 'react-icons/hi';
import { checkAbuseIPDB } from '../../services/tools';
import { EmptyState, InfoTile, LookupForm, cardClass } from '../../components/shared/ui';

function scoreTone(score) {
  if (score === null || score === undefined) return { text: 'text-slate-500', box: 'bg-slate-50 dark:bg-slate-700/30 border-slate-200 dark:border-slate-600' };
  if (score === 0) return { text: 'text-emerald-600 dark:text-emerald-400', box: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' };
  if (score <= 25) return { text: 'text-yellow-700 dark:text-yellow-300', box: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800' };
  if (score <= 75) return { text: 'text-orange-600 dark:text-orange-400', box: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800' };
  return { text: 'text-rose-600 dark:text-rose-400', box: 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800' };
}

function scoreSummary(score) {
  if (score === 0) return 'No abuse reports. This IP looks clean.';
  if (score <= 25) return 'Low risk: a few reports filed.';
  if (score <= 75) return 'Moderate risk: some abuse activity reported.';
  return 'High risk: significant abuse activity reported.';
}

export default function AbuseIPDB() {
  const [hostname, setHostname] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const handleCheck = async () => {
    setLoading(true);
    setError('');
    try {
      setData(await checkAbuseIPDB(hostname.trim()));
    } catch (err) {
      setData(null);
      setError(err.message || 'AbuseIPDB lookup failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const tone = scoreTone(data?.abuse_confidence_score);

  return (
    <section className="space-y-5">
      <div className={`${cardClass} p-5`}>
        <p className="text-sm text-slate-500 dark:text-slate-400">IP reputation</p>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">AbuseIPDB check</h1>
        <LookupForm
          label="IP address or hostname"
          value={hostname}
          onChange={setHostname}
          onSubmit={handleCheck}
          placeholder="203.0.113.10 or mail.example.com"
          loading={loading}
          buttonLabel="Check"
          loadingLabel="Checking"
          error={error}
          hint="Hostnames are resolved to their IPv4 address first."
        />
      </div>

      <div className={`${cardClass} p-5`}>
        {!data ? (
          <EmptyState icon={HiShieldExclamation} title="No lookup yet">
            Enter an IP or hostname to see its abuse confidence score, ISP and report history.
          </EmptyState>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Report for {data.ip}</h2>
              {data.query !== data.ip && (
                <span className="text-sm text-slate-500 dark:text-slate-400">Resolved from {data.query}</span>
              )}
            </div>

            <div className={`rounded-xl border p-5 ${tone.box}`}>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Abuse confidence score</p>
              <p className={`text-4xl font-bold mt-1 tabular-nums ${tone.text}`}>{data.abuse_confidence_score}%</p>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{scoreSummary(data.abuse_confidence_score)}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <InfoTile label="ISP" value={data.isp} />
              <InfoTile label="Domain" value={data.domain} />
              <InfoTile label="Country" value={data.country_code} />
              <InfoTile label="Usage type" value={data.usage_type} />
              <InfoTile label="Total reports" value={data.total_reports} />
              <InfoTile label="Distinct reporters" value={data.num_distinct_users} />
              <InfoTile label="Last reported" value={data.last_reported_at || 'Never'} />
              <InfoTile label="Whitelisted" value={data.is_whitelisted ? 'Yes' : 'No'} />
              <InfoTile label="Public IP" value={data.is_public ? 'Yes' : 'No'} />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

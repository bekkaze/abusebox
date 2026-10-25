import { useState } from 'react';
import { HiOutlineFlag } from 'react-icons/hi2';
import { checkAbuseIPDB } from '../../services/tools';
import { SkeletonLine } from '../../components/shared/Skeleton';
import { EmptyState, Field, Fields, LookupForm, PageHeader, Section } from '../../components/shared/ui';

/** Score as a reply class: 0 is clear, 1-25 a warning, above 25 serious. */
function scoreClass(score) {
  if (score === null || score === undefined) return { code: '4.x', tone: 'text-s4' };
  if (score === 0) return { code: '2.x', tone: 'text-s2' };
  if (score <= 25) return { code: '4.x', tone: 'text-s4' };
  return { code: '5.x', tone: 'text-s5' };
}

function scoreSummary(score) {
  if (score === null || score === undefined) return 'AbuseIPDB returned no score for this address.';
  if (score === 0) return 'No abuse reports. This IP looks clean.';
  if (score <= 25) return 'Low risk: a few reports filed.';
  if (score <= 75) return 'Moderate risk: some abuse activity reported.';
  return 'High risk: significant abuse activity reported.';
}

function Verdict({ score }) {
  const status = scoreClass(score);
  const known = score !== null && score !== undefined;
  return (
    <div role="status" className="space-y-1">
      <p className="flex flex-wrap items-baseline gap-x-2.5">
        <span className={`font-mono text-lg font-semibold ${status.tone}`} aria-hidden="true">{status.code}</span>
        <span className="text-lg font-semibold text-ink">
          {known ? <>Abuse confidence <span className="tabular-nums">{score}%</span></> : 'Abuse confidence unknown'}
        </span>
      </p>
      <p className="text-sm text-ink-2">{scoreSummary(score)}</p>
    </div>
  );
}

const yesNo = (value) => (value ? 'Yes' : 'No');

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

  return (
    <div>
      <PageHeader
        title="AbuseIPDB check"
        description="Looks up an IP's abuse confidence score and report history on AbuseIPDB."
      />

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

      <div className="mt-8">
        {data ? (
          <Section
            id="abuseipdb-report"
            title={<>Report for <span className="font-mono font-semibold break-all">{data.ip}</span></>}
          >
            <div className="space-y-5">
              <Verdict score={data.abuse_confidence_score} />
              <Fields className="border-t border-rule pt-4">
                {data.query !== data.ip && (
                  <Field name="Resolved-From"><span className="font-mono text-[13px] break-all">{data.query}</span></Field>
                )}
                <Field name="ISP">{data.isp}</Field>
                <Field name="Domain">{data.domain ? <span className="font-mono text-[13px] break-all">{data.domain}</span> : null}</Field>
                <Field name="Country">{data.country_code}</Field>
                <Field name="Usage-Type">{data.usage_type}</Field>
                <Field name="Total-Reports"><span className="tabular-nums">{data.total_reports ?? '—'}</span></Field>
                <Field name="Distinct-Reporters"><span className="tabular-nums">{data.num_distinct_users ?? '—'}</span></Field>
                <Field name="Last-Reported">
                  {data.last_reported_at ? <span className="font-mono text-[13px]">{data.last_reported_at}</span> : 'Never'}
                </Field>
                <Field name="Whitelisted">{yesNo(data.is_whitelisted)}</Field>
                <Field name="Public-IP">{yesNo(data.is_public)}</Field>
              </Fields>
            </div>
          </Section>
        ) : loading ? (
          <div className="space-y-3" aria-busy="true" aria-label="Looking up AbuseIPDB">
            <SkeletonLine className="h-6 w-64" />
            <SkeletonLine className="h-4 w-80 max-w-full" />
            <div className="pt-3 space-y-2">{[...Array(6)].map((_, i) => <SkeletonLine key={i} className="h-4 w-96 max-w-full" />)}</div>
          </div>
        ) : (
          <EmptyState icon={HiOutlineFlag} title="No lookup yet">
            Enter an IP or hostname to see its abuse confidence score, ISP and report history.
          </EmptyState>
        )}
      </div>
    </div>
  );
}

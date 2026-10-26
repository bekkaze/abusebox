import ListingDetail from './ListingDetail';
import { listingFor, providerStatus, sortProviders } from './providerStatus';
import { Field, Fields, StatusTag } from '../shared/ui';

function scoreTone(score) {
  if (score == null) return 'text-ink-2';
  if (score === 0) return 'text-s2';
  if (score <= 25) return 'text-s4';
  return 'text-s5';
}

/** The verdict line above a blacklist result, in reply-class form. */
export function ResultVerdict({ data, providers, detailsOnly = false }) {
  const listed = data?.detected_on?.length ?? 0;
  const unavailable = data?.failed_providers?.length ?? 0;
  const answered = providers.length - unavailable;
  return (
    <div role="status" className="space-y-1">
      <p className={`flex flex-wrap items-baseline gap-x-2.5 ${detailsOnly ? 'sr-only' : ''}`}>
        <span className={`font-mono text-lg font-semibold ${listed ? 'text-s5' : 'text-s2'}`} aria-hidden="true">{listed ? '5.x' : '2.x'}</span>
        <span className="text-lg font-semibold text-ink">
          {listed ? `Listed on ${listed} of ${providers.length} blacklists` : `Not listed on any of the ${answered} blacklists that answered`}
        </span>
      </p>
      {unavailable > 0 && (
        <p className="text-sm text-ink-2">
          <span className="font-mono text-xs font-semibold text-s4">4.x</span> {unavailable} did not answer, so their result is unknown, not clean.
        </p>
      )}
      {data?.is_inconclusive && (
        <p className="text-sm font-medium text-s4">Too many blacklists did not answer to trust a clean result.</p>
      )}
    </div>
  );
}

/** One row per blacklist: zone, status, and why it lists the target. */
export function ProviderRows({ data, providers, action }) {
  return (
    <div className="table-wrap relative overflow-x-auto">
      <table className="w-full min-w-[34rem] text-sm border-collapse">
        <thead className="bg-sunk">
          <tr className="text-left">
            <th scope="col" className="px-3 py-2 font-mono text-xs font-normal text-ink-2 border-b border-rule">List</th>
            <th scope="col" className="px-3 py-2 font-mono text-xs font-normal text-ink-2 border-b border-rule">Status</th>
            <th scope="col" className="px-3 py-2 font-mono text-xs font-normal text-ink-2 border-b border-rule w-full">Reason</th>
            {action && <th scope="col" className="border-b border-rule"><span className="sr-only">Action</span></th>}
          </tr>
        </thead>
        <tbody>
          {providers.map((provider) => {
            const status = providerStatus(data, provider);
            const entry = listingFor(data, provider);
            return (
              <tr key={provider} className="border-b border-rule last:border-b-0 align-top hover:bg-sunk/60">
                <td className="px-3 py-2 font-mono text-[13px] text-ink whitespace-nowrap">{provider}</td>
                <td className="px-3 py-2"><StatusTag status={status} /></td>
                <td className="px-3 py-2">
                  {entry ? <ListingDetail entry={entry} /> : status === 'unavailable' ? <span className="text-ink-2">Refused, rate-limited or timed out</span> : null}
                </td>
                {action && <td className="px-3 py-2 text-right whitespace-nowrap">{action(provider, status, entry)}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const ResultTableQuick = ({ data }) => {
  const providers = sortProviders(data);
  const abuse = data?.abuseipdb;

  return (
    <div className="space-y-5">
      <ResultVerdict data={data} providers={providers} />

      {abuse && (
        <div className="flex flex-wrap items-start gap-x-10 gap-y-3 border-y border-rule py-3">
          <div>
            <p className="font-mono text-xs text-ink-2">AbuseIPDB-Score:</p>
            <p className={`text-2xl font-semibold tabular-nums ${scoreTone(abuse.abuse_confidence_score)}`}>{abuse.abuse_confidence_score}%</p>
          </div>
          <Fields className="flex-1 min-w-[16rem]">
            <Field name="ISP">{abuse.isp}</Field>
            <Field name="Country">{abuse.country_code}</Field>
            <Field name="Reports"><span className="tabular-nums">{abuse.total_reports}</span></Field>
            <Field name="Last-Reported">{abuse.last_reported_at?.slice(0, 10) || 'Never'}</Field>
          </Fields>
        </div>
      )}

      <ProviderRows data={data} providers={providers} />
    </div>
  );
};

export default ResultTableQuick;

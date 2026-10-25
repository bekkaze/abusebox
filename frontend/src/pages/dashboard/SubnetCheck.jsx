import { useState } from 'react';
import { HiOutlineArrowDownTray, HiOutlineTableCells } from 'react-icons/hi2';
import { checkSubnet, downloadSubnetCsv } from '../../services/tools';
import { SkeletonLine } from '../../components/shared/Skeleton';
import { EmptyState, LookupForm, PageHeader, Section, StatusTag, secondaryButtonClass } from '../../components/shared/ui';

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;
const addresses = (count) => `${count} address${count === 1 ? '' : 'es'}`;

/** listed, incomplete (some lists did not answer) or clear for one address. */
function rowStatus(result) {
  if (result.is_blacklisted) return { status: 'listed' };
  if (result.failed_on?.length) return { status: 'unavailable', label: 'Incomplete' };
  return { status: 'clear' };
}

/** The report's one-line verdict, in reply-class form. */
function Verdict({ data }) {
  const total = data.total_ips ?? 0;
  const listed = data.blacklisted_count ?? 0;
  const incomplete = data.incomplete_count ?? 0;
  const status = listed
    ? { code: '5.x', tone: 'text-s5', text: `${listed} of ${addresses(total)} listed` }
    : incomplete
      ? { code: '4.x', tone: 'text-s4', text: `No listings found, but ${addresses(incomplete)} could not be fully checked` }
      : { code: '2.x', tone: 'text-s2', text: total === 1 ? 'The address is not listed' : `None of the ${total} addresses is listed` };
  const skipped = data.failed_providers || [];
  return (
    <div role="status" className="space-y-1">
      <p className="flex flex-wrap items-baseline gap-x-2.5">
        <span className={`font-mono text-lg font-semibold ${status.tone}`} aria-hidden="true">{status.code}</span>
        <span className="text-lg font-semibold text-ink">{status.text}</span>
      </p>
      {listed > 0 && incomplete > 0 && (
        <p className="text-sm text-ink-2">
          <span className="font-mono text-xs font-semibold text-s4">4.x</span> {incomplete} more could not be fully checked, so their result is unknown, not clean.
        </p>
      )}
      {skipped.length > 0 && (
        <p className="text-sm text-ink-2">
          <span className="font-mono text-xs font-semibold text-s4">4.x</span> Skipped {plural(skipped.length, 'list')} that did not answer:{' '}
          <span className="font-mono text-xs text-ink">{skipped.join(', ')}</span>
        </p>
      )}
    </div>
  );
}

/** Compact "Name: value" counts, like the dashboard summary. */
function SummaryStrip({ items }) {
  return (
    <p className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
      {items.map(([name, value]) => (
        <span key={name} className="whitespace-nowrap">
          <span className="font-mono text-xs text-ink-2">{name}:</span> <span className="text-ink tabular-nums">{value}</span>
        </span>
      ))}
    </p>
  );
}

const thClass = 'px-3 py-2 font-mono text-xs font-normal text-ink-2 border-b border-rule';

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
    <div>
      <PageHeader
        title="Subnet / CIDR check"
        description="Checks every address in a range, up to a /24, against the major DNS blacklists."
      />

      <LookupForm
        label="CIDR range"
        value={cidr}
        onChange={setCidr}
        onSubmit={handleCheck}
        placeholder="203.0.113.0/24"
        loading={loading}
        buttonLabel="Scan"
        loadingLabel="Scanning"
        error={error}
        hint="Up to /24 (256 addresses), checked against 7 major DNS blacklists."
      />

      <div className="mt-8">
        {data ? (
          <Section
            id="subnet-report"
            title={<>Report for <span className="font-mono font-semibold break-all">{data.cidr}</span></>}
            action={(
              <button type="button" className={secondaryButtonClass} onClick={() => downloadSubnetCsv(data)}>
                <HiOutlineArrowDownTray className="text-base text-ink-2" aria-hidden="true" /> Export CSV
              </button>
            )}
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <Verdict data={data} />
                <SummaryStrip
                  items={[
                    ['Total', data.total_ips],
                    ['Listed', data.blacklisted_count],
                    ['Clean', data.clean_count],
                    ['Incomplete', data.incomplete_count ?? 0],
                  ]}
                />
              </div>

              <div className="overflow-auto max-h-[60vh] rounded-md border border-rule">
                <table className="w-full text-sm border-collapse">
                  <thead className="sticky top-0 z-[1] bg-sunk">
                    <tr className="text-left">
                      <th scope="col" className={thClass}>IP</th>
                      <th scope="col" className={thClass}>Status</th>
                      <th scope="col" className={`${thClass} w-full`}>Listed on</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.results.map((result, i) => {
                      const { status, label } = rowStatus(result);
                      return (
                        <tr key={i} className="border-b border-rule last:border-b-0 align-top hover:bg-sunk/60">
                          <td className="px-3 py-2 font-mono text-[13px] text-ink whitespace-nowrap">{result.ip}</td>
                          <td className="px-3 py-2"><StatusTag status={status} label={label} /></td>
                          <td className="px-3 py-2">
                            {result.listed_on?.length
                              ? <span className="font-mono text-[13px] text-ink">{result.listed_on.join(', ')}</span>
                              : !result.failed_on?.length && <span className="text-ink-3" aria-label="None">—</span>}
                            {result.failed_on?.length > 0 && (
                              <span className="block text-xs text-ink-2">
                                No answer from <span className="font-mono">{result.failed_on.join(', ')}</span>
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </Section>
        ) : loading ? (
          <div className="space-y-3" aria-busy="true" aria-label="Scanning range">
            <SkeletonLine className="h-6 w-72" />
            <SkeletonLine className="h-4 w-96 max-w-full" />
            <div className="pt-3 space-y-2">{[...Array(8)].map((_, i) => <SkeletonLine key={i} className="h-9" />)}</div>
          </div>
        ) : (
          <EmptyState icon={HiOutlineTableCells} title="No scan yet">
            Enter a range such as 203.0.113.0/24 to see which of its addresses are listed.
          </EmptyState>
        )}
      </div>
    </div>
  );
}

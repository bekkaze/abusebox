import { useState } from 'react';
import { HiOutlineServer } from 'react-icons/hi2';
import { checkDns } from '../../services/tools';
import CopyButton from '../../components/shared/CopyButton';
import { SkeletonLine } from '../../components/shared/Skeleton';
import { EmptyState, LookupForm, PageHeader, Section } from '../../components/shared/ui';

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

/** Verdict line: what answered, and which record types had nothing. */
function DnsVerdict({ data }) {
  const types = Object.keys(data.records);
  const total = types.reduce((sum, type) => sum + data.records[type].length, 0);
  const missing = (data.record_types_checked || []).filter((type) => !types.includes(type));
  return (
    <div role="status" className="space-y-1">
      <p className="flex flex-wrap items-baseline gap-x-2.5">
        <span className={`font-mono text-lg font-semibold ${total ? 'text-s2' : 'text-s4'}`} aria-hidden="true">{total ? '2.x' : '4.x'}</span>
        <span className="text-lg font-semibold text-ink">
          {total ? `${plural(total, 'record')} across ${plural(types.length, 'record type')}` : 'No DNS records found'}
        </span>
      </p>
      {total > 0 && missing.length > 0 && (
        <p className="text-sm text-ink-2">
          No answer for <span className="font-mono text-xs">{missing.join(', ')}</span>.
        </p>
      )}
      {total === 0 && (
        <p className="text-sm text-ink-2">Check the spelling, or whether the domain is registered and delegated.</p>
      )}
    </div>
  );
}

function RecordTable({ type, records }) {
  const headingId = `dns-${type.toLowerCase()}`;
  return (
    <div>
      <h3 id={headingId} className="flex items-baseline gap-2 mb-2">
        <span className="font-mono text-sm font-semibold text-ink">{type}</span>
        <span className="text-xs text-ink-2">{plural(records.length, 'record')}</span>
      </h3>
      <div className="table-wrap relative overflow-x-auto">
        <table className="w-full text-sm border-collapse" aria-labelledby={headingId}>
          <thead className="bg-sunk">
            <tr className="text-left">
              <th scope="col" className="px-3 py-2 font-mono text-xs font-normal text-ink-2 border-b border-rule w-full">Value</th>
              <th scope="col" className="border-b border-rule"><span className="sr-only">Copy</span></th>
            </tr>
          </thead>
          <tbody>
            {records.map((record, i) => (
              <tr key={i} className="border-b border-rule last:border-b-0 align-top hover:bg-sunk/60">
                <td className="px-3 py-2 font-mono text-[13px] text-ink break-all">{record}</td>
                <td className="px-3 py-2 text-right">
                  <CopyButton text={record} label={`Copy ${type} record`} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

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
      setError(err.message || 'DNS lookup failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="DNS records"
        description="Looks up the A, AAAA, MX, TXT, CNAME, NS, SOA and PTR records for a domain."
      />

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

      <div className="mt-8">
        {data ? (
          <Section
            id="dns-report"
            title={<>Records for <span className="font-mono font-semibold break-all">{data.domain}</span></>}
          >
            <div className="space-y-6">
              <DnsVerdict data={data} />
              {Object.entries(data.records).map(([type, records]) => (
                <RecordTable key={type} type={type} records={records} />
              ))}
            </div>
          </Section>
        ) : loading ? (
          <div className="space-y-3" aria-busy="true" aria-label="Looking up DNS records">
            <SkeletonLine className="h-6 w-72 max-w-full" />
            <div className="pt-3 space-y-2">{[...Array(6)].map((_, i) => <SkeletonLine key={i} className="h-9" />)}</div>
          </div>
        ) : (
          <EmptyState icon={HiOutlineServer} title="No lookup yet">
            Enter a domain above to see its DNS records, grouped by type.
          </EmptyState>
        )}
      </div>
    </div>
  );
}

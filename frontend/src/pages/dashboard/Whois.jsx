import { useState } from 'react';
import { HiOutlineGlobeAlt } from 'react-icons/hi2';
import { checkWhois } from '../../services/tools';
import { SkeletonLine } from '../../components/shared/Skeleton';
import { EmptyState, LookupForm, PageHeader, Section, linkClass } from '../../components/shared/ui';
import WhoisTable from '../../components/shared/WhoisTable';

const DAY_MS = 24 * 60 * 60 * 1000;
const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

/** Registration expiry as the report's verdict line, in reply-class form. */
function ExpiryVerdict({ expiry }) {
  const date = expiry ? new Date(expiry) : null;
  // A date format the browser cannot read is still listed under Expires below.
  if (date && Number.isNaN(date.getTime())) return null;
  if (!date) {
    return (
      <p role="status" className="flex flex-wrap items-baseline gap-x-2.5">
        <span className="font-mono text-lg font-semibold text-info" aria-hidden="true">3.x</span>
        <span className="text-lg font-semibold text-ink">No expiry date in the WHOIS response</span>
      </p>
    );
  }
  const days = Math.floor((date.getTime() - Date.now()) / DAY_MS);
  const status = days < 0
    ? { code: '5.x', tone: 'text-s5', text: `Registration expired ${plural(-days, 'day')} ago` }
    : days <= 30
      ? { code: '4.x', tone: 'text-s4', text: `Registration expires in ${plural(days, 'day')}` }
      : { code: '2.x', tone: 'text-s2', text: `Registered, expires in ${plural(days, 'day')}` };
  return (
    <p role="status" className="flex flex-wrap items-baseline gap-x-2.5">
      <span className={`font-mono text-lg font-semibold ${status.tone}`} aria-hidden="true">{status.code}</span>
      <span className="text-lg font-semibold text-ink">{status.text}</span>
    </p>
  );
}

export default function Whois() {
  const [hostname, setHostname] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [showRaw, setShowRaw] = useState(false);

  const handleCheck = async () => {
    setLoading(true);
    setError('');
    try {
      setData(await checkWhois(hostname.trim()));
      setShowRaw(false);
    } catch (err) {
      setData(null);
      setError(err.message || 'WHOIS lookup failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="WHOIS lookup"
        description="Shows who a domain is registered with, when it expires, its name servers and abuse contact."
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
            id="whois-report"
            title={<>WHOIS for <span className="font-mono font-semibold break-all">{data.domain}</span></>}
            action={(
              <button
                type="button"
                className={`text-sm ${linkClass}`}
                onClick={() => setShowRaw(!showRaw)}
                aria-pressed={showRaw}
              >
                {showRaw ? 'Show parsed' : 'Show raw'}
              </button>
            )}
          >
            <div className="space-y-5">
              <ExpiryVerdict expiry={data.expiry_date} />
              {showRaw ? (
                <pre className="bg-sunk rounded-md p-3 text-xs font-mono text-ink overflow-auto max-h-[70vh] whitespace-pre-wrap break-words">{data.raw}</pre>
              ) : (
                <WhoisTable data={data} />
              )}
            </div>
          </Section>
        ) : loading ? (
          <div className="space-y-3" aria-busy="true" aria-label="Looking up WHOIS">
            <SkeletonLine className="h-6 w-72 max-w-full" />
            <div className="pt-3 space-y-2">{[...Array(8)].map((_, i) => <SkeletonLine key={i} className="h-4 max-w-xl" />)}</div>
          </div>
        ) : (
          <EmptyState icon={HiOutlineGlobeAlt} title="No lookup yet">
            Enter a domain above to see its registrar, key dates, name servers and abuse contact.
          </EmptyState>
        )}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { HiOutlineArrowUpTray, HiOutlineRectangleStack } from 'react-icons/hi2';
import { bulkCheck, bulkCheckFile } from '../../services/tools';
import { SkeletonLine } from '../../components/shared/Skeleton';
import {
  Alert,
  EmptyState,
  PageHeader,
  Section,
  SeverityTag,
  Spinner,
  StatusTag,
  primaryButtonClass,
  secondaryButtonClass,
} from '../../components/shared/ui';

const MAX_TARGETS = 300;

const textareaClass =
  'w-full px-3 py-2 rounded-md border border-rule-strong bg-paper font-mono text-sm text-ink placeholder:text-ink-2 ' +
  'focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 transition-colors aria-[invalid=true]:border-s5';

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

/** Status of one target: listed, clear, or no answer when it could not be checked. */
function rowStatus(result) {
  if (result.error) return 'unavailable';
  return result.is_blacklisted ? 'listed' : 'clear';
}

/** The report's one-line verdict, in reply-class form. */
function Verdict({ total, listed, incomplete }) {
  const status = listed
    ? { code: '5.x', tone: 'text-s5', text: `${listed} of ${plural(total, 'target')} listed` }
    : incomplete
      ? { code: '4.x', tone: 'text-s4', text: `No listings found, but ${plural(incomplete, 'target')} could not be checked` }
      : { code: '2.x', tone: 'text-s2', text: total === 1 ? 'The target is not listed' : `None of the ${total} targets is listed` };
  return (
    <div role="status" className="space-y-1">
      <p className="flex flex-wrap items-baseline gap-x-2.5">
        <span className={`font-mono text-lg font-semibold ${status.tone}`} aria-hidden="true">{status.code}</span>
        <span className="text-lg font-semibold text-ink">{status.text}</span>
      </p>
      {listed > 0 && incomplete > 0 && (
        <p className="text-sm text-ink-2">
          <span className="font-mono text-xs font-semibold text-s4">4.x</span> {incomplete} could not be checked, so their result is unknown, not clean.
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

function ListedOn({ result }) {
  if (result.error) return <span className="text-ink-2">{result.error}</span>;
  if (!result.detected_on?.length) return <span className="text-ink-3" aria-label="None">—</span>;
  return (
    <span className="flex flex-wrap gap-x-3 gap-y-1">
      {result.detected_on.map((entry) => (
        <span key={entry.provider} className="inline-flex items-center gap-1.5 whitespace-nowrap">
          <span className="font-mono text-[13px] text-ink">{entry.provider}</span>
          <SeverityTag severity={entry.severity} />
        </span>
      ))}
    </span>
  );
}

const thClass = 'px-3 py-2 font-mono text-xs font-normal text-ink-2 border-b border-rule';

export default function BulkCheck() {
  const [input, setInput] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCheck = async () => {
    const cleaned = input.split(/[\n,]+/).map(h => h.trim()).filter(Boolean);
    if (cleaned.length === 0) return;
    if (cleaned.length > MAX_TARGETS) {
      setError(`Maximum ${MAX_TARGETS} hostnames per request.`);
      return;
    }

    setLoading(true);
    setError('');
    setData(null);
    try {
      const result = await bulkCheck(cleaned.join(','));
      setData(result);
    } catch (err) {
      setError(err.message || 'Failed to run bulk check.');
    } finally {
      setLoading(false);
    }
  };

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError('');
    setData(null);
    try {
      setData(await bulkCheckFile(file));
    } catch (err) {
      setError(err.message || 'Failed to run bulk check from file.');
    } finally {
      setLoading(false);
      event.target.value = '';
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!loading) handleCheck();
  };

  const count = input.split(/[\n,]+/).filter(h => h.trim()).length;
  const results = data?.results || [];
  const listed = data?.blacklisted_count ?? 0;
  const incomplete = results.filter((result) => !result.is_blacklisted && result.error).length;
  const total = data?.total ?? results.length;

  return (
    <div>
      <PageHeader
        title="Bulk check"
        description="Checks up to 300 IPs or domains against the DNS blacklists in one run."
      />

      <form onSubmit={handleSubmit} className="mt-5 max-w-2xl" noValidate>
        <label htmlFor="bulk-check-input" className="block text-sm font-medium text-ink mb-1.5">Targets, one per line or comma-separated</label>
        <textarea
          id="bulk-check-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={"example.com\n203.0.113.10\n198.51.100.7"}
          rows={6}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck="false"
          aria-describedby="bulk-check-count"
          aria-invalid={count > MAX_TARGETS}
          className={textareaClass}
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button type="submit" disabled={loading || !input.trim()} className={primaryButtonClass}>
            {loading && <Spinner />}
            {loading ? 'Checking' : 'Check all'}
          </button>
          <label className={`${secondaryButtonClass} focus-within:ring-2 focus-within:ring-accent/40 ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
            <HiOutlineArrowUpTray className="text-base text-ink-2" aria-hidden="true" />
            Upload TXT, CSV or Excel
            <input type="file" accept=".txt,.csv,.xlsx" onChange={handleFile} disabled={loading} className="sr-only" />
          </label>
          <span id="bulk-check-count" className={`ml-auto text-xs tabular-nums ${count > MAX_TARGETS ? 'text-s5 font-semibold' : 'text-ink-2'}`}>
            {count} of {MAX_TARGETS} targets
          </span>
        </div>
      </form>

      {error && <Alert tone="error" className="mt-4 max-w-2xl">{error}</Alert>}

      <div className="mt-8">
        {data ? (
          <Section id="bulk-report" title={`Report for ${plural(total, 'target')}`}>
            <div className="space-y-4">
              <div className="space-y-2">
                <Verdict total={total} listed={listed} incomplete={incomplete} />
                <SummaryStrip
                  items={[
                    ['Total', total],
                    ['Listed', listed],
                    ['Clean', Math.max(total - listed - incomplete, 0)],
                    ['Incomplete', incomplete],
                  ]}
                />
              </div>

              <div className="overflow-auto max-h-[70vh] rounded-md border border-rule">
                <table className="w-full text-sm border-collapse">
                  <thead className="sticky top-0 z-[1] bg-sunk">
                    <tr className="text-left">
                      <th scope="col" className={thClass}>Target</th>
                      <th scope="col" className={thClass}>Status</th>
                      <th scope="col" className={`${thClass} w-full`}>Listed on</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((result, i) => (
                      <tr key={i} className="border-b border-rule last:border-b-0 align-top hover:bg-sunk/60">
                        <td className="px-3 py-2 font-mono text-[13px] text-ink whitespace-nowrap">{result.hostname}</td>
                        <td className="px-3 py-2"><StatusTag status={rowStatus(result)} /></td>
                        <td className="px-3 py-2"><ListedOn result={result} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Section>
        ) : loading ? (
          <div className="space-y-3" aria-busy="true" aria-label="Checking targets">
            <SkeletonLine className="h-6 w-72" />
            <SkeletonLine className="h-4 w-96 max-w-full" />
            <div className="pt-3 space-y-2">{[...Array(6)].map((_, i) => <SkeletonLine key={i} className="h-9" />)}</div>
          </div>
        ) : (
          <EmptyState icon={HiOutlineRectangleStack} title="No check yet">
            Paste your targets or upload a file, then run the check. Each target gets a row with the blacklists it is on and how serious each listing is.
          </EmptyState>
        )}
      </div>
    </div>
  );
}

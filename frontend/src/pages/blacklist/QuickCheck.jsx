import { useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { HiOutlineArrowDownTray, HiOutlineArrowLeft } from 'react-icons/hi2';
import { checkBlacklist } from '../../services/blacklist/checkService';
import { downloadBlacklistCsv } from '../../services/tools';
import Navbar from '../../components/landing/Navbar';
import ResultTableQuick from '../../components/blacklist/ResultTableQuick';
import { SkeletonLine } from '../../components/shared/Skeleton';
import { LookupForm, PageHeader, linkClass, secondaryButtonClass } from '../../components/shared/ui';

const QuickCheck = () => {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  // The target lives in the URL so a check can be shared or bookmarked.
  const hostname = (searchParams.get('hostname') || location.state?.hostname || '').trim();
  const [input, setInput] = useState(hostname);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!hostname) return undefined;
    let active = true;
    setLoading(true);
    setError('');
    setData(null);
    checkBlacklist(hostname)
      .then((result) => active && setData(result))
      .catch((err) => active && setError(err.message || 'Blacklist check failed. Try again.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [hostname]);

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <Link to="/" className={`${linkClass} inline-flex items-center gap-1.5 text-sm mb-5`}>
          <HiOutlineArrowLeft aria-hidden="true" /> Back to home
        </Link>

        <PageHeader
          title="Blacklist report"
          description="Check a domain or IPv4 address against every blacklist AbuseBox watches. No account needed."
        />

        <LookupForm
          label="Domain or IPv4 address"
          value={input}
          onChange={setInput}
          onSubmit={() => setSearchParams({ hostname: input.trim() })}
          placeholder="example.com or 8.8.8.8"
          loading={loading}
          buttonLabel="Check"
          loadingLabel="Checking"
          error={error}
        />

        {(loading || data) && (
          <section aria-labelledby="quick-check-report" className="mt-10">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule pb-3 mb-5">
              <h2 id="quick-check-report" className="text-lg font-semibold tracking-tight text-ink break-all">
                {loading ? 'Checking ' : 'Report for '}<span className="font-mono">{hostname}</span>
              </h2>
              {!loading && (
                <button type="button" className={secondaryButtonClass} onClick={() => downloadBlacklistCsv(data)}>
                  <HiOutlineArrowDownTray className="text-base" aria-hidden="true" /> Export CSV
                </button>
              )}
            </div>
            {loading ? (
              <div role="status" className="space-y-3">
                <p className="text-sm text-ink-2">
                  Querying blacklist providers for <span className="font-mono text-ink">{hostname}</span>. This can take up to 30 seconds.
                </p>
                <SkeletonLine className="h-6 w-72 max-w-full" />
                <div className="rounded-md border border-rule p-3 space-y-3">
                  {[...Array(8)].map((_, i) => <SkeletonLine key={i} className="h-4" style={{ width: `${92 - i * 6}%` }} />)}
                </div>
              </div>
            ) : (
              <ResultTableQuick data={data} />
            )}
          </section>
        )}
      </main>
    </div>
  );
};

export default QuickCheck;

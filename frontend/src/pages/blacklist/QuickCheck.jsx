import { useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { HiArrowLeft, HiDownload } from 'react-icons/hi';
import { checkBlacklist } from '../../services/blacklist/checkService';
import { downloadBlacklistCsv } from '../../services/tools';
import ResultTableQuick from '../../components/blacklist/ResultTableQuick';
import { LookupForm, Spinner, cardClass, secondaryButtonClass } from '../../components/shared/ui';

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
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 px-4 py-8">
      <main className="max-w-5xl mx-auto space-y-5">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-cyan-700 dark:text-cyan-400 hover:underline">
          <HiArrowLeft aria-hidden="true" /> Back to home
        </Link>

        <div className={`${cardClass} p-5`}>
          <p className="text-sm text-slate-500 dark:text-slate-400">Public check</p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Blacklist report</h1>
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
        </div>

        {(loading || data) && (
          <div className={`${cardClass} p-5`}>
            {loading ? (
              <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300 py-6" role="status">
                <Spinner className="h-5 w-5 text-cyan-600" /> Querying blacklist providers for {hostname}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white break-all">Target: {hostname}</h2>
                  <button type="button" className={secondaryButtonClass} onClick={() => downloadBlacklistCsv(data)}>
                    <HiDownload aria-hidden="true" /> Export CSV
                  </button>
                </div>
                <ResultTableQuick data={data} />
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default QuickCheck;

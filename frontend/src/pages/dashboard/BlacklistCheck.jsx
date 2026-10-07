import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { HiDownload, HiShieldCheck } from 'react-icons/hi';
import { checkBlacklist } from '../../services/blacklist/checkService';
import { downloadBlacklistCsv } from '../../services/tools';
import ResultTableQuick from '../../components/blacklist/ResultTableQuick';
import { EmptyState, LookupForm, cardClass, secondaryButtonClass } from '../../components/shared/ui';

export default function BlacklistCheck() {
  const [searchParams] = useSearchParams();
  const [hostname, setHostname] = useState(searchParams.get('hostname') || '');
  const [checked, setChecked] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const handleCheck = async (value = hostname) => {
    const target = value.trim();
    if (!target) return;
    setLoading(true);
    setError('');
    try {
      setData(await checkBlacklist(target));
      setChecked(target);
    } catch (err) {
      setData(null);
      setError(err.message || 'Blacklist check failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  // Run straight away when opened with ?hostname= (e.g. from the command palette).
  const requested = searchParams.get('hostname');
  const lastRun = useRef(null);
  useEffect(() => {
    if (requested && lastRun.current !== requested) {
      lastRun.current = requested;
      setHostname(requested);
      handleCheck(requested);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requested]);

  return (
    <section className="space-y-5">
      <div className={`${cardClass} p-5`}>
        <p className="text-sm text-slate-500 dark:text-slate-400">Quick probe</p>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Blacklist check</h1>
        <LookupForm
          label="IPv4 address or domain"
          value={hostname}
          onChange={setHostname}
          onSubmit={() => handleCheck()}
          placeholder="203.0.113.10 or mail.example.com"
          loading={loading}
          buttonLabel="Run check"
          loadingLabel="Checking"
          error={error}
        />
      </div>

      <div className={`${cardClass} p-5`}>
        {!data ? (
          <EmptyState icon={HiShieldCheck} title="No check yet">
            Run a check to see the status on every DNS blacklist provider.
          </EmptyState>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white break-all">Report for {checked}</h2>
              <button type="button" className={secondaryButtonClass} onClick={() => downloadBlacklistCsv(data)}>
                <HiDownload aria-hidden="true" /> Export CSV
              </button>
            </div>
            <ResultTableQuick data={data} />
          </div>
        )}
      </div>
    </section>
  );
}

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { HiOutlineArrowDownTray, HiOutlineShieldCheck } from 'react-icons/hi2';
import { checkBlacklist } from '../../services/blacklist/checkService';
import { downloadBlacklistCsv } from '../../services/tools';
import ResultTableQuick from '../../components/blacklist/ResultTableQuick';
import { SkeletonLine } from '../../components/shared/Skeleton';
import { EmptyState, LookupForm, PageHeader, Section, secondaryButtonClass } from '../../components/shared/ui';

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
    <div>
      <PageHeader
        title="Blacklist check"
        description="Checks one IPv4 address or domain against every DNS blacklist and says why each one lists it."
      />

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

      <div className="mt-8">
        {data ? (
          <Section
            id="blacklist-report"
            title={<>Report for <span className="font-mono font-semibold break-all">{checked}</span></>}
            action={(
              <button type="button" className={secondaryButtonClass} onClick={() => downloadBlacklistCsv(data)}>
                <HiOutlineArrowDownTray className="text-base text-ink-2" aria-hidden="true" /> Export CSV
              </button>
            )}
          >
            <ResultTableQuick data={data} />
          </Section>
        ) : loading ? (
          <div className="space-y-3" aria-busy="true" aria-label="Checking blacklists">
            <SkeletonLine className="h-6 w-72" />
            <SkeletonLine className="h-4 w-96 max-w-full" />
            <div className="pt-3 space-y-2">{[...Array(6)].map((_, i) => <SkeletonLine key={i} className="h-9" />)}</div>
          </div>
        ) : (
          <EmptyState icon={HiOutlineShieldCheck} title="No check yet">
            Enter an IP or domain above to see its status on every DNS blacklist.
          </EmptyState>
        )}
      </div>
    </div>
  );
}

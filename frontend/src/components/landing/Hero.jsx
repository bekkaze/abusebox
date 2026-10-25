import { useEffect, useRef, useState } from 'react';
import { HiOutlineArrowDownTray } from 'react-icons/hi2';
import { checkBlacklist } from '../../services/blacklist/checkService';
import { downloadBlacklistCsv } from '../../services/tools';
import ResultTableQuick, { ProviderRows } from '../blacklist/ResultTableQuick';
import { SkeletonLine } from '../shared/Skeleton';
import { Field, Fields, LookupForm, secondaryButtonClass } from '../shared/ui';

// Synthetic result in the real result shape, so the example is drawn by the
// same table as a live check. 203.0.113.0/24 is reserved for documentation.
const EXAMPLE_TARGET = '203.0.113.25';
const EXAMPLE_TOTAL = 24;
const EXAMPLE = {
  hostname: EXAMPLE_TARGET,
  providers: ['zen.spamhaus.org', 'b.barracudacentral.org', 'bl.spamcop.net', 'ips.backscatterer.org'],
  detected_on: [
    { provider: 'zen.spamhaus.org', status: 'open', severity: 'high', categories: ['PBL: end-user range, listed by its ISP'] },
    { provider: 'b.barracudacentral.org', status: 'open', severity: 'high', categories: ['poor sending reputation'] },
  ],
  failed_providers: [],
};

function ExampleReport() {
  const listed = EXAMPLE.detected_on.length;
  const hidden = EXAMPLE_TOTAL - EXAMPLE.providers.length;
  return (
    <figure aria-labelledby='example-report-title' className='min-w-0 lg:border-l lg:border-rule lg:pl-10'>
      <div className='flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-rule pb-2 mb-4'>
        <p id='example-report-title' className='text-sm font-semibold text-ink'>Example report</p>
        <p className='text-xs text-ink-2'>Sample data, not a live check</p>
      </div>

      <Fields className='mb-5'>
        <Field name='Target'><span className='font-mono'>{EXAMPLE_TARGET}</span></Field>
        <Field name='Checked'>{EXAMPLE_TOTAL} blacklists, every one answered its test points</Field>
      </Fields>

      <p className='flex flex-wrap items-baseline gap-x-2.5 mb-4'>
        <span className='font-mono text-lg font-semibold text-s5' aria-hidden='true'>5.x</span>
        <span className='text-lg font-semibold text-ink'>Listed on {listed} of {EXAMPLE_TOTAL} blacklists</span>
      </p>

      <ProviderRows data={EXAMPLE} providers={EXAMPLE.providers} />
      <figcaption className='mt-2 text-xs text-ink-2'>{hidden} more lists answered clear and are not shown here.</figcaption>
    </figure>
  );
}

function ReportSkeleton({ target }) {
  return (
    <div role='status' className='space-y-3'>
      <p className='text-sm text-ink-2'>Querying blacklists for <span className='font-mono text-ink'>{target}</span>. This can take up to 30 seconds.</p>
      <SkeletonLine className='h-6 w-72 max-w-full' />
      <div className='rounded-md border border-rule p-3 space-y-3'>
        {[...Array(6)].map((_, i) => <SkeletonLine key={i} className='h-4' style={{ width: `${90 - i * 7}%` }} />)}
      </div>
    </div>
  );
}

const Hero = () => {
  const [hostname, setHostname] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState(null);
  const [checkedTarget, setCheckedTarget] = useState('');
  const resultRef = useRef(null);
  const headingRef = useRef(null);

  const handleCheck = async () => {
    if (!hostname.trim()) return;
    const value = hostname.trim();
    setLoading(true);
    setError('');
    setCheckedTarget(value);
    try {
      const result = await checkBlacklist(value);
      setReport(result);
    } catch (err) {
      setReport(null);
      setError(err.message || 'Failed to check blacklist.');
    } finally {
      setLoading(false);
    }
  };

  // Bring the real report into view once it arrives (it sits below the example).
  useEffect(() => {
    if (!report || !resultRef.current) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    resultRef.current.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    headingRef.current?.focus({ preventScroll: true });
  }, [report]);

  const showResult = loading || (report && !error);

  return (
    <>
      <section aria-labelledby='hero-title' className='max-w-6xl mx-auto px-4 sm:px-6 pt-12 pb-14 sm:pt-16 lg:pt-20 lg:pb-20'>
        <div className='grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-10 items-start'>
          <div className='min-w-0'>
            <h1 id='hero-title' className='text-[2rem] leading-[1.12] sm:text-[2.5rem] lg:text-[2.75rem] lg:leading-[1.08] font-semibold tracking-tight text-ink text-balance'>
              Find the blacklist listing before your users find the bounce.
            </h1>
            <p className='mt-5 text-base sm:text-lg leading-relaxed text-ink-2 max-w-xl'>
              AbuseBox is a self-hosted monitor that checks your IPs and domains against 24 blacklists, plus SSL,
              domain expiry, SPF/DKIM/DMARC and uptime, and tells you what changed.
            </p>

            <div className='mt-8'>
              <LookupForm
                label='Check a domain or IPv4 address now'
                value={hostname}
                onChange={setHostname}
                onSubmit={handleCheck}
                placeholder='example.com or 8.8.8.8'
                loading={loading}
                buttonLabel='Run quick check'
                loadingLabel='Checking'
                error={error}
                hint='No account needed. Up to 10 checks a minute.'
              />
            </div>
          </div>

          <ExampleReport />
        </div>
      </section>

      {showResult ? (
        <section
          ref={resultRef}
          aria-labelledby='live-report-title'
          className='max-w-6xl mx-auto px-4 sm:px-6 pb-16 scroll-mt-20'
        >
          <div className='flex flex-wrap items-center justify-between gap-3 border-t border-rule pt-6 pb-4'>
            <h2
              id='live-report-title'
              ref={headingRef}
              tabIndex={-1}
              className='text-xl font-semibold tracking-tight text-ink break-all focus:outline-none'
            >
              {loading ? 'Checking ' : 'Report for '}<span className='font-mono'>{checkedTarget}</span>
            </h2>
            {!loading && report ? (
              <button type='button' className={secondaryButtonClass} onClick={() => downloadBlacklistCsv(report)}>
                <HiOutlineArrowDownTray className='text-base' aria-hidden='true' /> Export CSV
              </button>
            ) : null}
          </div>
          {loading ? <ReportSkeleton target={checkedTarget} /> : <ResultTableQuick data={report} />}
        </section>
      ) : null}
    </>
  );
};

export default Hero;

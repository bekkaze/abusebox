import { Link } from 'react-router-dom';
import Navbar from '../components/landing/Navbar';
import Hero from '../components/landing/Hero';
import CopyButton from '../components/shared/CopyButton';
import { Field, Fields, StatusTag, linkClass } from '../components/shared/ui';
import { useAuth } from '../services/auth/authProvider';

const GITHUB_URL = 'https://github.com/bekkaze/abusebox';
const INSTALL = [
  'git clone https://github.com/bekkaze/abusebox.git',
  'cd abusebox',
  'docker compose up -d',
];

/** A full-width band: heading on the left, content aligned with the example report column. */
function Band({ id, title, children }) {
  return (
    <section aria-labelledby={id} className='border-t border-rule'>
      <div className='max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16 grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-10'>
        <h2 id={id} className='text-xl sm:text-2xl font-semibold tracking-tight text-ink text-balance'>{title}</h2>
        <div className='min-w-0 space-y-5 text-[15px] leading-relaxed text-ink-2 lg:pl-10'>{children}</div>
      </div>
    </section>
  );
}

const LandingPage = () => {
  const { token } = useAuth();

  return (
    <div className='min-h-screen bg-canvas text-ink'>
      <Navbar />
      <main>
        <Hero />

        <Band id='checks-title' title='What it checks'>
          <Fields className='items-baseline gap-y-2.5 text-[15px]'>
            <Field name='Blacklists'>24 DNS blacklists, each listing decoded with its meaning and a severity.</Field>
            <Field name='AbuseIPDB'>Abuse confidence score, report count, ISP and country for an IP (with a free API key).</Field>
            <Field name='SSL'>Validity, issuer, expiry date and covered names of the certificate.</Field>
            <Field name='WHOIS'>Registrar, name servers and when the domain expires.</Field>
            <Field name='DNS'>A, AAAA, MX, TXT, CNAME, NS, SOA and PTR records.</Field>
            <Field name='SPF/DKIM/DMARC'>Each record checked and the domain graded A to F.</Field>
            <Field name='Server-Status'>DNS resolution, ports 80 and 443, HTTP status and response time.</Field>
          </Fields>
          <p>
            Add your IPs and domains as assets and AbuseBox re-checks them on a schedule, keeps a history of every check,
            and alerts you by email, Slack, Discord or webhook when something is listed, delisted, goes down or
            is about to expire.
          </p>
        </Band>

        <Band id='honest-title' title='Honest results'>
          <p>
            Before AbuseBox trusts a blacklist, it asks about the list&apos;s test addresses: 127.0.0.2 must come back
            listed and 127.0.0.1 must not. A list that refuses, rate-limits or times out shows
            as <StatusTag status='unavailable' />, never as a false <StatusTag status='clear' />, and a list that
            starts listing everything is ignored. If too many lists don&apos;t answer, the whole result is marked
            inconclusive instead of clean.
          </p>
          <Fields className='items-baseline gap-y-2.5 text-[15px]'>
            <Field name='127.0.0.2'>Must be listed. If it isn&apos;t, the list is refusing to answer.</Field>
            <Field name='127.0.0.1'>Must not be listed. If it is, the list is listing everything.</Field>
          </Fields>
        </Band>

        <Band id='install-title' title='Runs on your server'>
          <p>Three commands on any machine with Docker and Compose:</p>
          <div className='relative'>
            <pre className='overflow-x-auto rounded-xl border border-rule/80 bg-paper shadow-e1 py-3 pl-4 pr-12 font-mono text-[13px] leading-6 text-ink'>
              <code>{INSTALL.join('\n')}</code>
            </pre>
            <CopyButton text={INSTALL.join('\n')} label='Copy install commands' className='absolute top-3.5 right-4' />
          </div>
          <p>
            Then open <span className='font-mono text-sm text-ink'>http://localhost:3000</span> and sign in with the
            default account from the{' '}
            <a href={`${GITHUB_URL}#quick-start`} className={linkClass} target='_blank' rel='noreferrer'>README</a>;
            change its password right away.
          </p>
          <p>
            Nothing leaves your server except the lookups themselves: your asset list, check history and API keys
            stay in its database. AbuseBox is open source under the MIT license.
          </p>
        </Band>
      </main>

      <footer className='border-t border-rule bg-paper'>
        <div className='max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-wrap items-center justify-between gap-4 text-sm'>
          <p className='flex items-center gap-2 text-ink-2'>
            <img src='/logo.png' alt='' className='h-5 w-5 rounded object-cover' />
            <span className='font-semibold text-ink'>AbuseBox</span>
            <span>MIT licensed</span>
          </p>
          <nav aria-label='Footer' className='flex items-center gap-5'>
            <a href={GITHUB_URL} className={linkClass} target='_blank' rel='noreferrer'>GitHub</a>
            {token
              ? <Link to='/dashboard' className={linkClass}>Open dashboard</Link>
              : <Link to='/login' className={linkClass}>Sign in</Link>}
          </nav>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;

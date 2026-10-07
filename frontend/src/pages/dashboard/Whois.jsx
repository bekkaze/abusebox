import { useState } from 'react';
import { HiGlobe } from 'react-icons/hi';
import { checkWhois } from '../../services/tools';
import { EmptyState, LookupForm, cardClass } from '../../components/shared/ui';
import WhoisTable from '../../components/shared/WhoisTable';

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
    <section className="space-y-5">
      <div className={`${cardClass} p-5`}>
        <p className="text-sm text-slate-500 dark:text-slate-400">Domain intelligence</p>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">WHOIS lookup</h1>
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
      </div>

      <div className={`${cardClass} p-5`}>
        {!data ? (
          <EmptyState icon={HiGlobe} title="No lookup yet">
            Enter a domain to see its registrar, key dates, name servers and abuse contact.
          </EmptyState>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">WHOIS for {data.domain}</h2>
              <button
                type="button"
                className="text-sm font-medium text-cyan-700 dark:text-cyan-400 hover:underline"
                onClick={() => setShowRaw(!showRaw)}
                aria-pressed={showRaw}
              >
                {showRaw ? 'Show parsed' : 'Show raw'}
              </button>
            </div>

            {showRaw ? (
              <pre className="bg-slate-950 text-slate-200 rounded-xl p-4 text-xs overflow-auto max-h-[70vh] whitespace-pre-wrap">{data.raw}</pre>
            ) : (
              <WhoisTable data={data} />
            )}
          </div>
        )}
      </div>
    </section>
  );
}

import { useState } from 'react';
import { HiCheckCircle, HiStatusOnline, HiXCircle } from 'react-icons/hi';
import { checkServerStatus } from '../../services/tools';
import { Alert, EmptyState, InfoTile, LookupForm, cardClass } from '../../components/shared/ui';

export default function ServerStatus() {
  const [hostname, setHostname] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const handleCheck = async () => {
    setLoading(true);
    setError('');
    try {
      setData(await checkServerStatus(hostname.trim()));
    } catch (err) {
      setData(null);
      setError(err.message || 'Server check failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const yesNo = (value) => (value ? 'Yes' : 'No');
  const openClosed = (value) => (value ? 'Open' : 'Closed');
  const goodBad = (value) => (value ? 'good' : 'bad');

  return (
    <section className="space-y-5">
      <div className={`${cardClass} p-5`}>
        <p className="text-sm text-slate-500 dark:text-slate-400">Uptime check</p>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Is server up?</h1>
        <LookupForm
          label="Hostname or URL"
          value={hostname}
          onChange={setHostname}
          onSubmit={handleCheck}
          placeholder="example.com or https://example.com/health"
          loading={loading}
          buttonLabel="Check"
          loadingLabel="Checking"
          error={error}
          hint="Checks DNS, ports 80/443 and an HTTP request. Private and internal addresses are not allowed."
        />
      </div>

      <div className={`${cardClass} p-5`}>
        {!data ? (
          <EmptyState icon={HiStatusOnline} title="No check yet">
            Enter a hostname or URL to see whether it resolves, which ports are open and how fast it responds.
          </EmptyState>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <div className={`h-14 w-14 rounded-xl flex items-center justify-center text-3xl ${data.is_up ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400' : 'bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400'}`}>
                {data.is_up ? <HiCheckCircle aria-hidden="true" /> : <HiXCircle aria-hidden="true" />}
              </div>
              <div className="min-w-0">
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white break-all">{data.hostname}</h2>
                <p className={`text-sm font-medium ${data.is_up ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                  {data.is_up ? 'Server is up' : 'Server is down'}
                </p>
              </div>
            </div>

            {!data.is_up && data.reason && (
              <Alert tone="error"><span className="font-semibold">Reason:</span> {data.reason}</Alert>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <InfoTile label="Resolved IP" value={data.resolved_ip} />
              <InfoTile label="DNS resolves" value={yesNo(data.dns_resolves)} tone={goodBad(data.dns_resolves)} />
              {'port_443_open' in data && <InfoTile label="Port 443 (HTTPS)" value={openClosed(data.port_443_open)} tone={goodBad(data.port_443_open)} />}
              {'port_80_open' in data && <InfoTile label="Port 80 (HTTP)" value={openClosed(data.port_80_open)} tone={goodBad(data.port_80_open)} />}
              {data.status_code !== undefined && (
                <InfoTile label="HTTP status" value={data.status_code} tone={goodBad(data.status_code >= 200 && data.status_code < 400)} />
              )}
              {data.response_time_ms !== undefined && <InfoTile label="Response time" value={`${data.response_time_ms} ms`} />}
              {data.server_header && <InfoTile label="Server" value={data.server_header} />}
              {data.final_url && data.final_url !== data.url && <InfoTile label="Redirected to" value={data.final_url} />}
              {data.ssl_error && <InfoTile label="TLS" value="Certificate error (answered over HTTP)" tone="bad" />}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

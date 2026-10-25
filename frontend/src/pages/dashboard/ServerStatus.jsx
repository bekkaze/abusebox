import { useState } from 'react';
import { HiOutlineSignal } from 'react-icons/hi2';
import { checkServerStatus } from '../../services/tools';
import { SkeletonLine } from '../../components/shared/Skeleton';
import { EmptyState, Field, Fields, LookupForm, PageHeader, Section } from '../../components/shared/ui';

/** A field value with its reply class, so pass/fail never depends on colour alone. */
function Check({ ok, children }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className={`font-mono text-xs font-semibold ${ok ? 'text-s2' : 'text-s5'}`} aria-hidden="true">{ok ? '2.x' : '5.x'}</span>
      {children}
    </span>
  );
}

function Verdict({ data }) {
  return (
    <div role="status" className="space-y-1">
      <p className="flex flex-wrap items-baseline gap-x-2.5">
        <span className={`font-mono text-lg font-semibold ${data.is_up ? 'text-s2' : 'text-s5'}`} aria-hidden="true">{data.is_up ? '2.x' : '5.x'}</span>
        <span className="text-lg font-semibold text-ink">{data.is_up ? 'Server is up' : 'Server is down'}</span>
      </p>
      {!data.is_up && data.reason && (
        <p className="text-sm text-ink-2"><span className="font-semibold text-ink">Reason:</span> {data.reason}</p>
      )}
      {data.is_up && data.ssl_error && (
        <p className="text-sm text-ink-2">
          <span className="font-mono text-xs font-semibold text-s4">4.x</span> It only answered over plain HTTP: the TLS certificate failed.
        </p>
      )}
    </div>
  );
}

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

  const openClosed = (value) => (value ? 'Open' : 'Closed');
  const httpOk = (code) => code >= 200 && code < 400;

  return (
    <div>
      <PageHeader
        title="Server status"
        description="Checks whether a host resolves, has ports 80 and 443 open and answers an HTTP request."
      />

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
        hint="Private and internal addresses are not allowed."
      />

      <div className="mt-8">
        {data ? (
          <Section
            id="server-status-report"
            title={<>Report for <span className="font-mono font-semibold break-all">{data.hostname}</span></>}
          >
            <div className="space-y-5">
              <Verdict data={data} />
              <Fields className="border-t border-rule pt-4">
                <Field name="DNS">
                  <Check ok={data.dns_resolves}>{data.dns_resolves ? 'Resolves' : 'Does not resolve'}</Check>
                </Field>
                <Field name="Resolved-IP">
                  {data.resolved_ip ? <span className="font-mono text-[13px]">{data.resolved_ip}</span> : null}
                </Field>
                {'port_443_open' in data && (
                  <Field name="Port-443"><Check ok={data.port_443_open}>{openClosed(data.port_443_open)} (HTTPS)</Check></Field>
                )}
                {'port_80_open' in data && (
                  <Field name="Port-80"><Check ok={data.port_80_open}>{openClosed(data.port_80_open)} (HTTP)</Check></Field>
                )}
                {data.status_code !== undefined && (
                  <Field name="HTTP-Status">
                    <Check ok={httpOk(data.status_code)}><span className="font-mono text-[13px]">{data.status_code}</span></Check>
                  </Field>
                )}
                {data.response_time_ms !== undefined && (
                  <Field name="Response-Time"><span className="tabular-nums">{data.response_time_ms} ms</span></Field>
                )}
                {data.server_header && (
                  <Field name="Server"><span className="font-mono text-[13px] break-all">{data.server_header}</span></Field>
                )}
                {data.final_url && data.final_url !== data.url && (
                  <Field name="Redirected-To"><span className="font-mono text-[13px] break-all">{data.final_url}</span></Field>
                )}
                {data.ssl_error && (
                  <Field name="TLS"><Check ok={false}>Certificate error (answered over HTTP)</Check></Field>
                )}
              </Fields>
            </div>
          </Section>
        ) : loading ? (
          <div className="space-y-3" aria-busy="true" aria-label="Checking server">
            <SkeletonLine className="h-6 w-56" />
            <div className="pt-3 space-y-2">{[...Array(5)].map((_, i) => <SkeletonLine key={i} className="h-4 w-80 max-w-full" />)}</div>
          </div>
        ) : (
          <EmptyState icon={HiOutlineSignal} title="No check yet">
            Enter a hostname or URL to see whether it resolves, which ports are open and how fast it responds.
          </EmptyState>
        )}
      </div>
    </div>
  );
}

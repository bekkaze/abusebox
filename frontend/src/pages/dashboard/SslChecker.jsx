import { useState } from 'react';
import { HiOutlineLockClosed } from 'react-icons/hi2';
import { checkSsl } from '../../services/tools';
import { SkeletonLine } from '../../components/shared/Skeleton';
import { Alert, EmptyState, Field, Fields, LookupForm, PageHeader, Section } from '../../components/shared/ui';

const EXPIRY_WARNING_DAYS = 30;
const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

// "2026-12-30T23:59:59+00:00" -> "2026-12-30 23:59 UTC"
const formatStamp = (iso) => (iso ? `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC` : null);

function verdictFor(data) {
  const days = data.days_remaining;
  if (!data.valid) {
    if (data.error) return { code: '5.x', tone: 'text-s5', text: 'Certificate invalid' };
    if (typeof days === 'number' && days < 0) return { code: '5.x', tone: 'text-s5', text: `Certificate expired ${plural(-days, 'day')} ago` };
    return { code: '5.x', tone: 'text-s5', text: 'Certificate expired' };
  }
  if (days < EXPIRY_WARNING_DAYS) return { code: '4.x', tone: 'text-s4', text: `Certificate valid, but expires in ${plural(days, 'day')}` };
  return { code: '2.x', tone: 'text-s2', text: `Certificate valid, expires in ${plural(days, 'day')}` };
}

function SslVerdict({ data }) {
  const verdict = verdictFor(data);
  return (
    <div role="status" className="space-y-1">
      <p className="flex flex-wrap items-baseline gap-x-2.5">
        <span className={`font-mono text-lg font-semibold ${verdict.tone}`} aria-hidden="true">{verdict.code}</span>
        <span className="text-lg font-semibold text-ink">{verdict.text}</span>
      </p>
      {data.error && <p className="text-sm text-ink-2 break-words">{data.error}</p>}
      {data.valid && data.days_remaining < EXPIRY_WARNING_DAYS && (
        <p className="text-sm text-ink-2">Renew it before it expires, or browsers and mail servers will refuse the connection.</p>
      )}
    </div>
  );
}

/** Common name with the organization after it, when there is one. */
function nameWithOrg(name) {
  if (!name?.common_name && !name?.organization) return null;
  return (
    <>
      {name.common_name && <span className="font-mono text-[13px] break-all">{name.common_name}</span>}
      {name.common_name && name.organization && <span className="text-ink-2"> · </span>}
      {name.organization}
    </>
  );
}

function CertificateFields({ data }) {
  const cipher = data.cipher || {};
  return (
    <Fields className="tabular-nums">
      <Field name="Hostname"><span className="font-mono text-[13px] break-all">{data.hostname}</span></Field>
      <Field name="Subject">{nameWithOrg(data.subject)}</Field>
      <Field name="Issuer">{nameWithOrg(data.issuer)}</Field>
      <Field name="Valid-From">{formatStamp(data.not_before)}</Field>
      <Field name="Expires">{formatStamp(data.not_after)}</Field>
      <Field name="Serial-Number">
        {data.serial_number ? <span className="font-mono text-[13px] break-all">{data.serial_number}</span> : null}
      </Field>
      <Field name="Protocol">{cipher.protocol ? <span className="font-mono text-[13px]">{cipher.protocol}</span> : null}</Field>
      <Field name="Cipher">
        {cipher.name ? (
          <>
            <span className="font-mono text-[13px] break-all">{cipher.name}</span>
            {cipher.bits ? <span className="text-ink-2"> ({cipher.bits}-bit)</span> : null}
          </>
        ) : null}
      </Field>
      {data.san?.length > 0 && (
        <Field name={`SAN (${data.san.length})`}>
          <ul className="flex flex-wrap gap-x-3 gap-y-0.5">
            {data.san.map((name, i) => (
              <li key={`${i}-${name}`} className="font-mono text-[13px] break-all">{name}</li>
            ))}
          </ul>
        </Field>
      )}
    </Fields>
  );
}

export default function SslChecker() {
  const [hostname, setHostname] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCheck = async () => {
    if (!hostname.trim()) return;
    setLoading(true);
    setError('');
    setData(null);
    try {
      const result = await checkSsl(hostname.trim());
      setData(result);
    } catch (err) {
      setError(err.message || 'SSL check failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const connectionError = data?.error && !('valid' in data);
  const hasCertificate = data && !connectionError && Boolean(data.not_after);

  return (
    <div>
      <PageHeader
        title="SSL certificate"
        description="Connects on port 443 and reports whether the certificate is valid, when it expires, who issued it and the cipher in use."
      />

      <LookupForm
        label="Hostname"
        value={hostname}
        onChange={setHostname}
        onSubmit={handleCheck}
        placeholder="mail.example.com"
        loading={loading}
        buttonLabel="Check SSL"
        loadingLabel="Checking"
        error={error}
      />

      <div className="mt-8">
        {data ? (
          <Section
            id="ssl-report"
            title={<>Certificate for <span className="font-mono font-semibold break-all">{data.hostname || hostname.trim()}</span></>}
          >
            {connectionError ? (
              <Alert tone="error">{data.error}</Alert>
            ) : (
              <div className="space-y-5">
                <SslVerdict data={data} />
                {hasCertificate && <CertificateFields data={data} />}
              </div>
            )}
          </Section>
        ) : loading ? (
          <div className="space-y-3" aria-busy="true" aria-label="Checking SSL certificate">
            <SkeletonLine className="h-6 w-80 max-w-full" />
            <div className="pt-3 space-y-2">{[...Array(8)].map((_, i) => <SkeletonLine key={i} className="h-4 max-w-xl" />)}</div>
          </div>
        ) : (
          <EmptyState icon={HiOutlineLockClosed} title="No check yet">
            Enter a hostname above to see its certificate status, expiry date, issuer and cipher.
          </EmptyState>
        )}
      </div>
    </div>
  );
}

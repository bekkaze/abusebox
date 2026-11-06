import CopyButton from './CopyButton';
import { Field, Fields } from './ui';

/** "90 minutes" / "2 hours" / "3 days", for how old a stale record is. */
function formatAge(minutes) {
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? '' : 's'}`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'}`;
}

// [response key, header-style field name, copy label, value is data (mono)]
const WHOIS_FIELDS = [
  ['domain_name', 'Domain-Name', 'domain name', true],
  ['registrar', 'Registrar', 'registrar'],
  ['registrar_url', 'Registrar-URL', 'registrar URL', true],
  ['creation_date', 'Created', 'creation date'],
  ['updated_date', 'Updated', 'updated date'],
  ['expiry_date', 'Expires', 'expiry date'],
  ['name_servers', 'Name-Servers', 'name servers', true],
  ['status', 'Status', 'status', true],
  ['registrant_org', 'Registrant-Org', 'registrant org'],
  ['registrant_country', 'Registrant-Country', 'registrant country'],
  ['registrant_state', 'Registrant-State', 'registrant state'],
  ['abuse_email', 'Abuse-Email', 'abuse email', true],
  ['tech_email', 'Tech-Email', 'tech email', true],
  ['dnssec', 'DNSSEC', 'DNSSEC'],
  ['whois_server', 'WHOIS-Server', 'WHOIS server', true],
];

/** Parsed WHOIS fields as message-header rows, each value copyable. */
export default function WhoisTable({ data }) {
  const rows = WHOIS_FIELDS
    .map(([key, name, copyLabel, mono]) => {
      const raw = data[key];
      const values = (Array.isArray(raw) ? raw : [raw]).filter(Boolean);
      return { name, copyLabel, mono, values };
    })
    .filter((row) => row.values.length);
  // A registry only answers for the registered domain, so a host is looked up
  // as the domain it belongs to. Say so, or the result looks like the wrong
  // thing was asked for.
  const hostNote = data.requested_host && data.domain ? (
    <p className="text-sm text-ink-2">
      <span className="font-mono">{data.requested_host}</span> is a host, not a registered domain.
      Showing the record for <span className="font-mono">{data.domain}</span>.
    </p>
  ) : null;
  // The registry refused this time, so these are the last good values. Without
  // this they would read as current.
  const staleNote = data.stale ? (
    <p className="text-sm text-amber-700 dark:text-amber-400">
      The registry did not answer, so this is the last record AbuseBox received
      {typeof data.stale_age_minutes === 'number' ? `, ${formatAge(data.stale_age_minutes)} old` : ''}.
      {data.stale_reason ? ` (${data.stale_reason})` : ''}
    </p>
  ) : null;
  const note = (hostNote || staleNote) ? <div className="space-y-1">{staleNote}{hostNote}</div> : null;
  if (rows.length === 0) {
    return (
      <div className="space-y-2">
        {note}
        <p className="text-sm text-ink-2">The WHOIS server returned no fields AbuseBox could parse. Check the raw response.</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
    {note}
    <Fields className="gap-y-2">
      {rows.map(({ name, copyLabel, mono, values }) => (
        <Field key={name} name={name}>
          <span className="inline-flex items-start gap-2 max-w-full">
            <span className={`min-w-0 break-all ${mono ? 'font-mono text-[13px] leading-5' : ''}`}>
              {values.length > 1
                ? values.map((value, i) => <span key={`${i}-${value}`} className="block">{value}</span>)
                : values[0]}
            </span>
            <CopyButton text={values.join(', ')} label={`Copy ${copyLabel}`} className="mt-0.5 shrink-0" />
          </span>
        </Field>
      ))}
    </Fields>
    </div>
  );
}

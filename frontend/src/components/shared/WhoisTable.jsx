import CopyButton from './CopyButton';
import { Field, Fields } from './ui';

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
  if (rows.length === 0) {
    return <p className="text-sm text-ink-2">The WHOIS server returned no fields AbuseBox could parse. Check the raw response.</p>;
  }
  return (
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
  );
}

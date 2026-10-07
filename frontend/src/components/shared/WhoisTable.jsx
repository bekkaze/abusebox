import CopyButton from './CopyButton';

const WHOIS_FIELDS = [
  ['domain_name', 'Domain name'],
  ['registrar', 'Registrar'],
  ['registrar_url', 'Registrar URL'],
  ['creation_date', 'Creation date'],
  ['updated_date', 'Updated date'],
  ['expiry_date', 'Expiry date'],
  ['name_servers', 'Name servers'],
  ['status', 'Status'],
  ['registrant_org', 'Registrant org'],
  ['registrant_country', 'Registrant country'],
  ['registrant_state', 'Registrant state'],
  ['abuse_email', 'Abuse email'],
  ['tech_email', 'Tech email'],
  ['dnssec', 'DNSSEC'],
  ['whois_server', 'WHOIS server'],
];

export default function WhoisTable({ data }) {
  const rows = WHOIS_FIELDS
    .map(([key, label]) => [label, Array.isArray(data[key]) ? data[key].join(', ') : data[key]])
    .filter(([, value]) => value);
  if (rows.length === 0) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">The WHOIS server returned no fields we could parse. Check the raw response.</p>;
  }
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-600">
      <table className="w-full text-sm">
        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
          {rows.map(([label, value]) => (
            <tr key={label} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/40">
              <th scope="row" className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 dark:text-slate-400 w-44 align-top">{label}</th>
              <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-slate-200 break-all">
                <span className="inline-flex items-center gap-2">{value} <CopyButton text={value} label={`Copy ${label.toLowerCase()}`} /></span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

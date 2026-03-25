import React, { useState } from 'react';
import { checkWhois } from '../../services/tools';
import CopyButton from '../../components/shared/CopyButton';

export default function Whois() {
  const [hostname, setHostname] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [showRaw, setShowRaw] = useState(false);

  const handleCheck = async () => {
    if (!hostname.trim()) {
      setError('Enter a domain name.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await checkWhois(hostname.trim());
      setData(result);
      setShowRaw(false);
    } catch (err) {
      setData(null);
      setError(err.message || 'Failed to perform WHOIS lookup.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className='space-y-5'>
      <div className='bg-white border border-slate-200 rounded-xl p-5 shadow-sm'>
        <p className='text-sm text-slate-500'>Domain Intelligence</p>
        <h2 className='text-2xl font-semibold text-slate-900 mt-1'>WHOIS Lookup</h2>
        <div className="mt-4 flex flex-col md:flex-row gap-3">
          <input
            type="text"
            className="h-11 w-full px-4 rounded-xl border border-slate-300 focus:ring-2 focus:ring-cyan-500 focus:outline-none"
            placeholder="example.com"
            value={hostname}
            onChange={(e) => setHostname(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCheck()}
          />
          <button
            className={`h-11 px-6 rounded-xl font-medium ${loading ? 'bg-slate-300 text-slate-500' : 'bg-cyan-600 hover:bg-cyan-700 text-white'} transition-colors`}
            onClick={handleCheck}
            disabled={loading}
          >
            {loading ? 'Looking up...' : 'Lookup'}
          </button>
        </div>
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        {!data ? (
          <p className="text-slate-500 text-sm">Enter a domain to retrieve WHOIS registration data.</p>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold text-slate-900">WHOIS for {data.domain}</h3>
              <button
                className="text-sm font-medium text-cyan-700 hover:text-cyan-800"
                onClick={() => setShowRaw(!showRaw)}
              >
                {showRaw ? 'Show Parsed' : 'Show Raw'}
              </button>
            </div>

            {showRaw ? (
              <pre className="bg-slate-950 text-slate-200 rounded-xl p-4 text-xs overflow-auto max-h-[70vh] whitespace-pre-wrap">
                {data.raw}
              </pre>
            ) : (
              <div className="overflow-hidden rounded-lg border border-slate-200">
                <table className="w-full text-slate-700 border-collapse">
                  <tbody>
                    <WhoisRow label="Domain Name" value={data.domain_name} />
                    <WhoisRow label="Registrar" value={data.registrar} />
                    <WhoisRow label="Registrar URL" value={data.registrar_url} />
                    <WhoisRow label="Creation Date" value={data.creation_date} />
                    <WhoisRow label="Updated Date" value={data.updated_date} />
                    <WhoisRow label="Expiry Date" value={data.expiry_date} />
                    <WhoisRow label="Name Servers" value={Array.isArray(data.name_servers) ? data.name_servers.join(', ') : data.name_servers} />
                    <WhoisRow label="Status" value={Array.isArray(data.status) ? data.status.join(', ') : data.status} />
                    <WhoisRow label="Registrant Org" value={data.registrant_org} />
                    <WhoisRow label="Registrant Country" value={data.registrant_country} />
                    <WhoisRow label="Registrant State" value={data.registrant_state} />
                    <WhoisRow label="Abuse Email" value={data.abuse_email} />
                    <WhoisRow label="DNSSEC" value={data.dnssec} />
                    <WhoisRow label="WHOIS Server" value={data.whois_server} />
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function WhoisRow({ label, value }) {
  if (!value) return null;
  return (
    <tr className="border-b border-slate-200 hover:bg-slate-50/60">
      <td className="px-4 py-2.5 text-xs uppercase tracking-wide text-slate-500 w-48 font-medium">{label}</td>
      <td className="px-4 py-2.5 font-medium text-sm break-all">
        <span className="flex items-center gap-2">{value} <CopyButton text={value} /></span>
      </td>
    </tr>
  );
}

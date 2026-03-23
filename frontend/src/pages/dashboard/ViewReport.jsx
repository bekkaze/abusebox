import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ResultTable from '../../components/blacklist/ResultTable';

const CHECK_LABELS = {
  blacklist: 'Blacklist (DNSBL)',
  abuseipdb: 'AbuseIPDB',
  dns: 'DNS Records',
  ssl: 'SSL Certificate',
  whois: 'WHOIS Lookup',
  email_security: 'SPF / DKIM / DMARC',
  server_status: 'Server Status',
};

export default function ViewReport() {
  const location = useLocation();
  const navigate = useNavigate();
  const hostnameData = location.state?.hostnameData;
  const [activeTab, setActiveTab] = useState('blacklist');

  if (!hostnameData) {
    return (
      <section className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="rounded-xl border border-slate-200 dark:border-slate-600 p-4 text-center py-10">
          <p className="text-slate-500 dark:text-slate-400 mb-4">No report data available. Please select a hostname from the monitor list.</p>
          <button
            className="text-sm font-medium text-cyan-700 dark:text-cyan-400 hover:text-cyan-800"
            onClick={() => navigate('/dashboard/assets')}
          >
            Go to Blacklist Monitor
          </button>
        </div>
      </section>
    );
  }

  const result = hostnameData.result || {};
  // Detect structure: new format has keys like "blacklist", "abuseipdb", etc.
  // Old format has flat structure with "detected_on", "providers", etc.
  const isNewFormat = 'blacklist' in result || 'abuseipdb' in result || 'dns' in result || 'ssl' in result;
  const tabs = isNewFormat
    ? Object.keys(result).filter(k => k !== 'id' && k in CHECK_LABELS)
    : ['blacklist'];

  const getTabData = (tab) => {
    if (isNewFormat) return result[tab] || {};
    return result; // old format — entire result is the blacklist data
  };

  return (
    <section className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">Report</p>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">{hostnameData.hostname}</h1>
        </div>
        <button
          className="text-sm font-medium text-cyan-700 dark:text-cyan-400 hover:text-cyan-800"
          onClick={() => navigate('/dashboard/assets')}
        >
          Back to Monitors
        </button>
      </div>

      {/* Tabs */}
      {tabs.length > 1 && (
        <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors rounded-t-lg ${
                activeTab === tab
                  ? 'bg-white dark:bg-slate-700 text-cyan-700 dark:text-cyan-400 border border-b-0 border-slate-200 dark:border-slate-600'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
              }`}
            >
              {CHECK_LABELS[tab] || tab}
            </button>
          ))}
        </div>
      )}

      {/* Tab Content */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-600 p-4">
        {activeTab === 'blacklist' && (
          <BlacklistPanel data={getTabData('blacklist')} />
        )}
        {activeTab === 'abuseipdb' && (
          <AbuseIPDBPanel data={getTabData('abuseipdb')} />
        )}
        {activeTab === 'dns' && (
          <DnsPanel data={getTabData('dns')} />
        )}
        {activeTab === 'ssl' && (
          <SslPanel data={getTabData('ssl')} />
        )}
        {activeTab === 'whois' && (
          <WhoisPanel data={getTabData('whois')} />
        )}
        {activeTab === 'email_security' && (
          <EmailSecurityPanel data={getTabData('email_security')} />
        )}
        {activeTab === 'server_status' && (
          <ServerStatusPanel data={getTabData('server_status')} />
        )}
      </div>
    </section>
  );
}

function BlacklistPanel({ data }) {
  if (!data || data.error) return <ErrorMsg msg={data?.error} />;
  return <ResultTable data={data} />;
}

function AbuseIPDBPanel({ data }) {
  if (!data || data.error) return <ErrorMsg msg={data?.error} />;
  return (
    <div className="space-y-3">
      <Row label="Abuse Confidence Score" value={`${data.abuse_confidence_score}%`} />
      <Row label="ISP" value={data.isp} />
      <Row label="Country" value={data.country_code} />
      <Row label="Usage Type" value={data.usage_type} />
      <Row label="Domain" value={data.domain} />
      <Row label="Total Reports" value={data.total_reports} />
      <Row label="Last Reported" value={data.last_reported_at || 'Never'} />
    </div>
  );
}

function DnsPanel({ data }) {
  if (!data || data.error) return <ErrorMsg msg={data?.error} />;
  const records = data.records || {};
  if (Object.keys(records).length === 0) return <p className="text-sm text-slate-500">No records found.</p>;
  return (
    <div className="space-y-3">
      {Object.entries(records).map(([type, values]) => (
        <div key={type}>
          <p className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">{type}</p>
          {values.map((v, i) => (
            <p key={i} className="text-sm font-mono text-slate-700 dark:text-slate-300 pl-3 break-all">{v}</p>
          ))}
        </div>
      ))}
    </div>
  );
}

function SslPanel({ data }) {
  if (!data || (data.error && !('valid' in data))) return <ErrorMsg msg={data?.error} />;
  return (
    <div className="space-y-3">
      <Row label="Valid" value={data.valid ? 'Yes' : 'No'} />
      <Row label="Days Remaining" value={data.days_remaining} />
      <Row label="Not Before" value={data.not_before} />
      <Row label="Not After" value={data.not_after} />
      <Row label="Issuer" value={data.issuer?.common_name} />
      <Row label="Subject" value={data.subject?.common_name} />
      <Row label="Cipher" value={data.cipher?.name} />
      <Row label="Protocol" value={data.cipher?.protocol} />
      {data.error && <p className="text-sm text-amber-600 dark:text-amber-400">{data.error}</p>}
    </div>
  );
}

function WhoisPanel({ data }) {
  if (!data || data.error) return <ErrorMsg msg={data?.error} />;
  return (
    <div className="space-y-3">
      {data.parsed && Object.entries(data.parsed).map(([key, value]) => (
        <Row key={key} label={key} value={Array.isArray(value) ? value.join(', ') : String(value ?? '—')} />
      ))}
      {data.raw && (
        <details className="mt-3">
          <summary className="text-sm font-medium text-cyan-700 dark:text-cyan-400 cursor-pointer">Show raw WHOIS</summary>
          <pre className="bg-slate-950 text-slate-200 rounded-lg p-3 text-xs overflow-auto max-h-[50vh] whitespace-pre-wrap mt-2">{data.raw}</pre>
        </details>
      )}
    </div>
  );
}

function EmailSecurityPanel({ data }) {
  if (!data || data.error) return <ErrorMsg msg={data?.error} />;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-3xl font-black text-slate-800 dark:text-white">{data.grade}</span>
        <span className="text-sm text-slate-500 dark:text-slate-400">Score: {data.score} / {data.max_score}</span>
      </div>
      <RecordSection title="SPF" data={data.spf} />
      <RecordSection title="DKIM" data={data.dkim} />
      <RecordSection title="DMARC" data={data.dmarc} />
    </div>
  );
}

function RecordSection({ title, data }) {
  if (!data) return null;
  return (
    <div className={`rounded-lg border p-3 ${data.found ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/20' : 'border-rose-200 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-900/20'}`}>
      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{title}: {data.found ? 'Found' : 'Missing'}</p>
      {data.record && <pre className="text-xs font-mono text-slate-600 dark:text-slate-400 mt-1 break-all whitespace-pre-wrap">{data.record}</pre>}
      {data.policy && <p className="text-xs text-slate-500 mt-1">Policy: {data.policy}</p>}
    </div>
  );
}

function ServerStatusPanel({ data }) {
  if (!data || data.error) return <ErrorMsg msg={data?.error} />;
  return (
    <div className="space-y-3">
      <Row label="IP Address" value={data.ip} />
      <Row label="DNS Resolved" value={data.dns_resolved ? 'Yes' : 'No'} />
      <Row label="HTTP Status" value={data.http_status} />
      <Row label="Response Time" value={data.response_time_ms ? `${data.response_time_ms}ms` : '—'} />
      {data.ports && Object.entries(data.ports).map(([port, open]) => (
        <Row key={port} label={`Port ${port}`} value={open ? 'Open' : 'Closed'} />
      ))}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between text-sm border-b border-slate-100 dark:border-slate-700 pb-2">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className="font-medium text-slate-800 dark:text-slate-200 text-right break-all max-w-[60%]">{value ?? '—'}</span>
    </div>
  );
}

function ErrorMsg({ msg }) {
  return <p className="text-sm text-rose-600 dark:text-rose-400">{msg || 'No data available for this check.'}</p>;
}

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { HiArrowLeft, HiRefresh, HiShieldCheck, HiShieldExclamation, HiClock, HiStatusOnline } from 'react-icons/hi';
import axios from 'axios';
import HistoryChart from '../../components/dashboard/home/HistoryChart';
import ResultTable from '../../components/blacklist/ResultTable';
import { DetailSkeleton } from '../../components/shared/Skeleton';
import CopyButton from '../../components/shared/CopyButton';
import TimeAgo from '../../components/shared/TimeAgo';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const CHECK_LABELS = {
  blacklist: { label: 'Blacklist', icon: HiShieldExclamation },
  abuseipdb: { label: 'AbuseIPDB', icon: HiShieldCheck },
  dns: { label: 'DNS Records', icon: HiStatusOnline },
  ssl: { label: 'SSL Certificate', icon: HiShieldCheck },
  whois: { label: 'WHOIS', icon: HiClock },
  email_security: { label: 'SPF/DKIM/DMARC', icon: HiShieldCheck },
  server_status: { label: 'Server Status', icon: HiStatusOnline },
};

export default function AssetDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [asset, setAsset] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rechecking, setRechecking] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState(null);

  const fetchAsset = async () => {
    setLoading(true);
    setError('');
    try {
      const [assetRes, listRes] = await Promise.all([
        axios.get(`/api/hostname/${id}`, { headers: { Accept: 'application/json' } }),
        axios.get('/api/hostname/list/', { headers: { Accept: 'application/json' } }),
      ]);
      setAsset(assetRes.data);

      const listItem = (listRes.data || []).find((h) => h.id === Number(id));
      if (listItem?.result) {
        setResult(listItem.result);
        const tabs = getAvailableTabs(listItem.result);
        if (tabs.length > 0 && !activeTab) setActiveTab(tabs[0]);
      }
    } catch (err) {
      setError('Failed to load asset details.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRecheck = async () => {
    setRechecking(true);
    try {
      await axios.post(`/api/hostname/${id}/recheck/`, {}, { headers: { Accept: 'application/json' } });
      toast.success('Re-check started');
      // Refresh after a brief delay to allow backend to process
      setTimeout(() => {
        fetchAsset().finally(() => setRechecking(false));
      }, 2000);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to re-check');
      setRechecking(false);
    }
  };

  useEffect(() => {
    fetchAsset();
  }, [id]);

  const getAvailableTabs = (data) => {
    if (!data) return [];
    const newFormatTabs = Object.keys(data).filter((k) => k !== 'id' && k in CHECK_LABELS);
    if (newFormatTabs.length > 0) return newFormatTabs;
    if (data.providers || data.detected_on) return ['blacklist'];
    return [];
  };

  const getTabData = (tab) => {
    if (!result) return null;
    const tabs = getAvailableTabs(result);
    if (tabs.length > 0 && tabs[0] !== 'blacklist') return result[tab] || null;
    if (tab === 'blacklist' && (result.providers || result.detected_on)) return result;
    return result[tab] || null;
  };

  const tabs = result ? getAvailableTabs(result) : [];

  if (loading) return <DetailSkeleton />;

  if (error || !asset) {
    return (
      <section className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm text-center py-16">
        <p className="text-slate-500 dark:text-slate-400 mb-4">{error || 'Asset not found.'}</p>
        <button onClick={() => navigate('/dashboard/assets')} className="text-sm font-medium text-cyan-700 dark:text-cyan-400">
          Back to Assets
        </button>
      </section>
    );
  }

  const enabledChecks = [
    asset.check_blacklist && 'BL',
    asset.check_abuseipdb && 'ABUSE',
    asset.check_dns && 'DNS',
    asset.check_ssl && 'SSL',
    asset.check_whois && 'WHOIS',
    asset.check_email_security && 'DMARC',
    asset.check_server_status && 'UP',
  ].filter(Boolean);

  return (
    <section className="space-y-5">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard/assets')}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-500 dark:text-slate-400"
            >
              <HiArrowLeft className="text-xl" />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{asset.hostname}</h1>
                <CopyButton text={asset.hostname} />
                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${asset.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-rose-100 text-rose-700'}`}>
                  {asset.status}
                </span>
                <span className="inline-flex rounded-full bg-slate-100 dark:bg-slate-700 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                  {asset.hostname_type}
                </span>
              </div>
              {asset.description && (
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{asset.description}</p>
              )}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {enabledChecks.map((label) => (
                  <span key={label} className="inline-flex rounded bg-cyan-50 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 px-2 py-0.5 text-[10px] font-bold border border-cyan-200 dark:border-cyan-800">
                    {label}
                  </span>
                ))}
                {asset.is_monitor_enabled && (
                  <span className="inline-flex rounded bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 px-2 py-0.5 text-[10px] font-bold border border-violet-200 dark:border-violet-800">
                    MONITORING
                  </span>
                )}
                {asset.is_alert_enabled && (
                  <span className="inline-flex rounded bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2 py-0.5 text-[10px] font-bold border border-amber-200 dark:border-amber-800">
                    ALERTS
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRecheck}
              disabled={rechecking}
              className="inline-flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white py-2 px-4 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
            >
              <HiRefresh className={rechecking ? 'animate-spin' : ''} />
              {rechecking ? 'Checking...' : 'Re-check Now'}
            </button>
            <div className="text-right">
              <p className="text-[10px] text-slate-400 dark:text-slate-500">Created</p>
              <TimeAgo date={asset.created} className="text-xs text-slate-500 dark:text-slate-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <SummaryCard
          label="Blacklisted"
          value={asset.is_blacklisted ? 'Yes' : 'No'}
          tone={asset.is_blacklisted ? 'rose' : 'emerald'}
        />
        <SummaryCard
          label="Checks Enabled"
          value={enabledChecks.length}
          tone="sky"
        />
        <SummaryCard
          label="Monitoring"
          value={asset.is_monitor_enabled ? 'Active' : 'Off'}
          tone={asset.is_monitor_enabled ? 'violet' : 'slate'}
        />
        <SummaryCard
          label="Alerts"
          value={asset.is_alert_enabled ? 'Active' : 'Off'}
          tone={asset.is_alert_enabled ? 'amber' : 'slate'}
        />
      </div>

      {/* Check History Chart */}
      <HistoryChart hostnameId={asset.id} hostname={asset.hostname} />

      {/* Tabbed Results */}
      {tabs.length > 0 ? (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
          <div className="flex border-b border-slate-200 dark:border-slate-700 overflow-x-auto">
            {tabs.map((tab) => {
              const info = CHECK_LABELS[tab] || { label: tab };
              const Icon = info.icon || HiShieldCheck;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                    activeTab === tab
                      ? 'border-cyan-600 text-cyan-700 dark:text-cyan-400 bg-slate-50 dark:bg-slate-700/50'
                      : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/30'
                  }`}
                >
                  <Icon className="text-base" />
                  {info.label}
                </button>
              );
            })}
          </div>

          <div className="p-5">
            {activeTab === 'blacklist' && <BlacklistPanel data={getTabData('blacklist')} />}
            {activeTab === 'abuseipdb' && <AbuseIPDBPanel data={getTabData('abuseipdb')} />}
            {activeTab === 'dns' && <DnsPanel data={getTabData('dns')} />}
            {activeTab === 'ssl' && <SslPanel data={getTabData('ssl')} />}
            {activeTab === 'whois' && <WhoisPanel data={getTabData('whois')} />}
            {activeTab === 'email_security' && <EmailSecurityPanel data={getTabData('email_security')} />}
            {activeTab === 'server_status' && <ServerStatusPanel data={getTabData('server_status')} />}
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-8 text-center shadow-sm">
          <p className="text-slate-500 dark:text-slate-400">No check results available yet. Click "Re-check Now" to run checks.</p>
        </div>
      )}

      <ToastContainer position="top-center" autoClose={3000} />
    </section>
  );
}

/* ---------- Summary Card ---------- */
function SummaryCard({ label, value, tone }) {
  const tones = {
    rose: 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300',
    emerald: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300',
    sky: 'bg-sky-50 dark:bg-sky-900/20 border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-300',
    violet: 'bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300',
    amber: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300',
    slate: 'bg-slate-50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400',
  };
  return (
    <div className={`rounded-xl border p-4 ${tones[tone] || tones.slate}`}>
      <p className="text-[11px] uppercase tracking-wide font-medium opacity-70">{label}</p>
      <p className="text-xl font-bold mt-1">{value}</p>
    </div>
  );
}

/* ---------- Tab Panels ---------- */
function BlacklistPanel({ data }) {
  if (!data || data.error) return <ErrorMsg msg={data?.error} />;
  return <ResultTable data={data} />;
}

function AbuseIPDBPanel({ data }) {
  if (!data || data.error) return <ErrorMsg msg={data?.error} />;
  const score = data.abuse_confidence_score;
  const scoreColor = score === 0 ? 'text-emerald-600' : score <= 25 ? 'text-yellow-600' : score <= 75 ? 'text-orange-600' : 'text-rose-600';
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <span className={`text-4xl font-black ${scoreColor}`}>{score}%</span>
        <span className="text-sm text-slate-500 dark:text-slate-400">Abuse Confidence Score</span>
      </div>
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
        <InfoCard label="ISP" value={data.isp} />
        <InfoCard label="Country" value={data.country_code} />
        <InfoCard label="Usage Type" value={data.usage_type} />
        <InfoCard label="Domain" value={data.domain} />
        <InfoCard label="Total Reports" value={data.total_reports} />
        <InfoCard label="Last Reported" value={data.last_reported_at || 'Never'} />
      </div>
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
        <div key={type} className="rounded-lg border border-slate-200 dark:border-slate-600 overflow-hidden">
          <div className="bg-slate-50 dark:bg-slate-700 px-4 py-2">
            <span className="text-xs font-bold uppercase text-slate-600 dark:text-slate-300">{type}</span>
            <span className="text-xs text-slate-400 ml-2">{values.length} record{values.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-600">
            {values.map((v, i) => (
              <div key={i} className="px-4 py-2 text-sm font-mono text-slate-700 dark:text-slate-300 break-all flex items-center justify-between">
                <span>{v}</span>
                <CopyButton text={v} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function SslPanel({ data }) {
  if (!data || (data.error && !('valid' in data))) return <ErrorMsg msg={data?.error} />;
  const valid = data.valid;
  const days = data.days_remaining;
  return (
    <div className="space-y-4">
      <div className={`rounded-xl border p-4 ${valid ? (days < 30 ? 'border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800' : 'border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-800') : 'border-rose-200 bg-rose-50 dark:bg-rose-900/20 dark:border-rose-800'}`}>
        <p className={`text-2xl font-bold ${valid ? (days < 30 ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300') : 'text-rose-700 dark:text-rose-300'}`}>
          {valid ? `Valid — ${days} days remaining` : 'Expired / Invalid'}
        </p>
      </div>
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
        <InfoCard label="Issuer" value={data.issuer?.common_name} />
        <InfoCard label="Subject" value={data.subject?.common_name} />
        <InfoCard label="Not Before" value={data.not_before} />
        <InfoCard label="Not After" value={data.not_after} />
        <InfoCard label="Cipher" value={data.cipher?.name} />
        <InfoCard label="Protocol" value={data.cipher?.protocol} />
      </div>
      {data.san?.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 mb-2">Subject Alternative Names</p>
          <div className="flex flex-wrap gap-1.5">
            {data.san.map((name, i) => (
              <span key={i} className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full px-2.5 py-0.5 text-xs font-mono">{name}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function WhoisPanel({ data }) {
  if (!data || data.error) return <ErrorMsg msg={data?.error} />;
  return (
    <div className="space-y-4">
      {data.parsed && (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
          {Object.entries(data.parsed).map(([key, value]) => (
            <InfoCard key={key} label={key} value={Array.isArray(value) ? value.join(', ') : String(value ?? '—')} copyable />
          ))}
        </div>
      )}
      {data.raw && (
        <details>
          <summary className="text-sm font-medium text-cyan-700 dark:text-cyan-400 cursor-pointer hover:underline">Show raw WHOIS</summary>
          <pre className="bg-slate-950 text-slate-200 rounded-xl p-4 text-xs overflow-auto max-h-[50vh] whitespace-pre-wrap mt-2">{data.raw}</pre>
        </details>
      )}
    </div>
  );
}

function EmailSecurityPanel({ data }) {
  if (!data || data.error) return <ErrorMsg msg={data?.error} />;
  const gradeColors = { A: 'text-emerald-600', B: 'text-sky-600', D: 'text-amber-600', F: 'text-rose-600' };
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <span className={`text-5xl font-black ${gradeColors[data.grade] || 'text-slate-600'}`}>{data.grade}</span>
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">Email Security Grade</p>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{data.score} / {data.max_score} checks passed</p>
        </div>
      </div>
      <div className="space-y-3">
        <RecordBlock title="SPF" data={data.spf} />
        <RecordBlock title="DKIM" data={data.dkim} />
        <RecordBlock title="DMARC" data={data.dmarc} />
      </div>
    </div>
  );
}

function RecordBlock({ title, data }) {
  if (!data) return null;
  return (
    <div className={`rounded-lg border p-4 ${data.found ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/20' : 'border-rose-200 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-900/20'}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${data.found ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
          {data.found ? 'FOUND' : 'MISSING'}
        </span>
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{title}</span>
        {data.policy && <span className="text-xs text-slate-500 ml-2">Policy: {data.policy}</span>}
      </div>
      {data.record && (
        <div className="flex items-start gap-2 mt-2">
          <pre className="text-xs font-mono text-slate-600 dark:text-slate-400 break-all whitespace-pre-wrap bg-slate-100 dark:bg-slate-700 rounded-lg p-2 flex-1">{data.record}</pre>
          <CopyButton text={data.record} className="mt-1" />
        </div>
      )}
      {data.warnings?.map((w, i) => (
        <p key={i} className="text-xs text-amber-600 dark:text-amber-400 mt-1">Warning: {w}</p>
      ))}
    </div>
  );
}

function ServerStatusPanel({ data }) {
  if (!data || data.error) return <ErrorMsg msg={data?.error} />;
  return (
    <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
      <InfoCard label="IP Address" value={data.ip} copyable />
      <InfoCard label="DNS Resolved" value={data.dns_resolved ? 'Yes' : 'No'} />
      <InfoCard label="HTTP Status" value={data.http_status} />
      <InfoCard label="Response Time" value={data.response_time_ms ? `${data.response_time_ms}ms` : '—'} />
      {data.ports && Object.entries(data.ports).map(([port, open]) => (
        <InfoCard key={port} label={`Port ${port}`} value={open ? 'Open' : 'Closed'} />
      ))}
    </div>
  );
}

/* ---------- Shared ---------- */
function InfoCard({ label, value, copyable }) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-600 p-3 bg-slate-50/50 dark:bg-slate-700/30">
      <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 font-medium">{label}</p>
      <div className="flex items-center justify-between mt-0.5">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-200 break-all">{value ?? '—'}</p>
        {copyable && <CopyButton text={value} />}
      </div>
    </div>
  );
}

function ErrorMsg({ msg }) {
  return (
    <div className="rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/20 p-4">
      <p className="text-sm text-rose-600 dark:text-rose-400">{msg || 'No data available for this check.'}</p>
    </div>
  );
}

import { useCallback, useEffect, useId, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import {
  HiArrowLeft, HiClock, HiCollection, HiDocumentReport, HiGlobe, HiLockClosed, HiMail, HiPencil, HiRefresh,
  HiServer, HiShieldCheck, HiShieldExclamation, HiStatusOnline,
} from 'react-icons/hi';
import HistoryChart from '../../components/dashboard/home/HistoryChart';
import ResultTable from '../../components/blacklist/ResultTable';
import AddNewMonitorDialog from '../../components/dashboard/blacklistMonitor/AddNewMonitorDialog';
import { DetailSkeleton } from '../../components/shared/Skeleton';
import CopyButton from '../../components/shared/CopyButton';
import TimeAgo from '../../components/shared/TimeAgo';
import { Alert, InfoTile, Spinner, cardClass, primaryButtonClass, secondaryButtonClass } from '../../components/shared/ui';
import { blacklistDiff, checksRun } from './assetHistory';
import HostnameService from '../../services/hostname';
import WhoisTable from '../../components/shared/WhoisTable';
import { EventList, IssueRow } from '../../components/shared/activity';
import ProviderStatusBadge from '../../components/blacklist/ProviderStatusBadge';
import { listAssetEvents } from '../../services/events';

const CHECK_TABS = {
  blacklist: { label: 'Blacklist', icon: HiShieldExclamation },
  abuseipdb: { label: 'AbuseIPDB', icon: HiShieldCheck },
  dns: { label: 'DNS records', icon: HiServer },
  ssl: { label: 'SSL certificate', icon: HiLockClosed },
  whois: { label: 'WHOIS', icon: HiGlobe },
  email_security: { label: 'SPF / DKIM / DMARC', icon: HiMail },
  server_status: { label: 'Server status', icon: HiStatusOnline },
  dmarc_reports: { label: 'DMARC reports', icon: HiDocumentReport },
  activity: { label: 'Activity', icon: HiClock },
  history: { label: 'History', icon: HiCollection },
};

const EXTRA_TABS = ['dmarc_reports', 'activity', 'history'];

const CHECK_BADGES = [
  ['check_blacklist', 'BL'],
  ['check_abuseipdb', 'ABUSE'],
  ['check_dns', 'DNS'],
  ['check_ssl', 'SSL'],
  ['check_whois', 'WHOIS'],
  ['check_email_security', 'DMARC'],
  ['check_server_status', 'UP'],
];

const EDITABLE_FIELDS = [
  'hostname', 'hostname_type', 'description', 'is_alert_enabled', 'is_monitor_enabled', 'check_interval_minutes',
  ...CHECK_BADGES.map(([key]) => key),
];

// Results saved before v1.1 are flat DNSBL payloads; newer ones are keyed by check.
function splitResult(result) {
  if (!result) return {};
  const keyed = Object.keys(result).some((key) => key in CHECK_TABS);
  if (keyed) return result;
  if (result.providers || result.detected_on) return { blacklist: result };
  return {};
}

export default function AssetDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const hostnameService = HostnameService();
  const [asset, setAsset] = useState(null);
  const [dmarcSummary, setDmarcSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rechecking, setRechecking] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [historyKey, setHistoryKey] = useState(0);

  const fetchAsset = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    setError('');
    try {
      const data = await HostnameService().getHostname(id);
      setAsset(data);
      if (data.hostname_type === 'domain') {
        axios.get(`/api/dmarc/summary/?domain=${encodeURIComponent(data.hostname)}`)
          .then((res) => setDmarcSummary(res.data))
          .catch(() => setDmarcSummary(null));
      } else {
        setDmarcSummary(null);
      }
    } catch (err) {
      setError(err.response?.status === 404 ? 'This asset does not exist or was deleted.' : 'Could not load the asset. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchAsset(); }, [fetchAsset]);

  const results = splitResult(asset?.result);
  const checkId = asset?.result?.id;
  const tabs = [
    ...Object.keys(CHECK_TABS).filter((key) => !EXTRA_TABS.includes(key) && key in results),
    ...(asset?.hostname_type === 'domain' ? ['dmarc_reports'] : []),
    'activity',
    'history',
  ];
  const currentTab = tabs.includes(activeTab) ? activeTab : tabs[0];

  const handleRecheck = async () => {
    setRechecking(true);
    try {
      await hostnameService.recheckHostname(id);
      await fetchAsset({ quiet: true });
      setHistoryKey((key) => key + 1);
      toast.success('Checks finished');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Re-check failed. Try again.');
    } finally {
      setRechecking(false);
    }
  };

  const openEdit = () => {
    setEditForm(Object.fromEntries(EDITABLE_FIELDS.map((key) => [key, asset[key] ?? (key === 'description' ? '' : null)])));
    setEditOpen(true);
  };

  const handleEditChange = (event) => {
    const { name, value, type, checked } = event.target;
    setEditForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleEditSave = async () => {
    setSaving(true);
    try {
      await hostnameService.updateHostname(id, { ...editForm, description: editForm.description || null, status: asset.status });
      toast.success('Asset updated');
      setEditOpen(false);
      fetchAsset({ quiet: true });
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not save changes.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <DetailSkeleton />;

  if (error || !asset) {
    return (
      <section className={`${cardClass} p-6 text-center py-16`}>
        <p className="text-slate-600 dark:text-slate-300 mb-4">{error || 'Asset not found.'}</p>
        <Link to="/dashboard/assets" className="text-sm font-medium text-cyan-700 dark:text-cyan-400 hover:underline">Back to assets</Link>
      </section>
    );
  }

  const enabledChecks = CHECK_BADGES.filter(([key]) => asset[key]).map(([, label]) => label);
  // The blacklist status already has its own summary card and table.
  const issues = (asset.health?.issues || []).filter((issue) => issue.kind !== 'blacklist');
  const blacklist = results.blacklist;
  const inconclusive = Boolean(blacklist?.is_inconclusive);
  const statusCard = !blacklist
    ? { value: asset.check_blacklist ? 'Not checked' : 'Not monitored', tone: 'slate' }
    : asset.is_blacklisted
      ? { value: `Listed (${blacklist.detected_on?.length ?? 0})`, tone: 'rose' }
      : inconclusive ? { value: 'Inconclusive', tone: 'amber' } : { value: 'Clear', tone: 'emerald' };

  return (
    <section className="space-y-5">
      {/* Header */}
      <div className={`${cardClass} p-5`}>
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <button
              type="button"
              onClick={() => navigate('/dashboard/assets')}
              className="p-2 -ml-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-500 dark:text-slate-400"
              aria-label="Back to assets"
            >
              <HiArrowLeft className="text-xl" aria-hidden="true" />
            </button>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white break-all">{asset.hostname}</h1>
                <CopyButton text={asset.hostname} label="Copy hostname" />
                <span className="inline-flex rounded-full bg-slate-100 dark:bg-slate-700 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                  {asset.hostname_type === 'ipv4' ? 'IPv4' : 'Domain'}
                </span>
              </div>
              {asset.description && <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{asset.description}</p>}
              <div className="flex flex-wrap gap-1.5 mt-2" aria-label="Enabled checks">
                {enabledChecks.map((label) => (
                  <span key={label} className="inline-flex rounded bg-cyan-50 dark:bg-cyan-900/30 text-cyan-800 dark:text-cyan-300 px-2 py-0.5 text-[11px] font-semibold border border-cyan-200 dark:border-cyan-800">
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <button type="button" onClick={openEdit} className={secondaryButtonClass}>
              <HiPencil aria-hidden="true" /> Edit
            </button>
            <button type="button" onClick={handleRecheck} disabled={rechecking} className={primaryButtonClass}>
              {rechecking ? <Spinner /> : <HiRefresh aria-hidden="true" />}
              {rechecking ? 'Running checks' : 'Re-check now'}
            </button>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Blacklist status" value={statusCard.value} tone={statusCard.tone} />
        <SummaryCard
          label="Last checked"
          value={asset.checked && asset.checked !== 'Not checked' ? <TimeAgo date={asset.checked} /> : 'Never'}
          tone="slate"
        />
        <SummaryCard
          label="Scheduled monitoring"
          value={asset.is_monitor_enabled ? (asset.check_interval_minutes ? `Every ${formatInterval(asset.check_interval_minutes)}` : 'Default interval') : 'Off'}
          tone={asset.is_monitor_enabled ? 'sky' : 'slate'}
        />
        <SummaryCard label="Alerts" value={asset.is_alert_enabled ? 'On' : 'Off'} tone={asset.is_alert_enabled ? 'amber' : 'slate'} />
      </div>

      {issues.length > 0 && (
        <section className={`${cardClass} p-5`} aria-labelledby="asset-issues-title">
          <h2 id="asset-issues-title" className="text-base font-semibold text-slate-900 dark:text-white">Needs attention</h2>
          <ul className="divide-y divide-slate-100 dark:divide-slate-700">
            {issues.map((issue) => <IssueRow key={`${issue.kind}-${issue.message}`} issue={issue} />)}
          </ul>
        </section>
      )}

      {inconclusive && (
        <Alert tone="warning">
          {blacklist.failed_providers?.length} providers did not answer during the last check, so the clean result is not reliable.
          The previous status was kept. Your DNS resolver may be rate limited or blocked by some blacklists.
        </Alert>
      )}

      {(asset.check_blacklist || results.blacklist) && (
        <HistoryChart key={historyKey} hostnameId={asset.id} hostname={asset.hostname} />
      )}

      {/* Tabbed results */}
      {tabs.length > 0 ? (
        <ResultTabs tabs={tabs} current={currentTab} onSelect={setActiveTab}>
          {currentTab === 'blacklist' && <BlacklistPanel data={results.blacklist} checkId={checkId} onChange={() => fetchAsset({ quiet: true })} />}
          {currentTab === 'abuseipdb' && <AbuseIPDBPanel data={results.abuseipdb} />}
          {currentTab === 'dns' && <DnsPanel data={results.dns} />}
          {currentTab === 'ssl' && <SslPanel data={results.ssl} />}
          {currentTab === 'whois' && <WhoisPanel data={results.whois} />}
          {currentTab === 'email_security' && <EmailSecurityPanel data={results.email_security} />}
          {currentTab === 'server_status' && <ServerStatusPanel data={results.server_status} />}
          {currentTab === 'dmarc_reports' && <DmarcReportsPanel summary={dmarcSummary} />}
          {currentTab === 'activity' && <ActivityPanel hostnameId={asset.id} refreshKey={historyKey} />}
          {currentTab === 'history' && <HistoryPanel hostnameId={asset.id} refreshKey={historyKey} />}
        </ResultTabs>
      ) : (
        <div className={`${cardClass} p-8 text-center`}>
          <p className="text-slate-600 dark:text-slate-300">No results yet. Select <span className="font-medium">Re-check now</span> to run the enabled checks.</p>
        </div>
      )}

      {editForm && (
        <AddNewMonitorDialog
          mode="edit"
          formData={editForm}
          handleInputChange={handleEditChange}
          handleSubmit={handleEditSave}
          isOpen={editOpen}
          setIsOpen={setEditOpen}
          submitting={saving}
        />
      )}
    </section>
  );
}

function formatInterval(minutes) {
  if (minutes % 1440 === 0) return `${minutes / 1440} day${minutes === 1440 ? '' : 's'}`;
  if (minutes % 60 === 0) return `${minutes / 60} h`;
  return `${minutes} min`;
}

/* ---------- Tabs (WAI-ARIA tab pattern) ---------- */
function ResultTabs({ tabs, current, onSelect, children }) {
  const baseId = useId();
  const onKeyDown = (event) => {
    const index = tabs.indexOf(current);
    const next = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: tabs.length - 1 }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    const tab = tabs[(next + tabs.length) % tabs.length];
    onSelect(tab);
    document.getElementById(`${baseId}-tab-${tab}`)?.focus();
  };
  return (
    <div className={`${cardClass} overflow-hidden`}>
      <div role="tablist" aria-label="Check results" className="flex border-b border-slate-200 dark:border-slate-700 overflow-x-auto" onKeyDown={onKeyDown}>
        {tabs.map((tab) => {
          const info = CHECK_TABS[tab];
          const Icon = info.icon;
          const selected = tab === current;
          return (
            <button
              key={tab}
              id={`${baseId}-tab-${tab}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${baseId}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onSelect(tab)}
              className={`flex items-center gap-2 px-4 sm:px-5 py-3.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                selected
                  ? 'border-cyan-600 text-cyan-700 dark:text-cyan-400 bg-slate-50 dark:bg-slate-700/50'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/30'
              }`}
            >
              <Icon className="text-base" aria-hidden="true" />
              {info.label}
            </button>
          );
        })}
      </div>
      <div id={`${baseId}-panel`} role="tabpanel" aria-labelledby={`${baseId}-tab-${current}`} className="p-4 sm:p-5">
        {children}
      </div>
    </div>
  );
}

/* ---------- Summary card ---------- */
function SummaryCard({ label, value, tone }) {
  const tones = {
    rose: 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300',
    emerald: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300',
    sky: 'bg-sky-50 dark:bg-sky-900/20 border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-300',
    amber: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300',
    slate: 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200',
  };
  return (
    <div className={`rounded-xl border p-4 ${tones[tone] || tones.slate}`}>
      <p className="text-xs font-medium opacity-80">{label}</p>
      <p className="text-lg font-semibold mt-1">{value}</p>
    </div>
  );
}

/* ---------- Panels ---------- */
function ErrorMsg({ msg }) {
  return <Alert tone="error">{msg || 'No data available for this check.'}</Alert>;
}

function BlacklistPanel({ data, checkId, onChange }) {
  if (!data || data.error) return <ErrorMsg msg={data?.error} />;
  return <ResultTable data={data} checkId={checkId} onDelistRecorded={onChange} />;
}

function AbuseIPDBPanel({ data }) {
  if (!data || data.error) return <ErrorMsg msg={data?.error} />;
  const score = data.abuse_confidence_score;
  const scoreColor = score === 0 ? 'text-emerald-600 dark:text-emerald-400' : score <= 25 ? 'text-yellow-700 dark:text-yellow-300' : score <= 75 ? 'text-orange-600 dark:text-orange-400' : 'text-rose-600 dark:text-rose-400';
  return (
    <div className="space-y-4">
      <div className="flex items-baseline gap-3">
        <span className={`text-4xl font-bold tabular-nums ${scoreColor}`}>{score}%</span>
        <span className="text-sm text-slate-500 dark:text-slate-400">Abuse confidence score</span>
      </div>
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <InfoTile label="IP" value={data.ip} />
        <InfoTile label="ISP" value={data.isp} />
        <InfoTile label="Country" value={data.country_code} />
        <InfoTile label="Usage type" value={data.usage_type} />
        <InfoTile label="Total reports" value={data.total_reports} />
        <InfoTile label="Last reported" value={data.last_reported_at || 'Never'} />
      </div>
    </div>
  );
}

function DnsPanel({ data }) {
  if (!data || data.error) return <ErrorMsg msg={data?.error} />;
  const records = data.records || {};
  if (Object.keys(records).length === 0) return <p className="text-sm text-slate-500 dark:text-slate-400">No DNS records found.</p>;
  return (
    <div className="space-y-3">
      {Object.entries(records).map(([type, values]) => (
        <div key={type} className="rounded-lg border border-slate-200 dark:border-slate-600 overflow-hidden">
          <div className="bg-slate-50 dark:bg-slate-700 px-4 py-2 flex items-baseline gap-2">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{type}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">{values.length} record{values.length !== 1 ? 's' : ''}</span>
          </div>
          <ul className="divide-y divide-slate-100 dark:divide-slate-600">
            {values.map((value, i) => (
              <li key={i} className="px-4 py-2 text-sm font-mono text-slate-700 dark:text-slate-300 break-all flex items-start justify-between gap-3">
                <span>{value}</span>
                <CopyButton text={value} label={`Copy ${type} record`} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function SslPanel({ data }) {
  if (!data || (data.error && !('valid' in data))) return <ErrorMsg msg={data?.error} />;
  const { valid, days_remaining: days } = data;
  const tone = !valid ? 'rose' : days < 30 ? 'amber' : 'emerald';
  const boxes = {
    rose: 'border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300',
    amber: 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300',
    emerald: 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300',
  };
  return (
    <div className="space-y-4">
      <div className={`rounded-xl border p-4 ${boxes[tone]}`}>
        <p className="text-xl font-semibold">{valid ? `Valid, ${days} days remaining` : 'Expired or invalid'}</p>
        {data.error && <p className="text-sm mt-1">{data.error}</p>}
      </div>
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <InfoTile label="Issuer" value={data.issuer?.common_name} />
        <InfoTile label="Subject" value={data.subject?.common_name} />
        <InfoTile label="Not before" value={data.not_before?.slice(0, 10)} />
        <InfoTile label="Not after" value={data.not_after?.slice(0, 10)} />
        <InfoTile label="Cipher" value={data.cipher?.name} />
        <InfoTile label="Protocol" value={data.cipher?.protocol} />
      </div>
      {data.san?.length > 0 && (
        <div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Subject alternative names</p>
          <div className="flex flex-wrap gap-1.5">
            {data.san.map((name) => (
              <span key={name} className="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-full px-2.5 py-0.5 text-xs font-mono">{name}</span>
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
      <WhoisTable data={data} />
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
  const gradeColors = { A: 'text-emerald-600 dark:text-emerald-400', B: 'text-sky-600 dark:text-sky-400', D: 'text-amber-600 dark:text-amber-400', F: 'text-rose-600 dark:text-rose-400' };
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <span className={`text-5xl font-bold ${gradeColors[data.grade] || 'text-slate-600'}`}>{data.grade}</span>
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">Email security grade</p>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{data.score} of {data.max_score} checks passed</p>
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
  const record = data.record || data.selectors_found?.map((s) => `${s.selector}: ${s.record || s.cname}`).join('\n');
  return (
    <div className={`rounded-lg border p-4 ${data.found ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/20' : 'border-rose-200 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-900/20'}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex rounded px-2 py-0.5 text-[11px] font-bold ${data.found ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200' : 'bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200'}`}>
          {data.found ? 'Found' : 'Missing'}
        </span>
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{title}</span>
        {data.policy && <span className="text-xs text-slate-500 dark:text-slate-400">Policy: {data.policy}</span>}
      </div>
      {record ? (
        <div className="flex items-start gap-2 mt-2">
          <pre className="text-xs font-mono text-slate-700 dark:text-slate-300 break-all whitespace-pre-wrap bg-white/70 dark:bg-slate-900/50 rounded-lg p-2 flex-1">{record}</pre>
          <CopyButton text={record} label={`Copy ${title} record`} className="mt-1" />
        </div>
      ) : data.details ? (
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{data.details}</p>
      ) : null}
      {data.warnings?.map((warning) => (
        <p key={warning} className="text-xs text-amber-700 dark:text-amber-400 mt-1.5">{warning}</p>
      ))}
    </div>
  );
}

function ServerStatusPanel({ data }) {
  if (!data || data.error) return <ErrorMsg msg={data?.error} />;
  const goodBad = (value) => (value ? 'good' : 'bad');
  return (
    <div className="space-y-4">
      <div className={`rounded-xl border p-4 ${data.is_up ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300' : 'border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300'}`}>
        <p className="text-xl font-semibold">{data.is_up ? 'Server is up' : 'Server is down'}</p>
        {!data.is_up && data.reason && <p className="text-sm mt-1">{data.reason}</p>}
      </div>
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <InfoTile label="Resolved IP" value={data.resolved_ip} />
        <InfoTile label="DNS resolves" value={data.dns_resolves ? 'Yes' : 'No'} tone={goodBad(data.dns_resolves)} />
        {'port_443_open' in data && <InfoTile label="Port 443 (HTTPS)" value={data.port_443_open ? 'Open' : 'Closed'} tone={goodBad(data.port_443_open)} />}
        {'port_80_open' in data && <InfoTile label="Port 80 (HTTP)" value={data.port_80_open ? 'Open' : 'Closed'} tone={goodBad(data.port_80_open)} />}
        {data.status_code !== undefined && <InfoTile label="HTTP status" value={data.status_code} tone={goodBad(data.status_code >= 200 && data.status_code < 400)} />}
        {data.response_time_ms !== undefined && <InfoTile label="Response time" value={`${data.response_time_ms} ms`} />}
        {data.server_header && <InfoTile label="Server" value={data.server_header} />}
        {data.final_url && data.final_url !== data.url && <InfoTile label="Redirected to" value={data.final_url} />}
      </div>
    </div>
  );
}

function DmarcReportsPanel({ summary }) {
  if (!summary) {
    return (
      <div className="text-center py-6">
        <HiDocumentReport className="text-4xl text-slate-300 dark:text-slate-600 mx-auto mb-3" aria-hidden="true" />
        <p className="text-sm text-slate-600 dark:text-slate-300">No DMARC aggregate reports uploaded for this domain.</p>
        <Link to="/dashboard/dmarc-reports" className="inline-block mt-3 text-sm font-medium text-cyan-700 dark:text-cyan-400 hover:underline">
          Upload reports on the DMARC reports page
        </Link>
      </div>
    );
  }

  const { pass_rate, total_messages, disposition_breakdown, top_senders, report_count, date_range, policy } = summary;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <InfoTile label="Total messages" value={total_messages?.toLocaleString()} />
        <InfoTile label="DKIM aligned" value={`${pass_rate?.dkim ?? 0}%`} />
        <InfoTile label="SPF aligned" value={`${pass_rate?.spf ?? 0}%`} />
        <InfoTile label="Overall aligned" value={`${pass_rate?.aligned ?? 0}%`} />
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <span className="bg-slate-100 dark:bg-slate-700 rounded-lg px-3 py-1.5 text-sm font-mono text-slate-700 dark:text-slate-300">p={policy?.p || 'none'}</span>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {report_count} report{report_count !== 1 ? 's' : ''} &middot; {date_range?.earliest?.slice(0, 10)} to {date_range?.latest?.slice(0, 10)}
        </span>
      </div>

      {disposition_breakdown && Object.keys(disposition_breakdown).length > 0 && (
        <div className="flex gap-6">
          {Object.entries(disposition_breakdown).map(([key, val]) => (
            <div key={key}>
              <p className="text-lg font-semibold text-slate-800 dark:text-white tabular-nums">{val.toLocaleString()}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{key}</p>
            </div>
          ))}
        </div>
      )}

      {top_senders?.length > 0 && (
        <div className="rounded-lg border border-slate-200 dark:border-slate-600 overflow-hidden">
          <div className="overflow-auto max-h-[30vh]">
            <table className="w-full text-sm text-slate-700 dark:text-slate-300 border-collapse">
              <caption className="text-left px-3 py-2 bg-slate-50 dark:bg-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300">Top senders</caption>
              <thead className="bg-slate-50 dark:bg-slate-700 sticky top-0">
                <tr className="text-left">
                  <th scope="col" className="px-3 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">IP</th>
                  <th scope="col" className="px-3 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">Messages</th>
                  <th scope="col" className="px-3 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">DKIM</th>
                  <th scope="col" className="px-3 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">SPF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-600">
                {top_senders.slice(0, 10).map((sender) => (
                  <tr key={sender.ip}>
                    <td className="px-3 py-2 font-mono"><span className="inline-flex items-center gap-1.5">{sender.ip} <CopyButton text={sender.ip} label="Copy IP" /></span></td>
                    <td className="px-3 py-2 tabular-nums">{sender.count.toLocaleString()}</td>
                    <td className={`px-3 py-2 tabular-nums ${sender.dkim_rate >= 90 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{sender.dkim_rate}%</td>
                    <td className={`px-3 py-2 tabular-nums ${sender.spf_rate >= 90 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{sender.spf_rate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Link to="/dashboard/dmarc-reports" className="inline-block text-sm font-medium text-cyan-700 dark:text-cyan-400 hover:underline">
        View all reports
      </Link>
    </div>
  );
}


/* ---------- Activity & history ---------- */
function ProviderList({ rows }) {
  return (
    <ul className="rounded-lg border border-slate-200 dark:border-slate-600 divide-y divide-slate-100 dark:divide-slate-700">
      {rows.map(([provider, change]) => (
        <li key={`${provider}-${change}`} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
          <span className="font-medium text-slate-800 dark:text-slate-200 break-all">{provider}</span>
          <span className="flex items-center gap-2">
            {change === 'new' && <span className="text-xs font-semibold text-rose-700 dark:text-rose-300">New</span>}
            {change === 'removed' && <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">Removed</span>}
            <ProviderStatusBadge status={change === 'removed' ? 'clear' : 'listed'} />
          </span>
        </li>
      ))}
    </ul>
  );
}

function ActivityPanel({ hostnameId, refreshKey }) {
  const [events, setEvents] = useState(null);
  useEffect(() => {
    let active = true;
    listAssetEvents(hostnameId, 100).then((data) => active && setEvents(data)).catch(() => active && setEvents([]));
    return () => { active = false; };
  }, [hostnameId, refreshKey]);
  if (events === null) return <div className="flex justify-center py-8" aria-busy="true"><Spinner className="h-5 w-5 text-cyan-600" /></div>;
  return <EventList events={events} showHostname={false} emptyText="No changes recorded for this asset yet." />;
}

function HistoryPanel({ hostnameId, refreshKey }) {
  const [checks, setChecks] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    let active = true;
    HostnameService().getHistory(hostnameId, 100)
      .then((data) => {
        if (!active) return;
        const list = [...(data.history || [])].reverse();
        setChecks(list);
        setSelectedId((current) => current ?? list[0]?.id ?? null);
      })
      .catch(() => active && setChecks([]));
    return () => { active = false; };
  }, [hostnameId, refreshKey]);

  useEffect(() => {
    if (!selectedId) return undefined;
    let active = true;
    setLoadingDetail(true);
    const service = HostnameService();
    service.getCheck(hostnameId, selectedId)
      .then(async (current) => {
        const previous = current.previous_id ? await service.getCheck(hostnameId, current.previous_id).catch(() => null) : null;
        if (active) setDetail({ current, previous });
      })
      .catch(() => active && setDetail(null))
      .finally(() => active && setLoadingDetail(false));
    return () => { active = false; };
  }, [hostnameId, selectedId]);

  if (checks === null) return <div className="flex justify-center py-8" aria-busy="true"><Spinner className="h-5 w-5 text-cyan-600" /></div>;
  if (checks.length === 0) return <p className="text-sm text-slate-500 dark:text-slate-400 py-6 text-center">No checks have run yet.</p>;

  const diff = detail ? blacklistDiff(detail.previous?.result, detail.current.result) : null;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
      <div>
        <h3 className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Checks (newest first)</h3>
        <ul className="max-h-[28rem] overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-600 divide-y divide-slate-100 dark:divide-slate-700" aria-label="Past checks">
          {checks.map((check) => (
            <li key={check.id}>
              <button
                type="button"
                aria-current={check.id === selectedId ? 'true' : undefined}
                onClick={() => setSelectedId(check.id)}
                className={`w-full text-left px-3 py-2.5 text-sm transition-colors ${check.id === selectedId ? 'bg-cyan-50 dark:bg-cyan-900/30' : 'hover:bg-slate-50 dark:hover:bg-slate-700/40'}`}
              >
                <span className="block font-medium text-slate-800 dark:text-slate-100">{new Date(check.date).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span>
                <span className={`text-xs ${check.detected_count ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400'}`}>
                  {check.total_providers ? (check.detected_count ? `Listed on ${check.detected_count}` : 'Not listed') : 'No blacklist check'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div aria-live="polite">
        {loadingDetail || !detail ? (
          <div className="flex justify-center py-8" aria-busy="true"><Spinner className="h-5 w-5 text-cyan-600" /></div>
        ) : (
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Check from {new Date(detail.current.date).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">Ran: {checksRun(detail.current.result).join(', ') || 'nothing'}</p>
            </div>
            {!diff ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">The blacklist check didn&apos;t run or failed in this check.</p>
            ) : (
              <>
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  {!detail.previous
                    ? 'First check for this asset: '
                    : diff.added.length || diff.removed.length ? 'Changes since the check before it: ' : 'No change since the check before it: '}
                  <span className="font-medium">listed on {diff.listed.length} of {diff.total}</span>
                  {diff.added.length > 0 && <span className="text-rose-700 dark:text-rose-400">, {diff.added.length} new</span>}
                  {diff.removed.length > 0 && <span className="text-emerald-700 dark:text-emerald-400">, {diff.removed.length} removed</span>}.
                </p>
                {(detail.previous ? [...diff.added, ...diff.removed] : diff.listed).length > 0 && (
                  <ProviderList rows={[
                    ...(detail.previous ? diff.added : diff.listed).map((p) => [p, detail.previous ? 'new' : 'listed']),
                    ...diff.removed.map((p) => [p, 'removed']),
                  ]} />
                )}
                {detail.previous && diff.kept.length > 0 && (
                  <details>
                    <summary className="text-sm font-medium text-cyan-700 dark:text-cyan-400 cursor-pointer hover:underline">
                      Still listed on {diff.kept.length} provider{diff.kept.length === 1 ? '' : 's'}
                    </summary>
                    <div className="mt-2"><ProviderList rows={diff.kept.map((p) => [p, 'listed'])} /></div>
                  </details>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

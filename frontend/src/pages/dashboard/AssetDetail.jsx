import { useCallback, useEffect, useId, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import {
  HiOutlineArrowLeft, HiOutlineArrowPath, HiOutlineDocumentChartBar, HiOutlinePencilSquare, HiOutlineTrash,
} from 'react-icons/hi2';
import HistoryChart from '../../components/dashboard/home/HistoryChart';
import ResultTable from '../../components/blacklist/ResultTable';
import { ResultVerdict } from '../../components/blacklist/ResultTableQuick';
import { sortProviders } from '../../components/blacklist/providerStatus';
import AddNewMonitorDialog from '../../components/dashboard/blacklistMonitor/AddNewMonitorDialog';
import { SkeletonLine } from '../../components/shared/Skeleton';
import CopyButton from '../../components/shared/CopyButton';
import TimeAgo from '../../components/shared/TimeAgo';
import {
  Alert, EmptyState, Field, Fields, Section, Spinner, StatusTag, linkClass, primaryButtonClass, secondaryButtonClass,
} from '../../components/shared/ui';
import { SEVERITY_RANK } from '../../components/shared/severity';
import { blacklistDiff, checksRun } from './assetHistory';
import HostnameService from '../../services/hostname';
import { EventList, IssueRow } from '../../components/shared/activity';
import ProviderStatusBadge from '../../components/blacklist/ProviderStatusBadge';
import { listAssetEvents } from '../../services/events';

const CHECK_TABS = {
  blacklist: { label: 'Blacklist' },
  abuseipdb: { label: 'AbuseIPDB' },
  dns: { label: 'DNS records' },
  ssl: { label: 'SSL certificate' },
  whois: { label: 'WHOIS' },
  email_security: { label: 'SPF / DKIM / DMARC' },
  server_status: { label: 'Server status' },
  dmarc_reports: { label: 'DMARC reports' },
  activity: { label: 'Activity' },
  history: { label: 'History' },
};

const EXTRA_TABS = ['dmarc_reports', 'activity', 'history'];

const CHECK_BADGES = [
  ['check_blacklist', 'Blacklist'],
  ['check_abuseipdb', 'AbuseIPDB'],
  ['check_dns', 'DNS'],
  ['check_ssl', 'SSL'],
  ['check_whois', 'WHOIS'],
  ['check_email_security', 'SPF/DKIM/DMARC'],
  ['check_server_status', 'Server status'],
];

const EDITABLE_FIELDS = [
  'hostname', 'hostname_type', 'description', 'is_alert_enabled', 'is_monitor_enabled', 'check_interval_minutes',
  ...CHECK_BADGES.map(([key]) => key),
];

// Outlined destructive action: quieter than the filled danger button, so Re-check stays the one primary.
const deleteButtonClass =
  'inline-flex items-center justify-center gap-2 h-9 px-3.5 rounded-md text-sm font-semibold whitespace-nowrap ' +
  'transition-colors disabled:opacity-50 disabled:cursor-not-allowed ' +
  'text-s5 bg-paper border border-rule-strong hover:bg-s5-soft hover:border-s5/40';

// Reply-class verdicts, as on the dashboard.
const TONES = {
  '5.x': 'text-s5',
  '4.x': 'text-s4',
  '3.x': 'text-info',
  '2.x': 'text-s2',
};

// Results saved before v1.1 are flat DNSBL payloads; newer ones are keyed by check.
function splitResult(result) {
  if (!result) return {};
  const keyed = Object.keys(result).some((key) => key in CHECK_TABS);
  if (keyed) return result;
  if (result.providers || result.detected_on) return { blacklist: result };
  return {};
}

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

function formatInterval(minutes) {
  if (minutes % 1440 === 0) return `${minutes / 1440} day${minutes === 1440 ? '' : 's'}`;
  if (minutes % 60 === 0) return `${minutes / 60} h`;
  return `${minutes} min`;
}

/** "2026-10-26 14:03" in local time: compact and sortable, like a log line. */
function formatStamp(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** The asset's one-line verdict: the worst open issue, or what is known when there is none. */
function assetVerdict(asset, results) {
  const issues = [...(asset.health?.issues || [])].sort((a, b) => (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9));
  const worst = issues[0];
  if (worst?.severity === 'critical') return { code: '5.x', text: worst.message };
  if (worst?.severity === 'warning') return { code: '4.x', text: worst.message };
  const ran = Object.keys(results).filter((key) => !EXTRA_TABS.includes(key) && key in CHECK_TABS);
  if (ran.length === 0) return { code: '3.x', text: 'Not checked yet' };
  // A check that errored is unknown, not clean.
  const failed = ran.filter((key) => results[key]?.error && !(key === 'ssl' && 'valid' in results[key]));
  if (failed.length) {
    return { code: '4.x', text: `${failed.map((key) => CHECK_TABS[key].label).join(', ')} check${failed.length === 1 ? '' : 's'} did not complete` };
  }
  if (worst) return { code: '3.x', text: worst.message };
  return { code: '2.x', text: ran.length === 1 ? 'The last check found no problems' : `All ${ran.length} checks found no problems` };
}

function VerdictLine({ verdict }) {
  return (
    <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <span className={`font-mono text-2xl leading-none font-semibold ${TONES[verdict.code]}`}>{verdict.code}</span>
      <span className="text-xl font-semibold tracking-tight text-ink">{verdict.text}</span>
    </p>
  );
}

function OnOff({ on, children }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-1.5 w-1.5 rounded-full ${on ? 'bg-s2' : 'bg-ink-3'}`} aria-hidden="true" />
      {children}
    </span>
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading asset">
      <SkeletonLine className="h-4 w-16" />
      <SkeletonLine className="h-7 w-72 max-w-full" />
      <SkeletonLine className="h-6 w-96 max-w-full" />
      <div className="pt-2 space-y-2">{[...Array(4)].map((_, i) => <SkeletonLine key={i} className="h-4 w-64 max-w-full" />)}</div>
      <div className="pt-6 space-y-3">{[...Array(5)].map((_, i) => <SkeletonLine key={i} className="h-10" />)}</div>
    </div>
  );
}

function LinesSkeleton({ count = 4, label }) {
  return (
    <div className="space-y-2.5 py-1" aria-busy="true" aria-label={label}>
      {[...Array(count)].map((_, i) => <SkeletonLine key={i} className="h-9" />)}
    </div>
  );
}

export default function AssetDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const hostnameService = HostnameService();
  const [asset, setAsset] = useState(null);
  const [dmarcSummary, setDmarcSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rechecking, setRechecking] = useState(false);
  const [deleting, setDeleting] = useState(false);
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

  const handleDelete = async () => {
    if (!window.confirm(`Delete ${asset.hostname} and its check history?`)) return;
    setDeleting(true);
    try {
      await hostnameService.deleteHostname(id);
      toast.success(`Deleted ${asset.hostname}`);
      navigate('/dashboard/assets');
    } catch {
      toast.error('Could not delete the asset.');
      setDeleting(false);
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

  if (loading) return <PageSkeleton />;

  if (error || !asset) {
    return (
      <Alert tone="error">
        {error || 'Asset not found.'}{' '}
        <Link to="/dashboard/assets" className="font-semibold underline">Back to assets</Link>
      </Alert>
    );
  }

  const enabledChecks = CHECK_BADGES.filter(([key]) => asset[key]).map(([, label]) => label);
  const issues = asset.health?.issues || [];
  const blacklist = results.blacklist;
  const inconclusive = Boolean(blacklist?.is_inconclusive);
  const verdict = assetVerdict(asset, results);
  const checked = asset.checked && asset.checked !== 'Not checked';

  return (
    <div>
      {/* The asset, its verdict, and its delivery headers */}
      <div className="pb-6 border-b border-rule">
        <button
          type="button"
          onClick={() => navigate('/dashboard/assets')}
          className="inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink mb-3"
          aria-label="Back to assets"
        >
          <HiOutlineArrowLeft aria-hidden="true" /> Assets
        </button>

        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <h1 className="font-mono text-xl font-semibold text-ink break-all">{asset.hostname}</h1>
              <CopyButton text={asset.hostname} label="Copy hostname" />
              <span className="inline-flex rounded bg-sunk px-1.5 py-0.5 text-xs font-medium text-ink-2 ring-1 ring-inset ring-rule">
                {asset.hostname_type === 'ipv4' ? 'IPv4' : 'Domain'}
              </span>
            </div>
            {asset.description && <p className="mt-1 text-sm text-ink-2 max-w-prose">{asset.description}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <button type="button" onClick={handleRecheck} disabled={rechecking} className={primaryButtonClass}>
              {rechecking ? <Spinner /> : <HiOutlineArrowPath aria-hidden="true" />}
              {rechecking ? 'Running checks' : 'Re-check'}
            </button>
            <button type="button" onClick={openEdit} className={secondaryButtonClass}>
              <HiOutlinePencilSquare aria-hidden="true" /> Edit
            </button>
            <button type="button" onClick={handleDelete} disabled={deleting} className={deleteButtonClass}>
              {deleting ? <Spinner /> : <HiOutlineTrash aria-hidden="true" />} Delete
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-x-10 gap-y-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
          <div className="min-w-0">
            <VerdictLine verdict={verdict} />
            <Fields className="mt-4 sm:grid-cols-[max-content_minmax(0,1fr)_max-content_minmax(0,1fr)] sm:gap-x-5">
              <Field name="Last-Checked">{checked ? <TimeAgo date={asset.checked} /> : 'Never'}</Field>
              <Field name="Monitoring">
                <OnOff on={asset.is_monitor_enabled}>{asset.is_monitor_enabled ? 'On' : 'Off, checked only when you re-check'}</OnOff>
              </Field>
              <Field name="Interval">
                {asset.check_interval_minutes ? `Every ${formatInterval(asset.check_interval_minutes)}` : 'Scheduler default'}
              </Field>
              <Field name="Alerts">
                <OnOff on={asset.is_alert_enabled}>{asset.is_alert_enabled ? 'On' : 'Off'}</OnOff>
              </Field>
              <Field name="Checks">
                <span aria-label="Enabled checks">{enabledChecks.length ? enabledChecks.join(', ') : 'None enabled'}</span>
              </Field>
            </Fields>
          </div>
          {(asset.check_blacklist || results.blacklist) && (
            <HistoryChart key={historyKey} hostnameId={asset.id} hostname={asset.hostname} showHostname={false} />
          )}
        </div>
      </div>

      <div className="mt-6 space-y-8">
        {(issues.length > 1 || inconclusive) && (
          <div className="space-y-4">
            {issues.length > 1 && (
              <Section title={`Needs attention (${issues.length})`}>
                <ul>
                  {issues.map((issue) => <IssueRow key={`${issue.kind}-${issue.message}`} issue={issue} />)}
                </ul>
              </Section>
            )}
            {inconclusive && (
              <Alert tone="warning">
                {blacklist.failed_providers?.length} blacklists did not answer during the last check, so the clean result is not reliable.
                The previous status was kept. Your DNS resolver may be rate limited or blocked by some blacklists; set <code>DNSBL_NAMESERVERS</code> to your own resolver.
              </Alert>
            )}
          </div>
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
          <EmptyState title="No results yet">
            Select Re-check to run the enabled checks.
          </EmptyState>
        )}
      </div>

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
    </div>
  );
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
    <div className="min-w-0">
      <div role="tablist" aria-label="Check results" className="flex gap-x-6 border-b border-rule overflow-x-auto" onKeyDown={onKeyDown}>
        {tabs.map((tab) => {
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
              className={`-mb-px py-2.5 text-sm whitespace-nowrap border-b-2 transition-colors focus-visible:[outline-offset:-2px] ${
                selected
                  ? 'border-accent text-ink font-semibold'
                  : 'border-transparent text-ink-2 font-medium hover:text-ink hover:border-rule-strong'
              }`}
            >
              {CHECK_TABS[tab].label}
            </button>
          );
        })}
      </div>
      <div id={`${baseId}-panel`} role="tabpanel" aria-labelledby={`${baseId}-tab-${current}`} className="pt-5 min-w-0">
        {children}
      </div>
    </div>
  );
}

/* ---------- Panels ---------- */
function ErrorMsg({ msg }) {
  return <Alert tone="error">{msg || 'No data available for this check.'}</Alert>;
}

/** A check's verdict in reply-class form, smaller than the page's. */
function CheckVerdict({ code, children, detail }) {
  return (
    <div className="space-y-1">
      <p className="flex flex-wrap items-baseline gap-x-2.5">
        <span className={`font-mono text-lg font-semibold ${TONES[code]}`} aria-hidden="true">{code}</span>
        <span className="text-lg font-semibold text-ink">{children}</span>
      </p>
      {detail && <p className="text-sm text-ink-2 break-words">{detail}</p>}
    </div>
  );
}

function Mono({ children }) {
  return <span className="font-mono text-[13px] break-all">{children}</span>;
}

function WithCopy({ text, label, children }) {
  return (
    <span className="inline-flex items-start gap-2 max-w-full">
      <span className="min-w-0">{children ?? text}</span>
      <CopyButton text={text} label={label} className="mt-0.5" />
    </span>
  );
}

function BlacklistPanel({ data, checkId, onChange }) {
  if (!data || data.error) return <ErrorMsg msg={data?.error} />;
  return (
    <div className="space-y-4">
      <ResultVerdict data={data} providers={sortProviders(data)} detailsOnly />
      <ResultTable data={data} checkId={checkId} onDelistRecorded={onChange} />
    </div>
  );
}

function scoreTone(score) {
  if (score == null) return 'text-ink-2';
  if (score === 0) return 'text-s2';
  if (score <= 25) return 'text-s4';
  return 'text-s5';
}

function AbuseIPDBPanel({ data }) {
  if (!data || data.error) return <ErrorMsg msg={data?.error} />;
  const score = data.abuse_confidence_score;
  return (
    <div className="flex flex-wrap items-start gap-x-12 gap-y-4">
      <div>
        <p className="font-mono text-xs text-ink-2">Confidence-Score:</p>
        <p className={`text-3xl font-semibold tabular-nums ${scoreTone(score)}`}>{score}%</p>
        <p className="text-xs text-ink-2 mt-0.5">{score === 0 ? 'No abuse reported' : 'Chance this IP is abusive'}</p>
      </div>
      <Fields className="flex-1 min-w-[16rem]">
        <Field name="IP"><Mono>{data.ip}</Mono></Field>
        <Field name="ISP">{data.isp}</Field>
        <Field name="Country">{data.country_code}</Field>
        <Field name="Usage-Type">{data.usage_type}</Field>
        <Field name="Reports"><span className="tabular-nums">{data.total_reports}</span></Field>
        <Field name="Last-Reported">{data.last_reported_at || 'Never'}</Field>
      </Fields>
    </div>
  );
}

function DnsPanel({ data }) {
  if (!data || data.error) return <ErrorMsg msg={data?.error} />;
  const records = data.records || {};
  if (Object.keys(records).length === 0) return <p className="text-sm text-ink-2">No DNS records found.</p>;
  return (
    <Fields className="gap-y-3">
      {Object.entries(records).map(([type, values]) => (
        <Field key={type} name={type}>
          <ul className="space-y-1">
            {values.map((value, i) => (
              <li key={i}>
                <WithCopy text={value} label={`Copy ${type} record`}><Mono>{value}</Mono></WithCopy>
              </li>
            ))}
          </ul>
        </Field>
      ))}
    </Fields>
  );
}

function SslPanel({ data }) {
  if (!data || (data.error && !('valid' in data))) return <ErrorMsg msg={data?.error} />;
  const { valid, days_remaining: days } = data;
  const code = !valid ? '5.x' : days < 30 ? '4.x' : '2.x';
  const text = !valid ? 'Expired or invalid' : days < 30 ? `Valid, expires in ${plural(days, 'day')}` : `Valid, ${days} days remaining`;
  return (
    <div className="space-y-5">
      <CheckVerdict code={code} detail={data.error}>{text}</CheckVerdict>
      <Fields>
        <Field name="Subject">{data.subject?.common_name && <Mono>{data.subject.common_name}</Mono>}</Field>
        <Field name="Issuer">{data.issuer?.common_name}</Field>
        <Field name="Not-Before"><span className="tabular-nums">{data.not_before?.slice(0, 10)}</span></Field>
        <Field name="Not-After"><span className="tabular-nums">{data.not_after?.slice(0, 10)}</span></Field>
        <Field name="Protocol">{data.cipher?.protocol && <Mono>{data.cipher.protocol}</Mono>}</Field>
        <Field name="Cipher">{data.cipher?.name && <Mono>{data.cipher.name}</Mono>}</Field>
        {data.san?.length > 0 && (
          <Field name="Alt-Names">
            <ul className="flex flex-wrap gap-x-3 gap-y-0.5">
              {data.san.map((name) => <li key={name}><Mono>{name}</Mono></li>)}
            </ul>
          </Field>
        )}
      </Fields>
    </div>
  );
}

const WHOIS_FIELDS = [
  ['domain_name', 'Domain-Name', true],
  ['registrar', 'Registrar'],
  ['registrar_url', 'Registrar-URL', true],
  ['creation_date', 'Created'],
  ['updated_date', 'Updated'],
  ['expiry_date', 'Expires'],
  ['name_servers', 'Name-Servers', true],
  ['status', 'Status'],
  ['registrant_org', 'Registrant-Org'],
  ['registrant_country', 'Registrant-Country'],
  ['registrant_state', 'Registrant-State'],
  ['abuse_email', 'Abuse-Email', true],
  ['tech_email', 'Tech-Email', true],
  ['dnssec', 'DNSSEC'],
  ['whois_server', 'WHOIS-Server', true],
];

function WhoisPanel({ data }) {
  if (!data || data.error) return <ErrorMsg msg={data?.error} />;
  const rows = WHOIS_FIELDS
    .map(([key, name, mono]) => [name, Array.isArray(data[key]) ? data[key].join(', ') : data[key], mono])
    .filter(([, value]) => value);
  return (
    <div className="space-y-5">
      {rows.length === 0 ? (
        <p className="text-sm text-ink-2">The WHOIS server returned no fields AbuseBox could parse. Check the raw response.</p>
      ) : (
        <Fields>
          {rows.map(([name, value, mono]) => (
            <Field key={name} name={name}>
              <WithCopy text={value} label={`Copy ${name.replace(/-/g, ' ').toLowerCase()}`}>
                {mono ? <Mono>{value}</Mono> : <span className="break-words">{value}</span>}
              </WithCopy>
            </Field>
          ))}
        </Fields>
      )}
      {data.raw && (
        <details>
          <summary className={`text-sm cursor-pointer ${linkClass}`}>Show raw WHOIS</summary>
          <pre className="mt-2 rounded-md border border-rule bg-sunk p-3 font-mono text-xs text-ink overflow-auto max-h-[50vh] whitespace-pre-wrap">{data.raw}</pre>
        </details>
      )}
    </div>
  );
}

const GRADE_CODES = { A: '2.x', B: '2.x', D: '4.x', F: '4.x' };

function EmailSecurityPanel({ data }) {
  if (!data || data.error) return <ErrorMsg msg={data?.error} />;
  const code = GRADE_CODES[data.grade] || '4.x';
  return (
    <div className="space-y-5">
      <CheckVerdict code={code} detail={`${data.score} of ${data.max_score} records found and valid.`}>
        Email security grade <span className="font-mono">{data.grade}</span>
      </CheckVerdict>
      <Fields className="gap-y-4">
        <RecordField title="SPF" data={data.spf} />
        <RecordField title="DKIM" data={data.dkim} />
        <RecordField title="DMARC" data={data.dmarc} />
      </Fields>
    </div>
  );
}

function RecordField({ title, data }) {
  if (!data) return null;
  const record = data.record || data.selectors_found?.map((s) => `${s.selector}: ${s.record || s.cname}`).join('\n');
  return (
    <Field name={title}>
      <div className="space-y-1.5">
        <p className="flex flex-wrap items-baseline gap-x-2">
          <StatusTag status={data.found ? 'clear' : 'listed'} label={data.found ? 'Found' : 'Missing'} />
          {data.policy && <span className="text-xs text-ink-2">Policy: <span className="font-mono text-ink">{data.policy}</span></span>}
        </p>
        {record ? (
          <div className="flex items-start gap-2">
            <pre className="flex-1 min-w-0 rounded-md border border-rule bg-sunk px-2.5 py-1.5 font-mono text-xs text-ink break-all whitespace-pre-wrap">{record}</pre>
            <CopyButton text={record} label={`Copy ${title} record`} className="mt-1.5" />
          </div>
        ) : data.details ? (
          <p className="text-sm text-ink-2">{data.details}</p>
        ) : null}
        {data.warnings?.map((warning) => (
          <p key={warning} className="text-xs text-s4"><span className="font-mono font-semibold">4.x</span> {warning}</p>
        ))}
      </div>
    </Field>
  );
}

function YesNo({ ok, yes, no }) {
  return <span className={ok ? 'text-ink' : 'text-s5 font-medium'}>{ok ? yes : no}</span>;
}

function ServerStatusPanel({ data }) {
  if (!data || data.error) return <ErrorMsg msg={data?.error} />;
  return (
    <div className="space-y-5">
      <CheckVerdict code={data.is_up ? '2.x' : '5.x'} detail={!data.is_up ? data.reason : null}>
        {data.is_up ? 'Server is up' : 'Server is down'}
      </CheckVerdict>
      <Fields>
        <Field name="Resolved-IP">{data.resolved_ip && <Mono>{data.resolved_ip}</Mono>}</Field>
        <Field name="DNS-Resolves"><YesNo ok={data.dns_resolves} yes="Yes" no="No" /></Field>
        {'port_443_open' in data && <Field name="Port-443"><YesNo ok={data.port_443_open} yes="Open (HTTPS)" no="Closed (HTTPS)" /></Field>}
        {'port_80_open' in data && <Field name="Port-80"><YesNo ok={data.port_80_open} yes="Open (HTTP)" no="Closed (HTTP)" /></Field>}
        {data.status_code !== undefined && (
          <Field name="HTTP-Status">
            <span className={`font-mono ${data.status_code >= 200 && data.status_code < 400 ? 'text-ink' : 'text-s5 font-semibold'}`}>{data.status_code}</span>
          </Field>
        )}
        {data.response_time_ms !== undefined && <Field name="Response-Time"><span className="tabular-nums">{data.response_time_ms} ms</span></Field>}
        {data.server_header && <Field name="Server"><Mono>{data.server_header}</Mono></Field>}
        {data.final_url && data.final_url !== data.url && <Field name="Redirected-To"><Mono>{data.final_url}</Mono></Field>}
      </Fields>
    </div>
  );
}

function DmarcReportsPanel({ summary }) {
  if (!summary) {
    return (
      <EmptyState
        icon={HiOutlineDocumentChartBar}
        title="No DMARC reports for this domain"
        action={<Link to="/dashboard/dmarc-reports" className={`text-sm ${linkClass}`}>Upload reports on the DMARC reports page</Link>}
      >
        Upload the aggregate (RUA) reports that receivers send you to see who sends mail as this domain and whether it aligns.
      </EmptyState>
    );
  }

  const { pass_rate, total_messages, disposition_breakdown, top_senders, report_count, date_range, policy } = summary;
  const dispositions = Object.entries(disposition_breakdown || {});
  const th = 'px-3 py-2 font-mono text-xs font-normal text-ink-2 border-b border-rule';

  return (
    <div className="space-y-5">
      <Fields>
        <Field name="Policy"><span className="font-mono">p={policy?.p || 'none'}</span></Field>
        <Field name="Reports">
          <span className="tabular-nums">{plural(report_count, 'report')}, {date_range?.earliest?.slice(0, 10)} to {date_range?.latest?.slice(0, 10)}</span>
        </Field>
        <Field name="Messages"><span className="tabular-nums">{total_messages?.toLocaleString()}</span></Field>
        <Field name="DKIM-Aligned"><span className="tabular-nums">{pass_rate?.dkim ?? 0}%</span></Field>
        <Field name="SPF-Aligned"><span className="tabular-nums">{pass_rate?.spf ?? 0}%</span></Field>
        <Field name="DMARC-Pass"><span className="tabular-nums">{pass_rate?.aligned ?? 0}%</span></Field>
        {dispositions.length > 0 && (
          <Field name="Disposition">
            <span className="flex flex-wrap gap-x-4">
              {dispositions.map(([key, val]) => (
                <span key={key} className="whitespace-nowrap"><span className="capitalize">{key}</span> <span className="tabular-nums">{val.toLocaleString()}</span></span>
              ))}
            </span>
          </Field>
        )}
      </Fields>

      {top_senders?.length > 0 && (
        <div className="relative overflow-x-auto rounded-md border border-rule">
          <table className="w-full text-sm border-collapse">
            <caption className="sr-only">Top senders</caption>
            <thead className="sticky top-0 bg-sunk">
              <tr className="text-left">
                <th scope="col" className={th}>Sender-IP</th>
                <th scope="col" className={`${th} text-right`}>Messages</th>
                <th scope="col" className={`${th} text-right`}>DKIM</th>
                <th scope="col" className={`${th} text-right`}>SPF</th>
              </tr>
            </thead>
            <tbody>
              {top_senders.slice(0, 10).map((sender) => (
                <tr key={sender.ip} className="border-b border-rule last:border-b-0 hover:bg-sunk/60">
                  <td className="px-3 py-2 font-mono text-[13px] text-ink whitespace-nowrap">
                    <span className="inline-flex items-center gap-2">{sender.ip} <CopyButton text={sender.ip} label="Copy IP" /></span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{sender.count.toLocaleString()}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${sender.dkim_rate >= 90 ? 'text-ink' : 'text-s5 font-semibold'}`}>{sender.dkim_rate}%</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${sender.spf_rate >= 90 ? 'text-ink' : 'text-s5 font-semibold'}`}>{sender.spf_rate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Link to="/dashboard/dmarc-reports" className={`inline-block text-sm ${linkClass}`}>View all reports</Link>
    </div>
  );
}

/* ---------- Activity & history ---------- */
function ProviderList({ rows }) {
  return (
    <ul className="rounded-md border border-rule">
      {rows.map(([provider, change]) => (
        <li key={`${provider}-${change}`} className="flex items-center justify-between gap-3 px-3 py-2 text-sm border-b border-rule last:border-b-0">
          <span className="font-mono text-[13px] text-ink break-all">{provider}</span>
          <span className="flex items-center gap-2.5 shrink-0">
            {change === 'new' && <span className="text-xs font-semibold text-s5">New</span>}
            {change === 'removed' && <span className="text-xs font-semibold text-s2">Removed</span>}
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
  if (events === null) return <LinesSkeleton label="Loading activity" />;
  return (
    <div className="max-w-3xl">
      <EventList events={events} showHostname={false} emptyText="No changes recorded for this asset yet. Listings, removals and expiry warnings appear here." />
    </div>
  );
}

/** One past check as a message-list row: when, reply class, and what changed since the check before it. */
function CheckSummary({ check, older }) {
  const ran = Boolean(check.total_providers);
  const code = !ran ? null : check.detected_count ? '5.x' : '2.x';
  let change = null;
  if (ran && older?.total_providers) {
    const delta = check.detected_count - older.detected_count;
    change = delta > 0 ? `${delta} more than before` : delta < 0 ? `${-delta} fewer than before` : 'no change';
  }
  return (
    <>
      <span className="flex items-baseline gap-2 text-xs">
        <span className="font-mono text-ink-2">{formatStamp(check.date)}</span>
        {code && <span className={`font-mono font-semibold ${TONES[code]}`} aria-hidden="true">{code}</span>}
      </span>
      <span className="block text-sm text-ink mt-0.5">
        {!ran ? <span className="text-ink-2">No blacklist check</span> : check.detected_count ? `Listed on ${check.detected_count} of ${check.total_providers}` : 'Not listed'}
        {change && <span className="text-ink-2">, {change}</span>}
      </span>
    </>
  );
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

  if (checks === null) return <LinesSkeleton count={5} label="Loading check history" />;
  if (checks.length === 0) {
    return <EmptyState title="No checks have run yet">Select Re-check to run the first one. Every check is kept here so you can compare it with the one before.</EmptyState>;
  }

  const diff = detail ? blacklistDiff(detail.previous?.result, detail.current.result) : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
      <div className="min-w-0">
        <h3 className="font-mono text-xs text-ink-2 mb-2">Checks, newest first</h3>
        <ul className="rounded-md border border-rule" aria-label="Past checks">
          {checks.map((check, index) => {
            const selected = check.id === selectedId;
            return (
              <li key={check.id} className="border-b border-rule last:border-b-0">
                <button
                  type="button"
                  aria-current={selected ? 'true' : undefined}
                  onClick={() => setSelectedId(check.id)}
                  className={`block w-full text-left px-3 py-2 transition-colors focus-visible:[outline-offset:-2px] ${
                    selected ? 'bg-accent-soft ring-1 ring-inset ring-accent/40' : 'hover:bg-sunk/60'
                  }`}
                >
                  <CheckSummary check={check} older={checks[index + 1]} />
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div aria-live="polite" className="min-w-0">
        {loadingDetail || !detail ? (
          <LinesSkeleton count={3} label="Loading check" />
        ) : (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-ink">
              Check from <span className="font-mono font-normal">{formatStamp(detail.current.date)}</span>
            </h3>
            <Fields>
              <Field name="Checks-Run">{checksRun(detail.current.result).join(', ') || 'Nothing'}</Field>
              <Field name="Compared-To">
                {detail.previous ? <span className="font-mono text-[13px]">{formatStamp(detail.previous.date)}</span> : 'Nothing, this is the first check'}
              </Field>
              <Field name="Blacklist">
                {!diff ? (
                  <span className="text-ink-2">Did not run or failed in this check</span>
                ) : (
                  <>
                    Listed on {diff.listed.length} of {diff.total}
                    {detail.previous && (diff.added.length || diff.removed.length
                      ? <>{diff.added.length > 0 && <span className="text-s5">, {diff.added.length} new</span>}{diff.removed.length > 0 && <span className="text-s2">, {diff.removed.length} removed</span>}</>
                      : <span className="text-ink-2">, no change</span>)}
                  </>
                )}
              </Field>
            </Fields>
            {diff && (detail.previous ? [...diff.added, ...diff.removed] : diff.listed).length > 0 && (
              <ProviderList rows={[
                ...(detail.previous ? diff.added : diff.listed).map((p) => [p, detail.previous ? 'new' : 'listed']),
                ...diff.removed.map((p) => [p, 'removed']),
              ]} />
            )}
            {diff && detail.previous && diff.kept.length > 0 && (
              <details>
                <summary className={`text-sm cursor-pointer ${linkClass}`}>
                  Still listed on {plural(diff.kept.length, 'blacklist')}
                </summary>
                <div className="mt-2"><ProviderList rows={diff.kept.map((p) => [p, 'listed'])} /></div>
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

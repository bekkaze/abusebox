import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  HiChevronDown, HiOutlineArrowDownTray, HiOutlineArrowPath, HiOutlineBell, HiOutlineMagnifyingGlass, HiOutlinePlus,
  HiOutlineRectangleStack, HiOutlineServerStack, HiOutlineSquares2X2, HiOutlineSquaresPlus, HiOutlineTableCells,
  HiOutlineTrash, HiXMark,
} from "react-icons/hi2";
import { toast } from "react-toastify";
import HostnameService from "../../services/hostname";
import { useAuth } from "../../services/auth/authProvider";
import AddNewMonitorDialog from "../../components/dashboard/blacklistMonitor/AddNewMonitorDialog";
import CidrImportDialog from "../../components/dashboard/blacklistMonitor/CidrImportDialog";
import BulkMonitorDialog from "../../components/dashboard/blacklistMonitor/BulkMonitorDialog";
import { SkeletonLine } from "../../components/shared/Skeleton";
import AutoRefresh from "../../components/shared/AutoRefresh";
import TimeAgo from "../../components/shared/TimeAgo";
import { SeverityBadge, SeverityCode } from "../../components/shared/activity";
import { SEVERITY_RANK } from "../../components/shared/severity";
import {
  Alert, EmptyState, PageHeader, linkClass, primaryButtonClass, secondaryButtonClass, selectClass, inputClass,
} from "../../components/shared/ui";
import { downloadCsv } from "../../services/tools";

const CHECK_BADGE_MAP = {
  check_blacklist: 'BL',
  check_abuseipdb: 'ABUSE',
  check_dns: 'DNS',
  check_ssl: 'SSL',
  check_whois: 'WHOIS',
  check_email_security: 'DMARC',
  check_server_status: 'UP',
};

const initialFormData = {
  hostname_type: "",
  hostname: "",
  description: "",
  is_alert_enabled: false,
  is_monitor_enabled: true,
  check_blacklist: true,
  check_abuseipdb: false,
  check_dns: false,
  check_ssl: false,
  check_whois: false,
  check_email_security: false,
  check_server_status: false,
  check_interval_minutes: null,
};

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'attention', label: 'Needs attention' },
  { key: 'listed', label: 'Listed' },
  { key: 'clean', label: 'Clean' },
];

const SORTS = [
  { key: 'status', label: 'Most urgent first' },
  { key: 'name', label: 'Name (A–Z)' },
  { key: 'checked', label: 'Recently checked' },
  { key: 'created', label: 'Recently added' },
];

const PAGE_SIZE = 60;
const FINDINGS_SHOWN = 3;

// Local control styles: a segmented group of standard h-9 buttons.
const segmentGroupClass = 'inline-flex h-9 max-w-full rounded-md border border-rule-strong bg-paper overflow-x-auto';
const segmentClass = (on, padding = 'px-3') =>
  `inline-flex items-center gap-1.5 ${padding} text-sm whitespace-nowrap transition-colors border-l border-rule-strong first:border-l-0 focus-visible:outline-offset-[-2px] disabled:opacity-50 disabled:cursor-not-allowed ` +
  (on ? 'bg-accent-soft text-accent font-semibold' : 'text-ink-2 hover:bg-sunk hover:text-ink');
const iconButtonClass =
  'relative z-10 inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-2 hover:text-s5 hover:bg-s5-soft transition-colors';
// Shared primitives carry fixed widths/paddings; these variants swap them rather than stack conflicting utilities.
const searchInputClass = inputClass.replace('px-3', 'pl-8 pr-3');
const sortSelectClass = selectClass.replace('w-full', 'w-auto');
const quietDangerButtonClass =
  'inline-flex items-center justify-center gap-2 h-9 px-3.5 rounded-md text-sm font-semibold whitespace-nowrap transition-colors ' +
  'text-s5 hover:bg-s5-soft disabled:opacity-50 disabled:cursor-not-allowed';
const clearButtonClass = 'inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-2 hover:text-ink hover:bg-sunk transition-colors';
const thBase = 'py-2 font-mono text-xs font-normal text-ink-2 border-b border-rule text-left whitespace-nowrap';

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

function readPref(key, fallback) {
  try { return localStorage.getItem(key) || fallback; } catch { return fallback; }
}

function writePref(key, value) {
  try { localStorage.setItem(key, value); } catch { /* storage unavailable */ }
}

function importSummary(result, verb) {
  const parts = [`${verb} ${plural(result.created, 'asset')}`];
  if (result.skipped > 0) parts.push(`${result.skipped} already existed`);
  return parts.join(', ');
}

function matchesFilter(item, key) {
  if (key === 'listed') return item.is_blacklisted;
  if (key === 'clean') return !item.is_blacklisted;
  if (key === 'attention') return (item.health?.issues || []).some((issue) => issue.severity !== 'info');
  return true;
}

/** One-line blacklist result, with the reply class it maps to (null when there is nothing to judge). */
function blacklistSummary(item) {
  const bl = item.health?.blacklist;
  if (!bl) {
    if (!item.check_blacklist) return { severity: null, text: 'Blacklist check off' };
    if (item.checked === 'Not checked') return { severity: null, text: 'Not checked yet' };
    return { severity: 'warning', text: 'Blacklist check failed' };
  }
  if (bl.listed_count > 0) return { severity: 'critical', text: `Listed on ${bl.listed_count} of ${bl.total} blacklists` };
  if (bl.inconclusive) return { severity: 'warning', text: `Inconclusive: ${bl.failed} blacklists did not answer` };
  return {
    severity: 'ok',
    text: bl.failed ? `Clear on ${bl.total - bl.failed} of ${bl.total}; ${bl.failed} did not answer` : `Clear on ${bl.total} blacklists`,
  };
}

/** The blacklist line first, then every other health issue, worst first (the API sorts them). */
function findingsFor(item) {
  const others = (item.health?.issues || [])
    .filter((issue) => issue.kind !== 'blacklist')
    .map((issue) => ({ severity: issue.severity, text: issue.message }));
  return [blacklistSummary(item), ...others];
}

/** Overall health as a reply class: a listing beats everything else. */
function healthOf(item) {
  if (item.is_blacklisted) return { severity: 'critical', label: 'Listed' };
  if (!item.health || item.checked === 'Not checked') return { severity: 'info', label: 'Not checked' };
  const status = item.health.status;
  if (status === 'critical') return { severity: 'critical', label: 'Critical' };
  if (status === 'warning') return { severity: 'warning', label: 'Warning' };
  if (status === 'info') return { severity: 'info', label: 'Info' };
  return { severity: 'ok', label: 'Healthy' };
}

function urgency(item) {
  if (item.is_blacklisted) return -1;
  return SEVERITY_RANK[item.health?.status] ?? 4;
}

function exportAssetsCsv(assets) {
  const rows = [
    ['Hostname', 'Type', 'Description', 'Listed', 'Listed on', 'Status', 'Issues', 'Monitored', 'Alerts', 'Interval (min)', 'Last checked'],
    ...assets.map((item) => [
      item.hostname,
      item.hostname_type,
      item.description || '',
      item.is_blacklisted ? 'Yes' : 'No',
      item.health?.blacklist?.listed?.join('; ') || '',
      item.health?.status || 'unchecked',
      (item.health?.issues || []).map((issue) => issue.message).join('; '),
      item.is_monitor_enabled ? 'Yes' : 'No',
      item.is_alert_enabled ? 'Yes' : 'No',
      item.check_interval_minutes || 'default',
      item.last_checked || '',
    ]),
  ];
  downloadCsv(rows, `abusebox-assets-${new Date().toISOString().slice(0, 10)}.csv`);
}

const typeLabel = (item) => (item.hostname_type === 'ipv4' ? 'IPv4' : 'Domain');

function HealthBadge({ item }) {
  const health = healthOf(item);
  return <SeverityBadge severity={health.severity} label={health.label} />;
}

/** Findings as reply-class lines; healthy lines stay quiet, problems read in full ink. */
function FindingList({ item, className = '' }) {
  const lines = findingsFor(item);
  const shown = lines.slice(0, FINDINGS_SHOWN);
  const more = lines.length - shown.length;
  return (
    <ul className={`space-y-0.5 ${className}`}>
      {shown.map((line) => {
        const quiet = !line.severity || line.severity === 'ok' || line.severity === 'info';
        return (
          <li key={line.text} className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-1.5">
            {line.severity ? <SeverityCode severity={line.severity} className="leading-5" /> : <span aria-hidden="true" />}
            <span className={`text-sm leading-5 ${quiet ? 'text-ink-2' : 'text-ink'}`}>{line.text}</span>
          </li>
        );
      })}
      {more > 0 && (
        <li className="pl-[2.125rem] text-xs text-ink-2">and {more} more</li>
      )}
    </ul>
  );
}

function CheckTags({ item }) {
  const enabled = Object.entries(CHECK_BADGE_MAP).filter(([key]) => item[key]).map(([, label]) => label);
  if (!enabled.length) return <span className="text-ink-2">None</span>;
  return (
    <ul className="flex flex-wrap gap-1" aria-label="Enabled checks">
      {enabled.map((label) => (
        <li key={label} className="rounded px-1 font-mono text-2xs leading-4 text-ink-2 ring-1 ring-inset ring-rule">{label}</li>
      ))}
    </ul>
  );
}

function LastChecked({ item }) {
  if (item.checked === 'Not checked' || !item.checked) return <span className="text-ink-2">Never</span>;
  return <TimeAgo date={item.checked} className="text-ink-2" />;
}

function SelectBox({ checked, onChange, label, indeterminate = false }) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      aria-label={label}
      ref={(el) => { if (el) el.indeterminate = indeterminate; }}
      className="relative z-10 h-4 w-4 align-middle rounded border-rule-strong accent-accent cursor-pointer"
    />
  );
}

function LoadingState({ view }) {
  if (view === 'table') {
    return (
      <div className="rounded-md border border-rule overflow-hidden" aria-busy="true" aria-label="Loading assets">
        <div className="h-9 bg-sunk border-b border-rule" />
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-3 py-3 border-b border-rule last:border-b-0">
            <SkeletonLine className="h-4 w-4" />
            <SkeletonLine className="h-4 w-48" />
            <SkeletonLine className="h-4 w-12" />
            <SkeletonLine className="h-5 w-20" />
            <SkeletonLine className="h-4 flex-1" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Loading assets">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="rounded-md border border-rule p-4 space-y-3">
          <SkeletonLine className="h-5 w-20" />
          <SkeletonLine className="h-4 w-2/3" />
          <SkeletonLine className="h-3 w-1/2" />
          <div className="flex gap-1 pt-3 border-t border-rule">
            <SkeletonLine className="h-4 w-8" />
            <SkeletonLine className="h-4 w-10" />
            <SkeletonLine className="h-4 w-8" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Assets() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [cidrModalOpen, setCidrModalOpen] = useState(false);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [search, setSearch] = useState("");
  const [view, setView] = useState(() => readPref('abusebox.assets.view', 'table'));
  const [sort, setSort] = useState(() => readPref('abusebox.assets.sort', 'status'));
  const [selected, setSelected] = useState(() => new Set());
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [bulkBusy, setBulkBusy] = useState(false);
  const { token } = useAuth();
  const [formData, setFormData] = useState({ ...initialFormData });
  const [assets, setAssets] = useState([]);
  const hostnameService = HostnameService();

  const filterStatus = FILTERS.some((f) => f.key === searchParams.get('filter')) ? searchParams.get('filter') : 'all';
  const setFilterStatus = (key) => {
    const next = new URLSearchParams(searchParams);
    if (key === 'all') next.delete('filter'); else next.set('filter', key);
    setSearchParams(next, { replace: true });
  };

  const fetchAssets = useCallback(async ({ quiet = false } = {}) => {
    // Background refreshes keep the current rows on screen instead of
    // flashing skeletons.
    if (quiet) setRefreshing(true); else setIsLoading(true);
    setErrorMessage("");
    try {
      const list = await HostnameService().listHostname(false);
      setAssets(list);
      setSelected((prev) => new Set([...prev].filter((id) => list.some((item) => item.id === id))));
    } catch {
      setErrorMessage("Could not load assets. Check your connection and try again.");
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { if (token) fetchAssets(); }, [token, fetchAssets]);
  const refresh = useCallback(() => fetchAssets({ quiet: true }), [fetchAssets]);
  useEffect(() => { setVisible(PAGE_SIZE); }, [search, filterStatus, sort]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await hostnameService.createHostname({ ...formData, hostname: formData.hostname.trim(), description: formData.description || null });
      toast.success(`Added ${formData.hostname.trim()}`);
      setFormData({ ...initialFormData });
      setAddModalOpen(false);
      refresh();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Could not add the asset. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id, hostname) => {
    if (!window.confirm(`Delete ${hostname} and its check history?`)) return;
    try {
      await hostnameService.deleteHostname(id);
      toast.success(`Deleted ${hostname}`);
      setAssets((prev) => prev.filter((item) => item.id !== id));
      setSelected((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch {
      toast.error('Could not delete the asset.');
    }
  };

  const handleCidrImport = async (cidrData) => {
    try {
      const result = await hostnameService.importCidr(cidrData);
      toast.success(`${importSummary(result, 'Imported')}. They are checked on the next scheduler run.`);
      if (result.errors?.length > 0) toast.warn(`${plural(result.errors.length, 'address')} could not be imported`);
      setCidrModalOpen(false);
      refresh();
      return result;
    } catch (error) {
      toast.error(error.response?.data?.detail || "Could not import the CIDR range.");
      throw error;
    }
  };

  const handleBulkImport = async (hostnames) => {
    try {
      const result = await hostnameService.createBulk(hostnames);
      toast.success(`${importSummary(result, 'Added')}. They are checked on the next scheduler run.`);
      if (result.errors?.length > 0) toast.warn(`${plural(result.errors.length, 'target')} could not be added`);
      setBulkModalOpen(false);
      refresh();
      return result;
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not add the list.');
      throw error;
    }
  };

  const filterCounts = useMemo(
    () => Object.fromEntries(FILTERS.map((f) => [f.key, assets.filter((item) => matchesFilter(item, f.key)).length])),
    [assets],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const matches = assets.filter((item) => {
      const matchSearch = !query
        || item.hostname.toLowerCase().includes(query)
        || item.hostname_type.toLowerCase().includes(query)
        || (item.description || '').toLowerCase().includes(query);
      return matchSearch && matchesFilter(item, filterStatus);
    });
    const sorters = {
      status: (a, b) => urgency(a) - urgency(b) || a.hostname.localeCompare(b.hostname),
      name: (a, b) => a.hostname.localeCompare(b.hostname, undefined, { numeric: true }),
      checked: (a, b) => String(b.last_checked || '').localeCompare(String(a.last_checked || '')),
      created: (a, b) => String(b.created).localeCompare(String(a.created)),
    };
    return [...matches].sort(sorters[sort] || sorters.status);
  }, [assets, search, filterStatus, sort]);

  const shown = filtered.slice(0, visible);
  const listedCount = filterCounts.listed || 0;
  const allShownSelected = shown.length > 0 && shown.every((item) => selected.has(item.id));
  const someShownSelected = !allShownSelected && shown.some((item) => selected.has(item.id));

  const toggle = (id) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleAllShown = () => setSelected((prev) => {
    const next = new Set(prev);
    shown.forEach((item) => (allShownSelected ? next.delete(item.id) : next.add(item.id)));
    return next;
  });

  const runBulk = async (action) => {
    const ids = [...selected];
    if (!ids.length) return;
    if (action === 'delete' && !window.confirm(`Delete ${plural(ids.length, 'asset')} and their check history?`)) return;
    setBulkBusy(true);
    try {
      const result = await hostnameService.bulkAction(ids, action);
      const messages = {
        recheck: `Re-checking ${plural(result.queued, 'asset')} in the background`,
        delete: `Deleted ${plural(result.affected, 'asset')}`,
        enable_monitoring: `Monitoring on for ${plural(result.affected, 'asset')}`,
        disable_monitoring: `Monitoring off for ${plural(result.affected, 'asset')}`,
        enable_alerts: `Alerts on for ${plural(result.affected, 'asset')}`,
        disable_alerts: `Alerts off for ${plural(result.affected, 'asset')}`,
      };
      toast.success(messages[action]);
      if (action === 'delete') setSelected(new Set());
      refresh();
      if (action === 'recheck') setTimeout(refresh, 15000);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'The bulk action failed.');
    } finally {
      setBulkBusy(false);
    }
  };

  const chooseView = (value) => { setView(value); writePref('abusebox.assets.view', value); };
  const chooseSort = (value) => { setSort(value); writePref('abusebox.assets.sort', value); };
  const clearFilters = () => { setSearch(''); setFilterStatus('all'); };

  return (
    <section className="space-y-4">
      <PageHeader
        title="Assets"
        description={assets.length
          ? `${plural(assets.length, 'asset')} tracked${listedCount ? `, ${listedCount} currently listed` : ''}.`
          : 'Domains and IPs you want checked on a schedule.'}
        actions={(
          <>
            <AutoRefresh onRefresh={refresh} loading={refreshing || isLoading} />
            <button type="button" className={secondaryButtonClass} onClick={() => setCidrModalOpen(true)}>
              <HiOutlineSquaresPlus className="text-base text-ink-2" aria-hidden="true" /> Import CIDR
            </button>
            <button type="button" className={secondaryButtonClass} onClick={() => setBulkModalOpen(true)}>
              <HiOutlineRectangleStack className="text-base text-ink-2" aria-hidden="true" /> Add list
            </button>
            <button type="button" className={primaryButtonClass} onClick={() => setAddModalOpen(true)}>
              <HiOutlinePlus className="text-base" aria-hidden="true" /> Add asset
            </button>
          </>
        )}
      />

      {assets.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[min(100%,16rem)]">
            <label htmlFor="asset-search" className="sr-only">Search assets</label>
            <HiOutlineMagnifyingGlass className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-base text-ink-2" aria-hidden="true" />
            <input
              id="asset-search"
              type="search"
              placeholder="Search hostname, type or description"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={searchInputClass}
            />
          </div>
          <div role="group" aria-label="Filter assets" className={segmentGroupClass}>
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilterStatus(f.key)}
                aria-pressed={filterStatus === f.key}
                className={segmentClass(filterStatus === f.key)}
              >
                {f.label}
                <span className="font-mono text-xs font-normal tabular-nums opacity-80">{filterCounts[f.key]}</span>
              </button>
            ))}
          </div>
          <label htmlFor="asset-sort" className="sr-only">Sort assets</label>
          <select id="asset-sort" value={sort} onChange={(e) => chooseSort(e.target.value)} className={sortSelectClass}>
            {SORTS.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
          </select>
          <div role="group" aria-label="Layout" className={segmentGroupClass}>
            {[['table', HiOutlineTableCells, 'Table view'], ['cards', HiOutlineSquares2X2, 'Card view']].map(([key, Icon, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={view === key}
                aria-label={label}
                title={label}
                onClick={() => chooseView(key)}
                className={segmentClass(view === key, 'px-2.5')}
              >
                <Icon className="text-base" aria-hidden="true" />
              </button>
            ))}
          </div>
          <button type="button" className={secondaryButtonClass} onClick={() => exportAssetsCsv(filtered)} title="Export the assets shown as CSV">
            <HiOutlineArrowDownTray className="text-base text-ink-2" aria-hidden="true" /> CSV
          </button>
        </div>
      )}

      {isLoading ? (
        <LoadingState view={view} />
      ) : errorMessage ? (
        <Alert tone="error">
          {errorMessage}{' '}
          <button type="button" className="font-medium underline" onClick={() => fetchAssets()}>Retry</button>
        </Alert>
      ) : assets.length === 0 ? (
        <EmptyState
          icon={HiOutlineServerStack}
          title="No assets yet"
          action={(
            <div className="space-y-3">
              <button type="button" className={primaryButtonClass} onClick={() => setAddModalOpen(true)}>
                <HiOutlinePlus className="text-base" aria-hidden="true" /> Add your first asset
              </button>
              <p className="text-sm text-ink-2">
                Watching many? <button type="button" className={linkClass} onClick={() => setBulkModalOpen(true)}>Paste a list</button> of
                up to 300 domains and IPs, or <button type="button" className={linkClass} onClick={() => setCidrModalOpen(true)}>import a CIDR range</button> up
                to /24.
              </p>
            </div>
          )}
        >
          Add a mail server IP or a domain you own. AbuseBox checks it against 24 blacklists right away, then again on a schedule, and alerts you when something changes.
        </EmptyState>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={HiOutlineMagnifyingGlass}
          title="No matching assets"
          action={<button type="button" className={secondaryButtonClass} onClick={clearFilters}>Clear search and filter</button>}
        >
          {filterStatus === 'attention' && !search.trim() ? 'Nothing needs attention right now.' : 'No asset matches this search and filter.'}
        </EmptyState>
      ) : (
        <>
          <div
            className={`flex flex-wrap items-center gap-2 min-h-9 text-sm text-ink-2 ${selected.size ? 'sticky top-14 z-20 -mx-2 px-2 py-2 bg-paper border-b border-rule' : ''}`}
          >
            {view === 'cards' && (
              <label className="inline-flex items-center gap-2 mr-2 cursor-pointer">
                <SelectBox checked={allShownSelected} indeterminate={someShownSelected} onChange={toggleAllShown} label="Select all shown assets" />
                Select all
              </label>
            )}
            {selected.size > 0 ? (
              <div role="region" aria-label="Bulk actions" className="flex flex-1 flex-wrap items-center gap-2">
                <span className="font-semibold text-ink mr-auto" aria-live="polite">{selected.size} selected</span>
                <button type="button" disabled={bulkBusy} onClick={() => runBulk('recheck')} className={secondaryButtonClass}>
                  <HiOutlineArrowPath className="text-base text-ink-2" aria-hidden="true" /> Re-check
                </button>
                <BulkToggle label="Monitoring" disabled={bulkBusy} onOn={() => runBulk('enable_monitoring')} onOff={() => runBulk('disable_monitoring')} />
                <BulkToggle label="Alerts" icon={HiOutlineBell} disabled={bulkBusy} onOn={() => runBulk('enable_alerts')} onOff={() => runBulk('disable_alerts')} />
                <button type="button" disabled={bulkBusy} onClick={() => runBulk('delete')} className={quietDangerButtonClass}>
                  <HiOutlineTrash className="text-base" aria-hidden="true" /> Delete
                </button>
                <button type="button" onClick={() => setSelected(new Set())} className={clearButtonClass} aria-label="Clear selection" title="Clear selection">
                  <HiXMark className="text-base" aria-hidden="true" />
                </button>
              </div>
            ) : (
              <span aria-live="polite">Showing {shown.length} of {plural(filtered.length, 'asset')}</span>
            )}
          </div>

          {view === 'table' ? (
            <AssetTable
              items={shown}
              selected={selected}
              onToggle={toggle}
              onDelete={handleDelete}
              allSelected={allShownSelected}
              someSelected={someShownSelected}
              onToggleAll={toggleAllShown}
              sort={sort}
              onSort={chooseSort}
            />
          ) : (
            <ul className="grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
              {shown.map((item) => (
                <AssetCard key={item.id} item={item} selected={selected.has(item.id)} onToggle={() => toggle(item.id)} onDelete={() => handleDelete(item.id, item.hostname)} />
              ))}
            </ul>
          )}

          {filtered.length > shown.length && (
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className={secondaryButtonClass} onClick={() => setVisible((v) => v + PAGE_SIZE)}>
                Show {Math.min(PAGE_SIZE, filtered.length - shown.length)} more
              </button>
              <span className="text-sm text-ink-2">{filtered.length - shown.length} not shown</span>
            </div>
          )}
        </>
      )}

      <AddNewMonitorDialog
        formData={formData}
        handleInputChange={handleInputChange}
        handleSubmit={handleSubmit}
        isOpen={addModalOpen}
        setIsOpen={setAddModalOpen}
        submitting={submitting}
      />
      <CidrImportDialog isOpen={cidrModalOpen} setIsOpen={setCidrModalOpen} onImport={handleCidrImport} />
      <BulkMonitorDialog isOpen={bulkModalOpen} setIsOpen={setBulkModalOpen} onImport={handleBulkImport} />
    </section>
  );
}

function BulkToggle({ label, icon: Icon, onOn, onOff, disabled }) {
  return (
    <div className="inline-flex h-9 rounded-md border border-rule-strong bg-paper overflow-hidden" role="group" aria-label={label}>
      <span className="inline-flex items-center gap-1.5 px-2.5 text-sm text-ink-2 bg-sunk">
        {Icon && <Icon className="text-base" aria-hidden="true" />}{label}
      </span>
      <button type="button" disabled={disabled} onClick={onOn} className={segmentClass(false)}>On</button>
      <button type="button" disabled={disabled} onClick={onOff} className={segmentClass(false)}>Off</button>
    </div>
  );
}

function AssetCard({ item, selected, onToggle, onDelete }) {
  const meta = [typeLabel(item), item.is_monitor_enabled ? 'Monitored' : 'Not monitored', item.is_alert_enabled && 'Alerts on'].filter(Boolean);
  return (
    <li
      className={`relative flex flex-col rounded-md border p-4 transition-colors focus-within:border-accent ${selected ? 'bg-accent-soft border-accent/40' : 'bg-paper border-rule hover:border-rule-strong'}`}
    >
      <div className="flex items-center justify-between gap-3">
        <HealthBadge item={item} />
        <div className="flex items-center gap-1 -my-1 -mr-1.5">
          <SelectBox checked={selected} onChange={onToggle} label={`Select ${item.hostname}`} />
          <button type="button" onClick={onDelete} className={iconButtonClass} aria-label={`Delete ${item.hostname}`} title="Delete">
            <HiOutlineTrash className="text-base" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* The link's ::after covers the card so the whole card is clickable. */}
      <Link
        to={`/dashboard/assets/${item.id}`}
        className="mt-2 block font-mono text-[15px] font-semibold text-ink truncate hover:text-accent after:absolute after:inset-0 after:rounded-md focus:outline-none"
        title={item.hostname}
      >
        {item.hostname}
      </Link>
      <p className="mt-0.5 text-xs text-ink-2">{meta.join(' · ')}</p>
      {item.description && (
        <p className="mt-1.5 text-sm text-ink-2 truncate" title={item.description}>{item.description}</p>
      )}

      <FindingList item={item} className="mt-3 mb-3" />

      <div className="mt-auto flex items-center justify-between gap-2 pt-3 border-t border-rule">
        <CheckTags item={item} />
        <span className="flex-shrink-0 text-xs"><LastChecked item={item} /></span>
      </div>
    </li>
  );
}

const SORTABLE = { name: 'Asset', status: 'Health', checked: 'Last-Checked' };
const ARIA_SORT = { name: 'ascending', status: 'other', checked: 'descending' };

function SortHeader({ sortKey, sort, onSort, className = '' }) {
  const active = sort === sortKey;
  return (
    <th scope="col" className={`${thBase} px-3 ${className}`} aria-sort={active ? ARIA_SORT[sortKey] : undefined}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 hover:text-ink ${active ? 'text-ink' : ''}`}
        title={`Sort by ${SORTABLE[sortKey].toLowerCase()}`}
      >
        {SORTABLE[sortKey]}
        <HiChevronDown className={`text-xs ${active ? '' : 'invisible'}`} aria-hidden="true" />
      </button>
    </th>
  );
}

function AssetTable({ items, selected, onToggle, onDelete, allSelected, someSelected, onToggleAll, sort, onSort }) {
  return (
    <div className="relative overflow-x-auto rounded-md border border-rule">
      <table className="w-full min-w-[60rem] text-sm border-collapse">
        <thead className="bg-sunk">
          <tr>
            <th scope="col" className={`${thBase} w-9 pl-3 pr-1`}>
              <SelectBox checked={allSelected} indeterminate={someSelected} onChange={onToggleAll} label="Select all shown assets" />
            </th>
            <SortHeader sortKey="name" sort={sort} onSort={onSort} />
            <th scope="col" className={`${thBase} px-3`}>Type</th>
            <SortHeader sortKey="status" sort={sort} onSort={onSort} />
            <th scope="col" className={`${thBase} px-3 w-full`}>Findings</th>
            <SortHeader sortKey="checked" sort={sort} onSort={onSort} />
            <th scope="col" className={`${thBase} px-3`}>Checks</th>
            <th scope="col" className={`${thBase} px-3`}>Monitor</th>
            <th scope="col" className={`${thBase} px-3`}><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const isSelected = selected.has(item.id);
            return (
              <tr key={item.id} className={`border-b border-rule last:border-b-0 align-top ${isSelected ? 'bg-accent-soft' : 'hover:bg-sunk/60'}`}>
                <td className="pl-3 pr-1 py-2.5">
                  <SelectBox checked={isSelected} onChange={() => onToggle(item.id)} label={`Select ${item.hostname}`} />
                </td>
                <td className="px-3 py-2 min-w-[12rem] max-w-[18rem]">
                  <Link to={`/dashboard/assets/${item.id}`} className="font-mono text-[13px] font-semibold leading-5 text-ink hover:text-accent break-all">
                    {item.hostname}
                  </Link>
                  {item.description && <p className="text-xs text-ink-2 mt-0.5 truncate" title={item.description}>{item.description}</p>}
                </td>
                <td className="px-3 py-2 leading-5 text-ink-2 whitespace-nowrap">{typeLabel(item)}</td>
                <td className="px-3 py-2 whitespace-nowrap"><HealthBadge item={item} /></td>
                <td className="px-3 py-2 min-w-[16rem]"><FindingList item={item} /></td>
                <td className="px-3 py-2 leading-5 whitespace-nowrap"><LastChecked item={item} /></td>
                <td className="px-3 py-2.5 min-w-[7rem]"><CheckTags item={item} /></td>
                <td className="px-3 py-2 leading-5 whitespace-nowrap text-ink-2">
                  {item.is_monitor_enabled ? 'On' : 'Off'}{item.is_alert_enabled ? ' · alerts' : ''}
                </td>
                <td className="px-2 py-1 text-right">
                  <button type="button" onClick={() => onDelete(item.id, item.hostname)} className={iconButtonClass} aria-label={`Delete ${item.hostname}`} title="Delete">
                    <HiOutlineTrash className="text-base" aria-hidden="true" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

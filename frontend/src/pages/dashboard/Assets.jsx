import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  HiBell, HiCollection, HiDownload, HiExclamation, HiExclamationCircle, HiOutlinePlusCircle, HiRefresh, HiSearch, HiShieldCheck, HiShieldExclamation,
  HiTrash, HiViewGrid, HiViewGridAdd, HiViewList, HiX,
} from "react-icons/hi";
import { toast } from "react-toastify";
import HostnameService from "../../services/hostname";
import { useAuth } from "../../services/auth/authProvider";
import AddNewMonitorDialog from "../../components/dashboard/blacklistMonitor/AddNewMonitorDialog";
import CidrImportDialog from "../../components/dashboard/blacklistMonitor/CidrImportDialog";
import BulkMonitorDialog from "../../components/dashboard/blacklistMonitor/BulkMonitorDialog";
import { AssetCardSkeleton } from "../../components/shared/Skeleton";
import AutoRefresh from "../../components/shared/AutoRefresh";
import TimeAgo from "../../components/shared/TimeAgo";
import { SEVERITY, SEVERITY_RANK } from "../../components/shared/severity";
import { Alert, EmptyState, PageHeader, cardClass, primaryButtonClass, secondaryButtonClass } from "../../components/shared/ui";
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

/** One-line blacklist status for a card or row. */
function blacklistSummary(item) {
  const bl = item.health?.blacklist;
  if (!bl) {
    if (!item.check_blacklist) return { text: 'Blacklist check off', className: 'text-slate-500 dark:text-slate-400' };
    if (item.checked === 'Not checked') return { text: 'Not checked yet', className: 'text-slate-500 dark:text-slate-400' };
    return { text: 'Blacklist check failed', className: 'text-amber-700 dark:text-amber-400' };
  }
  if (bl.listed_count > 0) return { text: `Listed on ${bl.listed_count} of ${bl.total}`, className: 'text-rose-700 dark:text-rose-400' };
  if (bl.inconclusive) return { text: `Inconclusive: ${bl.failed} providers did not answer`, className: 'text-amber-700 dark:text-amber-400' };
  return {
    text: bl.failed ? `Clear on ${bl.total - bl.failed} of ${bl.total} providers` : `Clear on ${bl.total} providers`,
    className: 'text-emerald-700 dark:text-emerald-400',
  };
}

/** Most important non-blacklist issue, shown under the blacklist line. */
function otherIssue(item) {
  return (item.health?.issues || []).find((issue) => issue.kind !== 'blacklist');
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

/** Overall state: listed beats other critical issues, then warnings, then healthy. */
function assetState(item) {
  if (item.is_blacklisted) return { icon: HiShieldExclamation, label: 'Listed', tone: 'rose' };
  if (item.health?.status === 'critical') return { icon: HiExclamationCircle, label: 'Critical issue', tone: 'rose' };
  if (item.health?.status === 'warning') return { icon: HiExclamation, label: 'Warning', tone: 'amber' };
  return { icon: HiShieldCheck, label: 'Healthy', tone: 'emerald' };
}

const STATE_TONES = {
  rose: { box: 'bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400', text: 'text-rose-600 dark:text-rose-400' },
  amber: { box: 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400', text: 'text-amber-600 dark:text-amber-400' },
  emerald: { box: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400', text: 'text-emerald-600 dark:text-emerald-400' },
};

function StatusIcon({ item, compact = false }) {
  const state = assetState(item);
  const Icon = state.icon;
  if (compact) return <Icon className={`flex-shrink-0 ${STATE_TONES[state.tone].text}`} role="img" aria-label={state.label} />;
  return (
    <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${STATE_TONES[state.tone].box}`}>
      <Icon className="text-xl" role="img" aria-label={state.label} />
    </div>
  );
}

function SelectBox({ checked, onChange, label }) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      aria-label={label}
      className="relative z-10 h-4 w-4 rounded border-slate-300 accent-cyan-600 cursor-pointer"
    />
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
  const [view, setView] = useState(() => readPref('abusebox.assets.view', 'cards'));
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
    // Background refreshes keep the current cards on screen instead of
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

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const matches = assets.filter((item) => {
      const matchSearch = !query
        || item.hostname.toLowerCase().includes(query)
        || item.hostname_type.toLowerCase().includes(query)
        || (item.description || '').toLowerCase().includes(query);
      if (!matchSearch) return false;
      if (filterStatus === 'listed') return item.is_blacklisted;
      if (filterStatus === 'clean') return !item.is_blacklisted;
      if (filterStatus === 'attention') return (item.health?.issues || []).some((issue) => issue.severity !== 'info');
      return true;
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
  const listedCount = assets.filter((item) => item.is_blacklisted).length;
  const allShownSelected = shown.length > 0 && shown.every((item) => selected.has(item.id));

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

  return (
    <section className={`space-y-5 ${selected.size ? 'pb-24' : ''}`}>
      <PageHeader
        eyebrow="Monitor"
        title="Assets"
        description={assets.length
          ? `${plural(assets.length, 'asset')} tracked${listedCount ? `, ${listedCount} currently listed` : ''}.`
          : 'Domains and IPs you want checked on a schedule.'}
        actions={(
          <>
            <AutoRefresh onRefresh={refresh} loading={refreshing || isLoading} />
            <button type="button" className={secondaryButtonClass} onClick={() => setCidrModalOpen(true)}>
              <HiViewGridAdd className="text-lg" aria-hidden="true" /> CIDR import
            </button>
            <button type="button" className={secondaryButtonClass} onClick={() => setBulkModalOpen(true)}>
              <HiCollection className="text-lg" aria-hidden="true" /> Bulk list
            </button>
            <button type="button" className={primaryButtonClass} onClick={() => setAddModalOpen(true)}>
              <HiOutlinePlusCircle className="text-lg" aria-hidden="true" /> Add asset
            </button>
          </>
        )}
      />

      {assets.length > 0 && (
        <div className="flex flex-col xl:flex-row gap-3">
          <div className="relative flex-1">
            <label htmlFor="asset-search" className="sr-only">Search assets</label>
            <HiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              id="asset-search"
              type="search"
              placeholder="Search by hostname, type or description"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-11 pl-9 pr-4 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div role="group" aria-label="Filter assets" className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1 border border-slate-200 dark:border-slate-700">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilterStatus(f.key)}
                  aria-pressed={filterStatus === f.key}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${filterStatus === f.key ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <label htmlFor="asset-sort" className="sr-only">Sort assets</label>
            <select
              id="asset-sort"
              value={sort}
              onChange={(e) => chooseSort(e.target.value)}
              className="h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              {SORTS.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
            </select>
            <div role="group" aria-label="Layout" className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1 border border-slate-200 dark:border-slate-700">
              {[['cards', HiViewGrid, 'Card view'], ['table', HiViewList, 'Table view']].map(([key, Icon, label]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={view === key}
                  aria-label={label}
                  title={label}
                  onClick={() => chooseView(key)}
                  className={`p-2 rounded-md transition-colors ${view === key ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
                >
                  <Icon aria-hidden="true" />
                </button>
              ))}
            </div>
            <button type="button" className={secondaryButtonClass} onClick={() => exportAssetsCsv(filtered)} title="Export the assets shown as CSV">
              <HiDownload aria-hidden="true" /> CSV
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Loading assets">
          {[...Array(6)].map((_, i) => <AssetCardSkeleton key={i} />)}
        </div>
      ) : errorMessage ? (
        <Alert tone="error">
          {errorMessage}{' '}
          <button type="button" className="font-medium underline" onClick={() => fetchAssets()}>Retry</button>
        </Alert>
      ) : assets.length === 0 ? (
        <div className={cardClass}>
          <EmptyState
            icon={HiShieldCheck}
            title="No assets yet"
            action={<button type="button" className={primaryButtonClass} onClick={() => setAddModalOpen(true)}>Add your first asset</button>}
          >
            Add a mail server IP or a domain. AbuseBox checks it against 60 blacklists now, then again on a schedule, and alerts you when something changes.
          </EmptyState>
        </div>
      ) : filtered.length === 0 ? (
        <div className={cardClass}>
          <EmptyState icon={HiSearch} title="No matching assets">
            {filterStatus === 'attention' ? 'Nothing needs attention right now.' : 'Try a different search or filter.'}
          </EmptyState>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <SelectBox checked={allShownSelected} onChange={toggleAllShown} label="Select all shown assets" />
              Select all
            </label>
            <span aria-live="polite">
              Showing {shown.length} of {plural(filtered.length, 'asset')}
            </span>
          </div>

          {view === 'table' ? (
            <AssetTable items={shown} selected={selected} onToggle={toggle} />
          ) : (
            <ul className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
              {shown.map((item) => (
                <AssetCard key={item.id} item={item} selected={selected.has(item.id)} onToggle={() => toggle(item.id)} onDelete={() => handleDelete(item.id, item.hostname)} />
              ))}
            </ul>
          )}

          {filtered.length > shown.length && (
            <div className="text-center">
              <button type="button" className={secondaryButtonClass} onClick={() => setVisible((v) => v + PAGE_SIZE)}>
                Show {Math.min(PAGE_SIZE, filtered.length - shown.length)} more
              </button>
            </div>
          )}
        </>
      )}

      {selected.size > 0 && (
        <div role="region" aria-label="Bulk actions" className="fixed bottom-4 left-1/2 -translate-x-1/2 lg:left-[calc(50%+8rem)] z-40 w-[calc(100%-2rem)] max-w-3xl">
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 shadow-xl">
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 mr-auto">{selected.size} selected</span>
            <button type="button" disabled={bulkBusy} onClick={() => runBulk('recheck')} className={secondaryButtonClass}><HiRefresh aria-hidden="true" /> Re-check</button>
            <BulkToggle label="Monitoring" disabled={bulkBusy} onOn={() => runBulk('enable_monitoring')} onOff={() => runBulk('disable_monitoring')} />
            <BulkToggle label="Alerts" icon={HiBell} disabled={bulkBusy} onOn={() => runBulk('enable_alerts')} onOff={() => runBulk('disable_alerts')} />
            <button type="button" disabled={bulkBusy} onClick={() => runBulk('delete')} className="inline-flex items-center gap-2 h-11 px-4 rounded-lg text-sm font-medium text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-900/30 disabled:opacity-50">
              <HiTrash aria-hidden="true" /> Delete
            </button>
            <button type="button" onClick={() => setSelected(new Set())} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700" aria-label="Clear selection">
              <HiX aria-hidden="true" />
            </button>
          </div>
        </div>
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
    <div className="inline-flex h-11 rounded-lg border border-slate-200 dark:border-slate-600 overflow-hidden" role="group" aria-label={label}>
      <span className="inline-flex items-center gap-1.5 px-3 text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-700/60">
        {Icon && <Icon aria-hidden="true" />}{label}
      </span>
      <button type="button" disabled={disabled} onClick={onOn} className="px-3 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50">On</button>
      <button type="button" disabled={disabled} onClick={onOff} className="px-3 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 border-l border-slate-200 dark:border-slate-600 disabled:opacity-50">Off</button>
    </div>
  );
}

function AssetCard({ item, selected, onToggle, onDelete }) {
  const summary = blacklistSummary(item);
  const issue = otherIssue(item);
  const enabledChecks = Object.entries(CHECK_BADGE_MAP).filter(([key]) => item[key]).map(([, label]) => label);
  return (
    <li className={`relative bg-white dark:bg-slate-800 border rounded-xl p-5 shadow-sm hover:shadow-md transition-all focus-within:border-cyan-400 ${selected ? 'border-cyan-500 ring-1 ring-cyan-500' : 'border-slate-200 dark:border-slate-700 hover:border-cyan-300 dark:hover:border-cyan-700'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <StatusIcon item={item} />
          <div className="min-w-0">
            {/* The link's ::after covers the card so the whole card is clickable. */}
            <Link
              to={`/dashboard/assets/${item.id}`}
              className="block text-base font-semibold text-slate-900 dark:text-white truncate after:absolute after:inset-0 after:rounded-xl focus:outline-none"
              title={item.hostname}
            >
              {item.hostname}
            </Link>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              <span>{item.hostname_type === 'ipv4' ? 'IPv4' : 'Domain'}</span>
              {item.is_monitor_enabled && <><span aria-hidden="true">&middot;</span><span>Monitored</span></>}
              {item.is_alert_enabled && <><span aria-hidden="true">&middot;</span><span>Alerts</span></>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <SelectBox checked={selected} onChange={onToggle} label={`Select ${item.hostname}`} />
          <button
            type="button"
            onClick={onDelete}
            className="relative z-10 p-2 -m-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors"
            aria-label={`Delete ${item.hostname}`}
            title="Delete"
          >
            <HiTrash aria-hidden="true" />
          </button>
        </div>
      </div>

      {item.description && (
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 truncate" title={item.description}>{item.description}</p>
      )}

      <p className={`mt-4 text-sm font-semibold ${summary.className}`}>{summary.text}</p>
      {issue && (
        <p className={`mt-1 text-sm ${SEVERITY[issue.severity]?.text || ''}`}>{issue.message}</p>
      )}

      <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
        <div className="flex flex-wrap gap-1" aria-label="Enabled checks">
          {enabledChecks.map((label) => (
            <span key={label} className="inline-flex rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 text-[11px] font-semibold">{label}</span>
          ))}
        </div>
        <TimeAgo date={item.checked} className="text-xs text-slate-500 dark:text-slate-400 flex-shrink-0" />
      </div>
    </li>
  );
}

function AssetTable({ items, selected, onToggle }) {
  return (
    <div className={`${cardClass} overflow-x-auto`}>
      <table className="w-full min-w-[760px] text-sm text-slate-700 dark:text-slate-300">
        <thead className="bg-slate-50 dark:bg-slate-700/60 text-left">
          <tr>
            <th scope="col" className="w-10 px-4 py-3"><span className="sr-only">Select</span></th>
            <th scope="col" className="px-3 py-3 text-xs font-medium text-slate-500 dark:text-slate-400">Asset</th>
            <th scope="col" className="px-3 py-3 text-xs font-medium text-slate-500 dark:text-slate-400">Blacklists</th>
            <th scope="col" className="px-3 py-3 text-xs font-medium text-slate-500 dark:text-slate-400">Other issues</th>
            <th scope="col" className="px-3 py-3 text-xs font-medium text-slate-500 dark:text-slate-400">Monitoring</th>
            <th scope="col" className="px-3 py-3 text-xs font-medium text-slate-500 dark:text-slate-400">Last checked</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
          {items.map((item) => {
            const summary = blacklistSummary(item);
            const issues = (item.health?.issues || []).filter((issue) => issue.kind !== 'blacklist');
            return (
              <tr key={item.id} className={selected.has(item.id) ? 'bg-cyan-50/60 dark:bg-cyan-900/20' : 'hover:bg-slate-50/60 dark:hover:bg-slate-700/30'}>
                <td className="px-4 py-3"><SelectBox checked={selected.has(item.id)} onChange={() => onToggle(item.id)} label={`Select ${item.hostname}`} /></td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <StatusIcon item={item} compact />
                    <Link to={`/dashboard/assets/${item.id}`} className="font-semibold text-slate-900 dark:text-white hover:text-cyan-700 dark:hover:text-cyan-400 break-all">{item.hostname}</Link>
                  </div>
                  {item.description && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate max-w-xs">{item.description}</p>}
                </td>
                <td className={`px-3 py-3 font-medium ${summary.className}`}>{summary.text}</td>
                <td className="px-3 py-3">
                  {issues.length ? (
                    <ul className="space-y-0.5">
                      {issues.slice(0, 2).map((issue) => (
                        <li key={issue.message} className={SEVERITY[issue.severity]?.text}>{issue.message}</li>
                      ))}
                    </ul>
                  ) : <span className="text-slate-400">—</span>}
                </td>
                <td className="px-3 py-3 whitespace-nowrap">
                  {item.is_monitor_enabled ? 'On' : 'Off'}{item.is_alert_enabled ? ' · alerts' : ''}
                </td>
                <td className="px-3 py-3 whitespace-nowrap">
                  {item.checked === 'Not checked' ? <span className="text-slate-400">Never</span> : <TimeAgo date={item.checked} />}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  HiCollection, HiOutlinePlusCircle, HiSearch, HiShieldCheck, HiShieldExclamation, HiTrash, HiViewGridAdd,
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
import { Alert, EmptyState, PageHeader, cardClass, primaryButtonClass, secondaryButtonClass } from "../../components/shared/ui";

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
  { key: 'listed', label: 'Listed' },
  { key: 'clean', label: 'Clean' },
];

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

function importSummary(result, verb) {
  const parts = [`${verb} ${plural(result.created, 'asset')}`];
  if (result.skipped > 0) parts.push(`${result.skipped} already existed`);
  return parts.join(', ');
}

/** Blacklist summary line for an asset card. */
function blacklistSummary(item) {
  const bl = item.result?.blacklist || (item.result?.detected_on ? item.result : null);
  if (!item.result) return { text: 'Not checked yet', className: 'text-slate-500 dark:text-slate-400' };
  if (!bl) return { text: 'Checked', className: 'text-slate-600 dark:text-slate-300' };
  const detected = bl.detected_on?.length ?? 0;
  const total = bl.providers?.length ?? 0;
  if (detected > 0) return { text: `Listed on ${detected} of ${total}`, className: 'text-rose-700 dark:text-rose-400' };
  if (bl.is_inconclusive) return { text: `Inconclusive: ${bl.failed_providers?.length ?? 0} providers did not answer`, className: 'text-amber-700 dark:text-amber-400' };
  const failed = bl.failed_providers?.length ?? 0;
  return { text: failed ? `Clear on ${total - failed} of ${total} providers` : `Clear on ${total} providers`, className: 'text-emerald-700 dark:text-emerald-400' };
}

export default function Assets() {
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [cidrModalOpen, setCidrModalOpen] = useState(false);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const { token } = useAuth();
  const [formData, setFormData] = useState({ ...initialFormData });
  const [assets, setAssets] = useState([]);
  const hostnameService = HostnameService();

  const fetchAssets = useCallback(async ({ quiet = false } = {}) => {
    // Background refreshes keep the current cards on screen instead of
    // flashing skeletons.
    if (quiet) setRefreshing(true); else setIsLoading(true);
    setErrorMessage("");
    try {
      setAssets(await HostnameService().listHostname());
    } catch {
      setErrorMessage("Could not load assets. Check your connection and try again.");
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { if (token) fetchAssets(); }, [token, fetchAssets]);
  const refresh = useCallback(() => fetchAssets({ quiet: true }), [fetchAssets]);

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

  const query = search.trim().toLowerCase();
  const filtered = assets.filter((item) => {
    const matchSearch = !query
      || item.hostname.toLowerCase().includes(query)
      || item.hostname_type.toLowerCase().includes(query)
      || (item.description || '').toLowerCase().includes(query);
    if (!matchSearch) return false;
    if (filterStatus === 'listed') return item.is_blacklisted;
    if (filterStatus === 'clean') return !item.is_blacklisted;
    return true;
  });
  const listedCount = assets.filter((item) => item.is_blacklisted).length;

  return (
    <section className="space-y-5">
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
        <div className="flex flex-col sm:flex-row gap-3">
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
          <div role="group" aria-label="Filter by status" className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1 border border-slate-200 dark:border-slate-700">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilterStatus(f.key)}
                aria-pressed={filterStatus === f.key}
                className={`px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors ${filterStatus === f.key ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
              >
                {f.label}
              </button>
            ))}
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
            Add a mail server IP or a domain. AbuseBox checks it against 60 blacklists now, then again on a schedule, and alerts you when it gets listed.
          </EmptyState>
        </div>
      ) : filtered.length === 0 ? (
        <div className={cardClass}>
          <EmptyState icon={HiSearch} title="No matching assets">
            Try a different search or filter.
          </EmptyState>
        </div>
      ) : (
        <ul className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((item) => {
            const summary = blacklistSummary(item);
            const enabledChecks = Object.entries(CHECK_BADGE_MAP).filter(([key]) => item[key]).map(([, label]) => label);
            return (
              <li
                key={item.id}
                className="relative bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm hover:shadow-md hover:border-cyan-300 dark:hover:border-cyan-700 focus-within:border-cyan-400 transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${item.is_blacklisted ? 'bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400' : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400'}`}>
                      {item.is_blacklisted
                        ? <HiShieldExclamation className="text-xl" role="img" aria-label="Listed" />
                        : <HiShieldCheck className="text-xl" role="img" aria-label="Not listed" />}
                    </div>
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
                        {item.is_monitor_enabled && <span aria-hidden="true">&middot;</span>}
                        {item.is_monitor_enabled && <span>Monitored</span>}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(item.id, item.hostname)}
                    className="relative z-10 p-2 -m-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors"
                    aria-label={`Delete ${item.hostname}`}
                    title="Delete"
                  >
                    <HiTrash aria-hidden="true" />
                  </button>
                </div>

                {item.description && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 truncate" title={item.description}>{item.description}</p>
                )}

                <p className={`mt-4 text-sm font-semibold ${summary.className}`}>{summary.text}</p>

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
          })}
        </ul>
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

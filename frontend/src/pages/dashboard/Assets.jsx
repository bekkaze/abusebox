import React, { useState, useCallback, useEffect } from "react";
import { useNavigate } from 'react-router-dom';
import { HiOutlinePlusCircle, HiShieldCheck, HiShieldExclamation, HiExternalLink, HiTrash, HiSearch } from 'react-icons/hi';
import HostnameService from "../../services/hostname";
import { useAuth } from "../../services/auth/authProvider";
import AddNewMonitorDialog from "../../components/dashboard/blacklistMonitor/AddNewMonitorDialog";
import { AssetCardSkeleton } from "../../components/shared/Skeleton";
import AutoRefresh from "../../components/shared/AutoRefresh";
import TimeAgo from "../../components/shared/TimeAgo";
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

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
  is_monitor_enabled: false,
  check_blacklist: true,
  check_abuseipdb: false,
  check_dns: false,
  check_ssl: false,
  check_whois: false,
  check_email_security: false,
  check_server_status: false,
};

export default function Assets() {
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all"); // all | clean | listed
  const navigate = useNavigate();
  const { token } = useAuth();
  const [formData, setFormData] = useState({ ...initialFormData });
  const hostnameService = HostnameService();
  const [hostnameListData, setHostnameListData] = useState([]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const result = await hostnameService.createHostname(formData);
      if (result.status === 'active') {
        toast.success(`Added ${formData.hostname}`);
        setFormData({ ...initialFormData });
        setAddModalOpen(false);
        fetchHostnameList();
      }
    } catch {
      toast.error("Failed to create asset. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const fetchHostnameList = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const listData = await hostnameService.listHostname();
      setHostnameListData(listData);
    } catch {
      setErrorMessage("Failed to retrieve assets.");
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => { if (token) fetchHostnameList(); }, [token, fetchHostnameList]);

  const handleDelete = async (e, id, hostname) => {
    e.stopPropagation();
    if (!window.confirm(`Delete "${hostname}"?`)) return;
    try {
      const result = await hostnameService.deleteHostname(id);
      if (result.status === 204) {
        toast.success(`Deleted ${hostname}`);
        fetchHostnameList();
      }
    } catch {
      toast.error('Failed to delete asset.');
    }
  };

  // Filter & search
  const filtered = hostnameListData.filter((item) => {
    const matchSearch = !search || item.hostname.toLowerCase().includes(search.toLowerCase()) || item.hostname_type.toLowerCase().includes(search.toLowerCase());
    if (!matchSearch) return false;
    if (filterStatus === 'listed') return item.is_blacklisted;
    if (filterStatus === 'clean') return !item.is_blacklisted;
    return true;
  });

  return (
    <section className="space-y-5">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">Monitor</p>
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">Assets</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {hostnameListData.length} asset{hostnameListData.length !== 1 ? 's' : ''} tracked
          </p>
        </div>
        <div className="flex items-center gap-3">
          <AutoRefresh onRefresh={fetchHostnameList} loading={isLoading} />
          <button
            className="bg-cyan-600 hover:bg-cyan-700 text-white py-2.5 px-5 flex items-center gap-2 rounded-xl transition-colors font-medium"
            onClick={() => setAddModalOpen(true)}
          >
            <HiOutlinePlusCircle className="text-lg" /> Add Asset
          </button>
        </div>
      </div>

      {/* Search & Filter */}
      {hostnameListData.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <HiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search assets..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
          <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 border border-slate-200 dark:border-slate-700">
            {[
              { key: 'all', label: 'All' },
              { key: 'clean', label: 'Clean' },
              { key: 'listed', label: 'Listed' },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setFilterStatus(f.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterStatus === f.key ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          {[...Array(6)].map((_, i) => <AssetCardSkeleton key={i} />)}
        </div>
      ) : errorMessage ? (
        <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl p-4 text-sm text-rose-700 dark:text-rose-300">{errorMessage}</div>
      ) : hostnameListData.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-12 text-center shadow-sm">
          <div className="text-slate-400 dark:text-slate-500 text-5xl mb-4">
            <HiShieldCheck className="mx-auto" />
          </div>
          <p className="text-slate-600 dark:text-slate-400 font-medium">No assets yet</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Add a domain or IP to start monitoring.</p>
          <button
            className="mt-4 bg-cyan-600 hover:bg-cyan-700 text-white py-2 px-5 rounded-xl text-sm font-medium transition-colors"
            onClick={() => setAddModalOpen(true)}
          >
            Add Your First Asset
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-8 text-center shadow-sm">
          <HiSearch className="text-4xl text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-slate-500 dark:text-slate-400 text-sm">No assets match your search.</p>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((item) => {
            const bl = item.result?.blacklist || (item.result?.detected_on ? item.result : null);
            const detectedCount = bl?.detected_on?.length ?? 0;
            const totalProviders = bl?.providers?.length ?? 0;
            const enabledChecks = Object.entries(CHECK_BADGE_MAP).filter(([key]) => item[key]).map(([, label]) => label);

            return (
              <div
                key={item.id}
                onClick={() => navigate(`/dashboard/assets/${item.id}`)}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm hover:shadow-md hover:border-cyan-300 dark:hover:border-cyan-700 transition-all cursor-pointer group"
              >
                {/* Top row */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${item.is_blacklisted ? 'bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400' : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400'}`}>
                      {item.is_blacklisted ? <HiShieldExclamation className="text-xl" /> : <HiShieldCheck className="text-xl" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-slate-900 dark:text-white truncate">{item.hostname}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-slate-400 dark:text-slate-500">{item.hostname_type}</span>
                        <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${item.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' : 'bg-slate-100 text-slate-500'}`}>
                          {item.status}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => handleDelete(e, item.id, item.hostname)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors"
                      title="Delete"
                    >
                      <HiTrash />
                    </button>
                    <HiExternalLink className="text-slate-400" />
                  </div>
                </div>

                {item.description && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 truncate">{item.description}</p>
                )}

                {/* Blacklist status */}
                <div className="mt-4">
                  {!item.result ? (
                    <p className="text-xs text-slate-400">Not checked yet</p>
                  ) : (
                    <span className={`text-sm font-semibold ${detectedCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {detectedCount > 0 ? `Listed on ${detectedCount} of ${totalProviders}` : totalProviders > 0 ? `Clear on ${totalProviders} providers` : 'Checked'}
                    </span>
                  )}
                </div>

                {/* Bottom row: badges + timestamp */}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                  <div className="flex flex-wrap gap-1">
                    {enabledChecks.map((label) => (
                      <span key={label} className="inline-flex rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 text-[10px] font-bold">{label}</span>
                    ))}
                  </div>
                  <TimeAgo date={item.checked} className="text-[10px] text-slate-400 dark:text-slate-500 flex-shrink-0 ml-2" />
                </div>
              </div>
            );
          })}
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

      <ToastContainer position="top-center" autoClose={3000} />
    </section>
  );
}

import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from 'react-router-dom';
import { HiOutlinePlusCircle, HiShieldCheck, HiShieldExclamation, HiExternalLink, HiTrash } from 'react-icons/hi';
import HostnameService from "../../services/hostname";
import { useAuth } from "../../services/auth/authProvider";
import AddNewMonitorDialog from "../../components/dashboard/blacklistMonitor/AddNewMonitorDialog";
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
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
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
    try {
      const result = await hostnameService.createHostname(formData);
      if (result.status === 'active') {
        toast.success(`Added ${formData.hostname}`);
        setFormData({ ...initialFormData });
        fetchHostnameList();
      }
    } catch {
      toast.error("Failed to create asset. Please try again.");
    }
    setAddModalOpen(false);
  };

  const fetchHostnameList = async () => {
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
  };

  useEffect(() => { if (token) fetchHostnameList(); }, [token]);

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

  const formatDateTime = (v) => {
    if (!v || v === 'Not checked') return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d.toLocaleString();
  };

  return (
    <section className="space-y-5">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">Monitor</p>
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">Assets</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {hostnameListData.length} asset{hostnameListData.length !== 1 ? 's' : ''} tracked
          </p>
        </div>
        <button
          className="bg-cyan-600 hover:bg-cyan-700 text-white py-2.5 px-5 flex items-center gap-2 rounded-xl transition-colors font-medium"
          onClick={() => setAddModalOpen(true)}
        >
          <HiOutlinePlusCircle className="text-lg" /> Add Asset
        </button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-cyan-600"></div>
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
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          {hostnameListData.map((item) => {
            const bl = item.result?.blacklist || (item.result?.detected_on ? item.result : null);
            const detectedCount = bl?.detected_on?.length ?? 0;
            const totalProviders = bl?.providers?.length ?? 0;
            const checked = formatDateTime(item.checked);
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

                {/* Description */}
                {item.description && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 truncate">{item.description}</p>
                )}

                {/* Blacklist status */}
                <div className="mt-4">
                  {!item.result ? (
                    <p className="text-xs text-slate-400">Not checked yet</p>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-semibold ${detectedCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {detectedCount > 0 ? `Listed on ${detectedCount} of ${totalProviders}` : totalProviders > 0 ? `Clear on ${totalProviders} providers` : 'Checked'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Bottom row: badges + timestamp */}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                  <div className="flex flex-wrap gap-1">
                    {enabledChecks.map((label) => (
                      <span key={label} className="inline-flex rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 text-[10px] font-bold">{label}</span>
                    ))}
                  </div>
                  {checked && (
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 flex-shrink-0 ml-2">{checked}</span>
                  )}
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
      />

      <ToastContainer position="top-center" autoClose={3000} />
    </section>
  );
}

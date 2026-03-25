import React, { useState } from "react";
import { Dialog, Transition } from "@headlessui/react";

const CHECK_TOGGLES = [
  { name: "check_blacklist", label: "Blacklist (DNSBL)" },
  { name: "check_abuseipdb", label: "AbuseIPDB" },
  { name: "check_dns", label: "DNS Records" },
  { name: "check_ssl", label: "SSL Certificate" },
  { name: "check_whois", label: "WHOIS Lookup" },
  { name: "check_email_security", label: "SPF/DKIM/DMARC" },
  { name: "check_server_status", label: "Server Status" },
];

const initialForm = {
  cidr: "",
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

export default function CidrImportDialog({ isOpen, setIsOpen, onImport }) {
  const [form, setForm] = useState({ ...initialForm });
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await onImport(form);
      setForm({ ...initialForm });
    } catch {
      // error handled by parent
    } finally {
      setSubmitting(false);
    }
  };

  // Estimate host count from CIDR
  let hostCount = 0;
  try {
    const parts = form.cidr.split("/");
    if (parts.length === 2) {
      const prefix = parseInt(parts[1], 10);
      if (prefix >= 24 && prefix <= 32) {
        hostCount = Math.max(0, Math.pow(2, 32 - prefix) - 2);
      }
    }
  } catch { /* ignore */ }

  return (
    <Transition show={isOpen} as={React.Fragment}>
      <Dialog as="div" className="fixed inset-0 z-10 overflow-y-auto" onClose={() => setIsOpen(false)}>
        <div className="min-h-screen px-4 text-center">
          <Transition.Child
            as={React.Fragment}
            enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100"
            leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0"
          >
            <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
          </Transition.Child>

          <span className="inline-block h-screen align-middle" aria-hidden="true">&#8203;</span>

          <Transition.Child
            as={React.Fragment}
            enter="ease-out duration-300" enterFrom="opacity-0 translate-y-4" enterTo="opacity-100 translate-y-0"
            leave="ease-in duration-200" leaveFrom="opacity-100 translate-y-0" leaveTo="opacity-0 translate-y-4"
          >
            <div className="inline-block w-full max-w-lg p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white dark:bg-slate-800 shadow-xl rounded-xl border border-slate-200 dark:border-slate-700">
              <Dialog.Title as="h3" className="text-xl font-semibold leading-6 text-slate-900 dark:text-white">
                CIDR Import
              </Dialog.Title>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Import an IP range as monitored assets. Max /24 (254 hosts).
              </p>

              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">CIDR Range</label>
                  <input
                    type="text"
                    name="cidr"
                    value={form.cidr}
                    onChange={handleChange}
                    placeholder="192.168.1.0/24"
                    className="mt-1 p-2.5 w-full border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none dark:bg-slate-700 dark:text-white"
                  />
                  {hostCount > 0 && (
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      This will create <span className="font-semibold text-cyan-600">{hostCount}</span> asset{hostCount !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Description</label>
                  <input
                    type="text"
                    name="description"
                    value={form.description}
                    onChange={handleChange}
                    placeholder="Optional description for all imported IPs"
                    className="mt-1 p-2.5 w-full border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none dark:bg-slate-700 dark:text-white"
                  />
                </div>

                {/* Check Toggles */}
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Checks to Run</p>
                  <div className="grid grid-cols-2 gap-2">
                    {CHECK_TOGGLES.map((toggle) => (
                      <label key={toggle.name} className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          name={toggle.name}
                          checked={form[toggle.name] || false}
                          onChange={handleChange}
                          className="rounded border-slate-300"
                        />
                        <span className="text-sm text-slate-700 dark:text-slate-300">{toggle.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Monitor & Alert */}
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" name="is_monitor_enabled" checked={form.is_monitor_enabled} onChange={handleChange} className="rounded border-slate-300" />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Enable Monitoring</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" name="is_alert_enabled" checked={form.is_alert_enabled} onChange={handleChange} className="rounded border-slate-300" />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Enable Alerts</span>
                  </label>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    className="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 py-2 px-4 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors disabled:opacity-50"
                    onClick={() => setIsOpen(false)}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="bg-cyan-600 hover:bg-cyan-700 text-white py-2 px-5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2 min-w-[120px] justify-center"
                    disabled={!form.cidr.trim() || submitting}
                    onClick={handleSubmit}
                  >
                    {submitting ? (
                      <>
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Importing...
                      </>
                    ) : (
                      'Import'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  );
}

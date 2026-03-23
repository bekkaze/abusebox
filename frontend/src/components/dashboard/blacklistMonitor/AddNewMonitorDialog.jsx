import React from "react";
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

export default function AddNewMonitorDialog({ formData, handleInputChange, handleSubmit, isOpen, setIsOpen }) {
  return (
    <Transition show={isOpen} as={React.Fragment}>
      <Dialog
        as="div"
        className="fixed inset-0 z-10 overflow-y-auto"
        onClose={() => setIsOpen(false)}
      >
        <div className="min-h-screen px-4 text-center">
          <Transition.Child
            as={React.Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
          </Transition.Child>

          <span className="inline-block h-screen align-middle" aria-hidden="true">&#8203;</span>

          <Transition.Child
            as={React.Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0 translate-y-4"
            enterTo="opacity-100 translate-y-0"
            leave="ease-in duration-200"
            leaveFrom="opacity-100 translate-y-0"
            leaveTo="opacity-0 translate-y-4"
          >
            <div className="inline-block w-full max-w-lg p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white dark:bg-slate-800 shadow-xl rounded-xl border border-slate-200 dark:border-slate-700">
              <Dialog.Title as="h3" className="text-xl font-semibold leading-6 text-slate-900 dark:text-white">
                Add New Monitor
              </Dialog.Title>

              <div className="mt-4">
                <form>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Hostname</label>
                    <input
                      type="text"
                      name="hostname"
                      value={formData.hostname}
                      onChange={handleInputChange}
                      required
                      placeholder="example.com or 8.8.8.8"
                      className="mt-1 p-2.5 w-full border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none dark:bg-slate-700 dark:text-white"
                    />
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Hostname Type</label>
                    <select
                      name="hostname_type"
                      value={formData.hostname_type}
                      onChange={handleInputChange}
                      required
                      className="mt-1 p-2.5 w-full border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none dark:bg-slate-700 dark:text-white"
                    >
                      <option value="">Select Hostname Type</option>
                      <option value="domain">Domain</option>
                      <option value="ipv4">IPv4</option>
                    </select>
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Description</label>
                    <input
                      type="text"
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      className="mt-1 p-2.5 w-full border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none dark:bg-slate-700 dark:text-white"
                    />
                  </div>

                  {/* Check Toggles */}
                  <div className="mb-4">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Checks to Run</p>
                    <div className="grid grid-cols-2 gap-2">
                      {CHECK_TOGGLES.map((toggle) => (
                        <label key={toggle.name} className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            name={toggle.name}
                            checked={formData[toggle.name] || false}
                            onChange={handleInputChange}
                            className="rounded border-slate-300"
                          />
                          <span className="text-sm text-slate-700 dark:text-slate-300">{toggle.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Monitor & Alert */}
                  <div className="mb-4 flex gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        name="is_monitor_enabled"
                        checked={formData.is_monitor_enabled}
                        onChange={handleInputChange}
                        className="rounded border-slate-300"
                      />
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Enable Monitoring</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        name="is_alert_enabled"
                        checked={formData.is_alert_enabled}
                        onChange={handleInputChange}
                        className="rounded border-slate-300"
                      />
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Enable Alerts</span>
                    </label>
                  </div>

                  <div className="mt-5 flex justify-end gap-2">
                    <button
                      type="button"
                      className="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 py-2 px-4 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                      onClick={() => setIsOpen(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="bg-cyan-600 hover:bg-cyan-700 text-white py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={!formData.hostname.trim() || !formData.hostname_type}
                      onClick={handleSubmit}
                    >
                      Submit
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  );
}

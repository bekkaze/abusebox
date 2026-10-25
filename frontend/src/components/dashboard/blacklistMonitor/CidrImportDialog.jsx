import React, { useState } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { inputClass, primaryButtonClass, secondaryButtonClass, Spinner } from "../../shared/ui";
import { CHECK_TOGGLES } from "./assetForm";

// Dialog surface and form vocabulary: flat paper, hairline border, one soft shadow.
const panelClass =
  "inline-block w-full max-w-lg p-5 sm:p-6 my-8 text-left align-middle transition-all transform " +
  "bg-paper rounded-md border border-rule shadow-[0_12px_32px_rgb(0_0_0/0.18)]";
const labelClass = "block text-sm font-medium text-ink mb-1.5";
const checkboxClass = "h-4 w-4 rounded border-rule-strong accent-accent";

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
      <Dialog as="div" className="fixed inset-0 z-50 overflow-y-auto" onClose={() => setIsOpen(false)}>
        <div className="min-h-screen px-4 text-center">
          <Transition.Child
            as={React.Fragment}
            enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100"
            leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0"
          >
            <Dialog.Overlay className="fixed inset-0 bg-scrim/50" />
          </Transition.Child>

          <span className="inline-block h-screen align-middle" aria-hidden="true">&#8203;</span>

          <Transition.Child
            as={React.Fragment}
            enter="ease-out duration-200" enterFrom="opacity-0 translate-y-4" enterTo="opacity-100 translate-y-0"
            leave="ease-in duration-150" leaveFrom="opacity-100 translate-y-0" leaveTo="opacity-0 translate-y-4"
          >
            <div className={panelClass}>
              <Dialog.Title as="h3" className="text-base font-semibold text-ink">
                Import a CIDR range
              </Dialog.Title>
              <p className="mt-1 text-sm text-ink-2">
                Adds every usable address in an IPv4 range as an asset, up to a /24 (254 hosts). The scheduler checks them on its next run.
              </p>

              <div className="mt-5 space-y-4">
                <div>
                  <label htmlFor="cidr-import-range" className={labelClass}>CIDR range</label>
                  <input
                    type="text"
                    id="cidr-import-range"
                    name="cidr"
                    value={form.cidr}
                    onChange={handleChange}
                    placeholder="192.0.2.0/24"
                    autoComplete="off"
                    spellCheck="false"
                    aria-describedby={hostCount > 0 ? "cidr-import-count" : undefined}
                    className={`${inputClass} font-mono`}
                  />
                  {hostCount > 0 && (
                    <p id="cidr-import-count" className="mt-1.5 text-xs text-ink-2">
                      Creates <span className="font-semibold text-ink tabular-nums">{hostCount}</span> asset{hostCount !== 1 ? "s" : ""}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="cidr-import-description" className={labelClass}>
                    Description <span className="font-normal text-ink-2">(optional)</span>
                  </label>
                  <input
                    type="text"
                    id="cidr-import-description"
                    name="description"
                    value={form.description}
                    onChange={handleChange}
                    placeholder="Applied to every imported IP"
                    className={inputClass}
                  />
                </div>

                <fieldset>
                  <legend className="text-sm font-medium text-ink mb-1">Checks to run</legend>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                    {CHECK_TOGGLES.map((toggle) => (
                      <label key={toggle.name} className="flex items-center gap-2.5 py-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          name={toggle.name}
                          checked={form[toggle.name] || false}
                          onChange={handleChange}
                          className={checkboxClass}
                        />
                        <span className="text-sm text-ink">{toggle.label}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <fieldset className="flex flex-wrap gap-x-6 gap-y-2 pt-4 border-t border-rule">
                  <legend className="sr-only">Monitoring</legend>
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input type="checkbox" name="is_monitor_enabled" checked={form.is_monitor_enabled} onChange={handleChange} className={checkboxClass} />
                    <span className="text-sm text-ink">Monitor on a schedule</span>
                  </label>
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input type="checkbox" name="is_alert_enabled" checked={form.is_alert_enabled} onChange={handleChange} className={checkboxClass} />
                    <span className="text-sm text-ink">Alert when newly listed</span>
                  </label>
                </fieldset>

                <div className="flex flex-wrap justify-end gap-2 pt-2">
                  <button
                    type="button"
                    className={secondaryButtonClass}
                    onClick={() => setIsOpen(false)}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className={`${primaryButtonClass} min-w-[8rem]`}
                    disabled={!form.cidr.trim() || submitting}
                    onClick={handleSubmit}
                  >
                    {submitting && <Spinner />}
                    {submitting ? "Importing" : hostCount > 0 ? `Import ${hostCount} address${hostCount !== 1 ? "es" : ""}` : "Import"}
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

import { Fragment, useId } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { inputClass, primaryButtonClass, secondaryButtonClass, Spinner } from "../../shared/ui";
import { CHECK_TOGGLES, detectHostnameType } from "./assetForm";


const INTERVALS = [
  { value: 15, label: "Every 15 min" },
  { value: 30, label: "Every 30 min" },
  { value: 60, label: "Every hour" },
  { value: 180, label: "Every 3 hours" },
  { value: 360, label: "Every 6 hours" },
  { value: 720, label: "Every 12 hours" },
  { value: 1440, label: "Every 24 hours" },
];


/** Create or edit an asset. `mode` is "create" (default) or "edit". */
export default function AddNewMonitorDialog({ formData, handleInputChange, handleSubmit, isOpen, setIsOpen, submitting = false, mode = "create" }) {
  const id = useId();
  const isEdit = mode === "edit";
  const intervalIsCustom = formData.check_interval_minutes && !INTERVALS.some((i) => i.value === formData.check_interval_minutes);

  const onHostnameChange = (event) => {
    handleInputChange(event);
    // Pick the type automatically so most users never touch the select.
    const detected = detectHostnameType(event.target.value);
    if (detected && detected !== formData.hostname_type) {
      handleInputChange({ target: { name: "hostname_type", value: detected, type: "select" } });
    }
  };

  const close = () => !submitting && setIsOpen(false);

  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog as="div" className="fixed inset-0 z-50 overflow-y-auto" onClose={close}>
        <div className="min-h-screen px-4 text-center">
          <Transition.Child as={Fragment} enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0">
            <Dialog.Overlay className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm" />
          </Transition.Child>

          <span className="inline-block h-screen align-middle" aria-hidden="true">&#8203;</span>

          <Transition.Child as={Fragment} enter="ease-out duration-200" enterFrom="opacity-0 translate-y-4" enterTo="opacity-100 translate-y-0" leave="ease-in duration-150" leaveFrom="opacity-100 translate-y-0" leaveTo="opacity-0 translate-y-4">
            <div className="inline-block w-full max-w-lg p-6 my-8 text-left align-middle transition-all transform bg-white dark:bg-slate-800 shadow-xl rounded-xl border border-slate-200 dark:border-slate-700">
              <Dialog.Title as="h2" className="text-xl font-semibold text-slate-900 dark:text-white">
                {isEdit ? "Edit asset" : "Add asset"}
              </Dialog.Title>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {isEdit ? "Changes apply from the next check." : "The enabled checks run once now, then on the monitoring schedule."}
              </p>

              <form
                className="mt-5 space-y-4"
                onSubmit={(event) => { event.preventDefault(); handleSubmit(); }}
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label htmlFor={`${id}-hostname`} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Domain or IPv4</label>
                    <input
                      id={`${id}-hostname`}
                      type="text"
                      name="hostname"
                      value={formData.hostname}
                      onChange={onHostnameChange}
                      required
                      autoComplete="off"
                      autoCapitalize="off"
                      spellCheck="false"
                      placeholder="mail.example.com or 203.0.113.10"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor={`${id}-type`} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Type</label>
                    <select id={`${id}-type`} name="hostname_type" value={formData.hostname_type} onChange={handleInputChange} required className={inputClass}>
                      <option value="">Select</option>
                      <option value="domain">Domain</option>
                      <option value="ipv4">IPv4</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor={`${id}-description`} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Description <span className="font-normal text-slate-400">(optional)</span>
                  </label>
                  <input id={`${id}-description`} type="text" name="description" value={formData.description || ""} onChange={handleInputChange} maxLength={255} placeholder="Outbound mail relay" className={inputClass} />
                </div>

                <fieldset>
                  <legend className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Checks to run</legend>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {CHECK_TOGGLES.map((toggle) => (
                      <label key={toggle.name} className="flex items-center gap-2.5 p-2.5 rounded-lg border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700/60 cursor-pointer transition-colors">
                        <input type="checkbox" name={toggle.name} checked={formData[toggle.name] || false} onChange={handleInputChange} className="h-4 w-4 rounded border-slate-300 accent-cyan-600" />
                        <span className="text-sm text-slate-700 dark:text-slate-300">{toggle.label}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <fieldset className="flex flex-wrap gap-x-6 gap-y-2">
                  <legend className="sr-only">Monitoring</legend>
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input type="checkbox" name="is_monitor_enabled" checked={formData.is_monitor_enabled} onChange={handleInputChange} className="h-4 w-4 rounded border-slate-300 accent-cyan-600" />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Monitor on a schedule</span>
                  </label>
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input type="checkbox" name="is_alert_enabled" checked={formData.is_alert_enabled} onChange={handleInputChange} className="h-4 w-4 rounded border-slate-300 accent-cyan-600" />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Alert when newly listed</span>
                  </label>
                </fieldset>

                {formData.is_monitor_enabled && (
                  <div>
                    <label htmlFor={`${id}-interval`} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Check interval</label>
                    <select
                      id={`${id}-interval`}
                      name="check_interval_minutes"
                      value={formData.check_interval_minutes || ""}
                      onChange={(e) => handleInputChange({
                        target: { name: "check_interval_minutes", value: e.target.value ? parseInt(e.target.value, 10) : null, type: "select" },
                      })}
                      className={inputClass}
                    >
                      <option value="">Default (from Settings)</option>
                      {intervalIsCustom && <option value={formData.check_interval_minutes}>Every {formData.check_interval_minutes} min</option>}
                      {INTERVALS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </div>
                )}

                <div className="pt-2 flex justify-end gap-2">
                  <button type="button" className={secondaryButtonClass} onClick={close} disabled={submitting}>Cancel</button>
                  <button
                    type="submit"
                    className={`${primaryButtonClass} min-w-[8rem]`}
                    disabled={!formData.hostname.trim() || !formData.hostname_type || submitting}
                  >
                    {submitting && <Spinner />}
                    {submitting ? (isEdit ? "Saving" : "Running checks") : (isEdit ? "Save changes" : "Add asset")}
                  </button>
                </div>
              </form>
            </div>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  );
}

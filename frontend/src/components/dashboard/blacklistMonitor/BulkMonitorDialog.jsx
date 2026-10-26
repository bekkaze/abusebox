import React, { useMemo, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { HiOutlineDocumentArrowUp } from 'react-icons/hi2';
import { toast } from 'react-toastify';
import { parseTargetFile } from '../../../services/tools';
import { inputClass, linkClass, primaryButtonClass, secondaryButtonClass, Spinner } from '../../shared/ui';
import { CHECK_TOGGLES } from './assetForm';

// Dialog surface and form vocabulary: flat paper, hairline border, one soft shadow.
const panelClass =
  'inline-block w-full max-w-2xl p-5 sm:p-6 my-8 text-left align-middle transition-all transform ' +
  'bg-paper rounded-xl border border-rule shadow-e3';
const labelClass = 'block text-sm font-medium text-ink mb-1.5';
const checkboxClass = 'h-4 w-4 rounded border-rule-strong accent-accent';
// inputClass carries a fixed h-9; the textarea needs the same look at its own height.
const textareaClass = `${inputClass.replace('h-9 ', '')} py-2 font-mono`;

const MAX_TARGETS = 300;

const initialForm = {
  targets: '',
  description: '',
  is_alert_enabled: false,
  is_monitor_enabled: true,
  check_blacklist: true,
  check_abuseipdb: false,
  check_dns: false,
  check_ssl: false,
  check_whois: false,
  check_email_security: false,
  check_server_status: false,
};

function parseTargets(value) {
  return [...new Set(value.split(/[\n,]+/).map((target) => target.trim().toLowerCase()).filter(Boolean))];
}

function isIpv4(value) {
  const parts = value.split('.');
  return parts.length === 4 && parts.every((part) => /^\d+$/.test(part) && Number(part) >= 0 && Number(part) <= 255);
}

function isDomain(value) {
  return /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(value);
}

export default function BulkMonitorDialog({ isOpen, setIsOpen, onImport }) {
  const [form, setForm] = useState({ ...initialForm });
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const targets = useMemo(() => parseTargets(form.targets), [form.targets]);
  const invalidTargets = targets.filter((target) => !isIpv4(target) && !isDomain(target));
  const tooMany = targets.length > MAX_TARGETS;
  const canSubmit = targets.length > 0 && !tooMany && invalidTargets.length === 0 && !submitting && !uploading;

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((previous) => ({ ...previous, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const uploadedTargets = await parseTargetFile(file);
      setForm((previous) => ({ ...previous, targets: uploadedTargets.join('\n') }));
    } catch (error) {
      toast.error(error.message || 'Could not read the file.');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const handleSubmit = async () => {
    const hostnames = targets.map((hostname) => ({
      hostname,
      hostname_type: isIpv4(hostname) ? 'ipv4' : 'domain',
      description: form.description || null,
      is_alert_enabled: form.is_alert_enabled,
      is_monitor_enabled: form.is_monitor_enabled,
      check_blacklist: form.check_blacklist,
      check_abuseipdb: form.check_abuseipdb,
      check_dns: form.check_dns,
      check_ssl: form.check_ssl,
      check_whois: form.check_whois,
      check_email_security: form.check_email_security,
      check_server_status: form.check_server_status,
    }));
    setSubmitting(true);
    try {
      await onImport(hostnames);
      setForm({ ...initialForm });
    } finally {
      setSubmitting(false);
    }
  };

  const countHasProblem = invalidTargets.length > 0 || tooMany;

  return (
    <Transition show={isOpen} as={React.Fragment}>
      <Dialog as="div" className="fixed inset-0 z-50 overflow-y-auto" onClose={() => !submitting && setIsOpen(false)}>
        <div className="min-h-screen px-4 text-center">
          <Transition.Child as={React.Fragment} enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0">
            <Dialog.Overlay className="fixed inset-0 bg-scrim/50" />
          </Transition.Child>
          <span className="inline-block h-screen align-middle" aria-hidden="true">&#8203;</span>
          <Transition.Child as={React.Fragment} enter="ease-out duration-200" enterFrom="opacity-0 translate-y-4" enterTo="opacity-100 translate-y-0" leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0 translate-y-4">
            <div className={panelClass}>
              <Dialog.Title as="h3" className="text-base font-semibold text-ink">Add a list of assets</Dialog.Title>
              <p className="mt-1 text-sm text-ink-2">
                Paste or upload up to {MAX_TARGETS} domains and IPv4 addresses. TXT, CSV and Excel (.xlsx) files work. New assets are checked on the next scheduler run.
              </p>

              <div className="mt-5 space-y-4">
                <div>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-1.5">
                    <label htmlFor="bulk-targets" className="text-sm font-medium text-ink">Targets, one per line or comma-separated</label>
                    <label className={`${linkClass} inline-flex items-center gap-1.5 text-sm cursor-pointer rounded focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent`}>
                      <HiOutlineDocumentArrowUp className="text-base" aria-hidden="true" />
                      {uploading ? 'Reading file…' : 'Upload TXT, CSV or Excel'}
                      <input type="file" accept=".txt,.csv,.xlsx" onChange={handleFile} disabled={uploading} className="sr-only" />
                    </label>
                  </div>
                  <textarea
                    id="bulk-targets"
                    name="targets"
                    value={form.targets}
                    onChange={handleChange}
                    rows={8}
                    spellCheck="false"
                    autoCapitalize="off"
                    placeholder={'mail.example.com\n203.0.113.10\nexample.org'}
                    aria-invalid={countHasProblem}
                    aria-describedby="bulk-targets-count"
                    className={textareaClass}
                  />
                  <p id="bulk-targets-count" className={`mt-1.5 text-xs ${countHasProblem ? 'text-s5' : 'text-ink-2'}`}>
                    <span className="tabular-nums">{targets.length}</span> unique target{targets.length !== 1 ? 's' : ''}{tooMany && ` (maximum is ${MAX_TARGETS})`}
                    {invalidTargets.length > 0 && (
                      <>
                        {'. Not a domain or IPv4: '}
                        <span className="font-mono">{invalidTargets.slice(0, 3).join(', ')}</span>
                        {invalidTargets.length > 3 && ` and ${invalidTargets.length - 3} more`}
                      </>
                    )}
                  </p>
                </div>

                <div>
                  <label htmlFor="bulk-description" className={labelClass}>
                    Description <span className="font-normal text-ink-2">(optional, applies to every target)</span>
                  </label>
                  <input id="bulk-description" name="description" aria-label="Description for every target" value={form.description} onChange={handleChange} placeholder="Outbound mail relays" className={inputClass} />
                </div>

                <fieldset>
                  <legend className="text-sm font-medium text-ink mb-1">Checks to run</legend>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                    {CHECK_TOGGLES.map((toggle) => (
                      <label key={toggle.name} className="flex items-center gap-2.5 py-1.5 cursor-pointer">
                        <input type="checkbox" name={toggle.name} checked={form[toggle.name]} onChange={handleChange} className={checkboxClass} />
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
                  <button type="button" onClick={() => setIsOpen(false)} disabled={submitting} className={secondaryButtonClass}>Cancel</button>
                  <button type="button" onClick={handleSubmit} disabled={!canSubmit} className={`${primaryButtonClass} min-w-[8rem]`}>
                    {submitting && <Spinner />}
                    {submitting ? 'Adding' : `Add ${targets.length || ''} target${targets.length === 1 ? '' : 's'}`}
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

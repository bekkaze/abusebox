import React, { useMemo, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { parseTargetFile } from '../../../services/tools';

const CHECK_TOGGLES = [
  { name: 'check_blacklist', label: 'Blacklist (DNSBL)' },
  { name: 'check_abuseipdb', label: 'AbuseIPDB' },
  { name: 'check_dns', label: 'DNS Records' },
  { name: 'check_ssl', label: 'SSL Certificate' },
  { name: 'check_whois', label: 'WHOIS Lookup' },
  { name: 'check_email_security', label: 'SPF/DKIM/DMARC' },
  { name: 'check_server_status', label: 'Server Status' },
];

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
  const canSubmit = targets.length > 0 && targets.length <= 300 && invalidTargets.length === 0 && !submitting && !uploading;

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

  return (
    <Transition show={isOpen} as={React.Fragment}>
      <Dialog as="div" className="fixed inset-0 z-10 overflow-y-auto" onClose={() => !submitting && setIsOpen(false)}>
        <div className="min-h-screen px-4 text-center">
          <Transition.Child as={React.Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
            <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
          </Transition.Child>
          <span className="inline-block h-screen align-middle" aria-hidden="true">&#8203;</span>
          <Transition.Child as={React.Fragment} enter="ease-out duration-300" enterFrom="opacity-0 translate-y-4" enterTo="opacity-100 translate-y-0" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0 translate-y-4">
            <div className="inline-block w-full max-w-2xl p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white dark:bg-slate-800 shadow-xl rounded-xl border border-slate-200 dark:border-slate-700">
              <Dialog.Title as="h3" className="text-xl font-semibold text-slate-900 dark:text-white">Bulk Monitoring List</Dialog.Title>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Paste or upload up to 300 domains/IPs. TXT, CSV, and Excel (.xlsx) files are supported.</p>

              <div className="mt-4 space-y-4">
                <textarea name="targets" value={form.targets} onChange={handleChange} rows={8} placeholder={'mail.example.com\n203.0.113.10\nexample.org'} className="w-full p-3 font-mono text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none dark:bg-slate-700 dark:text-white" />
                <label className="inline-flex items-center text-sm font-medium text-cyan-700 dark:text-cyan-400 cursor-pointer">{uploading ? 'Reading file…' : 'Upload TXT, CSV, or Excel'}<input type="file" accept=".txt,.csv,.xlsx" onChange={handleFile} disabled={uploading} className="hidden" /></label>
                <p className={`text-xs ${invalidTargets.length || targets.length > 300 ? 'text-rose-600' : 'text-slate-500 dark:text-slate-400'}`}>
                  {targets.length} unique target{targets.length !== 1 ? 's' : ''} {targets.length > 300 && '(maximum is 300)'}
                  {invalidTargets.length > 0 && ` — invalid: ${invalidTargets.slice(0, 3).join(', ')}${invalidTargets.length > 3 ? '…' : ''}`}
                </p>
                <input name="description" value={form.description} onChange={handleChange} placeholder="Optional description for every target" className="w-full p-2.5 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none dark:bg-slate-700 dark:text-white" />

                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Checks to Run</p>
                  <div className="grid grid-cols-2 gap-2">
                    {CHECK_TOGGLES.map((toggle) => <label key={toggle.name} className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 dark:border-slate-600 cursor-pointer"><input type="checkbox" name={toggle.name} checked={form[toggle.name]} onChange={handleChange} className="rounded border-slate-300" /><span className="text-sm text-slate-700 dark:text-slate-300">{toggle.label}</span></label>)}
                  </div>
                </div>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2"><input type="checkbox" name="is_monitor_enabled" checked={form.is_monitor_enabled} onChange={handleChange} className="rounded border-slate-300" /><span className="text-sm font-medium text-slate-700 dark:text-slate-300">Enable Monitoring</span></label>
                  <label className="flex items-center gap-2"><input type="checkbox" name="is_alert_enabled" checked={form.is_alert_enabled} onChange={handleChange} className="rounded border-slate-300" /><span className="text-sm font-medium text-slate-700 dark:text-slate-300">Enable Alerts</span></label>
                </div>
                <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => setIsOpen(false)} disabled={submitting} className="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 py-2 px-4 rounded-lg disabled:opacity-50">Cancel</button><button type="button" onClick={handleSubmit} disabled={!canSubmit} className="bg-cyan-600 hover:bg-cyan-700 text-white py-2 px-5 rounded-lg disabled:opacity-50">{submitting ? 'Adding…' : `Add ${targets.length || ''} Target${targets.length === 1 ? '' : 's'}`}</button></div>
              </div>
            </div>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  );
}

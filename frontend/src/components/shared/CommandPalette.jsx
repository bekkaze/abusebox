import { Fragment, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Combobox, Dialog, Transition } from '@headlessui/react';
import { HiArrowRight, HiCog, HiExclamation, HiExclamationCircle, HiSearch, HiShieldCheck, HiShieldExclamation } from 'react-icons/hi';
import { DASHBOARD_SIDEBAR_SECTIONS } from '../dashboard/constants';
import HostnameService from '../../services/hostname';

const SETTINGS_SHORTCUTS = [
  { key: 'settings-notifications', label: 'Notification settings', to: '/dashboard/settings?tab=notifications' },
  { key: 'settings-security', label: 'Change password', to: '/dashboard/settings?tab=security' },
  { key: 'settings-users', label: 'Manage users', to: '/dashboard/settings?tab=users' },
];

const TARGET_RE = /^(?:\d{1,3}(?:\.\d{1,3}){3}|(?:[a-z0-9-]+\.)+[a-z]{2,63})$/i;

/** Ctrl/Cmd+K: jump to any page or asset, or run a quick blacklist check. */
export default function CommandPalette({ open, onClose }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [assets, setAssets] = useState([]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }
    HostnameService().listHostname(false).then(setAssets).catch(() => setAssets([]));
  }, [open]);

  const pages = useMemo(() => [
    ...DASHBOARD_SIDEBAR_SECTIONS.flatMap((section) => section.links.map((link) => ({
      key: link.key, label: link.label, to: link.path, icon: link.icon, group: section.label,
    }))),
    ...SETTINGS_SHORTCUTS.map((item) => ({ ...item, icon: <HiCog />, group: 'Settings' })),
  ], []);

  const q = query.trim().toLowerCase();
  const assetResults = (q
    ? assets.filter((a) => a.hostname.toLowerCase().includes(q) || (a.description || '').toLowerCase().includes(q))
    : assets.filter((a) => a.health?.status === 'critical' || a.is_blacklisted)
  ).slice(0, 8).map((a) => ({
    key: `asset-${a.id}`,
    label: a.hostname,
    hint: a.health?.issues?.[0]?.message || a.description || (a.hostname_type === 'ipv4' ? 'IPv4' : 'Domain'),
    to: `/dashboard/assets/${a.id}`,
    icon: a.is_blacklisted
      ? <HiShieldExclamation className="text-rose-500" />
      : a.health?.status === 'critical' ? <HiExclamationCircle className="text-rose-500" />
        : a.health?.status === 'warning' ? <HiExclamation className="text-amber-500" /> : <HiShieldCheck className="text-emerald-500" />,
    group: q ? 'Assets' : 'Needs attention',
  }));
  const pageResults = pages.filter((p) => !q || p.label.toLowerCase().includes(q)).slice(0, q ? 6 : 8);
  const actions = TARGET_RE.test(query.trim()) ? [{
    key: 'quick-check',
    label: `Check ${query.trim()} against blacklists`,
    to: `/dashboard/blacklist-check?hostname=${encodeURIComponent(query.trim())}`,
    icon: <HiArrowRight />,
    group: 'Actions',
  }] : [];
  const results = [...actions, ...assetResults, ...pageResults];
  const groups = results.reduce((acc, item) => {
    (acc[item.group] = acc[item.group] || []).push(item);
    return acc;
  }, {});

  const select = (item) => {
    if (!item) return;
    onClose();
    navigate(item.to);
  };

  return (
    <Transition show={open} as={Fragment} afterLeave={() => setQuery('')}>
      <Dialog as="div" className="fixed inset-0 z-[60] overflow-y-auto p-4 pt-[12vh]" onClose={onClose}>
        <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
          <Dialog.Overlay className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm" />
        </Transition.Child>
        <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-100" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
          <div className="relative mx-auto max-w-xl overflow-hidden rounded-xl bg-white dark:bg-slate-800 shadow-2xl ring-1 ring-slate-900/10 dark:ring-white/10">
            <Dialog.Title className="sr-only">Search AbuseBox</Dialog.Title>
            <Combobox onChange={select}>
              <div className="relative">
                <HiSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <Combobox.Input
                  className="h-14 w-full border-0 bg-transparent pl-11 pr-4 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-0"
                  placeholder="Search assets and pages, or type a domain or IP"
                  aria-label="Search assets and pages"
                  autoComplete="off"
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
              {results.length > 0 ? (
                <Combobox.Options static className="max-h-96 overflow-y-auto border-t border-slate-100 dark:border-slate-700 py-2">
                  {Object.entries(groups).map(([group, items]) => (
                    <li key={group}>
                      <p className="px-4 pt-2 pb-1 text-xs font-semibold text-slate-500 dark:text-slate-400">{group}</p>
                      <ul>
                        {items.map((item) => (
                          <Combobox.Option
                            key={item.key}
                            value={item}
                            className={({ active }) => `flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm ${active ? 'bg-cyan-50 dark:bg-cyan-900/30 text-cyan-900 dark:text-cyan-100' : 'text-slate-700 dark:text-slate-200'}`}
                          >
                            <span className="text-lg text-slate-400" aria-hidden="true">{item.icon}</span>
                            <span className="flex-1 truncate font-medium">{item.label}</span>
                            {item.hint && <span className="truncate text-xs text-slate-500 dark:text-slate-400 max-w-[40%]">{item.hint}</span>}
                          </Combobox.Option>
                        ))}
                      </ul>
                    </li>
                  ))}
                </Combobox.Options>
              ) : (
                <p className="border-t border-slate-100 dark:border-slate-700 px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">No matches.</p>
              )}
              <div className="flex items-center gap-4 border-t border-slate-100 dark:border-slate-700 px-4 py-2 text-xs text-slate-500 dark:text-slate-400">
                <span><kbd className="font-sans font-semibold">↑↓</kbd> to move</span>
                <span><kbd className="font-sans font-semibold">Enter</kbd> to open</span>
                <span><kbd className="font-sans font-semibold">Esc</kbd> to close</span>
              </div>
            </Combobox>
          </div>
        </Transition.Child>
      </Dialog>
    </Transition>
  );
}

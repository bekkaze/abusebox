import { Fragment, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Combobox, Dialog, Transition } from '@headlessui/react';
import { HiOutlineArrowRight, HiOutlineCog6Tooth, HiOutlineMagnifyingGlass } from 'react-icons/hi2';
import { DASHBOARD_SIDEBAR_SECTIONS } from '../dashboard/constants';
import HostnameService from '../../services/hostname';
import { SeverityCode } from './activity';

const SETTINGS_SHORTCUTS = [
  { key: 'settings-notifications', label: 'Notification settings', to: '/dashboard/settings?tab=notifications' },
  { key: 'settings-retention', label: 'Data retention', to: '/dashboard/settings?tab=retention' },
  { key: 'settings-security', label: 'Change password', to: '/dashboard/settings?tab=security' },
  { key: 'settings-users', label: 'Manage users', to: '/dashboard/settings?tab=users' },
];

const TARGET_RE = /^(?:\d{1,3}(?:\.\d{1,3}){3}|(?:[a-z0-9-]+\.)+[a-z]{2,63})$/i;

const kbdClass = 'rounded border border-rule bg-paper px-1.5 text-2xs text-ink-2';

function assetSeverity(asset) {
  if (asset.is_blacklisted || asset.health?.status === 'critical') return 'critical';
  if (asset.health?.status === 'warning') return 'warning';
  return 'ok';
}

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
    ...SETTINGS_SHORTCUTS.map((item) => ({ ...item, icon: <HiOutlineCog6Tooth />, group: 'Settings' })),
  ], []);

  const q = query.trim().toLowerCase();
  const assetResults = (q
    ? assets.filter((a) => a.hostname.toLowerCase().includes(q) || (a.description || '').toLowerCase().includes(q))
    : assets.filter((a) => a.health?.status === 'critical' || a.is_blacklisted)
  ).slice(0, 8).map((a) => ({
    key: `asset-${a.id}`,
    label: a.hostname,
    mono: true,
    hint: a.health?.issues?.[0]?.message || a.description || (a.hostname_type === 'ipv4' ? 'IPv4' : 'Domain'),
    to: `/dashboard/assets/${a.id}`,
    icon: <SeverityCode severity={assetSeverity(a)} />,
    group: q ? 'Assets' : 'Needs attention',
  }));
  const pageResults = pages.filter((p) => !q || p.label.toLowerCase().includes(q)).slice(0, q ? 6 : 8);
  const target = query.trim();
  const actions = TARGET_RE.test(target) ? [{
    key: 'quick-check',
    label: `Check ${target} against blacklists`,
    content: <>Check <span className="font-mono">{target}</span> against blacklists</>,
    to: `/dashboard/blacklist-check?hostname=${encodeURIComponent(target)}`,
    icon: <HiOutlineArrowRight />,
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
          <Dialog.Overlay className="fixed inset-0 bg-scrim/50" />
        </Transition.Child>
        <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0 scale-[0.98]" enterTo="opacity-100 scale-100" leave="ease-in duration-100" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-[0.98]">
          <div className="relative mx-auto max-w-xl overflow-hidden rounded-xl border border-rule bg-paper shadow-e3">
            <Dialog.Title className="sr-only">Search AbuseBox</Dialog.Title>
            <Combobox onChange={select}>
              <div className="relative border-b border-rule">
                <HiOutlineMagnifyingGlass className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[17px] text-ink-2" aria-hidden="true" />
                <Combobox.Input
                  className="h-12 w-full border-0 bg-transparent pl-10 pr-4 text-sm text-ink placeholder:text-ink-2 focus:outline-none focus:ring-0"
                  placeholder="Search assets and pages, or type a domain or IP"
                  aria-label="Search assets and pages"
                  autoComplete="off"
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
              {results.length > 0 ? (
                <Combobox.Options static className="max-h-96 overflow-y-auto py-1.5">
                  {Object.entries(groups).map(([group, items]) => (
                    <li key={group}>
                      <p className="px-3.5 pt-2 pb-1 text-2xs font-medium text-ink-2">{group}</p>
                      <ul>
                        {items.map((item) => (
                          <Combobox.Option
                            key={item.key}
                            value={item}
                            className={({ active }) => `mx-1.5 flex cursor-pointer items-center gap-3 rounded px-2 py-2 text-sm text-ink ${active ? 'bg-accent-soft' : ''}`}
                          >
                            <span className="flex w-6 flex-shrink-0 justify-center text-[17px] text-ink-2" aria-hidden={item.mono ? undefined : 'true'}>{item.icon}</span>
                            <span className={`flex-1 truncate ${item.mono ? 'font-mono text-[13px]' : ''}`}>{item.content || item.label}</span>
                            {item.hint && <span className="truncate text-xs text-ink-2 max-w-[45%]">{item.hint}</span>}
                          </Combobox.Option>
                        ))}
                      </ul>
                    </li>
                  ))}
                </Combobox.Options>
              ) : (
                <p className="px-4 py-6 text-sm text-ink-2">
                  No matches. Type a full domain or IP to check it against blacklists.
                </p>
              )}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-rule bg-sunk px-3.5 py-2 text-xs text-ink-2">
                <span><kbd className={kbdClass}>↑↓</kbd> to move</span>
                <span><kbd className={kbdClass}>Enter</kbd> to open</span>
                <span><kbd className={kbdClass}>Esc</kbd> to close</span>
              </div>
            </Combobox>
          </div>
        </Transition.Child>
      </Dialog>
    </Transition>
  );
}

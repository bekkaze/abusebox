import { Link } from 'react-router-dom';
import {
  HiCheckCircle, HiExclamation, HiExclamationCircle, HiGlobe, HiInformationCircle, HiLockClosed, HiLockOpen,
  HiShieldCheck, HiShieldExclamation, HiStatusOffline, HiStatusOnline, HiSwitchHorizontal,
} from 'react-icons/hi';
import TimeAgo from './TimeAgo';
import { SEVERITY } from './severity';

const SEVERITY_ICONS = {
  critical: HiExclamationCircle,
  warning: HiExclamation,
  info: HiInformationCircle,
  success: HiCheckCircle,
  ok: HiCheckCircle,
};

const EVENT_ICONS = {
  'blacklist.listed': HiShieldExclamation,
  'blacklist.delisted': HiShieldCheck,
  'blacklist.changed': HiSwitchHorizontal,
  'server.down': HiStatusOffline,
  'server.up': HiStatusOnline,
  'ssl.expiring': HiLockOpen,
  'ssl.invalid': HiLockOpen,
  'ssl.renewed': HiLockClosed,
  'domain.expiring': HiGlobe,
};

// Long provider lists are summarized; the asset page has the full table.
function listPreview(items, max = 5) {
  if (items.length <= max) return items.join(', ');
  return `${items.slice(0, max).join(', ')} and ${items.length - max} more`;
}

/** Small pill: icon + label, so meaning never depends on color alone. */
export function SeverityBadge({ severity, label }) {
  const info = SEVERITY[severity] || SEVERITY.info;
  const Icon = SEVERITY_ICONS[severity] || HiInformationCircle;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${info.badge}`}>
      <Icon aria-hidden="true" /> {label || info.label}
    </span>
  );
}

/** One "needs attention" line: severity icon, asset link, message(s). */
export function IssueRow({ issue, issues, hostname, hostnameId }) {
  const list = issues || [issue];
  const worst = list[0];
  const info = SEVERITY[worst.severity] || SEVERITY.info;
  const Icon = SEVERITY_ICONS[worst.severity] || HiInformationCircle;
  return (
    <li className="flex items-start gap-3 py-2.5">
      <Icon className={`mt-0.5 flex-shrink-0 text-lg ${info.text}`} aria-label={info.label} role="img" />
      <div className="min-w-0 flex-1">
        {hostname && (
          <Link to={`/dashboard/assets/${hostnameId}`} className="block text-sm font-semibold text-slate-900 dark:text-white hover:text-cyan-700 dark:hover:text-cyan-400 truncate">
            {hostname}
          </Link>
        )}
        {list.map((item) => (
          <p key={item.message} className="text-sm text-slate-600 dark:text-slate-300">{item.message}</p>
        ))}
      </div>
    </li>
  );
}

/** Timeline of asset events. `showHostname` for cross-asset feeds. */
export function EventList({ events, showHostname = true, emptyText = 'No activity yet.' }) {
  if (!events?.length) {
    return <p className="text-sm text-slate-500 dark:text-slate-400 py-6 text-center">{emptyText}</p>;
  }
  return (
    <ol className="relative">
      {events.map((event, index) => {
        const info = SEVERITY[event.severity] || SEVERITY.info;
        const Icon = EVENT_ICONS[event.event_type] || SEVERITY_ICONS[event.severity] || HiInformationCircle;
        const details = event.details || {};
        const extra = details.added?.length
          ? listPreview(details.added)
          : details.removed?.length && event.event_type !== 'blacklist.delisted'
            ? `Removed: ${listPreview(details.removed)}`
            : details.reason || details.error || null;
        return (
          <li key={event.id} className="relative flex gap-3 pb-4 last:pb-0">
            {index < events.length - 1 && (
              <span className="absolute left-[15px] top-8 bottom-0 w-px bg-slate-200 dark:bg-slate-700" aria-hidden="true" />
            )}
            <span className={`relative z-[1] flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${info.soft}`}>
              <Icon className={`text-base ${info.text}`} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-sm text-slate-800 dark:text-slate-100">
                {showHostname && (
                  <>
                    <Link to={`/dashboard/assets/${event.hostname_id}`} className="font-semibold hover:text-cyan-700 dark:hover:text-cyan-400 break-all">
                      {event.hostname}
                    </Link>
                    <span className="text-slate-400" aria-hidden="true"> · </span>
                  </>
                )}
                <span className={event.severity === 'critical' ? 'font-medium' : ''}>{event.title}</span>
              </p>
              {extra && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 break-words">{extra}</p>}
              <TimeAgo date={event.created} className="text-xs text-slate-400 dark:text-slate-500" />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

import { Link } from 'react-router-dom';
import { HiChevronRight } from 'react-icons/hi2';
import TimeAgo from './TimeAgo';
import { SEVERITY } from './severity';

// Health and event severities, written as the SMTP reply class they resemble.
const CODES = {
  critical: { code: '5.x', text: 'text-s5', dot: 'bg-s5' },
  warning: { code: '4.x', text: 'text-s4', dot: 'bg-s4' },
  info: { code: '3.x', text: 'text-info', dot: 'bg-info' },
  success: { code: '2.x', text: 'text-s2', dot: 'bg-s2' },
  ok: { code: '2.x', text: 'text-s2', dot: 'bg-s2' },
};

// Long provider lists are summarized; the asset page has the full table.
function listPreview(items, max = 5) {
  if (items.length <= max) return items.join(', ');
  return `${items.slice(0, max).join(', ')} and ${items.length - max} more`;
}

/** Reply-class code plus its meaning for screen readers. */
export function SeverityCode({ severity, className = '' }) {
  const code = CODES[severity] || CODES.info;
  const info = SEVERITY[severity] || SEVERITY.info;
  return (
    <span className={`font-mono text-xs font-semibold ${code.text} ${className}`}>
      <span aria-hidden="true">{code.code}</span>
      <span className="sr-only">{info.label}</span>
    </span>
  );
}

/** Small tag: code + label, so meaning never depends on colour alone. */
export function SeverityBadge({ severity, label }) {
  const info = SEVERITY[severity] || SEVERITY.info;
  const code = CODES[severity] || CODES.info;
  return (
    <span className={`inline-flex items-baseline gap-1.5 rounded px-1.5 py-0.5 text-xs font-semibold ${info.badge}`}>
      <span className="font-mono text-2xs font-normal opacity-80" aria-hidden="true">{code.code}</span>
      {label || info.label}
    </span>
  );
}

/** One "needs attention" row: reply class, asset, what is wrong. */
export function IssueRow({ issue, issues, hostname, hostnameId }) {
  const list = issues || [issue];
  const worst = list[0];
  const content = (
    <>
      <SeverityCode severity={worst.severity} className="pt-px" />
      <div className="min-w-0">
        {hostname && <p className="font-mono text-sm font-semibold text-ink truncate">{hostname}</p>}
        {list.map((item) => (
          <p key={item.message} className="text-sm text-ink-2">{item.message}</p>
        ))}
      </div>
    </>
  );
  if (!hostname) {
    return <li className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-2 py-2.5">{content}</li>;
  }
  return (
    <li>
      <Link
        to={`/dashboard/assets/${hostnameId}`}
        className="group grid grid-cols-[2.25rem_minmax(0,1fr)_auto] gap-x-2 py-2.5 -mx-2 px-2 rounded-md hover:bg-sunk hover:no-underline"
      >
        {content}
        <HiChevronRight className="self-center text-ink-3 group-hover:text-ink-2" aria-hidden="true" />
      </Link>
    </li>
  );
}

const formatStamp = (iso) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

/** Timeline of asset events, newest first, drawn like a Received: header chain. */
export function EventList({ events, showHostname = true, emptyText = 'No activity yet.' }) {
  if (!events?.length) {
    return <p className="text-sm text-ink-2 py-4">{emptyText}</p>;
  }
  return (
    <ol className="border-l border-rule-strong">
      {events.map((event) => {
        const details = event.details || {};
        const code = CODES[event.severity] || CODES.info;
        const extra = details.added?.length
          ? listPreview(details.added)
          : details.removed?.length && event.event_type !== 'blacklist.delisted'
            ? `Removed: ${listPreview(details.removed)}`
            : details.reason || details.error || null;
        return (
          <li key={event.id} className="relative pl-4 pb-3.5 last:pb-0">
            <span className={`absolute -left-[4px] top-[5px] h-[7px] w-[7px] rounded-full ring-2 ring-paper ${code.dot}`} aria-hidden="true" />
            <p className="flex flex-wrap items-baseline gap-x-2 text-xs text-ink-2">
              <SeverityCode severity={event.severity} />
              <TimeAgo date={event.created} className="font-mono" />
              <span className="sr-only">{formatStamp(event.created)}</span>
              {showHostname && (
                <Link to={`/dashboard/assets/${event.hostname_id}`} className="font-mono text-ink hover:text-accent break-all">
                  {event.hostname}
                </Link>
              )}
            </p>
            <p className={`text-sm text-ink mt-0.5 ${event.severity === 'critical' ? 'font-semibold' : ''}`}>{event.title}</p>
            {extra && <p className="text-xs text-ink-2 mt-0.5 break-words">{extra}</p>}
          </li>
        );
      })}
    </ol>
  );
}

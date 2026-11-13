import { SeverityTag } from '../shared/ui';

// Whether a removal request is worth making, in the reply-class vocabulary
// the rest of the app uses. The verdict warns; it never stops anyone.
const READINESS = {
  blocked: { code: '5.x', tone: 'text-s5', title: 'Not ready: a removal now is likely to be undone' },
  caution: { code: '4.x', tone: 'text-s4', title: 'Check the cause before asking' },
  ready: { code: '2.x', tone: 'text-s2', title: 'Ready: the cause looks fixed' },
  not_applicable: { code: '3.x', tone: 'text-info', title: 'Not yours to request' },
};

const DAY_MS = 24 * 60 * 60 * 1000;

function formatDate(iso) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString();
}

function formatHours(hours) {
  if (hours == null) return '';
  if (hours < 1) return 'under an hour';
  if (hours < 48) return `${Math.round(hours)} h`;
  return `${Math.round(hours / 24)} days`;
}

/** What happened to a removal request, in one line. */
function requestStateText(request) {
  if (!request) return '';
  switch (request.state) {
    case 'requested':
      return `Removal requested ${formatDate(request.requested_at)}, waiting for the list`;
    case 'cleared': {
      const until = new Date(new Date(request.cleared_at).getTime() + 30 * DAY_MS);
      return `Cleared after ${formatHours(request.hours_to_clear)}, watching for relisting until ${until.toLocaleDateString()}`;
    }
    case 'held':
      return `Cleared after ${formatHours(request.hours_to_clear)} and held for 30 days`;
    case 'relisted': {
      const days = Math.max(0, Math.round((new Date(request.relisted_at) - new Date(request.cleared_at)) / DAY_MS));
      return `Relisted ${days === 0 ? 'the same day' : `${days} day${days === 1 ? '' : 's'}`} after the removal on ${formatDate(request.cleared_at)}: the cause was not fixed`;
    }
    default:
      return '';
  }
}

/** The removal verdict for one listing: whether to ask, and why. */
export function ReadinessVerdict({ listing, compact = false }) {
  const meta = READINESS[listing.readiness] || READINESS.caution;
  return (
    <div className="space-y-1.5">
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className={`font-mono text-sm font-semibold ${meta.tone}`} aria-hidden="true">{meta.code}</span>
        <span className="text-sm font-semibold text-ink">{meta.title}</span>
      </p>
      {listing.evidence && (
        <p className={`text-sm ${listing.fixed === false ? 'text-s5' : 'text-ink'}`}>
          {listing.verifiable ? 'Checked: ' : ''}{listing.evidence}
        </p>
      )}
      {!compact && listing.advice && <p className="text-sm text-ink-2">{listing.advice}</p>}
    </div>
  );
}

/** Why each current listing happened, as far as the list's own documentation says. */
export function WhyListed({ listings }) {
  if (!listings?.length) return null;
  return (
    <section aria-labelledby="why-listed-heading" className="space-y-3">
      <h3 id="why-listed-heading" className="text-sm font-semibold text-ink">Why it is listed</h3>
      <ul className="space-y-3">
        {listings.map((listing) => (
          <li key={listing.provider} className="rounded-lg border border-rule p-4 space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <p className="text-sm font-semibold text-ink">
                {listing.name} <span className="font-mono text-[13px] font-normal text-ink-2">{listing.provider}</span>
              </p>
              {listing.severity && <SeverityTag severity={listing.severity} />}
            </div>
            <div className="space-y-1">
              <p className="text-sm text-ink">
                <span className="font-medium">{listing.label}.</span> {listing.means}
              </p>
              {listing.meanings?.length > 0 && (
                <p className="text-xs text-ink-2">The list says: {listing.meanings.join('; ')}</p>
              )}
            </div>
            <ReadinessVerdict listing={listing} />
            {listing.request && (
              <p className={`text-sm ${listing.request.state === 'relisted' ? 'text-s5 font-medium' : 'text-ink-2'}`}>
                {requestStateText(listing.request)}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Every removal request this asset has had, and how each one turned out. */
export function RemovalHistory({ requests }) {
  if (!requests?.length) return null;
  return (
    <section aria-labelledby="removal-history-heading" className="space-y-2">
      <h3 id="removal-history-heading" className="text-sm font-semibold text-ink">Removal requests</h3>
      <ul className="divide-y divide-rule border-y border-rule">
        {requests.map((request) => (
          <li key={request.id} className="py-2.5 text-sm space-y-0.5">
            <p className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-medium text-ink">{request.name}</span>
              <span className="text-xs text-ink-2 tabular-nums">{formatDate(request.requested_at)}</span>
            </p>
            <p className={request.state === 'relisted' ? 'text-s5' : 'text-ink-2'}>{requestStateText(request)}</p>
            {request.override_reason && (
              <p className="text-xs text-ink-2">
                Requested against a &ldquo;{READINESS[request.readiness]?.code}&rdquo; verdict: {request.override_reason}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

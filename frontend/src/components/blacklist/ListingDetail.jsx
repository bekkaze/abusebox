import { SeverityTag } from '../shared/ui';

/** Why a provider lists the target, and how much it matters. Results saved before 1.3 only say "unknown". */
export default function ListingDetail({ entry }) {
  const meanings = (entry?.categories || []).filter((item) => item !== 'unknown');
  if (!meanings.length) return null;
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink">
      <SeverityTag severity={entry.severity} />
      <span>{meanings.join('; ')}</span>
    </span>
  );
}

// Shared severity styling. Status colors are always paired with an icon and a
// text label wherever they are used.
export const SEVERITY = {
  critical: {
    label: 'Critical',
    text: 'text-rose-600 dark:text-rose-400',
    soft: 'bg-rose-100 dark:bg-rose-900/40',
    badge: 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200',
  },
  warning: {
    label: 'Warning',
    text: 'text-amber-600 dark:text-amber-400',
    soft: 'bg-amber-100 dark:bg-amber-900/40',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200',
  },
  info: {
    label: 'Info',
    text: 'text-sky-600 dark:text-sky-400',
    soft: 'bg-sky-100 dark:bg-sky-900/40',
    badge: 'bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200',
  },
  success: {
    label: 'Resolved',
    text: 'text-emerald-600 dark:text-emerald-400',
    soft: 'bg-emerald-100 dark:bg-emerald-900/40',
    badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200',
  },
  ok: {
    label: 'Healthy',
    text: 'text-emerald-600 dark:text-emerald-400',
    soft: 'bg-emerald-100 dark:bg-emerald-900/40',
    badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200',
  },
};

export const SEVERITY_RANK = { critical: 0, warning: 1, info: 2, ok: 3 };

/** Issues grouped per asset (worst asset first), for compact attention lists. */
export function groupIssuesByAsset(assets) {
  return assets
    .map((asset) => ({
      hostname: asset.hostname,
      hostnameId: asset.id,
      issues: [...(asset.health?.issues || [])].sort((a, b) => (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9)),
    }))
    .filter((group) => group.issues.length)
    .sort((a, b) => (SEVERITY_RANK[a.issues[0].severity] ?? 9) - (SEVERITY_RANK[b.issues[0].severity] ?? 9) || b.issues.length - a.issues.length);
}

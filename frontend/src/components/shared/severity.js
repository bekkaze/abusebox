// Shared severity styling for health issues and activity events. Status colours
// are always paired with an icon or a text label wherever they are used.
export const SEVERITY = {
  critical: { label: 'Critical', text: 'text-s5', soft: 'bg-s5-soft', badge: 'bg-s5-soft text-s5' },
  warning: { label: 'Warning', text: 'text-s4', soft: 'bg-s4-soft', badge: 'bg-s4-soft text-s4' },
  info: { label: 'Info', text: 'text-info', soft: 'bg-info-soft', badge: 'bg-info-soft text-info' },
  success: { label: 'Resolved', text: 'text-s2', soft: 'bg-s2-soft', badge: 'bg-s2-soft text-s2' },
  ok: { label: 'Healthy', text: 'text-s2', soft: 'bg-s2-soft', badge: 'bg-s2-soft text-s2' },
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

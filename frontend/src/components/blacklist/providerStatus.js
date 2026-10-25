const ORDER = { listed: 0, requested: 1, unavailable: 2, clear: 3 };
const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low', 'info'];

/** listed | requested | unavailable | clear for one provider in a DNSBL result. */
export function providerStatus(data, provider) {
  const entry = (data?.detected_on || []).find((item) => item.provider === provider);
  if (entry) return entry.status && entry.status !== 'open' ? 'requested' : 'listed';
  if ((data?.failed_providers || []).includes(provider)) return 'unavailable';
  return 'clear';
}

export function listingFor(data, provider) {
  return (data?.detected_on || []).find((item) => item.provider === provider);
}

function severityRank(data, provider) {
  const rank = SEVERITY_ORDER.indexOf(listingFor(data, provider)?.severity);
  return rank === -1 ? SEVERITY_ORDER.length : rank;
}

/** Listed first, most serious first; then removal requested, no answer, clear. */
export function sortProviders(data) {
  return [...(data?.providers || [])].sort(
    (a, b) => ORDER[providerStatus(data, a)] - ORDER[providerStatus(data, b)]
      || severityRank(data, a) - severityRank(data, b)
      || a.localeCompare(b),
  );
}

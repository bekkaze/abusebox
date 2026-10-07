const ORDER = { listed: 0, requested: 1, unavailable: 2, clear: 3 };

/** listed | requested | unavailable | clear for one provider in a DNSBL result. */
export function providerStatus(data, provider) {
  const entry = (data?.detected_on || []).find((item) => item.provider === provider);
  if (entry) return entry.status && entry.status !== 'open' ? 'requested' : 'listed';
  if ((data?.failed_providers || []).includes(provider)) return 'unavailable';
  return 'clear';
}

export function sortProviders(data) {
  return [...(data?.providers || [])].sort(
    (a, b) => ORDER[providerStatus(data, a)] - ORDER[providerStatus(data, b)] || a.localeCompare(b),
  );
}

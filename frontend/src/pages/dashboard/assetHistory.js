// Helpers for comparing two stored check results.

const CHECK_NAMES = {
  blacklist: 'Blacklist',
  abuseipdb: 'AbuseIPDB',
  dns: 'DNS',
  ssl: 'SSL',
  whois: 'WHOIS',
  email_security: 'SPF/DKIM/DMARC',
  server_status: 'Server status',
};

function blacklistOf(result) {
  if (!result) return null;
  if (result.blacklist) return result.blacklist.error ? null : result.blacklist;
  return result.detected_on || result.providers ? result : null; // results saved before v1.1
}

export function checksRun(result) {
  if (!result) return [];
  if (!Object.keys(CHECK_NAMES).some((key) => key in result) && blacklistOf(result)) return [CHECK_NAMES.blacklist];
  return Object.keys(CHECK_NAMES).filter((key) => key in result).map((key) => CHECK_NAMES[key]);
}

/** Providers newly listed, still listed and removed between two checks. */
export function blacklistDiff(previous, current) {
  const now = blacklistOf(current);
  if (!now) return null;
  const listedNow = new Set((now.detected_on || []).map((d) => d.provider));
  const before = blacklistOf(previous);
  const listedBefore = new Set((before?.detected_on || []).map((d) => d.provider));
  return {
    total: (now.providers || []).length,
    listed: [...listedNow].sort(),
    added: [...listedNow].filter((p) => !listedBefore.has(p)).sort(),
    kept: [...listedNow].filter((p) => listedBefore.has(p)).sort(),
    removed: before ? [...listedBefore].filter((p) => !listedNow.has(p)).sort() : [],
  };
}

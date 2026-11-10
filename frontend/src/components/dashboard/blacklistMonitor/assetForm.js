// Shared by the add/edit asset dialog and the bulk import.

export const CHECK_TOGGLES = [
  { name: "check_blacklist", label: "Blacklist (DNSBL)" },
  { name: "check_abuseipdb", label: "AbuseIPDB" },
  { name: "check_dns", label: "DNS records" },
  { name: "check_ssl", label: "SSL certificate" },
  { name: "check_whois", label: "WHOIS lookup" },
  { name: "check_email_security", label: "SPF / DKIM / DMARC" },
  { name: "check_server_status", label: "Server status" },
];

const IPV4_RE = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
const DOMAIN_RE = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

export function isIpv4(value) {
  return IPV4_RE.test((value || "").trim());
}

// Hand-written IPv6 patterns get the compressed forms wrong. The URL parser
// already implements the grammar, so it decides, and it accepts the bracketed
// form a URL would carry.
export function isIpv6(value) {
  const target = (value || "").trim().replace(/^\[|\]$/g, "");
  if (!target.includes(":")) return false;
  try {
    return new URL(`http://[${target}]`).hostname.startsWith("[");
  } catch {
    return false;
  }
}

export function isDomain(value) {
  return DOMAIN_RE.test((value || "").trim());
}

export function detectHostnameType(value) {
  const target = (value || "").trim();
  if (!target) return "";
  if (isIpv4(target)) return "ipv4";
  if (isIpv6(target)) return "ipv6";
  return "domain";
}

// One label per stored type. Three copies of `=== 'ipv4' ? 'IPv4' : 'Domain'`
// is how an IPv6 asset came to be shown as a domain.
const TYPE_LABELS = { ipv4: "IPv4", ipv6: "IPv6", domain: "Domain" };

export function assetTypeLabel(hostnameType) {
  return TYPE_LABELS[hostnameType] || "Domain";
}

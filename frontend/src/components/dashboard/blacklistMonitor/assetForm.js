// Shared by the add/edit asset dialog.

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

export function detectHostnameType(value) {
  const target = (value || "").trim();
  if (!target) return "";
  return IPV4_RE.test(target) ? "ipv4" : "domain";
}

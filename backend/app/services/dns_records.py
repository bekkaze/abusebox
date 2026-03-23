import socket
from typing import Any


def _resolve_records(domain: str, rdtype: str) -> list[str]:
    """Resolve DNS records using dnspython if available, fallback to socket."""
    try:
        import dns.resolver

        answers = dns.resolver.resolve(domain, rdtype, lifetime=5)
        return [rdata.to_text() for rdata in answers]
    except ImportError:
        if rdtype == "A":
            try:
                results = socket.getaddrinfo(domain, None, socket.AF_INET)
                return list({r[4][0] for r in results})
            except socket.gaierror:
                return []
        return []
    except Exception:
        return []


def lookup_dns_records(domain: str) -> dict[str, Any]:
    domain = (domain or "").strip().lower()
    if not domain:
        return {"error": "Please provide a domain name."}

    # Strip protocol/path
    if "://" in domain:
        from urllib.parse import urlparse

        domain = urlparse(domain).hostname or domain
    domain = domain.split("/")[0].split(":")[0]

    record_types = ["A", "AAAA", "MX", "TXT", "CNAME", "NS", "SOA", "PTR"]
    records: dict[str, list[str]] = {}

    for rtype in record_types:
        result = _resolve_records(domain, rtype)
        if result:
            records[rtype] = result

    return {
        "domain": domain,
        "records": records,
        "record_types_checked": record_types,
    }

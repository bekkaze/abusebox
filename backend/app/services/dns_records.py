import ipaddress
import socket
from typing import Any

from app.core.hosts import extract_host


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


def _reverse_records(address: str) -> list[str]:
    """PTR names for an IP literal, either family."""
    try:
        import dns.resolver

        answers = dns.resolver.resolve_address(address, lifetime=5)
        return [rdata.to_text() for rdata in answers]
    except Exception:
        return []


def lookup_dns_records(domain: str) -> dict[str, Any]:
    domain = extract_host((domain or "").strip().lower())
    if not domain:
        return {"error": "Please provide a domain name."}

    # An address has one record worth having, its PTR, and has to be asked for
    # by its reverse name. Querying the literal itself for PTR asks about a
    # name like "8.8.8.8.", which does not exist, and asking it for A only
    # echoes the address back.
    try:
        ipaddress.ip_address(domain)
    except ValueError:
        pass
    else:
        ptr = _reverse_records(domain)
        return {
            "domain": domain,
            "records": {"PTR": ptr} if ptr else {},
            "record_types_checked": ["PTR"],
        }

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

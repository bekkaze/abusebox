import re
import socket
from typing import Any
from urllib.parse import urlparse

from app.core.network_safety import UnsafeDestinationError, resolve_public_ipv4


# Common WHOIS servers for TLDs
WHOIS_SERVERS: dict[str, str] = {
    "com": "whois.verisign-grs.com",
    "net": "whois.verisign-grs.com",
    "org": "whois.pir.org",
    "info": "whois.afilias.net",
    "io": "whois.nic.io",
    "co": "whois.nic.co",
    "us": "whois.nic.us",
    "uk": "whois.nic.uk",
    "de": "whois.denic.de",
    "fr": "whois.nic.fr",
    "nl": "whois.sidn.nl",
    "eu": "whois.eu",
    "ru": "whois.tcinet.ru",
    "au": "whois.auda.org.au",
    "ca": "whois.cira.ca",
    "br": "whois.registro.br",
    "in": "whois.registry.in",
    "jp": "whois.jprs.jp",
    "cn": "whois.cnnic.cn",
    "me": "whois.nic.me",
    "tv": "whois.nic.tv",
    "cc": "whois.verisign-grs.com",
    "biz": "whois.biz",
    "xyz": "whois.nic.xyz",
    "dev": "whois.nic.google",
    "app": "whois.nic.google",
}

IANA_WHOIS = "whois.iana.org"

_FIELD_MAP = {
    "domain name": "domain_name",
    "registrar": "registrar",
    "registrar url": "registrar_url",
    "creation date": "creation_date",
    "updated date": "updated_date",
    "registry expiry date": "expiry_date",
    "expiration date": "expiry_date",
    "registrar registration expiration date": "expiry_date",
    "name server": "name_servers",
    "nserver": "name_servers",
    "domain status": "status",
    "status": "status",
    "registrant organization": "registrant_org",
    "registrant country": "registrant_country",
    "registrant state/province": "registrant_state",
    "tech email": "tech_email",
    "abuse contact email": "abuse_email",
    "dnssec": "dnssec",
}


def _extract_domain(value: str) -> str | None:
    target = (value or "").strip()
    if not target:
        return None

    if "://" in target:
        parsed = urlparse(target)
        target = parsed.hostname or ""
    elif "/" in target:
        target = target.split("/", 1)[0]

    if ":" in target and target.count(":") == 1:
        host, port = target.rsplit(":", 1)
        if port.isdigit():
            target = host

    target = target.strip().lower()
    # The name is sent as one line to the WHOIS server, so no whitespace or control characters.
    if not target or any(ord(char) <= 0x20 or ord(char) == 0x7F for char in target):
        return None
    return target


def _get_whois_server(domain: str) -> str:
    parts = domain.rsplit(".", 1)
    tld = parts[-1] if len(parts) > 1 else ""
    return WHOIS_SERVERS.get(tld, IANA_WHOIS)


# Real WHOIS answers are a few KB; a server that keeps sending is cut off here.
_MAX_RESPONSE_BYTES = 256 * 1024
_REFERRAL = re.compile(r"^refer:\s*([a-z0-9.-]+)\s*$", re.IGNORECASE | re.MULTILINE)


def _raw_whois(domain: str, server: str, timeout: float = 10.0) -> str:
    # Only public addresses: a referral could otherwise point at an internal host.
    address = resolve_public_ipv4(server)
    with socket.create_connection((address, 43), timeout=timeout) as sock:
        sock.sendall((domain + "\r\n").encode())
        chunks: list[bytes] = []
        size = 0
        while size < _MAX_RESPONSE_BYTES:
            chunk = sock.recv(4096)
            if not chunk:
                break
            chunks.append(chunk)
            size += len(chunk)
    return b"".join(chunks)[:_MAX_RESPONSE_BYTES].decode("utf-8", errors="replace")


def _parse_whois(raw: str) -> dict[str, Any]:
    result: dict[str, Any] = {}
    list_fields = {"name_servers", "status"}

    for line in raw.splitlines():
        line = line.strip()
        if not line or line.startswith("%") or line.startswith("#") or line.startswith(">"):
            continue
        match = re.match(r"^([^:]+):\s*(.*)", line)
        if not match:
            continue
        key = match.group(1).strip().lower()
        val = match.group(2).strip()
        mapped = _FIELD_MAP.get(key)
        if not mapped:
            continue
        if mapped in list_fields:
            existing = result.get(mapped, [])
            if not isinstance(existing, list):
                existing = [existing]
            existing.append(val)
            result[mapped] = existing
        else:
            if mapped not in result:
                result[mapped] = val

    return result


def whois_lookup(hostname: str) -> dict[str, Any]:
    domain = _extract_domain(hostname)
    if not domain:
        return {"error": "Invalid domain or hostname."}

    server = _get_whois_server(domain)
    try:
        raw = _raw_whois(domain, server)
    except UnsafeDestinationError as exc:
        return {"error": f"WHOIS query failed: {exc}"}
    except (socket.timeout, socket.error, OSError) as exc:
        return {"error": f"WHOIS query failed: {exc}"}

    if not raw.strip():
        return {"error": "Empty response from WHOIS server."}

    # IANA answers with a referral to the TLD's own server. Referrals from other
    # servers aren't followed: their text can include registrant-supplied data.
    refer_match = _REFERRAL.search(raw) if server == IANA_WHOIS else None
    if refer_match:
        try:
            raw = _raw_whois(domain, refer_match.group(1))
        except (UnsafeDestinationError, socket.timeout, socket.error, OSError):
            pass  # Fall back to original response.

    parsed = _parse_whois(raw)
    return {
        "domain": domain,
        "whois_server": server,
        "raw": raw,
        **parsed,
    }

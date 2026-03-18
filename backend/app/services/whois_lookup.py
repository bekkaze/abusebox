import re
import socket
from typing import Any
from urllib.parse import urlparse


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
    if not target or " " in target:
        return None
    return target


def _get_whois_server(domain: str) -> str:
    parts = domain.rsplit(".", 1)
    tld = parts[-1] if len(parts) > 1 else ""
    return WHOIS_SERVERS.get(tld, IANA_WHOIS)


def _raw_whois(domain: str, server: str, timeout: float = 10.0) -> str:
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(timeout)
    try:
        sock.connect((server, 43))
        sock.sendall((domain + "\r\n").encode())
        response = b""
        while True:
            chunk = sock.recv(4096)
            if not chunk:
                break
            response += chunk
        return response.decode("utf-8", errors="replace")
    finally:
        sock.close()


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
    except (socket.timeout, socket.error, OSError) as exc:
        return {"error": f"WHOIS query failed: {exc}"}

    if not raw.strip():
        return {"error": "Empty response from WHOIS server."}

    # Some WHOIS servers (like IANA) return a referral to another server.
    refer_match = re.search(r"refer:\s*(\S+)", raw, re.IGNORECASE)
    if refer_match:
        referral_server = refer_match.group(1)
        try:
            raw = _raw_whois(domain, referral_server)
        except (socket.timeout, socket.error, OSError):
            pass  # Fall back to original response.

    parsed = _parse_whois(raw)
    return {
        "domain": domain,
        "whois_server": server,
        "raw": raw,
        **parsed,
    }

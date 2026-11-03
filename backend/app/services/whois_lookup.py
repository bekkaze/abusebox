import logging
import re
import socket
import threading
import time
from typing import Any
from urllib.parse import urlparse

from app.core.config import settings
from app.core.network_safety import UnsafeDestinationError, resolve_public_addresses


logger = logging.getLogger(__name__)

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
    "abuse contact": "abuse_email",
    "domain nameservers": "name_servers",
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


def _query_address(domain: str, address: str, timeout: float) -> str:
    # create_connection picks the family from the literal address, so this
    # works for both IPv4 and IPv6.
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


def _raw_whois(domain: str, server: str, timeout: float | None = None) -> str:
    """Query *server* for *domain*, trying each address family in turn.

    Registries sometimes block one address family for a given client while
    answering it on the other: SIDN (.nl) blocks some IPv4 clients but replies
    over IPv6 (issue #36). The order comes from the system resolver, so a host
    with IPv6 connectivity tries IPv6 first, exactly as the `whois` CLI does.
    """
    if timeout is None:
        timeout = float(settings.whois_timeout_seconds)
    # Only public addresses: a referral could otherwise point at an internal host.
    addresses = resolve_public_addresses(server)

    # One shared budget, split evenly, so a blocked family cannot eat the time
    # the next one needs and the whole lookup still finishes within `timeout`.
    per_attempt = max(timeout / len(addresses), 1.0)
    last_error: Exception | None = None
    for address in addresses:
        try:
            return _query_address(domain, address, per_attempt)
        except (socket.timeout, OSError) as exc:
            last_error = exc
            logger.info("WHOIS %s unreachable at %s: %s", server, address, exc)
    raise last_error if last_error is not None else OSError("No usable address for the WHOIS server.")


# Registries report problems as plain text on port 43, with no status code of
# any kind. SIDN (.nl) sends "Error: ratelimit exceeded" after as little as one
# query. Without this such a reply parses to nothing and is stored, cached and
# shown as a successful but empty lookup.
_ERROR_MARKERS = (
    "ratelimit exceeded",
    "rate limit",
    "rate-limit",
    "quota exceeded",
    "too many requests",
    "excessive querying",
    "query rate exceeded",
    "access denied",
    "query refused",
    "not authorized",
    "service unavailable",
    "try again later",
)
# Only consulted when the answer held no record fields at all, so wording
# inside a real record (a registrar's terms of use, say) is never mistaken
# for a failure.


def _response_error(raw: str) -> str | None:
    """The registry's complaint, if the answer is one instead of a record."""
    for line in raw.strip().splitlines():
        line = line.strip()
        if line and any(marker in line.lower() for marker in _ERROR_MARKERS):
            # Drop the registry's own "Error:" label; the caller adds context.
            return re.sub(r"^(error|warning)\s*:\s*", "", line, flags=re.IGNORECASE)[:200]
    return None


def _parse_whois(raw: str) -> dict[str, Any]:
    """Parse a WHOIS answer into known fields.

    Handles both the common "key: value" form and the indented-block form used
    by SIDN (.nl) and other registries, where a bare "Registrar:" header is
    followed by indented continuation lines holding the actual value:

        Registrar:
           Quickhost B.V.
        Domain nameservers:
           ns1.example.net
           ns2.example.net
    """
    result: dict[str, Any] = {}
    list_fields = {"name_servers", "status"}

    def store(mapped: str, value: str) -> None:
        # A bare header line carries no value; it must not claim the field and
        # block the real value on the lines below it.
        if not value:
            return
        if mapped in list_fields:
            existing = result.get(mapped, [])
            if not isinstance(existing, list):
                existing = [existing]
            if value not in existing:
                existing.append(value)
            result[mapped] = existing
        elif not result.get(mapped):
            result[mapped] = value

    # Field whose indented continuation lines we are currently collecting.
    pending: str | None = None

    for source_line in raw.splitlines():
        line = source_line.strip()
        if not line or line.startswith(("%", "#", ">")):
            pending = None
            continue

        match = re.match(r"^([^:]+):\s*(.*)", line)
        indented = source_line[:1].isspace()

        # A continuation line belonging to the header above it.
        if pending and indented and not match:
            store(pending, line)
            continue

        if not match:
            pending = None
            continue

        key = match.group(1).strip().lower()
        val = match.group(2).strip()
        mapped = _FIELD_MAP.get(key)
        if not mapped:
            pending = None
            continue

        if val:
            store(mapped, val)
            pending = None
        else:
            # Header with no inline value: take the indented lines that follow.
            pending = mapped

    return result


# Registries rate limit, and the scheduler re-checks every asset on its own
# interval, so successful answers are reused for a while (issue #36). Failures
# are not cached: a transient timeout would otherwise stick around.
_cache: dict[str, tuple[float, dict[str, Any]]] = {}
_cache_lock = threading.Lock()
_MAX_CACHE_ENTRIES = 256
# A pathological registry could answer with _MAX_RESPONSE_BYTES every time;
# only ordinary answers are worth keeping in memory.
_MAX_CACHED_RESPONSE_BYTES = 64 * 1024


def _cache_ttl() -> float:
    return max(settings.whois_cache_minutes, 0) * 60.0


def _cache_get(domain: str) -> dict[str, Any] | None:
    ttl = _cache_ttl()
    if ttl <= 0:
        return None
    with _cache_lock:
        entry = _cache.get(domain)
        if entry is None:
            return None
        stored_at, value = entry
        if time.monotonic() - stored_at >= ttl:
            del _cache[domain]
            return None
        return dict(value)


def _cache_put(domain: str, value: dict[str, Any]) -> None:
    ttl = _cache_ttl()
    if ttl <= 0 or len(value.get("raw", "")) > _MAX_CACHED_RESPONSE_BYTES:
        return
    now = time.monotonic()
    with _cache_lock:
        for key in [k for k, (at, _) in _cache.items() if now - at >= ttl]:
            del _cache[key]
        while len(_cache) >= _MAX_CACHE_ENTRIES:
            del _cache[min(_cache, key=lambda k: _cache[k][0])]
        _cache[domain] = (now, dict(value))


def clear_whois_cache() -> None:
    with _cache_lock:
        _cache.clear()


def whois_lookup(hostname: str) -> dict[str, Any]:
    domain = _extract_domain(hostname)
    if not domain:
        return {"error": "Invalid domain or hostname."}

    cached = _cache_get(domain)
    if cached is not None:
        return cached

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
    if not parsed:
        # Nothing recognisable came back, so a complaint here is the whole
        # answer. Returned as an error, which also keeps it out of the cache:
        # the registry is refusing right now, not describing the domain.
        failure = _response_error(raw)
        if failure:
            return {"error": f"WHOIS query failed: {failure}"}

    result = {
        "domain": domain,
        "whois_server": server,
        "raw": raw,
        **parsed,
    }
    _cache_put(domain, result)
    return result

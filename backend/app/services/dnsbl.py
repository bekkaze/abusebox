import ipaddress
import logging
import os
import socket
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any
from urllib.parse import urlparse

import dns.resolver
import dns.name
import dns.rdatatype

logger = logging.getLogger(__name__)

# Every zone here answers the RFC 5782 test point (127.0.0.2). Zones that
# stopped answering it (SORBS, MSRBL, abuse.ch, NiX Spam, WPBL, AUPADS, ...)
# were removed in 1.2.1: they only ever came back as "clean" or "no answer".
BASE_PROVIDERS = [
    "all.s5h.net",
    "b.barracudacentral.org",
    "bl.0spam.org",
    "bl.blocklist.de",
    "bl.nordspam.com",
    "bl.spamcop.net",
    "blackholes.five-ten-sg.com",
    "bogons.cymru.com",
    "cbl.abuseat.org",
    "dnsbl-1.uceprotect.net",
    "dnsbl-2.uceprotect.net",
    "dnsbl-3.uceprotect.net",
    "dnsbl.dronebl.org",
    "dnsbl.spfbl.net",
    "dyna.spamrats.com",
    "ips.backscatterer.org",
    "korea.services.net",
    "noptr.spamrats.com",
    "psbl.surriel.com",
    "rbl.interserver.net",
    "singular.ttk.pte.hu",
    "spam.dnsbl.anonmails.de",
    "spam.spamrats.com",
    "spambot.bls.digibase.ca",
    "spamsources.fabel.dk",
    "truncate.gbudb.net",
    "z.mailspike.net",
    "zen.spamhaus.org",
]

_DNSBL_TIMEOUT = 5.0
_INCONCLUSIVE_FAILURE_RATIO = 0.20

# RFC 5782 test point: every provider above lists 127.0.0.2. When one doesn't,
# it is refusing our resolver (Spamhaus answers NXDOMAIN through some public
# resolvers), so its "not listed" answers mean nothing.
_TEST_POINT = "2.0.0.127"
_TEST_POINT_TTL = 1800.0
_test_point_ok_until: dict[str, float] = {}


def _nameserver_address(value: str) -> str | None:
    # Accept hostnames (e.g. a compose service name) as well as IPs and DoH URLs.
    if "://" in value:
        return value
    try:
        return str(ipaddress.ip_address(value))
    except ValueError:
        pass
    try:
        return socket.gethostbyname(value)
    except OSError:
        logger.warning("DNSBL_NAMESERVERS: cannot resolve %r, skipping it", value)
        return None


def _make_resolver() -> dns.resolver.Resolver:
    resolver = dns.resolver.Resolver()
    resolver.lifetime = _DNSBL_TIMEOUT
    resolver.timeout = _DNSBL_TIMEOUT

    nameservers = os.environ.get("DNSBL_NAMESERVERS", "").strip()
    if nameservers:
        addresses = [_nameserver_address(ns.strip()) for ns in nameservers.split(",") if ns.strip()]
        addresses = [address for address in addresses if address]
        if addresses:
            resolver.nameservers = addresses

    return resolver


def _resolve_ipv4(value: str) -> str | None:
    target = (value or "").strip()
    if not target:
        return None

    if "://" in target:
        parsed = urlparse(target)
        target = parsed.hostname or ""
    elif "/" in target:
        parsed = urlparse(f"//{target}", scheme="http")
        target = parsed.hostname or target.split("/", 1)[0]

    if ":" in target and target.count(":") == 1:
        host, port = target.rsplit(":", 1)
        if port.isdigit():
            target = host
    target = target.strip()
    if not target:
        return None

    try:
        return str(ipaddress.IPv4Address(target))
    except ipaddress.AddressValueError:
        pass

    try:
        return socket.gethostbyname(target)
    except (socket.gaierror, socket.timeout):
        return None


def _check_provider(
    reversed_ip: str,
    provider: str,
    resolver: dns.resolver.Resolver | None = None,
) -> tuple[str, bool, bool]:
    """Check a single DNSBL provider.

    Returns (provider, is_listed, failed).
    """
    if resolver is None:
        resolver = _make_resolver()

    query = f"{reversed_ip}.{provider}"
    try:
        answers = resolver.resolve(query, "A")
        refused = False
        for rdata in answers:
            result = rdata.to_text()
            parts = result.split(".")
            # Only 127.0.0.x responses indicate a real listing.
            if parts[0] == "127" and parts[1] == "0" and parts[2] == "0":
                return provider, True, False
            # 127.255.255.x are error codes (e.g. Spamhaus returns
            # 127.255.255.254 when queried via public DNS resolvers, and
            # .255 when rate limited). The provider refused to answer, so
            # report it as failed rather than silently counting it as clear.
            if parts[:3] == ["127", "255", "255"]:
                refused = True
        return provider, False, refused
    except dns.resolver.NXDOMAIN:
        # NXDOMAIN = not listed on this provider
        return provider, False, False
    except dns.resolver.NoAnswer:
        # No A record = not listed
        return provider, False, False
    except (dns.resolver.NoNameservers, dns.resolver.LifetimeTimeout, dns.exception.DNSException):
        # Actual failures: timeout, servfail, etc.
        return provider, False, True


def _answers_test_point(provider: str, resolver: dns.resolver.Resolver) -> bool:
    if _test_point_ok_until.get(provider, 0.0) > time.monotonic():
        return True
    try:
        _, is_listed, _ = _check_provider(_TEST_POINT, provider, resolver)
    except Exception:
        return False
    # Only successes are cached, so a provider that is refusing us is re-tested
    # on the next check instead of staying "no answer" for half an hour.
    if is_listed:
        _test_point_ok_until[provider] = time.monotonic() + _TEST_POINT_TTL
    return is_listed


def check_dnsbl_providers(hostname_or_ip: str) -> dict[str, Any]:
    resolved_ip = _resolve_ipv4(hostname_or_ip)
    if not resolved_ip:
        return {
            "detected_on": [],
            "providers": BASE_PROVIDERS,
            "failed_providers": [],
            "is_blacklisted": False,
            "hostname": hostname_or_ip,
            "categories": [],
            "error": "Unable to resolve hostname to IPv4 address",
        }

    reversed_ip = ".".join(reversed(resolved_ip.split(".")))
    listed: set[str] = set()
    failed_providers: set[str] = set()
    resolver = _make_resolver()

    def _run_batch(providers: list[str] | set[str]) -> None:
        with ThreadPoolExecutor(max_workers=12) as executor:
            future_map = {
                executor.submit(_check_provider, reversed_ip, provider, resolver): provider
                for provider in providers
            }
            for future in as_completed(future_map):
                provider = future_map[future]
                try:
                    _, is_listed, failed = future.result()
                    if is_listed:
                        listed.add(provider)
                        failed_providers.discard(provider)
                    elif failed:
                        failed_providers.add(provider)
                except Exception:
                    failed_providers.add(provider)

    # First pass: query all providers concurrently.
    _run_batch(BASE_PROVIDERS)

    # Retry pass: providers that timed out may succeed on a second attempt
    # when there is less concurrent load on the resolver.
    if failed_providers:
        retry = set(failed_providers)
        failed_providers.clear()
        _run_batch(retry)

    # A clean answer only counts if the provider still answers its test point.
    clean = [p for p in BASE_PROVIDERS if p not in listed and p not in failed_providers]
    with ThreadPoolExecutor(max_workers=12) as executor:
        healthy = executor.map(lambda provider: _answers_test_point(provider, resolver), clean)
        for provider, ok in zip(clean, healthy):
            if not ok:
                failed_providers.add(provider)

    detected_on = [
        {
            "provider": provider,
            "categories": ["unknown"],
            "status": "open",
        }
        for provider in BASE_PROVIDERS
        if provider in listed
    ]

    return {
        "detected_on": detected_on,
        "providers": BASE_PROVIDERS,
        "failed_providers": sorted(failed_providers),
        # When too many providers fail (resolver blocked, network outage) a
        # "clean" result can't be trusted, so callers keep the previous status.
        "is_inconclusive": len(failed_providers) >= max(3, int(len(BASE_PROVIDERS) * _INCONCLUSIVE_FAILURE_RATIO)),
        "is_blacklisted": bool(detected_on),
        "hostname": hostname_or_ip,
        "categories": ["unknown"] if detected_on else [],
    }

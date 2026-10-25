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

# Every zone here answers the RFC 5782 test points (127.0.0.2 listed, 127.0.0.1
# not listed). Zones that stopped answering them (SORBS, MSRBL, abuse.ch, NiX
# Spam, WPBL, AUPADS, ...) were removed in 1.2.1. Removed in 1.2.2 as noise:
# bogons.cymru.com (unallocated space, not abusers), blackholes.five-ten-sg.com
# (retired, lists nothing), cbl.abuseat.org (now Spamhaus XBL, already in zen),
# korea.services.net (a country block) and UCEPROTECT levels 2/3 (whole
# networks and ASNs, mostly innocent neighbours).
BASE_PROVIDERS = [
    "all.s5h.net",
    "b.barracudacentral.org",
    "bl.0spam.org",
    "bl.blocklist.de",
    "bl.nordspam.com",
    "bl.spamcop.net",
    "dnsbl-1.uceprotect.net",
    "dnsbl.dronebl.org",
    "dnsbl.spfbl.net",
    "dyna.spamrats.com",
    "ips.backscatterer.org",
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

# RFC 5782 test points: every provider above lists 127.0.0.2 and must not list
# 127.0.0.1. A provider that doesn't list 127.0.0.2 is refusing our resolver
# (Spamhaus answers NXDOMAIN through some public resolvers), so its "not
# listed" answers mean nothing. One that lists 127.0.0.1 is listing everything
# (AHBL did this when it shut down in 2015), so its listings mean nothing.
_TEST_POINT_LISTED = "2.0.0.127"
_TEST_POINT_NOT_LISTED = "1.0.0.127"
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
        for rdata in answers:
            # Only 127.0.0.x responses indicate a real listing.
            if rdata.to_text().startswith("127.0.0."):
                return provider, True, False
        # Anything else is an error, not a clean result: 127.255.255.x are
        # refusal codes (Spamhaus returns .254 via public resolvers and .255
        # when rate limited), and an address outside 127/8 means the zone's
        # domain now points somewhere else (e.g. an expired, parked domain).
        return provider, False, True
    except dns.resolver.NXDOMAIN:
        # NXDOMAIN = not listed on this provider
        return provider, False, False
    except dns.resolver.NoAnswer:
        # No A record = not listed
        return provider, False, False
    except (dns.resolver.NoNameservers, dns.resolver.LifetimeTimeout, dns.exception.DNSException):
        # Actual failures: timeout, servfail, etc.
        return provider, False, True


def _answers_test_points(provider: str, resolver: dns.resolver.Resolver) -> bool:
    if _test_point_ok_until.get(provider, 0.0) > time.monotonic():
        return True
    try:
        _, positive_listed, _ = _check_provider(_TEST_POINT_LISTED, provider, resolver)
        healthy = positive_listed
        if healthy:
            _, negative_listed, negative_failed = _check_provider(_TEST_POINT_NOT_LISTED, provider, resolver)
            healthy = not negative_listed and not negative_failed
    except Exception:
        return False
    # Only successes are cached, so a provider that is refusing us is re-tested
    # on the next check instead of staying "no answer" for half an hour.
    if healthy:
        _test_point_ok_until[provider] = time.monotonic() + _TEST_POINT_TTL
    return healthy


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

    # An answer, listed or clean, only counts if the provider still answers
    # its test points correctly.
    answered = [p for p in BASE_PROVIDERS if p not in failed_providers]
    with ThreadPoolExecutor(max_workers=12) as executor:
        healthy = executor.map(lambda provider: _answers_test_points(provider, resolver), answered)
        for provider, ok in zip(answered, healthy):
            if not ok:
                listed.discard(provider)
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

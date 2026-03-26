import ipaddress
import os
import socket
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any
from urllib.parse import urlparse

import dns.resolver
import dns.name
import dns.rdatatype

BASE_PROVIDERS = [
    "all.s5h.net",
    "aspews.ext.sorbs.net",
    "b.barracudacentral.org",
    "bl.nordspam.com",
    "bl.spamcop.net",
    "blackholes.five-ten-sg.com",
    "blacklist.woody.ch",
    "bogons.cymru.com",
    "cbl.abuseat.org",
    "combined.abuse.ch",
    "combined.rbl.msrbl.net",
    "db.wpbl.info",
    "dnsbl-1.uceprotect.net",
    "dnsbl-2.uceprotect.net",
    "dnsbl-3.uceprotect.net",
    "dnsbl.cyberlogic.net",
    "dnsbl.dronebl.org",
    "dnsbl.sorbs.net",
    "drone.abuse.ch",
    "duinv.aupads.org",
    "dul.dnsbl.sorbs.net",
    "dyna.spamrats.com",
    "http.dnsbl.sorbs.net",
    "images.rbl.msrbl.net",
    "ips.backscatterer.org",
    "ix.dnsbl.manitu.net",
    "korea.services.net",
    "matrix.spfbl.net",
    "misc.dnsbl.sorbs.net",
    "noptr.spamrats.com",
    "orvedb.aupads.org",
    "phishing.rbl.msrbl.net",
    "proxy.bl.gweep.ca",
    "proxy.block.transip.nl",
    "psbl.surriel.com",
    "rbl.interserver.net",
    "relays.bl.gweep.ca",
    "relays.bl.kundenserver.de",
    "relays.nether.net",
    "residential.block.transip.nl",
    "singular.ttk.pte.hu",
    "smtp.dnsbl.sorbs.net",
    "socks.dnsbl.sorbs.net",
    "spam.abuse.ch",
    "spam.dnsbl.anonmails.de",
    "spam.dnsbl.sorbs.net",
    "spam.rbl.msrbl.net",
    "spam.spamrats.com",
    "spambot.bls.digibase.ca",
    "spamrbl.imp.ch",
    "spamsources.fabel.dk",
    "ubl.lashback.com",
    "virbl.bit.nl",
    "virus.rbl.msrbl.net",
    "virus.rbl.jp",
    "web.dnsbl.sorbs.net",
    "wormrbl.imp.ch",
    "z.mailspike.net",
    "zen.spamhaus.org",
    "zombie.dnsbl.sorbs.net",
]

_DNSBL_TIMEOUT = 5.0


def _make_resolver() -> dns.resolver.Resolver:
    resolver = dns.resolver.Resolver()
    resolver.lifetime = _DNSBL_TIMEOUT
    resolver.timeout = _DNSBL_TIMEOUT

    nameservers = os.environ.get("DNSBL_NAMESERVERS", "").strip()
    if nameservers:
        resolver.nameservers = [ns.strip() for ns in nameservers.split(",") if ns.strip()]

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
            result = rdata.to_text()
            parts = result.split(".")
            # Only 127.0.0.x responses indicate a real listing.
            # 127.255.255.x are error/informational codes (e.g. Spamhaus
            # returns 127.255.255.252 when queried via unsupported public
            # DNS resolvers, CBL returns similar codes for rate limits).
            if parts[0] == "127" and parts[1] == "0" and parts[2] == "0":
                return provider, True, False
        return provider, False, False
    except dns.resolver.NXDOMAIN:
        # NXDOMAIN = not listed on this provider
        return provider, False, False
    except dns.resolver.NoAnswer:
        # No A record = not listed
        return provider, False, False
    except (dns.resolver.NoNameservers, dns.resolver.LifetimeTimeout, dns.exception.DNSException):
        # Actual failures: timeout, servfail, etc.
        return provider, False, True


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
        "is_blacklisted": bool(detected_on),
        "hostname": hostname_or_ip,
        "categories": ["unknown"] if detected_on else [],
    }

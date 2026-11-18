"""Blacklist lookups: build the query, read the answer, decide if it counts.

The catalogue of lists and what their codes mean is in `dnsbl_lists`. Nothing
here branches on a particular zone; a list describes itself and this module
follows what it says.
"""

import ipaddress
import logging
import os
import secrets
import socket
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any
from urllib.parse import urlparse

import dns.resolver

from app.core.hosts import extract_host as _extract_host

# Re-exported so every existing import of `app.services.dnsbl` keeps working.
from app.services.dnsbl_lists import (
    BASE_PROVIDERS,
    DNSBL_LISTS,
    DOMAIN_PROVIDERS,
    LISTS_BY_ZONE,
    SEVERITIES,
    DnsblList,
    _api_key,
    providers_for,
)

logger = logging.getLogger(__name__)

__all__ = [
    "BASE_PROVIDERS",
    "DNSBL_LISTS",
    "DOMAIN_PROVIDERS",
    "LISTS_BY_ZONE",
    "REFUSED",
    "SEVERITIES",
    "UNREACHABLE",
    "DnsblList",
    "check_dnsbl_providers",
    "describe_listing",
    "providers_for",
    "resolver_health",
    "resolver_source",
    "reverse_ipv4",
    "reverse_ipv6",
    "target_address",
    "test_points_for",
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
# RFC 5782 section 5: the IPv6 test points are ::FFFF:7F00:2 and ::FFFF:7F00:1,
# written as reversed nibbles like any other IPv6 query.
_TEST_POINT_LISTED_V6 = "2.0.0.0.0.0.f.7.f.f.f.f.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0"
_TEST_POINT_NOT_LISTED_V6 = "1.0.0.0.0.0.f.7.f.f.f.f.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0"
_TEST_POINT_TTL = 1800.0
_test_point_ok_until: dict[str, float] = {}

# Why a provider gave no usable answer. Refusals (rate limited, blocked
# resolver, broken zone) aren't retried: asking again only makes it worse.
REFUSED = "refused"
UNREACHABLE = "unreachable"


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


def _configured_nameservers() -> list[str]:
    """DNSBL_NAMESERVERS, resolved to addresses (empty: use the system resolver)."""
    nameservers = os.environ.get("DNSBL_NAMESERVERS", "").strip()
    addresses = [_nameserver_address(ns.strip()) for ns in nameservers.split(",") if ns.strip()]
    return [address for address in addresses if address]


def _build_resolver(nameservers: list[str] | None) -> dns.resolver.Resolver:
    resolver = dns.resolver.Resolver()
    resolver.lifetime = _DNSBL_TIMEOUT
    resolver.timeout = _DNSBL_TIMEOUT
    if nameservers:
        resolver.nameservers = nameservers
    return resolver


# Which resolver blacklist lookups use, re-decided every half hour.
_RESOLVER_CHOICE_TTL = 1800.0
_resolver_choice: dict[str, Any] = {"until": 0.0, "configured": None, "nameservers": None, "source": "system"}
_resolver_choice_lock = threading.Lock()


def _answers_spamhaus(resolver: dns.resolver.Resolver) -> bool:
    codes, failure = _lookup(_TEST_POINT_LISTED, "zen.spamhaus.org", resolver)
    return bool(codes) and failure is None


def _make_resolver() -> dns.resolver.Resolver:
    """The resolver for blacklist lookups: DNSBL_NAMESERVERS when it works.

    The Docker setup points DNSBL_NAMESERVERS at its bundled Unbound. Some
    networks block the direct DNS traffic a recursive resolver needs, so when
    the configured resolver can't get Spamhaus's test answer but the system
    resolver can, the system resolver is used instead. When neither works the
    configured one is kept, and checks report "No answer".
    """
    configured = _configured_nameservers()
    if not configured:
        return _build_resolver(None)
    with _resolver_choice_lock:
        now = time.monotonic()
        if _resolver_choice["configured"] != configured or _resolver_choice["until"] <= now:
            chosen, source = configured, "configured"
            if not _answers_spamhaus(_build_resolver(configured)) and _answers_spamhaus(_build_resolver(None)):
                logger.warning(
                    "DNSBL_NAMESERVERS (%s) can't get answers from Spamhaus but the system resolver can; "
                    "using the system resolver for blacklist lookups.", ", ".join(configured),
                )
                chosen, source = None, "system"
            _resolver_choice.update(until=now + _RESOLVER_CHOICE_TTL, configured=configured, nameservers=chosen, source=source)
        return _build_resolver(_resolver_choice["nameservers"])


def resolver_source() -> str:
    """"configured" (DNSBL_NAMESERVERS) or "system", for the resolver last chosen."""
    if not _configured_nameservers():
        return "system"
    return _resolver_choice["source"]


def reverse_ipv6(address: str) -> str:
    """An IPv6 address as 32 reversed nibbles (RFC 5782 section 2.4).

    ``2001:db8::1`` becomes
    ``1.0.0.0.<...>.8.b.d.0.1.0.0.2``, which is what every IPv6 zone expects.
    """
    # From the packed bytes, not the text form: a v4-mapped address such as
    # ::ffff:7f00:2 renders as "::ffff:127.0.0.2", so stripping colons out of
    # `exploded` would leave the dotted quad embedded in the query. The IPv6
    # test points are exactly that shape, so this is not a corner case.
    return ".".join(reversed(ipaddress.IPv6Address(address).packed.hex()))


def reverse_ipv4(address: str) -> str:
    return ".".join(reversed(address.split(".")))


def _parse_address(host: str) -> tuple[str | None, str]:
    """(normalised address, family) when *host* is a literal IP, else (None, "")."""
    try:
        parsed = ipaddress.ip_address(host)
    except ValueError:
        return None, ""
    return str(parsed), ("ipv6" if parsed.version == 6 else "ipv4")


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
    except (TimeoutError, socket.gaierror):
        return None


# A DNS name is 253 characters at most. A domain zone appends its own suffix
# to the name being asked about, so a long name can push the query past the
# limit; the zone is not at fault and must not be recorded as "no answer".
_MAX_DNS_NAME = 253


def target_address(value: str) -> tuple[str | None, str]:
    """The address *value* will be checked at, and its family.

    An IP literal is used as given, of either family. A name is resolved to
    IPv4, which is what the blacklists answer for. Returns ``(None, "")`` when
    a name does not resolve.
    """
    host = _extract_host(value)
    address, family = _parse_address(host)
    if address:
        return address, family
    resolved = _resolve_ipv4(value)
    return (resolved, "ipv4") if resolved else (None, "")


def _query_zone(provider: str) -> str:
    """The hostname to actually query, which differs when a key is configured.

    A key is never logged: it is part of the query name, so it reaches the
    operator's resolver by design, but nothing here writes the query out.
    """
    meta = LISTS_BY_ZONE.get(provider)
    if meta is None:
        return provider
    key = _api_key(meta)
    if key and meta.keyed_zone:
        return meta.keyed_zone.format(key=key)
    return provider


def _lookup(
    reversed_ip: str,
    provider: str,
    resolver: dns.resolver.Resolver,
) -> tuple[list[str], str | None]:
    """Query one provider. Returns (listing codes, failure).

    failure is None when the provider answered, else REFUSED or UNREACHABLE.
    """
    meta = LISTS_BY_ZONE.get(provider)
    ignored = meta.ignored if meta else frozenset()
    prefix = meta.prefix if meta else "127.0.0."
    refusals = meta.refusals if meta else frozenset()
    query = f"{reversed_ip}.{_query_zone(provider)}"
    try:
        answers = [rdata.to_text() for rdata in resolver.resolve(query, "A")]
    except dns.resolver.NXDOMAIN:
        # NXDOMAIN = not listed on this provider
        return [], None
    except dns.resolver.NoAnswer:
        # No A record = not listed
        return [], None
    except (dns.resolver.NoNameservers, dns.resolver.LifetimeTimeout, dns.exception.DNSException):
        # Actual failures: timeout, servfail, etc.
        return [], UNREACHABLE

    # Only answers inside this zone's own block indicate a real listing.
    # Spamhaus DBL uses 127.0.1.x; everything else 127.0.0.x.
    in_range = [answer for answer in answers if answer.startswith(prefix)]
    if in_range:
        # SURBL and URIBL answer 127.0.0.1 to say they are refusing the query,
        # which sits inside the listing block. Read as a listing it would mark
        # every domain checked, so it is a failure, not a finding.
        if any(answer in refusals for answer in in_range):
            return [], REFUSED
        return sorted((answer for answer in in_range if answer not in ignored), key=ipaddress.IPv4Address), None
    # Anything else is an error, not a clean result: 127.255.255.x are
    # refusal codes (Spamhaus returns .254 via public resolvers and .255
    # when rate limited), and an address outside 127/8 means the zone's
    # domain now points somewhere else (e.g. an expired, parked domain).
    return [], REFUSED


def _check_provider(
    reversed_ip: str,
    provider: str,
    resolver: dns.resolver.Resolver | None = None,
) -> tuple[str, bool, str | None]:
    """Check a single DNSBL provider.

    Returns (provider, is_listed, failure), where failure is None when the
    provider answered, else REFUSED or UNREACHABLE.
    """
    codes, failure = _lookup(reversed_ip, provider, resolver or _make_resolver())
    return provider, bool(codes), failure


def _decode_bits(meta: DnsblList, codes: list[str]) -> list[tuple[str, ...]]:
    """Decode a bitmask answer into every sublist it names.

    SURBL and URIBL put each sublist a domain is on in one bit of the final
    octet, so 127.0.0.80 from SURBL is malware (16) and abuse (64) together,
    not an unknown code.
    """
    decoded: list[tuple[str, str]] = []
    for code in codes:
        try:
            value = int(code.rsplit(".", 1)[1])
        except (IndexError, ValueError):
            continue
        for bit in sorted(meta.bits):
            if value & bit:
                decoded.append(meta.bits[bit])
    return decoded


def describe_listing(provider: str, codes: list[str]) -> dict[str, Any]:
    """What a provider's listing codes mean, how serious they are, and why.

    ``causes`` is every cause the codes name, falling back to the list's own,
    and empty for a list no longer in the catalogue: one that is not known is
    not guessed at.
    """
    meta = LISTS_BY_ZONE.get(provider)
    if meta is None:
        return {"name": provider, "severity": "low", "meanings": ["listed"], "causes": []}
    if meta.bits:
        decoded = _decode_bits(meta, codes)
    else:
        decoded = [meta.codes[code] for code in codes if code in meta.codes]
    meanings = [entry[0] for entry in decoded] or [meta.meaning]
    severities = [entry[1] for entry in decoded] or [meta.severity]
    causes = [entry[2] if len(entry) > 2 else meta.cause for entry in decoded] or [meta.cause]
    return {
        "name": meta.name,
        "severity": min(severities, key=SEVERITIES.index),
        "meanings": list(dict.fromkeys(meanings)),
        "causes": list(dict.fromkeys(causes)),
    }


def test_points_for(meta: DnsblList, family: str = "ipv4") -> tuple[str, str]:
    """The (must be listed, must not be listed) pair for one zone.

    A domain zone publishes a name that is always listed, but nothing that is
    guaranteed never to be. A random label under `.invalid` serves: RFC 2606
    reserves the TLD, so it can never be registered and can never legitimately
    appear on a blocklist. A zone that calls it listed is listing everything,
    which is exactly what the negative test is for.
    """
    if meta.kind == "domain":
        return meta.test_listed, f"{secrets.token_hex(8)}.invalid"
    if family == "ipv6":
        return _TEST_POINT_LISTED_V6, _TEST_POINT_NOT_LISTED_V6
    return _TEST_POINT_LISTED, _TEST_POINT_NOT_LISTED


def _answers_test_points(provider: str, resolver: dns.resolver.Resolver, family: str = "ipv4") -> bool:
    meta = LISTS_BY_ZONE.get(provider)
    # Keyed per family: a zone can answer IPv4 correctly and refuse IPv6.
    cache_key = f"{provider}|{family}"
    if _test_point_ok_until.get(cache_key, 0.0) > time.monotonic():
        return True
    listed_point, clean_point = test_points_for(meta, family) if meta else (_TEST_POINT_LISTED, _TEST_POINT_NOT_LISTED)
    if not listed_point:
        # Nothing published to test against. Trusting it is the only option,
        # and saying so here beats pretending the check happened.
        return True
    try:
        _, positive_listed, _ = _check_provider(listed_point, provider, resolver)
        healthy = positive_listed
        if healthy:
            _, negative_listed, negative_failed = _check_provider(clean_point, provider, resolver)
            healthy = not negative_listed and not negative_failed
    except Exception:
        return False
    # Only successes are cached, so a provider that is refusing us is re-tested
    # on the next check instead of staying "no answer" for half an hour.
    if healthy:
        _test_point_ok_until[cache_key] = time.monotonic() + _TEST_POINT_TTL
    return healthy


_RESOLVER_FAILURE_TTL = 300.0
_resolver_health: dict[str, Any] = {"until": 0.0, "result": None}


def resolver_health() -> dict[str, Any]:
    """Whether Spamhaus answers the resolver AbuseBox uses.

    Spamhaus refuses public resolvers (Google, Cloudflare), and resolvers with
    DNS rebinding protection drop its 127.0.0.x answers, so this is the most
    common reason blacklist results can't be trusted.
    """
    now = time.monotonic()
    if _resolver_health["result"] is not None and _resolver_health["until"] > now:
        return _resolver_health["result"]
    provider = "zen.spamhaus.org"
    ok = _answers_test_points(provider, _make_resolver())
    result = {"ok": ok, "provider": provider, "resolver": resolver_source()}
    # A failure is re-tested after a few minutes, not on every page load.
    _resolver_health.update(until=now + (_TEST_POINT_TTL if ok else _RESOLVER_FAILURE_TTL), result=result)
    return result


def check_dnsbl_providers(hostname_or_ip: str, resolved_ip: str | None = None) -> dict[str, Any]:
    """Check *hostname_or_ip* on every list that applies to it.

    What applies depends on the target. An IPv4 address goes to the IPv4
    zones, an IPv6 address to the far smaller set that answers nibble queries,
    and a name goes to the domain zones **as well as** the IP zones for the
    address it resolves to, because a domain can be clean at its address and
    still be listed by name.

    A zone that does not answer for the family is left unqueried rather than
    recorded as "no answer": an IPv4-only zone saying nothing about an IPv6
    address is not a failure on its part.

    Pass *resolved_ip* when the caller already resolved (and vetted) the
    address, so it is not resolved again.
    """
    host = _extract_host(hostname_or_ip)
    address, family = _parse_address(host)
    domain = None if address else (host or None)

    if address is None:
        address = resolved_ip or _resolve_ipv4(hostname_or_ip)
        if address:
            _, detected = _parse_address(address)
            family = detected or "ipv4"

    # (zones, query label, family for the test points)
    plan: list[tuple[list[str], str, str]] = []
    if address:
        label = reverse_ipv6(address) if family == "ipv6" else reverse_ipv4(address)
        ip_zones = providers_for("ip", family)
        if ip_zones:
            plan.append((ip_zones, label, family))
    if domain:
        domain_zones = [
            zone for zone in providers_for("domain")
            if len(domain) + 1 + len(_query_zone(zone)) <= _MAX_DNS_NAME
        ]
        if domain_zones:
            plan.append((domain_zones, domain, "domain"))

    queried = sorted({zone for zones, _, _ in plan for zone in zones})
    if not plan:
        return {
            "detected_on": [],
            "providers": [],
            "failed_providers": [],
            "is_blacklisted": False,
            "hostname": hostname_or_ip,
            "categories": [],
            "error": "Unable to resolve hostname to an IP address",
        }

    listed: dict[str, list[str]] = {}
    failed_providers: set[str] = set()
    refused: set[str] = set()
    resolver = _make_resolver()

    def _run_batch(providers: list[str] | set[str], label: str) -> None:
        with ThreadPoolExecutor(max_workers=12) as executor:
            future_map = {
                executor.submit(_lookup, label, provider, resolver): provider
                for provider in providers
            }
            for future in as_completed(future_map):
                provider = future_map[future]
                try:
                    codes, failure = future.result()
                    if codes:
                        listed[provider] = codes
                        failed_providers.discard(provider)
                    elif failure:
                        failed_providers.add(provider)
                        if failure == REFUSED:
                            refused.add(provider)
                except Exception:
                    failed_providers.add(provider)

    for zones, label, _family in plan:
        # First pass: query every applicable zone concurrently.
        _run_batch(zones, label)
        # Retry pass: zones that timed out may succeed on a second attempt
        # when there is less concurrent load on the resolver. Refusals are
        # never retried; asking again only makes a rate limit worse.
        retry = {z for z in zones if z in failed_providers} - refused
        if retry:
            failed_providers.difference_update(retry)
            _run_batch(retry, label)

    # An answer, listed or clean, only counts if the zone still answers its
    # own test points for this family.
    for zones, _label, test_family in plan:
        answered = [z for z in zones if z not in failed_providers]
        if not answered:
            continue
        with ThreadPoolExecutor(max_workers=12) as executor:
            # test_family bound now, not when the lambda runs: it changes per plan.
            healthy = executor.map(lambda z, fam=test_family: _answers_test_points(z, resolver, fam), answered)
            for provider, ok in zip(answered, healthy, strict=True):
                if not ok:
                    listed.pop(provider, None)
                    failed_providers.add(provider)

    detected_on = []
    for provider in queried:
        if provider not in listed:
            continue
        listing = describe_listing(provider, listed[provider])
        detected_on.append({
            "provider": provider,
            "name": listing["name"],
            "codes": listed[provider],
            "severity": listing["severity"],
            "categories": listing["meanings"],
            "status": "open",
        })
    # Most serious first.
    detected_on.sort(key=lambda entry: SEVERITIES.index(entry["severity"]))

    return {
        "detected_on": detected_on,
        "providers": queried,
        "failed_providers": sorted(failed_providers),
        # When too many providers fail (resolver blocked, network outage) a
        # "clean" result can't be trusted, so callers keep the previous status.
        "is_inconclusive": len(failed_providers) >= max(3, int(len(queried) * _INCONCLUSIVE_FAILURE_RATIO)),
        "is_blacklisted": bool(detected_on),
        "hostname": hostname_or_ip,
        "checked_address": address,
        "address_family": family if address else None,
        "checked_domain": domain,
        "severity": detected_on[0]["severity"] if detected_on else None,
        "categories": list(dict.fromkeys(c for entry in detected_on for c in entry["categories"])),
    }

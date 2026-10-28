import ipaddress
import logging
import os
import socket
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from typing import Any
from urllib.parse import urlparse

import dns.resolver
import dns.name
import dns.rdatatype

logger = logging.getLogger(__name__)

SEVERITIES = ("critical", "high", "medium", "low", "info")


@dataclass(frozen=True)
class DnsblList:
    zone: str
    name: str
    severity: str  # of a listing whose code has no entry in `codes`
    meaning: str
    # Listing code -> (meaning, severity), for lists that say why they list.
    codes: dict[str, tuple[str, str]] = field(default_factory=dict)
    # 127.0.0.x answers that are not listings (e.g. a neutral reputation).
    ignored: frozenset[str] = frozenset()


_ZEN_XBL = ("XBL: compromised host or botnet", "critical")

# Every zone here answers the RFC 5782 test points (127.0.0.2 listed, 127.0.0.1
# not listed). Severity follows how much weight mail filters give a list
# (SpamAssassin and Rspamd defaults) and what its codes mean, not how alarming
# its name sounds. Zones that stopped answering the test points (SORBS, MSRBL,
# abuse.ch, NiX Spam, WPBL, AUPADS, ...) were removed in 1.2.1, and lists that
# only added noise (bogons.cymru.com, blackholes.five-ten-sg.com,
# cbl.abuseat.org, korea.services.net, UCEPROTECT levels 2/3) in 1.2.2.
DNSBL_LISTS = [
    DnsblList("zen.spamhaus.org", "Spamhaus ZEN", "critical", "listed by Spamhaus", codes={
        "127.0.0.2": ("SBL: spam source", "critical"),
        "127.0.0.3": ("CSS: snowshoe spam source", "critical"),
        "127.0.0.4": _ZEN_XBL,
        "127.0.0.5": _ZEN_XBL,
        "127.0.0.6": _ZEN_XBL,
        "127.0.0.7": _ZEN_XBL,
        "127.0.0.9": ("DROP: hijacked or criminal network", "critical"),
        # PBL is policy, not reputation, but Microsoft 365 and others reject on it.
        "127.0.0.10": ("PBL: end-user range, listed by its ISP", "high"),
        "127.0.0.11": ("PBL: end-user range, listed by Spamhaus", "high"),
    }),
    DnsblList("b.barracudacentral.org", "Barracuda", "high", "poor sending reputation"),
    DnsblList("bl.spamcop.net", "SpamCop", "medium", "reported spam source"),
    DnsblList("bl.mailspike.net", "Mailspike", "medium", "poor sending reputation", codes={
        "127.0.0.2": ("zero-hour spam source", "medium"),
        "127.0.0.10": ("worst reputation (L5)", "medium"),
        "127.0.0.11": ("very bad reputation (L4)", "medium"),
        "127.0.0.12": ("bad reputation (L3)", "low"),
    }, ignored=frozenset({"127.0.0.13"})),  # L2 is neutral
    DnsblList("psbl.surriel.com", "PSBL", "medium", "spamtrap hits"),
    DnsblList("bl.blocklist.de", "blocklist.de", "medium", "attack source (fail2ban reports)"),
    DnsblList("bip.virusfree.cz", "VirusFree", "medium", "botnet source"),
    DnsblList("spam.spamrats.com", "SpamRATS Spam", "medium", "spam source"),
    DnsblList("bl.spameatingmonkey.net", "SpamEatingMonkey", "low", "spamtrap hits, or end-user range by policy"),
    DnsblList("dnsbl-1.uceprotect.net", "UCEPROTECT level 1", "low", "spamtrap hits from this IP"),
    DnsblList("dnsbl.dronebl.org", "DroneBL", "low", "botnet, open proxy or drone"),
    DnsblList("dyna.spamrats.com", "SpamRATS Dyna", "low", "policy: reverse DNS looks dynamic"),
    DnsblList("noptr.spamrats.com", "SpamRATS NoPtr", "low", "policy: no reverse DNS"),
    DnsblList("all.s5h.net", "s5h.net", "low", "spam source"),
    DnsblList("bl.0spam.org", "0spam", "low", "spam source"),
    DnsblList("bl.nordspam.com", "NordSpam", "low", "spam source"),
    DnsblList("rbl.interserver.net", "InterServer", "low", "abuse reports"),
    DnsblList("singular.ttk.pte.hu", "TTK", "low", "spam source"),
    DnsblList("spam.dnsbl.anonmails.de", "anonmails.de", "low", "spam source"),
    DnsblList("spambot.bls.digibase.ca", "Digibase", "low", "spambot"),
    DnsblList("truncate.gbudb.net", "GBUdb Truncate", "low", "spam source"),
    DnsblList("ips.backscatterer.org", "Backscatterer", "info", "backscatter: bounces to forged senders"),
    DnsblList("dnsbl.spfbl.net", "SPFBL", "info", "bad reputation (for scoring only)"),
    DnsblList("spamsources.fabel.dk", "fabel.dk", "info", "spam source (may list whole networks)"),
]
LISTS_BY_ZONE = {item.zone: item for item in DNSBL_LISTS}
BASE_PROVIDERS = sorted(LISTS_BY_ZONE)

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


def _query_zone(provider: str) -> str:
    # With a Spamhaus Data Query Service key, ask the keyed mirror instead of
    # the public one (required for commercial use, including ISPs).
    key = os.environ.get("SPAMHAUS_DQS_KEY", "").strip()
    if key and provider == "zen.spamhaus.org":
        return f"{key}.zen.dq.spamhaus.net"
    return provider


def _lookup(
    reversed_ip: str,
    provider: str,
    resolver: dns.resolver.Resolver,
) -> tuple[list[str], str | None]:
    """Query one provider. Returns (listing codes, failure).

    failure is None when the provider answered, else REFUSED or UNREACHABLE.
    """
    query = f"{reversed_ip}.{_query_zone(provider)}"
    ignored = LISTS_BY_ZONE[provider].ignored if provider in LISTS_BY_ZONE else frozenset()
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

    # Only 127.0.0.x responses indicate a real listing.
    in_range = [answer for answer in answers if answer.startswith("127.0.0.")]
    if in_range:
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


def describe_listing(provider: str, codes: list[str]) -> dict[str, Any]:
    """What a provider's listing codes mean, and how serious they are."""
    meta = LISTS_BY_ZONE.get(provider)
    if meta is None:
        return {"name": provider, "severity": "low", "meanings": ["listed"]}
    decoded = [meta.codes[code] for code in codes if code in meta.codes]
    meanings = [meaning for meaning, _ in decoded] or [meta.meaning]
    severities = [severity for _, severity in decoded] or [meta.severity]
    return {
        "name": meta.name,
        "severity": min(severities, key=SEVERITIES.index),
        "meanings": list(dict.fromkeys(meanings)),
    }


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
    """Check *hostname_or_ip* on every list. Pass *resolved_ip* when the caller
    already resolved (and vetted) the address, so it isn't resolved again."""
    resolved_ip = resolved_ip or _resolve_ipv4(hostname_or_ip)
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
    listed: dict[str, list[str]] = {}
    failed_providers: set[str] = set()
    refused: set[str] = set()
    resolver = _make_resolver()

    def _run_batch(providers: list[str] | set[str]) -> None:
        with ThreadPoolExecutor(max_workers=12) as executor:
            future_map = {
                executor.submit(_lookup, reversed_ip, provider, resolver): provider
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

    # First pass: query all providers concurrently.
    _run_batch(BASE_PROVIDERS)

    # Retry pass: providers that timed out may succeed on a second attempt
    # when there is less concurrent load on the resolver.
    retry = failed_providers - refused
    if retry:
        failed_providers.difference_update(retry)
        _run_batch(retry)

    # An answer, listed or clean, only counts if the provider still answers
    # its test points correctly.
    answered = [p for p in BASE_PROVIDERS if p not in failed_providers]
    with ThreadPoolExecutor(max_workers=12) as executor:
        healthy = executor.map(lambda provider: _answers_test_points(provider, resolver), answered)
        for provider, ok in zip(answered, healthy):
            if not ok:
                listed.pop(provider, None)
                failed_providers.add(provider)

    detected_on = []
    for provider in BASE_PROVIDERS:
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
        "providers": BASE_PROVIDERS,
        "failed_providers": sorted(failed_providers),
        # When too many providers fail (resolver blocked, network outage) a
        # "clean" result can't be trusted, so callers keep the previous status.
        "is_inconclusive": len(failed_providers) >= max(3, int(len(BASE_PROVIDERS) * _INCONCLUSIVE_FAILURE_RATIO)),
        "is_blacklisted": bool(detected_on),
        "hostname": hostname_or_ip,
        "severity": detected_on[0]["severity"] if detected_on else None,
        "categories": list(dict.fromkeys(c for entry in detected_on for c in entry["categories"])),
    }

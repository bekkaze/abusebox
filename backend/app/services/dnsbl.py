import ipaddress
import logging
import secrets
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

    # What this list is asked about: an address ("ip") or a name ("domain").
    kind: str = "ip"
    # Which address families the zone answers for. SpamEatingMonkey keeps IPv6
    # in a separate zone, so a list can be one, the other, or both.
    ipv4: bool = True
    ipv6: bool = False
    # Where this zone's listings live. Spamhaus DBL answers under 127.0.1.x,
    # everything else under 127.0.0.x, and an answer outside its own block is
    # a refusal or a hijacked zone rather than a listing.
    prefix: str = "127.0.0."
    # Bitmask lists (SURBL, URIBL) encode every sublist a name is on in the
    # final octet, so the answer is decoded bit by bit rather than matched
    # against whole codes.
    bits: dict[int, tuple[str, str]] = field(default_factory=dict)
    # Answers inside the listing block that still mean "we will not answer
    # you". SURBL and URIBL both say so with 127.0.0.1, which read as a
    # listing would mark every domain checked.
    refusals: frozenset[str] = frozenset()
    # RFC 5782 test points. IP zones use the standard 127.0.0.2/127.0.0.1
    # pair; a domain zone publishes its own name that must always be listed.
    test_listed: str = ""
    # Only queried when this environment variable holds a key.
    key_env: str = ""


_ZEN_XBL = ("XBL: compromised host or botnet", "critical")

# Every zone here answers the RFC 5782 test points (127.0.0.2 listed, 127.0.0.1
# not listed). Severity follows how much weight mail filters give a list
# (SpamAssassin and Rspamd defaults) and what its codes mean, not how alarming
# its name sounds. Zones that stopped answering the test points (SORBS, MSRBL,
# abuse.ch, NiX Spam, WPBL, AUPADS, ...) were removed in 1.2.1, and lists that
# only added noise (bogons.cymru.com, blackholes.five-ten-sg.com,
# cbl.abuseat.org, korea.services.net, UCEPROTECT levels 2/3) in 1.2.2.
DNSBL_LISTS = [
    DnsblList("zen.spamhaus.org", "Spamhaus ZEN", "critical", "listed by Spamhaus", ipv6=True, codes={
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
    DnsblList("b.barracudacentral.org", "Barracuda", "high", "poor sending reputation", ipv6=True),
    DnsblList("bl.spamcop.net", "SpamCop", "medium", "reported spam source", ipv6=True),
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
    # The same operator keeps IPv6 in its own zone rather than answering
    # nibble queries on the one above.
    DnsblList("bl.ipv6.spameatingmonkey.net", "SpamEatingMonkey IPv6", "low", "spamtrap hits from this address",
              ipv4=False, ipv6=True),
    DnsblList("dnsbl-1.uceprotect.net", "UCEPROTECT level 1", "low", "spamtrap hits from this IP", ipv6=True),
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

    # Keyed, so it is only queried when a key is configured. Abusix renamed
    # Mail Intelligence to Guardian Mail in 2024; the zone did not change.
    # Only the codes Abusix documents are decoded, and the rest fall back to
    # the list's own severity rather than being guessed at.
    DnsblList("combined.mail.abusix.zone", "Abusix", "high", "listed by Abusix", key_env="ABUSIX_API_KEY", codes={
        "127.0.0.2": ("black: spam source", "high"),
        "127.0.0.3": ("black: composite or heuristic match", "high"),
        "127.0.0.4": ("exploit: compromised or exploited host", "critical"),
        "127.0.0.200": ("black: listed by hand", "high"),
    }),

    # Domain lists. These are asked about the name itself rather than a
    # reversed address, and they do not share the IP lists' codes.
    DnsblList("dbl.spamhaus.org", "Spamhaus DBL", "critical", "domain listed by Spamhaus",
              kind="domain", prefix="127.0.1.", test_listed="dbltest.com", codes={
        "127.0.1.2": ("spam domain", "critical"),
        "127.0.1.4": ("phishing domain", "critical"),
        "127.0.1.5": ("malware domain", "critical"),
        "127.0.1.6": ("botnet command and control domain", "critical"),
        "127.0.1.102": ("abused legitimate domain: spam", "high"),
        "127.0.1.103": ("abused legitimate domain: spammed redirector", "high"),
        "127.0.1.104": ("abused legitimate domain: phishing", "high"),
        "127.0.1.105": ("abused legitimate domain: malware", "high"),
        "127.0.1.106": ("abused legitimate domain: botnet command and control", "high"),
    }, refusals=frozenset({"127.0.1.255"})),  # error, typically a public resolver or query volume

    # Verified live against the published test points: test.surbl.org answers
    # 127.0.0.254, which is every bit below plus the deprecated bit 2. An
    # undecoded bit falls back to the list's own meaning rather than being
    # guessed at, so a listing on bit 2 alone still reports correctly.
    DnsblList("multi.surbl.org", "SURBL", "high", "domain listed by SURBL",
              kind="domain", test_listed="test.surbl.org",
              # Free use excludes paid products; see https://surbl.org/usage-policy
              refusals=frozenset({"127.0.0.1"}), bits={
        4: ("disposable email domain", "low"),
        8: ("phishing site", "critical"),
        16: ("malware site", "critical"),
        32: ("click tracker domain", "low"),
        64: ("spam or abuse site", "high"),
        128: ("cracked site", "high"),
    }),

    DnsblList("multi.uribl.com", "URIBL", "high", "domain listed by URIBL",
              kind="domain", test_listed="test.uribl.com",
              # Free for low volume; see https://uribl.com/about.shtml
              refusals=frozenset({"127.0.0.1", "127.0.0.255"}), bits={
        2: ("black: spam domain", "high"),
        4: ("grey: appears in spam but may be shared or legitimate", "low"),
        8: ("red: actively used in spam right now", "critical"),
        16: ("gold: long-standing spam domain", "high"),
    }),
]
LISTS_BY_ZONE = {item.zone: item for item in DNSBL_LISTS}


def _available(item: DnsblList) -> bool:
    """A keyed list is only queried when its key is set."""
    return not item.key_env or bool(os.environ.get(item.key_env, "").strip())


def providers_for(kind: str, family: str = "ipv4") -> list[str]:
    """Zones to query for a target.

    *kind* is "ip" or "domain"; *family* is "ipv4" or "ipv6" and is ignored for
    domain lists. A list that does not answer for the family is not queried at
    all, rather than queried and recorded as "no answer", because an IPv4-only
    zone saying nothing about an IPv6 address is not a failure on its part.
    """
    out = []
    for item in DNSBL_LISTS:
        if item.kind != kind or not _available(item):
            continue
        if kind == "ip" and not (item.ipv6 if family == "ipv6" else item.ipv4):
            continue
        out.append(item.zone)
    return sorted(out)


# Every IPv4 zone, which is what a check of an IPv4 address uses. Kept as a
# name because the API and the tests have always reported it.
BASE_PROVIDERS = providers_for("ip", "ipv4")
DOMAIN_PROVIDERS = providers_for("domain")

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


def _extract_host(value: str) -> str:
    """The bare host from a URL, host:port or plain name."""
    target = (value or "").strip()
    if not target:
        return ""
    if "://" in target:
        parsed = urlparse(target)
        target = parsed.hostname or ""
    elif "/" in target:
        parsed = urlparse(f"//{target}", scheme="http")
        target = parsed.hostname or target.split("/", 1)[0]
    # A bracketed IPv6 literal is already unwrapped by urlparse; a bare
    # host:port is only a port when there is exactly one colon, since an
    # unbracketed IPv6 address has several.
    if ":" in target and target.count(":") == 1:
        host, port = target.rsplit(":", 1)
        if port.isdigit():
            target = host
    return target.strip().strip("[]")


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


def _decode_bits(meta: DnsblList, codes: list[str]) -> list[tuple[str, str]]:
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
    """What a provider's listing codes mean, and how serious they are."""
    meta = LISTS_BY_ZONE.get(provider)
    if meta is None:
        return {"name": provider, "severity": "low", "meanings": ["listed"]}
    if meta.bits:
        decoded = _decode_bits(meta, codes)
    else:
        decoded = [meta.codes[code] for code in codes if code in meta.codes]
    meanings = [meaning for meaning, _ in decoded] or [meta.meaning]
    severities = [severity for _, severity in decoded] or [meta.severity]
    return {
        "name": meta.name,
        "severity": min(severities, key=SEVERITIES.index),
        "meanings": list(dict.fromkeys(meanings)),
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
        domain_zones = providers_for("domain")
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

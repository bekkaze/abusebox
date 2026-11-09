"""The blacklist catalogue: which zones exist, and what their answers mean.

Separated from `dnsbl.py` because it is a table, not logic. Adding a list,
correcting a severity or decoding a new return code happens here and touches
no query code; the engine next door has no per-list branches in it.

Severity follows how much weight mail filters give a list (SpamAssassin and
Rspamd defaults) and what its codes mean, not how alarming its name sounds.
"""

import os
from dataclasses import dataclass, field

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
    # An operator's API key, and the zone to ask when one is set. Spamhaus
    # answers a different hostname entirely for key holders; Abusix prefixes
    # the key onto its own. Keeping both as data means `_query_zone` has no
    # per-list branches in it.
    key_env: str = ""
    keyed_zone: str = ""
    # Whether a key is required to use the list at all. Spamhaus has a free
    # public mirror and is queried either way; Abusix answers nobody without
    # a key, so querying it unkeyed would record a permanent "no answer".
    requires_key: bool = False


_ZEN_XBL = ("XBL: compromised host or botnet", "critical")

# Every zone here answers the RFC 5782 test points (127.0.0.2 listed, 127.0.0.1
# not listed). Severity follows how much weight mail filters give a list
# (SpamAssassin and Rspamd defaults) and what its codes mean, not how alarming
# its name sounds. Zones that stopped answering the test points (SORBS, MSRBL,
# abuse.ch, NiX Spam, WPBL, AUPADS, ...) were removed in 1.2.1, and lists that
# only added noise (bogons.cymru.com, blackholes.five-ten-sg.com,
# cbl.abuseat.org, korea.services.net, UCEPROTECT levels 2/3) in 1.2.2.
DNSBL_LISTS = [
    DnsblList("zen.spamhaus.org", "Spamhaus ZEN", "critical", "listed by Spamhaus", ipv6=True,
              key_env="SPAMHAUS_DQS_KEY", keyed_zone="{key}.zen.dq.spamhaus.net", codes={
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
    DnsblList("combined.mail.abusix.zone", "Abusix", "high", "listed by Abusix",
              key_env="ABUSIX_API_KEY", keyed_zone="{key}.combined.mail.abusix.zone",
              requires_key=True, ipv6=True, codes={
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


def _api_key(item: DnsblList) -> str:
    return os.environ.get(item.key_env, "").strip() if item.key_env else ""


def _available(item: DnsblList) -> bool:
    """Whether this list can be queried at all right now."""
    return not item.requires_key or bool(_api_key(item))


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

import ipaddress
import socket
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any
from urllib.parse import urlparse

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

_DNSBL_TIMEOUT = 1.5


def _resolve_ipv4(value: str) -> str | None:
    target = (value or "").strip()
    if not target:
        return None

    # Accept inputs like "https://example.com/path" or "example.com:443".
    if "://" in target:
        parsed = urlparse(target)
        target = parsed.hostname or ""
    elif "/" in target:
        parsed = urlparse(f"//{target}", scheme="http")
        target = parsed.hostname or target.split("/", 1)[0]

    # Strip optional port from host:port.
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


def _check_provider(reversed_ip: str, provider: str) -> tuple[str, bool]:
    query = f"{reversed_ip}.{provider}"
    old_timeout = socket.getdefaulttimeout()
    try:
        socket.setdefaulttimeout(_DNSBL_TIMEOUT)
        socket.gethostbyname(query)
        return provider, True
    except (socket.gaierror, socket.timeout):
        return provider, False
    finally:
        socket.setdefaulttimeout(old_timeout)


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
    failed_providers: list[str] = []

    with ThreadPoolExecutor(max_workers=12) as executor:
        future_map = {
            executor.submit(_check_provider, reversed_ip, provider): provider
            for provider in BASE_PROVIDERS
        }

        for future in as_completed(future_map):
            provider = future_map[future]
            try:
                _, is_listed = future.result()
                if is_listed:
                    listed.add(provider)
            except Exception:
                failed_providers.append(provider)

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
        "failed_providers": failed_providers,
        "is_blacklisted": bool(detected_on),
        "hostname": hostname_or_ip,
        "categories": ["unknown"] if detected_on else [],
    }

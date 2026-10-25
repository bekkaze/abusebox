import ipaddress
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any

from app.services.dnsbl import (
    BASE_PROVIDERS,
    REFUSED,
    UNREACHABLE,
    _answers_test_points,
    _check_provider,
    _make_resolver,
)


MAX_SUBNET_SIZE = 256  # /24 max


def check_subnet(cidr: str, providers: list[str] | None = None) -> dict[str, Any]:
    cidr = (cidr or "").strip()
    if not cidr:
        return {"error": "Please provide a CIDR range (e.g. 192.168.1.0/24)."}

    try:
        network = ipaddress.IPv4Network(cidr, strict=False)
    except (ipaddress.AddressValueError, ipaddress.NetmaskValueError, ValueError) as exc:
        return {"error": f"Invalid CIDR notation: {exc}"}

    if network.num_addresses > MAX_SUBNET_SIZE:
        return {"error": f"Subnet too large. Maximum /{32 - MAX_SUBNET_SIZE.bit_length() + 1} ({MAX_SUBNET_SIZE} addresses)."}

    if providers is None:
        # Use a smaller set for subnet scans to stay fast
        providers = [
            "zen.spamhaus.org",
            "bl.spamcop.net",
            "b.barracudacentral.org",
            "z.mailspike.net",
            "dnsbl-1.uceprotect.net",
            "psbl.surriel.com",
            "dnsbl.dronebl.org",
        ]

    resolver = _make_resolver()
    results: list[dict[str, Any]] = []

    # Skip providers that fail their test points: one listing everything would
    # flag the whole range, and one refusing us would report it all clean.
    with ThreadPoolExecutor(max_workers=max(len(providers), 1)) as executor:
        healthy = list(executor.map(lambda provider: _answers_test_points(provider, resolver), providers))
    failed_providers = [p for p, ok in zip(providers, healthy) if not ok]
    providers = [p for p, ok in zip(providers, healthy) if ok]

    def _query(reversed_ip: str, batch: list[str]) -> tuple[list[str], dict[str, str]]:
        listed_on: list[str] = []
        failures: dict[str, str] = {}
        with ThreadPoolExecutor(max_workers=max(len(batch), 1)) as executor:
            futures = {
                executor.submit(_check_provider, reversed_ip, provider, resolver): provider
                for provider in batch
            }
            for future in as_completed(futures):
                provider = futures[future]
                try:
                    _, is_listed, failure = future.result()
                except Exception:
                    is_listed, failure = False, UNREACHABLE
                if is_listed:
                    listed_on.append(provider)
                elif failure:
                    failures[provider] = failure
        return listed_on, failures

    def _check_ip(ip: str) -> dict[str, Any]:
        reversed_ip = ".".join(reversed(ip.split(".")))
        listed_on, failures = _query(reversed_ip, providers)

        # Retry timeouts once; a provider that refused (e.g. rate limited
        # partway through the scan) is left as failed, never counted clean.
        retry = [p for p, failure in failures.items() if failure != REFUSED]
        if retry:
            more_listed, more_failures = _query(reversed_ip, retry)
            listed_on += more_listed
            failures = {p: f for p, f in failures.items() if f == REFUSED} | more_failures

        return {
            "ip": ip,
            "is_blacklisted": bool(listed_on),
            "listed_on": sorted(listed_on),
            "failed_on": sorted(failures),
        }

    ips = [str(ip) for ip in network.hosts()]
    if not ips:
        ips = [str(network.network_address)]

    with ThreadPoolExecutor(max_workers=min(len(ips), 16)) as executor:
        future_map = {executor.submit(_check_ip, ip): ip for ip in ips}
        for future in as_completed(future_map):
            try:
                results.append(future.result())
            except Exception:
                ip = future_map[future]
                results.append({"ip": ip, "is_blacklisted": False, "listed_on": [], "failed_on": list(providers),
                                "error": "Check failed"})

    results.sort(key=lambda r: ipaddress.IPv4Address(r["ip"]))
    blacklisted_count = sum(1 for r in results if r["is_blacklisted"])
    # Not listed, but some providers didn't answer: not a clean result.
    incomplete_count = sum(1 for r in results if not r["is_blacklisted"] and r["failed_on"])

    return {
        "cidr": str(network),
        "total_ips": len(results),
        "blacklisted_count": blacklisted_count,
        "incomplete_count": incomplete_count,
        "clean_count": len(results) - blacklisted_count - incomplete_count,
        "providers_checked": providers,
        "failed_providers": failed_providers,
        "results": results,
    }

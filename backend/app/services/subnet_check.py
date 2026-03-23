import ipaddress
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any

from app.services.dnsbl import BASE_PROVIDERS, _check_provider


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
            "cbl.abuseat.org",
            "b.barracudacentral.org",
            "dnsbl.sorbs.net",
            "dnsbl-1.uceprotect.net",
            "psbl.surriel.com",
            "dnsbl.dronebl.org",
        ]

    results: list[dict[str, Any]] = []

    def _check_ip(ip: str) -> dict[str, Any]:
        reversed_ip = ".".join(reversed(ip.split(".")))
        listed_on: list[str] = []

        with ThreadPoolExecutor(max_workers=len(providers)) as executor:
            futures = {
                executor.submit(_check_provider, reversed_ip, provider): provider
                for provider in providers
            }
            for future in as_completed(futures):
                try:
                    _, is_listed = future.result()
                    if is_listed:
                        listed_on.append(futures[future])
                except Exception:
                    pass

        return {
            "ip": ip,
            "is_blacklisted": bool(listed_on),
            "listed_on": listed_on,
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
                results.append({"ip": ip, "is_blacklisted": False, "listed_on": [], "error": "Check failed"})

    results.sort(key=lambda r: ipaddress.IPv4Address(r["ip"]))
    blacklisted_count = sum(1 for r in results if r["is_blacklisted"])

    return {
        "cidr": str(network),
        "total_ips": len(results),
        "blacklisted_count": blacklisted_count,
        "clean_count": len(results) - blacklisted_count,
        "providers_checked": providers,
        "results": results,
    }

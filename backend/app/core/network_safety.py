"""Outbound-network safety checks for user-controlled destinations."""

import ipaddress
import socket
from urllib.parse import urlparse


class UnsafeDestinationError(ValueError):
    """Raised when a user-supplied destination resolves to a non-public address."""


def _is_public(address: str) -> bool:
    try:
        return ipaddress.ip_address(address).is_global
    except ValueError:
        return False


def resolve_public_ipv4(hostname: str) -> str:
    """Resolve a hostname and reject loopback, private, link-local and reserved IPs."""
    try:
        addresses = {item[4][0] for item in socket.getaddrinfo(hostname, None, socket.AF_INET)}
    except (socket.gaierror, UnicodeError) as exc:
        raise UnsafeDestinationError("Could not resolve hostname.") from exc
    if not addresses or any(not _is_public(address) for address in addresses):
        raise UnsafeDestinationError("Private, loopback, link-local, reserved, or mixed DNS destinations are not allowed.")
    return sorted(addresses)[0]


def resolve_public_addresses(hostname: str) -> list[str]:
    """Public addresses for *hostname*, in the order the system prefers.

    Unlike :func:`resolve_public_ipv4` this returns both families, so a caller
    can fall back to the other one when a destination is unreachable over the
    first. Some WHOIS servers block an individual IPv4 client while still
    answering that same client over IPv6 (issue #36).

    At most one address per family is returned: when a server is refusing us,
    working through every A record it publishes only burns the time budget.
    """
    try:
        infos = socket.getaddrinfo(hostname, None, type=socket.SOCK_STREAM)
    except (socket.gaierror, UnicodeError) as exc:
        raise UnsafeDestinationError("Could not resolve hostname.") from exc

    every: list[str] = []
    preferred: dict[int, str] = {}
    for family, *_rest, sockaddr in infos:
        if family not in (socket.AF_INET, socket.AF_INET6):
            continue
        # Drop a zone id such as "fe80::1%eth0" before validating the address.
        address = sockaddr[0].split("%", 1)[0]
        if address not in every:
            every.append(address)
        preferred.setdefault(family, address)

    # Every answer is checked, not just the ones we would use, so a name that
    # mixes public and internal addresses is still refused.
    if not every or any(not _is_public(address) for address in every):
        raise UnsafeDestinationError("Private, loopback, link-local, reserved, or mixed DNS destinations are not allowed.")
    return [address for address in every if address in preferred.values()]


def validate_public_url(url: str) -> str:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise UnsafeDestinationError("Only absolute HTTP(S) URLs are allowed.")
    resolve_public_ipv4(parsed.hostname)
    return url

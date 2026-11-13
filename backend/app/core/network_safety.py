"""Outbound-network safety checks for user-controlled destinations."""

import ipaddress
import socket
import time
from urllib.parse import urlparse


class UnsafeDestinationError(ValueError):
    """Raised when a user-supplied destination is not one we will contact.

    Subclassed by reason rather than told apart by its message, so a caller
    reports the refusal in its own words instead of forwarding ours. The
    messages here are fixed sentences with nothing interpolated, and they stay
    for the log and for anyone reading a traceback.
    """


class UnresolvableHostError(UnsafeDestinationError):
    """The name does not resolve at all."""


class PrivateDestinationError(UnsafeDestinationError):
    """It resolves somewhere we will not reach: private, loopback, reserved, or mixed."""


class UnsupportedUrlError(UnsafeDestinationError):
    """Not an absolute HTTP or HTTPS URL."""


class NoIpv6RouteError(UnsafeDestinationError):
    """The host has only IPv6 addresses and this machine cannot reach IPv6.

    Not a verdict on the host. Docker gives containers IPv4 only unless the
    network enables IPv6, so on a default install every IPv6-only asset would
    otherwise look down. Callers report it as "not checked", never as down.
    """


_NOT_PUBLIC = "Private, loopback, link-local, reserved, or mixed DNS destinations are not allowed."


def _is_public(address: str) -> bool:
    try:
        return ipaddress.ip_address(address).is_global
    except ValueError:
        return False


def resolve_public_addresses(hostname: str) -> list[str]:
    """Public addresses for *hostname*, in the order the system prefers.

    Both families, so a caller can fall back to the other one when a
    destination is unreachable over the first. Some WHOIS servers block an individual IPv4 client while still
    answering that same client over IPv6 (issue #36).

    At most one address per family is returned: when a server is refusing us,
    working through every A record it publishes only burns the time budget.
    """
    try:
        infos = socket.getaddrinfo(hostname, None, type=socket.SOCK_STREAM)
    except (socket.gaierror, UnicodeError) as exc:
        raise UnresolvableHostError("Could not resolve hostname.") from exc

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
        raise PrivateDestinationError(_NOT_PUBLIC)
    return [address for address in every if address in preferred.values()]


# Routing a UDP socket sends nothing, so this asks the kernel whether an IPv6
# route exists without any traffic. The address is f.root-servers.net, chosen
# only for being global unicast that will not move.
_IPV6_PROBE = ("2001:500:2f::f", 53)
_IPV6_ROUTE_TTL = 300.0
_ipv6_route: tuple[float, bool] | None = None


def has_ipv6_route() -> bool:
    """Whether this machine has a route to the IPv6 internet. Cached briefly."""
    global _ipv6_route
    now = time.monotonic()
    if _ipv6_route is not None and now - _ipv6_route[0] < _IPV6_ROUTE_TTL:
        return _ipv6_route[1]
    try:
        with socket.socket(socket.AF_INET6, socket.SOCK_DGRAM) as sock:
            sock.connect(_IPV6_PROBE)
        reachable = True
    except OSError:
        reachable = False
    _ipv6_route = (now, reachable)
    return reachable


def resolve_public_address(hostname: str, *, connect: bool = True) -> str:
    """One public address for *hostname*: IPv4 when it has one, else IPv6.

    IPv4 first because every check used IPv4 before 1.6, so a name that has
    an A record is checked exactly as it was, and because Docker containers
    have no IPv6 by default. IPv6 is used when it is all the host has.

    With *connect* (the default) the caller is about to open a connection, so
    an IPv6-only host on a machine without an IPv6 route raises
    :class:`NoIpv6RouteError` instead of returning an address that cannot be
    reached. Pass ``connect=False`` when the address is only being reported,
    as AbuseIPDB does.
    """
    addresses = resolve_public_addresses(hostname)
    for address in addresses:
        if ipaddress.ip_address(address).version == 4:
            return address
    if connect and not has_ipv6_route():
        raise NoIpv6RouteError("Only IPv6 addresses, and this machine has no IPv6 route.")
    return addresses[0]


def validate_public_url(url: str) -> str:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise UnsupportedUrlError("Only absolute HTTP(S) URLs are allowed.")
    # Both families: a name with a public A record and an internal AAAA used
    # to pass, because only the A record was looked at.
    resolve_public_addresses(parsed.hostname)
    return url

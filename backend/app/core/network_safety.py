"""Outbound-network safety checks for user-controlled destinations."""

import ipaddress
import socket
from urllib.parse import urlparse


def _is_public(address: str) -> bool:
    try:
        return ipaddress.ip_address(address).is_global
    except ValueError:
        return False


def resolve_public_ipv4(hostname: str) -> str:
    """Resolve a hostname and reject loopback, private, link-local and reserved IPs."""
    try:
        addresses = {item[4][0] for item in socket.getaddrinfo(hostname, None, socket.AF_INET)}
    except socket.gaierror as exc:
        raise ValueError("Could not resolve hostname.") from exc
    if not addresses or any(not _is_public(address) for address in addresses):
        raise ValueError("Private, loopback, link-local, reserved, or mixed DNS destinations are not allowed.")
    return sorted(addresses)[0]


def validate_public_url(url: str) -> str:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise ValueError("Only absolute HTTP(S) URLs are allowed.")
    resolve_public_ipv4(parsed.hostname)
    return url

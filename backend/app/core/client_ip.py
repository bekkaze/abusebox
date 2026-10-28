"""Best-effort client IP for rate limiting behind the bundled reverse proxy."""

import ipaddress

from fastapi import Request


def _is_private(address: str) -> bool:
    try:
        ip = ipaddress.ip_address(address.strip())
    except ValueError:
        return False
    return ip.is_private or ip.is_loopback or ip.is_link_local


def get_client_ip(request: Request) -> str:
    """Return the address to key rate limits on.

    In the default Docker setup every request reaches the API through the
    bundled nginx, so the socket peer is the frontend container for *all*
    users. nginx sets X-Real-IP to the address that connected to it, replacing
    anything the client sent, so that header is trusted when the peer is on a
    private network. X-Forwarded-For is never used: proxies append to it, so
    its left part is whatever the client chose and would let anyone pick a
    fresh rate-limit key for every request.
    """
    peer = request.client.host if request.client else "unknown"
    if not _is_private(peer):
        return peer
    real_ip = request.headers.get("x-real-ip", "").strip()
    try:
        return str(ipaddress.ip_address(real_ip))
    except ValueError:
        return peer

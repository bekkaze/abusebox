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

    In the default Docker setup every request reaches the API through the Vite
    dev-server proxy, so the socket peer is the frontend container for *all*
    users. When the peer is on a private network we trust X-Forwarded-For and
    walk it right-to-left, skipping private proxy hops, to find the first public
    client address. A client connecting directly from the internet can't spoof
    this, because its own (public) peer address is used as-is.
    """
    peer = request.client.host if request.client else "unknown"
    if not _is_private(peer):
        return peer

    forwarded = request.headers.get("x-forwarded-for", "")
    hops = [hop.strip() for hop in forwarded.split(",") if hop.strip()]
    for hop in reversed(hops):
        if not _is_private(hop):
            return hop
    # Everything is internal (e.g. LAN users): the nearest hop is the best key.
    return hops[-1] if hops else peer

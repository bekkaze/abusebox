"""The bare host out of whatever an operator typed.

An asset can be entered as a name, an IP literal of either family, a
host:port, or a whole URL. Every check needs the host alone, and the naive
way of getting it, splitting on ":", turns 2001:db8::1 into "2001" (which
the resolver then reads as the IPv4 address 0.0.7.209). This is the one
place that knows an IPv6 literal has several colons.
"""

from urllib.parse import urlparse


def extract_host(value: str) -> str:
    """The bare host from a URL, host:port, bracketed literal or plain name."""
    target = (value or "").strip()
    if not target:
        return ""
    if "://" in target:
        target = urlparse(target).hostname or ""
    elif "/" in target:
        parsed = urlparse(f"//{target}", scheme="http")
        target = parsed.hostname or target.split("/", 1)[0]
    if target.startswith("[") and "]" in target:
        # [2001:db8::1] or [2001:db8::1]:8443, the form a URL carries.
        return target[1:target.index("]")].strip()
    # A bare host:port is only a port when there is exactly one colon, since
    # an unbracketed IPv6 address has several.
    if target.count(":") == 1:
        host, port = target.rsplit(":", 1)
        if port.isdigit():
            target = host
    return target.strip()

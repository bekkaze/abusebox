import logging
import socket
import ssl
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlparse
from app.core.network_safety import resolve_public_ipv4
from app.core.failures import describe

logger = logging.getLogger(__name__)

# Versions a server should no longer be answering on. Reported as a finding
# rather than hidden behind a failed handshake: an operator whose mail server
# is still on TLS 1.0 needs to be told that, not told "SSL error".
_OBSOLETE_PROTOCOLS = {
    "SSLv2": "SSLv2 has been prohibited since RFC 6176 (2011).",
    "SSLv3": "SSLv3 is broken by POODLE and prohibited since RFC 7568 (2015).",
    # OpenSSL reports these as "TLSv1.0" and "TLSv1.1"; the short spellings are
    # kept as aliases because not every build agrees.
    "TLSv1.0": "TLS 1.0 is deprecated by RFC 8996. Enable TLS 1.2 or later.",
    "TLSv1": "TLS 1.0 is deprecated by RFC 8996. Enable TLS 1.2 or later.",
    "TLSv1.1": "TLS 1.1 is deprecated by RFC 8996. Enable TLS 1.2 or later.",
}

_MIN_STRONG_BITS = 128


def _diagnostic_context() -> ssl.SSLContext:
    """A context that will negotiate versions a normal client refuses.

    Only used after the default context has already failed, to find out what
    an old server does speak. Two things have to give way, and both were
    measured: create_default_context sets minimum_version to TLS 1.2, and
    OpenSSL's security level rejects the cipher suites of TLS 1.0 and 1.1 even
    when the version is allowed. Relax one and the handshake still dies with
    "[SSL: TLSV1_ALERT_PROTOCOL_VERSION]" and no verdict at all.

    The chain and the hostname are still verified. Only the algorithms allowed
    to appear in them widen, which is the point: whatever comes back is
    reported as a problem, never as a pass.
    """
    context = ssl.create_default_context()
    # Deliberate, and the whole point of this function. Anything negotiated
    # here is reported as a finding by _tls_warnings, never as a pass, and a
    # certificate error reaches the caller instead of being retried.
    context.minimum_version = ssl.TLSVersion.MINIMUM_SUPPORTED
    try:
        context.set_ciphers("ALL:@SECLEVEL=0")
    except ssl.SSLError:  # pragma: no cover - depends on the OpenSSL build
        # An OpenSSL build that will not go that low. The retry still happens
        # with the version relaxed, and either it gets an answer or the
        # original failure is reported.
        logger.debug("This OpenSSL build does not accept SECLEVEL=0 cipher suites.")
    return context


def _handshake(ip: str, port: int, hostname: str, context: ssl.SSLContext):
    # Connect to the address that was checked, not the name: resolving it
    # again would let a rebinding DNS server point us at an internal host.
    with socket.create_connection((ip, port), timeout=10) as sock:
        # The old versions _diagnostic_context allows are deliberate and are
        # what this check exists to report. See that function.
        with context.wrap_socket(sock, server_hostname=hostname) as ssock:  # codeql[py/insecure-protocol]
            return ssock.getpeercert(), ssock.cipher()


def _connect(ip: str, port: int, hostname: str):
    """The certificate and cipher, and why a normal client could not get them.

    Tries as a mail client would first, so a server that passes is a server
    real clients accept. Anything other than a certificate problem gets one
    retry with relaxed versions, because an obsolete server is the finding we
    most want to report and the strict attempt only says "SSL error".
    """
    try:
        cert, cipher = _handshake(ip, port, hostname, ssl.create_default_context())
        return cert, cipher, None
    except ssl.SSLCertVerificationError:
        # A real certificate problem, not a version one. Let it through.
        raise
    except ssl.SSLError as exc:
        cert, cipher = _handshake(ip, port, hostname, _diagnostic_context())
        return cert, cipher, exc


def _tls_warnings(cipher, strict_error: ssl.SSLError | None) -> list[str]:
    protocol = cipher[1] if cipher else ""
    name = cipher[0] if cipher else ""
    bits = cipher[2] if cipher else 0

    warnings = []
    obsolete = _OBSOLETE_PROTOCOLS.get(protocol)
    if obsolete:
        warnings.append(f"Negotiated {protocol}. {obsolete}")
    elif strict_error is not None:
        # Modern versions failed but the relaxed retry worked, and the version
        # itself is not the known-bad list. Say what was refused.
        warnings.append(
            "A client using current TLS defaults could not complete a handshake "
            f"({strict_error.reason or strict_error})."
        )
    if bits and bits < _MIN_STRONG_BITS:
        warnings.append(f"{name} gives only {bits}-bit encryption.")
    return warnings


def check_ssl_certificate(hostname: str) -> dict[str, Any]:
    hostname = (hostname or "").strip()
    if not hostname:
        return {"error": "Please provide a hostname."}

    # Strip protocol/path/port
    if "://" in hostname:
        parsed = urlparse(hostname)
        hostname = parsed.hostname or hostname
    hostname = hostname.split("/")[0].split(":")[0]
    try:
        ip = resolve_public_ipv4(hostname)
    except ValueError as exc:
        return {"hostname": hostname, "error": str(exc)}

    port = 443

    try:
        cert, cipher, strict_error = _connect(ip, port, hostname)

        if not cert:
            return {"error": "No certificate returned by server."}

        # SSL certs return dates like "Dec 30 23:59:59 2025 GMT".
        # Strip the timezone suffix and assume UTC to avoid %Z parsing issues.
        def _parse_cert_date(s: str) -> datetime:
            s = s.replace(" GMT", "").replace(" UTC", "").strip()
            return datetime.strptime(s, "%b %d %H:%M:%S %Y").replace(tzinfo=timezone.utc)

        not_before = _parse_cert_date(cert["notBefore"])
        not_after = _parse_cert_date(cert["notAfter"])
        now = datetime.now(timezone.utc)
        days_remaining = (not_after - now).days
        is_expired = days_remaining < 0

        subject = dict(x[0] for x in cert.get("subject", ()))
        issuer = dict(x[0] for x in cert.get("issuer", ()))

        san_list = []
        for entry_type, entry_value in cert.get("subjectAltName", ()):
            san_list.append(entry_value)

        return {
            "hostname": hostname,
            "valid": not is_expired,
            "days_remaining": days_remaining,
            "not_before": not_before.isoformat(),
            "not_after": not_after.isoformat(),
            "subject": {
                "common_name": subject.get("commonName", ""),
                "organization": subject.get("organizationName", ""),
            },
            "issuer": {
                "common_name": issuer.get("commonName", ""),
                "organization": issuer.get("organizationName", ""),
            },
            "serial_number": cert.get("serialNumber", ""),
            "version": cert.get("version", ""),
            "san": san_list,
            "cipher": {
                "name": cipher[0] if cipher else "",
                "protocol": cipher[1] if cipher else "",
                "bits": cipher[2] if cipher else 0,
            },
            "warnings": _tls_warnings(cipher, strict_error),
        }

    except ssl.SSLCertVerificationError as exc:
        # describe() returns a whole clause, so it reads as the sentence it is
        # rather than as a prefix with the same thing said twice after it.
        return {"hostname": hostname, "valid": False, "error": f"{describe(exc).capitalize()}."}
    except ssl.SSLError as exc:
        return {"hostname": hostname, "valid": False, "error": f"{describe(exc).capitalize()}."}
    except socket.timeout:
        return {"hostname": hostname, "error": "Connection timed out."}
    except socket.gaierror:
        return {"hostname": hostname, "error": "Could not resolve hostname."}
    except ConnectionRefusedError:
        return {"hostname": hostname, "error": "Connection refused on port 443."}
    except OSError as exc:
        return {"hostname": hostname, "error": f"Could not reach port {port}: {describe(exc)}."}

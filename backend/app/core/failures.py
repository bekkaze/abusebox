"""Turning an exception into something an operator can read.

Every check talks to the network, and most of what goes wrong out there is
ordinary: a name that does not resolve, a refused port, a registry that
stopped answering. That is the answer the operator asked for, so it is named
plainly.

What never passes through is the exception's own text. "[SSL: ...]
(_ssl.c:1082)" or an OSError carrying a path tells the person at the keyboard
nothing, and tells anyone they forward the result to more than a check result
should. Every string returned from here is a literal written above; the
exception chooses which one, never what it says. Where a number genuinely
helps, such as an errno or an SMTP reply code, it is read from a field that
holds an integer rather than from the message.
"""

import errno
import socket
import ssl

from app.core.network_safety import (
    PrivateDestinationError,
    UnresolvableHostError,
    UnsafeDestinationError,
    UnsupportedUrlError,
)

# OpenSSL's reason strings are a fixed enumeration, not free text, but only
# the ones worth putting in front of someone are spelled out.
_SSL_REASONS = {
    "CERTIFICATE_VERIFY_FAILED": "the certificate could not be verified",
    "TLSV1_ALERT_PROTOCOL_VERSION": "the server refused every TLS version offered",
    "SSLV3_ALERT_HANDSHAKE_FAILURE": "the server and this client share no usable TLS settings",
    "UNSUPPORTED_PROTOCOL": "the server offered no TLS version this client accepts",
    "WRONG_VERSION_NUMBER": "the port answered with something that is not TLS",
    "UNEXPECTED_EOF_WHILE_READING": "the server closed the connection during the handshake",
    "CERTIFICATE_UNKNOWN": "the server rejected the handshake over a certificate",
}


# X509 verification results, by OpenSSL's numeric code. The code is an int, so
# reading it gives the useful distinction (expired, or the wrong name, or an
# issuer nobody trusts) without putting OpenSSL's own words in front of anyone.
_VERIFY_CODES = {
    9: "the certificate is not valid yet",
    10: "the certificate has expired",
    18: "the certificate is self-signed",
    19: "the chain ends in a self-signed certificate nobody trusts",
    20: "the issuing certificate could not be found",
    21: "the first certificate in the chain could not be verified",
    23: "the certificate has been revoked",
    62: "the certificate is not valid for this hostname",
}


def _errno_name(number: int | None) -> str | None:
    return errno.errorcode.get(number) if number else None


def describe(exc: BaseException, fallback: str = "the request failed") -> str:
    """A fixed phrase for *exc*, chosen by its type and never quoting it."""
    # Our own refusals first: they are ValueError subclasses, so they would
    # otherwise fall through to the fallback.
    if isinstance(exc, UnresolvableHostError):
        return "the name could not be resolved"
    if isinstance(exc, PrivateDestinationError):
        return "it does not resolve to a public address"
    if isinstance(exc, UnsupportedUrlError):
        return "only absolute HTTP and HTTPS URLs can be checked"
    if isinstance(exc, UnsafeDestinationError):
        return "the destination was refused"
    # Order matters: the specific socket and connection errors are subclasses
    # of OSError, so they have to be tested before it.
    if isinstance(exc, (socket.timeout, TimeoutError)):
        return "timed out"
    if isinstance(exc, ConnectionRefusedError):
        return "the connection was refused"
    if isinstance(exc, ConnectionResetError):
        return "the connection was reset"
    if isinstance(exc, (ConnectionAbortedError, BrokenPipeError)):
        return "the connection was closed early"
    if isinstance(exc, socket.gaierror):
        return "the name could not be resolved"
    if isinstance(exc, ssl.SSLCertVerificationError):
        known = _VERIFY_CODES.get(getattr(exc, "verify_code", None))
        return known or "the certificate could not be verified"
    if isinstance(exc, ssl.SSLError):
        reason = _SSL_REASONS.get(getattr(exc, "reason", None) or "")
        return reason or "the TLS handshake failed"
    if isinstance(exc, OSError):
        name = _errno_name(exc.errno)
        return f"a network error occurred ({name})" if name else "a network error occurred"
    return fallback


def describe_smtp(exc: BaseException) -> str:
    """A phrase for an SMTP failure, with the server's reply code when it gave one."""
    code = getattr(exc, "smtp_code", None)
    if isinstance(code, int) and 200 <= code <= 599:
        return f"the mail server replied {code}"
    described = describe(exc, fallback="")
    return described or "the mail server could not be reached"

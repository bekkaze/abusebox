"""Turning an exception into something an operator can read.

Every check talks to the network, and most of what goes wrong out there is
ordinary: a name that does not resolve, a refused port, a certificate that
expired last week. That is the answer the operator asked for, so it is named
plainly.

What never passes through is anything the exception carries. "[SSL: ...]
(_ssl.c:1082)" or an OSError holding a path tells the person at the keyboard
nothing, and tells anyone they forward the result to more than a check result
should.

Everything returned from here is a literal written in this file. Where the
exception does hold something worth acting on, such as an errno or an X509
verify code, it is *compared* against the tables below and never read into
the answer: `_match` returns the phrase beside the matching candidate, so no
value from the exception reaches the caller even as a fragment. That is also
why these are comparisons rather than dictionary lookups, which would put the
exception's own value on the path to the output.
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

# OpenSSL's X509 verification results, by numeric code. These are the ones
# worth telling apart: every one of them used to read "CERTIFICATE_VERIFY_FAILED".
_VERIFY_CODES = (
    (9, "the certificate is not valid yet"),
    (10, "the certificate has expired"),
    (18, "the certificate is self-signed"),
    (19, "the chain ends in a self-signed certificate nobody trusts"),
    (20, "the issuing certificate could not be found"),
    (21, "the first certificate in the chain could not be verified"),
    (23, "the certificate has been revoked"),
    (62, "the certificate is not valid for this hostname"),
)

# OpenSSL's reason strings are a fixed enumeration, not free text, but only the
# ones worth putting in front of someone are spelled out.
_SSL_REASONS = (
    ("CERTIFICATE_VERIFY_FAILED", "the certificate could not be verified"),
    ("TLSV1_ALERT_PROTOCOL_VERSION", "the server refused every TLS version offered"),
    ("SSLV3_ALERT_HANDSHAKE_FAILURE", "the server and this client share no usable TLS settings"),
    ("UNSUPPORTED_PROTOCOL", "the server offered no TLS version this client accepts"),
    ("WRONG_VERSION_NUMBER", "the port answered with something that is not TLS"),
    ("UNEXPECTED_EOF_WHILE_READING", "the server closed the connection during the handshake"),
    ("CERTIFICATE_UNKNOWN", "the server rejected the handshake over a certificate"),
)

# The SMTP replies worth naming, so the admin reads what to change rather than
# a number to look up. Anything else falls back to the class of the reply.
_SMTP_CODES = (
    (421, "the mail server is not accepting mail right now"),
    (450, "the mailbox was busy and it is worth retrying"),
    (530, "the mail server wants authentication before it will accept mail"),
    (534, "the mail server wants a different authentication method"),
    (535, "the mail server rejected the username or password"),
    (550, "the mail server rejected the sender or recipient address"),
    (552, "the mailbox is over its quota"),
    (554, "the mail server refused the message"),
)

_ERRNOS = (
    (errno.ENETUNREACH, "the network is unreachable"),
    (errno.EHOSTUNREACH, "there is no route to that host"),
    (errno.ENETDOWN, "the network is down"),
    (errno.EADDRNOTAVAIL, "that address is not available"),
    (errno.EPIPE, "the connection closed while sending"),
)


def _match(value, table, default: str) -> str:
    """The phrase beside the candidate *value* equals, or *default*.

    *value* is only ever compared. The string handed back comes from *table*,
    which is a constant above, so nothing the exception holds is returned.
    """
    for candidate, phrase in table:
        if value == candidate:
            return phrase
    return default


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

    # Order matters below: the specific socket and connection errors are
    # subclasses of OSError, so they have to be tested before it.
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
        return _match(getattr(exc, "verify_code", None), _VERIFY_CODES,
                      "the certificate could not be verified")
    if isinstance(exc, ssl.SSLError):
        return _match(getattr(exc, "reason", None), _SSL_REASONS,
                      "the TLS handshake failed")
    if isinstance(exc, OSError):
        return _match(exc.errno, _ERRNOS, "a network error occurred")
    return fallback


def describe_smtp(exc: BaseException) -> str:
    """A phrase for an SMTP failure, from the reply the server gave.

    The reply code is compared against the table above, never repeated, so the
    admin reads what to change instead of a number to go and look up, and
    nothing from the server's own response is passed along.
    """
    code = getattr(exc, "smtp_code", None)
    if isinstance(code, int):
        if 400 <= code <= 499:
            return _match(code, _SMTP_CODES,
                          "the mail server refused it for now and it is worth retrying")
        if 500 <= code <= 599:
            return _match(code, _SMTP_CODES, "the mail server rejected it outright")
    described = describe(exc, fallback="")
    return described or "the mail server could not be reached"

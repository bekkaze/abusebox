"""The mail-server check: reverse DNS, and what the server says on port 25.

Two parts, independent of each other:

* **Forward-confirmed reverse DNS.** The address's PTR names a host, and that
  host's A or AAAA record points back to the same address. Gmail and
  Outlook.com require it of anyone sending to them, and SpamRATS NoPtr and
  Dyna list on its absence. Pure DNS, no new kind of traffic.

* **An SMTP handshake.** Connect to port 25, wait for the greeting, EHLO,
  note whether STARTTLS is offered, complete it to read the certificate, QUIT.
  Never MAIL FROM, never RCPT TO: no mail is sent or attempted. It is what
  every sending server does on connect, and it ends with a clean QUIT so it
  does not look like an aborted session in the server's log.

What it refuses to conclude. Outbound port 25 is blocked by default on AWS,
Google Cloud, Azure and DigitalOcean and on many home connections, and from
the inside a dropped connection looks exactly like a server that is down. So
a timeout is "no answer", never "down". Only a refusal or a greeting is
evidence about the server.

Everything the server sends is written by whoever runs it, so the greeting is
cleaned and bounded before it is stored: data to show, never markup.
"""

import ipaddress
import re
import smtplib
import ssl
from datetime import UTC, datetime
from typing import Any

import dns.resolver

from app.core.config import settings
from app.core.failures import describe, describe_smtp
from app.core.hosts import extract_host
from app.core.network_safety import (
    NoIpv6RouteError,
    UnresolvableHostError,
    UnsafeDestinationError,
    has_ipv6_route,
    resolve_public_address,
)
from app.services.dns_records import reverse_lookup

_TIMEOUT = 15
_MAX_TEXT = 200
_MAX_PTR_FORWARD = 3
_HOST_RE = re.compile(
    r"(?=.{1,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+"
)


def _clean(text: Any) -> str:
    """Server-supplied text as one bounded line of printable ASCII."""
    if isinstance(text, bytes):
        text = text.decode("ascii", "replace")
    printable = "".join(ch if 32 <= ord(ch) < 127 else " " for ch in str(text or ""))
    return " ".join(printable.split())[:_MAX_TEXT]


def _greeting_host(text: Any) -> str | None:
    """The host a 220 greeting or a 250 EHLO reply names first, if it is one."""
    first = _clean(text).split(" ", 1)[0].lower().rstrip(".")
    return first if _HOST_RE.fullmatch(first) else None


def _bare(name: str) -> str:
    return name.lower().rstrip(".")


# --- reverse DNS -----------------------------------------------------------------

def _forward_addresses(name: str, version: int) -> list[str] | None:
    """*name*'s addresses of the given family; [] for none, None for no answer."""
    try:
        answers = dns.resolver.resolve(name, "AAAA" if version == 6 else "A", lifetime=5)
    except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer):
        return []
    except Exception:
        return None
    return [rdata.to_text() for rdata in answers]


def reverse_dns(address: str) -> dict[str, Any]:
    """The PTR names for *address*, and whether one of them points back."""
    ptr = reverse_lookup(address)
    if ptr is None:
        return {"ptr": None, "forward_confirmed": None, "confirmed_name": None,
                "error": "The reverse lookup got no answer."}
    names = [_bare(name) for name in ptr]
    if not names:
        return {"ptr": [], "forward_confirmed": False, "confirmed_name": None, "error": None}

    ip = ipaddress.ip_address(address)
    unanswered = False
    for name in names[:_MAX_PTR_FORWARD]:
        forward = _forward_addresses(name, ip.version)
        if forward is None:
            unanswered = True
            continue
        if any(ipaddress.ip_address(item) == ip for item in forward):
            return {"ptr": names, "forward_confirmed": True, "confirmed_name": name, "error": None}
    # A forward lookup that got no answer leaves the question open rather
    # than answering it "no".
    return {"ptr": names, "forward_confirmed": None if unanswered else False,
            "confirmed_name": None, "error": None}


# --- SMTP ------------------------------------------------------------------------

def _tls_context() -> ssl.SSLContext:
    """Verifies the chain as a sending server would. The names on the
    certificate are compared afterwards, not by the handshake, because which
    name an MX should carry is part of what is being reported.

    No SNI is sent (smtplib passes the address as the server name, and an
    address is never sent as SNI). That is deliberate: Postfix, the most common
    sending server, sends none by default, so the certificate seen here is the
    one most senders see.
    """
    context = ssl.create_default_context()
    context.check_hostname = False
    return context


def _cert_names(cert: dict) -> list[str]:
    names = [_bare(value) for kind, value in cert.get("subjectAltName", ()) if kind == "DNS"]
    if not names:
        subject = dict(item[0] for item in cert.get("subject", ()) if item)
        if subject.get("commonName"):
            names = [_bare(subject["commonName"])]
    return names


def _covers(pattern: str, host: str) -> bool:
    if pattern.startswith("*."):
        return "." in host and host.split(".", 1)[1] == pattern[2:]
    return pattern == host


def _start_tls(smtp: smtplib.SMTP) -> dict[str, Any]:
    try:
        code, reply = smtp.starttls(context=_tls_context())
    except ssl.SSLCertVerificationError as exc:
        return {"ok": False, "verified": False, "error": describe(exc)}
    except (ssl.SSLError, OSError, smtplib.SMTPException) as exc:
        return {"ok": False, "error": describe_smtp(exc) if isinstance(exc, smtplib.SMTPException) else describe(exc)}
    if code != 220:
        return {"ok": False, "error": describe_smtp(smtplib.SMTPResponseException(code, reply))}

    cert = smtp.sock.getpeercert() or {}
    cipher = smtp.sock.cipher()
    days = not_after = None
    if cert.get("notAfter"):
        expires = datetime.fromtimestamp(ssl.cert_time_to_seconds(cert["notAfter"]), UTC)
        days = (expires - datetime.now(UTC)).days
        not_after = expires.isoformat()
    return {
        "ok": True,
        "verified": True,
        "protocol": smtp.sock.version(),
        "cipher": cipher[0] if cipher else None,
        "days_remaining": days,
        "not_after": not_after,
        "names": _cert_names(cert)[:20],
    }


def _close(smtp: smtplib.SMTP) -> None:
    try:
        smtp.quit()
    except Exception:
        smtp.close()


def probe_smtp(address: str, ptr_names: list[str] | None = None, *, port: int = 25) -> dict[str, Any]:
    """What *address* says on port 25, up to and including STARTTLS.

    ``state`` is one of:
      ``answered``     it greeted; ``code`` says whether it accepts mail
      ``closed``       the connection was refused: nothing listens
      ``no_greeting``  the port accepted the connection and then said nothing
      ``no_answer``    no reply at all, which may be a filter on this side
      ``not_checked``  this machine cannot reach the address's family
    """
    if ipaddress.ip_address(address).version == 6 and not has_ipv6_route():
        return {"state": "not_checked", "port": port,
                "reason": describe(NoIpv6RouteError("no IPv6 route"))}

    smtp = smtplib.SMTP(local_hostname=settings.mail_check_helo, timeout=_TIMEOUT)
    try:
        try:
            code, message = smtp.connect(address, port)
        except ConnectionRefusedError:
            return {"state": "closed", "port": port, "reason": "the connection was refused"}
        except smtplib.SMTPServerDisconnected:
            # smtplib raises this for a timeout or a close *after* connecting.
            return {"state": "no_greeting", "port": port,
                    "reason": "the port accepted the connection but sent no greeting"}
        except OSError as exc:
            return {"state": "no_answer", "port": port, "reason": describe(exc)}

        result: dict[str, Any] = {
            "state": "answered",
            "port": port,
            "code": code,
            "banner": _clean(message),
            "banner_host": _greeting_host(message),
        }
        if code != 220:
            result["reason"] = describe_smtp(smtplib.SMTPResponseException(code, message))
            return result

        try:
            ehlo_code, reply = smtp.ehlo()
        except (smtplib.SMTPException, OSError) as exc:
            result["reason"] = describe_smtp(exc) if isinstance(exc, smtplib.SMTPException) else describe(exc)
            return result
        result["ehlo_host"] = _greeting_host(reply) if ehlo_code == 250 else None
        result["starttls"] = ehlo_code == 250 and smtp.has_extn("starttls")

        names = {_bare(name) for name in ptr_names or []}
        hosts = {host for host in (result["banner_host"], result["ehlo_host"]) if host}
        result["greeting_matches_ptr"] = bool(hosts & names) if names and hosts else None

        if result["starttls"]:
            tls = _start_tls(smtp)
            candidates = names | hosts
            if tls.get("names") and candidates:
                tls["matches_name"] = any(_covers(pattern, host) for pattern in tls["names"] for host in candidates)
            result["tls"] = tls
        return result
    finally:
        _close(smtp)


# --- the check -------------------------------------------------------------------

def check_mail_server(hostname: str) -> dict[str, Any]:
    """Reverse DNS and the SMTP handshake for the address *hostname* names."""
    host = extract_host(hostname)
    if not host:
        return {"error": "Please provide a hostname or IP address."}
    try:
        # connect=False: the reverse lookup needs no route, and the probe
        # says "not checked" for itself when IPv6 is unreachable.
        address = resolve_public_address(host, connect=False)
    except UnresolvableHostError:
        return {"host": host, "error": "The name could not be resolved."}
    except UnsafeDestinationError as exc:
        return {"host": host, "error": f"Not checked: {describe(exc)}."}

    reverse = reverse_dns(address)
    return {
        "host": host,
        "address": address,
        "family": "ipv6" if ipaddress.ip_address(address).version == 6 else "ipv4",
        "reverse_dns": reverse,
        "smtp": probe_smtp(address, reverse.get("ptr")),
    }

"""The mail-server check (1.6): reverse DNS and the SMTP handshake."""

import socket
import ssl
import threading
from datetime import UTC, datetime, timedelta
from unittest import mock

import dns.resolver
import pytest

from app.services import causes, dns_records, health, mail_server

# --- a scripted SMTP server on localhost ----------------------------------------


class FakeSmtp:
    """Speaks just enough SMTP to drive smtplib, and records every command."""

    def __init__(self, banner=b"220 mx.example.com ESMTP\r\n",
                 ehlo=b"250-mx.example.com Hello\r\n250-PIPELINING\r\n250 STARTTLS\r\n",
                 starttls=b"454 TLS not available right now\r\n", greet=True):
        self.banner, self.ehlo, self.starttls, self.greet = banner, ehlo, starttls, greet
        self.commands: list[str] = []
        self.server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.server.bind(("127.0.0.1", 0))
        self.server.listen(1)
        self.port = self.server.getsockname()[1]
        self.thread = threading.Thread(target=self._serve, daemon=True)
        self.thread.start()

    def _serve(self):
        conn, _ = self.server.accept()
        with conn, conn.makefile("rb") as lines:
            if not self.greet:
                lines.readline()          # wait silently until the client gives up
                return
            conn.sendall(self.banner)
            for raw in lines:
                command = raw.decode().strip()
                verb, _, rest = command.partition(" ")
                verb = verb.upper()       # SMTP verbs are case-insensitive; smtplib sends "ehlo"
                self.commands.append(f"{verb} {rest}".strip())
                if verb == "EHLO":
                    conn.sendall(self.ehlo)
                elif verb == "STARTTLS":
                    conn.sendall(self.starttls)
                elif verb == "QUIT":
                    conn.sendall(b"221 bye\r\n")
                    return
                else:
                    conn.sendall(b"502 not implemented\r\n")

    def close(self):
        self.thread.join(timeout=5)
        self.server.close()


@pytest.fixture
def fake_smtp():
    servers = []

    def start(**kwargs):
        server = FakeSmtp(**kwargs)
        servers.append(server)
        return server
    yield start
    for server in servers:
        server.close()


# --- the handshake against a real socket -----------------------------------------

def test_it_never_sends_an_envelope_command(fake_smtp):
    server = fake_smtp()
    result = mail_server.probe_smtp("127.0.0.1", ["mx.example.com"], port=server.port)
    server.close()
    # The whole conversation: greet, ask for TLS, leave. Nothing that could
    # start a message.
    assert server.commands == ["EHLO abusebox.invalid", "STARTTLS", "QUIT"]
    assert result["state"] == "answered"
    assert result["code"] == 220
    assert result["banner_host"] == "mx.example.com"
    assert result["ehlo_host"] == "mx.example.com"
    assert result["greeting_matches_ptr"] is True
    assert result["starttls"] is True
    assert result["tls"]["ok"] is False


def test_a_server_without_starttls(fake_smtp):
    server = fake_smtp(ehlo=b"250-mx.example.com\r\n250 PIPELINING\r\n")
    result = mail_server.probe_smtp("127.0.0.1", [], port=server.port)
    server.close()
    assert result["starttls"] is False
    assert "tls" not in result
    assert server.commands == ["EHLO abusebox.invalid", "QUIT"]


def test_a_greeting_that_does_not_match_reverse_dns(fake_smtp):
    server = fake_smtp()
    result = mail_server.probe_smtp("127.0.0.1", ["other.example.net."], port=server.port)
    assert result["greeting_matches_ptr"] is False


def test_a_server_that_refuses_us_is_still_an_answer(fake_smtp):
    server = fake_smtp(banner=b"554 no SMTP service here\r\n")
    result = mail_server.probe_smtp("127.0.0.1", [], port=server.port)
    server.close()
    assert result["state"] == "answered"
    assert result["code"] == 554
    assert "ehlo_host" not in result
    assert server.commands == ["QUIT"]


def test_server_text_is_cleaned_and_bounded(fake_smtp):
    server = fake_smtp(banner=b"220 mx.example.com <script>\x07\x1b[31m " + b"A" * 500 + b"\r\n")
    result = mail_server.probe_smtp("127.0.0.1", [], port=server.port)
    assert len(result["banner"]) <= 200
    assert "\x07" not in result["banner"] and "\x1b" not in result["banner"]


def test_a_closed_port():
    probe = socket.socket()
    probe.bind(("127.0.0.1", 0))
    port = probe.getsockname()[1]
    probe.close()                     # nothing listens there now
    result = mail_server.probe_smtp("127.0.0.1", [], port=port)
    assert result == {"state": "closed", "port": port, "reason": "the connection was refused"}


def test_a_port_that_connects_and_says_nothing(fake_smtp, monkeypatch):
    monkeypatch.setattr(mail_server, "_TIMEOUT", 0.5)
    server = fake_smtp(greet=False)
    result = mail_server.probe_smtp("127.0.0.1", [], port=server.port)
    assert result["state"] == "no_greeting"


def test_a_timeout_is_no_answer_never_down():
    # What a filtered outbound port 25 looks like from the inside.
    with mock.patch.object(mail_server.smtplib.SMTP, "connect", side_effect=TimeoutError()):
        result = mail_server.probe_smtp("192.0.2.25", [])
    assert result["state"] == "no_answer"
    assert result["reason"] == "timed out"


def test_ipv6_without_a_route_is_not_checked(monkeypatch):
    monkeypatch.setattr(mail_server, "has_ipv6_route", lambda: False)
    with mock.patch.object(mail_server.smtplib.SMTP, "connect") as connect:
        result = mail_server.probe_smtp("2001:4860:4860::8888", [])
    connect.assert_not_called()
    assert result["state"] == "not_checked"
    assert "no IPv6 connectivity" in result["reason"]


# --- TLS, with the session stubbed -------------------------------------------------

def _stub_session(starttls_effect=None, cert=None):
    session = mock.MagicMock()
    session.connect.return_value = (220, b"mx.example.com ESMTP")
    session.ehlo.return_value = (250, b"mx.example.com")
    session.has_extn.return_value = True
    if starttls_effect is not None:
        session.starttls.side_effect = starttls_effect
    else:
        session.starttls.return_value = (220, b"go ahead")
    session.sock.getpeercert.return_value = cert or {}
    session.sock.cipher.return_value = ("TLS_AES_256_GCM_SHA384", "TLSv1.3", 256)
    session.sock.version.return_value = "TLSv1.3"
    return session


def _cert(days, names=("mx.example.com",)):
    expires = (datetime.now(UTC) + timedelta(days=days, hours=1)).strftime("%b %d %H:%M:%S %Y GMT")
    return {"notAfter": expires, "subjectAltName": tuple(("DNS", name) for name in names)}


def test_a_verified_certificate_is_read():
    session = _stub_session(cert=_cert(40, names=("*.example.com",)))
    with mock.patch.object(mail_server.smtplib, "SMTP", return_value=session):
        result = mail_server.probe_smtp("192.0.2.25", ["mx.example.com"])
    tls = result["tls"]
    assert tls["ok"] is True and tls["verified"] is True
    assert tls["protocol"] == "TLSv1.3"
    assert tls["days_remaining"] == 40
    assert tls["names"] == ["*.example.com"]
    assert tls["matches_name"] is True
    session.quit.assert_called_once()


def test_a_certificate_that_fails_verification_says_why():
    error = ssl.SSLCertVerificationError(1, "certificate verify failed")
    error.verify_code = 18
    session = _stub_session(starttls_effect=error)
    with mock.patch.object(mail_server.smtplib, "SMTP", return_value=session):
        result = mail_server.probe_smtp("192.0.2.25", [])
    assert result["tls"] == {"ok": False, "verified": False, "error": "the certificate is self-signed"}


def test_the_tls_context_verifies_the_chain_but_not_the_name():
    context = mail_server._tls_context()
    assert context.verify_mode == ssl.CERT_REQUIRED
    assert context.check_hostname is False


# --- reverse DNS -----------------------------------------------------------------

def _forward(*addresses):
    return [mock.Mock(to_text=lambda a=a: a) for a in addresses]


def test_reverse_dns_that_points_back():
    with mock.patch.object(mail_server, "reverse_lookup", return_value=["mx.example.com."]), \
            mock.patch("dns.resolver.resolve", return_value=_forward("203.0.113.5")) as forward:
        result = mail_server.reverse_dns("203.0.113.5")
    assert result == {"ptr": ["mx.example.com"], "forward_confirmed": True,
                      "confirmed_name": "mx.example.com", "error": None}
    assert forward.call_args.args[:2] == ("mx.example.com", "A")


def test_reverse_dns_that_points_elsewhere():
    with mock.patch.object(mail_server, "reverse_lookup", return_value=["mx.example.com."]), \
            mock.patch("dns.resolver.resolve", return_value=_forward("198.51.100.9")):
        assert mail_server.reverse_dns("203.0.113.5")["forward_confirmed"] is False


def test_ipv6_reverse_dns_is_confirmed_by_aaaa():
    with mock.patch.object(mail_server, "reverse_lookup", return_value=["mx.example.com."]), \
            mock.patch("dns.resolver.resolve", return_value=_forward("2001:db8:0:0::1")) as forward:
        assert mail_server.reverse_dns("2001:db8::1")["forward_confirmed"] is True
    assert forward.call_args.args[1] == "AAAA"


def test_a_forward_lookup_without_an_answer_leaves_it_open():
    with mock.patch.object(mail_server, "reverse_lookup", return_value=["mx.example.com."]), \
            mock.patch("dns.resolver.resolve", side_effect=dns.resolver.LifetimeTimeout()):
        assert mail_server.reverse_dns("203.0.113.5")["forward_confirmed"] is None


def test_no_ptr_and_no_answer_are_different_things():
    with mock.patch.object(mail_server, "reverse_lookup", return_value=[]):
        assert mail_server.reverse_dns("203.0.113.5")["ptr"] == []
    with mock.patch.object(mail_server, "reverse_lookup", return_value=None):
        result = mail_server.reverse_dns("203.0.113.5")
    assert result["ptr"] is None and result["forward_confirmed"] is None


@pytest.mark.parametrize(("effect", "expected"), [
    (dns.resolver.NXDOMAIN(), []),
    (dns.resolver.NoAnswer(), []),
    (dns.resolver.LifetimeTimeout(), None),
    (dns.resolver.NoNameservers(), None),
])
def test_reverse_lookup_keeps_none_and_unknown_apart(effect, expected):
    with mock.patch("dns.resolver.resolve_address", side_effect=effect):
        assert dns_records.reverse_lookup("203.0.113.5") == expected


def test_the_dns_check_reports_a_reverse_lookup_without_an_answer():
    with mock.patch("dns.resolver.resolve_address", side_effect=dns.resolver.LifetimeTimeout()):
        result = dns_records.lookup_dns_records("8.8.8.8")
    assert result["error"] == "The reverse lookup got no answer."
    assert result["records"] == {}


# --- the check as a whole ----------------------------------------------------------

def test_a_private_address_is_not_checked():
    result = mail_server.check_mail_server("203.0.113.5")
    assert result["error"] == "Not checked: it does not resolve to a public address."


def test_the_check_combines_both_parts():
    reverse = {"ptr": ["mx.example.com"], "forward_confirmed": True, "confirmed_name": "mx.example.com", "error": None}
    with mock.patch.object(mail_server, "reverse_dns", return_value=reverse), \
            mock.patch.object(mail_server, "probe_smtp", return_value={"state": "closed"}) as probe:
        result = mail_server.check_mail_server("8.8.8.8")
    assert result == {"host": "8.8.8.8", "address": "8.8.8.8", "family": "ipv4",
                      "reverse_dns": reverse, "smtp": {"state": "closed"}}
    probe.assert_called_once_with("8.8.8.8", ["mx.example.com"])


@pytest.mark.parametrize(("value", "expected"), [
    ("mail.example.net", "mail.example.net"),
    ("", "abusebox.invalid"),
    ("bad name\r\nMAIL FROM:<x>", "abusebox.invalid"),
    ("-leading.example", "abusebox.invalid"),
])
def test_the_ehlo_name_cannot_carry_a_command(value, expected):
    from app.core.config import _helo_name
    assert _helo_name(value) == expected


# --- what health makes of it ----------------------------------------------------------

def _summary(smtp, reverse=None):
    result = {"mail_server": {"address": "198.51.100.25", "smtp": smtp,
                              "reverse_dns": reverse or {"ptr": ["mx.example.com"], "forward_confirmed": True}}}
    return health.summarize(None, result)


def _mail_messages(summary):
    return [issue["message"] for issue in summary["issues"] if issue["kind"] == "mail"]


@pytest.mark.parametrize("state", ["closed", "no_answer", "no_greeting", "not_checked"])
def test_a_host_that_does_not_answer_mail_raises_nothing(state):
    # Most new IP assets have the check on and are not mail servers.
    summary = _summary({"state": state}, reverse={"ptr": [], "forward_confirmed": False})
    assert _mail_messages(summary) == []
    assert summary["mail"]["smtp"] == state


def test_a_mail_server_without_reverse_dns_or_starttls():
    summary = _summary({"state": "answered", "code": 220, "starttls": False},
                       reverse={"ptr": [], "forward_confirmed": False})
    assert _mail_messages(summary) == ["Mail server has no reverse DNS", "Mail server does not offer STARTTLS"]


def test_a_mail_server_whose_reverse_dns_does_not_point_back():
    summary = _summary({"state": "answered", "code": 220, "starttls": True, "tls": {"ok": True, "days_remaining": 90}},
                       reverse={"ptr": ["mx.example.com"], "forward_confirmed": False})
    assert _mail_messages(summary) == ["Mail server's reverse DNS does not point back to its address"]


def test_a_mail_server_greeting_as_another_name():
    summary = _summary({"state": "answered", "code": 220, "starttls": True, "banner_host": "localhost.localdomain",
                        "greeting_matches_ptr": False, "tls": {"ok": True, "days_remaining": 90}})
    assert _mail_messages(summary) == ["Mail server greets as localhost.localdomain, not as its reverse DNS name"]


def test_a_mail_certificate_about_to_expire_is_critical():
    summary = _summary({"state": "answered", "code": 220, "starttls": True, "tls": {"ok": True, "days_remaining": 2}})
    [issue] = [i for i in summary["issues"] if i["kind"] == "mail"]
    assert issue == {"kind": "mail", "severity": "critical", "message": "Mail server certificate expires in 2 days"}


def test_a_mail_tls_failure_is_named():
    summary = _summary({"state": "answered", "code": 220, "starttls": True,
                        "tls": {"ok": False, "error": "the certificate is self-signed"}})
    assert _mail_messages(summary) == ["Mail server TLS failed: the certificate is self-signed"]


# --- what the cause resolver makes of it --------------------------------------------------

def test_the_mail_check_answers_the_noptr_question():
    results = {
        "blacklist": {"checked_address": "198.51.100.25",
                      "detected_on": [{"provider": "noptr.spamrats.com", "codes": ["127.0.0.38"]}]},
        "mail_server": {"address": "198.51.100.25", "reverse_dns": {"ptr": ["mx.example.com."]}},
    }
    [assessment] = causes.assess(results)
    assert assessment["fixed"] is True
    assert assessment["readiness"] == "ready"


# --- the default, through the API -------------------------------------------------------

@pytest.mark.parametrize(("payload", "expected"), [
    ({"hostname_type": "ipv4", "hostname": "203.0.113.30"}, True),
    ({"hostname_type": "ipv6", "hostname": "2001:db8::30"}, True),
    ({"hostname_type": "domain", "hostname": "mail.example.org"}, False),
    ({"hostname_type": "ipv4", "hostname": "203.0.113.31", "check_mail_server": False}, False),
    ({"hostname_type": "domain", "hostname": "mx.example.org", "check_mail_server": True}, True),
])
def test_new_assets_get_the_mail_check_by_type(client, admin_headers, payload, expected):
    response = client.post("/hostname/", json={"check_blacklist": False, **payload}, headers=admin_headers)
    assert response.status_code == 200, response.text
    assert response.json()["check_mail_server"] is expected


def test_a_cidr_import_never_gets_it_by_default(client, admin_headers):
    response = client.post("/hostname/cidr-import/", json={"cidr": "203.0.113.0/30", "check_blacklist": False},
                           headers=admin_headers)
    assert response.status_code == 200, response.text
    assets = client.get("/hostname/list/", headers=admin_headers).json()
    assert assets and not any(asset["check_mail_server"] for asset in assets)

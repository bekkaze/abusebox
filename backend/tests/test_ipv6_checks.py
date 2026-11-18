"""IPv6 for the checks that connect or report an address (1.6.0).

1.5.0 made IPv6 assets possible, but server status, SSL and AbuseIPDB still
resolved IPv4 only, and every check split hosts on ":", which turns
2001:db8::1 into "2001". An IPv6 asset with server status on came back as
"DNS resolution failed", which the risk score counted as a down server.
"""

import socket
from unittest import mock

import pytest

from app.core import network_safety
from app.core.hosts import extract_host
from app.services import abuseipdb, dns_records, health, server_status, ssl_checker

V6 = "2001:4860:4860::8888"   # global unicast; 2001:db8::/32 is documentation, not public
V4 = "93.184.216.34"


def _answers(mapping):
    """A getaddrinfo stand-in that answers both families, as the real one does."""
    def fake(host, *args, **kwargs):
        if host not in mapping:
            raise socket.gaierror("not found")
        return [
            (socket.AF_INET6, socket.SOCK_STREAM, 6, "", (addr, 0, 0, 0)) if ":" in addr
            else (socket.AF_INET, socket.SOCK_STREAM, 6, "", (addr, 0))
            for addr in mapping[host]
        ]
    return fake


@pytest.fixture
def ipv6_route(monkeypatch):
    def set_route(available: bool):
        monkeypatch.setattr(network_safety, "has_ipv6_route", lambda: available)
    return set_route


# --- the host parser -------------------------------------------------------------

@pytest.mark.parametrize(("value", "host"), [
    ("2001:db8::1", "2001:db8::1"),
    ("[2001:db8::1]", "2001:db8::1"),
    ("[2001:db8::1]:8443", "2001:db8::1"),
    ("https://[2001:db8::1]:8443/path", "2001:db8::1"),
    ("mail.example.com:25", "mail.example.com"),
    ("203.0.113.5:80", "203.0.113.5"),
    ("http://example.com/x", "example.com"),
    ("example.com/x", "example.com"),
    ("  example.com  ", "example.com"),
    ("", ""),
])
def test_extract_host_keeps_an_ipv6_literal_whole(value, host):
    assert extract_host(value) == host


# --- choosing an address ---------------------------------------------------------

def test_a_name_with_both_families_is_checked_over_ipv4(ipv6_route):
    # Unchanged from before 1.6: an asset with an A record is checked as it was.
    ipv6_route(True)
    with mock.patch("socket.getaddrinfo", _answers({"dual.test": [V6, V4]})):
        assert network_safety.resolve_public_address("dual.test") == V4


def test_an_ipv6_only_host_is_checked_over_ipv6(ipv6_route):
    ipv6_route(True)
    with mock.patch("socket.getaddrinfo", _answers({V6: [V6]})):
        assert network_safety.resolve_public_address(V6) == V6


def test_no_ipv6_route_is_its_own_refusal(ipv6_route):
    ipv6_route(False)
    with mock.patch("socket.getaddrinfo", _answers({V6: [V6]})), \
            pytest.raises(network_safety.NoIpv6RouteError):
        network_safety.resolve_public_address(V6)


def test_reporting_an_address_needs_no_route(ipv6_route):
    ipv6_route(False)
    with mock.patch("socket.getaddrinfo", _answers({"v6only.test": [V6]})):
        assert network_safety.resolve_public_address("v6only.test", connect=False) == V6


def test_a_private_ipv6_answer_still_refuses_the_name(ipv6_route):
    ipv6_route(True)
    with mock.patch("socket.getaddrinfo", _answers({"mixed.test": [V4, "fd00::1"]})), \
            pytest.raises(network_safety.PrivateDestinationError):
        network_safety.resolve_public_address("mixed.test")


def test_url_validation_looks_at_the_aaaa_records_too():
    # Only the A record used to be checked, so this passed.
    with mock.patch("socket.getaddrinfo", _answers({"mixed.test": [V4, "fd00::1"]})), \
            pytest.raises(network_safety.PrivateDestinationError):
        network_safety.validate_public_url("https://mixed.test/")


def test_ipv6_route_probe_sends_nothing_and_is_cached(monkeypatch):
    monkeypatch.setattr(network_safety, "_ipv6_route", None)
    probe = mock.MagicMock()
    probe.return_value.__enter__.return_value.connect.side_effect = OSError("unreachable")
    with mock.patch("socket.socket", probe):
        assert network_safety.has_ipv6_route() is False
        assert network_safety.has_ipv6_route() is False
    assert probe.call_count == 1
    assert probe.call_args.args == (socket.AF_INET6, socket.SOCK_DGRAM)


# --- server status ---------------------------------------------------------------

def test_server_status_checks_an_ipv6_literal(ipv6_route):
    ipv6_route(True)
    response = mock.Mock(is_redirect=False, headers={}, status_code=200, iter_content=lambda chunk_size: [b"ok"])
    with mock.patch("socket.getaddrinfo", _answers({V6: [V6]})), \
            mock.patch.object(server_status.requests.Session, "get", return_value=response) as get, \
            mock.patch("socket.socket") as sock:
        result = server_status.check_server_status(V6)
    assert result["resolved_ip"] == V6
    assert result["status_code"] == 200
    assert get.call_args.args[0] == f"https://[{V6}]"
    assert get.call_args.kwargs["headers"]["Host"] == f"[{V6}]"
    assert sock.call_args_list[0].args[0] == socket.AF_INET6


def test_server_status_without_ipv6_is_not_reported_down(ipv6_route):
    ipv6_route(False)
    with mock.patch("socket.getaddrinfo", _answers({V6: [V6]})):
        result = server_status.check_server_status(V6)
    assert result["error"] == ("Not checked: it has only IPv6 addresses and this "
                               "AbuseBox has no IPv6 connectivity.")
    assert "is_up" not in result
    # Out of health and the score, instead of a down server worth 20 points.
    assert health.server_state({"server_status": result}) is None


def test_server_status_still_says_when_a_name_does_not_resolve():
    with mock.patch("socket.getaddrinfo", _answers({})):
        result = server_status.check_server_status("missing.test")
    assert result["dns_resolves"] is False
    assert result["reason"] == "DNS resolution failed"


# --- SSL ---------------------------------------------------------------------

def test_ssl_check_connects_to_an_ipv6_literal(ipv6_route):
    ipv6_route(True)
    with mock.patch("socket.getaddrinfo", _answers({V6: [V6]})), \
            mock.patch("socket.create_connection", side_effect=OSError("stop")) as connect:
        ssl_checker.check_ssl_certificate(f"https://[{V6}]:443/")
    assert connect.call_args.args[0] == (V6, 443)


def test_ssl_check_without_ipv6_is_an_error_not_an_invalid_certificate(ipv6_route):
    ipv6_route(False)
    with mock.patch("socket.getaddrinfo", _answers({V6: [V6]})):
        result = ssl_checker.check_ssl_certificate(V6)
    assert "no IPv6 connectivity" in result["error"]
    assert "valid" not in result
    assert health.ssl_state({"ssl": result}) is None


# --- AbuseIPDB -------------------------------------------------------------------

@pytest.mark.parametrize("value", [V6, f"[{V6}]", f"https://[{V6}]/"])
def test_abuseipdb_accepts_an_ipv6_address(value):
    assert abuseipdb._extract_ip(value) == V6


def test_abuseipdb_refuses_a_private_ipv6_address():
    assert abuseipdb._extract_ip("fd00::1") is None


def test_abuseipdb_looks_up_an_ipv6_only_name_without_a_route(ipv6_route):
    # It asks AbuseIPDB about the address and never connects to it.
    ipv6_route(False)
    with mock.patch("socket.getaddrinfo", _answers({"v6only.test": [V6]})):
        assert abuseipdb._extract_ip("v6only.test") == V6


# --- DNS records ---------------------------------------------------------------

@pytest.mark.parametrize("address", [V6, "8.8.8.8"])
def test_dns_records_for_an_address_is_its_ptr(address):
    ptr = mock.Mock(return_value=[mock.Mock(to_text=lambda: "dns.google.")])
    with mock.patch("dns.resolver.resolve_address", ptr), \
            mock.patch("dns.resolver.resolve") as forward:
        result = dns_records.lookup_dns_records(address)
    assert result == {"domain": address, "records": {"PTR": ["dns.google."]}, "record_types_checked": ["PTR"]}
    ptr.assert_called_once_with(address, lifetime=5)
    forward.assert_not_called()


def test_dns_records_for_a_name_strips_the_port():
    with mock.patch("dns.resolver.resolve", return_value=[]) as forward:
        result = dns_records.lookup_dns_records("Example.com:443")
    assert result["domain"] == "example.com"
    assert forward.call_args_list[0].args[0] == "example.com"

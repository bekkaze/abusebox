"""Offline unit tests for services (network calls are stubbed)."""

import gzip
import io
import socket
import zipfile
from unittest import mock

import pytest
import requests
from starlette.requests import Request

from app.core import network_safety
from app.core.client_ip import get_client_ip
from app.services import dmarc_parser, dnsbl, server_status
from app.services.target_file_parser import parse_target_file


def _fake_getaddrinfo(mapping):
    def fake(host, *args, **kwargs):
        if host not in mapping:
            raise socket.gaierror("not found")
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", (mapping[host], 0))]
    return fake


# --- network safety -----------------------------------------------------------

@pytest.mark.parametrize("address", ["127.0.0.1", "10.0.0.5", "192.168.1.169", "169.254.169.254", "100.64.0.1"])
def test_private_destinations_are_rejected(address):
    with mock.patch("socket.getaddrinfo", _fake_getaddrinfo({"internal.test": address})):
        with pytest.raises(network_safety.UnsafeDestinationError):
            network_safety.resolve_public_ipv4("internal.test")


def test_public_destination_is_allowed():
    with mock.patch("socket.getaddrinfo", _fake_getaddrinfo({"public.test": "93.184.216.34"})):
        assert network_safety.resolve_public_ipv4("public.test") == "93.184.216.34"


def test_server_status_does_not_follow_redirect_to_metadata_endpoint():
    redirect = mock.Mock(is_redirect=True, headers={"Location": "http://metadata.test/latest/meta-data"})
    hosts = {"public.test": "93.184.216.34", "metadata.test": "169.254.169.254"}
    with mock.patch("socket.getaddrinfo", _fake_getaddrinfo(hosts)), \
            mock.patch.object(server_status.requests, "get", return_value=redirect) as get, \
            mock.patch("socket.socket"):
        result = server_status.check_server_status("https://public.test")
    assert get.call_count == 1  # never requested the internal hop
    assert result["is_up"] is False
    assert result["reason"].startswith("Redirect blocked")


def test_server_status_reports_private_target_clearly():
    with mock.patch("socket.getaddrinfo", _fake_getaddrinfo({"router.test": "192.168.1.1"})):
        result = server_status.check_server_status("router.test")
    assert result["dns_resolves"] is True
    assert result["is_up"] is False
    assert "not allowed" in result["reason"]


# --- client IP ------------------------------------------------------------------

def _request(peer, forwarded=None):
    headers = [(b"x-forwarded-for", forwarded.encode())] if forwarded else []
    return Request({"type": "http", "client": (peer, 1234), "headers": headers})


# Note: Python treats the RFC 5737 documentation ranges as private, so these
# tests use real public addresses.
def test_client_ip_ignores_spoofed_header_from_public_peer():
    assert get_client_ip(_request("8.8.8.8", "1.2.3.4")) == "8.8.8.8"


def test_client_ip_uses_forwarded_for_from_internal_proxy():
    # Client sent a fake header; the proxy appended the real address last.
    assert get_client_ip(_request("172.18.0.3", "1.2.3.4, 9.9.9.9")) == "9.9.9.9"
    # Extra internal hops (e.g. nginx in front of the frontend) are skipped.
    assert get_client_ip(_request("172.18.0.3", "9.9.9.9, 10.0.0.2")) == "9.9.9.9"
    assert get_client_ip(_request("172.18.0.3")) == "172.18.0.3"


# --- DNSBL response codes ---------------------------------------------------------

def _answers(*addresses):
    return [mock.Mock(to_text=mock.Mock(return_value=a)) for a in addresses]


def test_dnsbl_listing_code_counts_as_listed():
    resolver = mock.Mock(resolve=mock.Mock(return_value=_answers("127.0.0.2")))
    assert dnsbl._check_provider("4.3.2.1", "zen.spamhaus.org", resolver) == ("zen.spamhaus.org", True, False)


def test_dnsbl_refusal_code_counts_as_failed_not_clear():
    # Spamhaus answers 127.255.255.254 to queries via public resolvers.
    resolver = mock.Mock(resolve=mock.Mock(return_value=_answers("127.255.255.254")))
    assert dnsbl._check_provider("4.3.2.1", "zen.spamhaus.org", resolver) == ("zen.spamhaus.org", False, True)


def test_dnsbl_marks_result_inconclusive_when_many_providers_fail():
    def fake_check(reversed_ip, provider, resolver=None):
        return provider, False, True
    with mock.patch.object(dnsbl, "_check_provider", fake_check):
        result = dnsbl.check_dnsbl_providers("203.0.113.10")
    assert result["is_inconclusive"] is True
    assert result["is_blacklisted"] is False


# --- target file parsing -----------------------------------------------------------

def test_parse_csv_targets_dedupes_and_skips_header():
    data = b"hostname\nExample.com\n203.0.113.10\nexample.com\n"
    assert parse_target_file("targets.csv", data) == ["example.com", "203.0.113.10"]


def test_parse_corrupt_xlsx_is_a_clean_error():
    with pytest.raises(ValueError, match="Excel"):
        parse_target_file("targets.xlsx", b"not a zip file")


def test_parse_rejects_unknown_extension():
    with pytest.raises(ValueError):
        parse_target_file("targets.pdf", b"example.com")


# --- DMARC -----------------------------------------------------------------------

DMARC_XML = b"""<?xml version="1.0"?>
<feedback>
  <report_metadata><org_name>google.com</org_name><report_id>r1</report_id>
    <date_range><begin>1700000000</begin><end>1700086400</end></date_range></report_metadata>
  <policy_published><domain>example.com</domain><p>reject</p></policy_published>
  <record>
    <row><source_ip>203.0.113.10</source_ip><count>3</count>
      <policy_evaluated><disposition>none</disposition><dkim>pass</dkim><spf>fail</spf></policy_evaluated></row>
    <auth_results>
      <dkim><domain>example.com</domain><result>pass</result><selector>s1</selector></dkim>
      <dkim><domain>esp.example</domain><result>fail</result><selector>s2</selector></dkim>
      <spf><domain>example.com</domain><result>fail</result></spf>
    </auth_results>
  </record>
</feedback>"""


def test_dmarc_parser_keeps_every_dkim_signature():
    parsed = dmarc_parser.parse_dmarc_xml(dmarc_parser.extract_xml(gzip.compress(DMARC_XML)))
    record = parsed["records"][0]
    assert parsed["domain"] == "example.com"
    assert [r["domain"] for r in record["dkim_results"]] == ["example.com", "esp.example"]
    assert record["dkim_domain"] == "example.com"


def test_dmarc_gzip_bomb_is_rejected():
    bomb = gzip.compress(b"<" + b"a" * (11 * 1024 * 1024))
    with pytest.raises(ValueError, match="10 MB"):
        dmarc_parser.extract_xml(bomb)


def test_dmarc_zip_with_multiple_reports_is_rejected():
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("a.xml", DMARC_XML)
        archive.writestr("b.xml", DMARC_XML)
    with pytest.raises(ValueError):
        dmarc_parser.extract_xml(buffer.getvalue())


def test_requests_is_patched_module():
    # Guard: server_status must use the shared requests module so the stubs above apply.
    assert server_status.requests is requests

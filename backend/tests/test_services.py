"""Offline unit tests for services (network calls are stubbed)."""

import contextlib
import gzip
import io
import socket
import ssl
import zipfile
from unittest import mock

import pytest
import requests
from starlette.requests import Request

from app.core import network_safety
from app.core.client_ip import get_client_ip
from app.services import dmarc_parser, dnsbl, server_status, ssl_checker, whois_lookup
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
            mock.patch.object(server_status.requests.Session, "get", return_value=redirect) as get, \
            mock.patch("socket.socket"):
        result = server_status.check_server_status("https://public.test")
    assert get.call_count == 1  # never requested the internal hop
    assert result["is_up"] is False
    assert result["reason"].startswith("Redirect blocked")


def test_server_status_connects_to_the_checked_address():
    # DNS rebinding: the name resolves to a public address when checked and to
    # an internal one afterwards. The request must go to the checked address.
    answers = iter(["93.184.216.34"] * 4)

    def rebinding(host, *args, **kwargs):
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", (next(answers, "127.0.0.1"), 0))]

    response = mock.Mock(is_redirect=False, headers={}, status_code=200, iter_content=lambda chunk_size: [b"ok"])
    with mock.patch("socket.getaddrinfo", rebinding), \
            mock.patch.object(server_status.requests.Session, "get", return_value=response) as get, \
            mock.patch("socket.socket"):
        result = server_status.check_server_status("https://rebind.test/")
    url = get.call_args.args[0]
    assert url == "https://93.184.216.34/"
    assert get.call_args.kwargs["headers"]["Host"] == "rebind.test"
    assert result["status_code"] == 200


def test_ssl_check_connects_to_the_checked_address():
    with mock.patch("socket.getaddrinfo", _fake_getaddrinfo({"rebind.test": "93.184.216.34"})), \
            mock.patch("socket.create_connection", side_effect=OSError("stop")) as connect:
        ssl_checker.check_ssl_certificate("rebind.test")
    assert connect.call_args.args[0] == ("93.184.216.34", 443)


def test_server_status_reports_private_target_clearly():
    with mock.patch("socket.getaddrinfo", _fake_getaddrinfo({"router.test": "192.168.1.1"})):
        result = server_status.check_server_status("router.test")
    assert result["dns_resolves"] is True
    assert result["is_up"] is False
    assert result["reason"] == "Not checked: it does not resolve to a public address."


# --- client IP ------------------------------------------------------------------

def _request(peer, forwarded=None, real_ip=None):
    headers = [(b"x-forwarded-for", forwarded.encode())] if forwarded else []
    if real_ip:
        headers.append((b"x-real-ip", real_ip.encode()))
    return Request({"type": "http", "client": (peer, 1234), "headers": headers})


# Note: Python treats the RFC 5737 documentation ranges as private, so these
# tests use real public addresses.
def test_client_ip_ignores_spoofed_header_from_public_peer():
    assert get_client_ip(_request("8.8.8.8", "1.2.3.4", real_ip="1.2.3.4")) == "8.8.8.8"


def test_client_ip_uses_real_ip_from_internal_proxy():
    # The bundled nginx sets X-Real-IP to the address that connected to it.
    assert get_client_ip(_request("172.18.0.3", real_ip="9.9.9.9")) == "9.9.9.9"
    # LAN clients are told apart too.
    assert get_client_ip(_request("172.18.0.3", real_ip="192.168.1.50")) == "192.168.1.50"
    assert get_client_ip(_request("172.18.0.3")) == "172.18.0.3"
    assert get_client_ip(_request("172.18.0.3", real_ip="not-an-ip")) == "172.18.0.3"


def test_client_ip_never_trusts_forwarded_for():
    # A LAN client's own X-Forwarded-For used to pick its rate-limit key, so
    # rotating it bypassed the login lockout.
    for spoofed in ("1.1.1.1", "8.8.8.8, 192.168.1.50", "9.9.9.9, 10.0.0.2"):
        assert get_client_ip(_request("172.18.0.3", spoofed, real_ip="192.168.1.50")) == "192.168.1.50"


# --- DNSBL response codes ---------------------------------------------------------

def _answers(*addresses):
    return [mock.Mock(to_text=mock.Mock(return_value=a)) for a in addresses]


def as_lookup(fake_check):
    """Adapt a (provider, listed, failure) fake to dnsbl._lookup's (codes, failure)."""
    def lookup(reversed_ip, provider, resolver=None):
        _, listed, failure = fake_check(reversed_ip, provider)
        if failure is True:
            failure = dnsbl.UNREACHABLE
        return (["127.0.0.2"] if listed else []), (failure or None)
    return lookup


def test_dnsbl_listing_code_counts_as_listed():
    resolver = mock.Mock(resolve=mock.Mock(return_value=_answers("127.0.0.2")))
    assert dnsbl._check_provider("4.3.2.1", "zen.spamhaus.org", resolver) == ("zen.spamhaus.org", True, None)


def test_dnsbl_refusal_code_counts_as_failed_not_clear():
    # Spamhaus answers 127.255.255.254 to queries via public resolvers.
    resolver = mock.Mock(resolve=mock.Mock(return_value=_answers("127.255.255.254")))
    assert dnsbl._check_provider("4.3.2.1", "zen.spamhaus.org", resolver) == ("zen.spamhaus.org", False, dnsbl.REFUSED)


def test_dnsbl_answer_outside_loopback_counts_as_failed_not_clear():
    # An expired list domain parked on a web server answers every name.
    resolver = mock.Mock(resolve=mock.Mock(return_value=_answers("198.51.100.7")))
    assert dnsbl._check_provider("4.3.2.1", "dead.example", resolver) == ("dead.example", False, dnsbl.REFUSED)


def test_dnsbl_retries_timeouts_but_not_refusals():
    calls = []
    def fake_check(reversed_ip, provider, resolver=None):
        if reversed_ip == "10.113.0.203":
            calls.append(provider)
            if provider == "zen.spamhaus.org":
                return provider, False, dnsbl.REFUSED  # e.g. 127.255.255.255, rate limited
            if provider == "bl.spamcop.net":
                return provider, False, dnsbl.UNREACHABLE
        return provider, reversed_ip == "2.0.0.127", None
    dnsbl._test_point_ok_until.clear()
    with mock.patch.object(dnsbl, "_lookup", as_lookup(fake_check)):
        result = dnsbl.check_dnsbl_providers("203.0.113.10")
    assert calls.count("zen.spamhaus.org") == 1
    assert calls.count("bl.spamcop.net") == 2
    assert result["failed_providers"] == ["bl.spamcop.net", "zen.spamhaus.org"]


def test_dnsbl_marks_result_inconclusive_when_many_providers_fail():
    def fake_check(reversed_ip, provider, resolver=None):
        return provider, False, True
    with mock.patch.object(dnsbl, "_lookup", as_lookup(fake_check)):
        result = dnsbl.check_dnsbl_providers("203.0.113.10")
    assert result["is_inconclusive"] is True
    assert result["is_blacklisted"] is False


def test_dnsbl_clean_answer_from_provider_ignoring_test_point_counts_as_failed():
    # Spamhaus answers NXDOMAIN (looks clean) through some public resolvers,
    # including for its always-listed test point 127.0.0.2.
    def fake_check(reversed_ip, provider, resolver=None):
        refusing = provider == "zen.spamhaus.org"
        return provider, reversed_ip == "2.0.0.127" and not refusing, False
    dnsbl._test_point_ok_until.clear()
    with mock.patch.object(dnsbl, "_lookup", as_lookup(fake_check)):
        result = dnsbl.check_dnsbl_providers("203.0.113.10")
    assert result["failed_providers"] == ["zen.spamhaus.org"]
    assert result["is_blacklisted"] is False
    assert result["is_inconclusive"] is False


def test_dnsbl_test_point_success_is_cached():
    calls = []
    def fake_check(reversed_ip, provider, resolver=None):
        calls.append(reversed_ip)
        return provider, reversed_ip == "2.0.0.127", False
    dnsbl._test_point_ok_until.clear()
    with mock.patch.object(dnsbl, "_lookup", as_lookup(fake_check)):
        dnsbl.check_dnsbl_providers("203.0.113.10")
        dnsbl.check_dnsbl_providers("203.0.113.11")
    assert calls.count("2.0.0.127") == len(dnsbl.BASE_PROVIDERS)
    assert calls.count("1.0.0.127") == len(dnsbl.BASE_PROVIDERS)


def test_dnsbl_listing_from_provider_that_lists_everything_counts_as_failed():
    # A zone that lists 127.0.0.1 lists every address (AHBL did this in 2015).
    def fake_check(reversed_ip, provider, resolver=None):
        lists_everything = provider == "bl.spamcop.net"
        return provider, reversed_ip == "2.0.0.127" or lists_everything, False
    dnsbl._test_point_ok_until.clear()
    with mock.patch.object(dnsbl, "_lookup", as_lookup(fake_check)):
        result = dnsbl.check_dnsbl_providers("203.0.113.10")
    assert result["detected_on"] == []
    assert result["is_blacklisted"] is False
    assert result["failed_providers"] == ["bl.spamcop.net"]


def test_subnet_check_skips_provider_that_lists_everything():
    from app.services import subnet_check

    def fake_check(reversed_ip, provider, resolver=None):
        lists_everything = provider == "bl.spamcop.net"
        return provider, reversed_ip == "2.0.0.127" or lists_everything, False
    dnsbl._test_point_ok_until.clear()
    with mock.patch.object(dnsbl, "_lookup", as_lookup(fake_check)):
        result = subnet_check.check_subnet("203.0.113.0/30")
    assert result["blacklisted_count"] == 0
    assert result["failed_providers"] == ["bl.spamcop.net"]
    assert "bl.spamcop.net" not in result["providers_checked"]


def test_subnet_check_counts_ips_with_failed_lookups_as_incomplete():
    from app.services import subnet_check

    # Spamhaus starts rate limiting partway through the scan.
    def fake_check(reversed_ip, provider, resolver=None):
        if provider == "zen.spamhaus.org" and reversed_ip in ("3.113.0.203", "4.113.0.203"):
            return provider, False, dnsbl.REFUSED
        return provider, reversed_ip == "2.0.0.127", None
    dnsbl._test_point_ok_until.clear()
    with mock.patch.object(dnsbl, "_lookup", as_lookup(fake_check)):
        result = subnet_check.check_subnet("203.0.113.0/29")
    by_ip = {r["ip"]: r for r in result["results"]}
    assert by_ip["203.0.113.3"]["failed_on"] == ["zen.spamhaus.org"]
    assert by_ip["203.0.113.1"]["failed_on"] == []
    assert result["incomplete_count"] == 2
    assert result["clean_count"] == result["total_ips"] - 2


def test_dnsbl_decodes_spamhaus_codes_and_orders_by_severity():
    def fake_lookup(reversed_ip, provider, resolver=None):
        if reversed_ip == "2.0.0.127":
            return ["127.0.0.2"], None
        if provider == "zen.spamhaus.org" and reversed_ip == "10.113.0.203":
            return ["127.0.0.10"], None
        if provider == "ips.backscatterer.org" and reversed_ip == "10.113.0.203":
            return ["127.0.0.2"], None
        return [], None
    dnsbl._test_point_ok_until.clear()
    with mock.patch.object(dnsbl, "_lookup", fake_lookup):
        result = dnsbl.check_dnsbl_providers("203.0.113.10")
    first, second = result["detected_on"]
    assert first["provider"] == "zen.spamhaus.org"
    assert first["severity"] == "high"
    assert first["categories"] == ["PBL: end-user range, listed by its ISP"]
    assert second["provider"] == "ips.backscatterer.org"
    assert second["severity"] == "info"
    assert result["severity"] == "high"


def test_dnsbl_neutral_code_is_not_a_listing():
    # Mailspike answers 127.0.0.13 (L2, neutral reputation) for ordinary senders.
    resolver = mock.Mock(resolve=mock.Mock(return_value=_answers("127.0.0.13")))
    assert dnsbl._lookup("4.3.2.1", "bl.mailspike.net", resolver) == ([], None)
    resolver = mock.Mock(resolve=mock.Mock(return_value=_answers("127.0.0.13", "127.0.0.11")))
    assert dnsbl._lookup("4.3.2.1", "bl.mailspike.net", resolver) == (["127.0.0.11"], None)


def test_dnsbl_uses_spamhaus_dqs_key_when_set(monkeypatch):
    monkeypatch.setenv("SPAMHAUS_DQS_KEY", "abc123")
    assert dnsbl._query_zone("zen.spamhaus.org") == "abc123.zen.dq.spamhaus.net"
    assert dnsbl._query_zone("bl.spamcop.net") == "bl.spamcop.net"
    monkeypatch.delenv("SPAMHAUS_DQS_KEY")
    assert dnsbl._query_zone("zen.spamhaus.org") == "zen.spamhaus.org"


def test_dnsbl_nameservers_accept_hostnames(monkeypatch):
    monkeypatch.setenv("DNSBL_NAMESERVERS", "192.0.2.53, unbound, missing.invalid")
    lookup = {"unbound": "172.18.0.5"}
    def fake_gethostbyname(name):
        if name not in lookup:
            raise OSError(name)
        return lookup[name]
    with mock.patch.object(dnsbl.socket, "gethostbyname", fake_gethostbyname):
        assert dnsbl._configured_nameservers() == ["192.0.2.53", "172.18.0.5"]


def _resolver_answering(working):
    """A fake _lookup: Spamhaus's test point answers only through *working* nameservers."""
    def lookup(reversed_ip, provider, resolver=None):
        if working is not None and resolver.nameservers == working:
            return ["127.0.0.2"], None
        if working is None and resolver.nameservers != ["172.18.0.5"]:
            return ["127.0.0.2"], None
        return [], dnsbl.UNREACHABLE
    return lookup


@pytest.mark.parametrize("working,expected", [
    (["172.18.0.5"], ["172.18.0.5"]),  # the bundled resolver works: use it
    (None, None),                      # it can't recurse but the system resolver can: fall back
])
def test_dnsbl_falls_back_to_the_system_resolver(monkeypatch, working, expected):
    monkeypatch.setenv("DNSBL_NAMESERVERS", "172.18.0.5")
    monkeypatch.setitem(dnsbl._resolver_choice, "until", 0.0)
    with mock.patch.object(dnsbl, "_lookup", _resolver_answering(working)):
        resolver = dnsbl._make_resolver()
    if expected is None:
        assert resolver.nameservers != ["172.18.0.5"]
        assert dnsbl.resolver_source() == "system"
    else:
        assert resolver.nameservers == expected
        assert dnsbl.resolver_source() == "configured"


def test_dnsbl_keeps_the_configured_resolver_when_nothing_works(monkeypatch):
    monkeypatch.setenv("DNSBL_NAMESERVERS", "172.18.0.5")
    monkeypatch.setitem(dnsbl._resolver_choice, "until", 0.0)
    with mock.patch.object(dnsbl, "_lookup", return_value=([], dnsbl.REFUSED)):
        assert dnsbl._make_resolver().nameservers == ["172.18.0.5"]


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


# --- email security: SPF ------------------------------------------------------------

def _txt(mapping):
    return lambda domain: mapping.get(domain, [])


def test_spf_follows_redirect_to_find_all_policy():
    from app.services import email_security
    records = {
        "gmail.example": ["v=spf1 redirect=_spf.gmail.example"],
        "_spf.gmail.example": ["v=spf1 include:_netblocks.gmail.example ~all"],
    }
    with mock.patch.object(email_security, "_dns_txt_records", _txt(records)):
        spf = email_security._check_spf("gmail.example")
    assert spf["valid"] is True
    assert spf["mechanism_all"] == "~all"
    assert spf["redirect"] == "_spf.gmail.example"
    assert spf["warnings"] == []


def test_spf_all_mechanism_wins_over_redirect_and_bare_all_is_pass():
    from app.services import email_security
    records = {"a.example": ["v=spf1 -all redirect=b.example"], "c.example": ["v=spf1 all"]}
    with mock.patch.object(email_security, "_dns_txt_records", _txt(records)):
        assert email_security._check_spf("a.example")["mechanism_all"] == "-all"
        bare = email_security._check_spf("c.example")
    assert bare["mechanism_all"] == "+all" and bare["valid"] is False


def test_spf_redirect_loop_is_bounded():
    from app.services import email_security
    records = {"loop.example": ["v=spf1 redirect=loop.example"]}
    with mock.patch.object(email_security, "_dns_txt_records", _txt(records)):
        spf = email_security._check_spf("loop.example")
    assert spf["valid"] is False and spf["warnings"]


def test_long_txt_records_are_joined_without_quotes():
    from app.services import email_security
    answer = [mock.Mock(strings=[b"v=spf1 include:a.example include:b.example", b" include:c.example -all"])]
    with mock.patch("dns.resolver.resolve", return_value=answer):
        assert email_security._dns_txt_records("x.example") == ["v=spf1 include:a.example include:b.example include:c.example -all"]


# Issue #36: SIDN (.nl) answers with indented blocks under a bare header, so a
# successful lookup used to return an empty registrar and no name servers.
SIDN_ANSWER = """Domain name: theyosh.nl
Status:      active

Registrar:
   Quickhost B.V.
   Friesestraatweg 213 D
   9743AD Groningen
   Netherlands

Abuse Contact:
   abuse@exsilia.net

DNSSEC:      yes

Domain nameservers:
   ns2.exsilia.net
   ns1.exsilia.net

Creation Date: 2006-07-01

Updated Date: 2026-01-02

Record maintained by: SIDN BV
"""


def test_whois_parses_indented_blocks_from_sidn():
    parsed = whois_lookup._parse_whois(SIDN_ANSWER)
    assert parsed["registrar"] == "Quickhost B.V."
    assert parsed["abuse_email"] == "abuse@exsilia.net"
    assert parsed["name_servers"] == ["ns2.exsilia.net", "ns1.exsilia.net"]
    assert parsed["creation_date"] == "2006-07-01"
    assert parsed["status"] == ["active"]


def test_whois_header_without_value_does_not_claim_the_field():
    # "Registrar:" alone must not win over the real name on the next line.
    assert whois_lookup._parse_whois("Registrar:\n   Real Name B.V.\n")["registrar"] == "Real Name B.V."


def test_whois_still_parses_flat_key_value_answers():
    flat = (
        "   Domain Name: EXAMPLE.COM\n"
        "   Registrar: MarkMonitor Inc.\n"
        "   Registry Expiry Date: 2026-08-13T04:00:00Z\n"
        "   Name Server: A.IANA-SERVERS.NET\n"
        "   Name Server: B.IANA-SERVERS.NET\n"
    )
    parsed = whois_lookup._parse_whois(flat)
    assert parsed["registrar"] == "MarkMonitor Inc."
    assert parsed["expiry_date"] == "2026-08-13T04:00:00Z"
    assert parsed["name_servers"] == ["A.IANA-SERVERS.NET", "B.IANA-SERVERS.NET"]


@contextlib.contextmanager
def _whois_settings(**values):
    """Settings is a frozen dataclass, so override fields the hard way."""
    from app.core.config import settings
    previous = {key: getattr(settings, key) for key in values}
    for key, value in values.items():
        object.__setattr__(settings, key, value)
    try:
        yield
    finally:
        for key, value in previous.items():
            object.__setattr__(settings, key, value)


def test_whois_timeout_comes_from_settings(monkeypatch):
    seen = {}

    class _Sock:
        def __enter__(self): return self
        def __exit__(self, *a): return False
        def sendall(self, _data): pass
        def recv(self, _n): return b""

    def _fake_connect(address, timeout):
        seen["timeout"] = timeout
        return _Sock()

    monkeypatch.setattr(whois_lookup, "resolve_public_addresses", lambda host: ["203.0.113.5"])
    monkeypatch.setattr(whois_lookup.socket, "create_connection", _fake_connect)
    with _whois_settings(whois_timeout_seconds=45):
        whois_lookup._raw_whois("example.com", "whois.example")
    assert 44.0 <= seen["timeout"] <= 45.0


def test_whois_reuses_a_cached_answer(monkeypatch):
    calls = []

    def _fake_raw(domain, server, timeout=None):
        calls.append(domain)
        return "Domain name: cached.nl\nRegistrar:\n   Example B.V.\n"

    monkeypatch.setattr(whois_lookup, "_raw_whois", _fake_raw)
    with _whois_settings(whois_cache_minutes=60):
        whois_lookup.clear_whois_cache()
        first = whois_lookup.whois_lookup("cached.nl")
        second = whois_lookup.whois_lookup("cached.nl")
        whois_lookup.clear_whois_cache()
    assert calls == ["cached.nl"]
    assert first == second and second["registrar"] == "Example B.V."


def test_whois_failures_are_not_cached(monkeypatch):
    attempts = []

    def _flaky(domain, server, timeout=None):
        attempts.append(domain)
        if len(attempts) == 1:
            raise socket.timeout("timed out")
        return "Domain name: flaky.nl\n"

    monkeypatch.setattr(whois_lookup, "_raw_whois", _flaky)
    with _whois_settings(whois_cache_minutes=60):
        whois_lookup.clear_whois_cache()
        failed = whois_lookup.whois_lookup("flaky.nl")
        recovered = whois_lookup.whois_lookup("flaky.nl")
        whois_lookup.clear_whois_cache()
    assert "error" in failed
    assert recovered["domain_name"] == "flaky.nl"


def test_whois_cache_can_be_disabled(monkeypatch):
    calls = []

    def _fake_raw(domain, server, timeout=None):
        calls.append(domain)
        return "Domain name: nocache.nl\n"

    monkeypatch.setattr(whois_lookup, "_raw_whois", _fake_raw)
    with _whois_settings(whois_cache_minutes=0):
        whois_lookup.clear_whois_cache()
        whois_lookup.whois_lookup("nocache.nl")
        whois_lookup.whois_lookup("nocache.nl")
    assert calls == ["nocache.nl", "nocache.nl"]


def test_whois_rate_limit_reply_is_an_error_not_an_empty_record(monkeypatch):
    # SIDN answers "Error: ratelimit exceeded" on port 43 with no status code,
    # which used to parse to nothing and be shown as a successful lookup.
    monkeypatch.setattr(whois_lookup, "_raw_whois",
                        lambda domain, server, timeout=None: "Error: ratelimit exceeded\r\n")
    with _whois_settings(whois_cache_minutes=60):
        whois_lookup.clear_whois_cache()
        result = whois_lookup.whois_lookup("theyosh.nl")
    assert result["error"] == "WHOIS query failed: ratelimit exceeded"


def test_whois_rate_limit_reply_is_not_cached(monkeypatch):
    replies = ["Error: ratelimit exceeded\r\n", "Domain name: theyosh.nl\r\nRegistrar:\r\n   Quickhost B.V.\r\n"]
    monkeypatch.setattr(whois_lookup, "_raw_whois",
                        lambda domain, server, timeout=None: replies.pop(0))
    with _whois_settings(whois_cache_minutes=60):
        whois_lookup.clear_whois_cache()
        first = whois_lookup.whois_lookup("theyosh.nl")
        second = whois_lookup.whois_lookup("theyosh.nl")
        whois_lookup.clear_whois_cache()
    assert "error" in first
    assert second["registrar"] == "Quickhost B.V."


def test_whois_does_not_mistake_record_text_for_a_failure(monkeypatch):
    # "access denied" deep inside a registrar's terms must not fail the lookup.
    record = (
        "Domain Name: EXAMPLE.COM\r\n"
        "Registrar: MarkMonitor Inc.\r\n"
        "Name Server: A.IANA-SERVERS.NET\r\n"
        ">>> Last update: 2026-01-01 <<<\r\n"
        "Terms of use: access denied to automated bulk queries.\r\n"
    )
    monkeypatch.setattr(whois_lookup, "_raw_whois", lambda domain, server, timeout=None: record)
    with _whois_settings(whois_cache_minutes=0):
        result = whois_lookup.whois_lookup("example.com")
    assert "error" not in result and result["registrar"] == "MarkMonitor Inc."


def _fake_dual_stack(mapping):
    """getaddrinfo stub returning (family, address) pairs in the given order."""
    def fake(host, *args, **kwargs):
        if host not in mapping:
            raise socket.gaierror("not found")
        return [(family, socket.SOCK_STREAM, 6, "", (addr, 0) if family == socket.AF_INET else (addr, 0, 0, 0))
                for family, addr in mapping[host]]
    return fake


def test_resolve_public_addresses_prefers_the_system_order():
    pairs = [(socket.AF_INET6, "2a00:d78:0:b001:94:198:154:138"), (socket.AF_INET, "94.198.154.138")]
    with mock.patch("socket.getaddrinfo", _fake_dual_stack({"whois.sidn.nl": pairs})):
        assert network_safety.resolve_public_addresses("whois.sidn.nl") == [
            "2a00:d78:0:b001:94:198:154:138", "94.198.154.138"]


def test_resolve_public_addresses_keeps_one_address_per_family():
    pairs = [(socket.AF_INET, "93.184.216.34"), (socket.AF_INET, "93.184.216.35"),
             (socket.AF_INET6, "2606:2800:220:1:248:1893:25c8:1946")]
    with mock.patch("socket.getaddrinfo", _fake_dual_stack({"many.test": pairs})):
        assert network_safety.resolve_public_addresses("many.test") == [
            "93.184.216.34", "2606:2800:220:1:248:1893:25c8:1946"]


def test_resolve_public_addresses_rejects_a_private_ipv6_answer():
    pairs = [(socket.AF_INET, "93.184.216.34"), (socket.AF_INET6, "fd00::1")]
    with mock.patch("socket.getaddrinfo", _fake_dual_stack({"mixed.test": pairs})):
        with pytest.raises(network_safety.UnsafeDestinationError):
            network_safety.resolve_public_addresses("mixed.test")


def test_whois_falls_back_to_the_other_family_when_one_is_blocked(monkeypatch):
    """Issue #36: SIDN blocks some IPv4 clients but answers them over IPv6."""
    tried = []

    def _connect(address_port, timeout):
        tried.append(address_port[0])
        if ":" not in address_port[0]:          # the blocked IPv4 address
            raise socket.timeout("timed out")
        sock = mock.MagicMock()
        sock.__enter__.return_value = sock
        sock.recv.side_effect = [b"Domain name: theyosh.nl\r\n", b""]
        return sock

    monkeypatch.setattr(whois_lookup, "resolve_public_addresses",
                        lambda server: ["94.198.154.138", "2a00:d78:0:b001:94:198:154:138"])
    monkeypatch.setattr(whois_lookup.socket, "create_connection", _connect)
    raw = whois_lookup._raw_whois("theyosh.nl", "whois.sidn.nl", timeout=20.0)
    assert tried == ["94.198.154.138", "2a00:d78:0:b001:94:198:154:138"]
    assert "theyosh.nl" in raw


def test_whois_reports_the_failure_when_every_family_is_blocked(monkeypatch):
    def _connect(address_port, timeout):
        raise socket.timeout("timed out")

    monkeypatch.setattr(whois_lookup, "resolve_public_addresses",
                        lambda server: ["94.198.154.138", "2a00:d78::1"])
    monkeypatch.setattr(whois_lookup.socket, "create_connection", _connect)
    with _whois_settings(whois_cache_minutes=0):
        result = whois_lookup.whois_lookup("theyosh.nl")
    assert result["error"] == "WHOIS query failed: timed out."


def test_whois_splits_its_timeout_when_a_family_hangs(monkeypatch):
    """A blocked family must not consume the budget the next one needs."""
    clock = [0.0]
    timeouts = []
    monkeypatch.setattr(whois_lookup.time, "monotonic", lambda: clock[0])

    def _connect(address_port, timeout):
        timeouts.append(timeout)
        clock[0] += timeout          # this address hangs for its whole share
        raise socket.timeout("timed out")

    monkeypatch.setattr(whois_lookup, "resolve_public_addresses",
                        lambda server: ["94.198.154.138", "2a00:d78::1"])
    monkeypatch.setattr(whois_lookup.socket, "create_connection", _connect)
    with pytest.raises(socket.timeout):
        whois_lookup._raw_whois("theyosh.nl", "whois.sidn.nl", timeout=30.0)
    assert timeouts == [15.0, 15.0]
    assert sum(timeouts) == 30.0     # the whole lookup still fits the budget


def test_whois_gives_the_leftover_budget_to_the_next_family(monkeypatch):
    """No IPv6 route fails at once; IPv4 should then get nearly the whole budget."""
    timeouts = []

    def _connect(address_port, timeout):
        timeouts.append(timeout)
        raise OSError(101, "Network unreachable")

    monkeypatch.setattr(whois_lookup, "resolve_public_addresses",
                        lambda server: ["2a00:d78::1", "94.198.154.138"])
    monkeypatch.setattr(whois_lookup.socket, "create_connection", _connect)
    with pytest.raises(OSError):
        whois_lookup._raw_whois("theyosh.nl", "whois.sidn.nl", timeout=30.0)
    assert 14.0 <= timeouts[0] <= 15.0      # half the budget offered
    assert timeouts[1] >= 29.0              # the instant failure handed its share over


def test_whois_serves_the_last_good_answer_when_the_registry_refuses(monkeypatch):
    """SIDN refuses a second query soon after the first; a monitored asset
    should keep its last good record instead of flipping to an error."""
    replies = ["Domain name: theyosh.nl\r\nRegistrar:\r\n   Quickhost B.V.\r\n",
               "Error: ratelimit exceeded\r\n"]
    monkeypatch.setattr(whois_lookup, "_raw_whois",
                        lambda domain, server, timeout=None: replies.pop(0))
    clock = [0.0]
    monkeypatch.setattr(whois_lookup.time, "monotonic", lambda: clock[0])

    with _whois_settings(whois_cache_minutes=60):
        whois_lookup.clear_whois_cache()
        fresh = whois_lookup.whois_lookup("theyosh.nl")
        clock[0] += 90 * 60                      # past the cache window
        refused = whois_lookup.whois_lookup("theyosh.nl")
        whois_lookup.clear_whois_cache()

    assert "stale" not in fresh and fresh["registrar"] == "Quickhost B.V."
    assert refused["registrar"] == "Quickhost B.V."
    assert refused["stale"] is True
    assert refused["stale_age_minutes"] == 90
    assert refused["stale_reason"] == "WHOIS query failed: ratelimit exceeded"


def test_whois_stale_answer_eventually_expires(monkeypatch):
    monkeypatch.setattr(whois_lookup, "_raw_whois",
                        lambda domain, server, timeout=None: "Error: ratelimit exceeded\r\n")
    clock = [0.0]
    monkeypatch.setattr(whois_lookup.time, "monotonic", lambda: clock[0])

    with _whois_settings(whois_cache_minutes=60):
        whois_lookup.clear_whois_cache()
        whois_lookup._cache_put("theyosh.nl", {"domain": "theyosh.nl", "registrar": "Quickhost B.V.", "raw": "x"})
        clock[0] += 5 * 60 * 60                  # past 4x the cache window
        result = whois_lookup.whois_lookup("theyosh.nl")
        whois_lookup.clear_whois_cache()

    assert result == {"error": "WHOIS query failed: ratelimit exceeded"}


def test_whois_does_not_serve_stale_after_a_safety_refusal(monkeypatch):
    def _unsafe(domain, server, timeout=None):
        raise whois_lookup.UnsafeDestinationError("Private, loopback, link-local, reserved, or mixed DNS destinations are not allowed.")

    monkeypatch.setattr(whois_lookup, "_raw_whois", _unsafe)
    clock = [0.0]
    monkeypatch.setattr(whois_lookup.time, "monotonic", lambda: clock[0])
    with _whois_settings(whois_cache_minutes=60):
        whois_lookup.clear_whois_cache()
        whois_lookup._cache_put("theyosh.nl", {"domain": "theyosh.nl", "registrar": "Quickhost B.V.", "raw": "x"})
        clock[0] += 90 * 60              # past the fresh window, inside the stale one
        result = whois_lookup.whois_lookup("theyosh.nl")
        whois_lookup.clear_whois_cache()
    assert "error" in result and "stale" not in result


def test_whois_serves_stale_when_the_server_is_unreachable(monkeypatch):
    calls = []

    def _flaky(domain, server, timeout=None):
        calls.append(domain)
        if len(calls) == 1:
            return "Domain name: theyosh.nl\r\nRegistrar:\r\n   Quickhost B.V.\r\n"
        raise socket.timeout("timed out")

    monkeypatch.setattr(whois_lookup, "_raw_whois", _flaky)
    clock = [0.0]
    monkeypatch.setattr(whois_lookup.time, "monotonic", lambda: clock[0])
    with _whois_settings(whois_cache_minutes=60):
        whois_lookup.clear_whois_cache()
        whois_lookup.whois_lookup("theyosh.nl")
        clock[0] += 2 * 60 * 60
        result = whois_lookup.whois_lookup("theyosh.nl")
        whois_lookup.clear_whois_cache()
    assert result["registrar"] == "Quickhost B.V." and result["stale"] is True


# Issue #36: .it writes bare headings with no colon and indents the block's
# fields under them, at varying widths.
IT_ANSWER = """*********************************************************************
* Please note that the following result could be a subgroup of      *
*********************************************************************

Domain:             google.it
Status:             ok
Signed:             no
Created:            1999-12-10 00:00:00
Last Update:        2026-06-09 23:13:34
Expire Date:        2027-04-21

Registrant
  Organization:     Google Ireland Holdings Unlimited Company
  Address:          70 Sir John Rogerson's Quay
                    Dublin
                    IE
  Created:          2018-03-02 19:04:02

Admin Contact
  Name:             Jared Oberhaus
  Organization:     Google LLC
  Created:          2026-06-09 19:22:56

Registrar
  Organization:     MarkMonitor International Limited
  Name:             MARKMONITOR-REG
  Web:              https://www.markmonitor.com/
  DNSSEC:           no

Nameservers
  ns1.google.com
  ns2.google.com
"""


def test_whois_parses_bare_headings_and_short_field_names():
    parsed = whois_lookup._parse_whois(IT_ANSWER)
    assert parsed["domain_name"] == "google.it"
    assert parsed["registrar"] == "MarkMonitor International Limited"
    assert parsed["registrar_url"] == "https://www.markmonitor.com/"
    assert parsed["registrant_org"] == "Google Ireland Holdings Unlimited Company"
    assert parsed["expiry_date"] == "2027-04-21"
    assert parsed["updated_date"] == "2026-06-09 23:13:34"
    assert parsed["name_servers"] == ["ns1.google.com", "ns2.google.com"]


def test_whois_ignores_dates_belonging_to_a_contact_block():
    """"Created" under "Admin Contact" is that contact's, not the domain's."""
    parsed = whois_lookup._parse_whois(IT_ANSWER)
    assert parsed["creation_date"] == "1999-12-10 00:00:00"


def test_whois_does_not_take_a_contact_organisation_as_the_registrar():
    # "Admin Contact" has Organization: Google LLC, which must not win.
    assert whois_lookup._parse_whois(IT_ANSWER)["registrar"] == "MarkMonitor International Limited"


def test_whois_takes_dnssec_from_the_domain_not_the_registrar():
    # The registrar block also carries "DNSSEC: no"; the domain's own flag is
    # the top-level "Signed".
    assert whois_lookup._parse_whois(IT_ANSWER)["dnssec"] == "no"
    signed_yes = IT_ANSWER.replace("Signed:             no", "Signed:             yes")
    assert whois_lookup._parse_whois(signed_yes)["dnssec"] == "yes"


def test_whois_reports_a_registry_error_it_has_no_marker_for(monkeypatch):
    """A subdomain cannot be looked up; SIDN says so in words the marker list
    does not name, and it used to come back as an empty successful record."""
    monkeypatch.setattr(
        whois_lookup, "_raw_whois",
        lambda domain, server, timeout=None: "Error: subdomains such as mail1.theyosh.nl are not supported\r\n")
    with _whois_settings(whois_cache_minutes=0):
        result = whois_lookup.whois_lookup("mail1.theyosh.nl")
    assert result == {"error": "WHOIS query failed: subdomains such as mail1.theyosh.nl are not supported"}


def test_whois_error_prefix_does_not_fire_inside_a_real_record(monkeypatch):
    record = ("Domain Name: EXAMPLE.COM\r\n"
              "Registrar: MarkMonitor Inc.\r\n"
              "Error: this line is part of a record that parsed fine\r\n")
    monkeypatch.setattr(whois_lookup, "_raw_whois", lambda domain, server, timeout=None: record)
    with _whois_settings(whois_cache_minutes=0):
        result = whois_lookup.whois_lookup("example.com")
    assert "error" not in result and result["registrar"] == "MarkMonitor Inc."


# Issue #39: a registry can only answer for the name someone registered.

@pytest.mark.parametrize("host,expected", [
    ("mail1.theyosh.nl", "theyosh.nl"),
    ("theyosh.nl", "theyosh.nl"),
    ("a.b.example.co.uk", "example.co.uk"),          # last two labels would give co.uk
    ("smtp.mail.example.com.au", "example.com.au"),
    ("EXAMPLE.COM", "example.com"),
])
def test_registrable_domain(host, expected):
    assert whois_lookup._registrable_domain(host.lower()) == expected


@pytest.mark.parametrize("host", ["8.8.8.8", "2001:4860:4860::8888", "localhost", "nl", "co.uk"])
def test_registrable_domain_is_none_without_one(host):
    # Left alone, so an IP still reaches its RIR through IANA's referral.
    assert whois_lookup._registrable_domain(host) is None


def test_whois_looks_up_the_domain_a_host_belongs_to(monkeypatch):
    asked = []

    def _fake(domain, server, timeout=None):
        asked.append((domain, server))
        return "Domain name: theyosh.nl\r\nRegistrar:\r\n   Quickhost B.V.\r\n"

    monkeypatch.setattr(whois_lookup, "_raw_whois", _fake)
    with _whois_settings(whois_cache_minutes=0):
        result = whois_lookup.whois_lookup("mail1.theyosh.nl")
    assert asked == [("theyosh.nl", "whois.sidn.nl")]
    assert result["domain"] == "theyosh.nl"
    assert result["requested_host"] == "mail1.theyosh.nl"
    assert result["registrar"] == "Quickhost B.V."


def test_whois_does_not_note_a_host_when_it_is_the_domain(monkeypatch):
    monkeypatch.setattr(whois_lookup, "_raw_whois",
                        lambda domain, server, timeout=None: "Domain name: theyosh.nl\r\n")
    with _whois_settings(whois_cache_minutes=0):
        result = whois_lookup.whois_lookup("theyosh.nl")
    assert "requested_host" not in result


def test_whois_hosts_in_one_domain_share_a_single_query(monkeypatch):
    """Registries rate limit per client, so three mail servers in one domain
    must not cost three queries."""
    asked = []

    def _fake(domain, server, timeout=None):
        asked.append(domain)
        return "Domain name: theyosh.nl\r\nRegistrar:\r\n   Quickhost B.V.\r\n"

    monkeypatch.setattr(whois_lookup, "_raw_whois", _fake)
    with _whois_settings(whois_cache_minutes=60):
        whois_lookup.clear_whois_cache()
        hosts = [whois_lookup.whois_lookup(f"mail{n}.theyosh.nl") for n in (1, 2, 3)]
        whois_lookup.clear_whois_cache()
    assert asked == ["theyosh.nl"]
    assert [h["requested_host"] for h in hosts] == ["mail1.theyosh.nl", "mail2.theyosh.nl", "mail3.theyosh.nl"]
    assert all(h["registrar"] == "Quickhost B.V." for h in hosts)


def test_whois_still_queries_an_ip_address_unchanged(monkeypatch):
    asked = []
    monkeypatch.setattr(whois_lookup, "_raw_whois",
                        lambda domain, server, timeout=None: asked.append(domain) or "NetName: LVLT-GOGL-8-8-8\r\n")
    with _whois_settings(whois_cache_minutes=0):
        result = whois_lookup.whois_lookup("8.8.8.8")
    assert asked == ["8.8.8.8"] and result["domain"] == "8.8.8.8"


@pytest.mark.parametrize("host,expected", [
    # The list's private section marks where a service lets people put a site.
    # That is the right boundary for cookies, not for WHOIS: .io knows
    # github.io because someone registered it, and knows nothing of foo.github.io.
    ("foo.github.io", "github.io"),
    ("site.pages.dev", "pages.dev"),
    ("blog.example.s3.amazonaws.com", "amazonaws.com"),
])
def test_registrable_domain_uses_the_icann_boundary(host, expected):
    assert whois_lookup._registrable_domain(host) == expected


# Issue #40: RFC 7489 6.6.3 - a host with no DMARC record of its own is
# covered by the organisational domain's, and `sp` is what governs it.

def test_dmarc_inherits_the_organisational_domain_policy():
    from app.services import email_security
    records = {"_dmarc.example.com": ["v=DMARC1; p=quarantine; sp=reject; rua=mailto:d@example.com"]}
    with mock.patch.object(email_security, "_dns_txt_records", _txt(records)):
        dmarc = email_security._check_dmarc("mail1.example.com")
    assert dmarc["found"] is True
    assert dmarc["policy"] == "reject"          # sp, not p
    assert dmarc["inherited_from"] == "example.com"
    assert any("covered by example.com" in w for w in dmarc["warnings"])


def test_dmarc_inherited_falls_back_to_p_when_there_is_no_sp():
    from app.services import email_security
    records = {"_dmarc.example.com": ["v=DMARC1; p=reject; rua=mailto:d@example.com"]}
    with mock.patch.object(email_security, "_dns_txt_records", _txt(records)):
        dmarc = email_security._check_dmarc("mail1.example.com")
    assert dmarc["policy"] == "reject" and dmarc["inherited_from"] == "example.com"


def test_dmarc_prefers_the_hosts_own_record_over_the_parent():
    from app.services import email_security
    records = {
        "_dmarc.mail1.example.com": ["v=DMARC1; p=none"],
        "_dmarc.example.com": ["v=DMARC1; p=reject; sp=reject"],
    }
    with mock.patch.object(email_security, "_dns_txt_records", _txt(records)):
        dmarc = email_security._check_dmarc("mail1.example.com")
    assert dmarc["policy"] == "none" and dmarc["inherited_from"] is None


def test_dmarc_on_the_organisational_domain_is_not_marked_inherited():
    from app.services import email_security
    records = {"_dmarc.example.com": ["v=DMARC1; p=reject; sp=reject"]}
    with mock.patch.object(email_security, "_dns_txt_records", _txt(records)):
        dmarc = email_security._check_dmarc("example.com")
    assert dmarc["policy"] == "reject" and dmarc["inherited_from"] is None


def test_dmarc_missing_everywhere_is_still_not_found():
    from app.services import email_security
    with mock.patch.object(email_security, "_dns_txt_records", _txt({})):
        assert email_security._check_dmarc("mail1.example.com")["found"] is False


def test_spf_is_not_reduced_to_the_parent_domain():
    """A sending host publishes its own SPF; the parent's is a different
    policy and reporting it would be wrong (issue #40)."""
    from app.services import email_security
    records = {
        "mail1.example.com": ["v=spf1 a ~all"],
        "example.com": ["v=spf1 mx ~all"],
    }
    with mock.patch.object(email_security, "_dns_txt_records", _txt(records)):
        spf = email_security._check_spf("mail1.example.com")
    assert spf["record"] == "v=spf1 a ~all"


def test_spf_on_a_host_without_one_does_not_borrow_the_parents():
    from app.services import email_security
    records = {"example.com": ["v=spf1 mx -all"]}
    with mock.patch.object(email_security, "_dns_txt_records", _txt(records)):
        spf = email_security._check_spf("mail1.example.com")
    assert spf["found"] is False


# --- email security: DKIM -----------------------------------------------------------
# Issue #40 asked for all three checks to be reduced to the parent domain. SPF
# must not be (the two tests above pin that), DMARC inherits by RFC, and DKIM
# is the third case: nothing is inherited, but the key is published under the
# domain a message is signed as, which is usually not the sending host.

def _no_cname(name):
    return None


def _cname(mapping):
    return lambda name: mapping.get(name)


def test_dkim_key_found_under_the_organisational_domain_is_labelled():
    from app.services import email_security
    records = {"mail._domainkey.example.com": ["v=DKIM1; t=s; p=AAAA"]}
    with mock.patch.object(email_security, "_dns_txt_records", _txt(records)), \
         mock.patch.object(email_security, "_dns_cname_record", _no_cname):
        dkim = email_security._check_dkim("mail1.example.com")
    assert dkim["found"] is True
    assert dkim["inherited_from"] == "example.com"
    assert dkim["domains_searched"] == ["mail1.example.com", "example.com"]
    assert [s["selector"] for s in dkim["selectors_found"]] == ["mail"]
    assert dkim["selectors_found"][0]["found_at"] == "example.com"
    assert any("Found under example.com" in w for w in dkim["warnings"])


def test_dkim_under_the_host_itself_wins_and_the_parent_is_not_consulted():
    from app.services import email_security
    records = {
        "default._domainkey.mail1.example.com": ["v=DKIM1; p=HOSTKEY"],
        "default._domainkey.example.com": ["v=DKIM1; p=PARENTKEY"],
    }
    with mock.patch.object(email_security, "_dns_txt_records", _txt(records)), \
         mock.patch.object(email_security, "_dns_cname_record", _no_cname):
        dkim = email_security._check_dkim("mail1.example.com")
    assert dkim["selectors_found"][0]["record"] == "v=DKIM1; p=HOSTKEY"
    assert dkim["selectors_found"][0]["found_at"] == "mail1.example.com"
    assert dkim["inherited_from"] is None
    assert dkim["domains_searched"] == ["mail1.example.com"]
    assert dkim["warnings"] == []


def test_dkim_on_the_organisational_domain_is_not_marked_inherited():
    from app.services import email_security
    records = {"mail._domainkey.example.com": ["v=DKIM1; p=AAAA"]}
    with mock.patch.object(email_security, "_dns_txt_records", _txt(records)), \
         mock.patch.object(email_security, "_dns_cname_record", _no_cname):
        dkim = email_security._check_dkim("example.com")
    assert dkim["found"] is True and dkim["inherited_from"] is None
    assert dkim["domains_searched"] == ["example.com"]


def test_dkim_missing_everywhere_names_both_domains_it_looked_at():
    from app.services import email_security
    with mock.patch.object(email_security, "_dns_txt_records", _txt({})), \
         mock.patch.object(email_security, "_dns_cname_record", _no_cname):
        dkim = email_security._check_dkim("mail1.example.com")
    assert dkim["found"] is False
    assert dkim["domains_searched"] == ["mail1.example.com", "example.com"]
    assert "mail1.example.com or example.com" in dkim["details"]


def test_dkim_selector_delegated_by_cname_counts_as_published():
    """Providers commonly delegate a selector with a CNAME rather than a TXT."""
    from app.services import email_security
    cnames = {"selector1._domainkey.example.com": "selector1-example-com._domainkey.provider.example."}
    with mock.patch.object(email_security, "_dns_txt_records", _txt({})), \
         mock.patch.object(email_security, "_dns_cname_record", _cname(cnames)):
        dkim = email_security._check_dkim("example.com")
    assert dkim["found"] is True
    assert dkim["selectors_found"][0]["cname"].startswith("selector1-example-com")
    assert dkim["selectors_found"][0]["record"] is None


def test_dkim_is_not_searched_above_a_bare_public_suffix():
    """registrable_domain returns None for a name that is not under a
    registration, so there is nothing to fall back to."""
    from app.services import email_security
    with mock.patch.object(email_security, "_dns_txt_records", _txt({})), \
         mock.patch.object(email_security, "_dns_cname_record", _no_cname):
        dkim = email_security._check_dkim("localhost")
    assert dkim["domains_searched"] == ["localhost"]


def test_a_key_at_the_organisational_domain_counts_toward_the_grade():
    """The reporter's own shape in issue #40: a host with its own SPF, an
    inherited DMARC policy and the domain's DKIM key grades A, not B."""
    from app.services import email_security
    records = {
        "mail1.example.com": ["v=spf1 a ~all"],
        "_dmarc.example.com": ["v=DMARC1; p=reject; sp=reject; rua=mailto:d@example.com"],
        "mail._domainkey.example.com": ["v=DKIM1; t=s; p=AAAA"],
    }
    with mock.patch.object(email_security, "_dns_txt_records", _txt(records)), \
         mock.patch.object(email_security, "_dns_cname_record", _no_cname):
        result = email_security.check_email_security("mail1.example.com")
    assert result["grade"] == "A"
    assert result["spf"]["record"] == "v=spf1 a ~all"
    assert result["dmarc"]["inherited_from"] == "example.com"
    assert result["dkim"]["inherited_from"] == "example.com"


# --- SSL: the TLS version, not only the certificate ---------------------------------
# create_default_context refuses TLS 1.0 and 1.1, so a server stuck on one used
# to come back as "SSL error: [SSL: TLSV1_ALERT_PROTOCOL_VERSION]" with no
# verdict. It is now negotiated on a second attempt and reported as a finding.

def test_an_obsolete_tls_version_is_reported_as_a_finding():
    warnings = ssl_checker._tls_warnings(("ECDHE-RSA-AES256-SHA", "TLSv1.0", 256), None)
    assert len(warnings) == 1
    assert "Negotiated TLSv1.0" in warnings[0] and "RFC 8996" in warnings[0]


def test_current_tls_produces_no_findings():
    assert ssl_checker._tls_warnings(("TLS_AES_256_GCM_SHA384", "TLSv1.3", 256), None) == []
    assert ssl_checker._tls_warnings(("ECDHE-RSA-AES128-GCM-SHA256", "TLSv1.2", 128), None) == []


def test_a_short_key_is_reported_even_on_a_current_version():
    warnings = ssl_checker._tls_warnings(("DES-CBC3-SHA", "TLSv1.2", 112), None)
    assert warnings == ["DES-CBC3-SHA gives only 112-bit encryption."]


def test_a_relaxed_retry_on_a_current_version_says_what_was_refused():
    error = ssl.SSLError(1, "[SSL: SSLV3_ALERT_HANDSHAKE_FAILURE] sslv3 alert handshake failure")
    error.reason = "SSLV3_ALERT_HANDSHAKE_FAILURE"
    warnings = ssl_checker._tls_warnings(("ECDHE-RSA-AES256-SHA", "TLSv1.2", 256), error)
    assert len(warnings) == 1
    assert "current TLS defaults" in warnings[0]
    assert "SSLV3_ALERT_HANDSHAKE_FAILURE" in warnings[0]


def test_a_certificate_error_is_not_retried_with_relaxed_settings():
    """A bad chain is a real answer. Retrying it at a lower security level
    would turn a failure into a pass."""
    calls = []

    def handshake(ip, port, hostname, context):
        calls.append(context)
        raise ssl.SSLCertVerificationError("certificate has expired")

    with mock.patch.object(ssl_checker, "_handshake", handshake):
        with pytest.raises(ssl.SSLCertVerificationError):
            ssl_checker._connect("192.0.2.1", 443, "host.example")
    assert len(calls) == 1


def test_a_version_error_gets_exactly_one_relaxed_retry():
    attempts = []

    def handshake(ip, port, hostname, context):
        attempts.append(context.minimum_version)
        if len(attempts) == 1:
            raise ssl.SSLError(1, "unsupported protocol")
        return {"notBefore": "Jan 1 00:00:00 2026 GMT"}, ("ECDHE-RSA-AES256-SHA", "TLSv1.0", 256)

    with mock.patch.object(ssl_checker, "_handshake", handshake):
        cert, cipher, strict_error = ssl_checker._connect("192.0.2.1", 443, "host.example")
    assert len(attempts) == 2
    assert attempts[0] == ssl.TLSVersion.TLSv1_2          # as a mail client would
    assert attempts[1] == ssl.TLSVersion.MINIMUM_SUPPORTED  # only to diagnose
    assert cipher[1] == "TLSv1.0" and strict_error is not None


def test_a_passing_server_is_only_connected_to_once():
    attempts = []

    def handshake(ip, port, hostname, context):
        attempts.append(context)
        return {"notBefore": "Jan 1 00:00:00 2026 GMT"}, ("TLS_AES_256_GCM_SHA384", "TLSv1.3", 256)

    with mock.patch.object(ssl_checker, "_handshake", handshake):
        _, cipher, strict_error = ssl_checker._connect("192.0.2.1", 443, "host.example")
    assert len(attempts) == 1 and strict_error is None and cipher[1] == "TLSv1.3"


# --- log safety ---------------------------------------------------------------------

def test_a_hostname_cannot_forge_a_log_line():
    from app.core.logging_safety import for_log
    forged = "ok.example\r\n2026-01-01 00:00:00 WARNING Nothing to see here"
    assert "\n" not in for_log(forged) and "\r" not in for_log(forged)
    assert for_log(forged).startswith("ok.example\\r\\n")


def test_a_long_value_is_truncated_for_the_log():
    from app.core.logging_safety import for_log
    assert for_log("a" * 500).endswith("...")
    assert len(for_log("a" * 500)) == 203


def test_an_unexpected_check_failure_does_not_send_its_text_to_the_browser():
    """The traceback belongs in the log. An exception's text carries file
    paths and internals that a check result should not."""
    from app.services import check_runner

    def boom(hostname):
        raise RuntimeError("/app/secret/path.py line 7: connection string pg://u:p@db")

    with mock.patch("app.services.dnsbl.check_dnsbl_providers", boom):
        results = check_runner.run_enabled_checks("host.example", {"check_blacklist": True})
    assert "secret" not in results["blacklist"]["error"]
    assert results["blacklist"]["error"] == "The blacklist check failed (RuntimeError). See the backend log."


# --- what a failure is allowed to say -----------------------------------------------
# A check result can be forwarded to a list operator or pasted into a ticket, so
# no exception's own text goes into one. describe() picks from fixed phrases.

def test_a_failure_is_described_without_quoting_the_exception():
    from app.core.failures import describe
    leak = RuntimeError("/app/app/core/config.py line 7: postgres://user:pw@db/app")
    described = describe(leak)
    assert described == "the request failed"
    for fragment in ("/app/", "postgres://", "user:pw", "config.py"):
        assert fragment not in described


@pytest.mark.parametrize("exc, expected", [
    (socket.timeout(), "timed out"),
    (TimeoutError(), "timed out"),
    (ConnectionRefusedError(), "the connection was refused"),
    (ConnectionResetError(), "the connection was reset"),
    (socket.gaierror(-2, "Name or service not known"), "the name could not be resolved"),
])
def test_ordinary_network_failures_are_named_plainly(exc, expected):
    from app.core.failures import describe
    assert describe(exc) == expected


def test_an_ssl_reason_is_translated_not_echoed():
    from app.core.failures import describe
    exc = ssl.SSLError(1, "[SSL: TLSV1_ALERT_PROTOCOL_VERSION] tlsv1 alert (_ssl.c:1082)")
    exc.reason = "TLSV1_ALERT_PROTOCOL_VERSION"
    assert describe(exc) == "the server refused every TLS version offered"
    assert "_ssl.c" not in describe(exc)


def test_an_unknown_ssl_reason_still_says_nothing_specific():
    from app.core.failures import describe
    exc = ssl.SSLError(1, "[SSL: SOMETHING_NEW] detail (_ssl.c:99)")
    exc.reason = "SOMETHING_NEW"
    assert describe(exc) == "the TLS handshake failed"


def test_an_smtp_reply_is_named_without_repeating_the_servers_words():
    import smtplib
    from app.core.failures import describe_smtp
    exc = smtplib.SMTPAuthenticationError(535, b"5.7.8 Username and Password not accepted")
    described = describe_smtp(exc)
    assert described == "the mail server rejected the username or password"
    # Neither the server's text nor its code: the code is compared, not echoed.
    assert "Password" not in described and "535" not in described


def test_an_unlisted_smtp_reply_falls_back_to_the_class_of_the_reply():
    import smtplib
    from app.core.failures import describe_smtp
    transient = smtplib.SMTPResponseException(451, b"4.3.0 try again later")
    permanent = smtplib.SMTPResponseException(571, b"5.7.1 blocked")
    assert "worth retrying" in describe_smtp(transient)
    assert describe_smtp(permanent) == "the mail server rejected it outright"


def test_a_subnet_with_a_bad_mask_does_not_echo_the_input_back():
    from app.services import subnet_check
    result = subnet_check.check_subnet("203.0.113.0/99")
    assert "99" not in result["error"]
    assert result["error"].startswith("Not a valid IPv4 CIDR range")


@pytest.mark.parametrize("code, expected", [
    (10, "The certificate has expired."),
    (62, "The certificate is not valid for this hostname."),
    (18, "The certificate is self-signed."),
    (19, "The chain ends in a self-signed certificate nobody trusts."),
    (9999, "The certificate could not be verified."),
])
def test_a_rejected_certificate_says_which_way_it_was_rejected(code, expected):
    """Every one of these used to come back as CERTIFICATE_VERIFY_FAILED.
    OpenSSL's verify code is an integer, so the distinction costs nothing."""
    exc = ssl.SSLCertVerificationError("certificate verify failed")
    exc.verify_code = code

    def handshake(ip, port, hostname, context):
        raise exc

    with mock.patch.object(ssl_checker, "_handshake", handshake), \
         mock.patch.object(ssl_checker, "resolve_public_ipv4", lambda h: "192.0.2.1"):
        result = ssl_checker.check_ssl_certificate("host.example")
    assert result["error"] == expected
    assert result["valid"] is False


@pytest.mark.parametrize("exc, expected", [
    (network_safety.UnresolvableHostError("Could not resolve hostname."),
     "the name could not be resolved"),
    (network_safety.PrivateDestinationError("Private, loopback, ... are not allowed."),
     "it does not resolve to a public address"),
    (network_safety.UnsupportedUrlError("Only absolute HTTP(S) URLs are allowed."),
     "only absolute HTTP and HTTPS URLs can be checked"),
    (network_safety.UnsafeDestinationError("something else"), "the destination was refused"),
])
def test_our_own_refusals_are_reported_in_our_words_not_the_exceptions(exc, expected):
    """These carry only literals we wrote, but a caller still states the
    reason itself rather than forwarding an exception's message."""
    from app.core.failures import describe
    assert describe(exc) == expected

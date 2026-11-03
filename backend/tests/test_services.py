"""Offline unit tests for services (network calls are stubbed)."""

import contextlib
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
    assert "not allowed" in result["reason"]


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
    assert result["error"] == "WHOIS query failed: timed out"


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

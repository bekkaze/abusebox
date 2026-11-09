"""IPv6 lookups (#33) and domain blacklists (#34).

Everything here is offline. The point is the decoding, not the network: what a
zone's answer means, and which answers are not listings at all.
"""

import ipaddress
from unittest import mock

import dns.resolver
import pytest

from app.services import dnsbl


class _Rdata:
    def __init__(self, text):
        self._text = text

    def to_text(self):
        return self._text


def _resolver_returning(answers):
    """A resolver whose every query answers *answers* (a list of A records)."""
    resolver = mock.Mock(spec=dns.resolver.Resolver)
    resolver.resolve.return_value = [_Rdata(a) for a in answers]
    return resolver


def _resolver_nxdomain():
    resolver = mock.Mock(spec=dns.resolver.Resolver)
    resolver.resolve.side_effect = dns.resolver.NXDOMAIN()
    return resolver


# --- IPv6 nibble format (#33) ------------------------------------------------


def test_reverse_ipv6_matches_the_rfc_5782_example():
    # RFC 5782 section 2.4: 32 reversed nibbles, one per label.
    assert dnsbl.reverse_ipv6("2001:db8::1") == (
        "1.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.8.b.d.0.1.0.0.2"
    )


def test_reverse_ipv6_always_produces_32_labels():
    for address in ("::1", "2001:db8::1", "fe80::1234:5678:9abc:def0",
                    "2606:4700:4700::1111", "::ffff:7f00:2"):
        labels = dnsbl.reverse_ipv6(address).split(".")
        assert len(labels) == 32, address
        assert all(len(label) == 1 for label in labels)


def test_reverse_ipv4_is_the_octet_reversal():
    assert dnsbl.reverse_ipv4("203.0.113.25") == "25.113.0.203"


def test_ipv6_test_points_are_the_documented_addresses():
    # ::FFFF:7F00:2 must be listed, ::FFFF:7F00:1 must not be.
    assert dnsbl._TEST_POINT_LISTED_V6 == dnsbl.reverse_ipv6("::ffff:7f00:2")
    assert dnsbl._TEST_POINT_NOT_LISTED_V6 == dnsbl.reverse_ipv6("::ffff:7f00:1")


def test_ipv6_test_points_are_the_ipv4_ones_mapped():
    # The IPv6 test points are the IPv4 pair in v4-mapped form, which is what
    # makes them the right pair to use.
    assert ipaddress.IPv6Address("::ffff:7f00:2").ipv4_mapped == ipaddress.IPv4Address("127.0.0.2")
    assert ipaddress.IPv6Address("::ffff:7f00:1").ipv4_mapped == ipaddress.IPv4Address("127.0.0.1")


# --- which zones answer for which family (#33) -------------------------------


def test_only_ipv6_capable_zones_are_queried_for_ipv6():
    v6 = dnsbl.providers_for("ip", "ipv6")
    assert "zen.spamhaus.org" in v6
    assert "b.barracudacentral.org" in v6
    assert "bl.spamcop.net" in v6
    assert "dnsbl-1.uceprotect.net" in v6
    # A zone with no IPv6 support is not asked and so is never "no answer".
    assert "psbl.surriel.com" not in v6
    assert "truncate.gbudb.net" not in v6


def test_the_ipv6_only_zone_is_excluded_from_ipv4():
    assert "bl.ipv6.spameatingmonkey.net" in dnsbl.providers_for("ip", "ipv6")
    assert "bl.ipv6.spameatingmonkey.net" not in dnsbl.providers_for("ip", "ipv4")
    # ...and its IPv4 sibling is the other way round.
    assert "bl.spameatingmonkey.net" in dnsbl.providers_for("ip", "ipv4")
    assert "bl.spameatingmonkey.net" not in dnsbl.providers_for("ip", "ipv6")


def test_domain_zones_are_not_mixed_into_ip_zones():
    ip_zones = set(dnsbl.providers_for("ip", "ipv4")) | set(dnsbl.providers_for("ip", "ipv6"))
    assert not ip_zones & set(dnsbl.providers_for("domain"))
    assert set(dnsbl.providers_for("domain")) == {
        "dbl.spamhaus.org", "multi.surbl.org", "multi.uribl.com",
    }


def test_a_keyed_zone_is_only_queried_when_its_key_is_set(monkeypatch):
    monkeypatch.delenv("ABUSIX_API_KEY", raising=False)
    assert "combined.mail.abusix.zone" not in dnsbl.providers_for("ip", "ipv4")
    monkeypatch.setenv("ABUSIX_API_KEY", "key-123")
    assert "combined.mail.abusix.zone" in dnsbl.providers_for("ip", "ipv4")


# --- Spamhaus DBL decoding (#34) ---------------------------------------------


@pytest.mark.parametrize("code,meaning,severity", [
    ("127.0.1.2", "spam domain", "critical"),
    ("127.0.1.4", "phishing domain", "critical"),
    ("127.0.1.5", "malware domain", "critical"),
    ("127.0.1.6", "botnet command and control domain", "critical"),
    ("127.0.1.102", "abused legitimate domain: spam", "high"),
    ("127.0.1.106", "abused legitimate domain: botnet command and control", "high"),
])
def test_dbl_codes_decode_to_their_documented_meaning(code, meaning, severity):
    described = dnsbl.describe_listing("dbl.spamhaus.org", [code])
    assert described["meanings"] == [meaning]
    assert described["severity"] == severity


def test_dbl_listings_are_read_from_its_own_block():
    # DBL answers under 127.0.1.x, not the 127.0.0.x every other zone uses.
    codes, failure = dnsbl._lookup("bad.example", "dbl.spamhaus.org", _resolver_returning(["127.0.1.2"]))
    assert failure is None
    assert codes == ["127.0.1.2"]


def test_a_dbl_answer_in_the_wrong_block_is_not_a_listing():
    # 127.0.0.2 is a perfectly good code for another zone and means nothing here.
    codes, failure = dnsbl._lookup("x.example", "dbl.spamhaus.org", _resolver_returning(["127.0.0.2"]))
    assert codes == []
    assert failure == dnsbl.REFUSED


def test_dbl_error_code_is_a_failure_not_a_listing():
    # 127.0.1.255 means the query was refused, typically a public resolver or
    # too many queries. Read as a listing it would condemn every domain.
    codes, failure = dnsbl._lookup("x.example", "dbl.spamhaus.org", _resolver_returning(["127.0.1.255"]))
    assert codes == []
    assert failure == dnsbl.REFUSED


# --- SURBL and URIBL bitmasks (#34) ------------------------------------------


def test_surbl_decodes_every_bit_in_a_combined_answer():
    # 80 = 16 (malware) + 64 (abuse).
    described = dnsbl.describe_listing("multi.surbl.org", ["127.0.0.80"])
    assert described["meanings"] == ["malware site", "spam or abuse site"]
    # The worst of the two is what the listing is reported as.
    assert described["severity"] == "critical"


@pytest.mark.parametrize("code,meanings", [
    ("127.0.0.4", ["disposable email domain"]),
    ("127.0.0.8", ["phishing site"]),
    ("127.0.0.16", ["malware site"]),
    ("127.0.0.32", ["click tracker domain"]),
    ("127.0.0.64", ["spam or abuse site"]),
    ("127.0.0.128", ["cracked site"]),
    ("127.0.0.12", ["disposable email domain", "phishing site"]),
])
def test_surbl_bits_decode_individually(code, meanings):
    assert dnsbl.describe_listing("multi.surbl.org", [code])["meanings"] == meanings


def test_uribl_decodes_its_combined_test_value():
    # URIBL documents 127.0.0.14 as black + grey + red, used for its testpoint.
    described = dnsbl.describe_listing("multi.uribl.com", ["127.0.0.14"])
    assert described["meanings"] == [
        "black: spam domain",
        "grey: appears in spam but may be shared or legitimate",
        "red: actively used in spam right now",
    ]
    assert described["severity"] == "critical"


# --- the refusal that would otherwise condemn every domain (#34) -------------


def test_surbl_127_0_0_1_is_a_refusal_not_a_listing():
    # SURBL answers 127.0.0.1 when it is refusing the querying address. It sits
    # inside the listing block, so read naively it would mark every domain
    # checked as listed.
    codes, failure = dnsbl._lookup("example.com", "multi.surbl.org", _resolver_returning(["127.0.0.1"]))
    assert codes == []
    assert failure == dnsbl.REFUSED


@pytest.mark.parametrize("code", ["127.0.0.1", "127.0.0.255"])
def test_uribl_refusal_codes_are_failures(code):
    codes, failure = dnsbl._lookup("example.com", "multi.uribl.com", _resolver_returning([code]))
    assert codes == []
    assert failure == dnsbl.REFUSED


def test_a_refusal_alongside_a_listing_is_still_a_refusal():
    # URIBL's blocked answer is 127.0.0.255 together with 127.0.0.1. Taking the
    # other value as a finding would report a listing from a zone that just
    # told us it is not answering.
    codes, failure = dnsbl._lookup(
        "example.com", "multi.uribl.com", _resolver_returning(["127.0.0.255", "127.0.0.1"])
    )
    assert codes == []
    assert failure == dnsbl.REFUSED


def test_an_ordinary_uribl_listing_still_counts():
    codes, failure = dnsbl._lookup("spam.example", "multi.uribl.com", _resolver_returning(["127.0.0.2"]))
    assert failure is None
    assert codes == ["127.0.0.2"]


def test_not_listed_is_still_clean_for_a_domain_zone():
    codes, failure = dnsbl._lookup("good.example", "multi.surbl.org", _resolver_nxdomain())
    assert codes == []
    assert failure is None


# --- test points per kind and family -----------------------------------------


def test_test_points_follow_the_family():
    zen = dnsbl.LISTS_BY_ZONE["zen.spamhaus.org"]
    assert dnsbl.test_points_for(zen, "ipv4") == (dnsbl._TEST_POINT_LISTED, dnsbl._TEST_POINT_NOT_LISTED)
    assert dnsbl.test_points_for(zen, "ipv6") == (dnsbl._TEST_POINT_LISTED_V6, dnsbl._TEST_POINT_NOT_LISTED_V6)


def test_domain_zones_use_their_published_test_name():
    listed, clean = dnsbl.test_points_for(dnsbl.LISTS_BY_ZONE["dbl.spamhaus.org"])
    assert listed == "dbltest.com"
    # Nothing under .invalid can ever be registered (RFC 2606), so a zone that
    # calls it listed is listing everything.
    assert clean.endswith(".invalid")


def test_every_domain_zone_publishes_a_test_point():
    for zone in dnsbl.providers_for("domain"):
        assert dnsbl.LISTS_BY_ZONE[zone].test_listed, zone


def test_the_negative_domain_test_point_differs_every_time():
    meta = dnsbl.LISTS_BY_ZONE["multi.surbl.org"]
    assert dnsbl.test_points_for(meta)[1] != dnsbl.test_points_for(meta)[1]


# --- what a whole check queries ----------------------------------------------


def _answers(listed_zones):
    def _lookup(label, provider, resolver=None):
        if provider in listed_zones:
            return [listed_zones[provider]], None
        return [], None
    return _lookup


def test_a_domain_is_checked_against_both_its_address_and_its_name():
    with mock.patch.object(dnsbl, "_resolve_ipv4", return_value="203.0.113.25"), \
         mock.patch.object(dnsbl, "_lookup", _answers({"dbl.spamhaus.org": "127.0.1.2"})), \
         mock.patch.object(dnsbl, "_answers_test_points", return_value=True):
        result = dnsbl.check_dnsbl_providers("example.com")

    assert result["checked_address"] == "203.0.113.25"
    assert result["checked_domain"] == "example.com"
    # Both families of zone were asked.
    assert "zen.spamhaus.org" in result["providers"]
    assert "dbl.spamhaus.org" in result["providers"]
    assert result["is_blacklisted"] is True
    assert [entry["provider"] for entry in result["detected_on"]] == ["dbl.spamhaus.org"]


def test_an_ipv6_target_queries_only_ipv6_zones():
    with mock.patch.object(dnsbl, "_lookup", _answers({})), \
         mock.patch.object(dnsbl, "_answers_test_points", return_value=True):
        result = dnsbl.check_dnsbl_providers("2001:db8::1")

    assert result["address_family"] == "ipv6"
    assert set(result["providers"]) == set(dnsbl.providers_for("ip", "ipv6"))
    # No domain zone, because an address has no name to look up.
    assert "dbl.spamhaus.org" not in result["providers"]
    # And no IPv4-only zone, which would otherwise report a false "no answer".
    assert "psbl.surriel.com" not in result["providers"]


def test_an_ipv4_literal_queries_no_domain_zones():
    with mock.patch.object(dnsbl, "_lookup", _answers({})), \
         mock.patch.object(dnsbl, "_answers_test_points", return_value=True):
        result = dnsbl.check_dnsbl_providers("203.0.113.25")

    assert result["address_family"] == "ipv4"
    assert result["checked_domain"] is None
    assert set(result["providers"]) == set(dnsbl.providers_for("ip", "ipv4"))


def test_a_domain_that_does_not_resolve_is_still_checked_by_name():
    # A spam domain often has no address at all. Its name is still listed.
    with mock.patch.object(dnsbl, "_resolve_ipv4", return_value=None), \
         mock.patch.object(dnsbl, "_lookup", _answers({"multi.surbl.org": "127.0.0.64"})), \
         mock.patch.object(dnsbl, "_answers_test_points", return_value=True):
        result = dnsbl.check_dnsbl_providers("gone.example")

    assert result["checked_address"] is None
    assert set(result["providers"]) == set(dnsbl.providers_for("domain"))
    assert result["is_blacklisted"] is True
    assert result["detected_on"][0]["categories"] == ["spam or abuse site"]


def test_a_url_is_reduced_to_its_host():
    with mock.patch.object(dnsbl, "_resolve_ipv4", return_value="203.0.113.25"), \
         mock.patch.object(dnsbl, "_lookup", _answers({})), \
         mock.patch.object(dnsbl, "_answers_test_points", return_value=True):
        result = dnsbl.check_dnsbl_providers("https://example.com:8443/path")
    assert result["checked_domain"] == "example.com"


def test_surbl_live_test_point_value_decodes():
    # test.surbl.org answers 127.0.0.254, verified live: every documented bit
    # plus the deprecated bit 2. It must read as a listing, not a refusal.
    described = dnsbl.describe_listing("multi.surbl.org", ["127.0.0.254"])
    assert "phishing site" in described["meanings"]
    assert "cracked site" in described["meanings"]
    assert described["severity"] == "critical"

    codes, failure = dnsbl._lookup("test.surbl.org", "multi.surbl.org", _resolver_returning(["127.0.0.254"]))
    assert failure is None
    assert codes == ["127.0.0.254"]


def test_an_undecoded_bit_falls_back_to_the_lists_own_meaning():
    # 127.0.0.2 is SURBL's deprecated bit, which has no entry. The listing is
    # still real, so it reports the zone's default rather than nothing.
    described = dnsbl.describe_listing("multi.surbl.org", ["127.0.0.2"])
    assert described["meanings"] == ["domain listed by SURBL"]
    assert described["severity"] == "high"


# --- an IPv6 asset has to be creatable for any of this to matter -------------


def test_an_ipv6_address_is_a_valid_asset_target():
    from app.schemas.hostname import _valid_target

    assert _valid_target("2001:db8::1") == "2001:db8::1"
    assert _valid_target("[2001:db8::1]") == "2001:db8::1"
    assert _valid_target("https://[2001:db8::1]/x") == "https://[2001:db8::1]/x"


def test_an_ipv6_address_is_stored_in_one_form():
    # The same address written two ways would otherwise be two assets, each
    # checked and alerted on separately.
    from app.schemas.hostname import _valid_target

    assert _valid_target("2001:0db8:0000:0000:0000:0000:0000:0001") == "2001:db8::1"
    assert _valid_target("2001:DB8::1") == "2001:db8::1"


def test_a_malformed_ipv6_address_is_still_rejected():
    import pytest as _pytest

    from app.schemas.hostname import _valid_target

    for bad in ("2001:db8::zz", "2001:db8:::1", ":::"):
        with _pytest.raises(ValueError):
            _valid_target(bad)


# --- keyed zones -------------------------------------------------------------


def test_an_unkeyed_list_is_queried_at_its_public_zone(monkeypatch):
    monkeypatch.delenv("SPAMHAUS_DQS_KEY", raising=False)
    assert dnsbl._query_zone("zen.spamhaus.org") == "zen.spamhaus.org"


def test_a_spamhaus_key_redirects_to_the_keyed_mirror(monkeypatch):
    monkeypatch.setenv("SPAMHAUS_DQS_KEY", "sk123")
    assert dnsbl._query_zone("zen.spamhaus.org") == "sk123.zen.dq.spamhaus.net"


def test_a_keyed_list_puts_its_key_in_the_query(monkeypatch):
    # Abusix answers nobody without a key. Querying the bare zone would leave
    # the list permanently "no answer" while appearing to be enabled.
    monkeypatch.setenv("ABUSIX_API_KEY", "ak456")
    assert dnsbl._query_zone("combined.mail.abusix.zone") == "ak456.combined.mail.abusix.zone"


def test_a_list_that_requires_a_key_is_skipped_without_one(monkeypatch):
    monkeypatch.delenv("ABUSIX_API_KEY", raising=False)
    assert "combined.mail.abusix.zone" not in dnsbl.providers_for("ip", "ipv4")


def test_a_list_with_an_optional_key_is_queried_either_way(monkeypatch):
    # Spamhaus has a free public mirror, so it is never skipped.
    monkeypatch.delenv("SPAMHAUS_DQS_KEY", raising=False)
    assert "zen.spamhaus.org" in dnsbl.providers_for("ip", "ipv4")
    monkeypatch.setenv("SPAMHAUS_DQS_KEY", "sk123")
    assert "zen.spamhaus.org" in dnsbl.providers_for("ip", "ipv4")


# --- a query that cannot be asked -------------------------------------------


def test_a_name_too_long_to_query_does_not_blame_the_zone():
    # 253 is the DNS limit for a whole name. A long domain plus the zone's own
    # suffix exceeds it, and the zone must not be recorded as "no answer" for
    # a query it was never sent.
    label = "a" * 60
    long_domain = ".".join([label, label, label, label])  # 243 characters
    assert len(long_domain) + 1 + len("dbl.spamhaus.org") > dnsbl._MAX_DNS_NAME

    with mock.patch.object(dnsbl, "_resolve_ipv4", return_value="203.0.113.25"), \
         mock.patch.object(dnsbl, "_lookup", _answers({})), \
         mock.patch.object(dnsbl, "_answers_test_points", return_value=True):
        result = dnsbl.check_dnsbl_providers(long_domain)

    assert "dbl.spamhaus.org" not in result["providers"]
    assert "dbl.spamhaus.org" not in result["failed_providers"]
    # The IP zones are unaffected: the address is short.
    assert "zen.spamhaus.org" in result["providers"]


def test_a_short_domain_still_reaches_the_domain_zones():
    with mock.patch.object(dnsbl, "_resolve_ipv4", return_value="203.0.113.25"), \
         mock.patch.object(dnsbl, "_lookup", _answers({})), \
         mock.patch.object(dnsbl, "_answers_test_points", return_value=True):
        result = dnsbl.check_dnsbl_providers("example.com")
    assert "dbl.spamhaus.org" in result["providers"]


# --- target_address, which the public quick check guards with ----------------


def test_target_address_passes_an_ipv6_literal_through():
    assert dnsbl.target_address("2001:db8::1") == ("2001:db8::1", "ipv6")
    assert dnsbl.target_address("[2001:db8::1]") == ("2001:db8::1", "ipv6")


def test_target_address_passes_an_ipv4_literal_through():
    assert dnsbl.target_address("203.0.113.25") == ("203.0.113.25", "ipv4")


def test_target_address_resolves_a_name():
    with mock.patch.object(dnsbl, "_resolve_ipv4", return_value="203.0.113.25"):
        assert dnsbl.target_address("example.com") == ("203.0.113.25", "ipv4")


def test_target_address_reports_an_unresolvable_name():
    with mock.patch.object(dnsbl, "_resolve_ipv4", return_value=None):
        assert dnsbl.target_address("nope.invalid") == (None, "")


def test_a_private_ipv6_address_is_still_caught_by_the_public_guard():
    # The quick check rejects anything not globally routable; the guard reads
    # the address target_address returns, so it has to be a real address.
    address, family = dnsbl.target_address("::1")
    assert family == "ipv6"
    assert not ipaddress.ip_address(address).is_global


def test_an_api_key_never_reaches_the_result(monkeypatch):
    # The key is part of the query name by necessity, so it reaches the
    # operator's resolver. It must not reach the stored check result, which is
    # handed to the browser, exported to CSV and pasted into tickets.
    monkeypatch.setenv("ABUSIX_API_KEY", "secret-key-value")
    monkeypatch.setenv("SPAMHAUS_DQS_KEY", "another-secret")

    with mock.patch.object(dnsbl, "_lookup", _answers({"combined.mail.abusix.zone": "127.0.0.2"})), \
         mock.patch.object(dnsbl, "_answers_test_points", return_value=True):
        result = dnsbl.check_dnsbl_providers("203.0.113.25")

    blob = repr(result)
    assert "secret-key-value" not in blob
    assert "another-secret" not in blob
    # The zone is reported under its public name, not the keyed one.
    assert "combined.mail.abusix.zone" in result["providers"]
    assert "dq.spamhaus.net" not in blob

"""Why each listing happened (1.6.0): the catalogue's causes and the resolver."""

import pytest

from app.services import causes, dnsbl
from app.services.dnsbl_lists import CAUSES, DNSBL_LISTS, LISTS_BY_ZONE

ADDRESS = "203.0.113.5"


def _results(provider, codes=("127.0.0.2",), ptr=None, dns=True, address=ADDRESS):
    """A saved result as the monitor stores it, with an optional 1.6 PTR lookup."""
    out = {"blacklist": {
        "checked_address": address,
        "detected_on": [{"provider": provider, "codes": list(codes), "severity": "low", "status": "open"}],
    }}
    if dns:
        out["dns"] = {"domain": address, "records": {"PTR": ptr} if ptr else {}, "record_types_checked": ["PTR"]}
    return out


def _one(results):
    [assessment] = causes.assess(results)
    return assessment


# --- the catalogue ---------------------------------------------------------------

@pytest.mark.parametrize("item", DNSBL_LISTS, ids=lambda item: item.zone)
def test_every_list_and_code_names_a_known_cause(item):
    assert item.cause in CAUSES
    for entry in [*item.codes.values(), *item.bits.values()]:
        assert len(entry) == 2 or entry[2] in CAUSES


def test_every_spamhaus_zen_code_says_its_own_cause():
    # SBL, XBL, DROP and PBL call for four different actions, so none of them
    # may fall back to the list's default.
    zen = LISTS_BY_ZONE["zen.spamhaus.org"]
    assert all(len(entry) == 3 for entry in zen.codes.values())


def test_every_cause_has_wording():
    assert set(causes.CAUSE_TEXT) == set(CAUSES)


@pytest.mark.parametrize(("provider", "codes", "expected"), [
    ("zen.spamhaus.org", ["127.0.0.2"], ["sending"]),
    ("zen.spamhaus.org", ["127.0.0.4"], ["compromise"]),
    ("zen.spamhaus.org", ["127.0.0.9"], ["upstream"]),
    ("zen.spamhaus.org", ["127.0.0.10"], ["upstream"]),
    ("zen.spamhaus.org", ["127.0.0.2", "127.0.0.10"], ["sending", "upstream"]),
    ("zen.spamhaus.org", ["127.0.0.99"], ["sending"]),          # undocumented code: the list's own
    ("combined.mail.abusix.zone", ["127.0.0.4"], ["compromise"]),
    ("combined.mail.abusix.zone", ["127.0.0.2"], ["sending"]),
    ("dnsbl.dronebl.org", ["127.0.0.3"], ["compromise"]),
    ("ips.backscatterer.org", ["127.0.0.2"], ["server-policy"]),
    ("noptr.spamrats.com", ["127.0.0.38"], ["config"]),
    ("b.barracudacentral.org", ["127.0.0.2"], ["sending"]),
    ("dbl.spamhaus.org", ["127.0.1.2"], ["domain"]),
    ("multi.surbl.org", ["127.0.0.80"], ["domain"]),
])
def test_describe_listing_reports_the_cause(provider, codes, expected):
    assert dnsbl.describe_listing(provider, codes)["causes"] == expected


def test_a_list_no_longer_in_the_catalogue_is_not_guessed_at():
    assert dnsbl.describe_listing("gone.example.org", ["127.0.0.2"])["causes"] == []


# --- the verdicts ----------------------------------------------------------------

@pytest.mark.parametrize(("provider", "code", "readiness"), [
    ("dnsbl.dronebl.org", "127.0.0.3", "blocked"),
    ("b.barracudacentral.org", "127.0.0.2", "caution"),
    ("zen.spamhaus.org", "127.0.0.10", "not_applicable"),
    ("ips.backscatterer.org", "127.0.0.2", "caution"),
    ("dbl.spamhaus.org", "127.0.1.2", "caution"),
])
def test_each_class_gives_its_verdict(provider, code, readiness):
    result = _one(_results(provider, [code]))
    assert result["readiness"] == readiness
    assert result["verifiable"] is False
    assert result["fixed"] is None


def test_several_causes_take_the_firmest_verdict():
    # SBL (caution) and XBL (blocked) together: the compromise decides.
    result = _one(_results("zen.spamhaus.org", ["127.0.0.2", "127.0.0.4"]))
    assert result["causes"] == ["sending", "compromise"]
    assert result["cause"] == "compromise"
    assert result["readiness"] == "blocked"


def test_upstream_alone_is_not_yours_to_request():
    result = _one(_results("zen.spamhaus.org", ["127.0.0.11"]))
    assert result["label"] == "Your provider's range"
    assert result["readiness"] == "not_applicable"


def test_unclassified_list_is_caution_not_a_guess():
    result = _one(_results("gone.example.org"))
    assert result["cause"] is None
    assert result["readiness"] == "caution"


# --- the two causes AbuseBox can check ----------------------------------------------

def test_noptr_without_a_ptr_is_blocked():
    result = _one(_results("noptr.spamrats.com", ptr=None))
    assert result["verifiable"] is True
    assert result["fixed"] is False
    assert result["readiness"] == "blocked"
    assert result["evidence"] == f"{ADDRESS} has no reverse DNS (PTR) record."
    assert "PTR record" in result["advice"]


def test_noptr_with_a_ptr_is_ready():
    result = _one(_results("noptr.spamrats.com", ptr=["mail.example.com."]))
    assert result["fixed"] is True
    assert result["readiness"] == "ready"
    assert result["evidence"] == f"{ADDRESS} has reverse DNS: mail.example.com."


def test_without_a_lookup_it_does_not_pretend_to_know():
    result = _one(_results("noptr.spamrats.com", dns=False))
    assert result["fixed"] is None
    assert result["readiness"] == "caution"
    assert "no reverse DNS lookup" in result["evidence"]


def test_a_dns_result_saved_before_1_6_is_not_read_as_no_ptr():
    # Before 1.6 the DNS check never looked up an address's PTR, so an empty
    # record list there proves nothing.
    results = _results("noptr.spamrats.com", dns=False)
    results["dns"] = {"domain": ADDRESS, "records": {"A": [ADDRESS]},
                      "record_types_checked": ["A", "AAAA", "MX", "TXT", "CNAME", "NS", "SOA", "PTR"]}
    assert _one(results)["fixed"] is None


def test_a_ptr_for_another_address_does_not_count():
    results = _results("noptr.spamrats.com", ptr=["mail.example.com."])
    results["dns"]["domain"] = "198.51.100.7"
    assert _one(results)["fixed"] is None


@pytest.mark.parametrize(("ptr", "fixed"), [
    ("mail.example.com.", True),
    ("mx1.example.net", True),
    ("203-0-113-5.static.example.net", False),
    ("5.113.0.203.in-addr.example.net", False),
    ("ec2-203-0-113-5.compute-1.amazonaws.com", False),
    ("host203000113005.example.net", False),
    ("cb007105.example.net", False),
    ("dsl-pool-17.example.net", False),
    ("dyn123.example.net", False),
])
def test_dyna_checks_whether_reverse_dns_still_looks_generic(ptr, fixed):
    result = _one(_results("dyna.spamrats.com", ptr=[ptr]))
    assert result["fixed"] is fixed
    assert result["readiness"] == ("ready" if fixed else "blocked")


def test_dyna_with_no_ptr_at_all_is_not_fixed():
    assert _one(_results("dyna.spamrats.com", ptr=None))["fixed"] is False


@pytest.mark.parametrize(("name", "reason"), [
    ("2001-db8--1.example.net", "it contains the address"),
    ("host-0000000000000001.v6.example.net", "it contains the address"),
    ("mail.example.com", None),
])
def test_generic_ipv6_reverse_names(name, reason):
    assert causes.generic_ptr_reason(name, "2001:db8::1") == reason


def test_words_match_whole_tokens_only():
    assert causes.generic_ptr_reason("dslr-camera-shop.example.com", ADDRESS) is None
    assert causes.generic_ptr_reason("mailpool.example.com", ADDRESS) is None


def test_nothing_to_assess_without_a_usable_blacklist_result():
    assert causes.assess(None) == []
    assert causes.assess({"blacklist": {"error": "resolver refused"}}) == []

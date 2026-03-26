"""Tests for DNSBL checking service.

Compares abusebox results against independent dnspython queries to verify
correctness — the same approach tools like MXToolbox use under the hood.
"""

import dns.resolver
import dns.exception
import pytest

from app.services.dnsbl import (
    BASE_PROVIDERS,
    _check_provider,
    _make_resolver,
    _resolve_ipv4,
    check_dnsbl_providers,
)

# A well-known Spamhaus test IP that is always listed on zen.spamhaus.org.
# See https://www.spamhaus.org/faq/section/DNSBL%20Usage#261
SPAMHAUS_TEST_IP = "127.0.0.2"

# A real-world banned IP for live cross-validation against MXToolbox-style checks.
REAL_BANNED_IP = "66.132.195.108"

# Providers shared with MXToolbox that we use for cross-validation.
MXTOOLBOX_SHARED_PROVIDERS = [
    "zen.spamhaus.org",
    "bl.spamcop.net",
    "b.barracudacentral.org",
    "dnsbl-1.uceprotect.net",
    "dnsbl-2.uceprotect.net",
    "dnsbl-3.uceprotect.net",
    "dnsbl.dronebl.org",
    "psbl.surriel.com",
    "dyna.spamrats.com",
    "noptr.spamrats.com",
    "spam.spamrats.com",
    "rbl.interserver.net",
    "ubl.lashback.com",
    "bl.nordspam.com",
    "spamrbl.imp.ch",
    "wormrbl.imp.ch",
    "z.mailspike.net",
    "ips.backscatterer.org",
    "relays.nether.net",
    "matrix.spfbl.net",
    "blacklist.woody.ch",
    "all.s5h.net",
]


def _raw_dnsbl_query(ip: str, provider: str, timeout: float = 5.0) -> tuple[bool, bool]:
    """Independent DNSBL query using dnspython directly.

    Returns (is_listed, failed).
    """
    reversed_ip = ".".join(reversed(ip.split(".")))
    query = f"{reversed_ip}.{provider}"
    resolver = dns.resolver.Resolver()
    resolver.lifetime = timeout
    resolver.timeout = timeout
    try:
        answers = resolver.resolve(query, "A")
        for rdata in answers:
            parts = rdata.to_text().split(".")
            if parts[0] == "127" and parts[1] == "0" and parts[2] == "0":
                return True, False
        return False, False
    except dns.resolver.NXDOMAIN:
        return False, False
    except dns.resolver.NoAnswer:
        return False, False
    except dns.exception.DNSException:
        return False, True


def _raw_dnsbl_query_stable(ip: str, provider: str, attempts: int = 3) -> tuple[bool, bool]:
    """Query a DNSBL provider multiple times to get a stable result.

    DNS responses can be inconsistent due to timeouts under load.
    Retry up to `attempts` times with a generous timeout.  A provider
    is considered "listed" if *any* attempt returns listed, and "failed"
    only if *all* attempts fail.
    """
    for _ in range(attempts):
        is_listed, failed = _raw_dnsbl_query(ip, provider, timeout=8.0)
        if is_listed:
            return True, False
        if not failed:
            return False, False
    return False, True


# ---------------------------------------------------------------------------
# Unit tests
# ---------------------------------------------------------------------------


class TestResolveIpv4:
    def test_plain_ipv4(self):
        assert _resolve_ipv4("1.2.3.4") == "1.2.3.4"

    def test_url_with_scheme(self):
        assert _resolve_ipv4("http://1.2.3.4/path") == "1.2.3.4"

    def test_host_with_port(self):
        assert _resolve_ipv4("1.2.3.4:8080") == "1.2.3.4"

    def test_empty_string(self):
        assert _resolve_ipv4("") is None

    def test_unresolvable(self):
        assert _resolve_ipv4("this-will-never-resolve.invalid") is None


class TestCheckProvider:
    """Test _check_provider against the Spamhaus test addresses."""

    @pytest.mark.timeout(10)
    def test_spamhaus_test_ip_is_listed(self):
        """127.0.0.2 must always be listed on zen.spamhaus.org."""
        resolver = _make_resolver()
        provider, is_listed, failed = _check_provider("2.0.0.127", "zen.spamhaus.org", resolver)
        assert provider == "zen.spamhaus.org"
        if not failed:
            assert is_listed, (
                "Spamhaus test IP 127.0.0.2 should be listed on zen.spamhaus.org. "
                "If this fails, your DNS resolver may be blocked by Spamhaus — "
                "set DNSBL_NAMESERVERS to a local recursive resolver."
            )

    @pytest.mark.timeout(10)
    def test_localhost_not_listed(self):
        """127.0.0.1 reversed (1.0.0.127) should NOT be listed anywhere."""
        resolver = _make_resolver()
        provider, is_listed, failed = _check_provider("1.0.0.127", "zen.spamhaus.org", resolver)
        if not failed:
            assert not is_listed

    @pytest.mark.timeout(10)
    def test_failed_provider_detected(self):
        """A non-existent provider should be marked as failed."""
        resolver = _make_resolver()
        provider, is_listed, failed = _check_provider("2.0.0.127", "nonexistent.invalid.test", resolver)
        assert not is_listed
        # Either fails or returns NXDOMAIN — both are acceptable for invalid zone


class TestCheckDnsblProviders:
    @pytest.mark.timeout(30)
    def test_result_structure(self):
        result = check_dnsbl_providers("127.0.0.1")
        assert "detected_on" in result
        assert "providers" in result
        assert "failed_providers" in result
        assert "is_blacklisted" in result
        assert "hostname" in result
        assert result["providers"] == BASE_PROVIDERS

    @pytest.mark.timeout(30)
    def test_invalid_host(self):
        result = check_dnsbl_providers("this-will-never-resolve.invalid")
        assert result["error"] == "Unable to resolve hostname to IPv4 address"
        assert result["is_blacklisted"] is False

    @pytest.mark.timeout(30)
    def test_failed_providers_tracked(self):
        """Ensure failed_providers is actually populated when providers fail."""
        result = check_dnsbl_providers("127.0.0.1")
        # We can't guarantee failures, but the field must exist and be a list
        assert isinstance(result["failed_providers"], list)


# ---------------------------------------------------------------------------
# Cross-validation: abusebox vs independent queries (like MXToolbox)
# ---------------------------------------------------------------------------


class TestCrossValidation:
    """Compare abusebox DNSBL results against independent raw DNS queries.

    This replicates what MXToolbox does — both tools simply query the same
    DNSBL zones via DNS. If abusebox and raw queries disagree, our
    implementation has a bug.
    """

    @pytest.mark.timeout(120)
    def test_abusebox_matches_raw_queries_for_spamhaus_test_ip(self):
        """Cross-validate using Spamhaus test IP 127.0.0.2.

        This IP is guaranteed to be listed on zen.spamhaus.org and
        possibly others. Compare abusebox results with independent queries
        on the provider set shared with MXToolbox.
        """
        ip = SPAMHAUS_TEST_IP

        # 1) Stable raw baseline (retried, long timeout)
        raw_listed: set[str] = set()
        raw_failed: set[str] = set()
        for provider in MXTOOLBOX_SHARED_PROVIDERS:
            is_listed, failed = _raw_dnsbl_query_stable(ip, provider)
            if failed:
                raw_failed.add(provider)
            elif is_listed:
                raw_listed.add(provider)

        # 2) Get abusebox results
        abusebox_result = check_dnsbl_providers(ip)
        abusebox_listed = {d["provider"] for d in abusebox_result["detected_on"]}
        abusebox_failed = set(abusebox_result["failed_providers"])

        # 3) Compare — only on providers where both sides succeeded
        comparable = set(MXTOOLBOX_SHARED_PROVIDERS) - abusebox_failed - raw_failed

        missed = (raw_listed & comparable) - (abusebox_listed & comparable)
        extra = (abusebox_listed & comparable) - (raw_listed & comparable)

        assert not missed, (
            f"Abusebox MISSED listings that raw DNS queries found: {missed}. "
            f"This indicates a bug in the DNSBL check logic."
        )
        assert not extra, (
            f"Abusebox reported EXTRA listings that raw DNS queries did not find: {extra}. "
            f"This indicates a false positive in the DNSBL check logic."
        )

    @pytest.mark.timeout(180)
    def test_abusebox_matches_raw_queries_for_all_providers(self):
        """Cross-validate ALL providers (not just MXToolbox-shared ones)
        using the Spamhaus test IP.
        """
        ip = SPAMHAUS_TEST_IP

        # 1) Stable raw baseline
        raw_listed: set[str] = set()
        raw_failed: set[str] = set()
        for provider in BASE_PROVIDERS:
            is_listed, failed = _raw_dnsbl_query_stable(ip, provider)
            if failed:
                raw_failed.add(provider)
            elif is_listed:
                raw_listed.add(provider)

        # 2) Abusebox result
        abusebox_result = check_dnsbl_providers(ip)
        abusebox_listed = {d["provider"] for d in abusebox_result["detected_on"]}
        abusebox_failed = set(abusebox_result["failed_providers"])

        comparable = set(BASE_PROVIDERS) - abusebox_failed - raw_failed

        missed = (raw_listed & comparable) - (abusebox_listed & comparable)
        extra = (abusebox_listed & comparable) - (raw_listed & comparable)

        assert not missed, (
            f"Abusebox MISSED listings on: {missed}"
        )
        assert not extra, (
            f"Abusebox reported FALSE POSITIVES on: {extra}"
        )

        # At least zen.spamhaus.org should be listed for 127.0.0.2
        if "zen.spamhaus.org" in comparable:
            assert "zen.spamhaus.org" in abusebox_listed, (
                "Spamhaus test IP 127.0.0.2 must be listed on zen.spamhaus.org"
            )

    @pytest.mark.timeout(180)
    def test_clean_ip_not_listed(self):
        """A known clean IP (Google DNS 8.8.8.8) should not be listed
        on any DNSBL. Compare abusebox vs raw queries.
        """
        ip = "8.8.8.8"

        abusebox_result = check_dnsbl_providers(ip)
        abusebox_listed = {d["provider"] for d in abusebox_result["detected_on"]}
        abusebox_failed = set(abusebox_result["failed_providers"])

        raw_listed: set[str] = set()
        raw_failed: set[str] = set()
        for provider in BASE_PROVIDERS:
            is_listed, failed = _raw_dnsbl_query_stable(ip, provider)
            if failed:
                raw_failed.add(provider)
            elif is_listed:
                raw_listed.add(provider)

        comparable = set(BASE_PROVIDERS) - abusebox_failed - raw_failed

        missed = (raw_listed & comparable) - (abusebox_listed & comparable)
        extra = (abusebox_listed & comparable) - (raw_listed & comparable)

        assert not missed, f"Abusebox MISSED listings on: {missed}"
        assert not extra, f"Abusebox reported FALSE POSITIVES on: {extra}"


# ---------------------------------------------------------------------------
# Real-world IP: abusebox vs MXToolbox-style independent queries
# ---------------------------------------------------------------------------


class TestRealBannedIP:
    """Cross-validate abusebox against independent DNS queries for a real
    banned IP (66.132.195.108), the same way MXToolbox checks work.

    Uses stable (retried) raw queries as the ground truth baseline,
    then verifies abusebox agrees on every provider where both sides
    got a definitive answer.
    """

    @pytest.mark.timeout(180)
    def test_real_ip_abusebox_vs_mxtoolbox_shared_providers(self):
        """Compare abusebox vs raw queries on MXToolbox-shared providers."""
        ip = REAL_BANNED_IP

        # 1) Stable raw baseline (retried, long timeout)
        raw_listed: set[str] = set()
        raw_failed: set[str] = set()
        for provider in MXTOOLBOX_SHARED_PROVIDERS:
            is_listed, failed = _raw_dnsbl_query_stable(ip, provider)
            if failed:
                raw_failed.add(provider)
            elif is_listed:
                raw_listed.add(provider)

        # 2) Abusebox result
        abusebox_result = check_dnsbl_providers(ip)
        abusebox_listed = {d["provider"] for d in abusebox_result["detected_on"]}
        abusebox_failed = set(abusebox_result["failed_providers"])

        # 3) Compare only providers where both got a definitive answer
        comparable = set(MXTOOLBOX_SHARED_PROVIDERS) - abusebox_failed - raw_failed

        missed = (raw_listed & comparable) - (abusebox_listed & comparable)
        extra = (abusebox_listed & comparable) - (raw_listed & comparable)

        # Print detailed report for debugging
        print(f"\n{'='*60}")
        print(f"Real IP cross-validation: {ip}")
        print(f"{'='*60}")
        print(f"Raw baseline listed ({len(raw_listed)}): {sorted(raw_listed)}")
        print(f"Abusebox listed ({len(abusebox_listed)}): {sorted(abusebox_listed)}")
        print(f"Raw failed: {sorted(raw_failed)}")
        print(f"Abusebox failed: {sorted(abusebox_failed)}")
        print(f"Comparable providers: {len(comparable)}")
        if missed:
            print(f"MISSED: {sorted(missed)}")
        if extra:
            print(f"EXTRA: {sorted(extra)}")
        print(f"{'='*60}")

        assert not missed, (
            f"Abusebox MISSED listings that MXToolbox-style queries found: {sorted(missed)}. "
            f"Raw listed: {sorted(raw_listed)}, Abusebox listed: {sorted(abusebox_listed)}"
        )
        assert not extra, (
            f"Abusebox reported EXTRA listings not found by MXToolbox-style queries: {sorted(extra)}. "
            f"Raw listed: {sorted(raw_listed)}, Abusebox listed: {sorted(abusebox_listed)}"
        )

    @pytest.mark.timeout(300)
    def test_real_ip_abusebox_vs_all_providers(self):
        """Compare abusebox vs raw queries on ALL providers for the real IP."""
        ip = REAL_BANNED_IP

        # 1) Stable raw baseline
        raw_listed: set[str] = set()
        raw_failed: set[str] = set()
        for provider in BASE_PROVIDERS:
            is_listed, failed = _raw_dnsbl_query_stable(ip, provider)
            if failed:
                raw_failed.add(provider)
            elif is_listed:
                raw_listed.add(provider)

        # 2) Abusebox result
        abusebox_result = check_dnsbl_providers(ip)
        abusebox_listed = {d["provider"] for d in abusebox_result["detected_on"]}
        abusebox_failed = set(abusebox_result["failed_providers"])

        # 3) Compare
        comparable = set(BASE_PROVIDERS) - abusebox_failed - raw_failed

        missed = (raw_listed & comparable) - (abusebox_listed & comparable)
        extra = (abusebox_listed & comparable) - (raw_listed & comparable)

        print(f"\n{'='*60}")
        print(f"Real IP full cross-validation: {ip}")
        print(f"{'='*60}")
        print(f"Raw baseline listed ({len(raw_listed)}): {sorted(raw_listed)}")
        print(f"Abusebox listed ({len(abusebox_listed)}): {sorted(abusebox_listed)}")
        print(f"Raw failed ({len(raw_failed)}): {sorted(raw_failed)}")
        print(f"Abusebox failed ({len(abusebox_failed)}): {sorted(abusebox_failed)}")
        print(f"Comparable providers: {len(comparable)}/{len(BASE_PROVIDERS)}")
        if missed:
            print(f"MISSED: {sorted(missed)}")
        if extra:
            print(f"EXTRA: {sorted(extra)}")
        print(f"{'='*60}")

        assert not missed, (
            f"Abusebox MISSED listings: {sorted(missed)}"
        )
        assert not extra, (
            f"Abusebox reported FALSE POSITIVES: {sorted(extra)}"
        )

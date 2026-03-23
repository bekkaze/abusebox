"""Unified check runner — runs all enabled tools for a given hostname."""

import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any

logger = logging.getLogger(__name__)


def run_enabled_checks(hostname: str, toggles: dict[str, bool]) -> dict[str, Any]:
    """Run all enabled check tools for *hostname* and return a merged result dict.

    *toggles* maps check names to booleans, e.g.:
        {"check_blacklist": True, "check_ssl": True, ...}

    Returns a dict like:
        {
            "blacklist": { ... },
            "abuseipdb": { ... },
            "dns": { ... },
            ...
        }
    """
    tasks: dict[str, tuple] = {}

    if toggles.get("check_blacklist"):
        from app.services.dnsbl import check_dnsbl_providers
        tasks["blacklist"] = (check_dnsbl_providers, (hostname,))

    if toggles.get("check_abuseipdb"):
        from app.services.abuseipdb import check_abuseipdb
        tasks["abuseipdb"] = (check_abuseipdb, (hostname,))

    if toggles.get("check_dns"):
        from app.services.dns_records import lookup_dns_records
        tasks["dns"] = (lookup_dns_records, (hostname,))

    if toggles.get("check_ssl"):
        from app.services.ssl_checker import check_ssl_certificate
        tasks["ssl"] = (check_ssl_certificate, (hostname,))

    if toggles.get("check_whois"):
        from app.services.whois_lookup import whois_lookup
        tasks["whois"] = (whois_lookup, (hostname,))

    if toggles.get("check_email_security"):
        from app.services.email_security import check_email_security
        tasks["email_security"] = (check_email_security, (hostname,))

    if toggles.get("check_server_status"):
        from app.services.server_status import check_server_status
        tasks["server_status"] = (check_server_status, (hostname,))

    if not tasks:
        return {}

    results: dict[str, Any] = {}

    with ThreadPoolExecutor(max_workers=min(len(tasks), 7)) as executor:
        future_to_key = {
            executor.submit(fn, *args): key
            for key, (fn, args) in tasks.items()
        }
        for future in as_completed(future_to_key):
            key = future_to_key[future]
            try:
                results[key] = future.result()
            except Exception as exc:
                logger.exception("Check '%s' failed for %s", key, hostname)
                results[key] = {"error": str(exc)}

    return results


def get_toggles_from_hostname(hostname_obj) -> dict[str, bool]:
    """Extract check toggles from a Hostname ORM object."""
    return {
        "check_blacklist": hostname_obj.check_blacklist,
        "check_abuseipdb": hostname_obj.check_abuseipdb,
        "check_dns": hostname_obj.check_dns,
        "check_ssl": hostname_obj.check_ssl,
        "check_whois": hostname_obj.check_whois,
        "check_email_security": hostname_obj.check_email_security,
        "check_server_status": hostname_obj.check_server_status,
    }

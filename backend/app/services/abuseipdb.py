import ipaddress
from typing import Any

import requests

from app.core.config import settings
from app.core.hosts import extract_host
from app.core.network_safety import resolve_public_address


def _extract_ip(value: str) -> str | None:
    """The public address AbuseIPDB should be asked about, of either family.

    AbuseIPDB is asked *about* the address and never connects to it, so an
    IPv6-only host is looked up even where this machine has no IPv6 route.
    """
    target = extract_host(value)
    if not target:
        return None

    try:
        ip = ipaddress.ip_address(target)
        return str(ip) if ip.is_global else None
    except ValueError:
        pass

    try:
        return resolve_public_address(target, connect=False)
    except ValueError:
        return None


def check_abuseipdb(hostname_or_ip: str, max_age_in_days: int = 90) -> dict[str, Any]:
    api_key = settings.abuseipdb_api_key
    if not api_key:
        return {"error": "AbuseIPDB API key is not configured. Set ABUSEIPDB_API_KEY."}

    ip = _extract_ip(hostname_or_ip)
    if not ip:
        return {"error": "Unable to resolve hostname to a public IP address."}

    try:
        resp = requests.get(
            "https://api.abuseipdb.com/api/v2/check",
            headers={"Key": api_key, "Accept": "application/json"},
            params={"ipAddress": ip, "maxAgeInDays": max_age_in_days, "verbose": ""},
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json().get("data", {})
        return {
            "ip": ip,
            "query": hostname_or_ip,
            "is_public": data.get("isPublic"),
            "abuse_confidence_score": data.get("abuseConfidenceScore"),
            "country_code": data.get("countryCode"),
            "isp": data.get("isp"),
            "domain": data.get("domain"),
            "total_reports": data.get("totalReports"),
            "last_reported_at": data.get("lastReportedAt"),
            "usage_type": data.get("usageType"),
            "is_whitelisted": data.get("isWhitelisted"),
            "num_distinct_users": data.get("numDistinctUsers"),
        }
    except requests.exceptions.HTTPError as exc:
        status = exc.response.status_code if exc.response is not None else 0
        if status == 401:
            return {"error": "Invalid AbuseIPDB API key."}
        if status == 422:
            return {"error": "Invalid IP address for AbuseIPDB lookup."}
        if status == 429:
            return {"error": "AbuseIPDB rate limit exceeded. Try again later."}
        return {"error": f"AbuseIPDB API error (HTTP {status})."}
    except requests.exceptions.RequestException:
        return {"error": "Failed to connect to AbuseIPDB API."}

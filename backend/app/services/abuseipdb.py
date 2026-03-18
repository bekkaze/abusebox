import ipaddress
import socket
from typing import Any
from urllib.parse import urlparse

import requests

from app.core.config import settings


def _extract_ip(value: str) -> str | None:
    """Resolve a hostname/URL/IP to an IPv4 address."""
    target = (value or "").strip()
    if not target:
        return None

    if "://" in target:
        parsed = urlparse(target)
        target = parsed.hostname or ""
    elif "/" in target:
        parsed = urlparse(f"//{target}", scheme="http")
        target = parsed.hostname or target.split("/", 1)[0]

    if ":" in target and target.count(":") == 1:
        host, port = target.rsplit(":", 1)
        if port.isdigit():
            target = host
    target = target.strip()
    if not target:
        return None

    try:
        return str(ipaddress.IPv4Address(target))
    except ipaddress.AddressValueError:
        pass

    try:
        return socket.gethostbyname(target)
    except (socket.gaierror, socket.timeout):
        return None


def check_abuseipdb(hostname_or_ip: str, max_age_in_days: int = 90) -> dict[str, Any]:
    api_key = settings.abuseipdb_api_key
    if not api_key:
        return {"error": "AbuseIPDB API key is not configured. Set ABUSEIPDB_API_KEY."}

    ip = _extract_ip(hostname_or_ip)
    if not ip:
        return {"error": "Unable to resolve hostname to IPv4 address."}

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

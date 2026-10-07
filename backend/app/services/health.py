"""Turn raw check results into a compact health summary with actionable issues.

The dashboard's "Needs attention" list, asset badges, events and alerts all
read from these helpers so they agree on what counts as a problem.
"""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any

from app.core.timeutil import as_utc

SEVERITY_ORDER = {"critical": 0, "warning": 1, "info": 2}

CHECK_KEYS = ("blacklist", "abuseipdb", "dns", "ssl", "whois", "email_security", "server_status")


def split_result(result: dict | None) -> dict[str, Any]:
    """Results are keyed by check name; results saved before v1.1 are a flat DNSBL payload."""
    if not result:
        return {}
    if any(key in result for key in CHECK_KEYS):
        return result
    if "detected_on" in result or "providers" in result:
        return {"blacklist": result}
    return {}


def blacklist_state(result: dict | None) -> dict | None:
    """Usable DNSBL outcome, or None if the check didn't run or errored."""
    bl = split_result(result).get("blacklist")
    if not isinstance(bl, dict) or bl.get("error"):
        return None
    return {
        "listed": sorted(d.get("provider") for d in bl.get("detected_on", []) if d.get("provider")),
        "total": len(bl.get("providers", [])),
        "failed": len(bl.get("failed_providers", [])),
        "inconclusive": bool(bl.get("is_inconclusive")),
    }


def ssl_state(result: dict | None) -> dict | None:
    ssl = split_result(result).get("ssl")
    if not isinstance(ssl, dict) or "valid" not in ssl:
        return None
    return {"valid": bool(ssl.get("valid")), "days_remaining": ssl.get("days_remaining"), "error": ssl.get("error")}


def server_state(result: dict | None) -> dict | None:
    server = split_result(result).get("server_status")
    if not isinstance(server, dict) or server.get("error") or "is_up" not in server:
        return None
    return {
        "up": bool(server.get("is_up")),
        "status_code": server.get("status_code"),
        "response_time_ms": server.get("response_time_ms"),
        "reason": server.get("reason"),
    }


_WHOIS_DATE_FORMATS = ("%Y-%m-%d", "%d-%b-%Y", "%Y.%m.%d", "%d.%m.%Y", "%Y/%m/%d", "%d/%m/%Y")


def _parse_whois_date(value: Any) -> datetime | None:
    if isinstance(value, list):
        value = value[0] if value else None
    if not isinstance(value, str) or not value.strip():
        return None
    text = value.strip()
    iso = text.replace("Z", "+00:00")
    try:
        return as_utc(datetime.fromisoformat(iso))
    except ValueError:
        pass
    # Drop trailing time/zone noise like "2028-10-09 18:20:50 UTC" or "(...)".
    head = re.split(r"[ T(]", text, maxsplit=1)[0]
    for fmt in _WHOIS_DATE_FORMATS:
        try:
            return datetime.strptime(head, fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    return None


def domain_expiry_days(result: dict | None, now: datetime | None = None) -> int | None:
    whois = split_result(result).get("whois")
    if not isinstance(whois, dict) or whois.get("error"):
        return None
    expiry = _parse_whois_date(whois.get("expiry_date"))
    if expiry is None:
        return None
    return (expiry - (now or datetime.now(timezone.utc))).days


def summarize(
    hostname,
    result: dict | None,
    *,
    ssl_warning_days: int = 14,
    domain_warning_days: int = 30,
    global_interval_minutes: int | None = None,
    scheduler_enabled: bool = True,
    now: datetime | None = None,
) -> dict[str, Any]:
    """Compact health for one asset: per-check status plus a list of issues."""
    now = now or datetime.now(timezone.utc)
    parts = split_result(result)
    issues: list[dict[str, str]] = []
    health: dict[str, Any] = {}

    def issue(kind: str, severity: str, message: str) -> None:
        issues.append({"kind": kind, "severity": severity, "message": message})

    bl = blacklist_state(result)
    if bl is not None:
        health["blacklist"] = {**bl, "listed_count": len(bl["listed"])}
        if bl["listed"]:
            issue("blacklist", "critical", f"Listed on {len(bl['listed'])} of {bl['total']} blacklists")
        elif bl["inconclusive"]:
            issue("blacklist", "warning", f"Blacklist result inconclusive ({bl['failed']} providers did not answer)")
    elif isinstance(parts.get("blacklist"), dict):
        issue("blacklist", "warning", f"Blacklist check failed: {parts['blacklist'].get('error')}")

    ssl = ssl_state(result)
    if ssl is not None:
        health["ssl"] = ssl
        days = ssl["days_remaining"]
        if not ssl["valid"]:
            issue("ssl", "critical", "SSL certificate is invalid or expired")
        elif ssl_warning_days and isinstance(days, int) and days <= ssl_warning_days:
            issue("ssl", "critical" if days <= 3 else "warning", f"SSL certificate expires in {days} day{'s' if days != 1 else ''}")
    elif isinstance(parts.get("ssl"), dict) and parts["ssl"].get("error"):
        issue("ssl", "warning", f"SSL check failed: {parts['ssl']['error']}")

    expiry_days = domain_expiry_days(result, now)
    if expiry_days is not None:
        health["domain_expiry_days"] = expiry_days
        if expiry_days < 0:
            issue("domain", "critical", "Domain registration has expired")
        elif domain_warning_days and expiry_days <= domain_warning_days:
            issue("domain", "critical" if expiry_days <= 7 else "warning", f"Domain expires in {expiry_days} day{'s' if expiry_days != 1 else ''}")

    server = server_state(result)
    if server is not None:
        health["server"] = server
        if not server["up"] and "SSL" in (server.get("reason") or ""):
            # The host answers, but browsers reject its certificate.
            issue("server", "critical", "HTTPS requests fail because of the certificate")
        elif not server["up"]:
            issue("server", "critical", f"Server is down{': ' + server['reason'] if server.get('reason') else ''}")
        elif isinstance(server.get("status_code"), int) and server["status_code"] >= 500:
            issue("server", "warning", f"Server responds with HTTP {server['status_code']}")

    email = parts.get("email_security")
    if isinstance(email, dict) and not email.get("error") and email.get("grade"):
        health["email_grade"] = email["grade"]
        if email["grade"] in ("D", "F"):
            issue("email", "warning", f"Email security grade {email['grade']} (SPF/DKIM/DMARC)")

    abuse = parts.get("abuseipdb")
    if isinstance(abuse, dict) and isinstance(abuse.get("abuse_confidence_score"), int):
        score = abuse["abuse_confidence_score"]
        health["abuse_score"] = score
        if score >= 75:
            issue("abuseipdb", "critical", f"AbuseIPDB confidence score {score}%")
        elif score >= 25:
            issue("abuseipdb", "warning", f"AbuseIPDB confidence score {score}%")

    if getattr(hostname, "is_monitor_enabled", False) and scheduler_enabled and global_interval_minutes:
        last = as_utc(getattr(hostname, "last_checked", None))
        interval = getattr(hostname, "check_interval_minutes", None) or global_interval_minutes
        if last is None:
            issue("monitoring", "info", "Waiting for the first scheduled check")
        elif (now - last).total_seconds() > (interval * 2 + 10) * 60:
            hours = int((now - last).total_seconds() // 3600)
            issue("monitoring", "warning", f"Scheduled check overdue (last checked {hours} h ago)")

    issues.sort(key=lambda item: SEVERITY_ORDER.get(item["severity"], 9))
    health["issues"] = issues
    health["status"] = issues[0]["severity"] if issues else "ok"
    return health

"""Turn raw check results into a compact health summary with actionable issues.

The dashboard's "Needs attention" list, asset badges, events and alerts all
read from these helpers so they agree on what counts as a problem.
"""

from __future__ import annotations

import re
from datetime import UTC, datetime
from typing import Any

from app.core.timeutil import as_utc
from app.schemas.hostname import MIN_CHECK_INTERVAL_MINUTES
from app.services.risk import risk_score

SEVERITY_ORDER = {"critical": 0, "warning": 1, "info": 2}

CHECK_KEYS = ("blacklist", "abuseipdb", "dns", "ssl", "whois", "email_security", "server_status", "mail_server")


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
    detected = [d for d in bl.get("detected_on", []) if d.get("provider")]
    # How many listings at each severity, not just how many listings. The
    # severity comes from the list's own documented return codes, so being on
    # Spamhaus and being on UCEPROTECT level 1 stop counting the same. The risk
    # score reads this; results stored before it existed have no severities and
    # fall back to counting.
    severities: dict[str, int] = {}
    for entry in detected:
        severity = entry.get("severity")
        if severity:
            severities[severity] = severities.get(severity, 0) + 1
    return {
        "listed": sorted(d["provider"] for d in detected),
        "listed_severities": severities,
        "providers": sorted(bl.get("providers", [])),
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
            return datetime.strptime(head, fmt).replace(tzinfo=UTC)
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
    return (expiry - (now or datetime.now(UTC))).days


def mail_issues(mail: Any, health: dict, issue, ssl_warning_days: int) -> None:
    """Mail-server findings, raised only for a host that answered on port 25.

    The check is on by default for every new IP address, most of which are
    not mail servers. A web server with no PTR and nothing on port 25 is
    normal, so none of this is an issue until the host has shown it handles
    mail. A port that did not answer is never one either: from here that may
    be a filter on this side (see mail_server.py).
    """
    if not isinstance(mail, dict) or mail.get("error"):
        return
    smtp = mail.get("smtp") or {}
    rdns = mail.get("reverse_dns") or {}
    health["mail"] = {
        "smtp": smtp.get("state"),
        "starttls": smtp.get("starttls"),
        "fcrdns": rdns.get("forward_confirmed"),
        "ptr": (rdns.get("ptr") or [None])[0],
    }
    if smtp.get("state") != "answered" or smtp.get("code") != 220:
        return

    if rdns.get("ptr") == []:
        issue("mail", "warning", "Mail server has no reverse DNS")
    elif rdns.get("forward_confirmed") is False:
        issue("mail", "warning", "Mail server's reverse DNS does not point back to its address")
    if smtp.get("greeting_matches_ptr") is False:
        greets_as = smtp.get("banner_host") or smtp.get("ehlo_host")
        issue("mail", "warning", f"Mail server greets as {greets_as}, not as its reverse DNS name")
    if smtp.get("starttls") is False:
        issue("mail", "warning", "Mail server does not offer STARTTLS")
    tls = smtp.get("tls") or {}
    days = tls.get("days_remaining")
    if tls.get("ok") is False and tls.get("error"):
        issue("mail", "warning", f"Mail server TLS failed: {tls['error']}")
    elif tls.get("ok") and isinstance(days, int) and ssl_warning_days and days <= ssl_warning_days:
        issue("mail", "critical" if days <= 3 else "warning",
              f"Mail server certificate expires in {days} day{'s' if days != 1 else ''}")


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
    now = now or datetime.now(UTC)
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

    whois = parts.get("whois")
    if isinstance(whois, dict) and whois.get("error"):
        # The service's own errors already start with "WHOIS ...".
        detail = str(whois["error"])
        issue("whois", "warning", detail if detail.lower().startswith("whois") else f"WHOIS check failed: {detail}")

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

    mail_issues(parts.get("mail_server"), health, issue, ssl_warning_days)

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
        own_interval = getattr(hostname, "check_interval_minutes", None)
        # Same clamp as scheduler._is_asset_due: releases before 1.3.2 stored
        # any number here, and a negative one made this warning always fire.
        interval = max(own_interval, MIN_CHECK_INTERVAL_MINUTES) if own_interval else global_interval_minutes
        if last is None:
            issue("monitoring", "info", "Waiting for the first scheduled check")
        elif (now - last).total_seconds() > (interval * 2 + 10) * 60:
            hours = int((now - last).total_seconds() // 3600)
            issue("monitoring", "warning", f"Scheduled check overdue (last checked {hours} h ago)")

    issues.sort(key=lambda item: SEVERITY_ORDER.get(item["severity"], 9))
    health["issues"] = issues
    health["status"] = issues[0]["severity"] if issues else "ok"
    # Derived from the findings above, so it cannot drift from them. See risk.py
    # for the weights, and for what the number is not.
    health["risk"] = risk_score(health)
    return health

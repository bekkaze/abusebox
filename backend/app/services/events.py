"""Detect state changes between two checks of the same asset.

Only *transitions* become events (newly listed, delisted, server went down,
certificate crossed the warning threshold...), so a long outage produces one
event instead of one per check.
"""

from __future__ import annotations

from typing import Any

from app.services.health import blacklist_state, domain_expiry_days, server_state, ssl_state

# Event types and whether an alert can be sent for them.
EVENT_TYPES = {
    "blacklist.listed": "Newly listed on one or more blacklists",
    "blacklist.delisted": "No longer listed on any blacklist",
    "blacklist.changed": "Still listed, but on different blacklists",
    "server.down": "Server stopped responding",
    "server.up": "Server is responding again",
    "ssl.expiring": "Certificate is close to expiry",
    "ssl.invalid": "Certificate became invalid or expired",
    "ssl.renewed": "Certificate is valid again",
    "domain.expiring": "Domain registration is close to expiry",
}


def _plural(count: int, word: str) -> str:
    return f"{count} {word}{'' if count == 1 else 's'}"


def _event(event_type: str, severity: str, title: str, **details: Any) -> dict[str, Any]:
    return {"event_type": event_type, "severity": severity, "title": title, "details": details or None}


def detect_events(
    previous: dict | None,
    current: dict | None,
    *,
    was_blacklisted: bool,
    is_blacklisted: bool,
    ssl_warning_days: int = 14,
    domain_warning_days: int = 30,
) -> list[dict[str, Any]]:
    """Events for the change from *previous* to *current* (both raw check results).

    With no previous result (first check), only problems are reported, so a new
    asset that is already listed or down still shows up in the activity log.
    """
    events: list[dict[str, Any]] = []
    first_check = previous is None

    # --- Blacklists (uses the persisted status so inconclusive runs don't flap) ---
    new_bl = blacklist_state(current)
    old_bl = blacklist_state(previous)
    if new_bl is not None and not new_bl["inconclusive"]:
        new_set = set(new_bl["listed"])
        old_set = set(old_bl["listed"]) if old_bl else set()
        if is_blacklisted and not was_blacklisted:
            events.append(_event(
                "blacklist.listed", "critical",
                f"Listed on {_plural(len(new_set), 'blacklist')}",
                providers=sorted(new_set), added=sorted(new_set - old_set) or sorted(new_set), total=new_bl["total"],
            ))
        elif was_blacklisted and not is_blacklisted:
            events.append(_event(
                "blacklist.delisted", "success", "No longer listed on any blacklist",
                removed=sorted(old_set),
            ))
        elif is_blacklisted and old_bl is not None and new_set != old_set:
            added, removed = sorted(new_set - old_set), sorted(old_set - new_set)
            if added:
                events.append(_event(
                    "blacklist.listed", "critical",
                    f"Newly listed on {', '.join(added[:3])}{'…' if len(added) > 3 else ''}",
                    providers=sorted(new_set), added=added, removed=removed, total=new_bl["total"],
                ))
            else:
                events.append(_event(
                    "blacklist.changed", "info",
                    f"Removed from {_plural(len(removed), 'blacklist')}, still listed on {len(new_set)}",
                    providers=sorted(new_set), removed=removed, total=new_bl["total"],
                ))

    # --- Server status ---
    new_server, old_server = server_state(current), server_state(previous)
    if new_server is not None:
        was_up = old_server["up"] if old_server else True
        if not new_server["up"] and (was_up or first_check):
            reason = new_server.get("reason") or ""
            title = "HTTPS requests fail (certificate error)" if "SSL" in reason else "Server is down"
            events.append(_event("server.down", "critical", title, reason=reason or None))
        elif new_server["up"] and old_server is not None and not old_server["up"]:
            events.append(_event("server.up", "success", "Server is up again",
                                 status_code=new_server.get("status_code"), response_time_ms=new_server.get("response_time_ms")))

    # --- SSL certificate ---
    new_ssl, old_ssl = ssl_state(current), ssl_state(previous)
    if new_ssl is not None:
        def expiring(state: dict | None) -> bool:
            days = state.get("days_remaining") if state else None
            return bool(state and state["valid"] and ssl_warning_days and isinstance(days, int) and days <= ssl_warning_days)

        if not new_ssl["valid"] and (old_ssl is None or old_ssl["valid"]):
            events.append(_event("ssl.invalid", "critical", "SSL certificate is invalid or expired", error=new_ssl.get("error")))
        elif expiring(new_ssl) and not expiring(old_ssl):
            days = new_ssl["days_remaining"]
            events.append(_event("ssl.expiring", "warning", f"SSL certificate expires in {_plural(days, 'day')}", days_remaining=days))
        elif old_ssl is not None and (not old_ssl["valid"] or expiring(old_ssl)) and new_ssl["valid"] and not expiring(new_ssl):
            events.append(_event("ssl.renewed", "success", "SSL certificate renewed", days_remaining=new_ssl.get("days_remaining")))

    # --- Domain registration ---
    new_days, old_days = domain_expiry_days(current), domain_expiry_days(previous)
    if new_days is not None and domain_warning_days:
        crossing = new_days <= domain_warning_days and (old_days is None or old_days > domain_warning_days)
        if crossing:
            title = "Domain registration has expired" if new_days < 0 else f"Domain expires in {_plural(new_days, 'day')}"
            events.append(_event("domain.expiring", "critical" if new_days <= 7 else "warning", title, days_remaining=new_days))

    return events

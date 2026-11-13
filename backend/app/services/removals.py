"""Removal requests: what was asked, on what evidence, and whether it held.

Before 1.6 a request was a "requested" flag on one check's result, which the
next check rebuilt as "open", and nothing recorded whether the removal stuck.
A request is now its own row, followed by every check after it:

    requested  waiting for the list
    cleared    the list stopped listing the asset; watched for RELIST_WINDOW
    held       cleared, and stayed clear for the whole window
    relisted   listed again inside the window

Relisting is the strongest evidence AbuseBox can have that a cause was not
fixed, so it is kept and shown rather than folded into a new listing.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy.orm import Session

from app.core.timeutil import as_utc
from app.models import CheckHistory, Hostname, RemovalRequest
from app.services.causes import assess_listing, signals_from, verify
from app.services.dnsbl import describe_listing
from app.services.health import split_result

RELIST_WINDOW = timedelta(days=30)
# How far back "first seen" and "fixed since" look. At the default 6-hour
# interval that is fifty days.
_HISTORY_SCAN = 200
_TEXT_LIMIT = 500


def _now() -> datetime:
    return datetime.now(UTC)


def _iso(value: datetime | None) -> str | None:
    value = as_utc(value)
    return value.isoformat() if value else None


def _stamp(value: datetime | None) -> str:
    value = as_utc(value)
    return value.strftime("%Y-%m-%d %H:%M UTC") if value else "unknown"


def _blacklist(result: dict | None) -> dict:
    part = split_result(result).get("blacklist")
    return part if isinstance(part, dict) and not part.get("error") else {}


def _answered(blacklist: dict) -> set[str]:
    """Lists that gave a usable answer in this check."""
    return set(blacklist.get("providers") or []) - set(blacklist.get("failed_providers") or [])


# --- state -------------------------------------------------------------------------

def request_state(request: RemovalRequest, now: datetime | None = None) -> str:
    now = now or _now()
    if request.relisted_at:
        return "relisted"
    cleared = as_utc(request.cleared_at)
    if cleared:
        return "held" if now - cleared >= RELIST_WINDOW else "cleared"
    return "requested"


def serialize(request: RemovalRequest, now: datetime | None = None) -> dict[str, Any]:
    described = describe_listing(request.provider, request.codes or [])
    requested = as_utc(request.requested_at)
    cleared = as_utc(request.cleared_at)
    return {
        "id": request.id,
        "provider": request.provider,
        "name": described["name"],
        "state": request_state(request, now),
        "requested_at": _iso(requested),
        "cleared_at": _iso(cleared),
        "relisted_at": _iso(request.relisted_at),
        "hours_to_clear": round((cleared - requested).total_seconds() / 3600, 1) if cleared and requested else None,
        "readiness": request.readiness,
        "fixed": request.fixed,
        "evidence": request.evidence,
        "note": request.note,
        "override_reason": request.override_reason,
    }


# --- recording and following ---------------------------------------------------------

def record_request(
    db: Session,
    hostname: Hostname,
    check: CheckHistory,
    provider: str,
    *,
    note: str | None = None,
    override_reason: str | None = None,
) -> RemovalRequest | None:
    """A request for *provider*, with the verdict *check* supported at the time.

    Returns None when *check* does not list the asset on *provider*. The caller
    commits.
    """
    entry = next((item for item in _blacklist(check.result).get("detected_on") or []
                  if item.get("provider") == provider), None)
    if entry is None:
        return None
    assessment = assess_listing(entry, signals_from(check.result))
    request = RemovalRequest(
        hostname_id=hostname.id,
        check_id=check.id,
        provider=provider,
        codes=list(entry.get("codes") or []),
        causes=assessment["causes"],
        readiness=assessment["readiness"],
        fixed=assessment["fixed"],
        evidence=(assessment["evidence"] or "")[:_TEXT_LIMIT] or None,
        note=(note or "").strip()[:_TEXT_LIMIT] or None,
        override_reason=(override_reason or "").strip()[:_TEXT_LIMIT] or None,
        requested_at=_now(),
    )
    db.add(request)
    return request


def track_requests(db: Session, hostname: Hostname, result: dict | None, now: datetime | None = None) -> None:
    """Move every open request on according to *result*, a check about to be saved.

    Also marks a listing that is still waiting on a request as "requested" in
    *result* itself, so the status survives into the next check instead of
    being rebuilt as "open". The caller commits.
    """
    now = now or _now()
    blacklist = _blacklist(result)
    if not blacklist:
        return  # no usable blacklist answer: nothing can be concluded
    listed = {item.get("provider"): item for item in blacklist.get("detected_on") or []}
    answered = _answered(blacklist)
    conclusive = not blacklist.get("is_inconclusive")

    open_requests = (
        db.query(RemovalRequest)
        .filter(RemovalRequest.hostname_id == hostname.id, RemovalRequest.relisted_at.is_(None))
        .order_by(RemovalRequest.requested_at)
        .all()
    )
    for request in open_requests:
        cleared = as_utc(request.cleared_at)
        if cleared is None:
            if request.provider in listed:
                entry = listed[request.provider]
                entry["status"] = "requested"
                entry["requested_at"] = _iso(request.requested_at)
            elif conclusive and request.provider in answered:
                request.cleared_at = now
        elif now - cleared < RELIST_WINDOW and request.provider in listed:
            request.relisted_at = now


# --- what history says ----------------------------------------------------------------

def _recent_checks(db: Session, hostname_id: int) -> list[CheckHistory]:
    return (
        db.query(CheckHistory)
        .filter(CheckHistory.hostname_id == hostname_id)
        .order_by(CheckHistory.id.desc())
        .limit(_HISTORY_SCAN)
        .all()
    )


def first_seen(history: list[CheckHistory], provider: str) -> datetime | None:
    """When the current run of listings on *provider* began, newest first."""
    earliest = None
    for check in history:
        blacklist = _blacklist(check.result)
        if not blacklist:
            continue
        if any(item.get("provider") == provider for item in blacklist.get("detected_on") or []):
            earliest = check.created
        elif provider in _answered(blacklist):
            break  # it answered and did not list: this run starts after here
    return earliest


def fixed_since(history: list[CheckHistory], provider: str) -> datetime | None:
    """When a verifiable cause has been fixed since, without a break."""
    earliest = None
    for check in history:
        fixed = verify(provider, signals_from(check.result))
        if fixed is True:
            earliest = check.created
        elif fixed is False:
            break
    return earliest


# --- the request text -----------------------------------------------------------------

def request_text(
    hostname: Hostname,
    result: dict | None,
    entry: dict,
    assessment: dict,
    *,
    checked: datetime | None,
    seen: datetime | None,
    fixed_from: datetime | None,
) -> str:
    """A removal request to paste into the list's form, built only from what
    AbuseBox observed. The one part it cannot know, what was changed, is left
    as a gap for the operator rather than filled with something plausible."""
    parts = split_result(result)
    blacklist = _blacklist(result)
    address = blacklist.get("checked_address") or hostname.hostname
    target = address if address == hostname.hostname else f"{hostname.hostname} ({address})"
    described = describe_listing(entry.get("provider", ""), entry.get("codes") or [])
    codes = ", ".join(entry.get("codes") or [])

    lines = [f"Removal request for {target} on {assessment['name']} ({assessment['provider']})", ""]
    lines.append(f"Listed as: {'; '.join(described['meanings'])}" + (f" ({codes})" if codes else ""))
    if seen:
        lines.append(f"First seen listed: {_stamp(seen)}")
    lines.append(f"What the list says it lists for: {assessment['label'].lower()}. {assessment['means']}")

    facts = []
    if assessment["verifiable"] and assessment["evidence"]:
        facts.append(assessment["evidence"] + (f" In place since {_stamp(fixed_from)}." if fixed_from else ""))
    mail = parts.get("mail_server")
    if isinstance(mail, dict) and not mail.get("error"):
        reverse = mail.get("reverse_dns") or {}
        if reverse.get("forward_confirmed") and reverse.get("confirmed_name"):
            facts.append(f"Reverse DNS {reverse['confirmed_name']} points back to {address}.")
        smtp = mail.get("smtp") or {}
        greets_as = smtp.get("banner_host") or smtp.get("ehlo_host")
        if smtp.get("state") == "answered" and smtp.get("code") == 220 and greets_as:
            facts.append(f"The mail server greets as {greets_as}" + (" and offers STARTTLS." if smtp.get("starttls") else "."))
    listed = {item.get("provider") for item in blacklist.get("detected_on") or []}
    clean = len(_answered(blacklist) - listed)
    if clean:
        facts.append(f"Not listed on {clean} other blacklist{'s' if clean != 1 else ''} checked at the same time.")

    lines += ["", f"What AbuseBox confirms as of {_stamp(checked)}:"]
    lines += [f"- {fact}" for fact in facts] or ["- Nothing beyond the listing itself."]
    lines += ["", "What was changed:"]
    if assessment["verifiable"] and assessment["fixed"]:
        lines.append("- The condition this list names is fixed, as shown above.")
    else:
        lines.append("- [What you found and what you changed. AbuseBox cannot see this, so it has to come from you.]")
    return "\n".join(lines)


# --- one asset's listings, for the API ---------------------------------------------------

def listing_report(db: Session, hostname: Hostname, now: datetime | None = None) -> dict[str, Any]:
    """Every current listing with its cause, verdict, request and request text,
    plus every request this asset has had."""
    now = now or _now()
    history = _recent_checks(db, hostname.id)
    current = next((check for check in history if check.status == "current"), history[0] if history else None)
    result = current.result if current else None
    signals = signals_from(result)

    requests = (
        db.query(RemovalRequest)
        .filter(RemovalRequest.hostname_id == hostname.id)
        .order_by(RemovalRequest.requested_at.desc(), RemovalRequest.id.desc())
        .limit(100)
        .all()
    )
    latest_by_provider: dict[str, RemovalRequest] = {}
    for request in requests:
        latest_by_provider.setdefault(request.provider, request)

    listings = []
    for entry in _blacklist(result).get("detected_on") or []:
        provider = entry.get("provider", "")
        assessment = assess_listing(entry, signals)
        seen = first_seen(history, provider)
        fixed_from = fixed_since(history, provider) if assessment["verifiable"] and assessment["fixed"] else None
        request = latest_by_provider.get(provider)
        # A request only belongs to this listing while it is waiting, or when
        # the listing is the relisting it led to. A held one was a past episode.
        attached = request if request and request_state(request, now) in ("requested", "relisted") else None
        listings.append({
            **assessment,
            "codes": list(entry.get("codes") or []),
            "meanings": describe_listing(provider, entry.get("codes") or [])["meanings"],
            "severity": entry.get("severity"),
            "first_seen": _iso(seen),
            "fixed_since": _iso(fixed_from),
            "request": serialize(attached, now) if attached else None,
            "request_text": request_text(hostname, result, entry, assessment,
                                         checked=current.created if current else None,
                                         seen=seen, fixed_from=fixed_from),
        })

    return {
        "check_id": current.id if current else None,
        "checked": _iso(current.created) if current else None,
        "listings": listings,
        "requests": [serialize(request, now) for request in requests],
    }

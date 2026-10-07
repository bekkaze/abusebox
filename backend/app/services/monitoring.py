"""Saving check results, detecting events and alerting, in one place.

Used by the scheduler, manual re-checks, asset creation and bulk re-checks,
so they all update status, history, events and alerts the same way.
"""

from __future__ import annotations

import logging
import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models import AssetEvent, CheckHistory, Hostname, User
from app.services.app_settings import effective_webhook_url, get_app_settings
from app.services.check_runner import get_toggles_from_hostname, run_enabled_checks
from app.services.events import detect_events
from app.services.health import blacklist_state
from app.services.notifications import notify_events

logger = logging.getLogger(__name__)


def latest_check(db: Session, hostname_id: int) -> CheckHistory | None:
    return (
        db.query(CheckHistory)
        .filter(CheckHistory.hostname_id == hostname_id, CheckHistory.status == "current")
        .order_by(CheckHistory.id.desc())
        .first()
    )


def record_check(db: Session, hostname: Hostname, result: dict[str, Any], *, notify: bool = True) -> list[AssetEvent]:
    """Persist *result* as the asset's current check and log/alert any state change.

    Commits the session. Alerts are sent from a background thread so a slow SMTP
    server or webhook never delays the caller.
    """
    previous = latest_check(db, hostname.id)
    previous_result = previous.result if previous else None

    was_blacklisted = hostname.is_blacklisted
    bl = blacklist_state(result)
    # Errored or inconclusive DNSBL runs keep the previous status.
    if bl is not None and not bl["inconclusive"]:
        hostname.is_blacklisted = bool(bl["listed"])
    hostname.last_checked = datetime.now(timezone.utc)

    db.query(CheckHistory).filter(
        CheckHistory.hostname_id == hostname.id,
        CheckHistory.status == "current",
    ).update({"status": "historical"})
    check = CheckHistory(hostname_id=hostname.id, result=result, status="current")
    db.add(check)
    db.flush()

    prefs_row = get_app_settings(db)
    detected = detect_events(
        previous_result,
        result,
        was_blacklisted=was_blacklisted,
        is_blacklisted=hostname.is_blacklisted,
        ssl_warning_days=prefs_row.ssl_expiry_warning_days,
        domain_warning_days=prefs_row.domain_expiry_warning_days,
    )
    rows = [AssetEvent(hostname_id=hostname.id, check_id=check.id, **event) for event in detected]
    db.add_all(rows)
    db.commit()

    if notify and detected and hostname.is_alert_enabled:
        user = db.get(User, hostname.user_id)
        prefs = {
            "notify_on_delisted": prefs_row.notify_on_delisted,
            "notify_on_server_down": prefs_row.notify_on_server_down,
            "ssl_expiry_warning_days": prefs_row.ssl_expiry_warning_days,
            "domain_expiry_warning_days": prefs_row.domain_expiry_warning_days,
        }
        raw_bl = (result.get("blacklist") or {}) if isinstance(result, dict) else {}
        threading.Thread(
            target=_safe_notify,
            kwargs={
                "hostname": hostname.hostname,
                "ip": raw_bl.get("hostname", hostname.hostname),
                "events": detected,
                "user_email": user.email if user else None,
                "webhook_url": effective_webhook_url(prefs_row),
                "prefs": prefs,
            },
            daemon=True,
            name="abusebox-notify",
        ).start()

    return rows


def _safe_notify(**kwargs: Any) -> None:
    try:
        notify_events(**kwargs)
    except Exception:  # noqa: BLE001 - never let alerting crash a worker thread
        logger.exception("Failed to send notifications for %s", kwargs.get("hostname"))


# --- Background re-checks (bulk "Re-check" action) ---------------------------

_recheck_pool = ThreadPoolExecutor(max_workers=4, thread_name_prefix="abusebox-recheck")
_queued: set[int] = set()
_queued_lock = threading.Lock()


def queued_recheck_ids() -> set[int]:
    with _queued_lock:
        return set(_queued)


def queue_rechecks(hostname_ids: list[int]) -> int:
    """Re-check assets in the background. Returns how many were newly queued."""
    added = 0
    with _queued_lock:
        for hostname_id in hostname_ids:
            if hostname_id in _queued:
                continue
            _queued.add(hostname_id)
            _recheck_pool.submit(_recheck_one, hostname_id)
            added += 1
    return added


def _recheck_one(hostname_id: int) -> None:
    db = SessionLocal()
    try:
        hostname = db.get(Hostname, hostname_id)
        if hostname is None:
            return
        result = run_enabled_checks(hostname.hostname, get_toggles_from_hostname(hostname))
        if result:
            record_check(db, hostname, result)
    except Exception:  # noqa: BLE001
        db.rollback()
        logger.exception("Background re-check failed for hostname id %s", hostname_id)
    finally:
        db.close()
        with _queued_lock:
            _queued.discard(hostname_id)


# --- Retention ----------------------------------------------------------------

def prune_history(db: Session, retention_days: int) -> dict[str, int]:
    """Delete historical checks and events older than *retention_days* (0 = keep all).

    The current result of every asset is always kept.
    """
    if not retention_days or retention_days <= 0:
        return {"checks": 0, "events": 0}
    # Stored timestamps are naive UTC (SQLite), so compare against naive UTC.
    cutoff = (datetime.now(timezone.utc) - timedelta(days=retention_days)).replace(tzinfo=None)
    checks = (
        db.query(CheckHistory)
        .filter(CheckHistory.status == "historical", CheckHistory.created < cutoff)
        .delete(synchronize_session=False)
    )
    events = db.query(AssetEvent).filter(AssetEvent.created < cutoff).delete(synchronize_session=False)
    db.commit()
    if checks or events:
        logger.info("Pruned %s old checks and %s old events (older than %s days)", checks, events, retention_days)
    return {"checks": checks, "events": events}

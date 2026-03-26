import logging
import threading
import time
from datetime import datetime, timezone

from app.db.session import SessionLocal
from app.models import AppSettings, CheckHistory, Hostname, User
from app.services.check_runner import get_toggles_from_hostname, run_enabled_checks
from app.services.notifications import notify_blacklist_detected

logger = logging.getLogger(__name__)

_scheduler_thread: threading.Thread | None = None
_stop_event = threading.Event()
_current_interval: int = 360  # minutes, updated at runtime

# Check every 60 seconds if any asset is due for a check
_POLL_INTERVAL_SECONDS = 60


def _is_asset_due(hostname: Hostname, global_interval_minutes: int) -> bool:
    """Check if an asset is due for a scheduled check."""
    if not hostname.last_checked:
        return True
    interval = hostname.check_interval_minutes or global_interval_minutes
    elapsed = (datetime.now(timezone.utc) - hostname.last_checked).total_seconds()
    return elapsed >= interval * 60


def _get_global_interval(db) -> int:
    """Read the scheduler interval from DB settings, falling back to env config."""
    row = db.query(AppSettings).filter(AppSettings.id == 1).first()
    if row:
        return row.scheduler_interval_minutes
    from app.core.config import settings
    return settings.scheduler_interval_minutes


def _run_scheduled_checks() -> None:
    while not _stop_event.is_set():
        _stop_event.wait(_POLL_INTERVAL_SECONDS)
        if _stop_event.is_set():
            break

        db = SessionLocal()
        try:
            global_interval = _get_global_interval(db)

            hostnames = (
                db.query(Hostname)
                .filter(
                    Hostname.is_monitor_enabled == True,
                    Hostname.status == "active",
                )
                .all()
            )

            for hostname in hostnames:
                if _stop_event.is_set():
                    break
                if not _is_asset_due(hostname, global_interval):
                    continue

                try:
                    toggles = get_toggles_from_hostname(hostname)
                    result = run_enabled_checks(hostname.hostname, toggles)
                    if not result:
                        continue

                    was_blacklisted = hostname.is_blacklisted
                    bl = result.get("blacklist", {})
                    is_blacklisted = bool(bl.get("is_blacklisted", False)) if bl and not bl.get("error") else was_blacklisted
                    hostname.is_blacklisted = is_blacklisted
                    hostname.last_checked = datetime.now(timezone.utc)

                    # Mark old checks as historical
                    db.query(CheckHistory).filter(
                        CheckHistory.hostname_id == hostname.id,
                        CheckHistory.status == "current",
                    ).update({"status": "historical"})

                    db.add(CheckHistory(
                        hostname_id=hostname.id,
                        result=result,
                        status="current",
                    ))

                    # Alert if newly blacklisted
                    if is_blacklisted and not was_blacklisted and hostname.is_alert_enabled:
                        user = db.query(User).filter(User.id == hostname.user_id).first()
                        providers = [d["provider"] for d in bl.get("detected_on", [])]
                        notify_blacklist_detected(
                            hostname=hostname.hostname,
                            ip=bl.get("hostname", hostname.hostname),
                            providers=providers,
                            user_email=user.email if user else None,
                        )

                    db.commit()
                    logger.info("Checked %s: blacklisted=%s, interval=%s min",
                                hostname.hostname, is_blacklisted,
                                hostname.check_interval_minutes or global_interval)
                except Exception:
                    db.rollback()
                    logger.exception("Error checking hostname %s", hostname.hostname)

        except Exception:
            logger.exception("Scheduler error during check cycle")
        finally:
            db.close()


def start_scheduler(interval_minutes: int | None = None) -> None:
    global _scheduler_thread, _current_interval

    if interval_minutes is None:
        from app.core.config import settings
        # Try to read from DB first
        db = SessionLocal()
        try:
            row = db.query(AppSettings).filter(AppSettings.id == 1).first()
            if row:
                if not row.scheduler_enabled:
                    logger.info("Scheduler disabled via DB settings.")
                    return
                interval_minutes = row.scheduler_interval_minutes
            else:
                if not settings.scheduler_enabled:
                    logger.info("Scheduler disabled via env config.")
                    return
                interval_minutes = settings.scheduler_interval_minutes
        finally:
            db.close()

    _current_interval = interval_minutes

    if _scheduler_thread and _scheduler_thread.is_alive():
        logger.warning("Scheduler already running.")
        return

    _stop_event.clear()
    _scheduler_thread = threading.Thread(target=_run_scheduled_checks, daemon=True, name="abusebox-scheduler")
    _scheduler_thread.start()
    logger.info("Scheduler started (global interval=%d min, polling every %ds)", _current_interval, _POLL_INTERVAL_SECONDS)


def stop_scheduler() -> None:
    _stop_event.set()
    if _scheduler_thread:
        _scheduler_thread.join(timeout=5)
    logger.info("Scheduler stopped.")


def restart_scheduler(interval_minutes: int) -> None:
    stop_scheduler()
    _stop_event.clear()
    start_scheduler(interval_minutes)

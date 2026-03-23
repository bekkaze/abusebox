import logging
import threading
import time
from datetime import datetime, timezone

from app.core.config import settings
from app.db.session import SessionLocal
from app.models import CheckHistory, Hostname, User
from app.services.check_runner import get_toggles_from_hostname, run_enabled_checks
from app.services.notifications import notify_blacklist_detected

logger = logging.getLogger(__name__)

_scheduler_thread: threading.Thread | None = None
_stop_event = threading.Event()


def _run_scheduled_checks() -> None:
    while not _stop_event.is_set():
        interval = settings.scheduler_interval_minutes * 60
        _stop_event.wait(interval)
        if _stop_event.is_set():
            break

        logger.info("Scheduler: running periodic checks")
        db = SessionLocal()
        try:
            hostnames = (
                db.query(Hostname)
                .filter(
                    Hostname.is_monitor_enabled == True,
                    Hostname.status == "active",
                )
                .all()
            )

            for hostname in hostnames:
                try:
                    toggles = get_toggles_from_hostname(hostname)
                    result = run_enabled_checks(hostname.hostname, toggles)
                    if not result:
                        continue

                    was_blacklisted = hostname.is_blacklisted
                    bl = result.get("blacklist", {})
                    is_blacklisted = bool(bl.get("is_blacklisted", False)) if bl and not bl.get("error") else was_blacklisted
                    hostname.is_blacklisted = is_blacklisted

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
                    logger.info("Checked %s: blacklisted=%s, checks=%s", hostname.hostname, is_blacklisted, list(result.keys()))
                except Exception:
                    db.rollback()
                    logger.exception("Error checking hostname %s", hostname.hostname)

        except Exception:
            logger.exception("Scheduler error during check cycle")
        finally:
            db.close()


def start_scheduler() -> None:
    global _scheduler_thread

    if not settings.scheduler_enabled:
        logger.info("Scheduler disabled via config.")
        return

    if _scheduler_thread and _scheduler_thread.is_alive():
        logger.warning("Scheduler already running.")
        return

    _stop_event.clear()
    _scheduler_thread = threading.Thread(target=_run_scheduled_checks, daemon=True, name="abusebox-scheduler")
    _scheduler_thread.start()
    logger.info("Scheduler started (interval=%d min)", settings.scheduler_interval_minutes)


def stop_scheduler() -> None:
    _stop_event.set()
    if _scheduler_thread:
        _scheduler_thread.join(timeout=5)
    logger.info("Scheduler stopped.")

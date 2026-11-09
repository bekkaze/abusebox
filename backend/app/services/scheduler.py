import logging
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import UTC, datetime, timedelta

from sqlalchemy import or_

from app.core.timeutil import as_utc, to_utc_iso
from app.db.session import SessionLocal
from app.models import AppSettings, Hostname
from app.schemas.hostname import MIN_CHECK_INTERVAL_MINUTES
from app.services.check_runner import get_toggles_from_hostname, run_enabled_checks
from app.services.monitoring import prune_history, queued_recheck_ids, record_check

logger = logging.getLogger(__name__)

_scheduler_thread: threading.Thread | None = None
_stop_event = threading.Event()
_current_interval: int = 360  # minutes, updated at runtime

# Check every 60 seconds if any asset is due for a check
_POLL_INTERVAL_SECONDS = 60
_SCHEDULED_CHECK_WORKERS = 4
_PRUNE_EVERY_SECONDS = 3600

# Last cycle summary, shown on the dashboard.
_status_lock = threading.Lock()
_status: dict = {"last_cycle_started": None, "last_cycle_finished": None, "last_cycle_checked": 0, "last_error": None}
# A dict rather than a module global rebound through `global`: the state is
# the same, but it reads as state that outlives the call, which is what it is.
_prune_state: dict[str, datetime | None] = {"last": None}


def _is_asset_due(hostname: Hostname, global_interval_minutes: int) -> bool:
    """Check if an asset is due for a scheduled check."""
    if not hostname.last_checked:
        return True
    interval = global_interval_minutes
    if hostname.check_interval_minutes:
        # Releases before 1.3.2 stored any number here, even negative ones.
        interval = max(hostname.check_interval_minutes, MIN_CHECK_INTERVAL_MINUTES)
    # SQLite returns naive datetimes even though values are stored in UTC.
    last_checked = as_utc(hostname.last_checked)
    elapsed = (datetime.now(UTC) - last_checked).total_seconds()
    return elapsed >= interval * 60


def _get_global_interval(db) -> int:
    """Read the scheduler interval from DB settings, falling back to env config."""
    row = db.query(AppSettings).filter(AppSettings.id == 1).first()
    if row:
        return row.scheduler_interval_minutes
    from app.core.config import settings
    return settings.scheduler_interval_minutes


def due_hostnames(db, global_interval: int) -> list[Hostname]:
    """Assets whose next check is owed.

    The staleness test is finished in Python, because the effective interval is
    per-asset with a fallback to the global one and a floor, which is awkward to
    express portably in SQL. What SQL does do is discard the rows that cannot
    possibly be due: an asset is due only once it is at least
    `min(global_interval, MIN_CHECK_INTERVAL_MINUTES)` old, so anything checked
    more recently than that is not a candidate whatever its own interval says.

    This matters because the loop runs every 60 seconds. Loading every monitored
    asset each time to discard almost all of them in Python is the same mistake
    1.4.0 removed from the asset list, one layer down.
    """
    queued = queued_recheck_ids()
    # Stored timestamps are naive UTC (SQLite), so compare against naive UTC.
    floor_minutes = min(global_interval, MIN_CHECK_INTERVAL_MINUTES)
    cutoff = (datetime.now(UTC) - timedelta(minutes=floor_minutes)).replace(tzinfo=None)
    query = db.query(Hostname).filter(
        Hostname.is_monitor_enabled.is_(True),
        Hostname.status == "active",
        or_(Hostname.last_checked.is_(None), Hostname.last_checked <= cutoff),
    )
    if queued:
        query = query.filter(Hostname.id.notin_(queued))
    return [h for h in query.all() if _is_asset_due(h, global_interval)]


def _maybe_prune(db) -> None:
    last = _prune_state["last"]
    now = datetime.now(UTC)
    if last and (now - last).total_seconds() < _PRUNE_EVERY_SECONDS:
        return
    _prune_state["last"] = now
    row = db.query(AppSettings).filter(AppSettings.id == 1).first()
    if row and row.history_retention_days:
        prune_history(db, row.history_retention_days)


_cycle_lock = threading.Lock()


def cycle_in_progress() -> bool:
    return _cycle_lock.locked()


def run_cycle() -> int:
    """Check every due asset once. Returns the number checked, or -1 if a cycle
    is already running (scheduled and manual runs never overlap)."""
    if not _cycle_lock.acquire(blocking=False):
        return -1
    try:
        return _run_cycle_locked()
    finally:
        _cycle_lock.release()


def _run_cycle_locked() -> int:
    db = SessionLocal()
    checked = 0
    with _status_lock:
        _status["last_cycle_started"] = datetime.now(UTC)
    try:
        global_interval = _get_global_interval(db)
        due = due_hostnames(db, global_interval)

        # Run the (slow, network-bound) checks in parallel, then save results
        # one by one on this thread's session.
        work = [(h, h.hostname, get_toggles_from_hostname(h)) for h in due]
        results: dict[int, dict] = {}
        with ThreadPoolExecutor(max_workers=_SCHEDULED_CHECK_WORKERS) as executor:
            futures = {executor.submit(run_enabled_checks, value, toggles): h for h, value, toggles in work}
            for future in as_completed(futures):
                hostname = futures[future]
                try:
                    results[hostname.id] = future.result()
                except Exception:
                    logger.exception("Error checking hostname %s", hostname.hostname)

        # Every check above has already finished; saving is a handful of local
        # writes. Stopping here would throw that network work away, so a stop
        # (including the brief one a settings change causes) is not honoured
        # until the results are persisted.
        for hostname, _, _ in work:
            result = results.get(hostname.id)
            if not result:
                continue
            try:
                events = record_check(db, hostname, result)
                checked += 1
                logger.info("Checked %s: blacklisted=%s, events=%s", hostname.hostname, hostname.is_blacklisted, [e.event_type for e in events])
            except Exception:
                db.rollback()
                logger.exception("Error saving check for hostname %s", hostname.hostname)

        _maybe_prune(db)
        with _status_lock:
            _status["last_error"] = None
    except Exception as exc:
        logger.exception("Scheduler error during check cycle")
        with _status_lock:
            _status["last_error"] = str(exc)
    finally:
        db.close()
        with _status_lock:
            _status["last_cycle_finished"] = datetime.now(UTC)
            _status["last_cycle_checked"] = checked
    return checked


def _run_scheduled_checks() -> None:
    while not _stop_event.is_set():
        _stop_event.wait(_POLL_INTERVAL_SECONDS)
        if _stop_event.is_set():
            break
        run_cycle()


def scheduler_status() -> dict:
    with _status_lock:
        status = dict(_status)
    return {
        "running": bool(_scheduler_thread and _scheduler_thread.is_alive() and not _stop_event.is_set()),
        "poll_interval_seconds": _POLL_INTERVAL_SECONDS,
        "last_cycle_started": to_utc_iso(status["last_cycle_started"]),
        "last_cycle_finished": to_utc_iso(status["last_cycle_finished"]),
        "last_cycle_checked": status["last_cycle_checked"],
        "last_error": status["last_error"],
        "cycle_in_progress": cycle_in_progress(),
    }


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

    # An int, whatever the column or the environment held: it is logged
    # below, and a scheduler interval is a number by definition.
    _current_interval = int(interval_minutes)

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

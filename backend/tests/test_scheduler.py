"""Scheduler due-time logic (regression tests for issue #20)."""

from datetime import datetime, timedelta, timezone

from app.db.session import Base, SessionLocal, engine
from app.models import Hostname, User
from app.services.scheduler import _is_asset_due


def _stored_hostname(last_checked: datetime | None, interval: int | None = None) -> Hostname:
    """Persist a hostname and load it back the way the scheduler does (fresh session)."""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        user = User(username="u", email="u@example.com", phone_number="1234", hashed_password="x")
        db.add(user)
        db.commit()
        db.add(Hostname(
            user_id=user.id,
            hostname_type="ipv4",
            hostname="203.0.113.10",
            is_monitor_enabled=True,
            last_checked=last_checked,
            check_interval_minutes=interval,
        ))
        db.commit()
    db = SessionLocal()
    return db.query(Hostname).one()


def test_never_checked_is_due():
    assert _is_asset_due(_stored_hostname(None), 60) is True


def test_naive_timestamp_from_sqlite_does_not_crash():
    # SQLite drops tzinfo; comparing it with an aware "now" used to raise
    # "can't subtract offset-naive and offset-aware datetimes" and stop the scheduler.
    hostname = _stored_hostname(datetime.now(timezone.utc))
    assert hostname.last_checked.tzinfo is None
    assert _is_asset_due(hostname, 60) is False


def test_due_after_global_interval():
    hostname = _stored_hostname(datetime.now(timezone.utc) - timedelta(minutes=61))
    assert _is_asset_due(hostname, 60) is True


def test_per_asset_interval_overrides_global():
    hostname = _stored_hostname(datetime.now(timezone.utc) - timedelta(minutes=20), interval=15)
    assert _is_asset_due(hostname, 360) is True
    hostname = _stored_hostname(datetime.now(timezone.utc) - timedelta(minutes=20), interval=30)
    assert _is_asset_due(hostname, 1) is False

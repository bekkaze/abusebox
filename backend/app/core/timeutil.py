"""UTC helpers. SQLite returns naive datetimes even though every stored value is UTC."""

from datetime import datetime, timezone


def as_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def to_utc_iso(value: datetime | None) -> str | None:
    """ISO-8601 with an explicit UTC offset, so browsers don't read it as local time."""
    utc = as_utc(value)
    return utc.isoformat() if utc else None

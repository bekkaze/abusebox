from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.core.timeutil import to_utc_iso
from app.db.session import get_db
from app.models import AssetEvent, Hostname, User

router = APIRouter(prefix="/events", tags=["events"])


def serialize_event(event: AssetEvent, hostname: Hostname) -> dict:
    return {
        "id": event.id,
        "hostname_id": event.hostname_id,
        "hostname": hostname.hostname,
        "check_id": event.check_id,
        "event_type": event.event_type,
        "severity": event.severity,
        "title": event.title,
        "details": event.details or {},
        "created": to_utc_iso(event.created),
    }


@router.get("/")
def list_events(
    limit: int = Query(50, ge=1, le=500),
    severity: str | None = Query(None, pattern="^(critical|warning|info|success)$"),
    before_id: int | None = Query(None, ge=1, description="Return events older than this id (pagination)."),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Activity across all of the current user's assets, newest first."""
    query = (
        db.query(AssetEvent, Hostname)
        .join(Hostname, Hostname.id == AssetEvent.hostname_id)
        .filter(Hostname.user_id == user.id)
    )
    if severity:
        query = query.filter(AssetEvent.severity == severity)
    if before_id:
        query = query.filter(AssetEvent.id < before_id)
    rows = query.order_by(AssetEvent.id.desc()).limit(limit).all()
    return [serialize_event(event, hostname) for event, hostname in rows]

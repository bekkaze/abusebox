from datetime import datetime, timezone
from threading import Lock
from time import monotonic

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.session import get_db
from app.models import CheckHistory, Hostname, User
from app.schemas import DelistRequest
from app.services.dnsbl import check_dnsbl_providers

router = APIRouter(prefix="/blacklist", tags=["blacklist"])

_PUBLIC_CHECK_LIMIT = 10
_PUBLIC_CHECK_WINDOW_SECONDS = 60
_public_check_requests: dict[str, list[float]] = {}
_public_check_lock = Lock()


def _enforce_public_check_limit(request: Request) -> None:
    """Limit anonymous DNSBL lookups to prevent endpoint and DNSBL abuse."""
    client_ip = request.client.host if request.client else "unknown"
    now = monotonic()
    with _public_check_lock:
        recent = [t for t in _public_check_requests.get(client_ip, []) if now - t < _PUBLIC_CHECK_WINDOW_SECONDS]
        if len(recent) >= _PUBLIC_CHECK_LIMIT:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many quick checks. Try again in a minute.",
            )
        recent.append(now)
        _public_check_requests[client_ip] = recent


@router.get("/quick-check/")
def quick_check(request: Request, hostname: str | None = None):
    if hostname is None or hostname.strip() == "":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Please provide a Hostname")

    _enforce_public_check_limit(request)
    result = check_dnsbl_providers(hostname)
    if result.get("error"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result["error"])
    return result


@router.post("/delist/")
def delist(
    payload: DelistRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    history_id = payload.delist_required_data.get("id")
    if history_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing delist check history id")

    history = (
        db.query(CheckHistory)
        .join(Hostname, Hostname.id == CheckHistory.hostname_id)
        .filter(CheckHistory.id == history_id, Hostname.user_id == user.id)
        .first()
    )
    if not history:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Check history not found")

    if payload.provider != "b.barracudacentral.org":
        return {"msg": "Not implemented"}

    result = dict(history.result or {})
    detected = result.get("detected_on", [])
    for item in detected:
        if item.get("provider") == payload.provider:
            item["status"] = "closed"
            item["response"] = "queued"

    result["detected_on"] = detected
    history.result = result
    history.updated = datetime.now(timezone.utc)
    db.commit()

    return {"msg": "success", "result": result}

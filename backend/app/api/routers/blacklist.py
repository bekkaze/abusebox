import copy
from datetime import datetime, timezone
from threading import Lock
from time import monotonic

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from app.core.client_ip import get_client_ip
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
    client_ip = get_client_ip(request)
    now = monotonic()
    with _public_check_lock:
        if len(_public_check_requests) > 10_000:
            # Forget clients with no recent requests so the table stays bounded.
            for stale in [ip for ip, times in _public_check_requests.items() if not times or now - times[-1] >= _PUBLIC_CHECK_WINDOW_SECONDS]:
                _public_check_requests.pop(stale, None)
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
    """Record that a removal request was submitted to a blacklist provider.

    AbuseBox can't submit removal forms on your behalf (providers use web forms
    with CAPTCHAs); this tracks the request so the listing shows as "requested".
    """
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

    result = copy.deepcopy(history.result or {})
    # Current results nest DNSBL data under "blacklist"; older ones are flat.
    blacklist = result.get("blacklist") if isinstance(result.get("blacklist"), dict) else result
    item = next((d for d in blacklist.get("detected_on", []) if d.get("provider") == payload.provider), None)
    if item is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This provider is not listed in the selected check.")

    item["status"] = "requested"
    item["requested_at"] = datetime.now(timezone.utc).isoformat()
    note = str(payload.delist_required_data.get("comment") or "").strip()
    if note:
        item["note"] = note[:500]

    history.result = result
    flag_modified(history, "result")
    history.updated = datetime.now(timezone.utc)
    db.commit()

    return {"msg": "success", "result": result}

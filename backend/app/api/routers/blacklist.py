from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.session import get_db
from app.models import CheckHistory, Hostname, User
from app.schemas import DelistRequest
from app.services.dnsbl import check_dnsbl_providers

router = APIRouter(prefix="/blacklist", tags=["blacklist"])


@router.get("/quick-check/")
def quick_check(hostname: str | None = None):
    if hostname is None or hostname.strip() == "":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Please provide a Hostname")

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
    history.updated = datetime.utcnow()
    db.commit()

    return {"msg": "success", "result": result}

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session, joinedload

from app.core.security import get_current_user
from app.db.session import get_db
from app.models import CheckHistory, Hostname, User
from app.schemas import (
    HostnameCreateRequest,
    HostnameListItem,
    HostnameResponse,
    HostnameUpdateRequest,
)
from app.services.dnsbl import check_dnsbl_providers

router = APIRouter(prefix="/hostname", tags=["hostname"])


def _to_hostname_response(hostname: Hostname) -> HostnameResponse:
    return HostnameResponse(
        id=hostname.id,
        user=hostname.user_id,
        hostname_type=hostname.hostname_type,
        hostname=hostname.hostname,
        description=hostname.description,
        is_alert_enabled=hostname.is_alert_enabled,
        is_monitor_enabled=hostname.is_monitor_enabled,
        status=hostname.status,
        is_blacklisted=hostname.is_blacklisted,
        created=hostname.created,
        updated=hostname.updated,
    )


@router.post("/", response_model=HostnameResponse)
def create_hostname(
    payload: HostnameCreateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    existing = db.query(Hostname).filter(Hostname.user_id == user.id, Hostname.hostname == payload.hostname).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Hostname already exists")

    hostname = Hostname(
        user_id=user.id,
        hostname_type=payload.hostname_type,
        hostname=payload.hostname,
        description=payload.description,
        is_alert_enabled=payload.is_alert_enabled,
        is_monitor_enabled=payload.is_monitor_enabled,
        status="active",
    )
    db.add(hostname)
    db.commit()
    db.refresh(hostname)

    check_result = check_dnsbl_providers(payload.hostname)
    if not check_result.get("error"):
        hostname.is_blacklisted = bool(check_result.get("is_blacklisted", False))
        db.add(CheckHistory(hostname_id=hostname.id, result=check_result, status="current"))
        db.commit()
        db.refresh(hostname)

    return _to_hostname_response(hostname)


@router.get("/list/", response_model=list[HostnameListItem])
def list_hostnames(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    hostnames = (
        db.query(Hostname)
        .options(joinedload(Hostname.checks))
        .filter(Hostname.user_id == user.id)
        .order_by(Hostname.created.desc())
        .all()
    )

    output: list[HostnameListItem] = []
    for hostname in hostnames:
        current_checks = [check for check in hostname.checks if check.status == "current"]
        current_check = max(current_checks, key=lambda x: x.created) if current_checks else None

        check_result = dict(current_check.result) if current_check and current_check.result else None
        if check_result and current_check:
            check_result["id"] = current_check.id

        output.append(
            HostnameListItem(
                **_to_hostname_response(hostname).model_dump(),
                result=check_result,
                checked=current_check.created if current_check else "Not checked",
            )
        )

    return output


@router.get("/{pk}", response_model=HostnameResponse)
def get_hostname(pk: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    hostname = db.query(Hostname).filter(Hostname.id == pk, Hostname.user_id == user.id).first()
    if not hostname:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Hostname not found")
    return _to_hostname_response(hostname)


@router.put("/{pk}", response_model=HostnameResponse)
def update_hostname(
    pk: int,
    payload: HostnameUpdateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    hostname = db.query(Hostname).filter(Hostname.id == pk, Hostname.user_id == user.id).first()
    if not hostname:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Hostname not found")

    hostname.hostname_type = payload.hostname_type
    hostname.hostname = payload.hostname
    hostname.description = payload.description
    hostname.is_alert_enabled = payload.is_alert_enabled
    hostname.is_monitor_enabled = payload.is_monitor_enabled
    hostname.status = payload.status
    db.commit()
    db.refresh(hostname)

    return _to_hostname_response(hostname)


@router.delete("/{pk}", status_code=status.HTTP_204_NO_CONTENT)
def delete_hostname(pk: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    hostname = db.query(Hostname).filter(Hostname.id == pk, Hostname.user_id == user.id).first()
    if not hostname:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Hostname not found")

    db.delete(hostname)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

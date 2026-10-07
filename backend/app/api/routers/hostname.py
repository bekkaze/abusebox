import ipaddress
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.session import get_db
from app.models import AssetEvent, CheckHistory, Hostname, User
from app.schemas import (
    BulkActionRequest,
    BulkActionResult,
    BulkCreateResult,
    BulkHostnameCreateRequest,
    CidrImportRequest,
    HostnameCreateRequest,
    HostnameListItem,
    HostnameResponse,
    HostnameUpdateRequest,
)
from app.core.timeutil import to_utc_iso
from app.services.app_settings import get_app_settings
from app.services.check_runner import get_toggles_from_hostname, run_enabled_checks
from app.services.health import summarize
from app.services.monitoring import queue_rechecks, record_check
from app.api.routers.events import serialize_event

router = APIRouter(prefix="/hostname", tags=["hostname"])

CHECK_TOGGLE_FIELDS = [
    "check_blacklist",
    "check_abuseipdb",
    "check_dns",
    "check_ssl",
    "check_whois",
    "check_email_security",
    "check_server_status",
]


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
        check_blacklist=hostname.check_blacklist,
        check_abuseipdb=hostname.check_abuseipdb,
        check_dns=hostname.check_dns,
        check_ssl=hostname.check_ssl,
        check_whois=hostname.check_whois,
        check_email_security=hostname.check_email_security,
        check_server_status=hostname.check_server_status,
        check_interval_minutes=hostname.check_interval_minutes,
        last_checked=hostname.last_checked,
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
        check_blacklist=payload.check_blacklist,
        check_abuseipdb=payload.check_abuseipdb,
        check_dns=payload.check_dns,
        check_ssl=payload.check_ssl,
        check_whois=payload.check_whois,
        check_email_security=payload.check_email_security,
        check_server_status=payload.check_server_status,
        check_interval_minutes=payload.check_interval_minutes,
        status="active",
        # Checks run right below; mark the asset as checked now so the
        # scheduler doesn't pick it up and check it a second time meanwhile.
        last_checked=datetime.now(timezone.utc),
    )
    db.add(hostname)
    db.commit()
    db.refresh(hostname)

    # Run all enabled checks. No alerts on creation: the user is looking at it.
    check_result = run_enabled_checks(payload.hostname, get_toggles_from_hostname(hostname))
    if check_result:
        record_check(db, hostname, check_result, notify=False)
        db.refresh(hostname)

    return _to_hostname_response(hostname)


@router.post("/bulk/", response_model=BulkCreateResult)
def create_hostnames_bulk(
    payload: BulkHostnameCreateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    created = 0
    skipped = 0
    errors: list[str] = []

    existing_set = {
        h.hostname
        for h in db.query(Hostname.hostname).filter(Hostname.user_id == user.id).all()
    }

    for item in payload.hostnames:
        if item.hostname in existing_set:
            skipped += 1
            continue
        try:
            hostname = Hostname(
                user_id=user.id,
                hostname_type=item.hostname_type,
                hostname=item.hostname,
                description=item.description,
                is_alert_enabled=item.is_alert_enabled,
                is_monitor_enabled=item.is_monitor_enabled,
                check_blacklist=item.check_blacklist,
                check_abuseipdb=item.check_abuseipdb,
                check_dns=item.check_dns,
                check_ssl=item.check_ssl,
                check_whois=item.check_whois,
                check_email_security=item.check_email_security,
                check_server_status=item.check_server_status,
                check_interval_minutes=item.check_interval_minutes,
                status="active",
            )
            db.add(hostname)
            db.flush()

            existing_set.add(item.hostname)
            created += 1
        except Exception as exc:
            errors.append(f"{item.hostname}: {exc}")

    db.commit()
    return BulkCreateResult(created=created, skipped=skipped, errors=errors)


@router.post("/cidr-import/", response_model=BulkCreateResult)
def import_cidr(
    payload: CidrImportRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        network = ipaddress.IPv4Network(payload.cidr, strict=False)
    except (ipaddress.AddressValueError, ipaddress.NetmaskValueError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=f"Invalid CIDR: {exc}")

    if network.prefixlen < 24:
        raise HTTPException(status_code=400, detail="Maximum /24 (256 addresses) allowed")

    existing_set = {
        h.hostname
        for h in db.query(Hostname.hostname).filter(Hostname.user_id == user.id).all()
    }

    created = 0
    skipped = 0
    errors: list[str] = []

    for ip in network.hosts():
        ip_str = str(ip)
        if ip_str in existing_set:
            skipped += 1
            continue
        try:
            hostname = Hostname(
                user_id=user.id,
                hostname_type="ipv4",
                hostname=ip_str,
                description=payload.description or f"CIDR import: {payload.cidr}",
                is_alert_enabled=payload.is_alert_enabled,
                is_monitor_enabled=payload.is_monitor_enabled,
                check_blacklist=payload.check_blacklist,
                check_abuseipdb=payload.check_abuseipdb,
                check_dns=payload.check_dns,
                check_ssl=payload.check_ssl,
                check_whois=payload.check_whois,
                check_email_security=payload.check_email_security,
                check_server_status=payload.check_server_status,
                status="active",
            )
            db.add(hostname)
            db.flush()
            existing_set.add(ip_str)
            created += 1
        except Exception as exc:
            errors.append(f"{ip_str}: {exc}")

    db.commit()
    return BulkCreateResult(created=created, skipped=skipped, errors=errors)


def _latest_checks(db: Session, hostname_ids: list[int]) -> dict[int, CheckHistory]:
    """Latest "current" check per hostname, without loading every history row."""
    if not hostname_ids:
        return {}
    latest_ids = (
        db.query(func.max(CheckHistory.id))
        .filter(CheckHistory.hostname_id.in_(hostname_ids), CheckHistory.status == "current")
        .group_by(CheckHistory.hostname_id)
    )
    rows = db.query(CheckHistory).filter(CheckHistory.id.in_(latest_ids)).all()
    return {row.hostname_id: row for row in rows}


def _health_options(db: Session) -> dict:
    prefs = get_app_settings(db)
    return {
        "ssl_warning_days": prefs.ssl_expiry_warning_days,
        "domain_warning_days": prefs.domain_expiry_warning_days,
        "global_interval_minutes": prefs.scheduler_interval_minutes,
        "scheduler_enabled": prefs.scheduler_enabled,
    }


def _to_list_item(
    hostname: Hostname,
    current_check: CheckHistory | None,
    health_options: dict,
    include_result: bool = True,
) -> HostnameListItem:
    raw = current_check.result if current_check and current_check.result else None
    check_result = None
    if raw and include_result:
        check_result = dict(raw)
        # The check id lets the UI reference this result (e.g. for delist requests).
        check_result["id"] = current_check.id
    return HostnameListItem(
        **_to_hostname_response(hostname).model_dump(),
        result=check_result,
        health=summarize(hostname, raw, **health_options) if raw or hostname.is_monitor_enabled else None,
        checked=current_check.created if current_check else "Not checked",
    )


@router.get("/list/", response_model=list[HostnameListItem])
def list_hostnames(
    include_result: bool = Query(True, description="Include each asset's full latest result. Set to false for a lighter list; `health` is always included."),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    hostnames = (
        db.query(Hostname)
        .filter(Hostname.user_id == user.id)
        .order_by(Hostname.created.desc())
        .all()
    )
    latest = _latest_checks(db, [hostname.id for hostname in hostnames])
    options = _health_options(db)
    return [_to_list_item(hostname, latest.get(hostname.id), options, include_result) for hostname in hostnames]


@router.post("/bulk-action/", response_model=BulkActionResult)
def bulk_action(
    payload: BulkActionRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Apply one action to many assets. Re-checks run in the background."""
    hostnames = db.query(Hostname).filter(Hostname.user_id == user.id, Hostname.id.in_(payload.ids)).all()
    if payload.action == "recheck":
        queued = queue_rechecks([h.id for h in hostnames])
        return BulkActionResult(affected=len(hostnames), queued=queued)
    if payload.action == "delete":
        for hostname in hostnames:
            db.delete(hostname)  # ORM delete cascades to checks and events
    else:
        field, value = {
            "enable_monitoring": ("is_monitor_enabled", True),
            "disable_monitoring": ("is_monitor_enabled", False),
            "enable_alerts": ("is_alert_enabled", True),
            "disable_alerts": ("is_alert_enabled", False),
        }[payload.action]
        for hostname in hostnames:
            setattr(hostname, field, value)
    db.commit()
    return BulkActionResult(affected=len(hostnames))


@router.get("/{pk}", response_model=HostnameListItem)
def get_hostname(pk: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    hostname = db.query(Hostname).filter(Hostname.id == pk, Hostname.user_id == user.id).first()
    if not hostname:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Hostname not found")
    return _to_list_item(hostname, _latest_checks(db, [hostname.id]).get(hostname.id), _health_options(db))


@router.get("/{pk}/checks/{check_id}")
def get_check(pk: int, check_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Full result of one past check, plus the id of the check before it (for diffs)."""
    hostname = db.query(Hostname).filter(Hostname.id == pk, Hostname.user_id == user.id).first()
    if not hostname:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Hostname not found")
    check = db.query(CheckHistory).filter(CheckHistory.id == check_id, CheckHistory.hostname_id == pk).first()
    if not check:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Check not found")
    previous = (
        db.query(CheckHistory.id)
        .filter(CheckHistory.hostname_id == pk, CheckHistory.id < check.id)
        .order_by(CheckHistory.id.desc())
        .first()
    )
    return {
        "id": check.id,
        "hostname_id": pk,
        "date": to_utc_iso(check.created),
        "status": check.status,
        "previous_id": previous[0] if previous else None,
        "result": check.result or {},
    }


@router.get("/{pk}/events/")
def get_hostname_events(
    pk: int,
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    hostname = db.query(Hostname).filter(Hostname.id == pk, Hostname.user_id == user.id).first()
    if not hostname:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Hostname not found")
    events = (
        db.query(AssetEvent)
        .filter(AssetEvent.hostname_id == pk)
        .order_by(AssetEvent.created.desc(), AssetEvent.id.desc())
        .limit(limit)
        .all()
    )
    return [serialize_event(event, hostname) for event in events]


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
    duplicate = (
        db.query(Hostname)
        .filter(Hostname.user_id == user.id, Hostname.hostname == payload.hostname, Hostname.id != pk)
        .first()
    )
    if duplicate:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Hostname already exists")

    hostname.hostname_type = payload.hostname_type
    hostname.hostname = payload.hostname
    hostname.description = payload.description
    hostname.is_alert_enabled = payload.is_alert_enabled
    hostname.is_monitor_enabled = payload.is_monitor_enabled
    hostname.status = payload.status
    for field in CHECK_TOGGLE_FIELDS:
        setattr(hostname, field, getattr(payload, field))
    hostname.check_interval_minutes = payload.check_interval_minutes
    db.commit()
    db.refresh(hostname)

    return _to_hostname_response(hostname)


@router.get("/{pk}/history/")
def get_hostname_history(
    pk: int,
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    hostname = db.query(Hostname).filter(Hostname.id == pk, Hostname.user_id == user.id).first()
    if not hostname:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Hostname not found")

    # Most recent *limit* checks, returned oldest-first for charting.
    checks = (
        db.query(CheckHistory)
        .filter(CheckHistory.hostname_id == pk)
        .order_by(CheckHistory.created.desc(), CheckHistory.id.desc())
        .limit(limit)
        .all()
    )[::-1]

    history = []
    for check in checks:
        result = check.result or {}
        bl = result.get("blacklist", result)  # backward compat: old results have flat structure
        history.append({
            "id": check.id,
            "date": to_utc_iso(check.created),
            "status": check.status,
            "is_blacklisted": bool(bl.get("is_blacklisted", False)),
            "detected_count": len(bl.get("detected_on", [])),
            "total_providers": len(bl.get("providers", [])),
            "checks_run": [k for k in result if k != "id"],
        })

    return {
        "hostname": hostname.hostname,
        "hostname_id": hostname.id,
        "history": history,
    }


@router.post("/{pk}/recheck/", response_model=HostnameResponse)
def recheck_hostname(pk: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    hostname = db.query(Hostname).filter(Hostname.id == pk, Hostname.user_id == user.id).first()
    if not hostname:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Hostname not found")

    check_result = run_enabled_checks(hostname.hostname, get_toggles_from_hostname(hostname))
    if check_result:
        record_check(db, hostname, check_result)
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

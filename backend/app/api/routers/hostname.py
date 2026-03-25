import ipaddress

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session, joinedload

from app.core.security import get_current_user
from app.db.session import get_db
from app.models import CheckHistory, Hostname, User
from app.schemas import (
    BulkCreateResult,
    BulkHostnameCreateRequest,
    CidrImportRequest,
    HostnameCreateRequest,
    HostnameListItem,
    HostnameResponse,
    HostnameUpdateRequest,
)
from app.services.check_runner import get_toggles_from_hostname, run_enabled_checks

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
        status="active",
    )
    db.add(hostname)
    db.commit()
    db.refresh(hostname)

    # Run all enabled checks
    toggles = get_toggles_from_hostname(hostname)
    check_result = run_enabled_checks(payload.hostname, toggles)

    if check_result:
        # Update blacklist status from blacklist check
        bl = check_result.get("blacklist", {})
        if bl and not bl.get("error"):
            hostname.is_blacklisted = bool(bl.get("is_blacklisted", False))

        db.add(CheckHistory(hostname_id=hostname.id, result=check_result, status="current"))
        db.commit()
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
                status="active",
            )
            db.add(hostname)
            db.flush()

            toggles = get_toggles_from_hostname(hostname)
            check_result = run_enabled_checks(item.hostname, toggles)
            if check_result:
                bl = check_result.get("blacklist", {})
                if bl and not bl.get("error"):
                    hostname.is_blacklisted = bool(bl.get("is_blacklisted", False))
                db.add(CheckHistory(hostname_id=hostname.id, result=check_result, status="current"))

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
    for field in CHECK_TOGGLE_FIELDS:
        setattr(hostname, field, getattr(payload, field))
    db.commit()
    db.refresh(hostname)

    return _to_hostname_response(hostname)


@router.get("/{pk}/history/")
def get_hostname_history(pk: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    hostname = db.query(Hostname).filter(Hostname.id == pk, Hostname.user_id == user.id).first()
    if not hostname:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Hostname not found")

    checks = (
        db.query(CheckHistory)
        .filter(CheckHistory.hostname_id == pk)
        .order_by(CheckHistory.created.asc())
        .all()
    )

    history = []
    for check in checks:
        result = check.result or {}
        bl = result.get("blacklist", result)  # backward compat: old results have flat structure
        history.append({
            "id": check.id,
            "date": check.created.isoformat() if check.created else None,
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

    toggles = get_toggles_from_hostname(hostname)
    check_result = run_enabled_checks(hostname.hostname, toggles)

    if check_result:
        bl = check_result.get("blacklist", {})
        if bl and not bl.get("error"):
            hostname.is_blacklisted = bool(bl.get("is_blacklisted", False))

        # Mark old checks as historical
        db.query(CheckHistory).filter(
            CheckHistory.hostname_id == hostname.id,
            CheckHistory.status == "current",
        ).update({"status": "historical"})

        db.add(CheckHistory(hostname_id=hostname.id, result=check_result, status="current"))
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

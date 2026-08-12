from concurrent.futures import ThreadPoolExecutor

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import PlainTextResponse

from app.services.abuseipdb import check_abuseipdb
from app.services.dns_records import lookup_dns_records
from app.services.dnsbl import check_dnsbl_providers
from app.services.email_security import check_email_security
from app.services.export import export_blacklist_csv, export_subnet_csv
from app.services.server_status import check_server_status
from app.services.ssl_checker import check_ssl_certificate
from app.services.subnet_check import check_subnet
from app.services.target_file_parser import MAX_TARGETS, parse_target_file
from app.services.whois_lookup import whois_lookup
from app.core.security import get_current_user
from app.models import User

router = APIRouter(prefix="/tools", tags=["tools"], dependencies=[Depends(get_current_user)])


@router.get("/abuseipdb/")
def abuseipdb_check(hostname: str | None = None, max_age_days: int = Query(90, ge=1, le=365)):
    if not hostname or not hostname.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Please provide a hostname or IP address.")

    result = check_abuseipdb(hostname.strip(), max_age_in_days=max_age_days)
    if result.get("error"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result["error"])
    return result


@router.get("/whois/")
def whois_check(hostname: str | None = None):
    if not hostname or not hostname.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Please provide a domain name.")

    result = whois_lookup(hostname.strip())
    if result.get("error"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result["error"])
    return result


@router.get("/server-status/")
def server_status_check(hostname: str | None = None):
    if not hostname or not hostname.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Please provide a hostname or URL.")

    result = check_server_status(hostname.strip())
    if result.get("error"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result["error"])
    return result


@router.get("/dns/")
def dns_check(hostname: str | None = None):
    if not hostname or not hostname.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Please provide a domain name.")

    result = lookup_dns_records(hostname.strip())
    if result.get("error"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result["error"])
    return result


@router.get("/ssl/")
def ssl_check(hostname: str | None = None):
    if not hostname or not hostname.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Please provide a hostname.")

    result = check_ssl_certificate(hostname.strip())
    if result.get("error") and "valid" not in result:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result["error"])
    return result


@router.get("/email-security/")
def email_security_check(hostname: str | None = None, dkim_selectors: str | None = None):
    if not hostname or not hostname.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Please provide a domain name.")

    selectors = [selector.strip() for selector in (dkim_selectors or "").split(",") if selector.strip()]
    result = check_email_security(hostname.strip(), selectors or None)
    if result.get("error"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result["error"])
    return result


@router.get("/subnet/")
def subnet_check_endpoint(cidr: str | None = None):
    if not cidr or not cidr.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Please provide a CIDR range (e.g. 192.168.1.0/24).")

    result = check_subnet(cidr.strip())
    if result.get("error"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result["error"])
    return result


def _bulk_check_items(items: list[str]):
    items = list(dict.fromkeys(item.strip().lower() for item in items if item.strip()))
    if len(items) > MAX_TARGETS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Maximum {MAX_TARGETS} hostnames per request.")
    with ThreadPoolExecutor(max_workers=10) as executor:
        checked = list(executor.map(check_dnsbl_providers, items))
    results = [
        {
            "hostname": item,
            "is_blacklisted": result.get("is_blacklisted", False),
            "detected_count": len(result.get("detected_on", [])),
            "detected_on": result.get("detected_on", []),
            "error": result.get("error"),
        }
        for item, result in zip(items, checked)
    ]
    return {
        "total": len(results),
        "blacklisted_count": sum(1 for result in results if result["is_blacklisted"]),
        "results": results,
    }


@router.get("/bulk-check/")
def bulk_check(hostnames: str | None = None, user: User = Depends(get_current_user)):
    if not hostnames or not hostnames.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Please provide comma-separated hostnames/IPs.")

    items = [h.strip() for h in hostnames.split(",") if h.strip()]
    return _bulk_check_items(items)


@router.post("/parse-target-file/")
async def parse_targets(file: UploadFile = File(...), user: User = Depends(get_current_user)):
    try:
        return {"targets": parse_target_file(file.filename or "", await file.read())}
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/bulk-check-upload/")
async def bulk_check_upload(file: UploadFile = File(...), user: User = Depends(get_current_user)):
    try:
        items = parse_target_file(file.filename or "", await file.read())
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return _bulk_check_items(items)


@router.get("/export/blacklist/", response_class=PlainTextResponse)
def export_blacklist(hostname: str | None = None):
    if not hostname or not hostname.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Please provide a hostname.")

    result = check_dnsbl_providers(hostname.strip())
    if result.get("error"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result["error"])

    csv_content = export_blacklist_csv(result)
    return PlainTextResponse(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="blacklist-{hostname.strip()}.csv"'},
    )


@router.get("/export/subnet/", response_class=PlainTextResponse)
def export_subnet(cidr: str | None = None):
    if not cidr or not cidr.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Please provide a CIDR range.")

    result = check_subnet(cidr.strip())
    if result.get("error"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result["error"])

    csv_content = export_subnet_csv(result)
    safe_name = cidr.strip().replace("/", "_")
    return PlainTextResponse(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="subnet-{safe_name}.csv"'},
    )

from fastapi import APIRouter, HTTPException, status

from app.services.abuseipdb import check_abuseipdb
from app.services.server_status import check_server_status
from app.services.whois_lookup import whois_lookup

router = APIRouter(prefix="/tools", tags=["tools"])


@router.get("/abuseipdb/")
def abuseipdb_check(hostname: str | None = None, max_age_days: int = 90):
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

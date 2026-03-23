from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import PlainTextResponse

from app.services.abuseipdb import check_abuseipdb
from app.services.dns_records import lookup_dns_records
from app.services.dnsbl import check_dnsbl_providers
from app.services.email_security import check_email_security
from app.services.export import export_blacklist_csv, export_subnet_csv
from app.services.server_status import check_server_status
from app.services.ssl_checker import check_ssl_certificate
from app.services.subnet_check import check_subnet
from app.services.whois_lookup import whois_lookup

router = APIRouter(prefix="/tools", tags=["tools"])


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
def email_security_check(hostname: str | None = None):
    if not hostname or not hostname.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Please provide a domain name.")

    result = check_email_security(hostname.strip())
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


@router.get("/bulk-check/")
def bulk_check(hostnames: str | None = None):
    if not hostnames or not hostnames.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Please provide comma-separated hostnames/IPs.")

    items = [h.strip() for h in hostnames.split(",") if h.strip()]
    if len(items) > 20:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Maximum 20 hostnames per request.")

    results = []
    for item in items:
        result = check_dnsbl_providers(item)
        results.append({
            "hostname": item,
            "is_blacklisted": result.get("is_blacklisted", False),
            "detected_count": len(result.get("detected_on", [])),
            "detected_on": result.get("detected_on", []),
            "error": result.get("error"),
        })

    return {
        "total": len(results),
        "blacklisted_count": sum(1 for r in results if r["is_blacklisted"]),
        "results": results,
    }


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

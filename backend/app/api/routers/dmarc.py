from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.session import get_db
from app.models import User
from app.models.dmarc_report import DmarcReport, DmarcReportRecord
from app.services.dmarc_parser import extract_xml, parse_dmarc_xml, summarize_reports

router = APIRouter(prefix="/dmarc", tags=["dmarc"])

MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10 MB


@router.post("/upload/")
async def upload_dmarc_report(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Upload a DMARC aggregate report (XML, .xml.gz, or .zip)."""
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No file provided.")

    data = await file.read()
    if len(data) > MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File exceeds 10 MB limit.")

    try:
        xml_string = extract_xml(data)
        parsed = parse_dmarc_xml(xml_string)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to parse DMARC report: {exc}",
        )

    domain = parsed["domain"]
    if not domain:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Could not determine domain from report.")

    # Check for duplicate report_id
    existing = (
        db.query(DmarcReport)
        .filter(DmarcReport.user_id == user.id, DmarcReport.report_id == parsed["report_id"], DmarcReport.domain == domain)
        .first()
    )
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Report '{parsed['report_id']}' already uploaded.")

    report = DmarcReport(
        user_id=user.id,
        domain=domain,
        org_name=parsed["org_name"],
        report_id=parsed["report_id"],
        email=parsed.get("email"),
        date_begin=parsed.get("date_begin"),
        date_end=parsed.get("date_end"),
        policy_domain=domain,
        policy_adkim=parsed["policy"].get("adkim"),
        policy_aspf=parsed["policy"].get("aspf"),
        policy_p=parsed["policy"].get("p"),
        policy_pct=parsed["policy"].get("pct"),
        raw_xml=xml_string,
    )
    db.add(report)
    db.flush()

    for rec in parsed["records"]:
        db.add(DmarcReportRecord(
            report_id=report.id,
            source_ip=rec["source_ip"],
            count=rec["count"],
            disposition=rec["disposition"],
            dkim_domain=rec.get("dkim_domain"),
            dkim_result=rec.get("dkim_result"),
            dkim_selector=rec.get("dkim_selector"),
            spf_domain=rec.get("spf_domain"),
            spf_result=rec.get("spf_result"),
            dkim_aligned=rec.get("dkim_aligned"),
            spf_aligned=rec.get("spf_aligned"),
        ))

    db.commit()
    db.refresh(report)

    return {
        "id": report.id,
        "domain": report.domain,
        "org_name": report.org_name,
        "report_id": report.report_id,
        "date_begin": report.date_begin.isoformat() if report.date_begin else None,
        "date_end": report.date_end.isoformat() if report.date_end else None,
        "records_count": len(parsed["records"]),
        "total_messages": sum(r["count"] for r in parsed["records"]),
    }


@router.get("/reports/")
def list_reports(
    domain: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List all uploaded DMARC reports, optionally filtered by domain."""
    query = db.query(DmarcReport).filter(DmarcReport.user_id == user.id)
    if domain:
        query = query.filter(DmarcReport.domain == domain.strip().lower())
    reports = query.order_by(DmarcReport.date_begin.desc()).all()

    return [
        {
            "id": r.id,
            "domain": r.domain,
            "org_name": r.org_name,
            "report_id": r.report_id,
            "date_begin": r.date_begin.isoformat() if r.date_begin else None,
            "date_end": r.date_end.isoformat() if r.date_end else None,
            "policy_p": r.policy_p,
            "records_count": len(r.records),
            "total_messages": sum(rec.count for rec in r.records),
            "created": r.created.isoformat(),
        }
        for r in reports
    ]


@router.get("/summary/")
def report_summary(
    domain: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Aggregate summary across all reports for a domain."""
    if not domain or not domain.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Domain is required.")

    reports = (
        db.query(DmarcReport)
        .filter(DmarcReport.user_id == user.id, DmarcReport.domain == domain.strip().lower())
        .all()
    )
    if not reports:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No DMARC reports found for this domain.")

    # Reconstruct parsed-style dicts from DB records for summarization
    reports_data = []
    for r in reports:
        reports_data.append({
            "org_name": r.org_name,
            "records": [
                {
                    "source_ip": rec.source_ip,
                    "count": rec.count,
                    "disposition": rec.disposition,
                    "dkim_aligned": rec.dkim_aligned,
                    "spf_aligned": rec.spf_aligned,
                    "dkim_result": rec.dkim_result,
                    "spf_result": rec.spf_result,
                }
                for rec in r.records
            ],
        })

    summary = summarize_reports(reports_data)
    summary["domain"] = domain.strip().lower()
    summary["report_count"] = len(reports)

    # Date range
    begins = [r.date_begin for r in reports if r.date_begin]
    ends = [r.date_end for r in reports if r.date_end]
    summary["date_range"] = {
        "earliest": min(begins).isoformat() if begins else None,
        "latest": max(ends).isoformat() if ends else None,
    }

    # Latest policy
    latest = max(reports, key=lambda r: r.date_begin or r.created)
    summary["policy"] = {
        "p": latest.policy_p,
        "adkim": latest.policy_adkim,
        "aspf": latest.policy_aspf,
        "pct": latest.policy_pct,
    }

    return summary


@router.get("/reports/{report_id}")
def get_report_detail(
    report_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get full detail of a single DMARC report including all records."""
    report = db.query(DmarcReport).filter(DmarcReport.id == report_id, DmarcReport.user_id == user.id).first()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found.")

    return {
        "id": report.id,
        "domain": report.domain,
        "org_name": report.org_name,
        "report_id": report.report_id,
        "email": report.email,
        "date_begin": report.date_begin.isoformat() if report.date_begin else None,
        "date_end": report.date_end.isoformat() if report.date_end else None,
        "policy": {
            "p": report.policy_p,
            "adkim": report.policy_adkim,
            "aspf": report.policy_aspf,
            "pct": report.policy_pct,
        },
        "records": [
            {
                "source_ip": rec.source_ip,
                "count": rec.count,
                "disposition": rec.disposition,
                "dkim_domain": rec.dkim_domain,
                "dkim_result": rec.dkim_result,
                "dkim_selector": rec.dkim_selector,
                "spf_domain": rec.spf_domain,
                "spf_result": rec.spf_result,
                "dkim_aligned": rec.dkim_aligned,
                "spf_aligned": rec.spf_aligned,
            }
            for rec in report.records
        ],
        "total_messages": sum(rec.count for rec in report.records),
    }


@router.delete("/reports/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_report(
    report_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    report = db.query(DmarcReport).filter(DmarcReport.id == report_id, DmarcReport.user_id == user.id).first()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found.")
    db.delete(report)
    db.commit()

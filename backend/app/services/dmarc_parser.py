"""Parse DMARC aggregate report XML into structured dicts."""

from __future__ import annotations

import gzip
import io
import zipfile
from datetime import datetime, timezone
from typing import Any
from xml.etree import ElementTree


def _text(el: ElementTree.Element | None, path: str, default: str = "") -> str:
    if el is None:
        return default
    node = el.find(path)
    return (node.text or "").strip() if node is not None else default


def _int(el: ElementTree.Element | None, path: str, default: int = 0) -> int:
    raw = _text(el, path)
    try:
        return int(raw)
    except (ValueError, TypeError):
        return default


def _ts_to_dt(ts: str) -> datetime | None:
    try:
        return datetime.fromtimestamp(int(ts), tz=timezone.utc)
    except (ValueError, TypeError, OSError):
        return None


def extract_xml(data: bytes) -> str:
    """Extract XML from raw bytes — handles plain XML, gzip, and zip."""
    # Try gzip first
    try:
        return gzip.decompress(data).decode("utf-8", errors="replace")
    except (gzip.BadGzipFile, OSError):
        pass

    # Try zip
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as zf:
            for name in zf.namelist():
                if name.lower().endswith(".xml"):
                    return zf.read(name).decode("utf-8", errors="replace")
    except zipfile.BadZipFile:
        pass

    # Assume raw XML
    return data.decode("utf-8", errors="replace")


def parse_dmarc_xml(xml_string: str) -> dict[str, Any]:
    """Parse a DMARC aggregate report XML string into a structured dict.

    Returns:
        {
            "org_name": str,
            "report_id": str,
            "email": str,
            "date_begin": datetime | None,
            "date_end": datetime | None,
            "domain": str,
            "policy": {"adkim": str, "aspf": str, "p": str, "pct": int},
            "records": [
                {
                    "source_ip": str,
                    "count": int,
                    "disposition": str,
                    "dkim_domain": str,
                    "dkim_result": str,
                    "dkim_selector": str,
                    "spf_domain": str,
                    "spf_result": str,
                    "dkim_aligned": str,
                    "spf_aligned": str,
                },
                ...
            ]
        }
    """
    root = ElementTree.fromstring(xml_string)

    # Report metadata
    meta = root.find("report_metadata")
    org_name = _text(meta, "org_name")
    report_id = _text(meta, "report_id")
    email = _text(meta, "email")

    date_range = meta.find("date_range") if meta is not None else None
    date_begin = _ts_to_dt(_text(date_range, "begin")) if date_range is not None else None
    date_end = _ts_to_dt(_text(date_range, "end")) if date_range is not None else None

    # Policy published
    policy_el = root.find("policy_published")
    domain = _text(policy_el, "domain")
    policy = {
        "adkim": _text(policy_el, "adkim", "r"),
        "aspf": _text(policy_el, "aspf", "r"),
        "p": _text(policy_el, "p", "none"),
        "pct": _int(policy_el, "pct", 100),
    }

    # Records
    records: list[dict[str, Any]] = []
    for record_el in root.findall("record"):
        row = record_el.find("row")
        source_ip = _text(row, "source_ip")
        count = _int(row, "count")

        policy_eval = row.find("policy_evaluated") if row is not None else None
        disposition = _text(policy_eval, "disposition", "none")
        dkim_aligned = _text(policy_eval, "dkim", "fail")
        spf_aligned = _text(policy_eval, "spf", "fail")

        # Auth results
        auth_results = record_el.find("auth_results")
        dkim_el = auth_results.find("dkim") if auth_results is not None else None
        spf_el = auth_results.find("spf") if auth_results is not None else None

        records.append({
            "source_ip": source_ip,
            "count": count,
            "disposition": disposition,
            "dkim_domain": _text(dkim_el, "domain"),
            "dkim_result": _text(dkim_el, "result"),
            "dkim_selector": _text(dkim_el, "selector"),
            "spf_domain": _text(spf_el, "domain"),
            "spf_result": _text(spf_el, "result"),
            "dkim_aligned": dkim_aligned,
            "spf_aligned": spf_aligned,
        })

    return {
        "org_name": org_name,
        "report_id": report_id,
        "email": email,
        "date_begin": date_begin,
        "date_end": date_end,
        "domain": domain,
        "policy": policy,
        "records": records,
    }


def summarize_reports(reports_data: list[dict[str, Any]]) -> dict[str, Any]:
    """Aggregate stats across multiple parsed DMARC reports.

    Returns:
        {
            "total_messages": int,
            "pass_rate": {"dkim": float, "spf": float, "aligned": float},
            "top_senders": [{"ip": str, "count": int, "dkim": str, "spf": str}, ...],
            "disposition_breakdown": {"none": int, "quarantine": int, "reject": int},
            "reporters": [str, ...],
        }
    """
    total = 0
    dkim_pass = 0
    spf_pass = 0
    aligned = 0
    dispositions: dict[str, int] = {}
    sender_map: dict[str, dict[str, Any]] = {}
    reporters: set[str] = set()

    for report in reports_data:
        if report.get("org_name"):
            reporters.add(report["org_name"])

        for rec in report.get("records", []):
            count = rec.get("count", 0)
            total += count

            if rec.get("dkim_aligned") == "pass":
                dkim_pass += count
            if rec.get("spf_aligned") == "pass":
                spf_pass += count
            if rec.get("dkim_aligned") == "pass" or rec.get("spf_aligned") == "pass":
                aligned += count

            disp = rec.get("disposition", "none")
            dispositions[disp] = dispositions.get(disp, 0) + count

            ip = rec.get("source_ip", "unknown")
            if ip not in sender_map:
                sender_map[ip] = {"ip": ip, "count": 0, "dkim_pass": 0, "spf_pass": 0}
            sender_map[ip]["count"] += count
            if rec.get("dkim_aligned") == "pass":
                sender_map[ip]["dkim_pass"] += count
            if rec.get("spf_aligned") == "pass":
                sender_map[ip]["spf_pass"] += count

    top_senders = sorted(sender_map.values(), key=lambda x: x["count"], reverse=True)[:20]
    for s in top_senders:
        c = s["count"]
        s["dkim_rate"] = round(s.pop("dkim_pass") / c * 100, 1) if c else 0
        s["spf_rate"] = round(s.pop("spf_pass") / c * 100, 1) if c else 0

    return {
        "total_messages": total,
        "pass_rate": {
            "dkim": round(dkim_pass / total * 100, 1) if total else 0,
            "spf": round(spf_pass / total * 100, 1) if total else 0,
            "aligned": round(aligned / total * 100, 1) if total else 0,
        },
        "top_senders": top_senders,
        "disposition_breakdown": dispositions,
        "reporters": sorted(reporters),
    }

from typing import Any
from urllib.parse import urlparse


def _dns_txt_records(domain: str) -> list[str]:
    try:
        import dns.resolver

        answers = dns.resolver.resolve(domain, "TXT", lifetime=5)
        return [rdata.to_text().strip('"') for rdata in answers]
    except Exception:
        return []


def _check_spf(domain: str) -> dict[str, Any]:
    txt_records = _dns_txt_records(domain)
    spf_records = [r for r in txt_records if r.startswith("v=spf1")]

    if not spf_records:
        return {"found": False, "record": None, "valid": False, "details": "No SPF record found."}

    record = spf_records[0]
    has_all = any(token in record for token in ["-all", "~all", "?all", "+all"])

    warnings = []
    if "+all" in record:
        warnings.append("SPF uses +all which allows any sender — effectively no protection.")
    elif "?all" in record:
        warnings.append("SPF uses ?all (neutral) — provides weak protection.")
    if len(spf_records) > 1:
        warnings.append(f"Multiple SPF records found ({len(spf_records)}). Only one is allowed per RFC 7208.")

    return {
        "found": True,
        "record": record,
        "valid": has_all,
        "mechanism_all": next((t for t in ["-all", "~all", "?all", "+all"] if t in record), None),
        "warnings": warnings,
    }


def _check_dkim(domain: str, selectors: list[str] | None = None) -> dict[str, Any]:
    if selectors is None:
        selectors = ["default", "google", "selector1", "selector2", "k1", "mail", "dkim", "s1", "s2"]

    found_selectors = []
    for selector in selectors:
        dkim_domain = f"{selector}._domainkey.{domain}"
        records = _dns_txt_records(dkim_domain)
        cname_records = []
        try:
            import dns.resolver

            answers = dns.resolver.resolve(dkim_domain, "CNAME", lifetime=5)
            cname_records = [rdata.to_text() for rdata in answers]
        except Exception:
            pass

        if records or cname_records:
            found_selectors.append({
                "selector": selector,
                "record": records[0] if records else None,
                "cname": cname_records[0] if cname_records else None,
            })

    return {
        "found": bool(found_selectors),
        "selectors_checked": selectors,
        "selectors_found": found_selectors,
        "details": "DKIM selectors found." if found_selectors else "No DKIM selectors found in common selector names.",
    }


def _check_dmarc(domain: str) -> dict[str, Any]:
    dmarc_domain = f"_dmarc.{domain}"
    txt_records = _dns_txt_records(dmarc_domain)
    dmarc_records = [r for r in txt_records if r.startswith("v=DMARC1")]

    if not dmarc_records:
        return {"found": False, "record": None, "policy": None, "details": "No DMARC record found."}

    record = dmarc_records[0]
    tags = {}
    for part in record.split(";"):
        part = part.strip()
        if "=" in part:
            key, value = part.split("=", 1)
            tags[key.strip()] = value.strip()

    policy = tags.get("p", "none")
    warnings = []
    if policy == "none":
        warnings.append("DMARC policy is 'none' — no enforcement, monitoring only.")
    if "rua" not in tags:
        warnings.append("No aggregate report URI (rua) configured.")

    return {
        "found": True,
        "record": record,
        "policy": policy,
        "subdomain_policy": tags.get("sp"),
        "percentage": tags.get("pct", "100"),
        "rua": tags.get("rua"),
        "ruf": tags.get("ruf"),
        "warnings": warnings,
    }


def check_email_security(domain: str) -> dict[str, Any]:
    domain = (domain or "").strip().lower()
    if not domain:
        return {"error": "Please provide a domain name."}

    if "://" in domain:
        domain = urlparse(domain).hostname or domain
    domain = domain.split("/")[0].split(":")[0]

    spf = _check_spf(domain)
    dkim = _check_dkim(domain)
    dmarc = _check_dmarc(domain)

    score = 0
    if spf["found"] and spf["valid"]:
        score += 1
    if dkim["found"]:
        score += 1
    if dmarc["found"] and dmarc.get("policy") in ("quarantine", "reject"):
        score += 1

    grade_map = {0: "F", 1: "D", 2: "B", 3: "A"}

    return {
        "domain": domain,
        "spf": spf,
        "dkim": dkim,
        "dmarc": dmarc,
        "score": score,
        "max_score": 3,
        "grade": grade_map.get(score, "F"),
    }

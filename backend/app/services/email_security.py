from typing import Any
from urllib.parse import urlparse


def _dns_txt_records(domain: str) -> list[str]:
    try:
        import dns.resolver

        answers = dns.resolver.resolve(domain, "TXT", lifetime=5)
        # Long TXT records are split into several 255-byte strings; a record's
        # value is their concatenation (RFC 7208 §3.3).
        return [b"".join(rdata.strings).decode("utf-8", errors="replace") for rdata in answers]
    except Exception:
        return []


def _is_spf(record: str) -> bool:
    lowered = record.lower()
    return lowered == "v=spf1" or lowered.startswith("v=spf1 ")


def _all_mechanism(record: str) -> str | None:
    for token in record.split():
        token = token.lower()
        if token in {"-all", "~all", "?all", "+all"}:
            return token
        if token == "all":  # a bare "all" means "+all"
            return "+all"
    return None


def _redirect_target(record: str) -> str | None:
    for token in record.split():
        if token.lower().startswith("redirect="):
            return token.split("=", 1)[1].strip() or None
    return None


def _effective_all_mechanism(record: str, depth: int = 0) -> str | None:
    """The record's "all" policy, following redirect= (RFC 7208 §6.1) up to 3 hops.

    Providers such as Google publish ``v=spf1 redirect=_spf.google.com``, where
    the "all" mechanism lives in the redirected record.
    """
    mechanism = _all_mechanism(record)
    if mechanism or depth >= 3:
        return mechanism
    target = _redirect_target(record)
    if not target:
        return None
    target_records = [r for r in _dns_txt_records(target) if _is_spf(r)]
    if len(target_records) != 1:
        return None
    return _effective_all_mechanism(target_records[0], depth + 1)


def _check_spf(domain: str) -> dict[str, Any]:
    txt_records = _dns_txt_records(domain)
    spf_records = [r for r in txt_records if _is_spf(r)]

    if not spf_records:
        return {"found": False, "record": None, "valid": False, "details": "No SPF record found."}

    record = spf_records[0]
    redirect = None if _all_mechanism(record) else _redirect_target(record)
    all_mechanism = _effective_all_mechanism(record)

    warnings = []
    if all_mechanism == "+all":
        warnings.append("SPF uses +all which allows any sender — effectively no protection.")
    elif all_mechanism == "?all":
        warnings.append("SPF uses ?all (neutral) — provides weak protection.")
    elif not all_mechanism and redirect:
        warnings.append(f"Could not resolve the SPF policy from redirect={redirect}.")
    elif not all_mechanism:
        warnings.append("SPF record has no all mechanism, so unmatched senders are not handled explicitly.")
    if len(spf_records) > 1:
        warnings.append(f"Multiple SPF records found ({len(spf_records)}). Only one is allowed per RFC 7208.")

    return {
        "found": True,
        "record": record,
        "valid": len(spf_records) == 1 and all_mechanism in {"-all", "~all"},
        "mechanism_all": all_mechanism,
        "redirect": redirect,
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
        "details": "DKIM selectors found." if found_selectors else "No DKIM selectors found. Provide selectors used by your mail provider to check custom names.",
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


def check_email_security(domain: str, selectors: list[str] | None = None) -> dict[str, Any]:
    domain = (domain or "").strip().lower()
    if not domain:
        return {"error": "Please provide a domain name."}

    if "://" in domain:
        domain = urlparse(domain).hostname or domain
    domain = domain.split("/")[0].split(":")[0]

    spf = _check_spf(domain)
    dkim = _check_dkim(domain, selectors)
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

from typing import Any
from urllib.parse import urlparse

import dns.exception
import dns.resolver

from app.core.domains import registrable_domain


def _dns_txt_records(domain: str) -> list[str]:
    try:
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


_DEFAULT_DKIM_SELECTORS = ("default", "google", "selector1", "selector2", "k1", "mail", "dkim", "s1", "s2")


def _dns_cname_record(name: str) -> str | None:
    try:
        answers = dns.resolver.resolve(name, "CNAME", lifetime=5)
    except dns.exception.DNSException:
        # No CNAME, no such name, or no answer in time. All of them mean the
        # same thing here: nothing is published at this selector.
        return None
    for rdata in answers:
        return rdata.to_text()
    return None


def _dkim_keys_at(name: str, selectors: list[str]) -> list[dict[str, Any]]:
    """Every selector of *selectors* with a key published under *name*."""
    keys = []
    for selector in selectors:
        target = f"{selector}._domainkey.{name}"
        records = _dns_txt_records(target)
        cname = _dns_cname_record(target)
        if records or cname:
            keys.append({
                "selector": selector,
                "record": records[0] if records else None,
                "cname": cname,
                "found_at": name,
            })
    return keys


def _check_dkim(domain: str, selectors: list[str] | None = None) -> dict[str, Any]:
    """DKIM keys for *domain*, falling back to its organisational domain.

    A selector lives under the domain a message is signed as, which is the
    signature's `d=` tag, and for most setups that is the organisational
    domain rather than the sending host: mail from mail1.example.com is
    normally signed as example.com, so the key is at
    <selector>._domainkey.example.com. Looking only at the host reported "no
    DKIM" for a domain that has it (issue #40).

    Unlike DMARC nothing is inherited here, because DKIM defines no fallback.
    A key found at the organisational domain is reported as found there, and
    it only applies if the host does sign as that domain, which DNS cannot
    tell us.
    """
    selectors = list(selectors) if selectors else list(_DEFAULT_DKIM_SELECTORS)

    found_selectors = _dkim_keys_at(domain, selectors)
    searched = [domain]

    organisational = registrable_domain(domain)
    if not found_selectors and organisational and organisational != domain:
        found_selectors = _dkim_keys_at(organisational, selectors)
        searched.append(organisational)

    found_at = found_selectors[0]["found_at"] if found_selectors else None
    inherited_from = found_at if found_at and found_at != domain else None

    warnings = []
    if inherited_from:
        warnings.append(
            f"No DKIM key under {domain} itself. Found under {inherited_from}, "
            f"which covers mail this host signs as that domain."
        )

    if found_selectors:
        details = "DKIM selectors found."
    elif len(searched) > 1:
        details = (
            f"No DKIM selectors found under {domain} or {searched[1]}. Provide the "
            "selectors used by your mail provider to check custom names."
        )
    else:
        details = (
            "No DKIM selectors found. Provide selectors used by your mail provider "
            "to check custom names."
        )

    return {
        "found": bool(found_selectors),
        "selectors_checked": selectors,
        "selectors_found": found_selectors,
        "domains_searched": searched,
        "inherited_from": inherited_from,
        "details": details,
        "warnings": warnings,
    }


def _dmarc_record_at(name: str) -> str | None:
    for record in _dns_txt_records(f"_dmarc.{name}"):
        if record.startswith("v=DMARC1"):
            return record
    return None


def _check_dmarc(domain: str) -> dict[str, Any]:
    """The DMARC policy in force for *domain*.

    RFC 7489 section 6.6.3: a host without a record of its own is covered by
    the organisational domain's, and the policy that applies to it is that
    record's `sp` tag when it has one, falling back to `p`. So a mail server
    at mail1.example.com inherits example.com's policy; reporting it as having
    no DMARC at all was wrong (issue #40).
    """
    record = _dmarc_record_at(domain)
    inherited_from = None

    if record is None:
        organisational = registrable_domain(domain)
        if organisational and organisational != domain:
            record = _dmarc_record_at(organisational)
            if record is not None:
                inherited_from = organisational

    if record is None:
        return {"found": False, "record": None, "policy": None, "details": "No DMARC record found."}

    tags = {}
    for part in record.split(";"):
        part = part.strip()
        if "=" in part:
            key, value = part.split("=", 1)
            tags[key.strip()] = value.strip()

    # On an inherited record it is `sp` that governs this host, and `p` only
    # when the parent did not say otherwise.
    if inherited_from:
        policy = tags.get("sp") or tags.get("p", "none")
    else:
        policy = tags.get("p", "none")

    warnings = []
    if policy == "none":
        warnings.append("DMARC policy is 'none' — no enforcement, monitoring only.")
    if "rua" not in tags:
        warnings.append("No aggregate report URI (rua) configured.")
    if inherited_from:
        warnings.append(
            f"No DMARC record of its own; covered by {inherited_from} "
            f"({'sp' if tags.get('sp') else 'p'}={policy})."
        )

    return {
        "found": True,
        "record": record,
        "policy": policy,
        "subdomain_policy": tags.get("sp"),
        "percentage": tags.get("pct", "100"),
        "rua": tags.get("rua"),
        "ruf": tags.get("ruf"),
        "inherited_from": inherited_from,
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

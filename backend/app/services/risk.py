"""A 0-100 priority score for one asset, built only from what the checks found.

Why a score at all: `health["status"]` is the worst severity present, which
sorts every asset into one of four buckets. Past a couple of dozen assets that
is not an order, and the operator is left reading names. This turns the same
findings into something that can be ranked.

What it is not. It is not a probability, and nothing here is calibrated against
real outcomes, because there are none to calibrate against. It is a
prioritisation aid: "look at this one before that one". Presented as anything
firmer it would be dishonest.

What keeps it honest:

* Every input is a finding a check produced. Nothing is inferred.
* A listing counts by the severity of the list that carries it, which AbuseBox
  already decodes from that list's own documented return codes. Spamhaus ZEN
  and UCEPROTECT level 1 both mean "listed", and they do not mean the same
  thing.
* The weights are in this file, in one table, and the result says which
  factors produced it. A score you cannot take apart is a number to argue
  with.
* Each factor saturates. The first listing moves the score a long way and the
  sixth barely moves it, because that is how the underlying risk behaves: once
  mail is being refused, more refusals change little.

Deliberately excluded: the `monitoring` issues. An overdue or never-run check
is missing evidence, not a finding. Scoring it would make a stalled scheduler
look like risk, which would send the operator to the wrong place.
"""

import math
from typing import Any

# Share of the total each factor can claim, summing to 100. Ordered by how
# directly the finding stops mail being delivered, which is what the product
# is for.
FACTOR_WEIGHTS: dict[str, int] = {
    "blacklist": 40,      # mail is being refused right now
    "reachability": 20,   # nothing is being delivered at all
    "certificate": 14,    # TLS fails, or is about to
    "domain": 12,         # the name itself lapses
    "email_auth": 8,      # SPF/DKIM/DMARC, which decides filtering not refusal
    "reputation": 6,      # AbuseIPDB, a third party's opinion
}

# What one listing is worth, by the severity AbuseBox assigns that list. These
# come from the list's own documentation, decoded in dnsbl.py, and the spread
# across the 24 lists is 1 critical, 1 high, 6 medium, 13 low and 3 info.
LISTING_WEIGHT: dict[str, float] = {
    "critical": 1.0,
    "high": 0.6,
    "medium": 0.35,
    "low": 0.15,
    "info": 0.05,
}

# How fast a factor saturates. 1.6 puts a single critical listing at 0.80 of
# the blacklist factor, two at 0.96: being on Spamhaus is most of the story,
# and the rest is detail.
_SATURATION = 1.6

# Below this, AbuseIPDB's confidence is noise rather than signal.
_ABUSE_FLOOR = 25

_EMAIL_GRADE = {"F": 1.0, "D": 0.7, "C": 0.4, "B": 0.2, "A": 0.0}


def _saturate(total: float) -> float:
    """0..1 from an unbounded weight sum, with the first unit worth the most."""
    if total <= 0:
        return 0.0
    return 1.0 - math.exp(-_SATURATION * total)


def _blacklist_factor(blacklist: dict | None) -> tuple[float, str | None]:
    if not blacklist:
        return 0.0, None
    counts = blacklist.get("listed_severities") or {}
    if not counts:
        # A result from before severities were kept, or a list AbuseBox has no
        # severity for: fall back to counting, which is what it used to do.
        listed = len(blacklist.get("listed") or [])
        if not listed:
            return 0.0, None
        return _saturate(listed * LISTING_WEIGHT["medium"]), f"listed on {listed}"
    weighted = sum(LISTING_WEIGHT.get(sev, 0.15) * n for sev, n in counts.items())
    if weighted <= 0:
        return 0.0, None
    worst = min(counts, key=lambda sev: list(LISTING_WEIGHT).index(sev) if sev in LISTING_WEIGHT else 9)
    listed = sum(counts.values())
    detail = f"listed on {listed} ({worst})" if listed > 1 else f"listed on 1 ({worst})"
    return _saturate(weighted), detail


def _certificate_factor(ssl: dict | None) -> tuple[float, str | None]:
    if not ssl:
        return 0.0, None
    if not ssl.get("valid"):
        return 1.0, "certificate invalid or expired"
    days = ssl.get("days_remaining")
    if not isinstance(days, int):
        return 0.0, None
    if days <= 3:
        return 0.8, f"certificate expires in {days} d"
    if days <= 14:
        return 0.5, f"certificate expires in {days} d"
    if days <= 30:
        return 0.25, f"certificate expires in {days} d"
    return 0.0, None


def _domain_factor(days: int | None) -> tuple[float, str | None]:
    if not isinstance(days, int):
        return 0.0, None
    if days < 0:
        return 1.0, "domain registration expired"
    if days <= 7:
        return 0.8, f"domain expires in {days} d"
    if days <= 30:
        return 0.4, f"domain expires in {days} d"
    return 0.0, None


def _reachability_factor(server: dict | None) -> tuple[float, str | None]:
    if not server:
        return 0.0, None
    if not server.get("up"):
        reason = server.get("reason") or ""
        if "SSL" in reason:
            return 0.9, "HTTPS fails on the certificate"
        return 1.0, "server down"
    code = server.get("status_code")
    if isinstance(code, int) and code >= 500:
        return 0.5, f"server returns HTTP {code}"
    return 0.0, None


def _email_factor(grade: str | None) -> tuple[float, str | None]:
    value = _EMAIL_GRADE.get((grade or "").upper())
    if not value:
        return 0.0, None
    return value, f"email security grade {grade}"


def _reputation_factor(score: int | None) -> tuple[float, str | None]:
    if not isinstance(score, int) or score <= _ABUSE_FLOOR:
        return 0.0, None
    return (score - _ABUSE_FLOOR) / (100 - _ABUSE_FLOOR), f"AbuseIPDB {score}%"


def risk_score(health: dict[str, Any]) -> dict[str, Any]:
    """A 0-100 score for *health*, with the factors that produced it.

    `factors` lists only what contributed, worst first, so the UI and the API
    can always answer "why is it that number" without recomputing anything.
    """
    factors = {
        "blacklist": _blacklist_factor(health.get("blacklist")),
        "reachability": _reachability_factor(health.get("server")),
        "certificate": _certificate_factor(health.get("ssl")),
        "domain": _domain_factor(health.get("domain_expiry_days")),
        "email_auth": _email_factor(health.get("email_grade")),
        "reputation": _reputation_factor(health.get("abuse_score")),
    }

    contributions = []
    total = 0.0
    for name, (value, detail) in factors.items():
        points = FACTOR_WEIGHTS[name] * value
        total += points
        if points > 0:
            contributions.append({
                "factor": name,
                "points": round(points, 1),
                "of": FACTOR_WEIGHTS[name],
                "detail": detail,
            })

    contributions.sort(key=lambda item: item["points"], reverse=True)
    return {"score": round(total), "factors": contributions}

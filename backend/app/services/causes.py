"""Why each listing happened, whether its cause is fixed, and whether asking
for removal is worth it.

What this does not claim: to know why an address was listed. Nobody outside
the list knows that. What AbuseBox knows is what each list *says* it lists
for, which is documented and recorded in `dnsbl_lists.py`, and, for the two
lists whose condition is visible in DNS, whether that condition still holds.

So for most listings the value is classification: which of six situations
the operator is in, and therefore which action is even possible. For the
SpamRATS reverse-DNS lists it is a real "fixed" or "not fixed". The output
keeps the two apart (`verifiable`, `fixed`) so the interface never presents
a classification as a verification.

Worked out when a result is read, never stored with it, so a correction to
the catalogue applies to every result already saved.
"""

import ipaddress
import re
from dataclasses import dataclass
from typing import Any

from app.services.dnsbl import describe_listing
from app.services.health import split_result


@dataclass(frozen=True)
class Cause:
    label: str
    means: str
    advice: str


CAUSE_TEXT: dict[str, Cause] = {
    "config": Cause(
        "Your configuration",
        "Something in this server's DNS setup that AbuseBox can check for itself.",
        "Fix it, wait for the next check to confirm, then ask for removal.",
    ),
    "compromise": Cause(
        "Compromised host",
        "The list saw this address acting as a bot, an open proxy, or attacking other machines.",
        "Treat it as an incident: find and clean the infection or the open service first. "
        "A removal request while it is still active gets the address relisted, and some lists "
        "slow down repeat requests.",
    ),
    "sending": Cause(
        "Mail that was sent",
        "Mail from this address hit spam traps or drew complaints.",
        "AbuseBox cannot see your outgoing mail. Find what sent it, such as a compromised "
        "account, a web form or a bulk sender, and stop it before asking for removal.",
    ),
    "upstream": Cause(
        "Your provider's range",
        "The listing is about the network range, by its owner's policy or its history, "
        "not about anything this server did.",
        "This is not yours to request. Relay mail through a smarthost or ask your provider for "
        "an address outside the range. Spamhaus PBL has a self-service exclusion for a real mail "
        "server with proper reverse DNS; DROP has none.",
    ),
    "server-policy": Cause(
        "Your mail server's behaviour",
        "The server does something the list objects to that DNS cannot show, such as accepting "
        "mail and later bouncing it to forged senders.",
        "Reject unknown recipients and spam during the SMTP conversation instead of accepting "
        "the message and bouncing it afterwards.",
    ),
    "domain": Cause(
        "Domain reputation",
        "The domain name itself is listed, as it appeared in mail or links, not the address.",
        "Find where the name appeared: a compromised site, a link in a campaign or an abused "
        "redirector. Nothing done to the server's address affects this listing.",
    ),
}

# How firmly each verdict holds back a removal request, weakest first. A
# listing with several causes takes the firmest.
READINESS = ("not_applicable", "ready", "caution", "blocked")

_CLASS_READINESS = {
    "compromise": "blocked",
    "sending": "caution",
    "upstream": "not_applicable",
    "server-policy": "caution",
    "domain": "caution",
}


@dataclass(frozen=True)
class Signals:
    """What AbuseBox already collected that bears on a cause."""

    address: str | None          # the address the blacklists were asked about
    ptr: list[str] | None        # its PTR names; None when never looked up


def _same_address(a: Any, b: Any) -> bool:
    try:
        return ipaddress.ip_address(str(a)) == ipaddress.ip_address(str(b))
    except ValueError:
        return False


def signals_from(results: dict | None) -> Signals:
    parts = split_result(results)
    blacklist = parts.get("blacklist")
    address = blacklist.get("checked_address") if isinstance(blacklist, dict) else None
    dns = parts.get("dns")
    ptr = None
    # Only a reverse lookup of this very address counts. A DNS result saved
    # before 1.6 never held a PTR for an address (it asked for the PTR of the
    # name "8.8.8.8."), so its silence means "not looked up", not "no PTR".
    if (
        address
        and isinstance(dns, dict)
        and not dns.get("error")
        and dns.get("record_types_checked") == ["PTR"]
        and _same_address(dns.get("domain"), address)
    ):
        ptr = [str(name).rstrip(".") for name in (dns.get("records") or {}).get("PTR", [])]
    return Signals(address=address, ptr=ptr)


# --- the two causes AbuseBox can check -------------------------------------------

# Words that mark a reverse name as a pool or an end-user line rather than a
# server. Matched as whole tokens, so "dsl" matches dsl-1-2.example.net but
# not "dslr" or a host merely named "mail-pool-room".
_DYNAMIC_WORDS = frozenset({
    "dyn", "dynamic", "dhcp", "pool", "dsl", "adsl", "vdsl", "xdsl", "cable", "ppp",
    "pppoe", "dialup", "dial", "broadband", "cpe", "residential", "customer", "subscriber",
})


def generic_ptr_reason(name: str, address: str) -> str | None:
    """Why *name* looks like a provider's generic reverse DNS for *address*.

    An approximation of what lists such as SpamRATS Dyna look for, not their
    algorithm: it catches the patterns that are obvious, and a name it passes
    can still be judged generic by the list.
    """
    lowered = name.lower().rstrip(".")
    try:
        ip = ipaddress.ip_address(address)
    except ValueError:
        return None

    if ip.version == 4:
        octets = str(ip).split(".")
        for order in (octets, octets[::-1]):
            if re.search(r"(?<!\d)" + r"[-._]".join(order) + r"(?!\d)", lowered):
                return "it contains the address"
            if "".join(octet.zfill(3) for octet in order) in lowered:
                return "it contains the address"
        if "".join(f"{int(octet):02x}" for octet in octets) in lowered:
            return "it contains the address in hex"
    else:
        squeezed = re.sub(r"[^0-9a-f]", "", lowered)
        if ip.exploded.replace(":", "")[16:] in squeezed or ip.compressed.replace(":", "-") in lowered:
            return "it contains the address"

    for token in re.split(r"[^a-z0-9]+", lowered):
        word = re.sub(r"\d+", "", token)
        if word in _DYNAMIC_WORDS:
            return f'it contains "{word}"'
    return None


_NOT_LOOKED_UP = "AbuseBox has no reverse DNS lookup of {address} to check yet."
_HOW_TO_LOOK = "For an IP asset, turning on the DNS check gives it one."


def _verify_has_ptr(signals: Signals) -> tuple[bool | None, str, str | None]:
    """(fixed, evidence, advice when not fixed) for SpamRATS NoPtr."""
    if signals.ptr is None:
        return None, _NOT_LOOKED_UP.format(address=signals.address), _HOW_TO_LOOK
    if not signals.ptr:
        return False, f"{signals.address} has no reverse DNS (PTR) record.", (
            "Ask whoever controls the address, usually the hosting provider, to set a PTR "
            "record naming this server, such as mail.example.com, and give that name an A "
            "record pointing back here."
        )
    return True, f"{signals.address} has reverse DNS: {signals.ptr[0]}.", None


def _verify_ptr_not_generic(signals: Signals) -> tuple[bool | None, str, str | None]:
    """(fixed, evidence, advice when not fixed) for SpamRATS Dyna."""
    if signals.ptr is None:
        return None, _NOT_LOOKED_UP.format(address=signals.address), _HOW_TO_LOOK
    advice = (
        "Ask the provider to change the PTR to a name of your own, such as mail.example.com, "
        "without the address or words like dyn or pool in it, and give that name an A record "
        "pointing back here."
    )
    if not signals.ptr:
        return False, f"{signals.address} has no reverse DNS at all, which this list treats as generic.", advice
    name = signals.ptr[0]
    reason = generic_ptr_reason(name, signals.address or "")
    if reason:
        return False, f"Reverse DNS {name} still looks generic: {reason}.", advice
    return True, f"Reverse DNS {name} names the server rather than the address.", None


_VERIFIERS = {
    "noptr.spamrats.com": _verify_has_ptr,
    "dyna.spamrats.com": _verify_ptr_not_generic,
}


# --- assessment ------------------------------------------------------------------

def assess_listing(entry: dict, signals: Signals) -> dict[str, Any]:
    """The cause, the evidence and the removal verdict for one listing."""
    provider = entry.get("provider", "")
    described = describe_listing(provider, entry.get("codes") or [])
    causes = described["causes"]
    base = {"provider": provider, "name": described["name"], "causes": causes}

    if not causes:
        return {
            **base, "cause": None, "label": "Not classified",
            "means": "This list is no longer in AbuseBox's catalogue, so it cannot say why it lists.",
            "advice": "Check the list's own lookup page before asking for removal.",
            "verifiable": False, "fixed": None, "evidence": None, "readiness": "caution",
        }

    verdicts = []
    for cause in causes:
        fixed, evidence, advice = None, None, CAUSE_TEXT[cause].advice
        verify = _VERIFIERS.get(provider) if cause == "config" else None
        if verify is not None:
            fixed, evidence, unfixed_advice = verify(signals)
            readiness = {True: "ready", False: "blocked", None: "caution"}[fixed]
            advice = "The cause looks fixed, so removal should hold." if fixed else unfixed_advice
        else:
            readiness = _CLASS_READINESS.get(cause, "caution")
        verdicts.append({"cause": cause, "fixed": fixed, "evidence": evidence,
                         "advice": advice, "readiness": readiness, "verifiable": verify is not None})

    primary = max(verdicts, key=lambda verdict: READINESS.index(verdict["readiness"]))
    text = CAUSE_TEXT[primary["cause"]]
    return {
        **base,
        "cause": primary["cause"],
        "label": text.label,
        "means": text.means,
        "advice": primary["advice"],
        "verifiable": primary["verifiable"],
        "fixed": primary["fixed"],
        "evidence": primary["evidence"],
        "readiness": primary["readiness"],
    }


def assess(results: dict | None) -> list[dict[str, Any]]:
    """An assessment for every listing in a saved result, most serious first."""
    blacklist = split_result(results).get("blacklist")
    if not isinstance(blacklist, dict) or blacklist.get("error"):
        return []
    signals = signals_from(results)
    return [assess_listing(entry, signals) for entry in blacklist.get("detected_on") or []]

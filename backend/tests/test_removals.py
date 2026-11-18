"""Removal requests (1.6): the verdict they were made on, and whether they held."""

from datetime import UTC, datetime, timedelta
from unittest import mock

import pytest

from app.db.session import SessionLocal
from app.models import RemovalRequest
from app.services import removals

ADDRESS = "203.0.113.40"
LISTS = ("noptr.spamrats.com", "dnsbl.dronebl.org", "b.barracudacentral.org", "bl.spamcop.net")


def _check(*listed, failed=(), inconclusive=False, ptr=None):
    """A check result as the monitor saves it."""
    result = {"blacklist": {
        "hostname": ADDRESS, "checked_address": ADDRESS,
        "detected_on": [{"provider": p, "codes": ["127.0.0.2"], "severity": "low", "status": "open"} for p in listed],
        "providers": list(LISTS), "failed_providers": list(failed),
        "is_inconclusive": inconclusive, "is_blacklisted": bool(listed),
    }}
    if ptr is not None:
        result["mail_server"] = {
            "address": ADDRESS,
            "reverse_dns": {"ptr": ptr, "forward_confirmed": bool(ptr), "confirmed_name": ptr[0] if ptr else None},
            "smtp": {"state": "closed"},
        }
    return result


@pytest.fixture
def asset(client, admin_headers):
    response = client.post("/hostname/", json={
        "hostname_type": "ipv4", "hostname": ADDRESS, "check_blacklist": False, "check_mail_server": False,
    }, headers=admin_headers)
    assert response.status_code == 200, response.text
    return response.json()


def _recheck(client, headers, asset, result):
    with mock.patch("app.api.routers.hostname.run_enabled_checks", return_value=result):
        response = client.post(f"/hostname/{asset['id']}/recheck/", headers=headers)
    assert response.status_code == 200, response.text


def _current_check_id(client, headers, asset):
    return client.get(f"/hostname/{asset['id']}/history/", headers=headers).json()["history"][-1]["id"]


def _request(client, headers, asset, provider, **extra):
    response = client.post("/blacklist/delist/", json={
        "provider": provider,
        "delist_required_data": {"id": _current_check_id(client, headers, asset), "comment": "ticket 42"},
        **extra,
    }, headers=headers)
    assert response.status_code == 200, response.text
    return response.json()["request"]


def _report(client, headers, asset):
    response = client.get(f"/hostname/{asset['id']}/listings/", headers=headers)
    assert response.status_code == 200, response.text
    return response.json()


# --- the request and its verdict --------------------------------------------------------

def test_a_request_keeps_the_verdict_it_was_made_on(client, admin_headers, asset):
    _recheck(client, admin_headers, asset, _check("dnsbl.dronebl.org"))
    request = _request(client, admin_headers, asset, "dnsbl.dronebl.org",
                       override_reason="Infected box replaced, ticket 42")
    assert request["state"] == "requested"
    assert request["readiness"] == "blocked"          # compromise: clean it first
    assert request["override_reason"] == "Infected box replaced, ticket 42"
    assert request["note"] == "ticket 42"
    assert request["name"] == "DroneBL"


def test_the_api_does_not_require_a_reason(client, admin_headers, asset):
    # Scripts written against 1.5 send no override_reason; they keep working.
    _recheck(client, admin_headers, asset, _check("dnsbl.dronebl.org"))
    assert _request(client, admin_headers, asset, "dnsbl.dronebl.org")["override_reason"] is None


# --- following it ---------------------------------------------------------------------------

def test_requested_survives_the_next_check(client, admin_headers, asset):
    # Before 1.6 the next check rebuilt every listing as "open".
    _recheck(client, admin_headers, asset, _check("bl.spamcop.net"))
    _request(client, admin_headers, asset, "bl.spamcop.net")
    _recheck(client, admin_headers, asset, _check("bl.spamcop.net"))
    latest = client.get(f"/hostname/{asset['id']}", headers=admin_headers).json()
    [entry] = latest["result"]["blacklist"]["detected_on"]
    assert entry["status"] == "requested"
    assert entry["requested_at"]


def test_cleared_then_relisted(client, admin_headers, asset):
    _recheck(client, admin_headers, asset, _check("bl.spamcop.net"))
    _request(client, admin_headers, asset, "bl.spamcop.net")

    _recheck(client, admin_headers, asset, _check())
    [request] = _report(client, admin_headers, asset)["requests"]
    assert request["state"] == "cleared"
    assert request["hours_to_clear"] is not None

    _recheck(client, admin_headers, asset, _check("bl.spamcop.net"))
    report = _report(client, admin_headers, asset)
    assert report["requests"][0]["state"] == "relisted"
    # The relisting is attached to the listing it caused.
    [listing] = report["listings"]
    assert listing["request"]["state"] == "relisted"


@pytest.mark.parametrize("check", [
    _check(failed=("bl.spamcop.net",)),           # the list did not answer
    _check(inconclusive=True),                     # too many lists did not answer
    {"blacklist": {"error": "resolver refused"}},  # the check failed outright
])
def test_silence_is_not_a_removal(client, admin_headers, asset, check):
    _recheck(client, admin_headers, asset, _check("bl.spamcop.net"))
    _request(client, admin_headers, asset, "bl.spamcop.net")
    _recheck(client, admin_headers, asset, check)
    assert _report(client, admin_headers, asset)["requests"][0]["state"] == "requested"


def test_a_listing_after_the_window_is_a_new_episode(client, admin_headers, asset):
    _recheck(client, admin_headers, asset, _check("bl.spamcop.net"))
    _request(client, admin_headers, asset, "bl.spamcop.net")
    _recheck(client, admin_headers, asset, _check())
    with SessionLocal() as db:
        request = db.query(RemovalRequest).one()
        request.cleared_at = datetime.now(UTC) - removals.RELIST_WINDOW - timedelta(hours=1)
        db.commit()

    _recheck(client, admin_headers, asset, _check("bl.spamcop.net"))
    report = _report(client, admin_headers, asset)
    assert report["requests"][0]["state"] == "held"
    assert report["listings"][0]["request"] is None


# --- the report and the request text ---------------------------------------------------------

def test_the_report_explains_each_listing(client, admin_headers, asset):
    _recheck(client, admin_headers, asset, _check("dnsbl.dronebl.org", "bl.spamcop.net"))
    report = _report(client, admin_headers, asset)
    by_provider = {listing["provider"]: listing for listing in report["listings"]}
    assert by_provider["dnsbl.dronebl.org"]["cause"] == "compromise"
    assert by_provider["dnsbl.dronebl.org"]["readiness"] == "blocked"
    assert by_provider["bl.spamcop.net"]["cause"] == "sending"
    assert by_provider["bl.spamcop.net"]["first_seen"]


def test_request_text_for_a_cause_abusebox_cannot_see(client, admin_headers, asset):
    _recheck(client, admin_headers, asset, _check("bl.spamcop.net"))
    text = _report(client, admin_headers, asset)["listings"][0]["request_text"]
    assert text.startswith(f"Removal request for {ADDRESS} on SpamCop (bl.spamcop.net)")
    assert "First seen listed:" in text
    assert "Not listed on 3 other blacklists checked at the same time." in text
    # The part only the operator knows is left as a gap, not invented.
    assert "[What you found and what you changed." in text


def test_request_text_for_a_fixed_reverse_dns(client, admin_headers, asset):
    _recheck(client, admin_headers, asset, _check("noptr.spamrats.com", ptr=[]))
    _recheck(client, admin_headers, asset, _check("noptr.spamrats.com", ptr=["mail.example.net"]))
    _recheck(client, admin_headers, asset, _check("noptr.spamrats.com", ptr=["mail.example.net"]))
    [listing] = _report(client, admin_headers, asset)["listings"]
    assert listing["fixed"] is True and listing["readiness"] == "ready"
    assert listing["fixed_since"]
    text = listing["request_text"]
    assert f"- {ADDRESS} has reverse DNS: mail.example.net. In place since " in text
    assert "Reverse DNS mail.example.net points back to 203.0.113.40." in text
    assert "The condition this list names is fixed, as shown above." in text


def test_fixed_since_starts_after_the_last_check_that_was_not(client, admin_headers, asset):
    _recheck(client, admin_headers, asset, _check("noptr.spamrats.com", ptr=["mail.example.net"]))
    _recheck(client, admin_headers, asset, _check("noptr.spamrats.com", ptr=[]))
    _recheck(client, admin_headers, asset, _check("noptr.spamrats.com", ptr=["mail.example.net"]))
    history = client.get(f"/hostname/{asset['id']}/history/", headers=admin_headers).json()["history"]
    first, _, newest = (datetime.fromisoformat(check["date"]) for check in history[-3:])
    [listing] = _report(client, admin_headers, asset)["listings"]
    # Only the newest check counts: the one before it had no PTR, so the
    # first check's PTR is not part of an unbroken run.
    fixed_since = datetime.fromisoformat(listing["fixed_since"])
    assert fixed_since == newest
    assert fixed_since != first


def test_listings_of_another_account_are_not_readable(client, admin_headers, asset):
    client.post("/user/create/", json={"username": "bob", "password": "Bob-password-1", "email": "bob@example.net"},
                headers=admin_headers)
    login = client.post("/user/login/", json={"username": "bob", "password": "Bob-password-1"}).json()
    bob = {"Authorization": f"Bearer {login['access']}"}
    assert client.get(f"/hostname/{asset['id']}/listings/", headers=bob).status_code == 404

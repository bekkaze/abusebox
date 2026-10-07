"""API behaviour: auth, permissions, assets, delist."""

from app.db.session import SessionLocal
from app.models import CheckHistory, Hostname


def _login(client, username, password):
    return client.post("/user/login/", json={"username": username, "password": password})


def _bearer(token):
    return {"Authorization": f"Bearer {token}"}


# --- auth & permissions -----------------------------------------------------

def test_public_registration_is_disabled(client):
    response = client.post("/user/create/", json={
        "username": "mallory", "email": "m@example.com", "phone_number": "12345", "password": "password123",
    })
    assert response.status_code == 401


def test_admin_can_create_users_but_users_cannot(client, admin_headers):
    payload = {"username": "alice", "email": "a@example.com", "phone_number": "12345", "password": "password123"}
    assert client.post("/user/create/", json=payload, headers=admin_headers).status_code == 200

    alice = _bearer(_login(client, "alice", "password123").json()["access"])
    payload2 = {"username": "bob", "email": "b@example.com", "phone_number": "12345", "password": "password123"}
    assert client.post("/user/create/", json=payload2, headers=alice).status_code == 403
    assert client.put("/settings/scheduler/", json={"scheduler_enabled": False, "scheduler_interval_minutes": 60}, headers=alice).status_code == 403


def test_change_password_revokes_old_tokens(client):
    first = _login(client, "admin", "password123").json()
    response = client.post(
        "/user/change-password/",
        json={"current_password": "password123", "new_password": "a-much-better-password"},
        headers=_bearer(first["access"]),
    )
    assert response.status_code == 200
    fresh = response.json()

    # Tokens from before the change no longer work; the returned pair does.
    assert client.get("/user/me/", headers=_bearer(first["access"])).status_code == 401
    assert client.post("/user/token/refresh/", json={"refresh": first["refresh"]}).status_code == 401
    assert client.get("/user/me/", headers=_bearer(fresh["access"])).status_code == 200
    assert _login(client, "admin", "password123").status_code == 401
    assert _login(client, "admin", "a-much-better-password").status_code == 200


def test_change_password_requires_current_password(client, admin_headers):
    response = client.post(
        "/user/change-password/",
        json={"current_password": "wrong-password", "new_password": "a-much-better-password"},
        headers=admin_headers,
    )
    assert response.status_code == 400


def test_login_lockout_after_repeated_failures(client):
    for _ in range(5):
        assert _login(client, "admin", "wrong-password").status_code == 401
    assert _login(client, "admin", "password123").status_code == 429


def test_login_lockout_is_per_client_behind_proxy(client):
    # Through the bundled proxy every request comes from the frontend
    # container's address; an attacker's failures must not lock out others.
    from fastapi.testclient import TestClient

    from app.main import app

    proxied = TestClient(app, client=("172.18.0.3", 40000))
    for _ in range(5):
        proxied.post("/user/login/", json={"username": "admin", "password": "wrong-password"},
                     headers={"X-Forwarded-For": "1.2.3.4"})
    blocked = proxied.post("/user/login/", json={"username": "admin", "password": "password123"},
                           headers={"X-Forwarded-For": "1.2.3.4"})
    assert blocked.status_code == 429
    victim = proxied.post("/user/login/", json={"username": "admin", "password": "password123"},
                          headers={"X-Forwarded-For": "9.9.9.9"})
    assert victim.status_code == 200


def test_tool_endpoints_require_auth(client):
    for path in ("/tools/dns/?hostname=example.com", "/tools/whois/?hostname=example.com", "/tools/server-status/?hostname=example.com"):
        assert client.get(path).status_code == 401


def test_dkim_selector_validation(client, admin_headers):
    bad = client.get("/tools/email-security/?hostname=example.com&dkim_selectors=..%2Fx", headers=admin_headers)
    assert bad.status_code == 400
    many = ",".join(f"s{i}" for i in range(21))
    assert client.get(f"/tools/email-security/?hostname=example.com&dkim_selectors={many}", headers=admin_headers).status_code == 400


# --- assets -----------------------------------------------------------------

def _create_asset(client, headers, hostname="203.0.113.10", **overrides):
    payload = {"hostname_type": "ipv4", "hostname": hostname, "check_blacklist": False, **overrides}
    response = client.post("/hostname/", json=payload, headers=headers)
    assert response.status_code == 200, response.text
    return response.json()


def test_asset_detail_includes_latest_result(client, admin_headers):
    asset = _create_asset(client, admin_headers)
    with SessionLocal() as db:
        db.add(CheckHistory(hostname_id=asset["id"], result={"dns": {"records": {}}}, status="historical"))
        db.add(CheckHistory(hostname_id=asset["id"], result={"dns": {"records": {"A": ["203.0.113.10"]}}}, status="current"))
        db.commit()

    detail = client.get(f"/hostname/{asset['id']}", headers=admin_headers).json()
    assert detail["result"]["dns"]["records"] == {"A": ["203.0.113.10"]}
    assert isinstance(detail["result"]["id"], int)
    assert detail["created"].endswith("Z")

    listed = client.get("/hostname/list/", headers=admin_headers).json()
    assert listed[0]["result"] == detail["result"]


def test_update_asset_rejects_duplicate_hostname(client, admin_headers):
    _create_asset(client, admin_headers, "203.0.113.10")
    second = _create_asset(client, admin_headers, "203.0.113.11")
    payload = {
        "hostname_type": "ipv4", "hostname": "203.0.113.10", "is_alert_enabled": False,
        "is_monitor_enabled": True, "status": "active", "check_interval_minutes": 30,
    }
    assert client.put(f"/hostname/{second['id']}", json=payload, headers=admin_headers).status_code == 400
    payload["hostname"] = "203.0.113.11"
    updated = client.put(f"/hostname/{second['id']}", json=payload, headers=admin_headers)
    assert updated.status_code == 200
    assert updated.json()["check_interval_minutes"] == 30


def test_bulk_create_keeps_check_interval(client, admin_headers):
    payload = {"hostnames": [
        {"hostname_type": "domain", "hostname": "example.org", "check_interval_minutes": 15},
        {"hostname_type": "domain", "hostname": "example.org"},
    ]}
    result = client.post("/hostname/bulk/", json=payload, headers=admin_headers).json()
    assert result == {"created": 1, "skipped": 1, "errors": []}
    with SessionLocal() as db:
        assert db.query(Hostname).one().check_interval_minutes == 15


def test_users_cannot_see_each_others_assets(client, admin_headers):
    asset = _create_asset(client, admin_headers)
    client.post("/user/create/", json={
        "username": "alice", "email": "a@example.com", "phone_number": "12345", "password": "password123",
    }, headers=admin_headers)
    alice = _bearer(_login(client, "alice", "password123").json()["access"])
    assert client.get(f"/hostname/{asset['id']}", headers=alice).status_code == 404
    assert client.get("/hostname/list/", headers=alice).json() == []


# --- delist -----------------------------------------------------------------

def _listed_result():
    return {
        "blacklist": {
            "detected_on": [{"provider": "zen.spamhaus.org", "categories": ["unknown"], "status": "open"}],
            "providers": ["zen.spamhaus.org", "bl.spamcop.net"],
            "failed_providers": [],
            "is_blacklisted": True,
        },
    }


def test_delist_updates_nested_blacklist_result(client, admin_headers):
    asset = _create_asset(client, admin_headers)
    with SessionLocal() as db:
        check = CheckHistory(hostname_id=asset["id"], result=_listed_result(), status="current")
        db.add(check)
        db.commit()
        check_id = check.id

    response = client.post("/blacklist/delist/", json={
        "provider": "zen.spamhaus.org",
        "delist_required_data": {"id": check_id, "comment": "Fixed the compromised mailbox"},
    }, headers=admin_headers)
    assert response.status_code == 200, response.text

    # The change must actually be persisted, not just echoed back.
    with SessionLocal() as db:
        stored = db.get(CheckHistory, check_id).result
    entry = stored["blacklist"]["detected_on"][0]
    assert entry["status"] == "requested"
    assert entry["note"] == "Fixed the compromised mailbox"
    assert "detected_on" not in stored  # no stray top-level key


def test_delist_rejects_provider_not_listed(client, admin_headers):
    asset = _create_asset(client, admin_headers)
    with SessionLocal() as db:
        check = CheckHistory(hostname_id=asset["id"], result=_listed_result(), status="current")
        db.add(check)
        db.commit()
        check_id = check.id
    response = client.post("/blacklist/delist/", json={
        "provider": "bl.spamcop.net", "delist_required_data": {"id": check_id},
    }, headers=admin_headers)
    assert response.status_code == 400

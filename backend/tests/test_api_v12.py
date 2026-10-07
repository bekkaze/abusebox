"""v1.2 API: events, health, bulk actions, notifications, users, retention."""

from datetime import datetime, timedelta, timezone
from unittest import mock

import pytest

from app.db.session import SessionLocal
from app.models import AssetEvent, CheckHistory
from app.services import monitoring


def _bearer(token):
    return {"Authorization": f"Bearer {token}"}


def _listed(*providers):
    return {"blacklist": {
        "detected_on": [{"provider": p, "status": "open"} for p in providers],
        "providers": ["a", "b", "c"], "failed_providers": [], "is_inconclusive": False,
        "is_blacklisted": bool(providers), "hostname": "203.0.113.10",
    }}


class _SyncThread:
    """Runs the notification thread inline so tests can assert on it."""

    def __init__(self, target=None, kwargs=None, **_):
        self._target, self._kwargs = target, kwargs or {}

    def start(self):
        self._target(**self._kwargs)


@pytest.fixture()
def asset(client, admin_headers):
    response = client.post("/hostname/", json={
        "hostname_type": "ipv4", "hostname": "203.0.113.10", "check_blacklist": False, "is_alert_enabled": True,
    }, headers=admin_headers)
    assert response.status_code == 200, response.text
    return response.json()


def _recheck(client, headers, asset_id, result):
    with mock.patch("app.api.routers.hostname.run_enabled_checks", return_value=result):
        response = client.post(f"/hostname/{asset_id}/recheck/", headers=headers)
    assert response.status_code == 200, response.text
    return response.json()


def test_recheck_records_events_and_alerts(client, admin_headers, asset):
    with mock.patch.object(monitoring.threading, "Thread", _SyncThread), \
            mock.patch.object(monitoring, "notify_events") as notify:
        updated = _recheck(client, admin_headers, asset["id"], _listed("a"))
        assert updated["is_blacklisted"] is True
        assert notify.call_count == 1
        assert notify.call_args.kwargs["events"][0]["event_type"] == "blacklist.listed"
        assert notify.call_args.kwargs["user_email"] == "admin@abusebox.local"

        _recheck(client, admin_headers, asset["id"], _listed("a"))  # unchanged: no event
        assert notify.call_count == 1

        cleared = _recheck(client, admin_headers, asset["id"], _listed())
        assert cleared["is_blacklisted"] is False
        assert notify.call_args.kwargs["events"][0]["event_type"] == "blacklist.delisted"

    events = client.get(f"/hostname/{asset['id']}/events/", headers=admin_headers).json()
    assert [e["event_type"] for e in events] == ["blacklist.delisted", "blacklist.listed"]
    feed = client.get("/events/?severity=critical", headers=admin_headers).json()
    assert [e["event_type"] for e in feed] == ["blacklist.listed"]
    assert feed[0]["hostname"] == "203.0.113.10"


def test_no_alerts_when_alerts_disabled(client, admin_headers):
    asset = client.post("/hostname/", json={"hostname_type": "ipv4", "hostname": "203.0.113.11", "check_blacklist": False},
                        headers=admin_headers).json()
    with mock.patch.object(monitoring.threading, "Thread", _SyncThread), \
            mock.patch.object(monitoring, "notify_events") as notify:
        _recheck(client, admin_headers, asset["id"], _listed("a"))
    notify.assert_not_called()
    # ...but the event is still logged.
    assert len(client.get(f"/hostname/{asset['id']}/events/", headers=admin_headers).json()) == 1


def test_list_health_and_light_mode(client, admin_headers, asset):
    _recheck(client, admin_headers, asset["id"], _listed("a"))
    full = client.get("/hostname/list/", headers=admin_headers).json()[0]
    assert full["result"]["blacklist"]["is_blacklisted"] is True
    assert full["health"]["status"] == "critical"
    assert full["last_checked"].endswith("Z")
    light = client.get("/hostname/list/?include_result=false", headers=admin_headers).json()[0]
    assert light["result"] is None
    assert light["health"]["issues"][0]["kind"] == "blacklist"


def test_check_detail_links_previous_check(client, admin_headers, asset):
    _recheck(client, admin_headers, asset["id"], _listed())
    _recheck(client, admin_headers, asset["id"], _listed("a"))
    history = client.get(f"/hostname/{asset['id']}/history/", headers=admin_headers).json()["history"]
    first, second = history[0]["id"], history[1]["id"]
    detail = client.get(f"/hostname/{asset['id']}/checks/{second}", headers=admin_headers).json()
    assert detail["previous_id"] == first
    assert detail["result"]["blacklist"]["detected_on"][0]["provider"] == "a"
    assert client.get(f"/hostname/{asset['id']}/checks/999999", headers=admin_headers).status_code == 404


def test_bulk_actions(client, admin_headers):
    ids = []
    for host in ("203.0.113.20", "203.0.113.21", "203.0.113.22"):
        ids.append(client.post("/hostname/", json={"hostname_type": "ipv4", "hostname": host, "check_blacklist": False},
                               headers=admin_headers).json()["id"])

    result = client.post("/hostname/bulk-action/", json={"ids": ids[:2], "action": "enable_monitoring"}, headers=admin_headers).json()
    assert result["affected"] == 2
    listed = {h["id"]: h for h in client.get("/hostname/list/", headers=admin_headers).json()}
    assert listed[ids[0]]["is_monitor_enabled"] and not listed[ids[2]]["is_monitor_enabled"]

    with mock.patch("app.api.routers.hostname.queue_rechecks", return_value=2) as queue:
        result = client.post("/hostname/bulk-action/", json={"ids": ids[:2], "action": "recheck"}, headers=admin_headers).json()
    assert result == {"affected": 2, "queued": 2}
    assert sorted(queue.call_args.args[0]) == sorted(ids[:2])

    assert client.post("/hostname/bulk-action/", json={"ids": [ids[2]], "action": "delete"}, headers=admin_headers).json()["affected"] == 1
    assert client.get(f"/hostname/{ids[2]}", headers=admin_headers).status_code == 404
    assert client.post("/hostname/bulk-action/", json={"ids": ids, "action": "explode"}, headers=admin_headers).status_code == 422


def test_bulk_actions_only_touch_own_assets(client, admin_headers, asset):
    client.post("/user/create/", json={"username": "alice", "email": "a@example.com", "phone_number": "12345", "password": "password123"}, headers=admin_headers)
    alice = _bearer(client.post("/user/login/", json={"username": "alice", "password": "password123"}).json()["access"])
    result = client.post("/hostname/bulk-action/", json={"ids": [asset["id"]], "action": "delete"}, headers=alice).json()
    assert result["affected"] == 0
    assert client.get(f"/hostname/{asset['id']}", headers=admin_headers).status_code == 200
    assert client.get("/events/", headers=alice).json() == []


# --- settings -----------------------------------------------------------------------

def test_notification_settings_round_trip_and_masking(client, admin_headers):
    body = client.get("/settings/notifications/", headers=admin_headers).json()
    assert body["notify_on_delisted"] is True and body["email_configured"] is False

    update = {"notify_on_delisted": False, "notify_on_server_down": True, "ssl_expiry_warning_days": 7,
              "domain_expiry_warning_days": 0, "webhook_url": "https://hooks.slack.com/services/T000/B000/secret-token"}
    saved = client.put("/settings/notifications/", json=update, headers=admin_headers).json()
    assert saved["webhook_source"] == "settings" and saved["webhook_configured"] is True

    client.post("/user/create/", json={"username": "alice", "email": "a@example.com", "phone_number": "12345", "password": "password123"}, headers=admin_headers)
    alice = _bearer(client.post("/user/login/", json={"username": "alice", "password": "password123"}).json()["access"])
    seen = client.get("/settings/notifications/", headers=alice).json()
    assert "secret-token" not in seen["webhook_url"]
    assert client.put("/settings/notifications/", json=update, headers=alice).status_code == 403

    bad = {**update, "webhook_url": "ftp://example.com"}
    assert client.put("/settings/notifications/", json=bad, headers=admin_headers).status_code == 400


def test_test_notification_reports_each_channel(client, admin_headers):
    client.put("/settings/notifications/", json={
        "notify_on_delisted": True, "notify_on_server_down": True, "ssl_expiry_warning_days": 14,
        "domain_expiry_warning_days": 30, "webhook_url": "https://hooks.example.com/abusebox",
    }, headers=admin_headers)
    with mock.patch("app.services.notifications.post_webhook", return_value=(True, None)) as post:
        result = client.post("/settings/notifications/test/", headers=admin_headers).json()
    assert result["email"]["status"] == "not_configured"
    assert result["webhook"]["status"] == "sent"
    assert post.call_args.args[0] == "https://hooks.example.com/abusebox"


def test_scheduler_status_and_retention_setting(client, admin_headers):
    status = client.get("/settings/scheduler/status/", headers=admin_headers).json()
    assert {"running", "enabled", "due_assets", "monitored_assets", "last_cycle_finished"} <= set(status)

    saved = client.put("/settings/scheduler/", json={"scheduler_enabled": False, "scheduler_interval_minutes": 60, "history_retention_days": 90},
                       headers=admin_headers).json()
    assert saved["history_retention_days"] == 90
    # Older clients that omit the field leave it unchanged.
    saved = client.put("/settings/scheduler/", json={"scheduler_enabled": False, "scheduler_interval_minutes": 30}, headers=admin_headers).json()
    assert saved["history_retention_days"] == 90

    with mock.patch("app.api.routers.settings.run_cycle"):
        assert client.post("/settings/scheduler/run/", headers=admin_headers).status_code == 202


def test_retention_prunes_only_old_history(client, admin_headers, asset):
    old = datetime.now(timezone.utc) - timedelta(days=100)
    with SessionLocal() as db:
        db.add(CheckHistory(hostname_id=asset["id"], result={}, status="historical", created=old))
        db.add(CheckHistory(hostname_id=asset["id"], result={}, status="historical"))
        db.add(CheckHistory(hostname_id=asset["id"], result={}, status="current", created=old))
        db.add(AssetEvent(hostname_id=asset["id"], event_type="server.down", severity="critical", title="x", created=old))
        db.commit()
        removed = monitoring.prune_history(db, 30)
        assert removed == {"checks": 1, "events": 1}
        assert db.query(CheckHistory).filter(CheckHistory.status == "current").count() == 1
        assert monitoring.prune_history(db, 0) == {"checks": 0, "events": 0}


# --- users ----------------------------------------------------------------------------

def test_me_flags_default_password(client, admin_headers):
    assert client.get("/user/me/", headers=admin_headers).json()["using_default_password"] is True
    tokens = client.post("/user/change-password/", json={"current_password": "password123", "new_password": "another-password"},
                         headers=admin_headers).json()
    assert client.get("/user/me/", headers=_bearer(tokens["access"])).json()["using_default_password"] is False


def test_admin_user_management(client, admin_headers):
    created = client.post("/user/create/", json={"username": "bob", "email": "b@example.com", "phone_number": "12345", "password": "password123"},
                          headers=admin_headers).json()
    users = client.get("/user/list/", headers=admin_headers).json()
    assert [u["username"] for u in users] == ["admin", "bob"]

    bob_token = client.post("/user/login/", json={"username": "bob", "password": "password123"}).json()["access"]
    assert client.get("/user/list/", headers=_bearer(bob_token)).status_code == 403

    # Password reset signs bob out and the new password works.
    assert client.patch(f"/user/{created['id']}/", json={"new_password": "reset-password-1"}, headers=admin_headers).status_code == 200
    assert client.get("/user/me/", headers=_bearer(bob_token)).status_code == 401
    assert client.post("/user/login/", json={"username": "bob", "password": "reset-password-1"}).status_code == 200

    # Deactivated users can't sign in.
    client.patch(f"/user/{created['id']}/", json={"is_active": False}, headers=admin_headers)
    assert client.post("/user/login/", json={"username": "bob", "password": "reset-password-1"}).status_code == 403


def test_admin_cannot_lock_themselves_out(client, admin_headers):
    admin_id = client.get("/user/me/", headers=admin_headers).json()["id"]
    assert client.patch(f"/user/{admin_id}/", json={"is_superuser": False}, headers=admin_headers).status_code == 400
    assert client.patch(f"/user/{admin_id}/", json={"is_active": False}, headers=admin_headers).status_code == 400

"""1.3.2 security fixes: asset input, schedule abuse, alert text, sign-in, WHOIS, quick check."""

import dataclasses
import os
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest import mock

import pytest
from passlib.hash import pbkdf2_sha256

from app.core.config import settings
from app.db.session import SessionLocal
from app.models import User
from app.services import dnsbl, notifications, whois_lookup


def _bearer(token):
    return {"Authorization": f"Bearer {token}"}


def _login(client, username, password):
    return client.post("/user/login/", json={"username": username, "password": password})


@pytest.fixture()
def bob(client, admin_headers):
    created = client.post("/user/create/", json={"username": "bob", "email": "bob@example.com", "password": "bob-password"},
                          headers=admin_headers)
    assert created.status_code == 200, created.text
    return _bearer(_login(client, "bob", "bob-password").json()["access"])


def _asset(**overrides):
    return {"hostname_type": "domain", "hostname": "example.com", "check_blacklist": False, **overrides}


# --- assets: names, intervals, limits ---------------------------------------------

@pytest.mark.parametrize("hostname", [
    "example.com\r\nBcc: victim@example.com",
    "<!channel>",
    "127.0.0.2/@everyone re-login now",
    "ftp://example.com",
    "example..com",
])
def test_asset_names_that_are_not_targets_are_rejected(client, bob, hostname):
    response = client.post("/hostname/", json=_asset(hostname=hostname), headers=bob)
    assert response.status_code == 422


@pytest.mark.parametrize("hostname", ["example.com", "203.0.113.10", "https://example.com/health", "mail.example.com:8443"])
def test_real_targets_are_accepted(client, bob, hostname):
    assert client.post("/hostname/", json=_asset(hostname=hostname), headers=bob).status_code == 200


@pytest.mark.parametrize("minutes,expected", [(-5, 422), (0, 422), (1, 422), (14, 422), (15, 200), (10080, 200), (10081, 422)])
def test_check_interval_is_bounded(client, bob, minutes, expected):
    response = client.post("/hostname/", json=_asset(check_interval_minutes=minutes), headers=bob)
    assert response.status_code == expected


def test_type_and_status_are_keywords(client, bob):
    assert client.post("/hostname/", json=_asset(hostname_type="<b>x</b>"), headers=bob).status_code == 422
    asset = client.post("/hostname/", json=_asset(), headers=bob).json()
    update = {**_asset(), "is_alert_enabled": False, "is_monitor_enabled": False, "status": "active\r\nx"}
    assert client.put(f"/hostname/{asset['id']}", json=update, headers=bob).status_code == 422


def test_scheduler_ignores_too_short_stored_intervals():
    # Releases before 1.3.2 accepted any interval, so old rows may hold -5 or 1.
    from app.services.scheduler import _is_asset_due

    checked_a_minute_ago = datetime.now(timezone.utc) - timedelta(minutes=1)
    for stored in (-5, 1):
        asset = SimpleNamespace(last_checked=checked_a_minute_ago, check_interval_minutes=stored)
        assert _is_asset_due(asset, 360) is False
    asset = SimpleNamespace(last_checked=datetime.now(timezone.utc) - timedelta(minutes=16), check_interval_minutes=1)
    assert _is_asset_due(asset, 360) is True


def test_non_admin_asset_limit(client, bob, admin_headers, monkeypatch):
    from app.api.routers import hostname as hostname_routes

    monkeypatch.setattr(hostname_routes, "settings", dataclasses.replace(settings, max_assets_per_user=2))
    assert client.post("/hostname/", json=_asset(hostname="a.example.com"), headers=bob).status_code == 200
    bulk = {"hostnames": [_asset(hostname="b.example.com"), _asset(hostname="c.example.com")]}
    assert client.post("/hostname/bulk/", json=bulk, headers=bob).status_code == 400
    assert client.post("/hostname/cidr-import/", json={"cidr": "203.0.113.0/30", "check_blacklist": False},
                       headers=bob).status_code == 400
    assert client.post("/hostname/", json=_asset(hostname="b.example.com"), headers=bob).status_code == 200
    assert client.post("/hostname/", json=_asset(hostname="c.example.com"), headers=bob).status_code == 400
    # Admins aren't limited.
    for name in ("a", "b", "c"):
        assert client.post("/hostname/", json=_asset(hostname=f"{name}.example.org"), headers=admin_headers).status_code == 200


# --- alerts -------------------------------------------------------------------------

EVENT = {"event_type": "blacklist.listed", "severity": "critical", "title": "Listed on 1 blacklist",
         "details": {"added": ["zen.spamhaus.org"]}}


def test_slack_alerts_cannot_ping_or_hide_links():
    payload = notifications.build_webhook_payload(
        "https://hooks.slack.com/services/T/B/x", "<!channel> <https://evil.example|Open AbuseBox>", "", EVENT)
    assert "<" not in payload["text"] and ">" not in payload["text"]
    assert "&lt;!channel&gt;" in payload["text"]


def test_discord_alerts_cannot_mention_anyone():
    payload = notifications.build_webhook_payload("https://discord.com/api/webhooks/1/x", "@everyone", "", EVENT)
    assert payload["allowed_mentions"] == {"parse": []}


# --- sign-in --------------------------------------------------------------------------

def test_unknown_usernames_still_check_a_password(client):
    with mock.patch("app.api.routers.auth.burn_password_check") as burn:
        assert _login(client, "nobody", "some-password").status_code == 401
    burn.assert_called_once()


def test_weak_password_hashes_are_upgraded_at_sign_in(client, bob):
    with SessionLocal() as db:
        user = db.query(User).filter(User.username == "bob").one()
        user.hashed_password = pbkdf2_sha256.using(rounds=500).hash("bob-password")
        db.commit()
    assert _login(client, "bob", "bob-password").status_code == 200
    with SessionLocal() as db:
        stored = db.query(User).filter(User.username == "bob").one().hashed_password
    assert stored.startswith(f"$pbkdf2-sha256${settings.password_hash_rounds}$")
    assert _login(client, "bob", "bob-password").status_code == 200


def test_logout_revokes_access_and_refresh_tokens(client):
    tokens = _login(client, "admin", "password123").json()
    assert client.post("/user/logout/", headers=_bearer(tokens["access"])).status_code == 204
    assert client.get("/user/me/", headers=_bearer(tokens["access"])).status_code == 401
    assert client.post("/user/token/refresh/", json={"refresh": tokens["refresh"]}).status_code == 401


def test_default_password_must_be_changed(client):
    tokens = _login(client, "admin", "password123").json()
    assert client.get("/user/me/", headers=_bearer(tokens["access"])).json()["using_default_password"] is True
    changed = client.post("/user/change-password/", json={"current_password": "password123", "new_password": "a-better-password"},
                          headers=_bearer(tokens["access"])).json()
    assert client.get("/user/me/", headers=_bearer(changed["access"])).json()["using_default_password"] is False


def test_first_start_generates_a_random_admin_password(tmp_path, monkeypatch):
    from app.db import init_data

    patched = dataclasses.replace(settings, default_admin_username="firstadmin", default_admin_email="first@example.com",
                                  default_admin_password="")
    object.__setattr__(patched, "secret_key_file", str(tmp_path / ".secret_key"))  # __post_init__ recomputes it
    monkeypatch.setattr(init_data, "settings", patched)
    with SessionLocal() as db:
        init_data.seed_default_admin(db)
        admin = db.query(User).filter(User.username == "firstadmin").one()
        password = (tmp_path / "initial_admin_password").read_text().strip()
        assert len(password) >= 16 and password != "password123"
        assert oct(os.stat(tmp_path / "initial_admin_password").st_mode & 0o777) == "0o600"
        assert admin.must_change_password is True
        assert pbkdf2_sha256.verify(password, admin.hashed_password)
        init_data.forget_initial_password()
        assert not (tmp_path / "initial_admin_password").exists()


def test_existing_installs_on_the_old_default_are_flagged(client):
    from app.db.init_data import seed_default_admin

    with SessionLocal() as db:
        admin = db.query(User).filter(User.username == "admin").one()
        admin.must_change_password = False
        db.commit()
        seed_default_admin(db)  # what every start does
        db.refresh(admin)
        assert admin.must_change_password is True


# --- public quick check --------------------------------------------------------------

@pytest.mark.parametrize("target", ["127.0.0.1", "10.0.0.5", "192.168.1.1", "169.254.169.254"])
def test_quick_check_only_checks_public_addresses(client, target):
    with mock.patch.object(dnsbl, "check_dnsbl_providers") as check:
        response = client.get(f"/blacklist/quick-check/?hostname={target}")
    assert response.status_code == 400
    assert "public" in response.json()["detail"]
    check.assert_not_called()


def test_resolver_health_reports_a_refusing_resolver(client, admin_headers, monkeypatch):
    monkeypatch.setitem(dnsbl._resolver_health, "result", None)
    with mock.patch.object(dnsbl, "_answers_test_points", return_value=False) as probe:
        first = client.get("/blacklist/resolver-health/", headers=admin_headers).json()
        second = client.get("/blacklist/resolver-health/", headers=admin_headers).json()
    assert first == second == {"ok": False, "provider": "zen.spamhaus.org", "resolver": "system"}
    assert probe.call_count == 1  # failures are cached for a few minutes
    assert client.get("/blacklist/resolver-health/").status_code == 401


# --- WHOIS ----------------------------------------------------------------------------

def test_whois_follows_referrals_only_from_iana():
    calls = []

    def fake(domain, server, timeout=10.0):
        calls.append(server)
        return "Domain Name: EXAMPLE.COM\nRegistrant Organization: x\nrefer: 10.0.0.5\n"

    with mock.patch.object(whois_lookup, "_raw_whois", side_effect=fake):
        whois_lookup.whois_lookup("example.com")
    assert calls == ["whois.verisign-grs.com"]


def test_whois_reads_are_bounded_and_go_to_public_servers():
    sock = mock.MagicMock()
    sock.__enter__.return_value = sock
    sock.recv.return_value = b"x" * 4096  # a server that never stops sending
    with mock.patch("socket.create_connection", return_value=sock) as connect, \
            mock.patch.object(whois_lookup, "resolve_public_ipv4", return_value="192.0.43.8"):
        raw = whois_lookup._raw_whois("example.com", "whois.example")
    assert connect.call_args.args[0] == ("192.0.43.8", 43)
    assert len(raw) == whois_lookup._MAX_RESPONSE_BYTES


def test_whois_rejects_control_characters():
    assert whois_lookup.whois_lookup("example.com\r\nhelp") == {"error": "Invalid domain or hostname."}


# --- API docs -------------------------------------------------------------------------

def test_api_docs_can_be_turned_off(monkeypatch):
    from fastapi.testclient import TestClient

    import app.main as main

    monkeypatch.setattr(main, "settings", dataclasses.replace(settings, disable_api_docs=True))
    with TestClient(main.create_app()) as docs_off:
        for path in ("/swagger/", "/openapi.json", "/redoc/"):
            assert docs_off.get(path).status_code == 404
        assert docs_off.get("/health").status_code == 200


# --- first start ----------------------------------------------------------------------

def test_settings_row_created_by_a_concurrent_request_is_reused(client):
    # Two requests on a fresh install both find no settings row; the second
    # insert fails and must return the row the first one created.
    from app.models import AppSettings
    from app.services.app_settings import get_app_settings

    with SessionLocal() as db:
        db.query(AppSettings).delete()
        db.commit()
    with SessionLocal() as first, SessionLocal() as second:
        real_query = second.query
        calls = []

        def racing_query(*args, **kwargs):
            query = real_query(*args, **kwargs)
            if args and args[0] is AppSettings and not calls:
                calls.append(1)
                get_app_settings(first)  # the other request wins the race here
                return mock.Mock(filter=lambda *a, **k: mock.Mock(first=lambda: None))
            return query

        with mock.patch.object(second, "query", side_effect=racing_query):
            row = get_app_settings(second)
        assert row.id == 1

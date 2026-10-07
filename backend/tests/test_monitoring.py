"""Health summaries, event detection, notifications and retention."""

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest import mock

from app.services import notifications
from app.services.events import detect_events
from app.services.health import domain_expiry_days, summarize


def bl(*listed, failed=0, inconclusive=False, total=60):
    return {
        "detected_on": [{"provider": p, "status": "open"} for p in listed],
        "providers": [f"p{i}" for i in range(total)],
        "failed_providers": [f"f{i}" for i in range(failed)],
        "is_inconclusive": inconclusive,
        "is_blacklisted": bool(listed),
    }


def types(events):
    return [e["event_type"] for e in events]


# --- event detection -------------------------------------------------------------

def test_first_check_reports_only_problems():
    assert types(detect_events(None, {"blacklist": bl()}, was_blacklisted=False, is_blacklisted=False)) == []
    events = detect_events(None, {"blacklist": bl("zen.spamhaus.org")}, was_blacklisted=False, is_blacklisted=True)
    assert types(events) == ["blacklist.listed"]
    assert events[0]["severity"] == "critical"


def test_listed_and_delisted_transitions():
    listed = detect_events({"blacklist": bl()}, {"blacklist": bl("a", "b")}, was_blacklisted=False, is_blacklisted=True)
    assert types(listed) == ["blacklist.listed"]
    assert listed[0]["details"]["providers"] == ["a", "b"]

    cleared = detect_events({"blacklist": bl("a")}, {"blacklist": bl()}, was_blacklisted=True, is_blacklisted=False)
    assert types(cleared) == ["blacklist.delisted"]
    assert cleared[0]["severity"] == "success"


def test_provider_changes_while_listed():
    added = detect_events({"blacklist": bl("a")}, {"blacklist": bl("a", "b")}, was_blacklisted=True, is_blacklisted=True)
    assert types(added) == ["blacklist.listed"]
    assert added[0]["details"]["added"] == ["b"]

    removed = detect_events({"blacklist": bl("a", "b")}, {"blacklist": bl("a")}, was_blacklisted=True, is_blacklisted=True)
    assert types(removed) == ["blacklist.changed"]

    same = detect_events({"blacklist": bl("a")}, {"blacklist": bl("a")}, was_blacklisted=True, is_blacklisted=True)
    assert same == []


def test_inconclusive_result_produces_no_blacklist_event():
    events = detect_events({"blacklist": bl("a")}, {"blacklist": bl(failed=30, inconclusive=True)}, was_blacklisted=True, is_blacklisted=True)
    assert events == []


def test_server_down_and_recovery_are_reported_once():
    up = {"server_status": {"is_up": True, "status_code": 200}}
    down = {"server_status": {"is_up": False, "reason": "Request timed out"}}
    assert types(detect_events(up, down, was_blacklisted=False, is_blacklisted=False)) == ["server.down"]
    assert detect_events(down, down, was_blacklisted=False, is_blacklisted=False) == []
    assert types(detect_events(down, up, was_blacklisted=False, is_blacklisted=False)) == ["server.up"]


def test_ssl_threshold_crossing_and_renewal():
    def ssl(days, valid=True):
        return {"ssl": {"valid": valid, "days_remaining": days}}
    assert types(detect_events(ssl(40), ssl(10), was_blacklisted=False, is_blacklisted=False, ssl_warning_days=14)) == ["ssl.expiring"]
    assert detect_events(ssl(10), ssl(9), was_blacklisted=False, is_blacklisted=False, ssl_warning_days=14) == []
    assert types(detect_events(ssl(9), ssl(-1, valid=False), was_blacklisted=False, is_blacklisted=False)) == ["ssl.invalid"]
    assert types(detect_events(ssl(9), ssl(89), was_blacklisted=False, is_blacklisted=False, ssl_warning_days=14)) == ["ssl.renewed"]
    # Warnings switched off
    assert detect_events(ssl(40), ssl(10), was_blacklisted=False, is_blacklisted=False, ssl_warning_days=0) == []


def test_domain_expiry_crossing():
    soon = (datetime.now(timezone.utc) + timedelta(days=20)).strftime("%Y-%m-%dT%H:%M:%SZ")
    later = (datetime.now(timezone.utc) + timedelta(days=200)).strftime("%Y-%m-%d")
    events = detect_events({"whois": {"expiry_date": later}}, {"whois": {"expiry_date": soon}},
                           was_blacklisted=False, is_blacklisted=False, domain_warning_days=30)
    assert types(events) == ["domain.expiring"]


def test_whois_date_formats():
    assert domain_expiry_days({"whois": {"expiry_date": "2999-01-01"}}) > 300000
    assert domain_expiry_days({"whois": {"expiry_date": "01-Jan-2999"}}) > 300000
    assert domain_expiry_days({"whois": {"expiry_date": ["2999-01-01T00:00:00.000Z"]}}) > 300000
    assert domain_expiry_days({"whois": {"expiry_date": "not a date"}}) is None


# --- health summary -----------------------------------------------------------------

def _asset(**overrides):
    base = {"is_monitor_enabled": False, "last_checked": None, "check_interval_minutes": None}
    return SimpleNamespace(**{**base, **overrides})


def test_summary_collects_and_sorts_issues():
    result = {
        "blacklist": bl("zen.spamhaus.org"),
        "ssl": {"valid": True, "days_remaining": 5},
        "server_status": {"is_up": True, "status_code": 503},
        "email_security": {"grade": "F"},
    }
    health = summarize(_asset(), result)
    kinds = [(i["kind"], i["severity"]) for i in health["issues"]]
    assert kinds[0] == ("blacklist", "critical")
    assert ("ssl", "warning") in kinds and ("server", "warning") in kinds and ("email", "warning") in kinds
    assert health["status"] == "critical"
    assert health["blacklist"]["listed_count"] == 1


def test_summary_clean_asset_is_ok():
    health = summarize(_asset(), {"blacklist": bl(), "ssl": {"valid": True, "days_remaining": 80}})
    assert health["issues"] == [] and health["status"] == "ok"


def test_summary_flags_overdue_monitoring():
    stale = datetime.now(timezone.utc) - timedelta(hours=30)
    health = summarize(_asset(is_monitor_enabled=True, last_checked=stale), {"blacklist": bl()}, global_interval_minutes=360)
    assert health["issues"][0]["kind"] == "monitoring"
    fresh = summarize(_asset(is_monitor_enabled=True, last_checked=datetime.now(timezone.utc)), {"blacklist": bl()}, global_interval_minutes=360)
    assert fresh["issues"] == []


# --- notifications -------------------------------------------------------------------

EVENT = {"event_type": "blacklist.listed", "severity": "critical", "title": "Listed on 1 blacklist",
         "details": {"providers": ["zen.spamhaus.org"], "added": ["zen.spamhaus.org"]}}


def test_generic_webhook_keeps_v11_fields():
    payload = notifications.build_webhook_payload("https://hooks.example.com/x", "mail.example.com", "203.0.113.10", EVENT)
    assert payload["event"] == "blacklist_detected"
    assert payload["event_type"] == "blacklist.listed"
    assert payload["providers"] == ["zen.spamhaus.org"] and payload["provider_count"] == 1
    assert payload["hostname"] == "mail.example.com" and payload["ip"] == "203.0.113.10"


def test_slack_and_discord_payloads_are_text():
    slack = notifications.build_webhook_payload("https://hooks.slack.com/services/T/B/x", "mail.example.com", "", EVENT)
    discord = notifications.build_webhook_payload("https://discord.com/api/webhooks/1/abc", "mail.example.com", "", EVENT)
    assert set(slack) == {"text"} and "mail.example.com" in slack["text"]
    assert set(discord) == {"content"} and "zen.spamhaus.org" in discord["content"]


def test_notification_preferences_filter_events():
    prefs = {"notify_on_delisted": False, "notify_on_server_down": True, "ssl_expiry_warning_days": 0, "domain_expiry_warning_days": 30}
    assert notifications.should_notify("blacklist.listed", prefs)
    assert not notifications.should_notify("blacklist.delisted", prefs)
    assert notifications.should_notify("server.down", prefs)
    assert not notifications.should_notify("ssl.expiring", prefs)
    assert not notifications.should_notify("blacklist.changed", prefs)


def test_notify_events_posts_one_webhook_per_alerting_event():
    events = [EVENT, {"event_type": "blacklist.changed", "severity": "info", "title": "x", "details": None}]
    with mock.patch.object(notifications, "post_webhook", return_value=(True, None)) as post, \
            mock.patch.object(notifications, "send_email") as email:
        notifications.notify_events(hostname="h", ip="1.2.3.4", events=events, user_email="a@example.com",
                                    webhook_url="https://hooks.example.com/x", prefs={})
    assert post.call_count == 1  # blacklist.changed is log-only
    email.assert_not_called()  # SMTP isn't configured in tests

"""Email and webhook alerts for asset events.

Webhooks are formatted for Slack and Discord when the URL points at them;
any other URL receives a JSON payload (see ``build_webhook_payload``).
"""

import logging
import smtplib
from datetime import datetime, timezone
from email.mime.text import MIMEText
from typing import Any
from urllib.parse import urlparse

import requests

from app.core.config import settings

logger = logging.getLogger(__name__)

_SEVERITY_ICON = {"critical": "🔴", "warning": "🟠", "info": "🔵", "success": "🟢"}


def email_configured() -> bool:
    return bool(settings.smtp_host and settings.smtp_from_email)


def send_email(to_email: str, subject: str, body: str) -> tuple[bool, str | None]:
    if not email_configured():
        return False, "SMTP is not configured (set SMTP_HOST and SMTP_FROM_EMAIL)."

    msg = MIMEText(body, "plain", "utf-8")
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from_email
    msg["To"] = to_email

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as server:
            if settings.smtp_use_tls:
                server.starttls()
            if settings.smtp_username and settings.smtp_password:
                server.login(settings.smtp_username, settings.smtp_password)
            server.sendmail(settings.smtp_from_email, [to_email], msg.as_string())
        logger.info("Email alert sent to %s", to_email)
        return True, None
    except Exception as exc:  # noqa: BLE001 - report any SMTP failure to the caller
        logger.error("Failed to send email alert: %s", exc)
        return False, str(exc)


def _webhook_kind(url: str) -> str:
    host = (urlparse(url).hostname or "").lower()
    if host == "hooks.slack.com":
        return "slack"
    if host in ("discord.com", "discordapp.com") and "/api/webhooks/" in url:
        return "discord"
    return "json"


def _event_line(hostname: str, event: dict[str, Any]) -> str:
    icon = _SEVERITY_ICON.get(event.get("severity"), "•")
    line = f"{icon} {hostname}: {event['title']}"
    details = event.get("details") or {}
    if details.get("added"):
        line += f" ({', '.join(details['added'][:10])})"
    elif details.get("reason"):
        line += f" ({details['reason']})"
    return line


def build_webhook_payload(url: str, hostname: str, ip: str, event: dict[str, Any]) -> dict[str, Any]:
    kind = _webhook_kind(url)
    text = f"[AbuseBox] {_event_line(hostname, event)}"
    if kind == "slack":
        return {"text": text}
    if kind == "discord":
        return {"content": text}

    details = event.get("details") or {}
    payload: dict[str, Any] = {
        "source": "abusebox",
        "event": event["event_type"],
        "event_type": event["event_type"],
        "severity": event["severity"],
        "title": event["title"],
        "hostname": hostname,
        "ip": ip,
        "details": details,
        "occurred_at": datetime.now(timezone.utc).isoformat(),
    }
    if event["event_type"] == "blacklist.listed":
        # Same keys as the v1.1 "blacklist_detected" payload for existing consumers.
        providers = details.get("providers", [])
        payload.update(event="blacklist_detected", providers=providers, provider_count=len(providers))
    return payload


def post_webhook(url: str, payload: dict[str, Any]) -> tuple[bool, str | None]:
    if not url:
        return False, "No webhook URL configured."
    try:
        resp = requests.post(url, json=payload, timeout=10, headers={"Content-Type": "application/json"})
        resp.raise_for_status()
        return True, None
    except Exception as exc:  # noqa: BLE001 - report any delivery failure to the caller
        logger.error("Failed to send webhook alert: %s", exc)
        return False, str(exc)


def should_notify(event_type: str, prefs: dict[str, Any]) -> bool:
    """Whether an event type sends an alert under the instance's preferences."""
    if event_type == "blacklist.listed":
        return True
    if event_type == "blacklist.delisted":
        return bool(prefs.get("notify_on_delisted"))
    if event_type in ("server.down", "server.up"):
        return bool(prefs.get("notify_on_server_down"))
    if event_type in ("ssl.expiring", "ssl.invalid"):
        return bool(prefs.get("ssl_expiry_warning_days"))
    if event_type == "domain.expiring":
        return bool(prefs.get("domain_expiry_warning_days"))
    return False  # informational events (blacklist.changed, ssl.renewed) only appear in the log


def notify_events(
    *,
    hostname: str,
    ip: str,
    events: list[dict[str, Any]],
    user_email: str | None,
    webhook_url: str,
    prefs: dict[str, Any],
) -> None:
    """Send one email (all events together) and one webhook call per event."""
    to_send = [event for event in events if should_notify(event["event_type"], prefs)]
    if not to_send:
        return

    if user_email and email_configured():
        worst = min(to_send, key=lambda e: {"critical": 0, "warning": 1, "success": 2, "info": 3}.get(e["severity"], 9))
        subject = f"[AbuseBox] {hostname}: {worst['title']}"
        body = "\n".join(_event_line(hostname, event) for event in to_send)
        body += "\n\nOpen the AbuseBox dashboard for details."
        send_email(user_email, subject, body)

    if webhook_url:
        for event in to_send:
            post_webhook(webhook_url, build_webhook_payload(webhook_url, hostname, ip, event))


def send_test_notifications(user_email: str | None, webhook_url: str) -> dict[str, dict[str, Any]]:
    """Send a test message to every configured channel and report the outcome."""
    event = {"event_type": "test", "severity": "info", "title": "Test notification from AbuseBox", "details": None}
    results: dict[str, dict[str, Any]] = {}

    if not email_configured():
        results["email"] = {"status": "not_configured", "detail": "Set SMTP_HOST and SMTP_FROM_EMAIL in the environment."}
    elif not user_email:
        results["email"] = {"status": "failed", "detail": "Your account has no email address."}
    else:
        ok, error = send_email(user_email, "[AbuseBox] Test notification", "Alerts from AbuseBox will arrive at this address.")
        results["email"] = {"status": "sent" if ok else "failed", "detail": user_email if ok else error}

    if not webhook_url:
        results["webhook"] = {"status": "not_configured", "detail": "Add a webhook URL in Settings or set WEBHOOK_URL."}
    else:
        ok, error = post_webhook(webhook_url, build_webhook_payload(webhook_url, "example.com", "", event))
        results["webhook"] = {"status": "sent" if ok else "failed", "detail": _webhook_kind(webhook_url) if ok else error}

    return results

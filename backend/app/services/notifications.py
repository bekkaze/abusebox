import logging
import smtplib
from email.mime.text import MIMEText
from typing import Any

import requests

from app.core.config import settings

logger = logging.getLogger(__name__)


def send_email_alert(to_email: str, subject: str, body: str) -> bool:
    if not settings.smtp_host or not settings.smtp_from_email:
        logger.warning("SMTP not configured, skipping email alert.")
        return False

    msg = MIMEText(body, "plain")
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from_email
    msg["To"] = to_email

    try:
        if settings.smtp_use_tls:
            server = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10)
            server.starttls()
        else:
            server = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10)

        if settings.smtp_username and settings.smtp_password:
            server.login(settings.smtp_username, settings.smtp_password)

        server.sendmail(settings.smtp_from_email, [to_email], msg.as_string())
        server.quit()
        logger.info("Email alert sent to %s", to_email)
        return True
    except Exception as exc:
        logger.error("Failed to send email alert: %s", exc)
        return False


def send_webhook_alert(payload: dict[str, Any]) -> bool:
    if not settings.webhook_url:
        logger.warning("Webhook URL not configured, skipping webhook alert.")
        return False

    try:
        resp = requests.post(
            settings.webhook_url,
            json=payload,
            timeout=10,
            headers={"Content-Type": "application/json"},
        )
        resp.raise_for_status()
        logger.info("Webhook alert sent successfully.")
        return True
    except Exception as exc:
        logger.error("Failed to send webhook alert: %s", exc)
        return False


def notify_blacklist_detected(hostname: str, ip: str, providers: list[str], user_email: str | None = None) -> None:
    subject = f"[AbuseBox] Blacklist detected: {hostname}"
    body = (
        f"Hostname: {hostname}\n"
        f"IP: {ip}\n"
        f"Listed on {len(providers)} provider(s):\n"
        + "\n".join(f"  - {p}" for p in providers)
        + "\n\nPlease review in the AbuseBox dashboard."
    )

    webhook_payload = {
        "event": "blacklist_detected",
        "hostname": hostname,
        "ip": ip,
        "providers": providers,
        "provider_count": len(providers),
    }

    if user_email:
        send_email_alert(user_email, subject, body)

    send_webhook_alert(webhook_payload)

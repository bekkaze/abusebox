"""Access to the single AppSettings row, created from env defaults on first use."""

from sqlalchemy.orm import Session

from app.core.config import settings as env_settings
from app.models import AppSettings


def get_app_settings(db: Session) -> AppSettings:
    row = db.query(AppSettings).filter(AppSettings.id == 1).first()
    if row is None:
        row = AppSettings(
            id=1,
            scheduler_enabled=env_settings.scheduler_enabled,
            scheduler_interval_minutes=env_settings.scheduler_interval_minutes,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def effective_webhook_url(row: AppSettings | None) -> str:
    """Webhook from Settings if set, otherwise WEBHOOK_URL from the environment."""
    if row is not None and row.webhook_url:
        return row.webhook_url
    return env_settings.webhook_url

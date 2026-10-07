import threading

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.config import settings as env_settings
from app.core.security import get_current_user, require_superuser
from app.db.session import get_db
from app.models import Hostname, User
from app.services.app_settings import effective_webhook_url, get_app_settings
from app.services.notifications import email_configured, send_test_notifications
from app.services.scheduler import due_hostnames, restart_scheduler, run_cycle, scheduler_status, stop_scheduler

router = APIRouter(prefix="/settings", tags=["settings"])


# --- Scheduler -----------------------------------------------------------------

class SchedulerSettingsResponse(BaseModel):
    scheduler_enabled: bool
    scheduler_interval_minutes: int
    history_retention_days: int = 0


class SchedulerSettingsUpdate(BaseModel):
    scheduler_enabled: bool
    scheduler_interval_minutes: int = Field(ge=1, le=10080)  # 1 min to 7 days
    # Optional so older clients that only send the two fields keep working.
    history_retention_days: int | None = Field(default=None, ge=0, le=3650)


def _scheduler_response(row) -> SchedulerSettingsResponse:
    return SchedulerSettingsResponse(
        scheduler_enabled=row.scheduler_enabled,
        scheduler_interval_minutes=row.scheduler_interval_minutes,
        history_retention_days=row.history_retention_days,
    )


@router.get("/scheduler/", response_model=SchedulerSettingsResponse)
def get_scheduler_settings(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return _scheduler_response(get_app_settings(db))


@router.put("/scheduler/", response_model=SchedulerSettingsResponse)
def update_scheduler_settings(
    payload: SchedulerSettingsUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_superuser),
):
    row = get_app_settings(db)
    row.scheduler_enabled = payload.scheduler_enabled
    row.scheduler_interval_minutes = payload.scheduler_interval_minutes
    if payload.history_retention_days is not None:
        row.history_retention_days = payload.history_retention_days
    db.commit()
    db.refresh(row)

    # Apply changes at runtime
    if row.scheduler_enabled:
        restart_scheduler(row.scheduler_interval_minutes)
    else:
        stop_scheduler()

    return _scheduler_response(row)


@router.get("/scheduler/status/")
def get_scheduler_status(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    row = get_app_settings(db)
    monitored = (
        db.query(Hostname)
        .filter(Hostname.user_id == user.id, Hostname.is_monitor_enabled == True, Hostname.status == "active")  # noqa: E712
        .count()
    )
    due = [h for h in due_hostnames(db, row.scheduler_interval_minutes) if h.user_id == user.id]
    return {
        **scheduler_status(),
        "enabled": row.scheduler_enabled,
        "interval_minutes": row.scheduler_interval_minutes,
        "monitored_assets": monitored,
        "due_assets": len(due),
    }


@router.post("/scheduler/run/", status_code=status.HTTP_202_ACCEPTED)
def run_scheduler_now(user: User = Depends(require_superuser)):
    """Check every due asset now instead of waiting for the next poll."""
    if scheduler_status()["cycle_in_progress"]:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A check cycle is already running.")
    threading.Thread(target=run_cycle, daemon=True, name="abusebox-manual-cycle").start()
    return {"started": True}


# --- Notifications -------------------------------------------------------------

class NotificationSettings(BaseModel):
    notify_on_delisted: bool
    notify_on_server_down: bool
    ssl_expiry_warning_days: int = Field(ge=0, le=365)
    domain_expiry_warning_days: int = Field(ge=0, le=365)
    webhook_url: str | None = Field(default=None, max_length=500)


def _mask(url: str) -> str:
    # Webhook URLs usually embed a secret token; show only the start.
    return url[:28] + "…" if len(url) > 28 else url


def _notification_response(row, *, is_admin: bool) -> dict:
    webhook = effective_webhook_url(row)
    return {
        "notify_on_delisted": row.notify_on_delisted,
        "notify_on_server_down": row.notify_on_server_down,
        "ssl_expiry_warning_days": row.ssl_expiry_warning_days,
        "domain_expiry_warning_days": row.domain_expiry_warning_days,
        "webhook_url": (row.webhook_url or "") if is_admin else (_mask(row.webhook_url) if row.webhook_url else ""),
        "webhook_source": "settings" if row.webhook_url else ("environment" if env_settings.webhook_url else None),
        "webhook_configured": bool(webhook),
        "email_configured": email_configured(),
        "smtp_from": env_settings.smtp_from_email or None,
    }


@router.get("/notifications/")
def get_notification_settings(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return _notification_response(get_app_settings(db), is_admin=user.is_superuser)


@router.put("/notifications/")
def update_notification_settings(
    payload: NotificationSettings,
    db: Session = Depends(get_db),
    user: User = Depends(require_superuser),
):
    webhook = (payload.webhook_url or "").strip()
    if webhook and not webhook.startswith(("http://", "https://")):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Webhook URL must start with http:// or https://")
    row = get_app_settings(db)
    row.notify_on_delisted = payload.notify_on_delisted
    row.notify_on_server_down = payload.notify_on_server_down
    row.ssl_expiry_warning_days = payload.ssl_expiry_warning_days
    row.domain_expiry_warning_days = payload.domain_expiry_warning_days
    row.webhook_url = webhook or None
    db.commit()
    db.refresh(row)
    return _notification_response(row, is_admin=True)


@router.post("/notifications/test/")
def test_notifications(db: Session = Depends(get_db), user: User = Depends(require_superuser)):
    """Send a test email (to your account's address) and webhook call."""
    return send_test_notifications(user.email, effective_webhook_url(get_app_settings(db)))

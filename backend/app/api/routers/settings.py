from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.session import get_db
from app.models import AppSettings, User
from app.services.scheduler import restart_scheduler, stop_scheduler

router = APIRouter(prefix="/settings", tags=["settings"])


class SchedulerSettingsResponse(BaseModel):
    scheduler_enabled: bool
    scheduler_interval_minutes: int


class SchedulerSettingsUpdate(BaseModel):
    scheduler_enabled: bool
    scheduler_interval_minutes: int = Field(ge=1, le=10080)  # 1 min to 7 days


def _get_or_create_settings(db: Session) -> AppSettings:
    row = db.query(AppSettings).filter(AppSettings.id == 1).first()
    if not row:
        from app.core.config import settings as env_settings
        row = AppSettings(
            id=1,
            scheduler_enabled=env_settings.scheduler_enabled,
            scheduler_interval_minutes=env_settings.scheduler_interval_minutes,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


@router.get("/scheduler/", response_model=SchedulerSettingsResponse)
def get_scheduler_settings(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    row = _get_or_create_settings(db)
    return SchedulerSettingsResponse(
        scheduler_enabled=row.scheduler_enabled,
        scheduler_interval_minutes=row.scheduler_interval_minutes,
    )


@router.put("/scheduler/", response_model=SchedulerSettingsResponse)
def update_scheduler_settings(
    payload: SchedulerSettingsUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    row = _get_or_create_settings(db)
    row.scheduler_enabled = payload.scheduler_enabled
    row.scheduler_interval_minutes = payload.scheduler_interval_minutes
    db.commit()
    db.refresh(row)

    # Apply changes at runtime
    if row.scheduler_enabled:
        restart_scheduler(row.scheduler_interval_minutes)
    else:
        stop_scheduler()

    return SchedulerSettingsResponse(
        scheduler_enabled=row.scheduler_enabled,
        scheduler_interval_minutes=row.scheduler_interval_minutes,
    )

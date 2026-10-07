from sqlalchemy import Boolean, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class AppSettings(Base):
    """Instance-wide settings (single row, id=1), editable by admins."""

    __tablename__ = "app_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    scheduler_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    scheduler_interval_minutes: Mapped[int] = mapped_column(Integer, default=360, nullable=False)

    # Delete historical check results and events older than this (0 = keep forever).
    history_retention_days: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Which events send alerts (newly listed always does when alerts are on).
    notify_on_delisted: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    notify_on_server_down: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    ssl_expiry_warning_days: Mapped[int] = mapped_column(Integer, default=14, nullable=False)  # 0 = off
    domain_expiry_warning_days: Mapped[int] = mapped_column(Integer, default=30, nullable=False)  # 0 = off

    # Overrides WEBHOOK_URL from the environment when set.
    webhook_url: Mapped[str | None] = mapped_column(String(500), nullable=True, default=None)

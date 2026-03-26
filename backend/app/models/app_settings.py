from sqlalchemy import Boolean, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class AppSettings(Base):
    __tablename__ = "app_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    scheduler_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    scheduler_interval_minutes: Mapped[int] = mapped_column(Integer, default=360, nullable=False)

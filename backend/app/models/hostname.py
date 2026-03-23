from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Hostname(Base):
    __tablename__ = "hostnames"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    hostname_type: Mapped[str] = mapped_column(String(20), nullable=False)
    hostname: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_alert_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_monitor_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="active", nullable=False)
    is_blacklisted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Check toggles — which tools to run during monitoring
    check_blacklist: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    check_abuseipdb: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    check_dns: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    check_ssl: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    check_whois: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    check_email_security: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    check_server_status: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    user = relationship("User", back_populates="hostnames")
    checks = relationship("CheckHistory", back_populates="hostname_ref", cascade="all, delete-orphan")

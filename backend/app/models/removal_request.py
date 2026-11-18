from datetime import UTC, datetime

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class RemovalRequest(Base):
    """One request to take an asset off one blacklist, and what happened next.

    The verdict at the time is kept with it (readiness, fixed, evidence), so a
    request made against AbuseBox's advice stays visible as one, with the
    reason given for overriding it.
    """

    __tablename__ = "removal_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    hostname_id: Mapped[int] = mapped_column(ForeignKey("hostnames.id", ondelete="CASCADE"), nullable=False, index=True)
    # The check the request was made from. Not a foreign key: retention may
    # prune that check while the request is still worth keeping.
    check_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    provider: Mapped[str] = mapped_column(String(255), nullable=False)
    codes: Mapped[list | None] = mapped_column(JSON, nullable=True)
    causes: Mapped[list | None] = mapped_column(JSON, nullable=True)
    readiness: Mapped[str] = mapped_column(String(20), nullable=False)
    fixed: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    evidence: Mapped[str | None] = mapped_column(String(500), nullable=True)
    note: Mapped[str | None] = mapped_column(String(500), nullable=True)
    override_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    requested_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC), nullable=False)
    cleared_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    relisted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    hostname_ref = relationship("Hostname", back_populates="removal_requests")

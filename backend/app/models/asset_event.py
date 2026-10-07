from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class AssetEvent(Base):
    """A state change detected between two checks of an asset (e.g. newly
    listed, delisted, server down). Feeds the activity log and alerts."""

    __tablename__ = "asset_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    hostname_id: Mapped[int] = mapped_column(ForeignKey("hostnames.id", ondelete="CASCADE"), nullable=False, index=True)
    # Not a foreign key: old check rows may be pruned while events are kept.
    check_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    event_type: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    severity: Mapped[str] = mapped_column(String(10), nullable=False)  # critical | warning | info | success
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    details: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    hostname_ref = relationship("Hostname", back_populates="events")

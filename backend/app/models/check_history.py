from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class CheckHistory(Base):
    __tablename__ = "check_histories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    hostname_id: Mapped[int] = mapped_column(ForeignKey("hostnames.id", ondelete="CASCADE"), nullable=False, index=True)
    result: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="current", nullable=False)
    created: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    hostname_ref = relationship("Hostname", back_populates="checks")

from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class DmarcReport(Base):
    """Parsed DMARC aggregate report metadata."""

    __tablename__ = "dmarc_reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    domain: Mapped[str] = mapped_column(String(255), nullable=False, index=True)

    # Report metadata
    org_name: Mapped[str] = mapped_column(String(255), nullable=False)
    report_id: Mapped[str] = mapped_column(String(255), nullable=False)
    date_begin: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    date_end: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Published policy snapshot
    policy_domain: Mapped[str | None] = mapped_column(String(255), nullable=True)
    policy_adkim: Mapped[str | None] = mapped_column(String(10), nullable=True)
    policy_aspf: Mapped[str | None] = mapped_column(String(10), nullable=True)
    policy_p: Mapped[str | None] = mapped_column(String(20), nullable=True)
    policy_pct: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Raw XML stored for reference
    raw_xml: Mapped[str | None] = mapped_column(Text, nullable=True)

    created: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    records = relationship("DmarcReportRecord", back_populates="report", cascade="all, delete-orphan")
    user = relationship("User")


class DmarcReportRecord(Base):
    """Individual sender record inside a DMARC aggregate report."""

    __tablename__ = "dmarc_report_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    report_id: Mapped[int] = mapped_column(ForeignKey("dmarc_reports.id", ondelete="CASCADE"), nullable=False, index=True)

    source_ip: Mapped[str] = mapped_column(String(45), nullable=False)
    count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Policy evaluation
    disposition: Mapped[str | None] = mapped_column(String(20), nullable=True)  # none, quarantine, reject

    # DKIM
    dkim_domain: Mapped[str | None] = mapped_column(String(255), nullable=True)
    dkim_result: Mapped[str | None] = mapped_column(String(20), nullable=True)  # pass, fail
    dkim_selector: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # SPF
    spf_domain: Mapped[str | None] = mapped_column(String(255), nullable=True)
    spf_result: Mapped[str | None] = mapped_column(String(20), nullable=True)  # pass, fail

    # Alignment (header_from vs envelope)
    dkim_aligned: Mapped[str | None] = mapped_column(String(10), nullable=True)  # pass, fail
    spf_aligned: Mapped[str | None] = mapped_column(String(10), nullable=True)  # pass, fail

    report = relationship("DmarcReport", back_populates="records")

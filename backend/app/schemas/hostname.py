from datetime import datetime
from typing import Annotated, Any, Literal

from pydantic import AfterValidator, BaseModel, ConfigDict, Field

from app.core.timeutil import as_utc

# Stored timestamps are UTC but SQLite hands them back naive; mark them as UTC so
# the JSON carries an offset and browsers don't shift them into local time.
UTCDateTime = Annotated[datetime, AfterValidator(as_utc)]


CHECK_TOGGLE_DEFAULTS = {
    "check_blacklist": True,
    "check_abuseipdb": False,
    "check_dns": False,
    "check_ssl": False,
    "check_whois": False,
    "check_email_security": False,
    "check_server_status": False,
}


class HostnameCreateRequest(BaseModel):
    hostname_type: str = Field(min_length=1, max_length=20)
    hostname: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=255)
    is_alert_enabled: bool = False
    is_monitor_enabled: bool = False

    check_blacklist: bool = True
    check_abuseipdb: bool = False
    check_dns: bool = False
    check_ssl: bool = False
    check_whois: bool = False
    check_email_security: bool = False
    check_server_status: bool = False
    check_interval_minutes: int | None = None


class HostnameUpdateRequest(BaseModel):
    hostname_type: str = Field(min_length=1, max_length=20)
    hostname: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=255)
    is_alert_enabled: bool
    is_monitor_enabled: bool
    status: str = Field(min_length=1, max_length=20)

    check_blacklist: bool = True
    check_abuseipdb: bool = False
    check_dns: bool = False
    check_ssl: bool = False
    check_whois: bool = False
    check_email_security: bool = False
    check_server_status: bool = False
    check_interval_minutes: int | None = None


class HostnameResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user: int
    hostname_type: str
    hostname: str
    description: str | None
    is_alert_enabled: bool
    is_monitor_enabled: bool
    status: str
    is_blacklisted: bool

    check_blacklist: bool
    check_abuseipdb: bool
    check_dns: bool
    check_ssl: bool
    check_whois: bool
    check_email_security: bool
    check_server_status: bool
    check_interval_minutes: int | None
    last_checked: UTCDateTime | None = None

    created: UTCDateTime
    updated: UTCDateTime


class HostnameListItem(HostnameResponse):
    result: dict[str, Any] | None
    # Compact status + actionable issues (see app/services/health.py).
    health: dict[str, Any] | None = None
    checked: UTCDateTime | str


class BulkHostnameCreateRequest(BaseModel):
    hostnames: list[HostnameCreateRequest] = Field(min_length=1, max_length=300)


class CidrImportRequest(BaseModel):
    cidr: str = Field(min_length=1, max_length=50, description="CIDR notation e.g. 192.168.1.0/24")
    description: str | None = Field(default=None, max_length=255)
    is_alert_enabled: bool = False
    is_monitor_enabled: bool = False
    check_blacklist: bool = True
    check_abuseipdb: bool = False
    check_dns: bool = False
    check_ssl: bool = False
    check_whois: bool = False
    check_email_security: bool = False
    check_server_status: bool = False


class BulkCreateResult(BaseModel):
    created: int
    skipped: int
    errors: list[str]


class BulkActionRequest(BaseModel):
    ids: list[int] = Field(min_length=1, max_length=1000)
    action: Literal["recheck", "delete", "enable_monitoring", "disable_monitoring", "enable_alerts", "disable_alerts"]


class BulkActionResult(BaseModel):
    affected: int
    queued: int = 0

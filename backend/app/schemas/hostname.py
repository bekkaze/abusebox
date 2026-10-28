import ipaddress
import re
from datetime import datetime
from typing import Annotated, Any, Literal
from urllib.parse import urlparse

from pydantic import AfterValidator, BaseModel, ConfigDict, Field

from app.core.timeutil import as_utc

# Stored timestamps are UTC but SQLite hands them back naive; mark them as UTC so
# the JSON carries an offset and browsers don't shift them into local time.
UTCDateTime = Annotated[datetime, AfterValidator(as_utc)]

# The scheduler never checks an asset more often than this, whatever its
# own interval says (older releases accepted any number, even negative ones).
MIN_CHECK_INTERVAL_MINUTES = 15
MAX_CHECK_INTERVAL_MINUTES = 10080  # 7 days

# Spaces, control characters and characters URLs never contain unescaped.
_FORBIDDEN = re.compile(r'[\x00-\x20\x7f<>"{}|\\^`]')
_DNS_NAME = re.compile(r"(?=.{1,253}$)([a-z0-9_]([a-z0-9_-]{0,61}[a-z0-9_])?\.)*[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.?")


def _valid_target(value: str) -> str:
    """A domain, an IPv4 address, or an http(s) URL (for server-status checks).

    Asset names end up in alert emails and Slack/Discord messages, so text that
    isn't a real target (spaces, line breaks, markup) is rejected.
    """
    value = value.strip()
    if not value or _FORBIDDEN.search(value):
        raise ValueError("Enter a domain, an IPv4 address or a URL, without spaces.")
    parsed = urlparse(value if "://" in value else f"//{value}")
    if "://" in value and parsed.scheme not in ("http", "https"):
        raise ValueError("Only http:// and https:// URLs are supported.")
    try:
        host = parsed.hostname or ""
        parsed.port  # raises on a malformed port
    except ValueError as exc:
        raise ValueError("Enter a domain, an IPv4 address or a URL.") from exc
    try:
        ipaddress.IPv4Address(host)
        return value
    except ValueError:
        pass
    if not _DNS_NAME.fullmatch(host):
        raise ValueError("Enter a domain, an IPv4 address or a URL.")
    return value


Target = Annotated[str, Field(min_length=1, max_length=255), AfterValidator(_valid_target)]
IntervalMinutes = Annotated[int, Field(ge=MIN_CHECK_INTERVAL_MINUTES, le=MAX_CHECK_INTERVAL_MINUTES)]
# Free text in older releases; letters, digits and dashes only from 1.3.2.
_KEYWORD = r"^[a-z0-9_-]{1,20}$"


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
    hostname_type: str = Field(pattern=_KEYWORD)
    hostname: Target
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
    check_interval_minutes: IntervalMinutes | None = None


class HostnameUpdateRequest(BaseModel):
    hostname_type: str = Field(pattern=_KEYWORD)
    hostname: Target
    description: str | None = Field(default=None, max_length=255)
    is_alert_enabled: bool
    is_monitor_enabled: bool
    status: str = Field(pattern=_KEYWORD)

    check_blacklist: bool = True
    check_abuseipdb: bool = False
    check_dns: bool = False
    check_ssl: bool = False
    check_whois: bool = False
    check_email_security: bool = False
    check_server_status: bool = False
    check_interval_minutes: IntervalMinutes | None = None


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

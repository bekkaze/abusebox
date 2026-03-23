from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


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

    created: datetime
    updated: datetime


class HostnameListItem(HostnameResponse):
    result: dict[str, Any] | None
    checked: datetime | str

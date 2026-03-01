from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class HostnameCreateRequest(BaseModel):
    hostname_type: str = Field(min_length=1, max_length=20)
    hostname: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=255)
    is_alert_enabled: bool = False
    is_monitor_enabled: bool = False


class HostnameUpdateRequest(BaseModel):
    hostname_type: str = Field(min_length=1, max_length=20)
    hostname: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=255)
    is_alert_enabled: bool
    is_monitor_enabled: bool
    status: str = Field(min_length=1, max_length=20)


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
    created: datetime
    updated: datetime


class HostnameListItem(HostnameResponse):
    result: dict[str, Any] | None
    checked: datetime | str

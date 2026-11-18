from typing import Any

from pydantic import BaseModel, Field


class DelistRequest(BaseModel):
    provider: str = Field(min_length=1)
    delist_required_data: dict[str, Any]
    # Why the request is being made although AbuseBox advised against it.
    # Optional at the API so existing scripts keep working; the interface
    # asks for it when the verdict is "blocked".
    override_reason: str | None = Field(default=None, max_length=500)

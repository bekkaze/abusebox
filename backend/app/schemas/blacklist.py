from typing import Any

from pydantic import BaseModel, Field


class DelistRequest(BaseModel):
    provider: str = Field(min_length=1)
    delist_required_data: dict[str, Any]

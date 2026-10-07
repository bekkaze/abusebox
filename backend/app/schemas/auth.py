from pydantic import BaseModel, ConfigDict, Field


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=8, max_length=128)


class RefreshRequest(BaseModel):
    refresh: str


class TokenResponse(BaseModel):
    access: str
    refresh: str


class UserCreateRequest(BaseModel):
    username: str = Field(min_length=1, max_length=255)
    email: str = Field(min_length=3, max_length=255)
    phone_number: str = Field(default="", max_length=20)
    password: str = Field(min_length=8, max_length=128)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    email: str
    phone_number: str
    is_superuser: bool = False
    is_active: bool = True


class MeResponse(UserResponse):
    # True while the account still uses DEFAULT_ADMIN_PASSWORD.
    using_default_password: bool = False


class AdminUserItem(UserResponse):
    asset_count: int = 0


class UserUpdateRequest(BaseModel):
    """Admin-only partial update. Omitted fields are left unchanged."""

    email: str | None = Field(default=None, min_length=3, max_length=255)
    is_active: bool | None = None
    is_superuser: bool | None = None
    new_password: str | None = Field(default=None, min_length=8, max_length=128)

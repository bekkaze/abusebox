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
    email: str
    phone_number: str = Field(min_length=4, max_length=20)
    password: str = Field(min_length=8, max_length=128)


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    email: str
    phone_number: str

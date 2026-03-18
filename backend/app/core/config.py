import os
from dataclasses import dataclass


def parse_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def parse_csv(name: str, default: str) -> list[str]:
    raw = os.getenv(name, default)
    return [item.strip() for item in raw.split(",") if item.strip()]


@dataclass(frozen=True)
class Settings:
    app_name: str = os.getenv("APP_NAME", "AbuseBox API")
    app_debug: bool = parse_bool("APP_DEBUG", True)

    app_secret_key: str = os.getenv("APP_SECRET_KEY", "insecure-dev-secret-key-change-me")
    jwt_algorithm: str = os.getenv("JWT_ALGORITHM", "HS256")
    access_token_minutes: int = int(os.getenv("ACCESS_TOKEN_MINUTES", "30"))
    refresh_token_days: int = int(os.getenv("REFRESH_TOKEN_DAYS", "14"))

    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./app.db")
    cors_allowed_origins: list[str] = None  # type: ignore[assignment]

    default_admin_username: str = os.getenv("DEFAULT_ADMIN_USERNAME", "admin")
    default_admin_email: str = os.getenv("DEFAULT_ADMIN_EMAIL", "admin@abusebox.local")
    default_admin_password: str = os.getenv("DEFAULT_ADMIN_PASSWORD", "password123")
    default_admin_phone: str = os.getenv("DEFAULT_ADMIN_PHONE", "11111111")

    abuseipdb_api_key: str = os.getenv("ABUSEIPDB_API_KEY", "")

    def __post_init__(self) -> None:
        object.__setattr__(self, "cors_allowed_origins", parse_csv("APP_CORS_ALLOWED_ORIGINS", "http://localhost:3000"))


settings = Settings()

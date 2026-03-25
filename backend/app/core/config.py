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


def parse_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        return int(raw)
    except ValueError:
        return default


@dataclass(frozen=True)
class Settings:
    app_name: str = os.getenv("APP_NAME", "AbuseBox API")
    app_debug: bool = parse_bool("APP_DEBUG", True)

    app_secret_key: str = os.getenv("APP_SECRET_KEY", "insecure-dev-secret-key-change-me")
    jwt_algorithm: str = os.getenv("JWT_ALGORITHM", "HS256")
    access_token_minutes: int = parse_int("ACCESS_TOKEN_MINUTES", 30)
    refresh_token_days: int = parse_int("REFRESH_TOKEN_DAYS", 14)

    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./app.db")
    cors_allowed_origins: list[str] | None = None

    default_admin_username: str = os.getenv("DEFAULT_ADMIN_USERNAME", "admin")
    default_admin_email: str = os.getenv("DEFAULT_ADMIN_EMAIL", "admin@abusebox.local")
    default_admin_password: str = os.getenv("DEFAULT_ADMIN_PASSWORD", "password123")
    default_admin_phone: str = os.getenv("DEFAULT_ADMIN_PHONE", "11111111")

    abuseipdb_api_key: str = os.getenv("ABUSEIPDB_API_KEY", "")

    # SMTP settings for email alerts
    smtp_host: str = os.getenv("SMTP_HOST", "")
    smtp_port: int = parse_int("SMTP_PORT", 587)
    smtp_username: str = os.getenv("SMTP_USERNAME", "")
    smtp_password: str = os.getenv("SMTP_PASSWORD", "")
    smtp_from_email: str = os.getenv("SMTP_FROM_EMAIL", "")
    smtp_use_tls: bool = parse_bool("SMTP_USE_TLS", True)

    # Webhook alerts
    webhook_url: str = os.getenv("WEBHOOK_URL", "")

    # Scheduler settings
    scheduler_enabled: bool = parse_bool("SCHEDULER_ENABLED", False)
    scheduler_interval_minutes: int = parse_int("SCHEDULER_INTERVAL_MINUTES", 360)

    def __post_init__(self) -> None:
        object.__setattr__(self, "cors_allowed_origins", parse_csv("APP_CORS_ALLOWED_ORIGINS", "http://localhost:3000"))


settings = Settings()

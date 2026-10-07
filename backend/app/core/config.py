import logging
import os
import secrets
from dataclasses import dataclass

logger = logging.getLogger(__name__)

# Values shipped in docs/examples. Using any of them as the JWT secret would let
# anyone forge tokens, so they are treated the same as "not set".
_PLACEHOLDER_SECRETS = {
    "insecure-dev-secret-key-change-me",
    "change-me-in-production",
    "replace-this-secret",
}


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


def _default_secret_key_file(database_url: str) -> str:
    """Keep the generated secret next to the SQLite database (inside the Docker
    volume), falling back to the working directory for other databases."""
    prefix = "sqlite:///"
    if database_url.startswith(prefix):
        db_path = database_url[len(prefix):]
        if db_path and db_path != ":memory:":
            return os.path.join(os.path.dirname(os.path.abspath(db_path)), ".secret_key")
    return os.path.abspath(".secret_key")


def load_secret_key(database_url: str) -> str:
    """Return APP_SECRET_KEY, or a random secret persisted to SECRET_KEY_FILE.

    The random key is generated once and reused so issued tokens survive restarts.
    """
    env_value = os.getenv("APP_SECRET_KEY", "").strip()
    if env_value and env_value not in _PLACEHOLDER_SECRETS:
        return env_value
    if env_value:
        logger.warning("APP_SECRET_KEY is set to a published placeholder value; ignoring it and using a generated secret.")

    path = os.getenv("SECRET_KEY_FILE") or _default_secret_key_file(database_url)
    try:
        with open(path, encoding="utf-8") as handle:
            existing = handle.read().strip()
        if existing:
            return existing
    except FileNotFoundError:
        pass
    except OSError as exc:
        logger.warning("Could not read secret key file %s: %s", path, exc)

    generated = secrets.token_urlsafe(64)
    try:
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        # O_EXCL: if another worker created the file first, use its key instead.
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            handle.write(generated)
        logger.info("Generated a new JWT secret key at %s", path)
        return generated
    except FileExistsError:
        with open(path, encoding="utf-8") as handle:
            return handle.read().strip() or generated
    except OSError as exc:
        logger.warning("Could not persist secret key to %s (%s); sessions will reset on restart.", path, exc)
        return generated


@dataclass(frozen=True)
class Settings:
    app_name: str = os.getenv("APP_NAME", "AbuseBox API")
    app_debug: bool = parse_bool("APP_DEBUG", True)

    app_secret_key: str = ""
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
    scheduler_enabled: bool = parse_bool("SCHEDULER_ENABLED", True)
    scheduler_interval_minutes: int = parse_int("SCHEDULER_INTERVAL_MINUTES", 360)

    def __post_init__(self) -> None:
        object.__setattr__(self, "cors_allowed_origins", parse_csv("APP_CORS_ALLOWED_ORIGINS", "http://localhost:3000"))
        object.__setattr__(self, "app_secret_key", load_secret_key(self.database_url))


settings = Settings()

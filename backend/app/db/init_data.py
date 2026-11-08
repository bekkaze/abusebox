import logging
import os
import secrets

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import hash_password, verify_password
from app.models import User

logger = logging.getLogger(__name__)

# The password every install used before 1.3.2. Accounts still using it are
# asked to change it.
LEGACY_DEFAULT_PASSWORD = "password123"


def initial_password_file() -> str:
    """Where a generated admin password is kept: next to the JWT secret, in the data volume."""
    return os.path.join(os.path.dirname(os.path.abspath(settings.secret_key_file)), "initial_admin_password")


def _save_initial_password(password: str) -> bool:
    """Write the generated password to the data volume. True if it landed there."""
    path = initial_password_file()
    try:
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            handle.write(password + "\n")
    except OSError as exc:
        logger.warning("Could not save the initial admin password to %s: %s", path, exc)
        return False
    return True


def forget_initial_password() -> None:
    try:
        os.remove(initial_password_file())
    except FileNotFoundError:
        logger.debug("No saved initial password to remove; nothing to do.")
    except OSError as exc:
        logger.warning("Could not remove %s: %s", initial_password_file(), exc)


def seed_default_admin(db: Session) -> None:
    admin = db.query(User).filter(User.username == settings.default_admin_username).first()
    if admin:
        _flag_published_password(db, admin)
        return

    generated = not settings.default_admin_password
    password = settings.default_admin_password or secrets.token_urlsafe(12)

    # Written before the account exists, not after. A generated password the
    # operator cannot read is an account nobody can sign in to, and the log is
    # not an acceptable second home for it: container logs are kept, shipped
    # into other systems, and pasted into bug reports. So if it cannot be
    # saved, no account is created and the next start tries again.
    if generated and not _save_initial_password(password):
        logger.error(
            "Not creating the admin account: the generated password could not be saved to %s, "
            "and it is not written to the log. Make that path writable, or set "
            "DEFAULT_ADMIN_PASSWORD, and start again.",
            initial_password_file(),
        )
        return

    db.add(
        User(
            username=settings.default_admin_username,
            email=settings.default_admin_email,
            phone_number=settings.default_admin_phone,
            hashed_password=hash_password(password),
            is_active=True,
            is_staff=True,
            is_superuser=True,
            must_change_password=True,
        )
    )
    db.commit()
    if generated:
        logger.warning(
            "Created the admin account %r with a random password, saved to %s "
            "and readable only by this user. Sign in and change it in Settings; "
            "the saved copy is removed when you do. Under Docker: "
            "docker compose exec backend cat /app/data/initial_admin_password",
            settings.default_admin_username, initial_password_file(),
        )


def _flag_published_password(db: Session, admin: User) -> None:
    """Ask installs from before 1.3.2 that still use a known password to change it."""
    if admin.must_change_password:
        return
    known = {LEGACY_DEFAULT_PASSWORD, settings.default_admin_password} - {""}
    if any(verify_password(password, admin.hashed_password) for password in known):
        admin.must_change_password = True
        db.commit()

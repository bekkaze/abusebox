from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import hash_password
from app.models import User


def seed_default_admin(db: Session) -> None:
    admin = db.query(User).filter(User.username == settings.default_admin_username).first()
    if admin:
        return

    db.add(
        User(
            username=settings.default_admin_username,
            email=settings.default_admin_email,
            phone_number=settings.default_admin_phone,
            hashed_password=hash_password(settings.default_admin_password),
            is_active=True,
            is_staff=True,
            is_superuser=True,
        )
    )
    db.commit()

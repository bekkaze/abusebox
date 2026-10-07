from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models import User


# Use PBKDF2-SHA256 to avoid bcrypt backend/runtime incompatibilities in minimal containers.
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
bearer = HTTPBearer(auto_error=False)


class AuthError(HTTPException):
    def __init__(self, detail: str = "Authentication failed") -> None:
        super().__init__(status_code=status.HTTP_401_UNAUTHORIZED, detail=detail)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def _build_token(subject: str, token_type: str, expires_delta: timedelta, version: int) -> str:
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": subject,
        "type": token_type,
        "ver": version,
        "iat": int(now.timestamp()),
        "exp": int((now + expires_delta).timestamp()),
    }
    return jwt.encode(payload, settings.app_secret_key, algorithm=settings.jwt_algorithm)


def create_access_token(subject: str, version: int = 0) -> str:
    return _build_token(subject, "access", timedelta(minutes=settings.access_token_minutes), version)


def create_refresh_token(subject: str, version: int = 0) -> str:
    return _build_token(subject, "refresh", timedelta(days=settings.refresh_token_days), version)


def decode_token(token: str) -> dict[str, Any]:
    try:
        return jwt.decode(token, settings.app_secret_key, algorithms=[settings.jwt_algorithm])
    except jwt.PyJWTError as exc:
        raise AuthError("Invalid token") from exc


def is_token_revoked(payload: dict[str, Any], user: User) -> bool:
    """Tokens minted before the user's last password change carry an old version.

    Tokens issued by earlier releases have no "ver" claim and count as version 0.
    """
    return payload.get("ver", 0) != (user.token_version or 0)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    if not credentials:
        raise AuthError("Not authenticated")

    payload = decode_token(credentials.credentials)
    if payload.get("type") != "access":
        raise AuthError("Invalid token type")

    username = payload.get("sub")
    if not username:
        raise AuthError("Invalid token payload")

    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise AuthError("User not found")
    if not user.is_active:
        raise AuthError("User is inactive")
    if is_token_revoked(payload, user):
        raise AuthError("Token has been revoked")

    return user


def require_superuser(user: User = Depends(get_current_user)) -> User:
    if not user.is_superuser:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin privileges required.")
    return user

from threading import Lock
from time import monotonic

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.core.client_ip import get_client_ip
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_current_user,
    hash_password,
    is_token_revoked,
    require_superuser,
    verify_password,
)
from app.db.session import get_db
from app.models import Hostname, User
from app.core.config import settings
from app.schemas import (
    AdminUserItem,
    ChangePasswordRequest,
    LoginRequest,
    MeResponse,
    RefreshRequest,
    TokenResponse,
    UserCreateRequest,
    UserResponse,
    UserUpdateRequest,
)

router = APIRouter(prefix="/user", tags=["auth"])


def _issue_tokens(user: User) -> TokenResponse:
    version = user.token_version or 0
    return TokenResponse(
        access=create_access_token(user.username, version),
        refresh=create_refresh_token(user.username, version),
    )

_LOGIN_WINDOW_SECONDS = 15 * 60
_LOGIN_MAX_FAILURES = 5
_LOGIN_LOCK_SECONDS = 15 * 60
_LOGIN_TRACKED_KEYS_MAX = 10_000
_login_attempts: dict[str, list[float]] = {}
_login_locked_until: dict[str, float] = {}
_login_lock = Lock()


def _login_key(request: Request, username: str) -> str:
    return f"{get_client_ip(request)}:{username.lower()}"


def _check_login_limit(key: str) -> None:
    now = monotonic()
    with _login_lock:
        if _login_locked_until.get(key, 0) > now:
            raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many failed logins. Try again in 15 minutes.")


def _record_login_failure(key: str) -> None:
    now = monotonic()
    with _login_lock:
        if len(_login_attempts) > _LOGIN_TRACKED_KEYS_MAX:
            # Drop stale entries so random usernames can't grow memory forever.
            for stale in [k for k, times in _login_attempts.items() if not times or now - times[-1] >= _LOGIN_WINDOW_SECONDS]:
                _login_attempts.pop(stale, None)
            for stale in [k for k, until in _login_locked_until.items() if until <= now]:
                _login_locked_until.pop(stale, None)
        recent = [timestamp for timestamp in _login_attempts.get(key, []) if now - timestamp < _LOGIN_WINDOW_SECONDS]
        recent.append(now)
        _login_attempts[key] = recent
        if len(recent) >= _LOGIN_MAX_FAILURES:
            _login_locked_until[key] = now + _LOGIN_LOCK_SECONDS


def _clear_login_failures(key: str) -> None:
    with _login_lock:
        _login_attempts.pop(key, None)
        _login_locked_until.pop(key, None)


@router.post("/create/", response_model=UserResponse)
def create_user(
    payload: UserCreateRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    """Create a user account. Admin only — public sign-up is not allowed."""
    existing = db.query(User).filter(or_(User.username == payload.username, User.email == payload.email)).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username or email already exists")

    user = User(
        username=payload.username,
        email=payload.email,
        phone_number=payload.phone_number,
        hashed_password=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return UserResponse.model_validate(user)


@router.post("/login/", response_model=TokenResponse)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    key = _login_key(request, payload.username)
    _check_login_limit(key)
    user = db.query(User).filter(User.username == payload.username).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        _record_login_failure(key)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User is inactive")

    _clear_login_failures(key)
    return _issue_tokens(user)


@router.post("/token/refresh/", response_model=TokenResponse)
def refresh_token(payload: RefreshRequest, db: Session = Depends(get_db)):
    decoded = decode_token(payload.refresh)
    if decoded.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    subject = decoded.get("sub")
    if not subject:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    user = db.query(User).filter(User.username == subject).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User is inactive")
    if is_token_revoked(decoded, user):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token has been revoked")

    return _issue_tokens(user)


@router.get("/me/", response_model=MeResponse)
def me(user: User = Depends(get_current_user)):
    using_default = (
        user.username == settings.default_admin_username
        and verify_password(settings.default_admin_password, user.hashed_password)
    )
    return MeResponse(**UserResponse.model_validate(user).model_dump(), using_default_password=using_default)


@router.get("/list/", response_model=list[AdminUserItem])
def list_users(db: Session = Depends(get_db), _: User = Depends(require_superuser)):
    counts = dict(db.query(Hostname.user_id, func.count(Hostname.id)).group_by(Hostname.user_id).all())
    users = db.query(User).order_by(User.id).all()
    return [AdminUserItem(**UserResponse.model_validate(u).model_dump(), asset_count=counts.get(u.id, 0)) for u in users]


@router.patch("/{user_id}/", response_model=UserResponse)
def update_user(
    user_id: int,
    payload: UserUpdateRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_superuser),
):
    """Activate/deactivate, grant/revoke admin, or reset another user's password."""
    target = db.get(User, user_id)
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if target.id == admin.id and (payload.is_active is False or payload.is_superuser is False):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You can't deactivate or demote your own account.")
    removing_admin = target.is_superuser and (payload.is_superuser is False or payload.is_active is False)
    if removing_admin:
        other_admins = db.query(User).filter(User.is_superuser == True, User.is_active == True, User.id != target.id).count()  # noqa: E712
        if other_admins == 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="At least one active admin is required.")
    if payload.email is not None and payload.email != target.email:
        if db.query(User).filter(User.email == payload.email, User.id != target.id).first():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already in use")
        target.email = payload.email

    if payload.is_active is not None:
        target.is_active = payload.is_active
    if payload.is_superuser is not None:
        target.is_superuser = payload.is_superuser
    if payload.new_password is not None or payload.is_active is False:
        # A reset or deactivation signs the user out everywhere.
        target.token_version = (target.token_version or 0) + 1
    if payload.new_password is not None:
        target.hashed_password = hash_password(payload.new_password)
    db.commit()
    db.refresh(target)
    return UserResponse.model_validate(target)


@router.post("/change-password/", response_model=TokenResponse)
def change_password(
    payload: ChangePasswordRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not verify_password(payload.current_password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect.")
    if payload.new_password == payload.current_password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="New password must be different from the current one.")
    user.hashed_password = hash_password(payload.new_password)
    # Revoke every token issued so far, then hand back a fresh pair so this
    # session stays signed in.
    user.token_version = (user.token_version or 0) + 1
    db.commit()
    return _issue_tokens(user)

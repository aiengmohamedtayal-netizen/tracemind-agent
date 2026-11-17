from __future__ import annotations

import hashlib
import secrets
import uuid
from datetime import UTC, datetime, timedelta

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pwdlib import PasswordHash
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.database import get_session
from app.db.models import RefreshTokenModel, UserModel

hasher = PasswordHash.recommended()
bearer = HTTPBearer(auto_error=False)


def _unauthorized() -> HTTPException:
    return HTTPException(status_code=401, detail="Authentication required.", headers={"WWW-Authenticate": "Bearer"})


def hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def create_access_token(user: UserModel) -> str:
    settings = get_settings()
    now = datetime.now(UTC)
    return jwt.encode({"sub": str(user.id), "role": user.role, "iat": now, "exp": now + timedelta(minutes=settings.access_token_minutes)}, settings.jwt_secret, algorithm="HS256")


def issue_pair(session: Session, user: UserModel, family_id: str | None = None) -> dict:
    settings = get_settings()
    raw = secrets.token_urlsafe(48)
    session.add(RefreshTokenModel(user_id=user.id, token_hash=hash_token(raw), family_id=family_id or str(uuid.uuid4()), expires_at=datetime.now(UTC) + timedelta(days=settings.refresh_token_days)))
    return {"access_token": create_access_token(user), "refresh_token": raw, "token_type": "bearer", "expires_in": settings.access_token_minutes * 60}


def get_current_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer), session: Session = Depends(get_session)) -> UserModel:
    if credentials is None:
        raise _unauthorized()
    try:
        payload = jwt.decode(credentials.credentials, get_settings().jwt_secret, algorithms=["HS256"])
        user_id = int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise _unauthorized() from None
    user = session.get(UserModel, user_id)
    if user is None or not user.is_active:
        raise _unauthorized()
    return user

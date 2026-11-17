from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import ValidationError as PydanticValidationError
from sqlalchemy.orm import Session
from sqlalchemy import select, update
from starlette.concurrency import run_in_threadpool

from app.core.config import Settings, get_settings
from app.core.exceptions import NotFoundError, ValidationError
from app.db.database import SessionLocal, check_database_connection, get_session
from app.db.repository import AnalysisRepository
from app.schemas.analysis import AnalysisConfig, JsonAnalysisRequest
from app.services.analysis_orchestrator import AnalysisOrchestrator
from app.services.auth import get_current_user, hasher, hash_token, issue_pair
from app.db.models import RefreshTokenModel, UserModel
from app.schemas.auth import Credentials, RefreshRequest
from slowapi import Limiter
from slowapi.util import get_remote_address

router = APIRouter()
repository = AnalysisRepository()
limiter = Limiter(key_func=get_remote_address)
_auth_limit = get_settings().auth_rate_limit


@router.post("/auth/register", status_code=201)
@limiter.limit(_auth_limit)
def register(request: Request, credentials: Credentials, session: Session = Depends(get_session)) -> dict:
    email = str(credentials.email).strip().lower()
    if session.scalar(select(UserModel).where(UserModel.email == email)):
        raise HTTPException(status_code=409, detail="An account with this email already exists.")
    user = UserModel(email=email, password_hash=hasher.hash(credentials.password), role="user", created_at=datetime.now(UTC))
    session.add(user)
    session.flush()
    tokens = issue_pair(session, user)
    session.commit()
    response = {"user": {"id": user.id, "email": user.email, "role": user.role}, "access_token": tokens["access_token"], "token_type": "bearer", "expires_in": tokens["expires_in"]}
    request.state.refresh_cookie = tokens["refresh_token"]
    return response


@router.post("/auth/login")
@limiter.limit(_auth_limit)
def login(request: Request, credentials: Credentials, session: Session = Depends(get_session)) -> dict:
    email = str(credentials.email).strip().lower()
    user = session.scalar(select(UserModel).where(UserModel.email == email))
    if user is None or not user.is_active or not hasher.verify(credentials.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    pair = issue_pair(session, user)
    session.commit()
    request.state.refresh_cookie = pair["refresh_token"]
    return {"user": {"id": user.id, "email": user.email, "role": user.role}, "access_token": pair["access_token"], "token_type": "bearer", "expires_in": pair["expires_in"]}


@router.post("/auth/refresh")
@limiter.limit("10/minute")
def refresh(request: Request, session: Session = Depends(get_session)) -> dict:
    raw_token = request.cookies.get("tracemind_refresh", "")
    if not raw_token:
        raise HTTPException(status_code=401, detail="Refresh token is invalid or revoked.")
    old = session.scalar(select(RefreshTokenModel).where(RefreshTokenModel.token_hash == hash_token(raw_token)))
    now = datetime.now(UTC)
    if old is None:
        raise HTTPException(status_code=401, detail="Refresh token is invalid or revoked.")
    if old.revoked_at is not None:
        session.query(RefreshTokenModel).filter(RefreshTokenModel.family_id == old.family_id, RefreshTokenModel.revoked_at.is_(None)).update({RefreshTokenModel.revoked_at: now}, synchronize_session=False)
        session.commit()
        raise HTTPException(status_code=401, detail="Refresh token reuse detected; this session has been revoked.")
    if old.expires_at.replace(tzinfo=UTC) <= now:
        raise HTTPException(status_code=401, detail="Refresh token is invalid or revoked.")
    claimed = session.execute(
        update(RefreshTokenModel)
        .where(
            RefreshTokenModel.id == old.id,
            RefreshTokenModel.revoked_at.is_(None),
            RefreshTokenModel.expires_at > now,
        )
        .values(revoked_at=now)
        .execution_options(synchronize_session=False)
    )
    if claimed.rowcount != 1:
        session.rollback()
        old = session.scalar(select(RefreshTokenModel).where(RefreshTokenModel.token_hash == hash_token(raw_token)))
        if old is not None and old.revoked_at is not None:
            session.query(RefreshTokenModel).filter(RefreshTokenModel.family_id == old.family_id, RefreshTokenModel.revoked_at.is_(None)).update({RefreshTokenModel.revoked_at: now}, synchronize_session=False)
            session.commit()
            raise HTTPException(status_code=401, detail="Refresh token reuse detected; this session has been revoked.")
        raise HTTPException(status_code=401, detail="Refresh token is invalid or revoked.")
    old.revoked_at = now
    user = session.get(UserModel, old.user_id)
    if user is None or not user.is_active:
        session.commit()
        raise HTTPException(status_code=401, detail="Account is inactive.")
    pair = issue_pair(session, user, family_id=old.family_id)
    session.flush()
    new = session.scalar(select(RefreshTokenModel).where(RefreshTokenModel.token_hash == hash_token(pair["refresh_token"])))
    old.replaced_by_id = new.id
    session.commit()
    request.state.refresh_cookie = pair["refresh_token"]
    return {"user": {"id": user.id, "email": user.email, "role": user.role}, "access_token": pair["access_token"], "token_type": "bearer", "expires_in": pair["expires_in"]}


@router.post("/auth/logout", status_code=204)
def logout(request: Request, session: Session = Depends(get_session), user: UserModel = Depends(get_current_user)) -> Response:
    raw_token = request.cookies.get("tracemind_refresh", "")
    token = session.scalar(select(RefreshTokenModel).where(RefreshTokenModel.token_hash == hash_token(raw_token), RefreshTokenModel.user_id == user.id)) if raw_token else None
    if token is not None and token.revoked_at is None:
        token.revoked_at = datetime.now(UTC)
        session.commit()
    return Response(status_code=204)


@router.get("/auth/me")
def me(user: UserModel = Depends(get_current_user)) -> dict:
    return {"id": user.id, "email": user.email, "role": user.role}


def _orchestrator(settings: Settings = Depends(get_settings)) -> AnalysisOrchestrator:
    return AnalysisOrchestrator(repository, settings.random_seed)


@router.get("/health")
def health() -> dict[str, Any]:
    try:
        check_database_connection()
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="SQLite database is unavailable.") from exc
    return {"status": "ok", "database": "sqlite_connected", "models": ["IsolationForest", "PSO", "IntelligentAgent"]}


@router.post("/analyze")
async def analyze(
    request: Request,
    settings: Settings = Depends(get_settings),
    orchestrator: AnalysisOrchestrator = Depends(_orchestrator),
    user: UserModel = Depends(get_current_user),
) -> dict:
    _validate_content_length(request, settings)
    try:
        dataset_name, file_format, content, config = await _read_analysis_request(request, settings)
        return await run_in_threadpool(
            _analyze_and_persist,
            orchestrator,
            owner_id=user.id,
            dataset_name=dataset_name,
            file_format=file_format,
            content=content,
            config=config,
        )
    except ValidationError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    except PydanticValidationError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=_format_pydantic_error(exc)) from exc


def _analyze_and_persist(
    orchestrator: AnalysisOrchestrator,
    *,
    owner_id: int,
    dataset_name: str,
    file_format: str,
    content: str,
    config: AnalysisConfig,
) -> dict:
    """Keep CPU-heavy analysis and persistence off the ASGI event loop."""
    with SessionLocal() as session:
        return orchestrator.analyze(
            session,
            owner_id=owner_id,
            dataset_name=dataset_name,
            file_format=file_format,
            content=content,
            config=config,
        )


@router.get("/history")
def list_history(
    limit: int = 20,
    offset: int = 0,
    session: Session = Depends(get_session),
    user: UserModel = Depends(get_current_user),
) -> dict:
    return {"runs": repository.list_runs(session, user.id, limit=limit, offset=offset), "limit": limit, "offset": offset}


@router.get("/history/{run_id}")
def get_history_run(run_id: str, session: Session = Depends(get_session), user: UserModel = Depends(get_current_user)) -> dict:
    try:
        return repository.get_run(session, run_id, user.id)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("/history/{run_id}/events")
def get_history_events(run_id: str, session: Session = Depends(get_session), user: UserModel = Depends(get_current_user)) -> dict[str, list[dict]]:
    try:
        return {"events": repository.get_events(session, run_id, user.id)}
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.delete("/history/{run_id}")
def delete_history_run(run_id: str, session: Session = Depends(get_session), user: UserModel = Depends(get_current_user)) -> Response:
    try:
        repository.delete_run(session, run_id, user.id)
        session.commit()
    except NotFoundError as exc:
        session.rollback()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _validate_content_length(request: Request, settings: Settings) -> None:
    value = request.headers.get("content-length")
    if value and int(value) > settings.max_upload_size_bytes:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail=f"Upload exceeds the {settings.max_upload_size_mb} MB limit.")


async def _read_analysis_request(request: Request, settings: Settings) -> tuple[str, str, str, AnalysisConfig]:
    content_type = request.headers.get("content-type", "").lower()
    if content_type.startswith("application/json"):
        try:
            raw = await request.json()
        except json.JSONDecodeError as exc:
            raise ValidationError("Malformed JSON request body.") from exc
        payload = JsonAnalysisRequest.model_validate(raw)
        _validate_payload_size(payload.content, settings)
        return payload.dataset_name, payload.format, payload.content, payload.config
    if content_type.startswith("multipart/form-data"):
        form = await request.form()
        upload = form.get("file")
        if upload is None or not hasattr(upload, "read"):
            raise ValidationError("Multipart analysis request requires a file field.")
        raw_bytes = await upload.read()
        if len(raw_bytes) > settings.max_upload_size_bytes:
            raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail=f"Upload exceeds the {settings.max_upload_size_mb} MB limit.")
        try:
            content = raw_bytes.decode("utf-8-sig")
        except UnicodeDecodeError as exc:
            raise ValidationError("Uploaded log file must be UTF-8 encoded text.") from exc
        dataset_name = str(form.get("dataset_name") or getattr(upload, "filename", "")).strip()
        file_format = str(form.get("format") or _infer_format(str(getattr(upload, "filename", "")))).upper()
        if not dataset_name:
            raise ValidationError("dataset_name is required.")
        if file_format not in {"CSV", "JSON", "JSONL", "LOG", "TEXT"}:
            raise ValidationError("format must be CSV, JSON, JSONL, LOG, or TEXT.")
        values = {field: form.get(field) for field in AnalysisConfig.model_fields}
        config = AnalysisConfig.model_validate({key: value for key, value in values.items() if value is not None})
        return dataset_name, file_format, content, config
    raise ValidationError("Content-Type must be application/json or multipart/form-data.")


def _infer_format(filename: str) -> str:
    lowered = filename.lower()
    if lowered.endswith(".csv"):
        return "CSV"
    if lowered.endswith(".json"):
        return "JSON"
    if lowered.endswith((".jsonl", ".ndjson")):
        return "JSONL"
    return "LOG"


def _validate_payload_size(content: str, settings: Settings) -> None:
    if len(content.encode("utf-8")) > settings.max_upload_size_bytes:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail=f"Upload exceeds the {settings.max_upload_size_mb} MB limit.")


def _format_pydantic_error(exc: PydanticValidationError) -> str:
    details = exc.errors(include_url=False)
    return "; ".join(f"{'.'.join(str(part) for part in item['loc'])}: {item['msg']}" for item in details)

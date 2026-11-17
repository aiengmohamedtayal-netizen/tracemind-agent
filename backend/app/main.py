from __future__ import annotations

import logging
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.gzip import GZipMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.api.routes import router, health as health_handler
from app.core.config import get_settings
from app.core.exceptions import DomainError
from app.db.database import engine, Base
from app.api.routes import limiter

settings = get_settings()
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("tracemind")


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Safety net: create tables if they don't exist (alembic migrations are the canonical path).
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables verified/created.")
    logger.info("Models available: IsolationForest, PSO, IntelligentAgent.")
    yield


app = FastAPI(title="TraceMind API", version="1.0.0", lifespan=lifespan)
app.add_middleware(GZipMiddleware, minimum_size=1024)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Accept", "Content-Type", "Authorization", "X-Request-ID"],
)


@app.middleware("http")
async def request_context(request: Request, call_next):
    request_id = request.headers.get("x-request-id") or uuid.uuid4().hex
    try:
        response = await call_next(request)
    except Exception:
        logger.exception("Unhandled request failure", extra={"request_id": request_id, "path": request.url.path})
        return JSONResponse(status_code=500, content={"detail": "An unexpected server error occurred.", "request_id": request_id})
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "no-referrer"
    refresh_cookie = getattr(request.state, "refresh_cookie", None)
    if refresh_cookie:
        response.set_cookie("tracemind_refresh", refresh_cookie, httponly=True, secure=settings.app_env == "production", samesite="strict", max_age=settings.refresh_token_days * 86400, path="/api/auth")
    if request.url.path == "/api/auth/logout":
        response.delete_cookie("tracemind_refresh", path="/api/auth", httponly=True, secure=settings.app_env == "production", samesite="strict")
    return response


@app.exception_handler(DomainError)
async def domain_error_handler(_: Request, exc: DomainError) -> JSONResponse:
    return JSONResponse(status_code=422, content={"detail": str(exc)})


@app.exception_handler(RequestValidationError)
async def request_validation_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    errors = [{"loc": [str(part) for part in error.get("loc", ())], "msg": str(error.get("msg", "Invalid request.")), "type": str(error.get("type", "validation_error"))} for error in exc.errors()]
    return JSONResponse(status_code=422, content={"detail": errors})


app.include_router(router, prefix="/api")
# Direct health endpoint is useful for deployment probes while the frontend uses /api/health.
app.add_api_route("/health", health_handler, methods=["GET"], include_in_schema=False)

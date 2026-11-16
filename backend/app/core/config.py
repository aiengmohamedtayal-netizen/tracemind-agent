from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import model_validator


class Settings(BaseSettings):
    """Centralized, environment-backed application configuration."""

    model_config = SettingsConfigDict(env_file=("backend/.env", ".env"), extra="ignore")

    app_env: str = "development"
    app_host: str = "127.0.0.1"
    app_port: int = 8000
    database_url: str = "sqlite:///./data/tracemind.db"
    cors_origins: list[str] | str = Field(default_factory=lambda: ["http://localhost:3000", "http://localhost:5173"])
    max_upload_size_mb: int = Field(default=25, ge=1, le=100)
    random_seed: int = 42
    jwt_secret: str = "local-development-secret-change-before-deploy-32chars"
    access_token_minutes: int = Field(default=10, ge=1, le=60)
    refresh_token_days: int = Field(default=14, ge=1, le=90)
    auth_enabled: bool = True

    @model_validator(mode="after")
    def require_production_secret(self):
        if self.app_env == "production":
            if self.jwt_secret.startswith("local-") or len(self.jwt_secret) < 32 or len(set(self.jwt_secret)) < 16:
                raise ValueError("JWT_SECRET must be a unique, high-entropy secret of at least 32 characters in production.")
            if "*" in self.cors_origins:
                raise ValueError("CORS_ORIGINS cannot contain '*' when credentialed production requests are enabled.")
        return self

    @field_validator("cors_origins", mode="before")
    @classmethod
    def split_origins(cls, value: object) -> list[str]:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return list(value) if isinstance(value, list) else []

    @property
    def max_upload_size_bytes(self) -> int:
        return self.max_upload_size_mb * 1024 * 1024

    def ensure_data_directory(self) -> None:
        if self.database_url.startswith("sqlite:///"):
            database_path = Path(self.database_url.removeprefix("sqlite:///"))
            if not database_path.is_absolute():
                database_path = Path.cwd() / database_path
            database_path.parent.mkdir(parents=True, exist_ok=True)


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    settings.ensure_data_directory()
    return settings

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator


class AnalysisConfig(BaseModel):
    contamination: float = Field(default=0.12, ge=0.02, le=0.40)
    n_estimators: int = Field(default=100, ge=25, le=500)
    swarm_size: int = Field(default=30, ge=10, le=100)
    max_iterations: int = Field(default=25, ge=10, le=60)
    inertia_weight: float = Field(default=0.72, ge=0.2, le=1.2)
    cognitive_coeff: float = Field(default=1.49, ge=0.5, le=2.5)
    social_coeff: float = Field(default=1.49, ge=0.5, le=2.5)


class JsonAnalysisRequest(BaseModel):
    dataset_name: str = Field(min_length=1, max_length=255)
    format: Literal["CSV", "JSON", "JSONL", "LOG", "TEXT"]
    content: str = Field(min_length=1)
    config: AnalysisConfig = Field(default_factory=AnalysisConfig)

    @field_validator("dataset_name")
    @classmethod
    def trim_dataset_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("dataset_name must not be blank")
        return value

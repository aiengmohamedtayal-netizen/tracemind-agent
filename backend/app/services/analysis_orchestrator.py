from __future__ import annotations

import time
import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy.orm import Session

from app.db.repository import AnalysisRepository
from app.schemas.analysis import AnalysisConfig
from app.services.action_catalog import build_candidate_actions
from app.services.anomaly_detection import detect_anomalies
from app.services.ingestion import parse_event_content
from app.services.intelligent_agent import build_recommendation
from app.services.pso_optimizer import optimize_actions
from app.services.severity_classifier import classify_severity


class AnalysisOrchestrator:
    """Framework-independent pipeline coordinator with one atomic persistence boundary."""

    def __init__(self, repository: AnalysisRepository, random_seed: int) -> None:
        self._repository = repository
        self._random_seed = random_seed

    def analyze(self, session: Session, *, owner_id: int, dataset_name: str, file_format: str, content: str, config: AnalysisConfig) -> dict:
        started = time.perf_counter()
        events = parse_event_content(content, file_format)
        detection = detect_anomalies(events, contamination=config.contamination, n_estimators=config.n_estimators, random_seed=self._random_seed)
        severity = classify_severity(detection.events)
        candidates = build_candidate_actions(detection.events, detection.summary)
        pso = optimize_actions(candidates, swarm_size=config.swarm_size, max_iterations=config.max_iterations, inertia_weight=config.inertia_weight, cognitive_coeff=config.cognitive_coeff, social_coeff=config.social_coeff, random_seed=self._random_seed).payload
        agent = build_recommendation(
            detection.events,
            detection.summary,
            pso,
            dataset_metadata={"dataset_name": dataset_name, "file_format": file_format, "data_source": "live_api"},
        )
        result = {
            "run_id": f"run_{uuid.uuid4().hex}",
            "created_at": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
            "dataset_name": dataset_name,
            "file_format": file_format,
            "data_source": "live_api",
            "status": "completed",
            "duration_ms": 0,
            "isolation_forest": detection.summary,
            "severity_classification": severity.summary,
            "pso_optimization": pso,
            "agent_recommendation": agent,
            "events": detection.events,
        }
        result["duration_ms"] = round((time.perf_counter() - started) * 1000)
        result = _json_safe(result)
        # Authentication dependencies may have opened a read-only transaction
        # on this request-scoped session. End it before the atomic write boundary.
        if session.in_transaction():
            session.commit()
        with session.begin():
            self._repository.save_completed_run(session, result, owner_id=owner_id)
        return result


def _json_safe(value: Any) -> Any:
    """Detach API/persistence payloads from NumPy scalar implementations."""
    if isinstance(value, dict):
        return {key: _json_safe(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_json_safe(item) for item in value]
    if hasattr(value, "item"):
        return value.item()
    return value

"""Tests for the Random Forest severity classifier (additive, non-breaking)."""

from __future__ import annotations

import json

from app.services.severity_classifier import (
    MODEL_PATH,
    classify_severity,
    extract_features,
    load_bundle,
)
from app.services.severity_labeling import label_event


def _evaluated_event(**overrides: object) -> dict:
    event = {
        "event_id": "evt-test",
        "timestamp": "2026-11-01T08:00:00Z",
        "service": "payments",
        "event_type": "CHARGE",
        "source_ip": "10.0.0.2",
        "latency_ms": 40,
        "error_rate": 0.01,
        "cpu_pct": 25,
        "memory_mb": 512,
        "payload_bytes": 256,
        "status_code": 200,
        "message": "request completed successfully",
        "anomaly_score": 0.1,
        "isolation_depth": 12.0,
        "is_anomaly": False,
        "severity": "normal",
        "primary_driver": "latency_ms",
    }
    event.update(overrides)
    return event


def test_labeling_rules_cover_each_band() -> None:
    assert label_event(anomaly_score=0.9, is_anomaly=True, status_code=200, error_rate=0.01, exception_term=0.0) == (
        "critical",
        "R1",
    )
    assert label_event(anomaly_score=0.6, is_anomaly=False, status_code=503, error_rate=0.01, exception_term=0.0) == (
        "critical",
        "R2",
    )
    assert label_event(anomaly_score=0.5, is_anomaly=True, status_code=200, error_rate=0.9, exception_term=0.0) == (
        "critical",
        "R3",
    )
    assert label_event(anomaly_score=0.7, is_anomaly=True, status_code=200, error_rate=0.01, exception_term=1.0) == (
        "critical",
        "R4",
    )
    assert label_event(anomaly_score=0.5, is_anomaly=True, status_code=200, error_rate=0.01, exception_term=0.0) == (
        "medium",
        "R5",
    )
    assert label_event(anomaly_score=0.5, is_anomaly=False, status_code=404, error_rate=0.01, exception_term=0.0) == (
        "medium",
        "R6",
    )
    assert label_event(anomaly_score=0.5, is_anomaly=False, status_code=200, error_rate=0.4, exception_term=0.0) == (
        "medium",
        "R7",
    )
    assert label_event(anomaly_score=0.1, is_anomaly=False, status_code=200, error_rate=0.01, exception_term=0.0) == (
        "normal",
        "R8",
    )


def test_feature_extraction_uses_fixed_order_and_fills_missing() -> None:
    features = extract_features(_evaluated_event())
    assert len(features) == 15
    assert features[0] == 0.1  # anomaly_score
    assert features[2] == 0.0  # is_anomaly
    assert features[9] == 0.0  # status_server_error
    assert features[10] == 2.0  # severity_rank derived from a 200 status
    generic = _evaluated_event(
        log_features={"severity_rank": 5.0, "error_term": 1.0, "warning_term": 0.0, "exception_term": 1.0}
    )
    generic_features = extract_features(generic)
    assert generic_features[10] == 5.0
    assert generic_features[11] == 1.0
    assert generic_features[13] == 1.0


def test_classifier_predicts_clear_cases() -> None:
    bundle = load_bundle()
    assert bundle["label_rules_version"] == "v1"
    critical = _evaluated_event(
        anomaly_score=0.95,
        isolation_depth=8.0,
        is_anomaly=True,
        latency_ms=8000,
        error_rate=0.9,
        cpu_pct=97,
        memory_mb=4000,
        payload_bytes=40000,
        status_code=503,
        message="ERROR exception in payment handler",
        severity="critical",
    )
    medium = _evaluated_event(
        anomaly_score=0.55,
        isolation_depth=9.0,
        is_anomaly=True,
        latency_ms=1500,
        error_rate=0.4,
        cpu_pct=80,
        memory_mb=1500,
        payload_bytes=8192,
        status_code=404,
        message="WARN upstream retry after timeout",
        severity="medium",
    )
    normal = _evaluated_event()
    result = classify_severity([critical, medium, normal])
    assert [event["ml_severity"] for event in result.events] == ["critical", "medium", "normal"]
    assert all(0.0 <= event["ml_severity_confidence"] <= 1.0 for event in result.events)
    assert all(
        isinstance(event["ml_severity_explanation"], str) and event["ml_severity_explanation"].endswith(".")
        for event in result.events
    )
    assert (
        "critical" in result.events[0]["ml_severity_explanation"].lower()
        or "attention" in result.events[0]["ml_severity_explanation"].lower()
    )
    assert result.summary["counts"] == {"critical": 1, "medium": 1, "normal": 1}
    assert result.summary["model"] == "SeverityClassifier"
    assert "not human-verified" in result.summary["labels_note"]


def test_classifier_trains_from_bundled_data_when_model_file_missing(monkeypatch, tmp_path) -> None:
    import app.services.severity_classifier as classifier_module

    monkeypatch.setattr(classifier_module, "MODEL_PATH", tmp_path / "missing.joblib")
    monkeypatch.setattr(classifier_module, "_cached_bundle", None)
    result = classify_severity([_evaluated_event()])
    assert result.events[0]["ml_severity"] == "normal"
    assert result.summary["counts"]["normal"] == 1
    monkeypatch.setattr(classifier_module, "_cached_bundle", None)
    monkeypatch.setattr(classifier_module, "MODEL_PATH", MODEL_PATH)


def test_endpoint_returns_ml_severity_fields(client, valid_events) -> None:
    account = client.post(
        "/api/auth/register", json={"email": "severity@example.com", "password": "correct horse battery staple"}
    ).json()
    auth = {"Authorization": f"Bearer {account['access_token']}"}
    response = client.post(
        "/api/analyze",
        json={
            "dataset_name": "fixture.json",
            "format": "JSON",
            "content": json.dumps(valid_events),
            "config": {
                "contamination": 0.2,
                "n_estimators": 50,
                "swarm_size": 20,
                "max_iterations": 10,
                "inertia_weight": 0.72,
                "cognitive_coeff": 1.49,
                "social_coeff": 1.49,
            },
        },
        headers=auth,
    )
    assert response.status_code == 200, response.text
    report = response.json()
    # Existing shape is untouched: the old severity band is still present.
    assert all(event["severity"] in {"critical", "high", "medium", "normal"} for event in report["events"])
    assert all(event["ml_severity"] in {"critical", "medium", "normal"} for event in report["events"])
    assert all(0.0 <= event["ml_severity_confidence"] <= 1.0 for event in report["events"])
    assert all(event["ml_severity_explanation"] for event in report["events"])
    summary = report["severity_classification"]
    assert summary["model"] == "SeverityClassifier"
    assert summary["total_events"] == len(valid_events)
    assert sum(summary["counts"].values()) == len(valid_events)
    assert client.get("/api/health").json()["models"][-1] == "SeverityClassifier"

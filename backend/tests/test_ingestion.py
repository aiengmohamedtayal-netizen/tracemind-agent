import json
import pytest
from app.core.exceptions import ValidationError
from app.services.ingestion import parse_event_content
from app.services.anomaly_detection import detect_anomalies
from app.services.action_catalog import build_candidate_actions


def test_parses_valid_json(valid_events):
    events = parse_event_content(json.dumps({"events": valid_events}), "JSON")
    assert len(events) == len(valid_events)
    assert events[0]["timestamp"].endswith("Z")


def test_rejects_missing_fields(valid_events):
    invalid = valid_events.copy()
    invalid[0] = {key: value for key, value in invalid[0].items() if key != "memory_mb"}
    with pytest.raises(ValidationError, match="missing fields"):
        parse_event_content(json.dumps(invalid), "JSON")


def test_rejects_malformed_json():
    with pytest.raises(ValidationError, match="Malformed JSON"):
        parse_event_content("{no", "JSON")


def test_parses_spark_text_logs_without_fabricating_telemetry():
    content = """17/06/09 20:10:40 INFO spark.SecurityManager: Authentication enabled
17/06/09 20:10:41 WARN spark.Executor: Executor delayed for 1200 ms
17/06/09 20:10:42 ERROR spark.TaskRunner: Task failed with exception
17/06/09 20:10:43 INFO spark.Context: Job completed for 4 records"""
    events = parse_event_content(content, "LOG")
    assert len(events) == 4
    assert events[0]["timestamp"].startswith("2017-06-09T20:10:40")
    assert events[0]["service"] == "spark.SecurityManager"
    assert events[2]["event_type"] == "ERROR"
    assert events[2]["latency_ms"] is None
    assert events[2]["cpu_pct"] is None
    assert "log_features" in events[2]

    result = detect_anomalies(events, contamination=0.25, n_estimators=25, random_seed=42)
    assert result.summary["input_profile"] == "generic_log"
    assert result.summary["total_events"] == 4
    candidates = build_candidate_actions(result.events, result.summary)
    assert len(candidates) == 5
    assert all(candidate["action_code"].startswith("LOG_") for candidate in candidates)


def test_parses_structured_csv_and_jsonl_log_shapes():
    csv_content = 'LineId,Date,Time,Level,Component,Content\n1,17/06/09,20:10:40,INFO,spark.Context,"Job started, stage 1"\n2,17/06/09,20:10:41,ERROR,spark.Executor,"Task failed, retrying"'
    csv_events = parse_event_content(csv_content, "CSV")
    assert csv_events[0]["event_id"] == "1"
    assert csv_events[0]["message"] == "Job started, stage 1"
    assert csv_events[1]["event_type"] == "ERROR"

    jsonl = '{"time":"2026-11-16T12:00:00Z","level":"INFO","service":"worker","message":"started"}\n{"time":"2026-11-16T12:00:01Z","level":"ERROR","service":"worker","message":"failed to process item"}'
    jsonl_events = parse_event_content(jsonl, "JSONL")
    assert [event["event_id"] for event in jsonl_events] == ["line_1", "line_2"]
    assert jsonl_events[1]["status_code"] is None

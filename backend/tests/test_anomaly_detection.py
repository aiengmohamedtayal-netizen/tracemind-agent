from app.services.anomaly_detection import detect_anomalies


def test_detection_returns_event_aligned_scores(valid_events):
    result = detect_anomalies(valid_events, contamination=0.2, n_estimators=100, random_seed=42)
    assert len(result.events) == len(valid_events)
    assert result.summary["total_events"] == len(valid_events)
    assert all(0 <= event["anomaly_score"] <= 1 for event in result.events)


def test_detection_is_reproducible(valid_events):
    first = detect_anomalies(valid_events, contamination=0.2, n_estimators=50, random_seed=42)
    second = detect_anomalies(valid_events, contamination=0.2, n_estimators=50, random_seed=42)
    assert [event["anomaly_score"] for event in first.events] == [event["anomaly_score"] for event in second.events]

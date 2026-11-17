from app.services.anomaly_detection import detect_anomalies
from app.services.pso_optimizer import action_fitness, exhaustive_best_action, optimize_actions
from validation.fixtures import (
    ISOLATION_FOREST_BASELINE,
    PSO_BASELINE,
    constant_events,
    copy_events,
    labelled_outlier_events,
    pso_actions,
)


def test_labelled_fixture_reports_all_confusion_matrix_terms():
    events, truth = labelled_outlier_events()
    result = detect_anomalies(copy_events(events), **ISOLATION_FOREST_BASELINE)
    detected = {event["event_id"] for event in result.events if event["is_anomaly"]}
    assert len(detected & truth) == 4
    assert len(detected - truth) == 0
    assert len(truth - detected) == 0


def test_constant_fixture_has_safe_non_fabricated_output():
    result = detect_anomalies(constant_events(), **ISOLATION_FOREST_BASELINE)
    assert result.summary["anomalous_events_count"] == 0
    assert result.summary["threshold_score"] is None
    assert all(event["anomaly_score"] == 0.0 and not event["is_anomaly"] for event in result.events)


def test_reproducibility_uses_same_fixture_and_seed():
    events, _ = labelled_outlier_events()
    left = detect_anomalies(copy_events(events), **ISOLATION_FOREST_BASELINE)
    right = detect_anomalies(copy_events(events), **ISOLATION_FOREST_BASELINE)
    assert [event["anomaly_score"] for event in left.events] == [event["anomaly_score"] for event in right.events]


def test_pso_records_zero_gap_against_exhaustive_baseline_for_fixture():
    actions = pso_actions()
    baseline = actions[exhaustive_best_action(actions)]
    result = optimize_actions(actions, **PSO_BASELINE).payload
    assert result["selected_action"]["action_id"] == baseline["action_id"]
    assert action_fitness(baseline) - result["selected_action"]["composite_fitness"] == 0

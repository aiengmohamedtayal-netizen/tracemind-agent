from __future__ import annotations

from copy import deepcopy

from app.services.action_catalog import build_candidate_actions
from app.services.agent.beliefs import build_beliefs
from app.services.agent.evidence import build_evidence
from app.services.agent.planning import generate_candidate_plans, generate_goals, select_intention
from app.services.anomaly_detection import detect_anomalies
from app.services.intelligent_agent import build_recommendation
from app.services.pso_optimizer import optimize_actions
from validation.fixtures import ISOLATION_FOREST_BASELINE, PSO_BASELINE, constant_events, copy_events, labelled_outlier_events


def _real_agent_inputs():
    events, _ = labelled_outlier_events()
    detection = detect_anomalies(copy_events(events), **ISOLATION_FOREST_BASELINE)
    actions = build_candidate_actions(detection.events, detection.summary)
    pso = optimize_actions(actions, **PSO_BASELINE).payload
    return detection.events, detection.summary, pso


def test_evidence_preserves_actual_event_and_pso_references():
    events, summary, pso = _real_agent_inputs()

    evidence = build_evidence(events, summary, pso, {"dataset_name": "fixture.json"})

    anomaly_event_ids = {event["event_id"] for event in events if event["is_anomaly"]}
    observed_event_ids = {
        reference
        for item in evidence.items
        if item.evidence_id.startswith("evidence-event-")
        for reference in item.references
    }
    assert anomaly_event_ids == observed_event_ids
    assert evidence.selected_action_id == pso["selected_action"]["action_id"]
    assert not evidence.missing_evidence


def test_beliefs_goals_and_plans_are_traceable_to_evidence():
    events, summary, pso = _real_agent_inputs()
    evidence = build_evidence(events, summary, pso, None)
    beliefs = build_beliefs(events, evidence)
    goals = generate_goals(beliefs)
    plans = generate_candidate_plans(evidence.candidate_actions, evidence.selected_action_id, goals)

    evidence_ids = {item.evidence_id for item in evidence.items}
    belief_ids = {belief.belief_id for belief in beliefs}
    goal_ids = {goal.goal_id for goal in goals}
    assert all(set(belief.supporting_evidence_ids).issubset(evidence_ids) for belief in beliefs)
    assert all(set(goal.source_belief_ids).issubset(belief_ids) for goal in goals)
    assert all(set(plan.goal_ids).issubset(goal_ids) for plan in plans)
    assert all(set(plan.supporting_evidence_ids).issubset(evidence_ids) for plan in plans)


def test_selected_intention_matches_existing_pso_selection_without_rescoring():
    events, summary, pso = _real_agent_inputs()

    recommendation = build_recommendation(events, summary, pso)
    trace = recommendation["decision_trace"]

    assert trace["selected_intention"]["status"] == "selected"
    assert trace["selected_intention"]["action_id"] == pso["selected_action"]["action_id"]
    selected_plan = next(plan for plan in trace["candidate_plans"] if plan["is_pso_selected"])
    assert selected_plan["action_id"] == pso["selected_action"]["action_id"]
    assert "without rescore or override" in recommendation["why_action_selected"]


def test_normal_telemetry_does_not_generate_recommendation():
    events = constant_events()
    detection = detect_anomalies(copy_events(events), **ISOLATION_FOREST_BASELINE)
    pso = optimize_actions(build_candidate_actions(detection.events, detection.summary), **PSO_BASELINE).payload

    recommendation = build_recommendation(detection.events, detection.summary, pso)

    assert recommendation["decision_trace"]["selected_intention"]["status"] == "no_recommendation"
    assert recommendation["execution_steps"] == []


def test_missing_pso_output_returns_safe_no_recommendation():
    events, summary, _ = _real_agent_inputs()

    recommendation = build_recommendation(events, summary, None)

    trace = recommendation["decision_trace"]
    assert trace["selected_intention"]["status"] == "no_recommendation"
    assert any("PSO" in item for item in trace["missing_evidence"])
    assert recommendation["execution_steps"] == []


def test_contradictory_pso_selection_returns_safe_no_recommendation():
    events, summary, pso = _real_agent_inputs()
    contradictory = deepcopy(pso)
    contradictory["selected_action"] = {**contradictory["selected_action"], "action_id": "ACT-NOT-IN-CANDIDATES"}

    recommendation = build_recommendation(events, summary, contradictory)

    trace = recommendation["decision_trace"]
    assert trace["selected_intention"]["status"] == "no_recommendation"
    assert any(belief["status"] == "contradicted" for belief in trace["beliefs"])


def test_selected_action_metadata_drift_returns_safe_no_recommendation():
    events, summary, pso = _real_agent_inputs()
    contradictory = deepcopy(pso)
    contradictory["selected_action"] = {**contradictory["selected_action"], "estimated_cost_usd": 999.0}

    recommendation = build_recommendation(events, summary, contradictory)

    assert recommendation["decision_trace"]["selected_intention"]["status"] == "no_recommendation"
    assert any("metadata" in belief["explanation"] for belief in recommendation["decision_trace"]["beliefs"])


def test_identical_inputs_produce_identical_decision_trace():
    events, summary, pso = _real_agent_inputs()

    first = build_recommendation(events, summary, pso, dataset_metadata={"dataset_name": "fixture.json"})
    second = build_recommendation(events, summary, pso, dataset_metadata={"dataset_name": "fixture.json"})

    assert first["decision_trace"] == second["decision_trace"]


def test_empty_evidence_is_explicitly_handled_without_action():
    recommendation = build_recommendation([], None, None)

    trace = recommendation["decision_trace"]
    assert trace["selected_intention"]["status"] == "no_recommendation"
    assert len(trace["missing_evidence"]) >= 3
    assert all(not step["command_or_action"].startswith("!") for step in recommendation["execution_steps"])

from __future__ import annotations

from typing import Any

from app.services.agent.beliefs import build_beliefs
from app.services.agent.evidence import build_evidence
from app.services.agent.explanation import build_recommendation_payload
from app.services.agent.models import AgentState, DecisionTrace
from app.services.agent.planning import generate_candidate_plans, generate_goals, select_intention


def build_recommendation(
    events: list[dict[str, Any]] | None,
    summary: dict[str, Any] | None,
    optimization: dict[str, Any] | None,
    *,
    dataset_metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Create a deterministic, evidence-bound, advisory investigation recommendation.

    This is intentionally a pure function. It consumes completed upstream outputs and
    cannot run commands, scan networks, modify systems, or override PSO.
    """
    evidence = build_evidence(events, summary, optimization, dataset_metadata)
    beliefs = build_beliefs(events, evidence)
    goals = generate_goals(beliefs)
    plans = generate_candidate_plans(evidence.candidate_actions, evidence.selected_action_id, goals)
    intention = select_intention(evidence, beliefs, plans)
    trace = DecisionTrace(
        evidence_considered=evidence.items,
        beliefs=beliefs,
        goals=goals,
        candidate_plans=plans,
        selected_intention=intention,
        missing_evidence=evidence.missing_evidence,
        limitations=[
            "The agent consumes a single completed analysis run and has no cross-run memory.",
            "The agent does not establish causality, remediation efficacy, or real-world operational outcomes.",
        ],
    )
    state = AgentState(dataset_metadata=dataset_metadata or {}, decision_trace=trace)
    return build_recommendation_payload(state, events)

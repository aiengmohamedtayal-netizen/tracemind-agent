from __future__ import annotations

from typing import Any

from app.services.agent.evidence import EvidenceBuildResult
from app.services.agent.models import (
    Belief,
    BeliefStatus,
    CandidatePlan,
    IntentionStatus,
    InvestigationGoal,
    SelectedIntention,
)


_ACTION_OBJECTIVES = {
    "ACT-SERVICE": "Inspect the anomalous service cohort without modifying monitored systems.",
    "ACT-TIMELINE": "Inspect correlated event time windows without modifying monitored systems.",
    "ACT-RESOURCE": "Compare resource telemetry against nominal records without modifying monitored systems.",
    "ACT-ERROR": "Examine observed error and HTTP-status patterns without modifying monitored systems.",
    "ACT-LATENCY": "Inspect the observed latency distribution without modifying monitored systems.",
}


def generate_goals(beliefs: list[Belief]) -> list[InvestigationGoal]:
    goals: list[InvestigationGoal] = []
    anomaly_belief = next((belief for belief in beliefs if belief.belief_id == "belief-anomalies-observed"), None)
    if anomaly_belief:
        goals.append(InvestigationGoal(
            goal_id="goal-review-anomalous-telemetry",
            objective="Review the statistical anomalies and their observed telemetry differences.",
            source_belief_ids=[anomaly_belief.belief_id],
            supporting_evidence_ids=anomaly_belief.supporting_evidence_ids,
        ))
    for belief in beliefs:
        if belief.status is not BeliefStatus.SUPPORTED:
            continue
        if belief.belief_id.startswith("belief-service-"):
            goals.append(InvestigationGoal(
                goal_id=f"goal-{belief.belief_id.removeprefix('belief-')}",
                objective=f"Review the service cohort described by: {belief.statement}",
                source_belief_ids=[belief.belief_id],
                supporting_evidence_ids=belief.supporting_evidence_ids,
            ))
        if belief.belief_id.startswith("belief-driver-"):
            goals.append(InvestigationGoal(
                goal_id=f"goal-{belief.belief_id.removeprefix('belief-')}",
                objective=f"Investigate the observed deviation pattern described by: {belief.statement}",
                source_belief_ids=[belief.belief_id],
                supporting_evidence_ids=belief.supporting_evidence_ids,
            ))
    return goals


def generate_candidate_plans(
    candidate_actions: list[dict[str, Any]],
    selected_action_id: str | None,
    goals: list[InvestigationGoal],
) -> list[CandidatePlan]:
    plans: list[CandidatePlan] = []
    goal_ids = [goal.goal_id for goal in goals]
    goal_evidence_ids = sorted({evidence_id for goal in goals for evidence_id in goal.supporting_evidence_ids})
    for action in candidate_actions:
        action_id = str(action.get("action_id", ""))
        if not action_id:
            continue
        selected = action_id == selected_action_id
        objective = _ACTION_OBJECTIVES.get(action_id, "Review the observed telemetry using the supplied read-only candidate action.")
        fitness = action.get("composite_fitness")
        rationale = (
            f"PSO selected this action with reported fitness {fitness}."
            if selected
            else f"PSO evaluated this action with reported fitness {fitness}, but did not select it."
        )
        plans.append(CandidatePlan(
            plan_id=f"plan-{action_id.lower()}",
            objective=objective,
            action_id=action_id,
            action_title=str(action.get("title", action_id)),
            candidate_action=action,
            goal_ids=goal_ids,
            supporting_evidence_ids=[f"evidence-pso-candidate-{action_id}", *goal_evidence_ids],
            estimated_cost_usd=_as_float(action.get("estimated_cost_usd")),
            sla_risk_score=_as_float(action.get("sla_risk_score")),
            is_pso_selected=selected,
            selection_rationale=rationale,
            rejection_reason=None if selected else "Not selected by the existing PSO output.",
        ))
    return plans


def select_intention(
    evidence: EvidenceBuildResult,
    beliefs: list[Belief],
    plans: list[CandidatePlan],
) -> SelectedIntention:
    limitations = [
        "Isolation Forest findings indicate statistical rarity, not a confirmed root cause or malicious intent.",
        "This is an advisory, read-only investigation recommendation; no action is executed by TraceMind.",
    ]
    if evidence.missing_evidence or evidence.contradictions:
        return SelectedIntention(
            status=IntentionStatus.NO_RECOMMENDATION,
            selection_reason="No investigation recommendation was generated because required evidence is missing or inconsistent.",
            constraints_considered=["Required upstream evidence must be complete and internally consistent."],
            uncertainty_and_limitations=[*evidence.missing_evidence, *evidence.contradictions, *limitations],
        )
    if any(belief.belief_id == "belief-no-anomalies-observed" for belief in beliefs):
        return SelectedIntention(
            status=IntentionStatus.NO_RECOMMENDATION,
            selection_reason="No investigation recommendation was generated because no evaluated event was classified as statistically unusual.",
            constraints_considered=["Recommendations require observed anomaly evidence.", "PSO output is not overridden or executed."],
            uncertainty_and_limitations=limitations,
        )
    selected_plan = next((plan for plan in plans if plan.is_pso_selected), None)
    if not selected_plan:
        return SelectedIntention(
            status=IntentionStatus.NO_RECOMMENDATION,
            selection_reason="No investigation recommendation was generated because the PSO-selected action has no valid candidate plan.",
            constraints_considered=["The agent can select only a plan backed by the supplied PSO selection."],
            uncertainty_and_limitations=limitations,
        )
    return SelectedIntention(
        status=IntentionStatus.SELECTED,
        plan_id=selected_plan.plan_id,
        action_id=selected_plan.action_id,
        selection_reason="The plan directly corresponds to the action selected by the existing PSO output and is grounded in observed anomaly evidence.",
        supporting_evidence_ids=selected_plan.supporting_evidence_ids,
        constraints_considered=[
            "The agent preserves the existing PSO selected action and does not independently rescore candidates.",
            "Candidate action catalog metadata and existing PSO solver constraints remain authoritative.",
            "The recommendation is limited to read-only investigation activity.",
        ],
        uncertainty_and_limitations=limitations,
    )


def _as_float(value: Any) -> float | None:
    return float(value) if isinstance(value, (int, float)) else None

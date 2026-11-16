from __future__ import annotations

from collections import Counter
from typing import Any

from app.services.agent.models import AgentState, IntentionStatus


def build_recommendation_payload(
    state: AgentState,
    events: list[dict[str, Any]] | None,
) -> dict[str, Any]:
    """Build compatibility fields alongside the structured, evidence-bound trace."""
    trace = state.decision_trace
    anomalies = [event for event in events or [] if event.get("is_anomaly") is True]
    affected_services = sorted({str(event["service"]) for event in anomalies if event.get("service") is not None})
    selected = trace.selected_intention
    evidence_coverage = _evidence_coverage(trace.missing_evidence, trace.evidence_considered)

    if selected.status is IntentionStatus.SELECTED:
        selected_plan = next(plan for plan in trace.candidate_plans if plan.plan_id == selected.plan_id)
        action = selected_plan.candidate_action
        driver = _dominant_driver(anomalies)
        return {
            "agent_version": "2.0.0-deterministic-state-machine",
            "summary_headline": f"{len(anomalies)} statistically unusual event(s) identified; investigate {selected_plan.action_title.lower()}.",
            "root_cause_analysis": (
                f"Observed: {len(anomalies)} evaluated record(s) were classified as statistically unusual. "
                f"The most frequent recorded deviation driver is {driver}. "
                "These are investigation leads, not confirmed root causes."
            ),
            "why_action_selected": (
                f"PSO selected {selected_plan.action_id}; the agent selected the directly corresponding read-only plan "
                f"without rescore or override. Reported PSO fitness: {action.get('composite_fitness')}."
            ),
            # Retained for old clients. This is evidence completeness, not a certainty or threat probability.
            "confidence_score_pct": evidence_coverage,
            "evidence_coverage_pct": evidence_coverage,
            "risk_assessment": "Advisory read-only investigation only. No system, data, network, or external action is executed.",
            "affected_services": affected_services,
            "execution_steps": _advisory_steps(selected_plan.action_title, affected_services),
            "guardrails_checked": _guardrails(trace, selected=True),
            "decision_trace": trace.model_dump(mode="json"),
        }

    return {
        "agent_version": "2.0.0-deterministic-state-machine",
        "summary_headline": "No investigation action recommended from the available evidence.",
        "root_cause_analysis": "No root-cause conclusion was generated. " + selected.selection_reason,
        "why_action_selected": "No PSO-backed investigation plan was selected by the agent.",
        "confidence_score_pct": evidence_coverage,
        "evidence_coverage_pct": evidence_coverage,
        "risk_assessment": "No action is recommended or executed. TraceMind remains advisory and read-only.",
        "affected_services": affected_services,
        "execution_steps": [],
        "guardrails_checked": _guardrails(trace, selected=False),
        "decision_trace": trace.model_dump(mode="json"),
    }


def _dominant_driver(anomalies: list[dict[str, Any]]) -> str:
    drivers = Counter(str(event.get("primary_driver", "unknown")) for event in anomalies)
    return drivers.most_common(1)[0][0] if drivers else "no statistically unusual feature"


def _evidence_coverage(missing_evidence: list[str], evidence: list[Any]) -> float:
    # Completeness over four required upstream groups: events, detector, candidates, and selection.
    groups = ("event", "Isolation Forest", "candidate", "selected action")
    missing_groups = sum(any(group.lower() in item.lower() for item in missing_evidence) for group in groups)
    return round(max(0.0, (len(groups) - missing_groups) / len(groups) * 100), 1) if evidence else 0.0


def _advisory_steps(action_title: str, services: list[str]) -> list[dict[str, Any]]:
    scope = ", ".join(services) if services else "the evaluated dataset"
    return [
        {
            "step_number": 1,
            "command_or_action": f"Review the read-only evidence for {action_title.lower()} across {scope}.",
            "verification_check": "Confirm every reviewed record belongs to this persisted analysis run.",
            "estimated_duration": "5–10 minutes",
        },
        {
            "step_number": 2,
            "command_or_action": "Compare statistically unusual telemetry with nominal records from the same dataset.",
            "verification_check": "Record observations without asserting causality or malicious intent.",
            "estimated_duration": "10–15 minutes",
        },
        {
            "step_number": 3,
            "command_or_action": "Document follow-up hypotheses for authorized human operators.",
            "verification_check": "Confirm no external command, scan, remediation, or system change was executed.",
            "estimated_duration": "5 minutes",
        },
    ]


def _guardrails(trace: Any, *, selected: bool) -> list[dict[str, Any]]:
    consistency_ok = not trace.missing_evidence and not any(
        belief.status == "contradicted" for belief in trace.beliefs
    )
    return [
        {"rule": "Read-only advisory boundary", "passed": True, "detail": "The agent emits investigation guidance only and has no external execution path."},
        {"rule": "Evidence traceability", "passed": consistency_ok, "detail": "Every generated plan is linked to recorded upstream evidence; incomplete evidence blocks recommendation."},
        {"rule": "PSO alignment", "passed": selected and consistency_ok, "detail": "A recommendation is selected only when it maps directly to the supplied PSO selection."},
        {"rule": "No root-cause guarantee", "passed": True, "detail": "Statistical findings are explicitly presented as investigation leads, not confirmed causes."},
    ]

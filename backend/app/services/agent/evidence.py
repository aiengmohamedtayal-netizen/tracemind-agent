from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.services.agent.models import EvidenceItem, EvidenceSource


@dataclass(frozen=True)
class EvidenceBuildResult:
    items: list[EvidenceItem]
    missing_evidence: list[str]
    contradictions: list[str]
    selected_action_id: str | None
    candidate_actions: list[dict[str, Any]]


def build_evidence(
    events: list[dict[str, Any]] | None,
    summary: dict[str, Any] | None,
    optimization: dict[str, Any] | None,
    dataset_metadata: dict[str, Any] | None,
) -> EvidenceBuildResult:
    """Normalize only facts produced by upstream stages; no inference occurs here."""
    items: list[EvidenceItem] = []
    missing: list[str] = []
    contradictions: list[str] = []
    normalized_events = events or []
    metadata = dataset_metadata or {}

    if metadata:
        items.append(EvidenceItem(
            evidence_id="evidence-dataset-metadata",
            source=EvidenceSource.DATASET_METADATA,
            statement="Analysis input metadata was supplied by the orchestrator.",
            observed_values={key: metadata[key] for key in sorted(metadata)},
        ))

    if not normalized_events:
        missing.append("No evaluated events were supplied by Isolation Forest.")
    if not summary:
        missing.append("No Isolation Forest summary was supplied.")
    else:
        required_summary_fields = ("total_events", "anomalous_events_count", "anomaly_rate_pct")
        absent = [field for field in required_summary_fields if field not in summary]
        if absent:
            missing.append(f"Isolation Forest summary is missing required field(s): {', '.join(absent)}.")
        else:
            items.append(EvidenceItem(
                evidence_id="evidence-isolation-forest-summary",
                source=EvidenceSource.ISOLATION_FOREST,
                statement="Isolation Forest produced an analysis summary.",
                observed_values={
                    "total_events": summary["total_events"],
                    "anomalous_events_count": summary["anomalous_events_count"],
                    "anomaly_rate_pct": summary["anomaly_rate_pct"],
                },
            ))

    anomalous_events: list[dict[str, Any]] = []
    for event in normalized_events:
        required_event_fields = ("event_id", "service", "is_anomaly", "anomaly_score", "primary_driver")
        absent = [field for field in required_event_fields if field not in event]
        if absent:
            missing.append(f"Evaluated event is missing required field(s): {', '.join(absent)}.")
            continue
        if event["is_anomaly"]:
            anomalous_events.append(event)
            event_id = str(event["event_id"])
            items.append(EvidenceItem(
                evidence_id=f"evidence-event-{event_id}",
                source=EvidenceSource.EVALUATED_EVENT,
                statement=f"Event {event_id} was classified as statistically unusual by Isolation Forest.",
                references=[event_id],
                observed_values={
                    "service": event["service"],
                    "anomaly_score": event["anomaly_score"],
                    "primary_driver": event["primary_driver"],
                    "severity": event.get("severity"),
                },
            ))

    if normalized_events and not anomalous_events:
        items.append(EvidenceItem(
            evidence_id="evidence-no-anomalies",
            source=EvidenceSource.EVALUATED_EVENT,
            statement="No supplied evaluated event was classified as statistically unusual.",
            references=[str(event.get("event_id")) for event in normalized_events if event.get("event_id") is not None],
            observed_values={"evaluated_event_count": len(normalized_events)},
        ))

    selected_action_id, candidate_actions = _add_pso_evidence(items, optimization, missing, contradictions)
    return EvidenceBuildResult(
        items=items,
        missing_evidence=_deduplicate(missing),
        contradictions=_deduplicate(contradictions),
        selected_action_id=selected_action_id,
        candidate_actions=candidate_actions,
    )


def _add_pso_evidence(
    items: list[EvidenceItem],
    optimization: dict[str, Any] | None,
    missing: list[str],
    contradictions: list[str],
) -> tuple[str | None, list[dict[str, Any]]]:
    if not optimization:
        missing.append("No PSO optimization output was supplied.")
        return None, []
    selected = optimization.get("selected_action")
    candidates = optimization.get("candidate_actions")
    if not isinstance(selected, dict) or not selected.get("action_id"):
        missing.append("PSO output has no selected action.")
        return None, candidates if isinstance(candidates, list) else []
    if not isinstance(candidates, list) or not candidates:
        missing.append("PSO output has no candidate actions.")
        return str(selected["action_id"]), []

    selected_id = str(selected["action_id"])
    candidate_actions = [candidate for candidate in candidates if isinstance(candidate, dict)]
    candidate_ids = {str(candidate.get("action_id")) for candidate in candidate_actions if candidate.get("action_id")}
    if selected_id not in candidate_ids:
        contradictions.append(f"PSO selected action '{selected_id}' is absent from its candidate actions.")
    selected_candidates = [candidate for candidate in candidate_actions if candidate.get("is_selected") is True]
    if len(selected_candidates) != 1:
        contradictions.append("PSO candidate actions must contain exactly one action marked is_selected.")
    elif str(selected_candidates[0].get("action_id")) != selected_id:
        contradictions.append("PSO selected_action does not match the candidate action marked is_selected.")
    else:
        selected_candidate = selected_candidates[0]
        for field in ("composite_fitness", "estimated_cost_usd", "sla_risk_score", "execution_latency_sec"):
            if selected.get(field) != selected_candidate.get(field):
                contradictions.append(f"PSO selected_action {field} does not match its selected candidate metadata.")
    items.append(EvidenceItem(
        evidence_id="evidence-pso-selection",
        source=EvidenceSource.PSO_OPTIMIZATION,
        statement=f"PSO selected read-only action {selected_id}.",
        references=[selected_id],
        observed_values={
            "action_id": selected_id,
            "composite_fitness": selected.get("composite_fitness"),
            "best_fitness_score": optimization.get("best_fitness_score"),
        },
    ))
    for candidate in candidate_actions:
        action_id = candidate.get("action_id")
        if not action_id:
            missing.append("A PSO candidate action has no action_id.")
            continue
        items.append(EvidenceItem(
            evidence_id=f"evidence-pso-candidate-{action_id}",
            source=EvidenceSource.PSO_OPTIMIZATION,
            statement=f"PSO evaluated candidate action {action_id}.",
            references=[str(action_id)],
            observed_values={
                "action_id": action_id,
                "composite_fitness": candidate.get("composite_fitness"),
                "is_selected": candidate.get("is_selected"),
                "estimated_cost_usd": candidate.get("estimated_cost_usd"),
                "sla_risk_score": candidate.get("sla_risk_score"),
            },
        ))
    return selected_id, candidate_actions


def _deduplicate(values: list[str]) -> list[str]:
    return list(dict.fromkeys(values))

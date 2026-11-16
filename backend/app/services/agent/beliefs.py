from __future__ import annotations

from collections import Counter
from typing import Any

from app.services.agent.evidence import EvidenceBuildResult
from app.services.agent.models import Belief, BeliefStatus


def build_beliefs(events: list[dict[str, Any]] | None, evidence: EvidenceBuildResult) -> list[Belief]:
    """Derive interpretations only where the input contains supporting evidence."""
    beliefs: list[Belief] = []
    normalized_events = events or []
    anomalies = [event for event in normalized_events if event.get("is_anomaly") is True]
    summary_evidence = _find_evidence_id(evidence, "evidence-isolation-forest-summary")

    if summary_evidence:
        if anomalies:
            beliefs.append(Belief(
                belief_id="belief-anomalies-observed",
                statement=f"{len(anomalies)} event(s) were classified as statistically unusual.",
                status=BeliefStatus.SUPPORTED,
                supporting_evidence_ids=[summary_evidence, *[f"evidence-event-{event['event_id']}" for event in anomalies]],
                explanation="Isolation Forest classifications identify statistical rarity in this run; they do not establish cause or malicious intent.",
            ))
            beliefs.extend(_service_beliefs(anomalies))
            beliefs.extend(_driver_beliefs(anomalies))
        else:
            beliefs.append(Belief(
                belief_id="belief-no-anomalies-observed",
                statement="No evaluated event was classified as statistically unusual in this run.",
                status=BeliefStatus.SUPPORTED,
                supporting_evidence_ids=[summary_evidence, "evidence-no-anomalies"],
                explanation="This describes only this dataset and configuration; it is not a guarantee of normal system behaviour.",
            ))

    if evidence.selected_action_id:
        beliefs.append(Belief(
            belief_id="belief-pso-selection-observed",
            statement=f"PSO selected {evidence.selected_action_id} from the supplied candidate actions.",
            status=BeliefStatus.SUPPORTED,
            supporting_evidence_ids=["evidence-pso-selection"],
            explanation="The agent records PSO's selection and does not independently optimize or override it.",
        ))

    if evidence.missing_evidence:
        beliefs.append(Belief(
            belief_id="belief-input-incomplete",
            statement="The investigation input is incomplete.",
            status=BeliefStatus.UNCERTAIN,
            supporting_evidence_ids=[],
            explanation="; ".join(evidence.missing_evidence),
        ))
    if evidence.contradictions:
        beliefs.append(Belief(
            belief_id="belief-input-contradicted",
            statement="The supplied PSO evidence is internally inconsistent.",
            status=BeliefStatus.CONTRADICTED,
            supporting_evidence_ids=["evidence-pso-selection"],
            explanation="; ".join(evidence.contradictions),
        ))
    return beliefs


def _service_beliefs(anomalies: list[dict[str, Any]]) -> list[Belief]:
    services = Counter(str(event["service"]) for event in anomalies)
    beliefs: list[Belief] = []
    for service, count in sorted(services.items()):
        evidence_ids = [f"evidence-event-{event['event_id']}" for event in anomalies if str(event["service"]) == service]
        beliefs.append(Belief(
            belief_id=f"belief-service-{_slug(service)}",
            statement=f"Service {service} has {count} statistically unusual event(s) in this run.",
            status=BeliefStatus.SUPPORTED,
            supporting_evidence_ids=evidence_ids,
            explanation="The service grouping is based on evaluated event records, not a diagnosis of the service.",
        ))
    return beliefs


def _driver_beliefs(anomalies: list[dict[str, Any]]) -> list[Belief]:
    drivers = Counter(str(event["primary_driver"]) for event in anomalies)
    beliefs: list[Belief] = []
    for driver, count in sorted(drivers.items()):
        evidence_ids = [f"evidence-event-{event['event_id']}" for event in anomalies if str(event["primary_driver"]) == driver]
        beliefs.append(Belief(
            belief_id=f"belief-driver-{_slug(driver)}",
            statement=f"{driver} is the primary deviation driver for {count} statistically unusual event(s).",
            status=BeliefStatus.SUPPORTED,
            supporting_evidence_ids=evidence_ids,
            explanation="A primary driver is a relative feature contribution within the detector output; it is not a root cause.",
        ))
    return beliefs


def _find_evidence_id(evidence: EvidenceBuildResult, evidence_id: str) -> str | None:
    return evidence_id if any(item.evidence_id == evidence_id for item in evidence.items) else None


def _slug(value: str) -> str:
    return "".join(character.lower() if character.isalnum() else "-" for character in value).strip("-") or "unknown"

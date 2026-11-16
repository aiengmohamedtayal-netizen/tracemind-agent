from __future__ import annotations

from enum import StrEnum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class EvidenceSource(StrEnum):
    DATASET_METADATA = "dataset_metadata"
    ISOLATION_FOREST = "isolation_forest"
    EVALUATED_EVENT = "evaluated_event"
    PSO_OPTIMIZATION = "pso_optimization"


class BeliefStatus(StrEnum):
    SUPPORTED = "supported"
    UNCERTAIN = "uncertain"
    CONTRADICTED = "contradicted"


class IntentionStatus(StrEnum):
    SELECTED = "selected"
    NO_RECOMMENDATION = "no_recommendation"


class AgentModel(BaseModel):
    """Strict, JSON-safe contract used by one complete agent decision cycle."""

    model_config = ConfigDict(extra="forbid", frozen=True)


class EvidenceItem(AgentModel):
    evidence_id: str
    source: EvidenceSource
    statement: str
    references: list[str] = Field(default_factory=list)
    observed_values: dict[str, Any] = Field(default_factory=dict)


class Belief(AgentModel):
    belief_id: str
    statement: str
    status: BeliefStatus
    supporting_evidence_ids: list[str] = Field(default_factory=list)
    explanation: str


class InvestigationGoal(AgentModel):
    goal_id: str
    objective: str
    source_belief_ids: list[str] = Field(default_factory=list)
    supporting_evidence_ids: list[str] = Field(default_factory=list)


class CandidatePlan(AgentModel):
    plan_id: str
    objective: str
    action_id: str
    action_title: str
    candidate_action: dict[str, Any]
    goal_ids: list[str] = Field(default_factory=list)
    supporting_evidence_ids: list[str] = Field(default_factory=list)
    estimated_cost_usd: float | None = None
    sla_risk_score: float | None = None
    is_pso_selected: bool
    selection_rationale: str
    rejection_reason: str | None = None
    advisory_only: bool = True


class SelectedIntention(AgentModel):
    status: IntentionStatus
    plan_id: str | None = None
    action_id: str | None = None
    selection_reason: str
    supporting_evidence_ids: list[str] = Field(default_factory=list)
    constraints_considered: list[str] = Field(default_factory=list)
    uncertainty_and_limitations: list[str] = Field(default_factory=list)
    advisory_only: bool = True


class DecisionTrace(AgentModel):
    trace_version: str = "1.0"
    evidence_considered: list[EvidenceItem] = Field(default_factory=list)
    beliefs: list[Belief] = Field(default_factory=list)
    goals: list[InvestigationGoal] = Field(default_factory=list)
    candidate_plans: list[CandidatePlan] = Field(default_factory=list)
    selected_intention: SelectedIntention
    missing_evidence: list[str] = Field(default_factory=list)
    limitations: list[str] = Field(default_factory=list)


class AgentState(AgentModel):
    dataset_metadata: dict[str, Any] = Field(default_factory=dict)
    decision_trace: DecisionTrace

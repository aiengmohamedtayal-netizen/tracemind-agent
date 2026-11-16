# TraceMind Intelligent Investigation Agent Architecture

## Status

Implemented design for the deterministic investigation agent. This document is the
source of truth for the agent's boundary and its externally persisted result shape.

## Context and constraints

TraceMind already validates telemetry, runs Isolation Forest, creates read-only
candidate actions, and uses binary PSO to choose one action. The previous
`build_recommendation` function formatted those outputs into a stateless response.

The agent must make the reasoning between model output and recommendation explicit
without changing Isolation Forest, PSO, their inputs, their seeds, or their fitness
function. It must remain deterministic, operate only on a single completed analysis
run, and never execute or authorize external actions.

## Decision

Implement a lightweight, deterministic, BDI-inspired state machine within the
existing backend modular monolith:

```text
evaluated events + Isolation Forest summary + PSO result + dataset metadata
  -> validated evidence
  -> supported / uncertain / contradicted beliefs
  -> evidence-grounded investigation goals
  -> candidate read-only investigation plans
  -> PSO-aligned selected intention
  -> explanation, legacy-compatible recommendation, and decision trace
```

The agent is a pure computation: it has no database session, network client,
external tool, mutable cross-run memory, LLM, or side effect. The orchestrator calls
it once after PSO and persists its JSON-safe result as part of the existing analysis
run transaction.

## Domain model

| Model | Meaning | Required traceability |
|---|---|---|
| `EvidenceItem` | Observed upstream fact, including the source and referenced event/action IDs. | `source`, stable `evidence_id`, references, observed payload. |
| `Belief` | An interpretation of evidence, never a claimed root cause. | Supporting evidence IDs, status (`supported`, `uncertain`, `contradicted`), explanation. |
| `InvestigationGoal` | A read-only objective derived from one or more beliefs. | Source belief IDs and evidence IDs. |
| `CandidatePlan` | A possible investigation plan built from an actual PSO candidate action. | Action ID, goal IDs, evidence IDs, catalog cost/risk metadata. |
| `SelectedIntention` | The recommendation selected from a plan. | Selected action/plan, PSO alignment, constraints, uncertainty. |
| `DecisionTrace` | Complete, serializable account of this decision cycle. | All previous model objects plus missing evidence and limitations. |
| `AgentState` | Immutable aggregate passed through the decision cycle. | Input metadata and all derived state. |

Observed facts and interpretations remain separate. In particular, an Isolation
Forest score is recorded only as relative run evidence and never as a maliciousness
probability. Confidence is omitted instead of fabricated.

## Decision cycle and rules

1. Validate required Isolation Forest summary, evaluated-event fields, PSO selected
   action, and its exact agreement with exactly one `is_selected` candidate action
   (ID plus fitness/cost/risk/latency metadata).
2. Build evidence from event classifications/drivers, affected services, detector
   summary, PSO candidate actions, the PSO selection, and input metadata.
3. Create beliefs only when their supporting evidence exists. Contradictions such as
   a selected action absent from the PSO candidates are represented and stop plan
   selection.
4. Generate goals for anomalous service cohorts and observed error, latency, or
   resource deviations. A normal dataset produces an explicit no-anomaly goal rather
   than a remediation recommendation.
5. Generate candidate plans only from actual PSO candidates and mark all as advisory,
   read-only investigations.
6. Select the plan corresponding to `selected_action`; this agent does not rescore,
   override, or execute PSO output. Its decision rule is documented alignment, not
   a second optimizer.
7. Produce the explanation and trace. If PSO evidence is missing, inconsistent, or
   no valid plan is available, return a safe no-recommendation result with the
   limitation instead of inventing a plan.

## Integration and API compatibility

`AnalysisOrchestrator.analyze` will keep its sequence unchanged:

```text
ingestion -> Isolation Forest -> action catalog -> PSO -> investigation agent
-> result persistence -> FastAPI response
```

`agent_recommendation` preserves all existing keys used by the React UI:
`agent_version`, `summary_headline`, `root_cause_analysis`,
`why_action_selected`, `confidence_score_pct`, `risk_assessment`,
`affected_services`, `execution_steps`, and `guardrails_checked`.

`confidence_score_pct` remains only for older clients and now means deterministic
**evidence coverage**, not probability or decision certainty; the explicit
`evidence_coverage_pct` field is authoritative for new consumers. A safe
no-recommendation payload still includes every legacy key, a numeric coverage value,
an empty `execution_steps` list, and the full trace explaining why selection was
blocked. New state and trace fields are additive. Existing clients can ignore them. The
database schema remains unchanged because complete run reports are already persisted
as JSON; event rows are unchanged. No API route, request field, model configuration,
algorithm configuration, or database migration is required.

## Module boundaries

The implementation uses small modules under `backend/app/services/agent/`:

- `models.py`: Pydantic domain contracts and immutable state.
- `evidence.py`: input validation and evidence normalization.
- `beliefs.py`: supported, uncertain, and contradicted beliefs.
- `planning.py`: goals, plans, and PSO-aligned selection.
- `explanation.py`: advisory explanation, legacy fields, and complete trace.
- `intelligent_agent.py`: stable public facade, `build_recommendation`.

The facade remains the only dependency imported by the orchestrator. This keeps the
existing integration point stable while preventing a framework-sized abstraction.

## Safety boundaries

- All catalog actions must be read-only investigation actions.
- The output is an advisory recommendation, never execution permission.
- The agent does not call subprocesses, tools, networks, operating systems, or
  monitored systems.
- It does not infer malicious intent or claim a confirmed root cause.
- Missing or inconsistent evidence yields a no-recommendation result.

## Measurable acceptance criteria

| Criterion | Verification |
|---|---|
| Explicit models and serializable state exist. | Domain-model unit tests and type validation. |
| Every belief, goal, plan, and intention references upstream evidence. | Trace completeness tests. |
| PSO cannot be silently overridden. | Selected intention test checks selected action and candidate membership. |
| Missing/inconsistent inputs fail safely. | Tests for empty events, missing PSO, unsupported selection, and conflicting candidates. |
| Output is deterministic. | Equal inputs yield byte-equivalent normalized decision traces. |
| Existing endpoint/history behavior remains valid. | Existing lifecycle tests plus agent integration assertions. |
| Existing UI contract remains usable. | TypeScript type check and production build. |
| No external action is possible. | Implementation review and guardrail tests; no external-execution code path exists. |

## Known limitations

The agent has no cross-run state, causal inference, measured remediation efficacy,
or real operational ground truth. Its plan selection deliberately follows the current
single-action PSO contract and cannot establish that an anomaly has a security or
operational cause.

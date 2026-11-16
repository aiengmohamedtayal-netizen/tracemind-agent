# ADR-001: Use a deterministic, PSO-aligned investigation state machine

## Status

Accepted

## Context

TraceMind needs explainable investigation planning, while retaining its existing
single-process FastAPI architecture, deterministic algorithms, and advisory safety
boundary. The current formatter makes its reasoning hard to inspect.

## Decision

Adopt a small BDI-inspired, in-process state machine with explicit evidence,
beliefs, goals, plans, intention, and decision trace. It will consume rather than
replace Isolation Forest and PSO outputs, and it will select only the plan matching
PSO's selected read-only action.

## Rationale

This supplies auditability and focused test seams without an LLM, agent framework,
workflow engine, new persistence table, external service, or a second optimizer.

## Trade-offs

- The agent cannot independently improve PSO selection; this prevents silent model
  disagreement and preserves the existing API semantics.
- It has no cross-run memory; each persisted analysis is self-contained.
- Typed, additive JSON increases response size modestly, but makes persisted reports
  inspectable without a schema migration.

## Revisit trigger

Reconsider only if TraceMind needs multi-step, asynchronous investigations, durable
workflow state, or authorized operator approvals. Those needs require an explicit
state persistence and security design, not an incremental extension of this agent.

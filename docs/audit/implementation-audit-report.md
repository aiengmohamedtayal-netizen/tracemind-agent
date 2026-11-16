# TraceMind Implementation Audit Report

**Scope:** source-code audit only. This report evaluates function bodies and call sites as present in the repository. It does not infer implementation from endpoint names, health output, comments, or prior summaries.

## Executive summary

### Resumption verification (2026-11-08)

The correct repository was verified as accessible at `D:\LEVEL3\agents\tracemind-agent` and is the active Git worktree used for this resumed audit. The existing report was inspected and retained; its source-based findings were spot-checked against the current implementation without modifying application source code. Key verified symbols include `detect_anomalies` in `backend/app/services/anomaly_detection.py`, `optimize_actions` in `backend/app/services/pso_optimizer.py`, `build_recommendation` in `backend/app/services/intelligent_agent.py`, and the sequential calls in `AnalysisOrchestrator.analyze` in `backend/app/services/analysis_orchestrator.py`.

Read-only verification command: `python -m pytest -q` from `backend/` completed with **13 passed** and **2 deprecation warnings**. No validation configuration, fixtures, algorithm, schema, API, or frontend source was changed.

### Investigation-agent update (2026-11-08)

The former recommendation formatter has been replaced by a deterministic,
evidence-bound investigation decision cycle. `build_recommendation` now records
source-labelled evidence, supported/uncertain/contradicted beliefs, derived goals,
PSO candidate plans, a PSO-aligned selected intention, and a persisted decision
trace. It remains a pure in-process function and does not execute external actions.
The existing Isolation Forest and PSO implementations, their configuration, and
their fitness calculation were not changed. New tests verify evidence references,
safe handling for missing/contradictory PSO output, PSO metadata agreement, normal
telemetry behaviour, and reproducible traces. The legacy recommendation keys remain
in the API result; `confidence_score_pct` is now compatibility evidence coverage,
not a certainty claim. See [Agent Architecture](../architecture/agent-architecture.md).

TraceMind has a working, synchronous analysis pipeline: validated CSV/JSON content is passed to a real scikit-learn `IsolationForest`, then to data-derived action generation, then a binary PSO solver, then a deterministic rule-based recommendation builder. The completed report and evaluated events are persisted in SQLite in one transaction and returned through FastAPI.

The Isolation Forest and PSO implementations are genuine implementations rather than mocks. The Intelligent Agent is now an explicit deterministic decision cycle behind the stable `build_recommendation` facade. It consumes actual detector and optimizer output, creates serializable per-run state, and preserves the PSO choice rather than independently optimizing it. It intentionally has no LLM, cross-run memory, autonomous execution, or workflow retry policy.

## Evidence-based implementation matrix

| Component | Status | Actual implementation | Evidence (file/function) | Missing work |
|---|---|---|---|---|
| Frontend | FULLY IMPLEMENTED | React UI renders active runs, handles submission, history, deletion after response, and technical investigation views. | `src/App.tsx` `loadWorkspaceData`, `handleRunAnalysis`, `handleDeleteRun`; `src/components/*` | No browser E2E automation is present. |
| Backend API | FULLY IMPLEMENTED | FastAPI health, analyse, history, event, and delete routes are registered under `/api`. | `backend/app/main.py`; `backend/app/api/routes.py` | No authentication, rate limiting, or API versioning. |
| Data ingestion | FULLY IMPLEMENTED | CSV/JSON parsing, required-field checks, normalization, numeric/range checks, duplicate-ID handling, and aggregated invalid-record reporting. | `backend/app/services/ingestion.py` `parse_event_content`, `_parse_csv`, `_parse_json`, `_validate_records` | Partial valid-row ingestion is not implemented; any invalid record rejects the request. |
| SQLite persistence | FULLY IMPLEMENTED | Run/result JSON and one event row per evaluated record persist transactionally; foreign key cascade is enabled. | `backend/app/db/models.py`; `repository.py` `save_completed_run`, `delete_run`; `database.py` `enable_sqlite_foreign_keys` | No schema migration/versioning tool. |
| Isolation Forest | FULLY IMPLEMENTED | Uses `StandardScaler`, scikit-learn `IsolationForest.fit`, `predict`, and decision-function-derived relative scores. | `backend/app/services/anomaly_detection.py` `detect_anomalies` | No user-configurable `anomaly_threshold`; displayed threshold is descriptive, not classifier input. |
| Binary/Discrete PSO | FULLY IMPLEMENTED | Uses binary vectors, velocities, sigmoid conversion, personal/global bests, finite iterations, and constraints. | `backend/app/services/pso_optimizer.py` `optimize_actions`, `_enforce_constraints`, `_position_fitness` | No early-stopping criterion; returned UI selection is one action although internal positions may retain two. |
| Intelligent Agent | FULLY IMPLEMENTED (bounded scope) | Deterministic state machine derives traceable evidence, beliefs, goals, candidate plans, and a PSO-aligned advisory intention. | `backend/app/services/agent/*`; `intelligent_agent.py` `build_recommendation`; call in `analysis_orchestrator.py` | No cross-run memory, causal inference, LLM, autonomous external execution, or independent optimizer. |
| Agent orchestration | FULLY IMPLEMENTED (single-run scope) | Orchestrator passes dataset metadata and actual detector/PSO output into a completed, persisted agent decision trace. | `backend/app/services/analysis_orchestrator.py` `AnalysisOrchestrator.analyze` | No cross-run lifecycle records such as RECEIVED/VALIDATED/FAILED and no persisted failed run state. |
| End-to-end integration | FULLY IMPLEMENTED | API test covers analysis, history, events, and deletion; frontend routes through Vite `/api`. | `backend/tests/test_api_integration.py`; `vite.config.ts`; `src/services/api/*` | Individual run/event client helpers are not used by `App.tsx` during normal history selection. |
| Algorithm validation | PARTIALLY IMPLEMENTED | Reproducible synthetic fixture sweep, edge cases, and PSO exhaustive baseline comparison are generated and tested. | `backend/scripts/run_algorithm_validation.py`; `backend/validation/fixtures.py`; `docs/validation/algorithm-validation-report.md` | No real labelled operational dataset, confidence intervals, or distribution-shift validation. |

## Isolation Forest findings

### Verified implementation

`detect_anomalies` creates a numeric matrix with six features:

1. `latency_ms`
2. `error_rate`
3. `cpu_pct`
4. `memory_mb`
5. `payload_bytes`
6. `status_error_indicator` (`status_code >= 400`)

It standardizes that matrix with `StandardScaler`. For non-constant data it instantiates scikit-learn `IsolationForest` with the caller-provided `n_estimators`, `contamination`, and deterministic `random_state`; `n_jobs=1` is explicit. It calls `fit`, then `predict`. A `-1` prediction is the only source of `is_anomaly`.

`anomaly_score` is a **per-run min/max normalization** of `-decision_function`; it is not a calibrated probability and is not the classification threshold. `threshold_score` is the minimum normalized score among records already predicted anomalous, or `1.0` where there are none. It is an output summary value, not an input to model classification.

For every event, the implementation also computes standardized absolute z-score contributions, chooses the largest as `primary_driver`, derives a display severity, computes score buckets, and compares anomalous versus normal feature means.

### Edge cases and validation evidence

- Fewer than two records raises `ValidationError` before fitting.
- An all-constant matrix avoids fitting; it emits normal classifications with zero scores and depths.
- The validation report uses the same implementation and fixed seeds. Its synthetic contamination sweep found both false negatives at `0.05` and false positives at `0.20`; it does not hide unfavourable outcomes. See [Algorithm Validation Report](../validation/algorithm-validation-report.md).

### Audit conclusion

No hardcoded anomaly labels, mock scores, or placeholder model call were found. Scientific validity beyond the synthetic fixtures remains unverified, as documented in the validation report.

## PSO findings

### Verified implementation

`build_candidate_actions` derives five read-only candidates from detector output and summary statistics. Candidate benefits use observed anomaly rate, service concentration, error/status ratio, CPU, and latency; cost, risk, and latency are catalog metadata.

`optimize_actions` uses an `N × M` binary position matrix and a matching velocity matrix. It initializes both with a NumPy seeded generator, ensures at least one selected bit per particle, updates velocities using inertia/cognitive/social terms, maps velocity through a sigmoid, samples new binary positions, and updates personal/global bests. It appends global-best fitness, mean swarm fitness, and population diversity for each configured iteration.

The fitness function is implemented as:

```text
0.60 × benefit − 0.18 × min(100, cost × 2) − 0.15 × risk − 0.07 × min(100, latency)
```

`_enforce_constraints` limits positions to at most two actions and an accumulated cost of at most 50. If no action remains it retains the highest ranked selected action. The API response exposes the highest-fitness enabled action as `selected_action` because that is the frontend contract.

### Limitations

- Stopping is exactly `max_iterations`; there is no tolerance-based early stop. `converged_at_iteration` is zero when the initial population already has the best score, not proof of mathematical convergence.
- `_position_fitness` is the maximum fitness of enabled actions, rather than a joint-set benefit calculation. Selecting two actions therefore does not model interaction effects.
- `exhaustive_best_action` is a single-action baseline. It does not exhaustively evaluate all valid two-action subsets.

### Audit conclusion

This is genuine binary/discrete PSO, not merely a heuristic labeled PSO. Its problem formulation is intentionally small and constrained; validation against the existing single-action baseline yielded zero gap for the tracked fixture but does not guarantee global optimality in a richer formulation.

## Intelligent Agent findings

### What exists

The public entry point is `build_recommendation` in `backend/app/services/intelligent_agent.py`. Its internal decision-cycle modules are `backend/app/services/agent/models.py`, `evidence.py`, `beliefs.py`, `planning.py`, and `explanation.py`.

It receives:

- evaluated events produced by Isolation Forest;
- the Isolation Forest summary; and
- the complete PSO payload, including `selected_action`.
- dataset metadata from the orchestrator.

It validates source-labelled evidence, then builds beliefs, goals, one plan per actual PSO candidate action, and a selected intention. It permits selection only if exactly one candidate is marked selected and its ID, fitness, cost, risk, and latency match `selected_action`. Its decision trace is persisted inside `agent_recommendation`. `evidence_coverage_pct` is deterministic upstream-evidence completeness; it is not a probability or confidence claim.

### What it does not do

- It does not override or rescore an action; PSO remains the selector.
- It does not branch, retry, or decide the next pipeline stage.
- It does not retain cross-run memory or a lifecycle across runs.
- It does not call an LLM, external model, tool, system, or network.
- Its read-only review steps are advisory and only generated when a consistent PSO-aligned intention exists.

### Audit conclusion

The agent stage is connected to real data and is not a mock response. It is a **deterministic, evidence-bound investigation state machine** for a single analysis run, rather than an autonomous external actor. The wording explicitly describes findings as investigation leads rather than confirmed root causes.

## Real end-to-end execution path

| Transition | Actual implementation and data |
|---|---|
| Frontend input → HTTP | `src/services/api/analysis.ts` `submitEventLogAnalysis` validates/previews then sends FormData or JSON to `/api/analyze`. |
| HTTP → validated events | `backend/app/api/routes.py` `analyze` → `_read_analysis_request`; then `ingestion.py` `parse_event_content`. |
| Events → detector output | `analysis_orchestrator.py` `analyze` → `detect_anomalies(events, contamination, n_estimators, random_seed)`. |
| Detector output → candidates | Same orchestrator → `build_candidate_actions(detection.events, detection.summary)`. |
| Candidates → optimized action | Same orchestrator → `optimize_actions(...).payload`. |
| Detector + PSO → agent output | Same orchestrator → `build_recommendation(detection.events, detection.summary, pso, dataset_metadata=...)`. |
| Complete result → persistence | Same orchestrator creates `result`, converts NumPy scalars with `_json_safe`, then uses `session.begin()` and `AnalysisRepository.save_completed_run`. |
| Persistence → API response | `analyze` returns the same completed result object to FastAPI. |
| API response → UI | `submitEventLogAnalysis` calls `validateAnalysisRunResponse`; `App.tsx` `handleRunAnalysis` inserts the returned run into React state. |
| Stored results → UI history | `App.tsx` `loadWorkspaceData` calls `fetchAnalysisHistory`; the API returns persisted `result_json` reports. |

No disconnected algorithm module was found in this path.

## Risks and architectural inconsistencies

1. **Client/server validation difference:** client preflight accepts a smaller CSV field set than the server requires. A server 422 is expected for records that pass client preview but omit backend-required fields.
2. **Agent terminology:** the health payload and UI label “IntelligentAgent” can be read as an autonomous agent, while source implements a bounded deterministic per-run decision cycle.
3. **Result duplication:** a complete `AnalysisRun` is stored in `analysis_runs.result_json`, while evaluated events are also stored one-by-one in `event_records.event_json`. This favors simple retrieval but duplicates data.
4. **History payload size:** `GET /api/history` returns complete reports, including all event arrays; no pagination or summary projection exists.
5. **No failed-run persistence:** a failure before transaction completion returns an error without an `analysis_runs` record identifying a failed analysis.
6. **Validation scope:** passing test fixtures and synthetic report metrics establish repeatable software behaviour, not scientific performance on representative operational datasets.

## Recommended priorities

1. Define whether the bounded per-run Intelligent Agent should later be expanded into a durable, approval-gated workflow model. This is the highest semantic boundary for future work.
2. Align client-side preflight required fields with server requirements, or explain the full required schema directly in the upload UI.
3. Add an efficient history-summary endpoint or pagination before storing large numbers of runs/events.
4. Introduce database migrations and a production persistence strategy before multi-user or production deployment.
5. For scientific evaluation, add authorized labelled datasets and report data-split, prevalence, and uncertainty; preserve the current synthetic validation report as implementation validation rather than field performance evidence.

# TraceMind API Reference

Base path: `/api`. The React client normally uses a same-origin `/api` URL; Vite proxies it to the FastAPI process during development.

The API has no authentication or authorization layer in the current implementation. Responses are JSON unless explicitly noted. Unexpected server failures return `{ "detail": "An unexpected server error occurred.", "request_id": "..." }` with HTTP 500.

## `GET /api/health`

Executes `SELECT 1` through SQLAlchemy before reporting database readiness.

**Success — 200**

```json
{
  "status": "ok",
  "database": "sqlite_connected",
  "models": ["IsolationForest", "PSO", "IntelligentAgent"]
}
```

**Failure — 503**: SQLite connection check fails, with `detail: "SQLite database is unavailable."`.

`GET /health` is an undocumented root alias for deployment probes.

## `POST /api/analyze`

Runs the complete ingestion, detection, optimization, agent, and persistence workflow.

### JSON request

```json
{
  "dataset_name": "authorized-events.json",
  "format": "JSON",
  "content": "[{...event...}, {...event...}]",
  "config": {
    "contamination": 0.12,
    "n_estimators": 100,
    "swarm_size": 30,
    "max_iterations": 25,
    "inertia_weight": 0.72,
    "cognitive_coeff": 1.49,
    "social_coeff": 1.49
  }
}
```

### Multipart request

`file` is required. `dataset_name` and `format` (`CSV` or `JSON`) are supplied as form fields; the filename is used as a fallback dataset name. Configuration is supplied as individual form fields with the same seven names shown above.

### Analysis response — 200

```json
{
  "run_id": "run_<uuid-hex>",
  "created_at": "2026-11-08T18:00:00Z",
  "dataset_name": "authorized-events.json",
  "file_format": "JSON",
  "data_source": "live_api",
  "status": "completed",
  "duration_ms": 123,
  "isolation_forest": { "algorithm": "IsolationForest", "...": "summary fields" },
  "pso_optimization": { "algorithm": "ParticleSwarmOptimization", "...": "optimization fields" },
  "agent_recommendation": {
    "agent_version": "2.0.0-deterministic-state-machine",
    "evidence_coverage_pct": 100.0,
    "decision_trace": { "evidence_considered": [], "beliefs": [], "goals": [], "candidate_plans": [], "selected_intention": {} },
    "...": "legacy-compatible agent fields"
  },
  "events": [{ "event_id": "...", "is_anomaly": false, "...": "evaluated event fields" }]
}
```

The exact response model is represented in the frontend by `AnalysisRun`, `IsolationForestSummary`, `PSOOptimizationResult`, `AgentRecommendation`, and `EvaluatedEventRecord` in `src/types/tracemind.ts`.

The agent decision trace is additive and persisted inside `agent_recommendation`. `confidence_score_pct` remains for existing clients but represents deterministic evidence coverage in agent version 2; it is not a probability, threat score, or certainty claim. If required evidence is missing or internally inconsistent, the response remains successful for the completed analysis but the agent returns a `no_recommendation` selected intention and empty execution steps.

### Errors

| Status | Implemented condition |
|---:|---|
| 413 | `Content-Length`, JSON content, or multipart file exceeds `MAX_UPLOAD_SIZE_MB`. |
| 422 | Invalid request configuration, malformed JSON, unsupported content type, invalid file encoding, parsing error, missing required event data, invalid numeric/timestamp value, duplicate event ID, or fewer than two records. |
| 500 | Unexpected server error; detailed exception is logged but not returned. |

## `GET /api/history`

Returns saved completed reports, newest creation timestamp first.

```json
{ "runs": [/* AnalysisRun */] }
```

No pagination, filtering, or summary-only response mode is implemented.

## `GET /api/history/{run_id}`

Returns the complete persisted `AnalysisRun` report.

| Status | Result |
|---:|---|
| 200 | Complete run JSON |
| 404 | `{ "detail": "Analysis run '<id>' was not found." }` |

## `GET /api/history/{run_id}/events`

Returns the event records for a persisted run in insertion order.

```json
{ "events": [/* EvaluatedEventRecord */] }
```

Missing runs return 404. No filtering, search, sort, or pagination query parameters are implemented server-side; the UI applies those operations to the returned records.

## `DELETE /api/history/{run_id}`

Deletes the run and dependent event records in one database transaction.

| Status | Result |
|---:|---|
| 204 | No response body |
| 404 | Run does not exist |

## Unsupported route

`POST /api/actions/simulate` is not implemented. The UI button is disabled and the route would return 404 if called.

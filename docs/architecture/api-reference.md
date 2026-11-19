# TraceMind API Reference

Base path: `/api`. The React client normally uses a same-origin `/api` URL; Vite proxies it to the FastAPI process during development.

All analysis and history routes require a Bearer JWT access token obtained from `/api/auth/register` or `/api/auth/login` (refresh tokens are rotated via an `HttpOnly`, `SameSite=Strict` cookie scoped to `/api/auth`). CORS allows `Accept`, `Content-Type`, `Authorization`, and `X-Request-ID`, and permits `GET`, `POST`, and `DELETE` (any future `PUT`/`PATCH` endpoint must update `allow_methods` in `backend/app/main.py`). Responses are JSON unless explicitly noted. Unexpected server failures return `{ "detail": "An unexpected server error occurred.", "request_id": "..." }` with HTTP 500.

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
  "severity_classification": { "model": "SeverityClassifier", "algorithm": "RandomForest", "...": "class counts and mean confidence" },
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

The agent decision trace is additive and persisted inside `agent_recommendation`. `evidence_coverage_pct` is the primary field measuring deterministic upstream evidence completeness (`confidence_score_pct` is retained as a backward-compatible alias and is not a probability, threat score, or certainty claim). Within `isolation_forest`, `threshold_score` is `null` when zero anomalies are detected, `feature_importances` is a mean absolute standardized deviation heuristic (not tree importance or SHAP), and `critical` (`>= 0.80`) / `high` (`>= 0.60`) severity bands are uncalibrated display thresholds. The `severity_classification` section is additive: each event gains `ml_severity` (`critical` / `medium` / `normal`), `ml_severity_confidence`, and a one-line `ml_severity_explanation`, and the run gains class counts plus `mean_confidence`. Its training labels are rule-derived heuristics, not human-verified (see `docs/severity-classifier.md`); if the model cannot be loaded or trained, analysis still completes and the section reports `"status": "skipped"` instead of failing the run. Within `pso_optimization`, `converged_at_iteration` is `null` when the initial swarm best was never improved, and `baseline_cost_usd` / `estimated_savings_pct` compare the selected action against the all-actions baseline (sum of all candidate action costs). If required evidence is missing or internally inconsistent, the response remains successful for the completed analysis but the agent returns a `no_recommendation` selected intention and empty execution steps.

### Errors

| Status | Implemented condition |
|---:|---|
| 413 | `Content-Length`, JSON content, or multipart file exceeds `MAX_UPLOAD_SIZE_MB`. |
| 422 | Invalid request configuration, malformed JSON, unsupported content type, invalid file encoding, parsing error, missing required event data, invalid numeric/timestamp value, duplicate event ID, or fewer than two records. |
| 500 | Unexpected server error; detailed exception is logged but not returned. |

## `GET /api/history`

Returns saved completed reports owned by the authenticated user, newest creation timestamp first, with offset pagination (`?limit=20&offset=0`, `limit` between `1` and `100`, `offset >= 0`).

```json
{ "runs": [/* AnalysisRun */], "limit": 20, "offset": 0 }
```

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

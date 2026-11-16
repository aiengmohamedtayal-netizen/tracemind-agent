# TraceMind Architecture Overview

## Scope

TraceMind is a modular monolith for analysing authorized event logs. It consists of a React/Vite client, one FastAPI process, and a SQLite database accessed through SQLAlchemy. The codebase does not implement authentication, network scanning, external command execution, or remediation actions.

## Runtime topology

```text
Browser
  │ React + TypeScript
  │ /api (Vite development proxy)
  ▼
FastAPI /api router
  ├─ request parsing and validation
  ├─ AnalysisOrchestrator
  │   ├─ ingestion
  │   ├─ Isolation Forest detection
  │   ├─ candidate action catalog
  │   ├─ binary PSO
  │   └─ deterministic investigation agent (evidence → beliefs → goals → plans → intention)
  └─ AnalysisRepository ── SQLAlchemy ── SQLite
```

In local development, the frontend uses `VITE_API_BASE_URL=/api`. `vite.config.ts` proxies that path to `http://127.0.0.1:8001` without rewriting it, so FastAPI receives `/api/...` paths.

## Component boundaries

| Layer | Implemented responsibility | Primary code |
|---|---|---|
| React UI | Analysis input, rendering persisted reports, history selection/deletion, client-side preflight feedback | `src/components`, `src/App.tsx` |
| Client API layer | Builds API URLs, serializes JSON/FormData, handles cancellation/timeouts, normalizes response arrays | `src/services/api` |
| FastAPI routes | Parses HTTP formats, enforces request size and Pydantic constraints, maps expected errors to HTTP responses | `backend/app/api/routes.py` |
| Orchestrator | Executes the ordered pipeline and makes completed-run persistence atomic | `backend/app/services/analysis_orchestrator.py` |
| Algorithm services | Ingestion, anomaly detection, candidate generation, PSO, evidence-bound agent decision cycle | `backend/app/services` |
| Repository | Persists and retrieves runs and event records | `backend/app/db/repository.py` |
| Database | Stores report JSON plus event-level records linked to a run | `backend/app/db/models.py` |

Routes are thin: algorithm and persistence logic are not implemented in FastAPI handlers. The `AnalysisOrchestrator` is framework-independent except for receiving an SQLAlchemy session.

## Frontend information architecture

The current UI exposes four task-oriented destinations:

- **Overview**: active-run facts, top anomalies, and selected read-only action.
- **Analyze**: CSV/JSON input and an expandable Advanced model settings section.
- **Investigate**: Events, Recommendation, and Model evidence tabs; detailed technical charts are retained here.
- **History**: persisted run list, selection, refresh, and confirmed deletion.

The feature migration and regression baseline are recorded in [Feature Mapping Checklist](../feature-inventory.md).

## Implemented operational decisions

- SQLite is intentionally selected for local, single-process persistence; no migration framework or multi-node database configuration exists.
- The API is unversioned and rooted at `/api`; a root `/health` alias exists for deployment probes.
- CORS uses the configured `CORS_ORIGINS`; credentials are disabled, and allowed methods are GET, POST, and DELETE.
- A request ID is accepted from `x-request-id` or generated, returned as `X-Request-ID`, and unexpected errors are logged server-side.
- FastAPI creates tables through `Base.metadata.create_all()` at application startup. No schema migration/versioning mechanism is currently implemented.

## Not implemented

- Authentication, authorization, rate limiting, background processing, distributed tracing, production database migrations, and API versioning.
- `POST /api/actions/simulate`; the UI presents it as disabled and FastAPI has no route for it.

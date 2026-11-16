# TraceMind Architecture Audit

## Scope and baseline

This audit covers the checked-in React/Vite client, FastAPI services, SQLAlchemy persistence, Isolation Forest, binary PSO, deterministic investigation agent, tests, configuration, and deployment files. The current working tree also contains user changes; this audit does not treat those changes as disposable.

Previously executed verification: backend 22 passed; `npm run lint` passed; `npm run build` passed; live API create/read/events/delete flow passed; browser UI showed persisted agent evidence. This is a local functional baseline, not a production security or scientific accuracy certification.

## Architecture

```text
React/Vite → FastAPI → AnalysisOrchestrator → ingestion → Isolation Forest
                                      ├────→ action catalog → binary PSO
                                      ├────→ deterministic evidence-bound agent
                                      └────→ SQLAlchemy → SQLite
```

The backend has reasonable service boundaries and an atomic completed-run transaction. The agent is connected to real detector and optimizer results and is advisory/read-only. Frontend API response validation is explicit.

## Findings

| Priority | Finding | Evidence / impact |
|---|---|---|
| Critical before public use | No authentication or authorization | Every caller can analyze, read all history, and delete any run. Current data model has no owner/tenant field. |
| High | History returns full `result_json`, including every event, for every run | `AnalysisRepository.list_runs`; unbounded response and memory growth. |
| High | `Base.metadata.create_all()` is the startup schema strategy | No migration history or controlled upgrades. |
| High | Upload size enforcement trusts Content-Length until body parsing | JSON body is materialized before the content-size check; missing/incorrect header can permit excess memory use. Multipart parsing also occurs before actual file-length validation. |
| High | CPU-heavy analysis runs synchronously inside an async route | Event-loop blocking under concurrent requests; no explicit event-count or concurrency limit. |
| High | Database configuration uses SQLite by default and no production PostgreSQL driver/config is present | Suitable for local/small single-instance use; not a multi-instance production configuration. |
| Medium | Event model has indexes but no unique `(run_id,event_id)` constraint | Duplicate events are rejected in ingestion today, but database integrity does not enforce it. |
| Medium | API is unversioned and request/response typing is uneven | OpenAPI exists through FastAPI defaults, but route response contracts are mostly plain dictionaries. |
| Medium | Current security headers and request ID middleware exist, but logs are not structured and request IDs are not validated/propagated through all layers. | Limited operational correlation. |
| Medium | No Alembic, Docker, CI, frontend component/E2E test setup, or deployment/backup guide is present. | Clean-environment deployment and rollback are not verified. |
| Medium | No rate limiting or authentication tests | Public deployment would permit resource exhaustion and cross-user access. |
| Medium | Scientific validation is synthetic only | Measures implementation behavior, not generalization to representative operational logs. |
| Low | package metadata retains `react-example` and unused-looking Express/Gemini dependencies | Naming and supply-chain surface need cleanup after confirming no hidden consumer. |

## Component conclusions

- Isolation Forest: genuine scikit-learn implementation; scores are relative within a run, not calibrated probabilities.
- PSO: genuine binary swarm with deterministic seed and constraints; the compact objective is heuristic and does not establish global optimality.
- Agent: deterministic, evidence-bound recommendation cycle; does not use an LLM, cross-run memory, or external execution.
- Persistence: completed runs and event rows are committed atomically; SQLite cascade is enabled.
- Frontend: real backend data is rendered; action simulation is visibly disabled because the endpoint does not exist.

## Immediate production blockers

Do not expose the current service publicly with user data until an ownership/authentication model, data isolation, request/resource limits, migrations, PostgreSQL deployment strategy, and recovery procedure are implemented and verified. A production database migration must be rehearsed from a backup before use.

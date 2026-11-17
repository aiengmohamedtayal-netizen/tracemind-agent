# TraceMind Feature Mapping Checklist

This inventory was captured before the UX simplification work. It is the regression baseline for the frontend API contract and analytical capabilities.

| Existing feature | Previous location | New location | API/service | Verification target |
|---|---|---|---|---|
| Backend health and retry | DataSourceBanner | DataSourceBanner | `GET /api/health` | Status and retry remain visible globally |
| API contract documentation | Header modal | Header modal | API config | Modal remains available from global status bar |
| CSV/JSON file upload | Upload & Analyze | Analyze | `POST /api/analyze` | File request preserved |
| Pasted CSV/JSON content | Upload & Analyze | Analyze | `POST /api/analyze` | JSON request preserved |
| Client file/content validation | Upload & Analyze | Analyze | `analysisEngine` | Errors remain inline |
| All AnalysisConfig fields/defaults | Upload & Analyze | Analyze → Advanced model settings | `AnalysisConfig` | Values and submit payload unchanged |
| Submission/loading/error states | Upload & Analyze | Analyze | `submitEventLogAnalysis` | Failed requests never create success state |
| Summary metrics | Dashboard | Overview | `AnalysisRun` | Values come from active persisted run |
| Isolation Forest score distribution | Dashboard | Investigate → Model evidence | `isolation_forest` | Chart retained |
| Feature importance evidence | Dashboard | Investigate → Model evidence | `isolation_forest` | Chart retained |
| Top anomalies and event inspection | Dashboard/Anomalies | Investigate → Events | `AnalysisRun.events` | Selection and inspector retained |
| Search/filter/sort/export events | Anomalies | Investigate → Events | `AnalysisRun.events` | Controls retained |
| PSO selected action/candidates/convergence | Dashboard/PSO & Agent | Investigate → Recommendation | `pso_optimization` | Full PSO detail retained |
| Agent findings/steps/guardrails | Dashboard/PSO & Agent | Investigate → Recommendation | `agent_recommendation` | Full agent detail retained |
| Historical list/select | History & Reports/DataSourceBanner | History/global run selector | `GET /api/history`, `GET /api/history/{id}` | Actual stored data remains selected |
| Historical event retrieval | Events service | Investigate → Events | `GET /api/history/{id}/events` | Service remains available |
| Delete analysis | History & Reports | History | `DELETE /api/history/{id}` | UI updates only after resolved delete request; a confirmation dialog is presented before deletion. |
| Empty/loading/error states | All views | All views | API services | No fabricated analysis data |

## Regression acceptance

- Every row must remain reachable with keyboard navigation.
- Technical evidence is moved behind an Investigate tab, never removed.
- Motion must remain optional under `prefers-reduced-motion`.
- Live verification includes `/api/health`, a real analysis POST, history retrieval, and deletion confirmation.

## Regression Checklist Results

| Feature group | Result | Notes |
|---|---|---|
| Navigation | Improved | Five technical destinations are now four task-oriented destinations: Overview, Analyze, Investigate, History. |
| Overview metrics and next step | Preserved / improved | A compact overview presents run facts, affected services, the selected action, and top anomalies. |
| Analysis submission and validation | Preserved | CSV, JSON, pasted content, client validation, loading, errors, and the existing request contract are unchanged. |
| AnalysisConfig controls | Moved | All seven fields and defaults remain available under the semantic Advanced model settings disclosure. The submit button stays outside it. |
| Events and event inspector | Moved | Search, filters, sort, export, row selection, and feature-contribution inspector remain under Investigate → Events. |
| PSO and agent details | Moved | Candidates, convergence, selected action, agent reasoning, runbook, and guardrails remain under Investigate → Recommendation. |
| Charts and technical evidence | Moved | Score distribution, feature importance, and existing technical dashboard charts remain under Investigate → Model evidence. |
| Historical data and deletion | Preserved | The existing services and confirm-dialog delete UI flow are unchanged. Live API verification passed. |
| Accessibility | Improved | Native `details`/`summary`, labeled tab buttons, focus-visible states, semantic headings, and existing reduced-motion CSS are retained. |
| Missing functionality | None | No frontend feature was intentionally removed. |

## Live verification (2026-11-08)

Verified through the Vite proxy at `http://localhost:3000/api` against FastAPI:

- `GET /health` returned `200` and `sqlite_connected` (note: the `/health` route binding was fixed to correctly expose the health handler; previously it was bound to the wrong endpoint).
- `POST /analyze` persisted a four-event JSON run, detected one anomaly, and returned a real PSO action.
- `GET /history`, `GET /history/{run_id}`, and `GET /history/{run_id}/events` returned the persisted run and four event records.
- `DELETE /history/{run_id}` returned `204`; a following `GET` returned `404`.

# TraceMind

TraceMind analyzes authorized application or system event logs. The React client submits CSV or JSON data to a FastAPI service, which validates it, runs Isolation Forest anomaly detection, chooses a read-only investigation action with binary PSO, records an evidence-bound recommendation, and persists the run in SQLite.

## Architecture

```text
React / Vite → /api proxy → FastAPI routes → AnalysisOrchestrator
                                              ├─ ingestion & validation
                                              ├─ Isolation Forest
                                              ├─ read-only action catalog + binary PSO
                                              ├─ deterministic agent explanation
                                              └─ SQLAlchemy repository → SQLite
```

The backend lives in [`backend/`](backend/). Its route handlers only parse HTTP requests and delegate to services; persistence is isolated in `app/db/repository.py`.

## Requirements

- Node.js 22+ and npm
- Python 3.11+

## Run locally

On Windows, double-click [`Start-TraceMind.bat`](Start-TraceMind.bat) for one-click startup. It reuses healthy local services, installs missing dependencies, applies SQLite migrations when it starts the API, starts FastAPI and Vite in the background, waits for health checks, and opens the app. The local database is `data\tracemind.db`; service logs are written to `logs\`.

Create a Python virtual environment and install backend dependencies:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt
Copy-Item backend\.env.example backend\.env
```

Start the API from the repository root:

```powershell
$env:PYTHONPATH = "backend"
py -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

In a second terminal, install and start the frontend:

```powershell
npm install
npm run dev
```

Open `http://localhost:3000`. During local Vite development, requests to `/api` proxy to `http://127.0.0.1:8000`; alternatively set `VITE_API_BASE_URL=http://localhost:8000/api` in `.env.local`.

## API

The frontend contract is served under `/api`:

- `GET /api/health` — validates the SQLite connection.
- `POST /api/analyze` — accepts multipart (`file`, `dataset_name`, `format`, and model fields) or JSON `{dataset_name, format, content, config}`.
- `GET /api/history` — returns `{ "runs": AnalysisRun[] }`.
- `GET /api/history/{run_id}` — returns the saved complete run.
- `GET /api/history/{run_id}/events` — returns `{ "events": EvaluatedEventRecord[] }`.
- `DELETE /api/history/{run_id}` — atomically deletes the run and dependent event records.

`POST /actions/simulate` remains intentionally unsupported: the UI treats it as disabled, and TraceMind does not execute actions on external systems.

## Event data contract

Upload UTF-8 CSV with a header or JSON event array (or `{ "events": [...] }`). Every event must contain:

```text
event_id,timestamp,service,latency_ms,error_rate,cpu_pct,memory_mb,payload_bytes,status_code
```

`timestamp` must be ISO-8601; `error_rate` is `0..1`; `cpu_pct` is `0..100`; and `status_code` is `100..599`. Optional fields are `event_type`, `source_ip`, and `message`. The backend and frontend both impose a 25 MB upload limit. Invalid records are reported as a 422 response—none are silently discarded.

## Analysis methods

Isolation Forest uses standardized continuous telemetry (`latency_ms`, `error_rate`, `cpu_pct`, `memory_mb`, `payload_bytes`) and a derived binary HTTP-error indicator; it deliberately does not treat raw HTTP status values as continuous quantities. The response normalizes `-decision_function` to a relative `anomaly_score` in `0..1`, where larger values are more unusual within that run. The model classification remains the source of `is_anomaly`.

PSO uses a binary position for the five read-only investigation actions. A position is limited to two actions and a $50 notional analysis budget; the response exposes the best selected action because that is the existing UI contract. Its deterministic fitness is:

```text
0.60 × expected benefit − 0.18 × normalized cost − 0.15 × risk − 0.07 × latency
```

Expected benefit is a documented heuristic calculated from observed anomaly rate, error/status patterns, CPU, and latency. Cost, risk, and latency are declared catalog metadata, not measured dollar values or success probabilities. An exhaustive single-action baseline is provided for test validation; PSO is not guaranteed to find a global optimum.

The agent is deterministic and evidence-bound: it distinguishes model findings from possible explanations and only recommends read-only investigation steps.

## Test and build

```powershell
$env:PYTHONPATH = "backend"
py -m pytest backend\tests -q
npm run lint
npm run build
```

The backend test suite covers ingestion failures, reproducible Isolation Forest results, binary PSO output, health, persistence, retrieval, deletion, and an end-to-end API lifecycle using isolated SQLite databases.

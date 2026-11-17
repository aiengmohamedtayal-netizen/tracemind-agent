# TraceMind

TraceMind analyzes authorized application or system event logs. The React client submits CSV, JSON, JSONL, or plain-text log data to a FastAPI service, which validates it, runs Isolation Forest anomaly detection, chooses a read-only investigation action with binary PSO, records a deterministic evidence-bound recommendation, and persists the run in SQLite.

## Architecture

```text
React / Vite → /api proxy → FastAPI routes → AnalysisOrchestrator
                                              ├─ ingestion & validation
                                              ├─ Isolation Forest
                                              ├─ read-only action catalog + binary PSO
                                              ├─ deterministic agent explanation
                                              └─ SQLAlchemy repository → SQLite (WAL)
```

The backend lives in [`backend/`](backend/). Its route handlers only parse HTTP requests and delegate to services; persistence is isolated in `app/db/repository.py`.

The frontend uses tab-based state navigation (`Overview`, `Analyze`, `Investigate`, `History`) behind an authenticated `AuthGate` rather than client-side URL routing. It contains **no mock data** — if the FastAPI backend is unavailable, the UI reports `Backend Unavailable` instead of fabricating analysis results.

## Requirements

- Node.js 22+ and npm
- Python 3.11+

## Run locally

### One-command startup

- **Linux / macOS**:
  ```bash
  chmod +x scripts/start-tracemind.sh
  ./scripts/start-tracemind.sh
  ```
  This creates `.venv`, installs backend dependencies, copies `backend/.env.example` to `backend/.env` if missing, applies Alembic migrations (`alembic upgrade head`), starts FastAPI (`127.0.0.1:8000`) with a health check, installs frontend dependencies, and starts Vite (`localhost:3000`).

- **Windows**: Double-click [`Start-TraceMind.bat`](Start-TraceMind.bat) (or run `powershell -ExecutionPolicy Bypass -File scripts\start-tracemind.ps1`). It reuses healthy local services, installs missing dependencies, applies SQLite migrations, starts FastAPI and Vite in the background, waits for health checks, and opens the app. The local database is `data\tracemind.db`; service logs are written to `logs\`.

### Manual startup (Linux / macOS)

1. Create a Python virtual environment, install backend dependencies, and configure environment variables:
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r backend/requirements.txt
   cp backend/.env.example backend/.env
   ```

2. Apply database migrations (required before first start; the FastAPI lifespan also runs `Base.metadata.create_all` as a safety net for fresh local SQLite databases):
   ```bash
   PYTHONPATH=backend python -m alembic -c backend/alembic.ini upgrade head
   ```

3. Start the FastAPI backend from the repository root:
   ```bash
   PYTHONPATH=backend python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
   ```

4. In a second terminal, install and start the React/Vite frontend:
   ```bash
   npm install
   npm run dev
   ```

<details>
<summary>Manual startup on Windows (PowerShell)</summary>

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt
Copy-Item backend\.env.example backend\.env

$env:PYTHONPATH = "backend"
py -m alembic -c backend\alembic.ini upgrade head
py -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

In a second terminal:
```powershell
npm install
npm run dev
```
</details>

Open `http://localhost:3000`. During local Vite development, requests to `/api` proxy to `http://127.0.0.1:8000`; alternatively set `VITE_API_BASE_URL=http://localhost:8000/api` in `.env.local` (CORS allows `Accept`, `Content-Type`, `Authorization`, and `X-Request-ID`).

### Development & deployment notes

- **Vite `--host=0.0.0.0`**: `npm run dev` intentionally binds to `0.0.0.0` so an evaluator on the same local network can open the live demo from their machine. To bind strictly to localhost, run `npm run dev -- --host=127.0.0.1`.
- **Auth rate limiting**: `/api/auth/register` and `/api/auth/login` default to `5/minute` via `AUTH_RATE_LIMIT` in `backend/.env`. For live demos where repeated login attempts may occur, set `AUTH_RATE_LIMIT=30/minute` in `backend/.env` without disabling rate limiting.
- **CORS methods**: `backend/app/main.py` allows `GET`, `POST`, and `DELETE`. Any future `PUT` or `PATCH` endpoint must add that method to `allow_methods`.
- **Offline font fallback**: `index.html` loads Google Fonts over CDN; in offline demo environments the UI falls back cleanly to local system sans/monospace fonts.

## API

The frontend contract is served under `/api` (all analysis/history endpoints require a Bearer JWT from `/api/auth/register` or `/api/auth/login`; refresh tokens are stored in an `HttpOnly`, `SameSite=Strict` cookie):

- `GET /api/health` (and root alias `GET /health`) — validates the SQLite connection and reports available models.
- `POST /api/auth/register` / `POST /api/auth/login` / `POST /api/auth/refresh` / `POST /api/auth/logout` / `GET /api/auth/me` — Argon2 + JWT authentication with rotating refresh token families.
- `POST /api/analyze` — accepts multipart (`file`, `dataset_name`, `format`, and model fields) or JSON `{dataset_name, format, content, config}`.
- `GET /api/history?limit=20&offset=0` — returns `{ "runs": AnalysisRun[], "limit": 20, "offset": 0 }` (default `limit=20`, max `100`).
- `GET /api/history/{run_id}` — returns the saved complete run.
- `GET /api/history/{run_id}/events` — returns `{ "events": EvaluatedEventRecord[] }`.
- `DELETE /api/history/{run_id}` — atomically deletes the run and dependent event records.

`POST /api/actions/simulate` remains intentionally unsupported: the UI treats it as disabled, and TraceMind does not execute actions on external systems. See [`docs/architecture/api-reference.md`](docs/architecture/api-reference.md) for full details.

## Event data contract

Upload UTF-8 CSV with a header, JSON event array (or `{ "events": [...] }`), JSONL, or plain-text `.log`/`.txt` files. Structured telemetry requires:

```text
event_id,timestamp,service,latency_ms,error_rate,cpu_pct,memory_mb,payload_bytes,status_code
```

`timestamp` must be ISO-8601; `error_rate` is `0..1`; `cpu_pct` is `0..100`; and `status_code` is `100..599`. Optional fields are `event_type`, `source_ip`, and `message`. Structured log CSVs with recognized log columns (e.g., `Date`, `Time`, `Level`, `Component`, `Content`) and `.log`/`.txt`/JSONL files are processed under the `generic_log` profile without fabricating telemetry. Unrecognized CSV headers return HTTP 422 rather than silently converting to text. Both backend and frontend impose a 25 MB upload limit. Invalid telemetry records return HTTP 422 with row numbers — none are silently discarded.

## Analysis methods & design rationale

See [`docs/validation/pso-design-rationale.md`](docs/validation/pso-design-rationale.md) for full mathematical and calibration notes. Key points for evaluators:

- **Isolation Forest**: Uses standardized continuous telemetry (`latency_ms`, `error_rate`, `cpu_pct`, `memory_mb`, `payload_bytes`) and a derived binary HTTP-error indicator (never raw HTTP status codes as continuous numbers). `-decision_function` is min-max normalized per run to `0..1`; scores are relative within that run only. Model classification (`is_anomaly`) is authoritative.
- **Thresholds & heuristics**:
  - `threshold_score` is the minimum normalized score among flagged anomalies, or `null` when no anomalies are detected.
  - Severity bands (`critical` ≥ `0.80`, `high` ≥ `0.60`, `medium` < `0.60`) are uncalibrated display thresholds for UI triage.
  - `feature_importances` reports mean absolute standardized deviation (z-score heuristic) for client compatibility — not tree-based Isolation Forest importance or SHAP values.
- **Binary PSO (demonstrative)**: Evaluates five read-only investigation actions with a two-action, `$50` notional budget constraint. `_position_fitness` takes the maximum single-action fitness in a particle position so the swarm searches for the best single read-only action matching the UI contract:
  ```text
  0.60 × expected benefit − 0.18 × normalized cost − 0.15 × risk − 0.07 × latency
  ```
  Expected benefit is an uncalibrated heuristic from observed log characteristics; cost, risk, and latency are fixed catalog metadata (not measured dollars or probabilities). Because the catalog has 5 actions, PSO is **demonstrative** and validated in tests against `exhaustive_best_action` as the authoritative single-action reference.
  - `baseline_cost_usd` / `estimated_savings_pct`: measured against the **all-actions baseline** (sum of all candidate action costs without optimization).
  - `converged_at_iteration`: `null` when the global best came from initialization and was never improved, or iteration `N` (1-based) when last improved.
- **Intelligent Agent**: Deterministic, pure-function, read-only state machine. Recommendations are explicitly labeled as **investigation leads, not confirmed root causes**. `evidence_coverage_pct` (also mirrored in `confidence_score_pct` for backward compatibility) measures upstream evidence completeness — not a probability or certainty score.

## Demo script & credentials

### Demo account

Create this account once via the **Create an account** form (or sign in if already registered):

| Field | Value |
|---|---|
| Email | `demo@tracemind.app` |
| Password | `TraceMind2026!Demo` |

> **Note**: Reserved domains like `.local` (e.g., `test@audit.local`) are rejected by `EmailStr`. Use a standard domain like `demo@tracemind.app`.

### Ready-to-upload sample CSV

A ready-to-upload sample file is committed at [`docs/demo-sample.csv`](docs/demo-sample.csv) (8 events, 2 clearly anomalous on `api-gateway` and `cache-service`):

```csv
event_id,timestamp,service,latency_ms,error_rate,cpu_pct,memory_mb,payload_bytes,status_code
evt-001,2026-01-01T10:00:00Z,auth-service,45,0.01,22,180,512,200
evt-002,2026-01-01T10:00:01Z,auth-service,52,0.02,25,195,480,200
evt-003,2026-01-01T10:00:02Z,api-gateway,8900,0.95,97,980,2048,503
evt-004,2026-01-01T10:00:03Z,auth-service,48,0.01,24,188,500,200
evt-005,2026-01-01T10:00:04Z,auth-service,51,0.02,23,192,490,200
evt-006,2026-01-01T10:00:05Z,cache-service,7500,0.88,91,850,1800,500
evt-007,2026-01-01T10:00:06Z,auth-service,49,0.01,22,185,505,200
evt-008,2026-01-01T10:00:07Z,auth-service,47,0.02,21,182,495,200
```

### 2-minute live demo walkthrough

1. Start both servers (`./scripts/start-tracemind.sh` on Linux/macOS or `Start-TraceMind.bat` on Windows) and open `http://localhost:3000`.
2. Sign in (or register) with `demo@tracemind.app` / `TraceMind2026!Demo`.
3. Open **Analyze**, upload `docs/demo-sample.csv`, and click **Run TraceMind Analysis Pipeline**.
4. In **Overview**, highlight the detected anomalies (`evt-003` / `evt-006`) and the read-only recommended next step.
5. Open **Investigate → Events** to inspect feature z-score contributions, then **Investigate → Recommendation** to show the PSO candidate table, convergence chart, and deterministic read-only agent decision trace (noting that findings are investigation leads, not confirmed root causes).
6. Open **History**, click Delete on a test run to show the confirmation dialog, and optionally click **API Contracts** in the status bar to show the live backend contract.

## Test, lint, and build

```bash
# Backend tests and lint (Linux / macOS)
PYTHONPATH=backend python -m pytest backend/tests -q
python -m ruff check backend

# Frontend typecheck + ESLint, unit tests, production build, and Playwright E2E
npm run lint
npm test
npm run build
npx playwright test
```

<details>
<summary>Windows PowerShell test commands</summary>

```powershell
$env:PYTHONPATH = "backend"
py -m pytest backend\tests -q
py -m ruff check backend
npm run lint
npm test
npm run build
npx playwright test
```
</details>

The backend test suite covers ingestion validation, reproducible Isolation Forest results, binary PSO output against the exhaustive baseline, deterministic agent traces, `/health` and `/api/health`, CORS preflight with `Authorization`, paginated history, user isolation, and full API lifecycle using isolated SQLite databases. A Markdown companion to the bilingual Word report is available at [`TraceMind_Bilingual_Project_Report.md`](TraceMind_Bilingual_Project_Report.md).

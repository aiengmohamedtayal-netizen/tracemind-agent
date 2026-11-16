# Agent Instructions

## Package Manager

Use npm for the React/Vite client and `py` with `PYTHONPATH=backend` for the FastAPI backend.

## Commands

| Task | Command |
|---|---|
| Backend tests | `$env:PYTHONPATH='backend'; py -m pytest backend/tests -q` |
| Agent tests | `$env:PYTHONPATH='backend'; py -m pytest backend/tests/test_intelligent_agent.py -q` |
| Typecheck | `npm run lint` |
| Production build | `npm run build` |
| Algorithm validation | `$env:PYTHONPATH='backend'; py backend/scripts/run_algorithm_validation.py --output docs/validation/algorithm-validation-report.md` |

## Key Conventions

- Keep `AnalysisOrchestrator` framework-light and persist completed runs atomically.
- Preserve Isolation Forest and PSO contracts; agent output is additive in `agent_recommendation`.
- Agent recommendations are deterministic, evidence-bound, advisory, and read-only.
- Keep frontend response types compatible with persisted historical runs.
- Update architecture documentation when a persisted response shape changes.

## Commit Attribution

AI commits must include `Co-Authored-By: gpt-5.6-terra <noreply@example.com>`.

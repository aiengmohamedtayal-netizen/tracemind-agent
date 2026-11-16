# Production Readiness Checklist

Status legend: Done locally, Partial, Not done, Blocked on external/user input.

| Area | Status | Evidence / next step |
|---|---|---|
| Core analysis API and UI | Done locally | 22 backend tests, TypeScript check, production build, live JSON lifecycle, browser review. |
| Isolation Forest / PSO / Agent | Partial | Real implementations and deterministic tests exist; obtain authorized representative labeled logs for scientific validation. |
| Input validation | Partial | Pydantic and parser validation exist; enforce body limits during streaming and bound event count/compute. |
| Authentication / authorization / tenant isolation | Not done | Define user identity and ownership model before public exposure. |
| Rate limits / concurrency / timeouts | Not done | Add bounded request and analysis concurrency controls. |
| History pagination / summary response | Not done | Add stable cursor or page pagination and avoid returning all event arrays. |
| Database migrations | Not done | Add Alembic baseline and migration tests without altering existing data. |
| PostgreSQL | Not done | Configure driver, compose service, health checks, migrations, and rehearsed backup/restore. |
| Audit/security logging | Partial | Request ID and safe generic 500 response exist; add structured logs without event payload leakage. |
| Frontend tests and E2E | Not done | Add tests for forms and user journeys. |
| Dependency/security scanning | Not done | Run lockfile and Python vulnerability checks in CI; resolve findings based on advisories. |
| Docker/CI/CD | Not done | Add reproducible images and CI; deployment still needs explicit infrastructure authorization. |
| Backup/recovery/rollback | Not done | Document and rehearse against a disposable database copy. |
| Production documentation | Partial | Existing architecture docs need alignment; deployment/security/database guides remain. |

## Release gate

No public production readiness claim until authentication and authorization, data isolation, migrations, request limits, integration/E2E checks, dependency review, backup/restore, and deployment configuration have evidence from a clean environment.

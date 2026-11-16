# Prioritized Implementation Plan

## P0 — Contain immediate exposure risks

1. Enforce bounded request-body reads before JSON/multipart parsing; add maximum event count and analysis concurrency limits.
2. Add authenticated ownership boundaries before exposing history/analyze/delete to multiple users. Select a deployable identity model and test unauthorized and cross-owner access.
3. Replace unbounded history payloads with paginated summaries while preserving the existing run-detail endpoint.

## P1 — Safe schema and persistence evolution

1. Introduce Alembic with a baseline matching the current schema and test upgrade/downgrade on disposable databases.
2. Add database constraints and indexes, including per-run event identity.
3. Add PostgreSQL configuration and integration composition; retain SQLite for local tests.
4. Document and rehearse backup/restore before any existing database migration.

## P2 — Reliability and quality

1. Add request/analysis timing, structured safe logs, readiness checks, and concurrency behavior tests.
2. Add frontend component/API tests and Playwright end-to-end coverage.
3. Add dependency/security scanning and CI quality gates.
4. Resolve client/server validation differences and document disabled simulation semantics.

## P3 — Scientific and operational readiness

1. Extend reproducible ML/PSO evaluation; report synthetic results separately from real-world claims.
2. Add representative authorized labeled data when available.
3. Build and test backend/frontend containers and a PostgreSQL Compose integration workflow.
4. Complete deployment, secrets, recovery, rollback, and production-readiness documentation.

## Sequencing note

Authentication requires a product decision about identity provider and ownership semantics. Until that is established, implement safe local hardening and database/API improvements without claiming multi-user security. No public deployment or existing-data migration is included.

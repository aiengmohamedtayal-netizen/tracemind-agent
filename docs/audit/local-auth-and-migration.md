# Local Authentication and Existing Data

## Local use

When commands run from the repository root as shown below, the local app uses SQLite at `data/tracemind.db` (the E2E config uses a separate database under `backend/data/`). Apply schema upgrades before starting FastAPI:

```powershell
$env:PYTHONPATH = "backend"
py -m alembic -c backend/alembic.ini upgrade head
py -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Set `JWT_SECRET` to a random value with at least 32 characters in `backend/.env`; production mode rejects the development placeholder. Access JWTs remain in memory; refresh credentials use an HttpOnly, SameSite=Strict cookie and rotate on refresh.

## Existing SQLite database

Back up the database file before schema changes. A pre-auth database has the original `analysis_runs` and `event_records` tables but no Alembic version row. Migration `0000_initial` represents that schema, so mark that baseline, then upgrade:

```powershell
Copy-Item data/tracemind.db data/tracemind.pre-auth.bak
$env:PYTHONPATH = "backend"
py -m alembic -c backend/alembic.ini stamp 0000_initial
py -m alembic -c backend/alembic.ini upgrade head
```

Migration `0001_auth_ownership` adds nullable `owner_id` and account tables. Existing records remain unowned and are never assigned to the first registering account. User endpoints filter by owner and cannot expose legacy runs. Keep the backup until row counts and application behavior have been checked.

The local database currently has three ownerless historical runs and 20 associated events. The schema migration preserved them, and `data/tracemind.post-auth-migration.bak` is a post-migration recovery copy. Archive these rows in the protected backup. Any future ownership recovery requires verified provenance and an explicitly reviewed administrative migration; never bulk-assign them to the first account.

## Security model and limits

- Passwords use pwdlib's Argon2 password hasher.
- Access JWT lifetime defaults to 10 minutes.
- Refresh token values are high entropy; only SHA-256 digests are stored, and refresh revokes the previous token.
- Logout revokes the current refresh token. Access JWTs expire naturally within their short lifetime.
- Login and registration are IP limited in-process. Multi-worker deployment needs a shared rate-limit backend.
- Registration always grants `user`; no public role-escalation endpoint exists.
- Local SQLite works. PostgreSQL is supported by SQLAlchemy/psycopg configuration, but was not part of the local integration check.

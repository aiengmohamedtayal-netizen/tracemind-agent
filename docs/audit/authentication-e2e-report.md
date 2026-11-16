# TraceMind Authentication and Browser E2E Audit

**Run date:** 2026-11-16  
**Environment:** Windows local development, SQLite, FastAPI + Vite, Chromium (Playwright)  
**Result:** Browser journeys and requested verification suites passed. The local sign-in timeout report was investigated and mitigated. Production deployment was not performed.

## Browser journeys

Playwright ran the actual React client and FastAPI service in Chromium against a dedicated disposable SQLite database. Both browser tests passed (`2 passed`, 1.2 minutes).

After the responsiveness fix, the sign-in validation and generic Spark-log browser checks also passed (`2 passed`). The running local Vite proxy returned HTTP 200 for health and login; logout returned 204, and replaying the logged-out refresh cookie returned 401.

Follow-up investigation of the pasted `/api/analyze` connectivity error found both local Vite instances (ports 3000 and 3001) and FastAPI (port 8000) running, with health returning 200 through both proxies. A Chromium test then uploaded and analyzed a same-schema 100,000-row CSV successfully; the test completed in 29.2 seconds and removed its test run. The reported connection error was not reproducible in this environment.

All user-facing application copy is English. The source, test, and project documentation text were scanned for Arabic Unicode characters; none remain.

- Registered a new user after checking the browser's short-password validation and disabled/loading button state, then logged in through the real UI.
- Confirmed the refresh cookie is HttpOnly and SameSite=Strict, Secure is false in local development, and browser localStorage contains no keys.
- Uploaded a real five-event JSON dataset, ran analysis, viewed its result, opened Investigate, and reviewed the recommendation, PSO optimization, and agent reasoning.
- Saved and retrieved the run in history, logged out, confirmed a protected view returns to the login gate, then logged in again and retrieved history.
- Used a one-minute test access-token lifetime. After expiry the next protected analysis request received 401, automatically refreshed once, retried, and completed with 200. The refresh cookie changed.
- Checked invalid credentials, responsive login at 390px, cleared refresh cookie, and fail-closed behavior after page reload.
- Uploaded a UTF-8 Spark `.log` file through the browser and verified that the raw error message is available in investigation details.

The run produced expected `401` then `200` for the post-expiration analysis retry. The local application logs did not contain bearer or refresh token values.

Screenshots from the passing browser run:

- [Authenticated overview](screenshots/authenticated-overview.png)
- [Investigation recommendation](screenshots/investigation-recommendation.png)

## Token lifecycle and isolation

- Refresh rotates the stored token hash and marks the previous token revoked.
- Reuse of a revoked token revokes active descendants in its token family.
- Logout revokes the current refresh token and clears its cookie; access JWTs expire naturally.
- Missing and invalid refresh cookies return 401 without creating an authenticated session.
- Parallel requests with the same refresh token result in one successful rotation; the replay is rejected and the token family is revoked. The browser client uses a single-flight refresh promise to avoid duplicate refresh calls within a tab.
- Multi-user tests confirmed user B cannot list, read, fetch events for, or delete user A's run.
- An explicit legacy-row test confirmed records with `owner_id IS NULL` remain absent from ordinary-user history and return 404 for detail/delete endpoints.

## Security configuration review

- **JWT secret:** Production settings reject the local default, secrets shorter than 32 characters, low-diversity repeated values, and wildcard CORS origins. Supply a unique random `JWT_SECRET` through the deployment secret store; do not commit it.
- **Cookies:** Refresh cookie uses HttpOnly, SameSite=Strict, path `/api/auth`, and Secure only when `APP_ENV=production`. Local development correctly uses Secure=false over loopback HTTP.
- **Token storage:** Access JWT stays in application memory; refresh token is an HttpOnly cookie. The frontend does not place tokens in localStorage. Request/error logging records the path and request ID, not credential values; validation errors omit submitted input.
- **CORS:** Credentialed requests use the configured explicit origin list; production rejects `*`.
- **Rate limiting:** Login/register are limited to 5 requests per minute and refresh to 10 per minute. The limiter is process-local; multi-worker deployments require a shared store for effective cross-worker limits.
- **Passwords and auth errors:** Password validation requires at least 12 characters (maximum 128); Argon2 hashing is used. Login errors do not disclose whether an email exists.
- **Configuration:** The development JWT default cannot start in production mode. Cookie security follows `APP_ENV`, so production must set that value exactly to `production`.

## Sign-in timeout and log ingestion

The reported UI error was `Request to POST /api/auth/login timed out or was cancelled.` After restarting the local API, login returned HTTP 200. The analysis route was declared async but ran the full synchronous anomaly detection, PSO, agent, and persistence pipeline directly on the ASGI event loop. A local 100,000-row pipeline benchmark took about 11.6 seconds, longer than the frontend's former 10-second default request timeout; while that work ran, it could delay login and refresh requests. This is the likely cause of the report, though the timeout was not reproducible after restarting the local server.

The analysis pipeline now runs in Starlette's thread pool with its own SQLAlchemy session. Login, registration, and session-restore requests have a 20-second client timeout. The backend suite and the browser upload flow passed after this change.

The 100,000-row browser test also exposed a nested-transaction error in the history-delete route after its authenticated ownership query. The route now commits the already-open request transaction directly; an owner-delete assertion and the large browser test both pass.

The importer accepts UTF-8 CSV, JSON, JSONL/NDJSON, and plain-text log files such as LOG/TXT, including common Spark-style multiline logs. If full telemetry columns are present, their existing typed path is preserved. Otherwise, the generic parser uses fields actually present in the records and measurable text features; unavailable latency, CPU, memory, or error-rate values remain null. Binary, encrypted, compressed, and proprietary formats that are not UTF-8 text still need a format-specific decoder.

## Existing local data and recovery

The repository-root local SQLite database was at the documented pre-auth schema. It contained **3 analysis runs and 20 event records** before the auth migration. The legacy baseline was stamped and migrations `0001_auth_ownership` and `0002_refresh_families` were applied. Counts remain 3 and 20; all 3 historical runs still have `owner_id=NULL`. No run was assigned to a new user. A post-migration SQLite backup was created at `data/tracemind.post-auth-migration.bak`.

Ordinary accounts cannot recover these ownerless records. Keep them archived in the protected database backup. If recovery is required, an administrator should export the specific records offline, verify provenance with the data owner, document approval and record IDs, and perform a separately reviewed one-time ownership migration. Never infer ownership from the first account or bulk-assign legacy rows. The database used by E2E is separate (`backend/data/tracemind-e2e.db`) and contains only disposable test accounts/data.

## Verification commands and results

| Check | Result |
|---|---|
| `py -m pytest backend/tests -q` with `PYTHONPATH=backend` | **30 passed**, 8 dependency deprecation warnings |
| `py -m pytest backend/tests/test_auth_isolation.py -q` | **6 passed**, 7 dependency deprecation warnings |
| `npm run lint` (TypeScript) | **Passed** |
| `npm run build` | **Passed**, Vite production build completed |
| `npx playwright test e2e/auth-flow.spec.ts` | **2 passed** in Chromium |
| Post-fix browser checks: auth validation and generic Spark log upload | **2 passed** in Chromium |
| 100,000-row telemetry CSV upload, analysis, history display, and test cleanup | **1 passed** in Chromium, 29.2 seconds |
| Local Vite-proxy health/login/logout/revoked-refresh check | **200 / 200 / 204 / 401** |
| Production configuration validation | Covered by auth tests: local/default, short, repeated secrets and wildcard CORS rejected; high-entropy secret accepted |

## Fixes made during verification

- Corrected the Vite API proxy fallback to port 8000.
- Fixed React hook ordering so session loading does not change hook count between renders.
- Added single-flight access-token refresh and session-expiration handling in the frontend.
- Fixed numeric form steps that made default analysis settings fail native browser validation.
- Fixed analysis persistence transaction handling when authentication had already opened a read transaction.
- Sanitized request-validation errors so submitted input is not echoed.
- Made refresh-token rotation an atomic conditional update. Concurrent testing had shown that two requests could both rotate one token; now only one wins and replay revokes its family.
- Tightened production secret entropy and credentialed CORS validation.
- Moved CPU-heavy analysis and persistence off the FastAPI event loop so large uploads do not stall authentication requests; gave local auth requests a 20-second timeout.
- Generalized ingestion for UTF-8 log formats and made the Spark raw-message browser assertion target the raw-message element specifically.
- Fixed deletion of owned analysis runs when authentication has already opened a request transaction.

## Remaining blockers and limits

- No production deployment or external database was changed.
- PostgreSQL-specific behavior and shared-store rate limiting were not exercised; current end-to-end run used SQLite and a single local API process.
- Generic ingestion was browser-verified with a Spark text log. Proprietary or non-text/binary formats require a dedicated decoder; the importer does not claim to parse every vendor-specific encoding.
- Current FastAPI/Starlette test dependencies emit deprecation warnings; tests pass, but dependency upgrades should be planned.
- Local auth cookies are intentionally not Secure over HTTP. Production must use HTTPS and `APP_ENV=production`.

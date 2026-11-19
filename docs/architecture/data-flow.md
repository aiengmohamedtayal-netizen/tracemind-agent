# TraceMind Data Flow

## 1. Input submission

The Analyze UI accepts a local `.csv`/`.json` file or pasted content. `submitEventLogAnalysis` first performs client-side structural validation and then sends one of two supported forms to `POST /api/analyze`:

- `multipart/form-data` for a selected file, with `file`, `dataset_name`, `format`, and each analysis configuration field.
- `application/json` for pasted content, with `dataset_name`, `format`, `content`, and a nested `config` object.

The client timeout for analysis submission is 30 seconds. Other API requests default to 10 seconds; health checks use 3.5 seconds.

## 2. Server validation and normalization

`_read_analysis_request` reads the declared content type, rejects unsupported types, applies the 25 MB limit, and validates configuration using `AnalysisConfig`. The ingestion service then:

1. Parses CSV with `csv.DictReader`, or JSON as an array or `{ "events": [...] }`.
2. Requires at least two records.
3. Requires these fields per record: `event_id`, `timestamp`, `service`, `latency_ms`, `error_rate`, `cpu_pct`, `memory_mb`, `payload_bytes`, and `status_code`.
4. Rejects duplicate event IDs in the same run.
5. Normalizes timestamps to UTC ISO-8601 `Z` form.
6. Validates numeric ranges: error rate `0..1`, CPU `0..100`, HTTP status `100..599`, and non-negative telemetry values.
7. Supplies `UNSPECIFIED` for an omitted optional `event_type`, an empty string for omitted `source_ip`, and preserves an optional `message`.

The backend is authoritative. The client preflight is intentionally earlier feedback, not the trust boundary.

## 3. Analysis pipeline

```text
validated events
  → Isolation Forest evaluated events + summary
  → Random Forest severity classification (ml_severity per event + summary)
  → data-derived read-only candidate actions
  → binary PSO selected action + convergence history
  → deterministic investigation agent (evidence → beliefs → goals → PSO-aligned intention → decision trace)
  → JSON-safe AnalysisRun
  → single SQLite transaction
  → HTTP response
```

The orchestrator creates the run ID and UTC creation timestamp after analysis completes, then uses `session.begin()` to save the run and all event records together. An exception during the transaction prevents a completed record from being committed.

## 4. Result consumption and history

The server returns an `AnalysisRun` object. The client validates that it contains a run ID and the three core result objects, then stores it in React state. On application load, the client calls health followed by `GET /api/history` and uses the selected persisted run as the workspace context.

History deletion awaits the DELETE response before React removes the item from state. It does not optimistically remove a run.

## Observed compatibility note

The frontend's client preflight recognizes a smaller set of CSV telemetry columns than the server's authoritative required schema. As a result, a payload may pass the client structural preview but receive a server `422` if it omits `timestamp`, `memory_mb`, `payload_bytes`, or `status_code`. This is documented behaviour, not silent coercion; the backend returns the invalid-record details.

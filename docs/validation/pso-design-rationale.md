# PSO & Scoring Design Rationale — TraceMind

## Overview

TraceMind pairs **Isolation Forest** anomaly detection with a **Binary Particle Swarm Optimization (PSO)** selector over a small catalog of 5 read-only investigation actions, followed by a deterministic evidence-bound Intelligent Agent. This note documents the exact heuristics, baselines, and uncalibrated display thresholds so evaluators can inspect every design choice transparently.

## 1. PSO Fitness Function (Demonstrative Scope)

Each candidate action `a` is scored on a 0–100 scale (`action_fitness` in `backend/app/services/pso_optimizer.py`):

```text
fitness(a) = 0.60 * mitigation_efficacy_pct
           - 0.18 * min(100, estimated_cost_usd * 2)
           - 0.15 * sla_risk_score
           - 0.07 * min(100, execution_latency_sec)
```

`_position_fitness` evaluates a binary particle position as the **maximum single-action fitness** among the enabled actions in that position (subject to the two-action, `$50` notional budget enforced in `_enforce_constraints`).

**Why max-based single-action fitness?**
- The UI contract exposes one primary selected read-only investigation action so the analyst gets a clear, unambiguous next step.
- With only 5 catalog actions, exhaustive search is `O(5)`. The Binary PSO is **demonstrative** — it illustrates swarm velocity/probability updates, diversity, and convergence behavior rather than claiming NP-hard optimality.
- `exhaustive_best_action` in `backend/app/services/pso_optimizer.py` serves as the **authoritative reference baseline** in `backend/tests/test_algorithm_validation.py` to verify the PSO matches the single-action optimum on validation fixtures.

## 2. `baseline_cost_usd` and `estimated_savings_pct`

- `baseline_cost_usd` is the **all-actions baseline**: the sum of `estimated_cost_usd` across all candidate investigation actions (i.e., the notional cost of executing every candidate investigation without optimization).
- `estimated_savings_pct` is `(baseline_cost_usd - optimized_cost_usd) / baseline_cost_usd * 100`.
- Catalog cost, risk, and latency are fixed notional metadata declared in `backend/app/services/action_catalog.py`, not measured dollar spend or SLA incident probabilities.

## 3. `converged_at_iteration`

- When `converged_at_iteration` is `null`, the global best fitness was established during initial swarm generation (before iteration 1) and was never improved during the search loop.
- When `converged_at_iteration` is an integer `N >= 1`, iteration `N` was the final iteration in which the global best strictly improved.

## 4. Benefit Heuristic Weights (`action_catalog.py`)

`mitigation_efficacy_pct` is an **uncalibrated heuristic (0–100)** derived from observed run statistics (anomaly rate, average error rate, HTTP error status ratio, CPU, latency, or generic log error/exception/rare-token ratios). The linear coefficients in `backend/app/services/action_catalog.py` are domain-informed ranking weights chosen for clear differentiation across incident profiles, not empirically calibrated against labeled remediation outcomes.

## 5. Isolation Forest Display Thresholds & `feature_importances`

- **Authoritative classification**: `is_anomaly` comes directly from scikit-learn `IsolationForest.predict()` (`-1` vs `1`).
- **`threshold_score`**: Minimum per-run normalized score among flagged anomalies, or `null` when zero events are flagged anomalous.
- **Severity thresholds (`0.80` / `0.60`)**: Inside `backend/app/services/anomaly_detection.py` (`_severity`), flagged anomalies are grouped into `critical` (`>= 0.80`), `high` (`>= 0.60`), and `medium` (`< 0.60`). These are **uncalibrated display thresholds** on the per-run min-max normalized score for visual triage in the UI; future work with labeled production datasets can calibrate these cutoffs against precision/recall targets.
- **`feature_importances`**: Reports the normalized **mean absolute standardized deviation** (mean `|z-score|`) per feature using the fitted `StandardScaler`. The key name is preserved for API/UI compatibility; it is a descriptive deviation heuristic, not tree-based Isolation Forest feature importance or SHAP attribution.

## 6. Agent `evidence_coverage_pct` vs `confidence_score_pct`

In `backend/app/services/agent/explanation.py`, `evidence_coverage_pct` measures completeness across the four required upstream evidence groups (events, Isolation Forest summary, candidate actions, and PSO selection). The legacy key `confidence_score_pct` carries the same value solely for backward compatibility with older clients and persisted historical runs — it is **not** a statistical confidence interval, probability, or threat certainty score.

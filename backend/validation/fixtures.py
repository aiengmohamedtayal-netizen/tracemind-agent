from __future__ import annotations

from copy import deepcopy

RANDOM_SEED = 42
ISOLATION_FOREST_BASELINE = {"contamination": 0.12, "n_estimators": 150, "random_seed": RANDOM_SEED}
PSO_BASELINE = {
    "swarm_size": 20,
    "max_iterations": 20,
    "inertia_weight": 0.72,
    "cognitive_coeff": 1.49,
    "social_coeff": 1.49,
    "random_seed": RANDOM_SEED,
}


def labelled_outlier_events() -> tuple[list[dict], set[str]]:
    """34 deterministic events: 30 nominal observations and 4 intentionally separated outliers."""
    events = [_event(index, is_outlier=False) for index in range(30)]
    events.extend(_event(30 + index, is_outlier=True) for index in range(4))
    return events, {f"validation-{index}" for index in range(30, 34)}


def constant_events() -> list[dict]:
    return [_event(index, is_outlier=False, constant=True) for index in range(6)]


def minimal_events() -> list[dict]:
    return [_event(0, is_outlier=False), _event(1, is_outlier=True)]


def pso_actions() -> list[dict]:
    return [
        {"action_id": "ACT-A", "estimated_cost_usd": 10.0, "mitigation_efficacy_pct": 70.0, "sla_risk_score": 5.0, "execution_latency_sec": 10.0},
        {"action_id": "ACT-B", "estimated_cost_usd": 35.0, "mitigation_efficacy_pct": 85.0, "sla_risk_score": 15.0, "execution_latency_sec": 30.0},
        {"action_id": "ACT-C", "estimated_cost_usd": 20.0, "mitigation_efficacy_pct": 60.0, "sla_risk_score": 8.0, "execution_latency_sec": 20.0},
    ]


def copy_events(events: list[dict]) -> list[dict]:
    return deepcopy(events)


def _event(index: int, *, is_outlier: bool, constant: bool = False) -> dict:
    if constant:
        latency, error_rate, cpu, memory, payload, status, service = 42, 0.01, 30, 512, 256, 200, "auth"
    elif is_outlier:
        latency, error_rate, cpu, memory, payload, status, service = 2400 + index, 0.75, 97, 4096, 40000, 503, "payments"
    else:
        latency, error_rate, cpu, memory, payload, status, service = 35 + index % 4, 0.01, 25 + index % 3, 512 + index % 5, 260 + index % 7, 200, "auth"
    return {
        "event_id": f"validation-{index}",
        "timestamp": f"2026-11-08T18:{index % 60:02d}:00Z",
        "service": service,
        "event_type": "VALIDATION_EVENT",
        "source_ip": "10.0.0.1",
        "latency_ms": latency,
        "error_rate": error_rate,
        "cpu_pct": cpu,
        "memory_mb": memory,
        "payload_bytes": payload,
        "status_code": status,
    }

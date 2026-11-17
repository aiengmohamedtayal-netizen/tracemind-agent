from __future__ import annotations

from collections import Counter


def build_candidate_actions(events: list[dict], summary: dict) -> list[dict]:
    anomalies = [event for event in events if event["is_anomaly"]]
    population = anomalies or events
    affected_services = Counter(event["service"] for event in population)
    service = affected_services.most_common(1)[0][0]
    anomaly_rate = summary["anomaly_rate_pct"] / 100
    if summary.get("input_profile") == "generic_log":
        return _build_generic_log_actions(population, service, anomaly_rate)
    avg_error = sum(event["error_rate"] for event in population) / len(population)
    avg_cpu = sum(event["cpu_pct"] for event in population) / len(population)
    avg_latency = sum(event["latency_ms"] for event in population) / len(population)
    error_status_ratio = sum(event["status_code"] >= 400 for event in population) / len(population)

    # Benefit is an uncalibrated, documented heuristic (0–100) derived from measured log characteristics.
    # Weights below are domain-informed display/ranking heuristics (not calibrated against labeled incident outcomes);
    # cost, risk, and latency are fixed catalog metadata. See docs/validation/pso-design-rationale.md.
    return [
        _action("ACT-SERVICE", "SERVICE_SCOPE", "Inspect anomalous service cohort", service,
                "Read-only grouping of anomalous records by service, endpoint, and event type.",
                22, 8, 35, 40 + 45 * anomaly_rate + 15 * (1 - len(affected_services) / max(len(population), 1))),
        _action("ACT-TIMELINE", "TIMELINE_WINDOW", "Inspect correlated time window", service,
                "Read-only timeline review around the anomalous event windows.",
                18, 6, 20, 35 + 40 * anomaly_rate + 25 * error_status_ratio),
        _action("ACT-RESOURCE", "RESOURCE_DEVIATION", "Analyze CPU and memory deviations", service,
                "Read-only comparison of CPU and memory telemetry against nominal records.",
                28, 10, 45, 20 + 0.35 * avg_cpu + min(25, avg_latency / 100)),
        _action("ACT-ERROR", "ERROR_PATTERN", "Examine repeated error patterns", service,
                "Read-only aggregation of HTTP status and error-rate patterns.",
                20, 7, 30, 25 + 55 * avg_error + 30 * error_status_ratio),
        _action("ACT-LATENCY", "LATENCY_PATTERN", "Inspect unusual latency patterns", service,
                "Read-only latency distribution and outlier investigation.",
                24, 8, 25, 20 + min(65, avg_latency / 25) + 20 * anomaly_rate),
    ]


def _build_generic_log_actions(population: list[dict], service: str, anomaly_rate: float) -> list[dict]:
    features = [event.get("log_features", {}) for event in population]
    error_ratio = sum(row.get("error_term", 0) for row in features) / len(features)
    exception_ratio = sum(row.get("exception_term", 0) for row in features) / len(features)
    rare_token_mean = sum(row.get("rare_token_ratio", 0) for row in features) / len(features)
    repeated_template_ratio = sum(row.get("template_frequency", 0) for row in features) / len(features)
    return [
        _action("ACT-LOG-SOURCE", "LOG_SOURCE_SCOPE", "Inspect anomalous log source", service,
                "Read-only review of unusual records grouped by their source component.",
                18, 7, 25, 35 + 50 * anomaly_rate + 15 * min(1, error_ratio)),
        _action("ACT-LOG-TIMELINE", "LOG_TIME_WINDOW", "Review correlated log time window", service,
                "Read-only timeline review using timestamps present in the uploaded records.",
                16, 6, 20, 35 + 45 * anomaly_rate + 20 * min(1, exception_ratio)),
        _action("ACT-LOG-TEMPLATE", "LOG_TEMPLATE_PATTERN", "Inspect repeated log templates", service,
                "Read-only comparison of repeated and unusual message templates.",
                20, 8, 30, 30 + 45 * min(1, repeated_template_ratio * 5) + 25 * anomaly_rate),
        _action("ACT-LOG-SEVERITY", "LOG_SEVERITY_PATTERN", "Review error and exception patterns", service,
                "Read-only grouping of explicit error, warning, and exception indicators in log text.",
                18, 7, 25, 25 + 50 * min(1, error_ratio + exception_ratio) + 25 * anomaly_rate),
        _action("ACT-LOG-RARE", "LOG_RARE_MESSAGE", "Inspect rare message patterns", service,
                "Read-only review of messages containing uncommon tokens in this dataset.",
                22, 9, 35, 25 + 45 * min(1, rare_token_mean) + 30 * anomaly_rate),
    ]


def _action(action_id: str, code: str, title: str, target: str, description: str, cost: float, risk: float, latency: float, benefit: float) -> dict:
    return {
        "action_id": action_id,
        "action_code": code,
        "title": title,
        "target_subsystem": target,
        "description": description,
        "estimated_cost_usd": float(cost),
        "mitigation_efficacy_pct": round(min(100.0, max(0.0, benefit)), 2),
        "sla_risk_score": float(risk),
        "execution_latency_sec": float(latency),
    }

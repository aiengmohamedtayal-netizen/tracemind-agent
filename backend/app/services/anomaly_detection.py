from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

from app.core.exceptions import ValidationError

FEATURES = ("latency_ms", "error_rate", "cpu_pct", "memory_mb", "payload_bytes", "status_error_indicator")
FEATURE_UNITS = {
    "latency_ms": "ms", "error_rate": "ratio", "cpu_pct": "%", "memory_mb": "MB", "payload_bytes": "bytes", "status_error_indicator": "binary",
}
GENERIC_FEATURE_UNITS = {
    "message_length_bytes": "bytes", "word_count": "count", "digit_count": "count",
    "punctuation_count": "count", "uppercase_ratio": "ratio", "severity_rank": "ordinal",
    "error_term": "binary", "warning_term": "binary", "exception_term": "binary",
    "component_frequency": "ratio", "template_frequency": "ratio",
    "rare_token_ratio": "score", "timestamp_gap_seconds": "seconds",
    "latency_ms": "ms", "error_rate": "ratio", "cpu_pct": "%", "memory_mb": "MB",
    "payload_bytes": "bytes", "status_error_indicator": "binary",
}


@dataclass(frozen=True)
class DetectionResult:
    events: list[dict]
    summary: dict


def detect_anomalies(events: list[dict], *, contamination: float, n_estimators: int, random_seed: int) -> DetectionResult:
    if len(events) < 2:
        raise ValidationError("At least two valid events are required for Isolation Forest.")
    generic_logs = isinstance(events[0].get("log_features"), dict)
    if generic_logs:
        feature_names = tuple(
            feature for feature in GENERIC_FEATURE_UNITS
            if any(event.get("log_features", {}).get(feature) is not None for event in events)
        )
        raw_matrix = np.array([
            [event.get("log_features", {}).get(feature, np.nan) for feature in feature_names]
            for event in events
        ], dtype=float)
        medians = np.nanmedian(raw_matrix, axis=0)
        matrix = np.where(np.isnan(raw_matrix), medians, raw_matrix)
        units = GENERIC_FEATURE_UNITS
    else:
        feature_names = FEATURES
        matrix = np.array([[_feature_value(event, feature) for feature in FEATURES] for event in events], dtype=float)
        units = FEATURE_UNITS
    scaler = StandardScaler()
    scaled = scaler.fit_transform(matrix)
    is_constant = bool(np.all(np.ptp(matrix, axis=0) == 0))
    if is_constant:
        predictions = np.ones(len(events), dtype=int)
        anomaly_scores = np.zeros(len(events))
        raw_scores = np.zeros(len(events))
        depths = np.zeros(len(events))
    else:
        model = IsolationForest(
            n_estimators=n_estimators,
            contamination=contamination,
            random_state=random_seed,
            n_jobs=1,
        )
        model.fit(scaled)
        predictions = model.predict(scaled)
        raw_scores = -model.decision_function(scaled)
        low, high = float(raw_scores.min()), float(raw_scores.max())
        anomaly_scores = np.full(len(events), 0.5) if np.isclose(low, high) else (raw_scores - low) / (high - low)
        # Compute each tree's path depth for the full batch. Calling decision_path
        # once per row creates n_samples * n_estimators Python/Scipy calls and
        # made otherwise valid 100k-row uploads exceed the API timeout.
        depth_totals = np.zeros(len(events), dtype=float)
        for tree in model.estimators_:
            path_lengths = np.asarray(tree.decision_path(scaled).sum(axis=1)).ravel() - 1
            depth_totals += path_lengths
        depths = depth_totals / len(model.estimators_)

    evaluated: list[dict] = []
    for index, event in enumerate(events):
        z_scores = np.abs(scaled[index])
        contribution_total = float(z_scores.sum())
        contributions = [
            {"feature": feature, "value": _json_number(matrix[index, position]), "z_score": round(float(z_scores[position]), 4), "weight": round(float(z_scores[position] / contribution_total), 4) if contribution_total else 0.0}
            for position, feature in enumerate(feature_names)
        ]
        primary = max(contributions, key=lambda item: item["z_score"])["feature"]
        is_anomaly = bool(predictions[index] == -1)
        score = round(float(anomaly_scores[index]), 6)
        evaluated.append({
            **event,
            "anomaly_score": score,
            "isolation_depth": round(float(depths[index]), 4),
            "is_anomaly": is_anomaly,
            "severity": _severity(score, is_anomaly),
            "primary_driver": primary,
            "feature_contributions": contributions,
        })
    anomaly_scores_only = [event["anomaly_score"] for event in evaluated if event["is_anomaly"]]
    summary = {
        "algorithm": "IsolationForest",
        "n_estimators": n_estimators,
        "contamination": contamination,
        "sample_size": len(events),
        "threshold_score": round(min(anomaly_scores_only), 6) if anomaly_scores_only else 1.0,
        "total_events": len(events),
        "anomalous_events_count": len(anomaly_scores_only),
        "normal_events_count": len(events) - len(anomaly_scores_only),
        "anomaly_rate_pct": round((len(anomaly_scores_only) / len(events)) * 100, 2),
        "mean_anomaly_score": round(float(np.mean(anomaly_scores)), 6),
        "max_anomaly_score": round(float(np.max(anomaly_scores)), 6),
        "score_distribution": _score_distribution(evaluated),
        "feature_importances": _feature_importances(matrix, evaluated),
    }
    if generic_logs:
        summary["input_profile"] = "generic_log"
        summary["feature_importances"] = _feature_importances(matrix, evaluated, feature_names, units)
    return DetectionResult(events=evaluated, summary=summary)


def _feature_value(event: dict, feature: str) -> float:
    return float(event["status_code"] >= 400) if feature == "status_error_indicator" else float(event[feature])


def _severity(score: float, is_anomaly: bool) -> str:
    if not is_anomaly:
        return "normal"
    if score >= 0.80:
        return "critical"
    if score >= 0.60:
        return "high"
    return "medium"


def _score_distribution(events: list[dict]) -> list[dict]:
    scores = np.array([event["anomaly_score"] for event in events], dtype=float)
    edges = np.linspace(0.0, 1.0, 6)
    return [
        {
            "bucket_label": f"{edges[i]:.1f}–{edges[i + 1]:.1f}",
            "min_score": round(float(edges[i]), 2),
            "max_score": round(float(edges[i + 1]), 2),
            "normal_count": int(sum(not event["is_anomaly"] and (edges[i] <= event["anomaly_score"] < edges[i + 1] or i == 4 and event["anomaly_score"] <= edges[i + 1]) for event in events)),
            "anomaly_count": int(sum(event["is_anomaly"] and (edges[i] <= event["anomaly_score"] < edges[i + 1] or i == 4 and event["anomaly_score"] <= edges[i + 1]) for event in events)),
        }
        for i in range(5)
    ]


def _feature_importances(
    matrix: np.ndarray,
    events: list[dict],
    features: tuple[str, ...] = FEATURES,
    units: dict[str, str] = FEATURE_UNITS,
) -> list[dict]:
    anomalous_indices = [index for index, event in enumerate(events) if event["is_anomaly"]]
    normal_indices = [index for index, event in enumerate(events) if not event["is_anomaly"]]
    deviations = np.abs(StandardScaler().fit_transform(matrix)).mean(axis=0)
    total = float(deviations.sum()) or 1.0
    return [
        {
            "feature": feature,
            "importance_pct": round(float(deviations[index] / total * 100), 2),
            "mean_anomalous_value": round(float(matrix[anomalous_indices, index].mean()), 4) if anomalous_indices else 0.0,
            "mean_normal_value": round(float(matrix[normal_indices, index].mean()), 4) if normal_indices else 0.0,
            "unit": units[feature],
        }
        for index, feature in enumerate(features)
    ]


def _json_number(value: float) -> float:
    return round(float(value), 6)

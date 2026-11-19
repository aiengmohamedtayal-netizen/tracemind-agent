"""Random Forest severity classifier for evaluated TraceMind events.

The classifier predicts one of ``critical`` / ``medium`` / ``normal`` for each
event that has already been scored by Isolation Forest. It is additive: the
existing ``severity`` display band from ``anomaly_detection`` is untouched,
and this module adds ``ml_severity``, ``ml_severity_confidence`` and
``ml_severity_explanation`` to each event plus a ``severity_classification``
summary to the analysis result.

Model file: ``backend/app/models/severity_classifier.joblib`` (a dict with the
trained model, feature list, training medians, classes, label-rules version
and training metrics). If the file is missing, the classifier trains itself
once from the bundled synthetic training data
(``backend/app/models/severity_training_data.csv``) and caches the result in
memory, so a fresh checkout still works. Training labels are rule-derived
heuristics, not human-verified; see ``severity_labeling``.
"""

from __future__ import annotations

import re
import threading
from collections import Counter
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

import joblib
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.model_selection import train_test_split

from app.services.severity_labeling import CLASSES, LABEL_RULES_VERSION, label_event, label_rules_doc

MODEL_DIR = Path(__file__).resolve().parent.parent / "models"
MODEL_PATH = MODEL_DIR / "severity_classifier.joblib"
META_PATH = MODEL_DIR / "severity_classifier.meta.json"
TRAINING_DATA_PATH = MODEL_DIR / "severity_training_data.csv"
MODEL_VERSION = "severity-classifier v1"
RANDOM_SEED = 42

FEATURES = (
    "anomaly_score",
    "isolation_depth",
    "is_anomaly",
    "latency_ms",
    "error_rate",
    "cpu_pct",
    "memory_mb",
    "payload_bytes",
    "status_error_indicator",
    "status_server_error",
    "severity_rank",
    "error_term",
    "warning_term",
    "exception_term",
    "component_frequency",
)

# Fallback medians used before any model bundle is loaded (telemetry profile).
_DEFAULT_MEDIANS = {
    "anomaly_score": 0.3,
    "isolation_depth": 10.0,
    "is_anomaly": 0.0,
    "latency_ms": 45.0,
    "error_rate": 0.01,
    "cpu_pct": 28.0,
    "memory_mb": 220.0,
    "payload_bytes": 512.0,
    "status_error_indicator": 0.0,
    "status_server_error": 0.0,
    "severity_rank": 2.0,
    "error_term": 0.0,
    "warning_term": 0.0,
    "exception_term": 0.0,
    "component_frequency": 0.2,
}

_ERROR_RE = re.compile(r"\b(error|failed|failure|fatal|critical)\b", re.I)
_WARNING_RE = re.compile(r"\b(warn|warning|retry|degraded)\b", re.I)
_EXCEPTION_RE = re.compile(r"\b(exception|traceback|stacktrace|caused by)\b", re.I)
_LEVEL_RE = re.compile(r"\b(CRITICAL|FATAL|ERROR|ERR|WARN|WARNING|INFO|DEBUG|TRACE)\b", re.I)
_LEVEL_RANK = {
    "TRACE": 0,
    "DEBUG": 1,
    "INFO": 2,
    "WARN": 3,
    "WARNING": 3,
    "ERROR": 4,
    "ERR": 4,
    "FATAL": 5,
    "CRITICAL": 5,
}

_cache_lock = threading.Lock()
_cached_bundle: dict | None = None


@dataclass(frozen=True)
class SeverityResult:
    events: list[dict]
    summary: dict


def extract_features(
    event: dict,
    *,
    service_frequencies: dict[str, float] | None = None,
    medians: dict[str, float] | None = None,
) -> list[float]:
    """Build the fixed-order feature vector for one evaluated event.

    Works for both input profiles: telemetry events carry the raw numeric
    fields, generic log events carry ``log_features``. Missing values fall
    back to the training medians so a single event never fails extraction.
    """
    med = dict(_DEFAULT_MEDIANS)
    if medians:
        med.update(medians)
    log_features = event.get("log_features") or {}
    status_code = event.get("status_code")
    message = str(event.get("message") or "")

    def _number(value: object, key: str) -> float:
        try:
            number = float(value)  # type: ignore[arg-type]
        except (TypeError, ValueError):
            return float(med[key])
        return number if number == number else float(med[key])

    if log_features.get("severity_rank") is not None:
        severity_rank = float(log_features["severity_rank"])
    elif message and (match := _LEVEL_RE.search(message)):
        severity_rank = float(_LEVEL_RANK[match.group(1).upper()])
    elif isinstance(status_code, (int, float)):
        severity_rank = 5.0 if status_code >= 500 else 4.0 if status_code >= 400 else 2.0
    else:
        severity_rank = float(med["severity_rank"])

    def _term(pattern: re.Pattern[str], key: str, *, status_fallback: bool) -> float:
        if log_features.get(key) is not None:
            return float(log_features[key])
        if message:
            return 1.0 if pattern.search(message) else 0.0
        return 1.0 if status_fallback else 0.0

    status_value = float(status_code) if isinstance(status_code, (int, float)) else 0.0
    service = str(event.get("service") or "unclassified")
    if service_frequencies and service in service_frequencies:
        component_frequency = service_frequencies[service]
    else:
        component_frequency = float(med["component_frequency"])

    return [
        _number(event.get("anomaly_score"), "anomaly_score"),
        _number(event.get("isolation_depth"), "isolation_depth"),
        1.0 if event.get("is_anomaly") else 0.0,
        _number(event.get("latency_ms"), "latency_ms"),
        _number(event.get("error_rate"), "error_rate"),
        _number(event.get("cpu_pct"), "cpu_pct"),
        _number(event.get("memory_mb"), "memory_mb"),
        _number(event.get("payload_bytes"), "payload_bytes"),
        1.0 if status_value >= 400 else 0.0,
        1.0 if status_value >= 500 else 0.0,
        severity_rank,
        _term(_ERROR_RE, "error_term", status_fallback=status_value >= 500),
        _term(_WARNING_RE, "warning_term", status_fallback=400 <= status_value < 500),
        _term(_EXCEPTION_RE, "exception_term", status_fallback=False),
        component_frequency,
    ]


def _features_to_labels(feature_rows: list[list[float]]) -> tuple[list[str], list[str]]:
    """Apply the documented labelling rules to extracted feature rows."""
    labels: list[str] = []
    rules: list[str] = []
    for row in feature_rows:
        features = dict(zip(FEATURES, row, strict=True))
        label, rule = label_event(
            anomaly_score=features["anomaly_score"],
            is_anomaly=bool(features["is_anomaly"]),
            status_code=500
            if features["status_server_error"]
            else (400 if features["status_error_indicator"] else 200),
            error_rate=features["error_rate"],
            exception_term=features["exception_term"],
        )
        labels.append(label)
        rules.append(rule)
    return labels, rules


def train_classifier(
    feature_rows: list[list[float]],
    labels: list[str],
    *,
    n_estimators: int = 200,
    random_state: int = RANDOM_SEED,
    test_size: float = 0.2,
) -> dict:
    """Train the Random Forest on a stratified split and report test metrics."""
    medians = {
        feature: float(np.nanmedian([row[index] for row in feature_rows])) for index, feature in enumerate(FEATURES)
    }
    matrix = np.array(
        [
            [row[index] if row[index] == row[index] else medians[feature] for index, feature in enumerate(FEATURES)]
            for row in feature_rows
        ],
        dtype=float,
    )
    target = np.array(labels)
    train_x, test_x, train_y, test_y = train_test_split(
        matrix, target, test_size=test_size, stratify=target, random_state=random_state
    )
    model = RandomForestClassifier(
        n_estimators=n_estimators, random_state=random_state, n_jobs=1, class_weight="balanced_subsample"
    )
    model.fit(train_x, train_y)
    predicted = model.predict(test_x)
    probabilities = model.predict_proba(test_x)
    classes = [str(item) for item in model.classes_]
    report = classification_report(
        test_y, predicted, labels=CLASSES, target_names=CLASSES, output_dict=True, zero_division=0
    )
    metrics = {
        "accuracy": round(float(accuracy_score(test_y, predicted)), 4),
        "per_class": {
            label: {
                "precision": round(float(report[label]["precision"]), 4),
                "recall": round(float(report[label]["recall"]), 4),
                "f1": round(float(report[label]["f1-score"]), 4),
                "support": int(report[label]["support"]),
            }
            for label in CLASSES
        },
        "confusion_matrix": {
            "labels": CLASSES,
            "matrix": [[int(value) for value in row] for row in confusion_matrix(test_y, predicted, labels=CLASSES)],
        },
        "mean_confidence": round(float(np.max(probabilities, axis=1).mean()), 4),
        "test_size": int(len(test_y)),
        "train_size": int(len(train_y)),
    }
    return {
        "model": model,
        "features": list(FEATURES),
        "medians": medians,
        "classes": classes,
        "label_rules_version": LABEL_RULES_VERSION,
        "label_rules": label_rules_doc(),
        "model_version": MODEL_VERSION,
        "sklearn_version": __import__("sklearn").__version__,
        "trained_at": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
        "metrics": metrics,
    }


def save_bundle(bundle: dict, *, model_path: Path = MODEL_PATH) -> None:
    """Persist a trained bundle with joblib."""
    model_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(bundle, model_path)


def load_bundle(*, model_path: Path = MODEL_PATH) -> dict:
    """Load a trained bundle, training from bundled data when the file is missing."""
    global _cached_bundle
    with _cache_lock:
        if _cached_bundle is not None:
            return _cached_bundle
        if model_path.exists():
            bundle = joblib.load(model_path)
        else:
            bundle = _train_from_bundled_data()
        _cached_bundle = bundle
        return bundle


def _train_from_bundled_data() -> dict:
    """Fallback training from the bundled synthetic training CSV."""
    import csv

    if not TRAINING_DATA_PATH.exists():
        raise FileNotFoundError(f"Severity model file and bundled training data are both missing: {TRAINING_DATA_PATH}")
    with TRAINING_DATA_PATH.open(newline="", encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))
    from app.services.anomaly_detection import detect_anomalies

    events = [
        {
            "event_id": row["event_id"],
            "timestamp": row["timestamp"],
            "service": row["service"],
            "event_type": row.get("event_type") or "UNSPECIFIED",
            "source_ip": row.get("source_ip") or "",
            "latency_ms": float(row["latency_ms"]),
            "error_rate": float(row["error_rate"]),
            "cpu_pct": float(row["cpu_pct"]),
            "memory_mb": float(row["memory_mb"]),
            "payload_bytes": float(row["payload_bytes"]),
            "status_code": int(row["status_code"]),
            **({"message": row["message"]} if row.get("message") else {}),
        }
        for row in rows
    ]
    detection = detect_anomalies(events, contamination=0.30, n_estimators=100, random_seed=RANDOM_SEED)
    feature_rows = [extract_features(event) for event in detection.events]
    labels, _ = _features_to_labels(feature_rows)
    return train_classifier(feature_rows, labels)


def explain_severity(event: dict, prediction: str, confidence: float) -> str:
    """One-line plain-language explanation of the predicted severity."""
    score = float(event.get("anomaly_score") or 0.0)
    status_code = event.get("status_code")
    error_rate = event.get("error_rate")
    latency = event.get("latency_ms")
    driver = str(event.get("primary_driver") or "latency_ms").replace("_", " ")
    if prediction == "critical":
        if isinstance(status_code, (int, float)) and status_code >= 500:
            reason = f"a {int(status_code)} status and an error rate of {float(error_rate or 0.0):.2f}"
        elif isinstance(error_rate, (int, float)) and error_rate >= 0.5:
            reason = f"an error rate of {float(error_rate):.2f}"
        elif isinstance(latency, (int, float)) and latency >= 1000:
            reason = f"latency of {float(latency):.0f} ms, far above the usual level"
        else:
            reason = f"its {driver} is far from the usual range"
        return f"Needs attention now: this event is highly unusual (anomaly score {score:.2f}) with {reason}."
    if prediction == "medium":
        if isinstance(status_code, (int, float)) and status_code >= 400:
            reason = f"a {int(status_code)} status"
        elif isinstance(latency, (int, float)) and latency >= 400:
            reason = f"latency of {float(latency):.0f} ms, above the usual level"
        else:
            reason = f"its {driver} is off its usual range"
        return f"Worth a look: this event is somewhat unusual (anomaly score {score:.2f}) with {reason}."
    return f"Looks routine: low anomaly score ({score:.2f}) and no failing signals."


def classify_severity(events: list[dict]) -> SeverityResult:
    """Add ``ml_severity`` fields to each evaluated event and summarize.

    Never raises: when the model cannot be loaded or trained, the events are
    returned unchanged and the summary reports the classifier as skipped.
    """
    if not events:
        return SeverityResult(
            events=events,
            summary={
                "model": "SeverityClassifier",
                "status": "skipped",
                "reason": "no events",
                "counts": {label: 0 for label in CLASSES},
            },
        )
    try:
        bundle = load_bundle()
    except Exception as exc:  # noqa: BLE001 - additive step must not break analysis
        return SeverityResult(
            events=events,
            summary={
                "model": "SeverityClassifier",
                "status": "skipped",
                "reason": f"model unavailable: {exc}",
                "counts": {label: 0 for label in CLASSES},
            },
        )
    model = bundle["model"]
    medians = bundle["medians"]
    classes = [str(item) for item in bundle["classes"]]
    service_counts = Counter(str(event.get("service") or "unclassified") for event in events)
    service_frequencies = {service: count / len(events) for service, count in service_counts.items()}
    feature_rows = [
        extract_features(event, service_frequencies=service_frequencies, medians=medians) for event in events
    ]
    matrix = np.array(feature_rows, dtype=float)
    predictions = [str(item) for item in model.predict(matrix)]
    probabilities = model.predict_proba(matrix)
    confidences: list[float] = []
    for index, event in enumerate(events):
        prediction = predictions[index]
        class_index = classes.index(prediction)
        confidence = round(float(probabilities[index][class_index]), 4)
        confidences.append(confidence)
        event["ml_severity"] = prediction
        event["ml_severity_confidence"] = confidence
        event["ml_severity_explanation"] = explain_severity(event, prediction, confidence)
    counts = Counter(predictions)
    summary = {
        "model": "SeverityClassifier",
        "model_version": bundle.get("model_version", MODEL_VERSION),
        "algorithm": "RandomForest",
        "classes": CLASSES,
        "label_rules_version": bundle.get("label_rules_version", LABEL_RULES_VERSION),
        "labels_note": "Training labels are rule-derived heuristics, not human-verified.",
        "total_events": len(events),
        "counts": {label: int(counts.get(label, 0)) for label in CLASSES},
        "mean_confidence": round(float(np.mean(confidences)), 4) if confidences else 0.0,
    }
    return SeverityResult(events=events, summary=summary)

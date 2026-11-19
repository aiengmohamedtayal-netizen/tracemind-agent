"""Train the TraceMind severity classifier.

Generates a synthetic telemetry dataset matching the exact TraceMind event
schema (``docs/demo-sample.csv`` columns), runs it through the real
Isolation Forest pipeline, labels it with the documented rule-based labelling
(``app.services.severity_labeling`` — heuristic labels, NOT human-verified),
trains the Random Forest, evaluates it on a stratified hold-out split, and
saves the model bundle, metadata and training data under
``backend/app/models/``.

Usage:
    PYTHONPATH=backend python backend/scripts/train_severity_classifier.py
    PYTHONPATH=backend python backend/scripts/train_severity_classifier.py --data labelled.csv

``--data`` trains from a real CSV instead of synthetic data. It must contain
the telemetry columns plus a ``severity_label`` column with values
``critical`` / ``medium`` / ``normal``.
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path

import numpy as np

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.services.anomaly_detection import detect_anomalies  # noqa: E402
from app.services.severity_classifier import (  # noqa: E402
    MODEL_DIR,
    MODEL_PATH,
    RANDOM_SEED,
    TRAINING_DATA_PATH,
    _features_to_labels,
    extract_features,
    save_bundle,
    train_classifier,
)

SERVICES = ("auth-service", "api-gateway", "payments", "orders", "inventory", "search")
EVENT_TYPES = ("LOGIN", "CHARGE", "SEARCH", "CHECKOUT", "REFUND", "LIST", "UPDATE")
TRAINING_CONTAMINATION = 0.30
N_ROWS = 3000


def _clip(rng: np.random.Generator, values: np.ndarray, low: float, high: float) -> np.ndarray:
    return np.clip(values, low, high)


def generate_synthetic_events(n_rows: int = N_ROWS, *, seed: int = RANDOM_SEED) -> list[dict]:
    """Synthetic telemetry events in the exact TraceMind schema.

    The mixture is 70% routine traffic, 20% degraded traffic and 10% failing
    traffic. The generation profile only shapes the distribution; the final
    training label comes from the documented labelling rules applied after
    Isolation Forest scoring, so a generated row can end up with a different
    rule label than its profile.
    """
    rng = np.random.default_rng(seed)
    counts = {
        "normal": int(n_rows * 0.70),
        "medium": int(n_rows * 0.20),
        "critical": n_rows - int(n_rows * 0.70) - int(n_rows * 0.20),
    }
    profiles = ["normal"] * counts["normal"] + ["medium"] * counts["medium"] + ["critical"] * counts["critical"]
    rng.shuffle(profiles)
    events: list[dict] = []
    for index, profile in enumerate(profiles):
        if profile == "normal":
            latency = _clip(rng, rng.normal(45, 15), 5, 200)
            error_rate = rng.uniform(0.0, 0.05)
            cpu = _clip(rng, rng.normal(30, 10), 5, 70)
            memory = _clip(rng, rng.normal(220, 60), 64, 1024)
            payload = _clip(rng, rng.normal(512, 150), 64, 2048)
            status = int(rng.choice([200, 200, 200, 200, 200, 200, 200, 200, 200, 201, 204, 301]))
            message = "request completed successfully"
        elif profile == "medium":
            latency = _clip(rng, rng.normal(1500, 600), 400, 5000)
            error_rate = rng.uniform(0.25, 0.60)
            cpu = _clip(rng, rng.normal(80, 10), 60, 97)
            memory = _clip(rng, rng.normal(1500, 500), 512, 4096)
            payload = _clip(rng, rng.normal(8192, 3000), 1024, 32768)
            status = int(rng.choice([400, 404, 429, 502]))
            message = "WARN upstream retry after timeout"
        else:
            latency = _clip(rng, rng.normal(6000, 2000), 2000, 15000)
            error_rate = rng.uniform(0.60, 1.0)
            cpu = _clip(rng, rng.normal(96, 3), 90, 100)
            memory = _clip(rng, rng.normal(3500, 800), 1024, 8192)
            payload = _clip(rng, rng.normal(32768, 10000), 4096, 131072)
            status = int(rng.choice([500, 502, 503]))
            message = "ERROR exception in payment handler"
        events.append(
            {
                "event_id": f"syn-{index + 1:05d}",
                "timestamp": f"2026-01-01T10:{(index // 60) % 60:02d}:{index % 60:02d}Z",
                "service": str(rng.choice(SERVICES)),
                "event_type": str(rng.choice(EVENT_TYPES)),
                "source_ip": "10.0.0.1",
                "latency_ms": round(float(latency), 2),
                "error_rate": round(float(error_rate), 4),
                "cpu_pct": round(float(cpu), 2),
                "memory_mb": round(float(memory), 2),
                "payload_bytes": round(float(payload), 2),
                "status_code": status,
                "message": message,
                "generation_profile": profile,
                "source": "synthetic",
            }
        )
    return events


def _write_training_csv(path: Path, events: list[dict], labels: list[str] | None, rules: list[str] | None) -> None:
    fieldnames = [
        "event_id",
        "timestamp",
        "service",
        "event_type",
        "source_ip",
        "latency_ms",
        "error_rate",
        "cpu_pct",
        "memory_mb",
        "payload_bytes",
        "status_code",
        "message",
        "generation_profile",
        "source",
        "severity_label",
        "label_rule",
    ]
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for index, event in enumerate(events):
            row = {key: event.get(key, "") for key in fieldnames}
            row["severity_label"] = labels[index] if labels else ""
            row["label_rule"] = rules[index] if rules else ""
            writer.writerow(row)


def _load_labelled_csv(path: Path) -> tuple[list[dict], list[str]]:
    with path.open(newline="", encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))
    missing = {
        "event_id",
        "timestamp",
        "service",
        "latency_ms",
        "error_rate",
        "cpu_pct",
        "memory_mb",
        "payload_bytes",
        "status_code",
        "severity_label",
    } - set(rows[0])
    if missing:
        raise ValueError(f"Labelled CSV is missing columns: {', '.join(sorted(missing))}")
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
    return events, [row["severity_label"].strip().lower() for row in rows]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", type=Path, default=None, help="Labelled CSV to train from instead of synthetic data.")
    parser.add_argument("--rows", type=int, default=N_ROWS, help="Synthetic rows to generate (default 3000).")
    parser.add_argument("--seed", type=int, default=RANDOM_SEED, help="Random seed (default 42).")
    args = parser.parse_args()

    if args.data:
        events, provided_labels = _load_labelled_csv(args.data)
        data_note = f"human-labelled file {args.data.name} ({len(events)} rows)"
        synthetic = False
    else:
        events = generate_synthetic_events(args.rows, seed=args.seed)
        provided_labels = None
        data_note = f"synthetic data generated by this script ({len(events)} rows, seed {args.seed}); labels are rule-derived, not human-verified"
        synthetic = True

    detection = detect_anomalies(events, contamination=TRAINING_CONTAMINATION, n_estimators=100, random_seed=args.seed)
    feature_rows = [extract_features(event) for event in detection.events]
    if provided_labels is None:
        labels, rules = _features_to_labels(feature_rows)
    else:
        labels, rules = provided_labels, ["human"] * len(provided_labels)

    bundle = train_classifier(feature_rows, labels)
    bundle["training_rows"] = len(events)
    bundle["data_note"] = data_note
    save_bundle(bundle, model_path=MODEL_PATH)

    meta = {key: value for key, value in bundle.items() if key != "model"}
    meta_path = MODEL_DIR / "severity_classifier.meta.json"
    meta_path.write_text(json.dumps(meta, indent=2, ensure_ascii=False), encoding="utf-8")

    if synthetic:
        _write_training_csv(TRAINING_DATA_PATH, events, labels, rules)

    from collections import Counter

    label_counts = Counter(labels)
    metrics = bundle["metrics"]
    print(f"model saved: {MODEL_PATH}")
    print(f"metadata saved: {meta_path}")
    if synthetic:
        print(f"training data saved: {TRAINING_DATA_PATH}")
    print(f"training rows: {len(events)} (train {metrics['train_size']}, test {metrics['test_size']})")
    print(f"label counts (rule-derived): {dict(label_counts)}")
    print(f"accuracy: {metrics['accuracy']:.4f}")
    for label, values in metrics["per_class"].items():
        print(
            f"  {label:8s} precision={values['precision']:.4f} recall={values['recall']:.4f} f1={values['f1']:.4f} support={values['support']}"
        )
    print(f"mean confidence: {metrics['mean_confidence']:.4f}")
    print("confusion matrix (rows = true, cols = predicted):")
    print(f"  labels: {metrics['confusion_matrix']['labels']}")
    for label, row in zip(metrics["confusion_matrix"]["labels"], metrics["confusion_matrix"]["matrix"]):
        print(f"  {label:8s} {row}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

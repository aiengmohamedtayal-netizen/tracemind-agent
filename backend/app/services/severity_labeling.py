"""Rule-based severity labels for the TraceMind severity classifier.

There is no human-labelled severity data in this project, so the training set
for the Random Forest severity classifier is labelled with the transparent
heuristic rules below. The rules combine the Isolation Forest anomaly score
with the event's own signals (HTTP status, error rate, exception terms).

These labels are HEURISTIC, not human-verified. They exist so the classifier
can be trained, evaluated, and wired into the analysis pipeline today; when
real labelled data (for example operator-confirmed severities from the
investigation history) becomes available, retrain with
``backend/scripts/train_severity_classifier.py --data <labelled.csv>`` and
bump ``LABEL_RULES_VERSION``.

Rules (``label_event`` returns the first matching rule):
  R1  critical: the event is an anomaly with an anomaly score >= 0.85.
  R2  critical: HTTP status is 5xx and the anomaly score is >= 0.50.
  R3  critical: error rate is >= 0.80 and the event is an anomaly.
  R4  critical: the message contains an exception term, the event is an
      anomaly, and the anomaly score is >= 0.60.
  R5  medium:   the event is an anomaly (and no critical rule matched).
  R6  medium:   HTTP status is 4xx and the anomaly score is >= 0.40.
  R7  medium:   error rate is >= 0.30 and the anomaly score is >= 0.40.
  R8  normal:   nothing above matched.
"""

from __future__ import annotations

LABEL_RULES_VERSION = "v1"

CLASSES = ("critical", "medium", "normal")

_LABEL_RULES_DOC = (
    "R1 critical: is_anomaly and anomaly_score >= 0.85; "
    "R2 critical: status_code >= 500 and anomaly_score >= 0.50; "
    "R3 critical: error_rate >= 0.80 and is_anomaly; "
    "R4 critical: exception_term == 1 and is_anomaly and anomaly_score >= 0.60; "
    "R5 medium: is_anomaly; "
    "R6 medium: status_code >= 400 and anomaly_score >= 0.40; "
    "R7 medium: error_rate >= 0.30 and anomaly_score >= 0.40; "
    "R8 normal: otherwise. "
    "Labels are rule-derived heuristics, not human-verified."
)


def label_event(
    *,
    anomaly_score: float,
    is_anomaly: bool,
    status_code: int | None,
    error_rate: float | None,
    exception_term: float | None,
) -> tuple[str, str]:
    """Return the (severity label, matched rule) for one evaluated event."""
    score = float(anomaly_score)
    error = float(error_rate) if error_rate is not None else 0.0
    exception = float(exception_term) if exception_term is not None else 0.0
    status = int(status_code) if status_code is not None else 0
    if is_anomaly and score >= 0.85:
        return "critical", "R1"
    if status >= 500 and score >= 0.50:
        return "critical", "R2"
    if error >= 0.80 and is_anomaly:
        return "critical", "R3"
    if exception == 1.0 and is_anomaly and score >= 0.60:
        return "critical", "R4"
    if is_anomaly:
        return "medium", "R5"
    if status >= 400 and score >= 0.40:
        return "medium", "R6"
    if error >= 0.30 and score >= 0.40:
        return "medium", "R7"
    return "normal", "R8"


def label_rules_doc() -> str:
    """One-paragraph description of the labelling rules, for metadata and docs."""
    return _LABEL_RULES_DOC

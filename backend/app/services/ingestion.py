from __future__ import annotations

import csv
import io
import json
import re
from collections import Counter
from datetime import UTC, datetime
from typing import Any

from app.core.exceptions import ValidationError

REQUIRED_COLUMNS = {
    "event_id", "timestamp", "service", "latency_ms", "error_rate", "cpu_pct",
    "memory_mb", "payload_bytes", "status_code",
}
OPTIONAL_COLUMNS = {"event_type", "source_ip", "message"}
_LEVEL_RE = re.compile(r"\b(CRITICAL|FATAL|ERROR|ERR|WARN|WARNING|INFO|DEBUG|TRACE)\b", re.I)
_IP_RE = re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b")
_SPARK_RE = re.compile(
    r"^(?P<date>\d{2}/\d{2}/\d{2})\s+(?P<time>\d{2}:\d{2}:\d{2})\s+"
    r"(?P<level>[A-Z]+)\s+(?P<component>[\w.$/-]+):?\s*(?P<message>.*)$"
)
_ISO_PREFIX_RE = re.compile(r"^\[?(?P<timestamp>\d{4}-\d\d-\d\d[T ][^\] ]+(?:Z|[+-]\d\d:\d\d)?)\]?\s*(?P<rest>.*)$")
_APACHE_DATE_RE = re.compile(r"\[(?P<timestamp>\d{2}/[A-Za-z]{3}/\d{4}:\d{2}:\d{2}:\d{2} [+-]\d{4})\]")
_GENERIC_FEATURES = (
    "message_length_bytes", "word_count", "digit_count", "punctuation_count",
    "uppercase_ratio", "severity_rank", "error_term", "warning_term",
    "exception_term", "component_frequency", "template_frequency", "rare_token_ratio",
)
_SEVERITY_RANK = {"TRACE": 0, "DEBUG": 1, "INFO": 2, "WARN": 3, "WARNING": 3, "ERROR": 4, "ERR": 4, "FATAL": 5, "CRITICAL": 5}


def parse_event_content(content: str, file_format: str) -> list[dict[str, Any]]:
    if not content.strip():
        raise ValidationError("Event log content cannot be empty.")
    normalized_format = file_format.upper()
    if normalized_format in {"LOG", "TEXT", "TXT"}:
        return _build_generic_events(_parse_text(content))
    if normalized_format == "JSONL":
        records = _parse_json_lines(content)
        return _build_generic_events(records) if not _has_telemetry_schema(records) else _validate_or_raise(records)
    if normalized_format == "JSON":
        records = _parse_json(content)
        return _build_generic_events(records) if not _has_telemetry_schema(records) else _validate_or_raise(records)
    if normalized_format == "CSV":
        records = _parse_csv(content)
        if _has_telemetry_schema(records):
            return _validate_or_raise(records)
        return _build_generic_events(records)
    raise ValidationError("Unsupported log format. Use CSV, JSON, JSONL, LOG, or TXT.")


def _validate_or_raise(raw_records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if len(raw_records) < 2:
        raise ValidationError("At least two valid event records are required for anomaly detection.")
    events, errors = _validate_records(raw_records)
    if errors:
        preview = "; ".join(errors[:10])
        suffix = f" (+{len(errors) - 10} more)" if len(errors) > 10 else ""
        raise ValidationError(f"Event validation failed: {preview}{suffix}")
    return events


def _has_telemetry_schema(records: list[dict[str, Any]]) -> bool:
    available_columns = set().union(*(set(record) for record in records)) if records else set()
    return REQUIRED_COLUMNS.issubset(available_columns)


def _parse_csv(content: str) -> list[dict[str, Any]]:
    try:
        reader = csv.DictReader(io.StringIO(content))
        if not reader.fieldnames:
            raise ValidationError("CSV must include a header row; upload headerless text logs as .log or .txt.")
        headers = {header.strip().lstrip("\ufeff").lower() for header in reader.fieldnames if header}
        recognized = headers.intersection({
            *REQUIRED_COLUMNS, *OPTIONAL_COLUMNS, "id", "lineid", "line_id", "date", "time",
            "level", "severity", "component", "logger", "host", "content", "log", "text", "raw",
        })
        if not recognized:
            raise ValidationError(
                "CSV header does not contain any recognized telemetry or log columns. "
                "Provide the required telemetry columns or standard log columns (e.g., timestamp, level, service, message), "
                "or upload plain text logs as .log or .txt."
            )
        return [
            {str(key).strip().lstrip("\ufeff").lower(): value for key, value in row.items() if key is not None}
            for row in reader if any(value not in (None, "") for value in row.values())
        ]
    except csv.Error as exc:
        raise ValidationError(f"Malformed CSV content: {exc}.") from exc


def _parse_json(content: str) -> list[dict[str, Any]]:
    try:
        payload = json.loads(content)
    except json.JSONDecodeError as exc:
        raise ValidationError(f"Malformed JSON content: {exc.msg} (line {exc.lineno}).") from exc
    records = payload if isinstance(payload, list) else payload.get("events") if isinstance(payload, dict) else None
    if isinstance(payload, dict) and records is None:
        records = [payload]
    if not isinstance(records, list):
        raise ValidationError('JSON must be an object, an array of events, or an object containing an "events" array.')
    if not all(isinstance(record, dict) for record in records):
        raise ValidationError("Every JSON event must be an object.")
    return [_flatten_fields({str(key).strip().lower(): value for key, value in record.items()}) for record in records]


def _parse_json_lines(content: str) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for line_number, line in enumerate(content.splitlines(), 1):
        if not line.strip():
            continue
        try:
            record = json.loads(line)
        except json.JSONDecodeError as exc:
            raise ValidationError(f"Malformed JSONL on line {line_number}: {exc.msg}.") from exc
        if not isinstance(record, dict):
            raise ValidationError(f"JSONL line {line_number} must contain an object.")
        records.append(_flatten_fields({str(key).strip().lower(): value for key, value in record.items()}))
    return records


def _parse_text(content: str) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for raw_line in content.splitlines():
        if not raw_line.strip():
            continue
        if records and (raw_line[:1].isspace() or raw_line.lstrip().startswith(("at ", "Caused by:", "... "))):
            records[-1]["message"] += "\n" + raw_line.rstrip()
            continue
        records.append(_parse_text_line(raw_line.rstrip()))
    return records


def _parse_text_line(line: str) -> dict[str, Any]:
    timestamp: str | None = None
    severity: str | None = None
    component: str | None = None
    message = line
    spark = _SPARK_RE.match(line)
    if spark:
        timestamp = _try_timestamp(f"{spark.group('date')} {spark.group('time')}")
        severity = spark.group("level").upper()
        component = spark.group("component")
        message = spark.group("message") or line
    else:
        apache_date = _APACHE_DATE_RE.search(line)
        if apache_date:
            timestamp = _try_timestamp(apache_date.group("timestamp"))
        iso = _ISO_PREFIX_RE.match(line)
        remainder = line
        if iso:
            timestamp = _try_timestamp(iso.group("timestamp"))
            remainder = iso.group("rest")
        level = _LEVEL_RE.search(remainder)
        if level:
            severity = level.group(1).upper()
            after_level = remainder[level.end():].strip(" :-[]")
            component_match = re.match(r"(?P<component>[\w.$/-]+)(?::\s*|\s+-\s+)(?P<message>.*)$", after_level)
            if component_match:
                component = component_match.group("component")
                message = component_match.group("message") or after_level
            else:
                message = after_level or remainder
    status = re.search(r"\b(?:status(?:_code)?\s*[=:]\s*|HTTP/\d(?:\.\d)?\"?\s+)(\d{3})\b", line, re.I)
    latency = re.search(r"\b(?:latency_ms|duration_ms|elapsed_ms)\s*[=:]\s*(\d+(?:\.\d+)?)", line, re.I)
    cpu = re.search(r"\b(?:cpu|cpu_pct|cpu_usage)\s*[=:]\s*(\d+(?:\.\d+)?)\s*%?", line, re.I)
    memory = re.search(r"\b(?:memory_mb|memory|mem)\s*[=:]\s*(\d+(?:\.\d+)?)\s*(MB|GB)?", line, re.I)
    payload = re.search(r"\b(?:payload_bytes|bytes|size_bytes)\s*[=:]\s*(\d+(?:\.\d+)?)", line, re.I)
    error_rate = re.search(r"\berror_rate\s*[=:]\s*(\d+(?:\.\d+)?)", line, re.I)
    memory_value = float(memory.group(1)) * (1024 if memory.group(2) and memory.group(2).upper() == "GB" else 1) if memory else None
    component_field = re.search(r"\b(?:service|component|logger)\s*[=:]\s*([\w.$/-]+)", line, re.I)
    timestamp_field = re.search(r"\b(?:timestamp|datetime|time)\s*[=:]\s*([^,\s]+)", line, re.I)
    return {
        "event_id": "",
        "timestamp": timestamp or (_try_timestamp(timestamp_field.group(1)) if timestamp_field else None),
        "service": component or (component_field.group(1) if component_field else "unclassified"),
        "event_type": severity or "LOG",
        "level": severity,
        "source_ip": _first_ip(line),
        "message": message,
        "status_code": int(status.group(1)) if status else None,
        "latency_ms": float(latency.group(1)) if latency else None,
        "cpu_pct": float(cpu.group(1)) if cpu else None,
        "memory_mb": memory_value,
        "payload_bytes": float(payload.group(1)) if payload else None,
        "error_rate": float(error_rate.group(1)) if error_rate else None,
    }


def _build_generic_events(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if len(records) < 2:
        raise ValidationError("At least two log records are required for anomaly detection.")
    events: list[dict[str, Any]] = []
    for index, raw in enumerate(records, 1):
        record = _flatten_fields({str(key).strip().lower(): value for key, value in raw.items()})
        message_value = _first_value(record, ("message", "content", "log", "raw", "text", "event_template", "eventtemplate", "description"))
        message = str(message_value) if message_value not in (None, "") else json.dumps(record, ensure_ascii=False, sort_keys=True, default=str)
        level_value = _first_value(record, ("level", "log.level", "severity", "log_level", "loglevel", "priority"))
        level = str(level_value).strip().upper() if level_value not in (None, "") else None
        if not level:
            match = _LEVEL_RE.search(message)
            level = match.group(1).upper() if match else None
        service_value = _first_value(record, ("service", "service.name", "component", "logger", "log.logger", "host", "host.name", "source", "application", "module"))
        service = str(service_value).strip() if service_value not in (None, "") else "unclassified"
        event_id_value = _first_value(record, ("event_id", "event.id", "id", "line_id", "lineid", "row_id"))
        date_value = _first_value(record, ("timestamp", "@timestamp", "event.created", "datetime", "date_time", "time"))
        if date_value in (None, "") and record.get("date") not in (None, ""):
            date_value = f"{record['date']} {record.get('time', '')}".strip()
        timestamp = _try_timestamp(str(date_value)) if date_value not in (None, "") else None
        event_type_value = _first_value(record, ("event_type", "event.action", "event.category", "type", "category"))
        event_type = str(event_type_value).strip() if event_type_value not in (None, "") else (level or "LOG")
        source_ip_value = _first_value(record, ("source_ip", "source.ip", "src_ip", "ip", "client_ip"))
        source_ip = str(source_ip_value).strip() if source_ip_value not in (None, "") else (_first_ip(message) or "")
        events.append({
            "event_id": str(event_id_value).strip() if event_id_value not in (None, "") else f"line_{index}",
            "timestamp": timestamp,
            "service": service,
            "event_type": event_type,
            "source_ip": source_ip,
            "latency_ms": _optional_number(record.get("latency_ms")),
            "error_rate": _optional_number(record.get("error_rate")),
            "cpu_pct": _optional_number(record.get("cpu_pct")),
            "memory_mb": _optional_number(record.get("memory_mb")),
            "payload_bytes": _optional_number(record.get("payload_bytes")),
            "status_code": _optional_int(_first_value(record, ("status_code", "http.response.status_code", "status"))),
            "message": message,
            "_severity": level,
        })
    _add_generic_features(events)
    for event in events:
        event.pop("_severity", None)
    return events


def _add_generic_features(events: list[dict[str, Any]]) -> None:
    service_counts = Counter(event["service"] for event in events)
    templates = [_template(event["message"]) for event in events]
    template_counts = Counter(templates)
    token_sets = [set(re.findall(r"[a-zA-Z_][a-zA-Z_0-9]{1,}", event["message"].lower())) for event in events]
    token_document_frequency = Counter(token for tokens in token_sets for token in tokens)
    previous_timestamp: datetime | None = None
    for event, template, tokens in zip(events, templates, token_sets):
        message = event["message"]
        severity = event["_severity"]
        parsed_timestamp = datetime.fromisoformat(event["timestamp"].replace("Z", "+00:00")) if event["timestamp"] else None
        time_gap = (parsed_timestamp - previous_timestamp).total_seconds() if parsed_timestamp and previous_timestamp else None
        if parsed_timestamp:
            previous_timestamp = parsed_timestamp
        features: dict[str, float | None] = {
            "message_length_bytes": len(message.encode("utf-8")),
            "word_count": len(re.findall(r"\w+", message)),
            "digit_count": sum(char.isdigit() for char in message),
            "punctuation_count": sum(not char.isalnum() and not char.isspace() for char in message),
            "uppercase_ratio": sum(char.isupper() for char in message) / max(1, sum(char.isalpha() for char in message)),
            "severity_rank": float(_SEVERITY_RANK[severity]) if severity in _SEVERITY_RANK else None,
            "error_term": float(bool(re.search(r"\b(error|failed|failure|fatal|critical)\b", message, re.I))),
            "warning_term": float(bool(re.search(r"\b(warn|warning|retry|degraded)\b", message, re.I))),
            "exception_term": float(bool(re.search(r"\b(exception|traceback|stacktrace|caused by)\b", message, re.I))),
            "component_frequency": service_counts[event["service"]] / len(events),
            "template_frequency": template_counts[template] / len(events),
            "rare_token_ratio": sum(1 / token_document_frequency[token] for token in tokens) / max(1, len(tokens)),
            "timestamp_gap_seconds": time_gap,
        }
        for field in ("latency_ms", "error_rate", "cpu_pct", "memory_mb", "payload_bytes"):
            value = event.get(field)
            if value is not None:
                features[field] = float(value)
        if event.get("status_code") is not None:
            features["status_error_indicator"] = float(event["status_code"] >= 400)
        event["log_features"] = features


def _template(message: str) -> str:
    return re.sub(r"\b\d+(?:\.\d+)?\b", "#", re.sub(_IP_RE, "<ip>", message.lower()))


def _first_value(record: dict[str, Any], aliases: tuple[str, ...]) -> Any:
    return next((record[key] for key in aliases if key in record and record[key] not in (None, "")), None)


def _flatten_fields(record: dict[str, Any], prefix: str = "") -> dict[str, Any]:
    flattened: dict[str, Any] = {}
    for key, value in record.items():
        normalized = str(key).strip().lower()
        full_key = f"{prefix}.{normalized}" if prefix else normalized
        flattened[full_key] = value
        if isinstance(value, dict):
            flattened.update(_flatten_fields(value, full_key))
    return flattened


def _first_ip(value: str) -> str | None:
    match = _IP_RE.search(value)
    return match.group(0) if match else None


def _optional_number(value: Any) -> float | None:
    if value in (None, ""):
        return None
    try:
        number = float(value)
        return number if number == number and number not in (float("inf"), float("-inf")) else None
    except (TypeError, ValueError):
        return None


def _optional_int(value: Any) -> int | None:
    number = _optional_number(value)
    return int(number) if number is not None else None


def _try_timestamp(value: Any) -> str | None:
    text = str(value).strip() if value is not None else ""
    if not text:
        return None
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        parsed = None
        for pattern in ("%y/%m/%d %H:%M:%S", "%Y/%m/%d %H:%M:%S", "%d/%m/%y %H:%M:%S", "%Y-%m-%d %H:%M:%S,%f", "%Y-%m-%d %H:%M:%S", "%d/%b/%Y:%H:%M:%S %z"):
            try:
                parsed = datetime.strptime(text, pattern)
                break
            except ValueError:
                continue
        if parsed is None:
            return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC).isoformat().replace("+00:00", "Z")


def _validate_records(raw_records: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[str]]:
    events: list[dict[str, Any]] = []
    errors: list[str] = []
    seen_ids: set[str] = set()
    for index, raw in enumerate(raw_records, start=1):
        missing = REQUIRED_COLUMNS - set(raw)
        if missing:
            errors.append(f"record {index}: missing fields {', '.join(sorted(missing))}")
            continue
        try:
            event_id = _required_string(raw["event_id"], "event_id")
            if event_id in seen_ids:
                raise ValueError("event_id must be unique within an analysis run")
            seen_ids.add(event_id)
            timestamp = _normalize_timestamp(raw["timestamp"])
            service = _required_string(raw["service"], "service")
            events.append({
                "event_id": event_id,
                "timestamp": timestamp,
                "service": service,
                "event_type": str(raw.get("event_type") or "UNSPECIFIED").strip() or "UNSPECIFIED",
                "source_ip": str(raw.get("source_ip") or "").strip(),
                "latency_ms": _number(raw["latency_ms"], "latency_ms", minimum=0),
                "error_rate": _number(raw["error_rate"], "error_rate", minimum=0, maximum=1),
                "cpu_pct": _number(raw["cpu_pct"], "cpu_pct", minimum=0, maximum=100),
                "memory_mb": _number(raw["memory_mb"], "memory_mb", minimum=0),
                "payload_bytes": _number(raw["payload_bytes"], "payload_bytes", minimum=0),
                "status_code": int(_number(raw["status_code"], "status_code", minimum=100, maximum=599)),
                **({"message": str(raw["message"])} if raw.get("message") not in (None, "") else {}),
            })
        except (TypeError, ValueError) as exc:
            errors.append(f"record {index}: {exc}")
    return events, errors


def _required_string(value: Any, field: str) -> str:
    result = str(value).strip() if value is not None else ""
    if not result:
        raise ValueError(f"{field} must be a non-empty string")
    return result


def _number(value: Any, field: str, minimum: float, maximum: float | None = None) -> float:
    try:
        result = float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{field} must be numeric") from exc
    if not result == result or result in (float("inf"), float("-inf")):
        raise ValueError(f"{field} must be finite")
    if result < minimum or (maximum is not None and result > maximum):
        range_text = f"between {minimum} and {maximum}" if maximum is not None else f">= {minimum}"
        raise ValueError(f"{field} must be {range_text}")
    return result


def _normalize_timestamp(value: Any) -> str:
    text = _required_string(value, "timestamp")
    normalized = _try_timestamp(text)
    if normalized is None:
        raise ValueError("timestamp must be ISO-8601")
    return normalized

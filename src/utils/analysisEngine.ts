import {
  AnalysisConfig,
  AnalysisRun,
  EvaluatedEventRecord,
  LogFileFormat,
  RawEventLogRecord,
  SeverityLevel,
} from '../types/tracemind';

export const DEFAULT_ANALYSIS_CONFIG: AnalysisConfig = {
  contamination: 0.12,
  n_estimators: 100,
  swarm_size: 30,
  max_iterations: 25,
  inertia_weight: 0.72,
  cognitive_coeff: 1.49,
  social_coeff: 1.49,
};

export const MAX_UPLOAD_FILE_BYTES = 25 * 1024 * 1024; // Matches the backend limit.
const REQUIRED_TELEMETRY_COLUMNS = [
  'event_id', 'timestamp', 'service', 'latency_ms', 'error_rate', 'cpu_pct',
  'memory_mb', 'payload_bytes', 'status_code',
];
const RECOGNIZED_LOG_COLUMNS = new Set([
  ...REQUIRED_TELEMETRY_COLUMNS, 'event_type', 'source_ip', 'message', 'id', 'lineid',
  'line_id', 'date', 'time', 'datetime', 'level', 'severity', 'component', 'logger',
  'host', 'content', 'log', 'text', 'raw', 'eventtemplate', 'event_template',
]);

/**
 * Validates an uploaded File object for supported extension and size limits.
 */
export function validateUploadFile(file: File): {
  valid: boolean;
  detectedFormat?: LogFileFormat;
  error?: string;
} {
  if (!file) {
    return { valid: false, error: 'No file selected.' };
  }
  if (file.size === 0) {
    return { valid: false, error: `Selected file "${file.name}" is empty (0 bytes).` };
  }
  if (file.size > MAX_UPLOAD_FILE_BYTES) {
    return {
      valid: false,
      error: `File "${file.name}" exceeds the 25 MB maximum upload limit.`,
    };
  }
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.json') || file.type === 'application/json') {
    return { valid: true, detectedFormat: 'JSON' };
  }
  if (lower.endsWith('.jsonl') || lower.endsWith('.ndjson')) {
    return { valid: true, detectedFormat: 'JSONL' };
  }
  if (lower.endsWith('.csv') || file.type === 'text/csv') {
    return { valid: true, detectedFormat: 'CSV' };
  }
  if (/\.(log|txt|out|syslog|trace)$/i.test(file.name) || file.type.startsWith('text/')) {
    return { valid: true, detectedFormat: 'LOG' };
  }
  return {
    valid: false,
    error: `Unsupported file type for "${file.name}". Upload a text log, CSV, JSON, or JSONL file.`,
  };
}

/**
 * Parses common structured and plain-text logs for pre-upload validation and preview.
 * Throws a descriptive error if input is empty or malformed.
 */
export function parseEventLogContent(
  rawText: string,
  formatHint?: LogFileFormat
): { records: RawEventLogRecord[]; detectedFormat: LogFileFormat } {
  const trimmed = rawText.trim();
  if (!trimmed) {
    throw new Error(
      'Log content cannot be empty. Upload a supported text log, CSV, JSON, or JSONL file.'
    );
  }

  const isLikelyJsonLines = formatHint === 'JSONL';
  const isLikelyJson = formatHint === 'JSON' || (!formatHint && (trimmed.startsWith('[') || trimmed.startsWith('{')));

  if (formatHint === 'LOG') return parsePlainTextLogs(trimmed);

  if (isLikelyJsonLines) {
    const items = trimmed.split(/\r?\n/).filter((line) => line.trim());
    const parsed = items.map((line, index) => {
      try { return JSON.parse(line) as Record<string, unknown>; }
      catch (error) { throw new Error(`Invalid JSONL on line ${index + 1}: ${error instanceof Error ? error.message : 'Invalid JSON'}`, { cause: error }); }
    });
    return { records: normalizeRecords(parsed), detectedFormat: 'JSONL' };
  }

  if (isLikelyJson) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch (err) {
      throw new Error(
        `Invalid JSON syntax: ${err instanceof Error ? err.message : 'Unable to parse JSON payload'}`,
        { cause: err }
      );
    }

    const rawArray = Array.isArray(parsed)
      ? parsed
      : parsed &&
        typeof parsed === 'object' &&
        Array.isArray((parsed as Record<string, unknown>).events)
      ? ((parsed as Record<string, unknown>).events as unknown[])
      : parsed && typeof parsed === 'object' ? [parsed] : null;

    if (!rawArray || rawArray.length === 0) {
      throw new Error(
        'JSON log must be a non-empty array of event objects or an object with an "events" array.'
      );
    }

    const rawRecords = rawArray as Record<string, unknown>[];
    const records = normalizeRecords(rawRecords);
    return { records, detectedFormat: 'JSON' };
  }

  const rows = parseCsvRows(trimmed).filter((row) => row.some((cell) => cell.trim()));
  if (rows.length < 2) {
    throw new Error(
      'Log input must contain at least two records.'
    );
  }

  const headers = rows[0].map((header) => header.trim().replace(/^\uFEFF/, '').toLowerCase());
  const recognized = headers.some((header) => RECOGNIZED_LOG_COLUMNS.has(header));
  if (!recognized) return parsePlainTextLogs(trimmed);
  const objects = rows.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
  return { records: normalizeRecords(objects), detectedFormat: 'CSV' };
}

function normalizeRecords(rawRecords: Record<string, unknown>[]): RawEventLogRecord[] {
  if (!rawRecords.length) throw new Error('No log records were found.');
  const telemetry = REQUIRED_TELEMETRY_COLUMNS.every((field) => rawRecords.some((record) => field in record));
  if (telemetry) {
    rawRecords.forEach((record, index) => {
      const missing = REQUIRED_TELEMETRY_COLUMNS.filter((field) => record[field] === undefined || record[field] === null || record[field] === '');
      if (missing.length) throw new Error(`Event record ${index + 1} is missing required fields: ${missing.join(', ')}.`);
    });
  }
  return rawRecords.map((record, index) => telemetry ? validateRawRecord(record, index) : genericPreviewRecord(record, index));
}

function genericPreviewRecord(raw: Record<string, unknown>, index: number): RawEventLogRecord {
  const get = (...keys: string[]) => keys.map((key) => raw[key]).find((value) => value !== undefined && value !== null && value !== '');
  const numberOrNull = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  };
  const explicitTimestamp = get('timestamp', 'datetime', 'date_time');
  const timestamp = explicitTimestamp ?? (get('date') && get('time') ? `${get('date')} ${get('time')}` : get('time'));
  return {
    event_id: String(get('event_id', 'id', 'line_id', 'lineid', 'row_id') ?? `line_${index + 1}`),
    timestamp: String(timestamp ?? ''),
    service: String(get('service', 'component', 'logger', 'host', 'source', 'application', 'module') ?? 'unclassified'),
    event_type: String(get('event_type', 'type', 'category', 'level', 'severity') ?? 'LOG'),
    source_ip: String(get('source_ip', 'src_ip', 'ip', 'client_ip') ?? ''),
    latency_ms: numberOrNull(get('latency_ms', 'latency')),
    error_rate: numberOrNull(get('error_rate', 'err_rate')),
    cpu_pct: numberOrNull(get('cpu_pct', 'cpu')),
    memory_mb: numberOrNull(get('memory_mb', 'memory')),
    payload_bytes: numberOrNull(get('payload_bytes', 'bytes')),
    status_code: numberOrNull(get('status_code', 'status')),
    message: String(get('message', 'content', 'log', 'raw', 'text', 'event_template', 'eventtemplate', 'description') ?? JSON.stringify(raw)),
  };
}

function parsePlainTextLogs(text: string): { records: RawEventLogRecord[]; detectedFormat: LogFileFormat } {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  const logicalLines: string[] = [];
  for (const line of lines) {
    if (logicalLines.length && (/^\s/.test(line) || /^\s*(?:at |Caused by:|\.\.\. \d+ more)/.test(line))) logicalLines[logicalLines.length - 1] += `\n${line}`;
    else logicalLines.push(line);
  }
  if (logicalLines.length < 2) throw new Error('At least two log records are required for analysis.');
  const records = logicalLines.map((line, index) => {
    const spark = line.match(/^(\d{2}\/\d{2}\/\d{2})\s+(\d{2}:\d{2}:\d{2})\s+([A-Z]+)\s+([\w.$/-]+):?\s*(.*)$/);
    const level = spark?.[3] ?? line.match(/\b(CRITICAL|FATAL|ERROR|ERR|WARN|WARNING|INFO|DEBUG|TRACE)\b/i)?.[1];
    const timestamp = spark ? `${spark[1]} ${spark[2]}` : line.match(/^\[?(\d{4}-\d\d-\d\d[T ][^\] ]+)/)?.[1] ?? '';
    const service = spark?.[4] ?? line.match(/\b(?:INFO|ERROR|WARN|DEBUG|TRACE)\s+([\w.$/-]+):/i)?.[1] ?? 'unclassified';
    return genericPreviewRecord({
      event_id: `line_${index + 1}`, message: spark?.[5] || line,
      event_type: level ?? 'LOG', timestamp, service,
    }, index);
  });
  return { records, detectedFormat: 'LOG' };
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      row.push(current); current = '';
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(current); current = '';
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
    } else {
      current += ch;
    }
  }
  row.push(current);
  if (row.some((cell) => cell.trim())) rows.push(row);
  if (inQuotes) throw new Error('Malformed CSV: an opening quote was not closed.');
  return rows;
}

function validateRawRecord(raw: Record<string, unknown>, index: number): RawEventLogRecord {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`Event record at index ${index} is not a valid object.`);
  }

  const toNumber = (val: unknown, fallback: number): number => {
    if (typeof val === 'number' && Number.isFinite(val)) return val;
    if (typeof val === 'string' && val.trim() !== '') {
      const n = Number(val);
      if (Number.isFinite(n)) return n;
    }
    return fallback;
  };

  return {
    event_id: String(raw.event_id || raw.id || `row_${index + 1}`),
    timestamp: String(raw.timestamp || raw.time || ''),
    service: String(raw.service || raw.component || 'unknown'),
    event_type: String(raw.event_type || raw.type || 'UNKNOWN'),
    source_ip: String(raw.source_ip || raw.ip || ''),
    latency_ms: Math.max(0, toNumber(raw.latency_ms ?? raw.latency, 0)),
    error_rate: Math.max(0, Math.min(1, toNumber(raw.error_rate ?? raw.err_rate, 0))),
    cpu_pct: Math.max(0, Math.min(100, toNumber(raw.cpu_pct ?? raw.cpu, 0))),
    memory_mb: Math.max(0, toNumber(raw.memory_mb ?? raw.memory, 0)),
    payload_bytes: Math.max(0, toNumber(raw.payload_bytes ?? raw.bytes, 0)),
    status_code: Math.round(toNumber(raw.status_code ?? raw.status, 200)),
    message: raw.message ? String(raw.message) : undefined,
  };
}

/**
 * Validates and normalizes an AnalysisRun response payload from the backend API.
 * Ensures partial optional arrays do not crash the UI, while rejecting payloads
 * that are missing core backend structures. Never fabricates replacement metrics.
 */
export function validateAnalysisRunResponse(payload: unknown): AnalysisRun {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Invalid backend response: expected an AnalysisRun JSON object.');
  }

  const obj = payload as Record<string, unknown>;
  if (typeof obj.run_id !== 'string' || !obj.run_id.trim()) {
    throw new Error('Invalid backend response: missing required "run_id" field.');
  }
  if (!obj.isolation_forest || typeof obj.isolation_forest !== 'object') {
    throw new Error('Invalid backend response: missing "isolation_forest" results object.');
  }
  if (!obj.pso_optimization || typeof obj.pso_optimization !== 'object') {
    throw new Error('Invalid backend response: missing "pso_optimization" results object.');
  }
  if (!obj.agent_recommendation || typeof obj.agent_recommendation !== 'object') {
    throw new Error('Invalid backend response: missing "agent_recommendation" results object.');
  }

  const iforest = obj.isolation_forest as Record<string, unknown>;
  const pso = obj.pso_optimization as Record<string, unknown>;
  const agent = obj.agent_recommendation as Record<string, unknown>;

  return {
    ...(obj as unknown as AnalysisRun),
    data_source: 'live_api',
    events: Array.isArray(obj.events)
      ? (obj.events as EvaluatedEventRecord[]).map((ev) => ({
          ...ev,
          feature_contributions: Array.isArray(ev.feature_contributions)
            ? ev.feature_contributions
            : [],
        }))
      : [],
    isolation_forest: {
      ...(iforest as unknown as AnalysisRun['isolation_forest']),
      score_distribution: Array.isArray(iforest.score_distribution)
        ? (iforest.score_distribution as AnalysisRun['isolation_forest']['score_distribution'])
        : [],
      feature_importances: Array.isArray(iforest.feature_importances)
        ? (iforest.feature_importances as AnalysisRun['isolation_forest']['feature_importances'])
        : [],
    },
    pso_optimization: {
      ...(pso as unknown as AnalysisRun['pso_optimization']),
      candidate_actions: Array.isArray(pso.candidate_actions)
        ? (pso.candidate_actions as AnalysisRun['pso_optimization']['candidate_actions'])
        : [],
      convergence_history: Array.isArray(pso.convergence_history)
        ? (pso.convergence_history as AnalysisRun['pso_optimization']['convergence_history'])
        : [],
    },
    agent_recommendation: {
      ...(agent as unknown as AnalysisRun['agent_recommendation']),
      affected_services: Array.isArray(agent.affected_services)
        ? (agent.affected_services as string[])
        : [],
      execution_steps: Array.isArray(agent.execution_steps)
        ? (agent.execution_steps as AnalysisRun['agent_recommendation']['execution_steps'])
        : [],
      guardrails_checked: Array.isArray(agent.guardrails_checked)
        ? (agent.guardrails_checked as AnalysisRun['agent_recommendation']['guardrails_checked'])
        : [],
    },
  };
}

/**
 * Pure filtering and sorting helper for the Anomalous Events table.
 * Operates exclusively on actual event records returned by the backend.
 */
export function filterAndSortEvents(
  events: EvaluatedEventRecord[],
  options: {
    searchQuery: string;
    onlyAnomalies: boolean;
    severityFilter: 'all' | SeverityLevel;
    serviceFilter: string;
    sortBy: 'anomaly_score' | 'latency_ms' | 'error_rate' | 'cpu_pct' | 'timestamp';
    sortDirection: 'asc' | 'desc';
  }
): EvaluatedEventRecord[] {
  const q = options.searchQuery.trim().toLowerCase();

  const filtered = events.filter((ev) => {
    if (options.onlyAnomalies && !ev.is_anomaly) return false;
    if (options.severityFilter !== 'all' && ev.severity !== options.severityFilter) return false;
    if (options.serviceFilter !== 'all' && ev.service !== options.serviceFilter) return false;
    if (q) {
      const hay = `${ev.event_id} ${ev.service} ${ev.event_type} ${ev.source_ip} ${ev.primary_driver} ${ev.message || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return filtered.sort((a, b) => {
    const cmp =
      options.sortBy === 'timestamp'
        ? (a.timestamp ?? '').localeCompare(b.timestamp ?? '')
        : Number(a[options.sortBy]) - Number(b[options.sortBy]);
    return options.sortDirection === 'asc' ? cmp : -cmp;
  });
}

/**
 * Generates a downloadable CSV string from evaluated event records returned by the backend.
 */
export function exportEventsToCsv(events: EvaluatedEventRecord[]): string {
  const headers = [
    'event_id',
    'timestamp',
    'service',
    'event_type',
    'source_ip',
    'latency_ms',
    'error_rate',
    'cpu_pct',
    'memory_mb',
    'status_code',
    'anomaly_score',
    'isolation_depth',
    'is_anomaly',
    'severity',
    'primary_driver',
  ];
  const rows = events.map((e) =>
    [
      e.event_id,
      e.timestamp,
      e.service,
      e.event_type,
      e.source_ip,
      e.latency_ms,
      e.error_rate,
      e.cpu_pct,
      e.memory_mb,
      e.status_code,
      e.anomaly_score,
      e.isolation_depth,
      e.is_anomaly,
      e.severity,
      e.primary_driver,
    ].join(',')
  );
  return [headers.join(','), ...rows].join('\n');
}

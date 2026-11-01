import {
  AnalysisConfig,
  AnalysisRun,
  EvaluatedEventRecord,
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

export const MAX_UPLOAD_FILE_BYTES = 15 * 1024 * 1024; // 15 MB

/**
 * Validates an uploaded File object for supported extension and size limits.
 */
export function validateUploadFile(file: File): {
  valid: boolean;
  detectedFormat?: 'CSV' | 'JSON';
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
      error: `File "${file.name}" exceeds the 15 MB maximum upload limit.`,
    };
  }
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.json') || file.type === 'application/json') {
    return { valid: true, detectedFormat: 'JSON' };
  }
  if (lower.endsWith('.csv') || file.type === 'text/csv') {
    return { valid: true, detectedFormat: 'CSV' };
  }
  return {
    valid: false,
    error: `Unsupported file type for "${file.name}". Please upload a .csv or .json event log.`,
  };
}

/**
 * Parses CSV or JSON event log content on the client strictly for pre-upload structural
 * validation and previewing record count/services before sending to the backend.
 * Throws a descriptive error if input is empty or malformed.
 */
export function parseEventLogContent(
  rawText: string,
  formatHint?: 'CSV' | 'JSON'
): { records: RawEventLogRecord[]; detectedFormat: 'CSV' | 'JSON' } {
  const trimmed = rawText.trim();
  if (!trimmed) {
    throw new Error(
      'Event log content cannot be empty. Please upload or paste a valid CSV or JSON event log.'
    );
  }

  const isLikelyJson =
    formatHint === 'JSON' ||
    (!formatHint && (trimmed.startsWith('[') || trimmed.startsWith('{')));

  if (isLikelyJson) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch (err) {
      throw new Error(
        `Invalid JSON syntax: ${err instanceof Error ? err.message : 'Unable to parse JSON payload'}`
      );
    }

    const rawArray = Array.isArray(parsed)
      ? parsed
      : parsed &&
        typeof parsed === 'object' &&
        Array.isArray((parsed as Record<string, unknown>).events)
      ? ((parsed as Record<string, unknown>).events as unknown[])
      : null;

    if (!rawArray || rawArray.length === 0) {
      throw new Error(
        'JSON log must be a non-empty array of event objects or an object with an "events" array.'
      );
    }

    const records: RawEventLogRecord[] = rawArray.map((item, idx) =>
      validateRawRecord(item as Record<string, unknown>, idx)
    );
    return { records, detectedFormat: 'JSON' };
  }

  // CSV validation
  const lines = trimmed
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));

  if (lines.length < 2) {
    throw new Error(
      'CSV event log must include a header row and at least one event record row.'
    );
  }

  const headers = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const requiredAny = ['event_id', 'service', 'latency_ms', 'error_rate', 'cpu_pct'];
  const hasRecognizedColumn = requiredAny.some((col) => headers.includes(col));
  if (!hasRecognizedColumn) {
    throw new Error(
      `CSV header is missing required telemetry columns (expected columns such as: ${requiredAny.join(', ')}).`
    );
  }

  const records: RawEventLogRecord[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = splitCsvLine(lines[i]);
    if (values.length === 1 && values[0] === '') continue;
    const rowObj: Record<string, unknown> = {};
    headers.forEach((h, colIdx) => {
      rowObj[h] = values[colIdx] !== undefined ? values[colIdx].trim() : '';
    });
    records.push(validateRawRecord(rowObj, i - 1));
  }

  if (records.length === 0) {
    throw new Error('No valid event rows found in CSV input.');
  }

  return { records, detectedFormat: 'CSV' };
}

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
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
    let cmp = 0;
    if (options.sortBy === 'timestamp') {
      cmp = a.timestamp.localeCompare(b.timestamp);
    } else {
      cmp = Number(a[options.sortBy]) - Number(b[options.sortBy]);
    }
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

import { BackendEndpointSpec } from '../types/tracemind';

const rawEnvBaseUrl = import.meta.env?.VITE_API_BASE_URL;

export const API_CONFIG = {
  /**
   * Configured via VITE_API_BASE_URL (e.g. "http://localhost:8000/api" or "/api").
   * Falls back to "/api" relative proxy path when VITE_API_BASE_URL is not explicitly set.
   */
  baseUrl:
    typeof rawEnvBaseUrl === 'string' && rawEnvBaseUrl.trim().length > 0
      ? rawEnvBaseUrl.trim().replace(/\/$/, '')
      : '/api',
  hasExplicitEnvConfig:
    typeof rawEnvBaseUrl === 'string' && rawEnvBaseUrl.trim().length > 0,
  defaultTimeoutMs: 10000,
  healthTimeoutMs: 3500,
  endpoints: {
    health: '/health',
    analyze: '/analyze',
    history: '/history',
    historyDetail: (runId: string) => `/history/${encodeURIComponent(runId)}`,
    runEvents: (runId: string) => `/history/${encodeURIComponent(runId)}/events`,
  },
} as const;

export const DOCUMENTED_BACKEND_ENDPOINTS: BackendEndpointSpec[] = [
  {
    method: 'GET',
    path: `${API_CONFIG.baseUrl}/health`,
    integrationStatus: 'integrated',
    description:
      'Verifies FastAPI service status, SQLite database readiness, and loaded ML pipeline components.',
    responseSchema:
      '{ "status": "ok", "database": "sqlite_connected", "models": ["IsolationForest", "PSO", "IntelligentAgent"] }',
  },
  {
    method: 'POST',
    path: `${API_CONFIG.baseUrl}/analyze`,
    integrationStatus: 'integrated',
    description:
      'Uploads a CSV/JSON event-log file or payload with Isolation Forest & PSO parameters and returns the computed AnalysisRun.',
    requestSchema:
      'multipart/form-data (file, dataset_name, format, config) OR application/json { "dataset_name": string, "format": "CSV"|"JSON", "content": string, "config": AnalysisConfig }',
    responseSchema:
      'AnalysisRun (run_id, isolation_forest, pso_optimization, agent_recommendation, events[])',
  },
  {
    method: 'GET',
    path: `${API_CONFIG.baseUrl}/history`,
    integrationStatus: 'integrated',
    description:
      'Fetches persisted analysis runs and summary reports from the SQLite database.',
    responseSchema: '{ "runs": AnalysisRun[] } | AnalysisRun[]',
  },
  {
    method: 'GET',
    path: `${API_CONFIG.baseUrl}/history/:run_id`,
    integrationStatus: 'integrated',
    description:
      'Retrieves the full event-level Isolation Forest, PSO, and Intelligent Agent report for a specific historical run.',
    responseSchema: 'AnalysisRun',
  },
  {
    method: 'DELETE',
    path: `${API_CONFIG.baseUrl}/history/:run_id`,
    integrationStatus: 'awaiting_backend_confirmation',
    description:
      'Deletes a persisted analysis run record from SQLite (requires backend route confirmation).',
    responseSchema: '{ "deleted": true, "run_id": string }',
    notes: 'Awaiting backend route confirmation from FastAPI team.',
  },
  {
    method: 'POST',
    path: `${API_CONFIG.baseUrl}/actions/simulate`,
    integrationStatus: 'awaiting_backend_confirmation',
    description:
      'Executes a server-side dry-run simulation of the PSO-selected remediation action.',
    requestSchema: '{ "run_id": string, "action_id": string }',
    responseSchema: '{ "simulated": true, "verified_steps": number[] }',
    notes:
      'Not yet implemented on backend; action simulation button is disabled in UI until backend endpoint is confirmed.',
  },
];

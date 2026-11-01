import { API_CONFIG } from '../../config/api';
import { ApiConnectionState } from '../../types/tracemind';
import { apiRequest } from './client';
import { submitEventLogAnalysis } from './analysis';
import {
  deleteAnalysisRunById,
  fetchAnalysisById,
  fetchAnalysisHistory,
} from './history';
import { fetchRunEvents } from './events';

export interface BackendHealthStatus {
  state: ApiConnectionState;
  reachable: boolean;
  endpointUrl: string;
  latencyMs: number | null;
  message: string;
  checkedAt: string;
}

/**
 * Checks the backend health endpoint (GET /health) and returns the real connection status.
 */
export async function checkBackendHealth(
  signal?: AbortSignal
): Promise<BackendHealthStatus> {
  const endpointUrl = `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.health}`;
  const start = performance.now();

  try {
    const data = await apiRequest<Record<string, unknown>>(
      API_CONFIG.endpoints.health,
      {
        method: 'GET',
        timeoutMs: API_CONFIG.healthTimeoutMs,
        signal,
      }
    );

    if (data && (data.status === 'ok' || data.healthy === true)) {
      return {
        state: 'connected',
        reachable: true,
        endpointUrl,
        latencyMs: Math.round(performance.now() - start),
        message: `Connected to FastAPI backend (${endpointUrl})`,
        checkedAt: new Date().toISOString(),
      };
    }

    return {
      state: 'unavailable',
      reachable: false,
      endpointUrl,
      latencyMs: null,
      message: `Backend endpoint ${endpointUrl} responded with unexpected status payload.`,
      checkedAt: new Date().toISOString(),
    };
  } catch {
    return {
      state: 'unavailable',
      reachable: false,
      endpointUrl,
      latencyMs: null,
      message: `Backend Unavailable at ${endpointUrl} — Waiting for FastAPI service`,
      checkedAt: new Date().toISOString(),
    };
  }
}

export const traceMindApi = {
  getBaseUrl: () => API_CONFIG.baseUrl,
  hasExplicitEnvConfig: () => API_CONFIG.hasExplicitEnvConfig,
  checkBackendHealth,
  fetchAnalysisHistory,
  fetchAnalysisById,
  deleteAnalysisRunById,
  submitEventLogAnalysis,
  fetchRunEvents,
};

export {
  submitEventLogAnalysis,
  fetchAnalysisHistory,
  fetchAnalysisById,
  deleteAnalysisRunById,
  fetchRunEvents,
};

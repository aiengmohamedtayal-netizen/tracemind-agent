import { API_CONFIG } from '../../config/api';
import { ApiConnectionState } from '../../types/tracemind';
import { apiRequest } from './client';
import { setAccessToken } from './client';

export async function authenticate(email: string, password: string, mode: 'login' | 'register') {
  const result = await apiRequest<{access_token:string;user:{id:number;email:string;role:string}}>(`/auth/${mode === 'register' ? 'register' : 'login'}`, {method:'POST',body:{email,password},timeoutMs:20000});
  setAccessToken(result.access_token);
  return result.user;
}
export async function restoreSession() {
  try {
    const result = await apiRequest<{access_token:string}>('/auth/refresh',{method:'POST',timeoutMs:20000});
    setAccessToken(result.access_token);
    return await apiRequest<{id:number;email:string;role:string}>('/auth/me');
  } catch { setAccessToken(null); return null; }
}
export async function endSession() {
  try { await apiRequest<void>('/auth/logout',{method:'POST'}); } finally { setAccessToken(null); }
}
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

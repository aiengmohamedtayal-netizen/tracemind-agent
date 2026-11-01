import { API_CONFIG } from '../../config/api';
import { AnalysisRun } from '../../types/tracemind';
import { validateAnalysisRunResponse } from '../../utils/analysisEngine';
import { apiRequest } from './client';

/**
 * Fetches persisted analysis runs from GET /history.
 * Returns only real backend records; never returns mock or localStorage data.
 */
export async function fetchAnalysisHistory(
  signal?: AbortSignal
): Promise<AnalysisRun[]> {
  const payload = await apiRequest<unknown>(API_CONFIG.endpoints.history, {
    method: 'GET',
    signal,
  });

  const rawList: unknown[] = Array.isArray(payload)
    ? payload
    : payload &&
      typeof payload === 'object' &&
      Array.isArray((payload as Record<string, unknown>).runs)
    ? ((payload as Record<string, unknown>).runs as unknown[])
    : [];

  return rawList.map((item) => validateAnalysisRunResponse(item));
}

/**
 * Fetches a single persisted AnalysisRun by ID from GET /history/:run_id.
 */
export async function fetchAnalysisById(
  runId: string,
  signal?: AbortSignal
): Promise<AnalysisRun> {
  const payload = await apiRequest<unknown>(
    API_CONFIG.endpoints.historyDetail(runId),
    {
      method: 'GET',
      signal,
    }
  );
  return validateAnalysisRunResponse(payload);
}

/**
 * Sends a DELETE request to /history/:run_id to remove a persisted run on the backend.
 */
export async function deleteAnalysisRunById(
  runId: string,
  signal?: AbortSignal
): Promise<void> {
  await apiRequest<unknown>(API_CONFIG.endpoints.historyDetail(runId), {
    method: 'DELETE',
    signal,
  });
}

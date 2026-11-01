import { API_CONFIG } from '../../config/api';
import { EvaluatedEventRecord } from '../../types/tracemind';
import { apiRequest } from './client';

/**
 * Fetches evaluated event records for a specific run from GET /history/:run_id/events.
 */
export async function fetchRunEvents(
  runId: string,
  signal?: AbortSignal
): Promise<EvaluatedEventRecord[]> {
  const payload = await apiRequest<unknown>(
    API_CONFIG.endpoints.runEvents(runId),
    {
      method: 'GET',
      signal,
    }
  );

  if (Array.isArray(payload)) {
    return payload as EvaluatedEventRecord[];
  }
  if (
    payload &&
    typeof payload === 'object' &&
    Array.isArray((payload as Record<string, unknown>).events)
  ) {
    return (payload as Record<string, unknown>).events as EvaluatedEventRecord[];
  }
  return [];
}

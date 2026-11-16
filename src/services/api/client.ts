import { API_CONFIG } from '../../config/api';

export class ApiClientError extends Error {
  public readonly status: number | null;
  public readonly endpoint: string;
  public readonly isNetworkError: boolean;

  constructor(params: {
    message: string;
    endpoint: string;
    status?: number | null;
    isNetworkError?: boolean;
  }) {
    super(params.message);
    this.name = 'ApiClientError';
    this.endpoint = params.endpoint;
    this.status = params.status ?? null;
    this.isNetworkError = Boolean(params.isNetworkError);
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'DELETE' | 'PUT';
  body?: unknown | FormData;
  timeoutMs?: number;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

let accessToken: string | null = null;
let refreshInFlight: Promise<boolean> | null = null;
export const setAccessToken = (token: string | null) => { accessToken = token; };

/**
 * Reusable HTTP client for TraceMind backend requests.
 * Supports request cancellation, timeouts, JSON validation, and structured error reporting.
 */
export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const method = options.method || 'GET';
  const endpoint = `${API_CONFIG.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  const timeoutMs = options.timeoutMs ?? API_CONFIG.defaultTimeoutMs;

  const controller = new AbortController();
  const externalSignal = options.signal;

  const onExternalAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener('abort', onExternalAbort, { once: true });
    }
  }

  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const isFormData =
    typeof FormData !== 'undefined' && options.body instanceof FormData;

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...options.headers,
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  if (options.body !== undefined && !isFormData && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  try {
    const response = await fetch(endpoint, {
      method,
      headers,
      credentials: 'include',
      body:
        options.body === undefined
          ? undefined
          : isFormData
          ? (options.body as FormData)
          : JSON.stringify(options.body),
      signal: controller.signal,
    });

    if (response.status === 401 && accessToken && !path.includes('/auth/')) {
      refreshInFlight ??= (async () => {
        try {
          const refreshed = await apiRequest<{ access_token: string }>('/auth/refresh', { method: 'POST' });
          setAccessToken(refreshed.access_token);
          return true;
        } catch {
          setAccessToken(null);
          if (typeof window !== 'undefined') window.dispatchEvent(new Event('tracemind:session-expired'));
          return false;
        } finally { refreshInFlight = null; }
      })();
      if (await refreshInFlight) return apiRequest<T>(path, options);
    }

    const contentType = response.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');

    if (!response.ok) {
      let detailMessage = `HTTP ${response.status} ${response.statusText || ''}`.trim();
      if (isJson) {
        try {
          const errJson = await response.json();
          if (errJson && typeof errJson === 'object') {
            const detail =
              (errJson as Record<string, unknown>).detail ||
              (errJson as Record<string, unknown>).message ||
              (errJson as Record<string, unknown>).error;
            if (typeof detail === 'string' && detail.trim()) {
              detailMessage = detail.trim();
            }
          }
        } catch {
          // ignore malformed error JSON
        }
      }
      throw new ApiClientError({
        message: `Backend request ${method} ${endpoint} failed (${detailMessage}).`,
        endpoint,
        status: response.status,
        isNetworkError: false,
      });
    }

    if (response.status === 204) return undefined as T;

    if (!isJson) {
      throw new ApiClientError({
        message: `Backend endpoint ${method} ${endpoint} did not return a valid application/json response.`,
        endpoint,
        status: response.status,
        isNetworkError: false,
      });
    }

    try {
      return (await response.json()) as T;
    } catch {
      throw new ApiClientError({
        message: `Malformed JSON payload received from ${method} ${endpoint}.`,
        endpoint,
        status: response.status,
        isNetworkError: false,
      });
    }
  } catch (err) {
    if (err instanceof ApiClientError) {
      throw err;
    }
    const isAbort =
      err instanceof DOMException && err.name === 'AbortError';
    throw new ApiClientError({
      message: isAbort
        ? `Request to ${method} ${endpoint} timed out or was cancelled.`
        : `Unable to reach TraceMind backend at ${endpoint}. Verify the FastAPI server is running and VITE_API_BASE_URL is configured.`,
      endpoint,
      status: null,
      isNetworkError: true,
    });
  } finally {
    clearTimeout(timer);
    if (externalSignal) {
      externalSignal.removeEventListener('abort', onExternalAbort);
    }
  }
}

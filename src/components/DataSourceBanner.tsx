import React from 'react';
import { RefreshCw, SlidersHorizontal, Database } from 'lucide-react';
import { AnalysisRun } from '../types/tracemind';
import { BackendHealthStatus } from '../services/api';
import { API_CONFIG } from '../config/api';

interface DataSourceBannerProps {
  activeRun: AnalysisRun | null;
  allRuns: AnalysisRun[];
  onSelectRun: (runId: string) => void;
  healthStatus: BackendHealthStatus | null;
  isCheckingHealth: boolean;
  onRefreshHealth: () => void;
  onOpenApiModal: () => void;
}

export const DataSourceBanner: React.FC<DataSourceBannerProps> = ({
  activeRun,
  allRuns,
  onSelectRun,
  healthStatus,
  isCheckingHealth,
  onRefreshHealth,
  onOpenApiModal,
}) => {
  const connectionState = isCheckingHealth
    ? 'checking'
    : !API_CONFIG.baseUrl
    ? 'config_missing'
    : healthStatus?.reachable
    ? 'connected'
    : 'unavailable';

  return (
    <section
      aria-label="Active Analysis Run and Backend Status"
      className="bg-slate-100/85 border-b border-slate-200/90 px-4 sm:px-6 py-2.5"
    >
      <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-x-6 gap-y-2.5 text-xs text-slate-600">
        {/* Left: Active Run Selector & Telemetry Metadata */}
        <div className="flex flex-wrap items-center gap-2.5 min-w-0 max-w-full">
          <label
            htmlFor="active-run-select"
            className="inline-flex items-center gap-1.5 font-semibold text-slate-700 shrink-0"
          >
            <Database className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
            Active Run:
          </label>
          <select
            id="active-run-select"
            value={activeRun?.run_id || ''}
            disabled={allRuns.length === 0}
            onChange={(e) => onSelectRun(e.target.value)}
            className="tm-input max-w-[calc(100vw-6.5rem)] sm:max-w-md truncate px-2.5 py-1 text-xs font-medium text-slate-900 font-mono cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed shadow-2xs"
          >
            {allRuns.length === 0 ? (
              <option value="">No backend analysis runs loaded</option>
            ) : (
              allRuns.map((r) => (
                <option key={r.run_id} value={r.run_id}>
                  {r.run_id} — {r.dataset_name} ({r.isolation_forest.anomalous_events_count}/
                  {r.isolation_forest.total_events} anomalies)
                </option>
              ))
            )}
          </select>

          {activeRun && (
            <div className="flex items-center gap-2 text-slate-500 pl-0.5">
              <span>
                Format:{' '}
                <strong className="font-mono font-medium text-slate-700">
                  {activeRun.file_format}
                </strong>
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                Processed in {activeRun.duration_ms} ms
              </span>
            </div>
          )}
        </div>

        {/* Right: Real Backend Connection Status & Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs" data-testid="backend-connection-status">
            <span className="font-semibold text-slate-700">Backend Status:</span>
            {connectionState === 'checking' ? (
              <span className="text-blue-700 font-semibold">
                Checking Connection ({API_CONFIG.baseUrl})...
              </span>
            ) : connectionState === 'connected' ? (
              <span className="text-emerald-800 font-semibold">
                Connected ({healthStatus?.endpointUrl}
                {healthStatus?.latencyMs !== null ? ` · ${healthStatus?.latencyMs} ms` : ''})
              </span>
            ) : connectionState === 'config_missing' ? (
              <span className="text-red-700 font-semibold">
                Configuration Missing (Set VITE_API_BASE_URL)
              </span>
            ) : (
              <span className="text-red-700 font-semibold">
                Backend Unavailable ({API_CONFIG.baseUrl}/health unreachable)
              </span>
            )}
          </div>

          <span aria-hidden="true" className="text-slate-300 hidden sm:inline">
            |
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRefreshHealth}
              disabled={isCheckingHealth}
              className="inline-flex items-center gap-1 text-slate-700 hover:text-blue-600 font-medium transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0 py-1 px-1.5 rounded hover:bg-slate-200/60"
            >
              <RefreshCw
                className={`w-3 h-3 ${
                  isCheckingHealth ? 'animate-spin text-blue-600' : 'text-slate-500'
                }`}
                aria-hidden="true"
              />
              {isCheckingHealth ? 'Checking...' : 'Check Connection'}
            </button>

            <button
              type="button"
              onClick={onOpenApiModal}
              className="tm-btn-secondary px-2.5 py-1 text-xs whitespace-nowrap shrink-0"
            >
              <SlidersHorizontal className="w-3 h-3 text-slate-500" aria-hidden="true" />
              API Contracts
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

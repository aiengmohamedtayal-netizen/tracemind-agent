import React from 'react';
import { RefreshCw, SlidersHorizontal, Database, User, LogOut } from 'lucide-react';
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
  userEmail?: string;
  onSignOut?: () => void;
}

export const DataSourceBanner: React.FC<DataSourceBannerProps> = ({
  activeRun,
  allRuns,
  onSelectRun,
  healthStatus,
  isCheckingHealth,
  onRefreshHealth,
  onOpenApiModal,
  userEmail,
  onSignOut,
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
      className="bg-[#0B0F19]/90 border-b border-slate-800/60 px-4 sm:px-6 py-2.5 text-slate-300 shadow-sm"
    >
      <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-x-6 gap-y-2.5 text-xs">
        {/* Left: Active Run Selector & Telemetry Metadata */}
        <div className="flex flex-wrap items-center gap-2.5 min-w-0 max-w-full">
          <label
            htmlFor="active-run-select"
            className="inline-flex items-center gap-1.5 font-semibold text-slate-300 shrink-0"
          >
            <Database className="w-3.5 h-3.5 text-cyan-400" aria-hidden="true" />
            Active Run:
          </label>
          <select
            id="active-run-select"
            value={activeRun?.run_id || ''}
            disabled={allRuns.length === 0}
            onChange={(e) => onSelectRun(e.target.value)}
            className="bg-slate-900 border border-slate-700/80 hover:border-cyan-500/50 rounded-lg max-w-[calc(100vw-6.5rem)] sm:max-w-md truncate px-2.5 py-1 text-xs font-medium text-slate-200 font-mono cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed transition-colors focus:border-cyan-400 focus:outline-none"
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
            <div className="flex items-center gap-2 text-slate-400 pl-0.5">
              <span>
                Format:{' '}
                <strong className="font-mono font-medium text-cyan-400">
                  {activeRun.file_format}
                </strong>
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums text-slate-300">
                Processed in {activeRun.duration_ms} ms
              </span>
            </div>
          )}
        </div>

        {/* Right: Real Backend Connection Status, Controls, and User Strip */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs" data-testid="backend-connection-status">
            <span className="font-semibold text-slate-400">Backend Status:</span>
            {connectionState === 'checking' ? (
              <span className="text-cyan-400 font-semibold inline-flex items-center gap-1">
                <RefreshCw className="w-3 h-3 animate-spin" /> Checking ({API_CONFIG.baseUrl})...
              </span>
            ) : connectionState === 'connected' ? (
              <span className="text-emerald-400 font-semibold inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse" />
                Connected ({healthStatus?.endpointUrl}
                {healthStatus?.latencyMs !== null ? ` · ${healthStatus?.latencyMs} ms` : ''})
              </span>
            ) : connectionState === 'config_missing' ? (
              <span className="text-rose-400 font-semibold">
                Configuration Missing (Set VITE_API_BASE_URL)
              </span>
            ) : (
              <span className="text-rose-400 font-semibold">
                Backend Unavailable ({API_CONFIG.baseUrl}/health unreachable)
              </span>
            )}
          </div>

          <span aria-hidden="true" className="text-slate-700 hidden sm:inline">
            |
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRefreshHealth}
              disabled={isCheckingHealth}
              className="inline-flex items-center gap-1 text-slate-300 hover:text-cyan-300 font-medium transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0 py-1 px-2 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-800/80 text-xs"
            >
              <RefreshCw
                className={`w-3 h-3 ${
                  isCheckingHealth ? 'animate-spin text-cyan-400' : 'text-slate-400'
                }`}
                aria-hidden="true"
              />
              {isCheckingHealth ? 'Checking...' : 'Check Connection'}
            </button>

            <button
              type="button"
              onClick={onOpenApiModal}
              className="inline-flex items-center gap-1.5 text-slate-200 hover:text-white bg-slate-900 hover:border-cyan-500/50 border border-slate-700/80 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer"
            >
              <SlidersHorizontal className="w-3 h-3 text-cyan-400" aria-hidden="true" />
              API Contracts
            </button>
          </div>

          {userEmail && (
            <>
              <span aria-hidden="true" className="text-slate-700 hidden sm:inline">
                |
              </span>
              <div className="flex items-center gap-2.5 pl-1 text-xs">
                <span className="inline-flex items-center gap-1 text-slate-300 font-mono">
                  <User className="w-3 h-3 text-slate-500" />
                  {userEmail}
                </span>
                {onSignOut && (
                  <button
                    type="button"
                    onClick={onSignOut}
                    className="inline-flex items-center gap-1 text-rose-400 hover:text-rose-300 hover:underline transition-colors font-sans cursor-pointer"
                  >
                    <LogOut className="w-3 h-3" />
                    Sign out
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
};

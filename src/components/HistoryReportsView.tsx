import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertCircle,
  Database,
  Download,
  FolderOpen,
  RefreshCw,
  ServerCrash,
  Trash2,
  Upload,
} from 'lucide-react';
import { AnalysisRun } from '../types/tracemind';
import { exportEventsToCsv } from '../utils/analysisEngine';
import { NavTabId } from './Header';

interface HistoryReportsViewProps {
  runs: AnalysisRun[];
  activeRunId: string;
  isLoading: boolean;
  backendReachable: boolean;
  errorMessage: string | null;
  onSelectRun: (runId: string) => void;
  onDeleteRun: (runId: string) => Promise<void>;
  onRefreshHistory: () => void;
  onNavigate: (tab: NavTabId) => void;
}

export const HistoryReportsView: React.FC<HistoryReportsViewProps> = ({
  runs,
  activeRunId,
  isLoading,
  backendReachable,
  errorMessage,
  onSelectRun,
  onDeleteRun,
  onRefreshHistory,
  onNavigate,
}) => {
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingRunId, setDeletingRunId] = useState<string | null>(null);

  const handleExportJson = (run: AnalysisRun) => {
    const jsonStr = JSON.stringify(run, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${run.run_id}-tracemind-report.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCsv = (run: AnalysisRun) => {
    const csvStr = exportEventsToCsv(run.events);
    const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${run.run_id}-evaluated-events.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDeleteClick = async (runId: string) => {
    setDeleteError(null);
    setDeletingRunId(runId);
    try {
      await onDeleteRun(runId);
    } catch (err) {
      setDeleteError(
        err instanceof Error
          ? err.message
          : `Failed to delete run ${runId} on backend.`
      );
    } finally {
      setDeletingRunId(null);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-8"
    >
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200/90 pb-5">
        <div>
          <div className="text-xs font-semibold text-blue-600 mb-1">
            SQLite Persistence &amp; Audit Reports
          </div>
          <h1 className="text-2xl sm:text-[26px] font-bold tracking-tight text-slate-900">
            Analysis History &amp; Audit Reports
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Inspect historical Isolation Forest and PSO analysis runs persisted by the FastAPI/SQLite backend, switch the active workspace run, or export structured JSON/CSV audit reports.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onRefreshHistory}
            disabled={isLoading}
            className="tm-btn-secondary px-3.5 py-2 text-xs whitespace-nowrap shrink-0 disabled:opacity-50"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-slate-500 ${isLoading ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            Refresh History (GET /history)
          </button>
        </div>
      </div>

      {deleteError && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-900 flex items-start gap-2.5"
        >
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <div className="font-bold">Backend Delete Operation Failed</div>
            <p className="mt-0.5 text-red-800">{deleteError}</p>
          </div>
        </div>
      )}

      <div className="tm-card overflow-hidden">
        {isLoading ? (
          <div className="p-8 space-y-3" aria-busy="true">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />
            ))}
          </div>
        ) : runs.length === 0 ? (
          <div className="p-12 text-center max-w-2xl mx-auto">
            <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center mx-auto mb-3">
              {!backendReachable ? (
                <ServerCrash className="w-5 h-5 text-red-600" aria-hidden="true" />
              ) : (
                <Database className="w-5 h-5 text-blue-600" aria-hidden="true" />
              )}
            </div>
            <h2 className="text-base font-bold text-slate-900">
              {!backendReachable
                ? 'Backend Unavailable — Unable to Fetch Analysis History'
                : 'No Persisted Analysis Runs Found in Backend History'}
            </h2>
            <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
              {errorMessage
                ? errorMessage
                : 'No historical runs were returned by GET /history. Upload and analyze a CSV or JSON event log to create a persisted backend run.'}
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={onRefreshHistory}
                className="tm-btn-secondary px-4 py-2 text-xs"
              >
                <RefreshCw className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                Retry GET /history
              </button>
              <button
                type="button"
                onClick={() => onNavigate('analyze')}
                className="tm-btn-primary px-4 py-2 text-xs"
              >
                <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                Upload Event Log
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/90 text-xs font-semibold text-slate-600">
                  <th className="py-3.5 px-4">Run ID</th>
                  <th className="py-3.5 px-4">Dataset &amp; Format</th>
                  <th className="py-3.5 px-4">Data Source</th>
                  <th className="py-3.5 px-4 text-right">Events</th>
                  <th className="py-3.5 px-4 text-right">Anomalies</th>
                  <th className="py-3.5 px-4">Selected PSO Action</th>
                  <th className="py-3.5 px-4 text-right">PSO Fitness</th>
                  <th className="py-3.5 px-4 text-right">Actions &amp; Export</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80 text-xs">
                {runs.map((run) => {
                  const isCurrent = run.run_id === activeRunId;
                  return (
                    <tr
                      key={run.run_id}
                      className={
                        isCurrent
                          ? 'bg-blue-50/70'
                          : 'hover:bg-slate-50/90 transition-colors'
                      }
                    >
                      <td className="py-4 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                        {run.run_id}
                        {isCurrent && (
                          <span className="ml-2 text-[11px] font-sans font-bold text-blue-700">
                            (Active)
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        <div className="font-semibold text-slate-900">{run.dataset_name}</div>
                        <div className="text-slate-500 font-mono text-[11px] mt-0.5">
                          {run.file_format} · {run.created_at.slice(0, 19).replace('T', ' ')} UTC
                        </div>
                      </td>
                      <td className="py-4 px-4 whitespace-nowrap">
                        <span className="text-emerald-800 font-semibold">
                          Live FastAPI Backend
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right font-mono tabular-nums text-slate-900 whitespace-nowrap">
                        {run.isolation_forest.total_events}
                      </td>
                      <td className="py-4 px-4 text-right font-mono tabular-nums font-bold text-red-600 whitespace-nowrap">
                        {run.isolation_forest.anomalous_events_count} (
                        {run.isolation_forest.anomaly_rate_pct}%)
                      </td>
                      <td className="py-4 px-4">
                        <div className="font-semibold text-slate-900">
                          {run.pso_optimization.selected_action.action_id}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500">
                          {run.pso_optimization.selected_action.action_code}
                        </div>
                      </td>
                      <td className="py-4 px-4 text-right font-mono tabular-nums font-bold text-slate-900 whitespace-nowrap">
                        {run.pso_optimization.best_fitness_score}
                      </td>
                      <td className="py-4 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          {!isCurrent && (
                            <button
                              type="button"
                              onClick={() => onSelectRun(run.run_id)}
                              className="tm-btn-primary px-2.5 py-1 text-xs"
                            >
                              <FolderOpen className="w-3 h-3" aria-hidden="true" />
                              Load Run
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleExportJson(run)}
                            className="tm-btn-secondary px-2.5 py-1 text-xs"
                          >
                            <Download className="w-3 h-3 text-slate-500" aria-hidden="true" />
                            JSON
                          </button>
                          <button
                            type="button"
                            onClick={() => handleExportCsv(run)}
                            className="tm-btn-secondary px-2.5 py-1 text-xs"
                          >
                            <Download className="w-3 h-3 text-slate-500" aria-hidden="true" />
                            CSV
                          </button>
                          <button
                            type="button"
                            disabled={deletingRunId === run.run_id}
                            onClick={() => handleDeleteClick(run.run_id)}
                            aria-label={`Delete run ${run.run_id}`}
                            className="inline-flex items-center gap-1 px-2 py-1 text-red-600 hover:text-red-800 font-medium cursor-pointer disabled:opacity-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                            {deletingRunId === run.run_id ? 'Deleting...' : 'Delete'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </motion.div>
  );
};

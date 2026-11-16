import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowDownUp,
  Database,
  Download,
  RefreshCw,
  Search,
  ServerCrash,
  SlidersHorizontal,
  Upload,
} from 'lucide-react';
import {
  AnalysisRun,
  EvaluatedEventRecord,
  SeverityLevel,
} from '../types/tracemind';
import {
  exportEventsToCsv,
  filterAndSortEvents,
} from '../utils/analysisEngine';
import { NavTabId } from './Header';

const EVENT_PAGE_SIZE = 100;

interface AnomaliesTableViewProps {
  run: AnalysisRun | null;
  isLoading: boolean;
  backendReachable: boolean;
  selectedEvent: EvaluatedEventRecord | null;
  onSelectEvent: (event: EvaluatedEventRecord | null) => void;
  onNavigate: (tab: NavTabId) => void;
  onRetry: () => void;
}

export const AnomaliesTableView: React.FC<AnomaliesTableViewProps> = ({
  run,
  isLoading,
  backendReachable,
  selectedEvent,
  onSelectEvent,
  onNavigate,
  onRetry,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [onlyAnomalies, setOnlyAnomalies] = useState<boolean>(false);
  const [severityFilter, setSeverityFilter] = useState<'all' | SeverityLevel>('all');
  const [serviceFilter, setServiceFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<
    'anomaly_score' | 'latency_ms' | 'error_rate' | 'cpu_pct' | 'timestamp'
  >('anomaly_score');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [pageIndex, setPageIndex] = useState(0);

  const events = useMemo(() => run?.events ?? [], [run]);

  const availableServices = useMemo(
    () => Array.from(new Set(events.map((e) => e.service))).sort(),
    [events]
  );

  const filteredEvents = useMemo(
    () =>
      filterAndSortEvents(events, {
        searchQuery,
        onlyAnomalies,
        severityFilter,
        serviceFilter,
        sortBy,
        sortDirection,
      }),
    [events, searchQuery, onlyAnomalies, severityFilter, serviceFilter, sortBy, sortDirection]
  );

  const activeEvent = selectedEvent || filteredEvents[0] || null;
  const pageCount = Math.max(1, Math.ceil(filteredEvents.length / EVENT_PAGE_SIZE));
  const pageEvents = filteredEvents.slice(pageIndex * EVENT_PAGE_SIZE, (pageIndex + 1) * EVENT_PAGE_SIZE);

  useEffect(() => setPageIndex(0), [run?.run_id, searchQuery, onlyAnomalies, severityFilter, serviceFilter, sortBy, sortDirection]);

  const handleDownloadCsv = () => {
    if (!run || filteredEvents.length === 0) return;
    const csv = exportEventsToCsv(filteredEvents);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${run.run_id}-events-export.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-6"
    >
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200/90 pb-5">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mb-1.5">
            <span className="font-semibold text-blue-600">Isolation Forest Event Explorer</span>
            <span aria-hidden="true">·</span>
            {run ? (
              <>
                <span className="font-mono">
                  Threshold &ge;{' '}
                  <strong className="text-slate-700">
                    {run.isolation_forest.threshold_score}
                  </strong>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  Showing <strong className="font-mono text-slate-700">{filteredEvents.length}</strong> of{' '}
                  <strong className="font-mono text-slate-700">{run.events.length}</strong> records
                </span>
              </>
            ) : (
              <span>No active backend run selected</span>
            )}
          </div>
          <h1 className="text-2xl sm:text-[26px] font-bold tracking-tight text-slate-900">
            Anomalous Events &amp; Feature Telemetry
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleDownloadCsv}
            disabled={!run || filteredEvents.length === 0}
            className="tm-btn-secondary px-3.5 py-2 text-xs whitespace-nowrap shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
            Download CSV ({filteredEvents.length} rows)
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="tm-card p-4 flex flex-wrap items-center justify-between gap-4">
        {/* Segmented Filter Buttons */}
        <div
          role="group"
          aria-label="Filter events by anomaly state and severity"
          className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200/60"
        >
          <button
            type="button"
            disabled={!run}
            onClick={() => {
              setOnlyAnomalies(false);
              setSeverityFilter('all');
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50 disabled:cursor-not-allowed ${
              !onlyAnomalies && severityFilter === 'all'
                ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Events ({run ? run.events.length : 0})
          </button>
          <button
            type="button"
            disabled={!run}
            onClick={() => {
              setOnlyAnomalies(true);
              setSeverityFilter('all');
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50 disabled:cursor-not-allowed ${
              onlyAnomalies && severityFilter === 'all'
                ? 'bg-white text-red-700 font-semibold shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Anomalies Only ({run ? run.isolation_forest.anomalous_events_count : 0})
          </button>
          <button
            type="button"
            disabled={!run}
            onClick={() => {
              setOnlyAnomalies(true);
              setSeverityFilter('critical');
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50 disabled:cursor-not-allowed ${
              severityFilter === 'critical'
                ? 'bg-white text-red-700 font-semibold shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Critical
          </button>
          <button
            type="button"
            disabled={!run}
            onClick={() => {
              setOnlyAnomalies(true);
              setSeverityFilter('high');
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50 disabled:cursor-not-allowed ${
              severityFilter === 'high'
                ? 'bg-white text-amber-800 font-semibold shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            High
          </button>
          <button
            type="button"
            disabled={!run}
            onClick={() => {
              setOnlyAnomalies(true);
              setSeverityFilter('medium');
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50 disabled:cursor-not-allowed ${
              severityFilter === 'medium'
                ? 'bg-white text-blue-700 font-semibold shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Medium
          </button>
        </div>

        {/* Search, Service & Sort Controls */}
        <div className="flex flex-wrap items-center gap-3 flex-1 justify-end">
          <div className="relative min-w-[220px] flex-1 sm:flex-initial">
            <label htmlFor="event-search-input" className="sr-only">
              Search events by ID, IP, service, or message
            </label>
            <Search
              className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              id="event-search-input"
              type="search"
              disabled={!run}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search event ID, IP, service..."
              className="tm-input w-full pl-8 pr-3 py-1.5 text-xs text-slate-900 disabled:bg-slate-100 disabled:text-slate-400"
            />
          </div>

          <div>
            <label htmlFor="service-filter-select" className="sr-only">
              Filter by service
            </label>
            <select
              id="service-filter-select"
              disabled={!run}
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
              className="tm-input px-2.5 py-1.5 text-xs text-slate-800 cursor-pointer disabled:bg-slate-100 disabled:text-slate-400"
            >
              <option value="all">All Services ({availableServices.length})</option>
              {availableServices.map((svc) => (
                <option key={svc} value={svc}>
                  {svc}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <label htmlFor="sort-by-select" className="text-xs font-medium text-slate-600">
              Sort:
            </label>
            <select
              id="sort-by-select"
              disabled={!run}
              value={sortBy}
              onChange={(e) =>
                setSortBy(
                  e.target.value as
                    | 'anomaly_score'
                    | 'latency_ms'
                    | 'error_rate'
                    | 'cpu_pct'
                    | 'timestamp'
                )
              }
              className="tm-input px-2.5 py-1.5 text-xs text-slate-800 cursor-pointer disabled:bg-slate-100 disabled:text-slate-400"
            >
              <option value="anomaly_score">IForest Anomaly Score</option>
              <option value="latency_ms">Latency (ms)</option>
              <option value="error_rate">Error Rate</option>
              <option value="cpu_pct">CPU Usage (%)</option>
              <option value="timestamp">Timestamp</option>
            </select>
            <button
              type="button"
              disabled={!run}
              onClick={() => setSortDirection((d) => (d === 'desc' ? 'asc' : 'desc'))}
              aria-label={`Sort direction ${sortDirection === 'desc' ? 'descending' : 'ascending'}`}
              className="tm-btn-secondary px-2.5 py-1.5 text-xs font-mono disabled:opacity-50"
            >
              <ArrowDownUp className="w-3 h-3 text-slate-500" aria-hidden="true" />
              {sortDirection === 'desc' ? 'DESC' : 'ASC'}
            </button>
          </div>
        </div>
      </div>

      {/* Main Split: Event Table (8 cols) + Event Telemetry Inspector (4 cols) */}
      {isLoading ? (
        <div className="tm-card p-8 space-y-3" aria-busy="true">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />
          ))}
        </div>
      ) : !run ? (
        <div className="tm-card p-10 text-center max-w-2xl mx-auto">
          <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center mx-auto mb-3">
            {!backendReachable ? (
              <ServerCrash className="w-5 h-5 text-red-600" aria-hidden="true" />
            ) : (
              <Database className="w-5 h-5 text-blue-600" aria-hidden="true" />
            )}
          </div>
          <h2 className="text-base font-bold text-slate-900">
            {!backendReachable
              ? 'Backend Unavailable — No Evaluated Events Loaded'
              : 'No Evaluated Event Telemetry Available'}
          </h2>
          <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
            {!backendReachable
              ? 'The frontend does not generate mock event records or simulated Isolation Forest scores. Start the FastAPI backend and retry the connection, or upload a real CSV/JSON event log once the server is online.'
              : 'Submit a CSV or JSON event log to POST /analyze to inspect real Isolation Forest anomaly scores, tree depth E(h(x)), and feature Z-score deviations.'}
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={onRetry}
              className="tm-btn-secondary px-4 py-2 text-xs"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
              Retry Backend Connection
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-8 tm-card overflow-hidden">
            {filteredEvents.length === 0 ? (
              <div className="p-12 text-center">
                <div className="text-sm font-bold text-slate-800">
                  {run.events.length === 0
                    ? 'Backend Returned 0 Event Records for This Run'
                    : 'No Event Records Match Current Filters'}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {run.events.length === 0
                    ? 'The backend response did not include row-level telemetry records in run.events.'
                    : 'Try clearing your search query or switching from Anomalies Only to All Events.'}
                </p>
                {run.events.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setOnlyAnomalies(false);
                      setSeverityFilter('all');
                      setServiceFilter('all');
                    }}
                    className="tm-btn-primary mt-4 px-3.5 py-1.5 text-xs"
                  >
                    Reset All Filters
                  </button>
                )}
              </div>
            ) : (
              <>
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 text-xs text-slate-600">
                <span>Page {pageIndex + 1} of {pageCount} · {EVENT_PAGE_SIZE} records per page</span>
                <div className="flex gap-2">
                  <button type="button" className="tm-btn-secondary px-2.5 py-1.5 disabled:opacity-40" disabled={pageIndex === 0} onClick={() => setPageIndex((page) => Math.max(0, page - 1))}>Previous</button>
                  <button type="button" className="tm-btn-secondary px-2.5 py-1.5 disabled:opacity-40" disabled={pageIndex + 1 >= pageCount} onClick={() => setPageIndex((page) => Math.min(pageCount - 1, page + 1))}>Next</button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/90 text-xs font-semibold text-slate-600">
                      <th className="py-3 px-3.5">Event ID</th>
                      <th className="py-3 px-3.5">Service &amp; Type</th>
                      <th className="py-3 px-3.5">Source IP</th>
                      <th className="py-3 px-3.5 text-right">Latency</th>
                      <th className="py-3 px-3.5 text-right">Err Rate</th>
                      <th className="py-3 px-3.5 text-right">CPU</th>
                      <th className="py-3 px-3.5 text-right">IForest Score</th>
                      <th className="py-3 px-3.5">Classification</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/80 text-xs">
                    {pageEvents.map((ev) => {
                      const isSelected = activeEvent?.event_id === ev.event_id;
                      return (
                        <tr
                          key={ev.event_id}
                          onClick={() => onSelectEvent(ev)}
                          className={`transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-blue-50/90'
                              : ev.is_anomaly
                              ? 'bg-red-50/20 hover:bg-slate-100/75'
                              : 'hover:bg-slate-50/90'
                          }`}
                        >
                          <td className="py-2.5 px-3.5 font-mono font-semibold text-slate-900 whitespace-nowrap">
                            {ev.event_id}
                          </td>
                          <td className="py-2.5 px-3.5">
                            <div className="font-semibold text-slate-900">{ev.service}</div>
                            <div className="text-[11px] font-mono text-slate-500">
                              {ev.event_type}{ev.status_code == null ? '' : ` · HTTP ${ev.status_code}`}
                            </div>
                          </td>
                          <td className="py-2.5 px-3.5 font-mono text-slate-600 tabular-nums whitespace-nowrap">
                            {ev.source_ip}
                          </td>
                          <td className="py-2.5 px-3.5 text-right font-mono tabular-nums text-slate-900 whitespace-nowrap">
                            {ev.latency_ms == null ? '—' : `${ev.latency_ms} ms`}
                          </td>
                          <td className="py-2.5 px-3.5 text-right font-mono tabular-nums whitespace-nowrap">
                            <span
                              className={
                                (ev.error_rate ?? 0) >= 0.1
                                  ? 'text-red-700 font-semibold'
                                  : 'text-slate-700'
                              }
                            >
                              {ev.error_rate == null ? '—' : `${(ev.error_rate * 100).toFixed(1)}%`}
                            </span>
                          </td>
                          <td className="py-2.5 px-3.5 text-right font-mono tabular-nums text-slate-800 whitespace-nowrap">
                            {ev.cpu_pct == null ? '—' : `${ev.cpu_pct}%`}
                          </td>
                          <td className="py-2.5 px-3.5 text-right font-mono tabular-nums font-bold whitespace-nowrap">
                            <div className="inline-flex items-center justify-end gap-2">
                              <div className="w-10 h-1.5 bg-slate-100 rounded-full overflow-hidden hidden sm:block">
                                <div
                                  style={{ width: `${Math.min(100, ev.anomaly_score * 100)}%` }}
                                  className={`h-full rounded-full ${
                                    ev.is_anomaly ? 'bg-red-600' : 'bg-slate-400'
                                  }`}
                                />
                              </div>
                              <span
                                className={
                                  ev.is_anomaly ? 'text-red-600' : 'text-slate-700'
                                }
                              >
                                {ev.anomaly_score.toFixed(4)}
                              </span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3.5 whitespace-nowrap">
                            {ev.is_anomaly ? (
                              <span
                                className={
                                  ev.severity === 'critical'
                                    ? 'text-red-700 font-bold'
                                    : ev.severity === 'high'
                                    ? 'text-amber-700 font-bold'
                                    : 'text-blue-700 font-semibold'
                                }
                              >
                                Anomaly ({ev.severity})
                              </span>
                            ) : (
                              <span className="text-slate-500 font-medium">Nominal</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              </>
            )}
          </div>

          {/* Right 4 Columns: Event Telemetry & Feature Contribution Inspector */}
          <aside
            aria-label="Selected Event Telemetry Inspector"
            className="lg:col-span-4 tm-card p-5 space-y-5 sticky top-20"
          >
            {activeEvent ? (
              <>
                <div className="border-b border-slate-200 pb-4">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="font-mono font-bold text-blue-700">
                      {activeEvent.event_id}
                    </span>
                    <span className="font-mono text-[11px]">{activeEvent.timestamp || 'Timestamp unavailable'}</span>
                  </div>
                  <h2 className="text-base font-bold text-slate-900 mt-1">
                    {activeEvent.service} — {activeEvent.event_type}
                  </h2>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                    <span
                      className={
                        activeEvent.is_anomaly
                          ? activeEvent.severity === 'critical'
                            ? 'text-red-700 font-bold'
                            : 'text-amber-700 font-bold'
                          : 'text-emerald-700 font-semibold'
                      }
                    >
                      {activeEvent.is_anomaly
                        ? `Flagged Anomaly (${activeEvent.severity.toUpperCase()})`
                        : 'Nominal Log Record'}
                    </span>
                    <span aria-hidden="true">·</span>
                    {activeEvent.status_code == null ? null : <><span className="font-mono text-slate-600">HTTP {activeEvent.status_code}</span><span aria-hidden="true">·</span></>}
                    <span className="font-mono text-slate-600">
                      {activeEvent.source_ip}
                    </span>
                  </div>
                </div>

                {activeEvent.message && <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs"><div className="mb-1 font-semibold text-slate-600">Raw log message</div><pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words font-mono text-slate-800">{activeEvent.message}</pre></div>}

                {/* Isolation Forest Metrics */}
                <div className="grid grid-cols-2 gap-3 bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 text-xs">
                  <div>
                    <div className="text-slate-500 font-medium">IForest Score s(x,n)</div>
                    <div
                      className={`text-lg font-bold font-mono tabular-nums mt-0.5 ${
                        activeEvent.is_anomaly ? 'text-red-600' : 'text-slate-900'
                      }`}
                    >
                      {activeEvent.anomaly_score.toFixed(4)}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                      Cutoff &ge; {run.isolation_forest.threshold_score}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500 font-medium">Mean Tree Depth E(h(x))</div>
                    <div className="text-lg font-bold font-mono tabular-nums text-slate-900 mt-0.5">
                      {activeEvent.isolation_depth}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                      Driver: {activeEvent.primary_driver}
                    </div>
                  </div>
                </div>

                {/* Feature Z-Score Breakdown */}
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <h3 className="text-xs font-bold text-slate-900 inline-flex items-center gap-1.5">
                      <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                      Feature Subspace Z-Score Deviations
                    </h3>
                  </div>
                  {activeEvent.feature_contributions && activeEvent.feature_contributions.length > 0 ? (
                    <div className="space-y-3">
                      {activeEvent.feature_contributions.map((fc) => {
                        const barPct = Math.min(100, (fc.z_score / 4.0) * 100);
                        return (
                          <div key={fc.feature} className="space-y-1 text-xs">
                            <div className="flex items-center justify-between font-mono">
                              <span className="text-slate-700 font-semibold">{fc.feature}</span>
                              <span className="text-slate-900 tabular-nums">
                                val={fc.value} ·{' '}
                                <strong
                                  className={
                                    fc.z_score >= 2.0
                                      ? 'text-red-600'
                                      : fc.z_score >= 1.2
                                      ? 'text-amber-700'
                                      : 'text-slate-700'
                                  }
                                >
                                  z={fc.z_score}σ
                                </strong>
                              </span>
                            </div>
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${barPct}%` }}
                                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                                className={`h-full rounded-full ${
                                  fc.z_score >= 2.0
                                    ? 'bg-red-600'
                                    : fc.z_score >= 1.2
                                    ? 'bg-amber-500'
                                    : 'bg-blue-600'
                                }`}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500 py-3">
                      No per-feature Z-score breakdown returned by backend for this event.
                    </div>
                  )}
                </div>

                {activeEvent.message && (
                  <div className="pt-3 border-t border-slate-200">
                    <div className="text-xs font-bold text-slate-800 mb-1.5">
                      Log Message / Context
                    </div>
                    <p className="text-xs font-mono text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-200/90 leading-relaxed">
                      {activeEvent.message}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="text-xs text-slate-500 py-8 text-center">
                Select an event row from the table to inspect its Isolation Forest path depth and feature Z-scores.
              </div>
            )}
          </aside>
        </div>
      )}
    </motion.div>
  );
};

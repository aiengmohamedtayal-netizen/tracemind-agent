import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Cpu,
  DollarSign,
  RefreshCw,
  ServerCrash,
  ShieldCheck,
  Sparkles,
  UploadCloud,
} from 'lucide-react';
import { AnalysisRun, EvaluatedEventRecord } from '../types/tracemind';
import { NavTabId } from './Header';

interface DashboardViewProps {
  run: AnalysisRun | null;
  isLoading: boolean;
  backendReachable: boolean;
  loadError: string | null;
  onRetry: () => void;
  onNavigate: (tab: NavTabId) => void;
  onInspectEvent: (event: EvaluatedEventRecord) => void;
}

const AnimatedValue: React.FC<{
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
}> = ({ value, decimals = 0, prefix = '', suffix = '' }) => {
  const [display, setDisplay] = useState<number>(value);

  useEffect(() => {
    const start = display;
    const end = value;
    if (start === end) return;
    const duration = 260;
    const startTime = performance.now();
    let frameId = 0;

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(start + (end - start) * eased);
      if (progress < 1) {
        frameId = requestAnimationFrame(step);
      } else {
        setDisplay(end);
      }
    };

    frameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameId);
  }, [value]);

  return (
    <>
      {prefix}
      {display.toFixed(decimals)}
      {suffix}
    </>
  );
};

export const DashboardView: React.FC<DashboardViewProps> = ({
  run,
  isLoading,
  backendReachable,
  loadError,
  onRetry,
  onNavigate,
  onInspectEvent,
}) => {
  const [hoveredIterIndex, setHoveredIterIndex] = useState<number | null>(null);
  const [hoveredBucketLabel, setHoveredBucketLabel] = useState<string | null>(null);

  if (isLoading && !run) {
    return (
      <div className="space-y-8" aria-busy="true" aria-label="Loading Overview Dashboard">
        <div className="border-b border-slate-200/90 pb-5 space-y-2">
          <div className="h-4 w-56 bg-slate-200/80 rounded animate-pulse" />
          <div className="h-8 w-96 bg-slate-200 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="tm-card p-5 h-32 animate-pulse bg-white" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="tm-card p-6 h-80 animate-pulse bg-white" />
          <div className="tm-card p-6 h-80 animate-pulse bg-white" />
        </div>
      </div>
    );
  }

  // Empty or Backend Unavailable state — never display fabricated numbers
  if (!run) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="space-y-8"
      >
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200/90 pb-5">
          <div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 mb-1.5">
              <span>Run ID: —</span>
              <span aria-hidden="true">·</span>
              <span>Dataset: None Loaded</span>
              <span aria-hidden="true">·</span>
              <span>
                {backendReachable
                  ? 'Backend Connected (0 runs persisted)'
                  : 'Backend Unavailable'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-[26px] font-bold tracking-tight text-slate-900">
              Telemetry Anomaly &amp; Optimization Overview
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={onRetry}
              className="tm-btn-secondary px-3.5 py-2 text-xs whitespace-nowrap shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
              Retry Connection
            </button>
            <button
              type="button"
              onClick={() => onNavigate('analyze')}
              className="tm-btn-primary px-3.5 py-2 text-xs whitespace-nowrap shrink-0"
            >
              <UploadCloud className="w-3.5 h-3.5" aria-hidden="true" />
              Upload Event Log
            </button>
          </div>
        </div>

        {/* 4-Column KPI Strip with unpopulated placeholders (no fake metrics) */}
        <section
          aria-label="Key Analysis Metrics"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          <div className="tm-card p-5 flex flex-col justify-between">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-slate-500">
                  Events Analyzed (Isolation Forest)
                </div>
                <div
                  data-testid="kpi-total-events"
                  className="mt-2 text-3xl font-bold text-slate-400 font-mono tabular-nums"
                >
                  —
                </div>
              </div>
              <div className="p-2 rounded-lg bg-slate-100 text-slate-500 shrink-0">
                <Activity className="w-4 h-4" aria-hidden="true" />
              </div>
            </div>
            <p className="mt-3 pt-2.5 border-t border-slate-100 text-xs text-slate-500">
              Awaiting backend analysis response
            </p>
          </div>

          <div className="tm-card p-5 flex flex-col justify-between">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-slate-500">
                  Detected Anomalies
                </div>
                <div
                  data-testid="kpi-anomaly-count"
                  className="mt-2 text-3xl font-bold text-slate-400 font-mono tabular-nums"
                >
                  —
                </div>
              </div>
              <div className="p-2 rounded-lg bg-slate-100 text-slate-500 shrink-0">
                <AlertTriangle className="w-4 h-4" aria-hidden="true" />
              </div>
            </div>
            <p className="mt-3 pt-2.5 border-t border-slate-100 text-xs text-slate-500">
              No anomaly classifications loaded
            </p>
          </div>

          <div className="tm-card p-5 flex flex-col justify-between">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-slate-500">
                  PSO Optimal Fitness Score
                </div>
                <div
                  data-testid="kpi-pso-fitness"
                  className="mt-2 text-3xl font-bold text-slate-400 font-mono tabular-nums"
                >
                  —
                </div>
              </div>
              <div className="p-2 rounded-lg bg-slate-100 text-slate-500 shrink-0">
                <Cpu className="w-4 h-4" aria-hidden="true" />
              </div>
            </div>
            <p className="mt-3 pt-2.5 border-t border-slate-100 text-xs text-slate-500">
              No swarm optimization run loaded
            </p>
          </div>

          <div className="tm-card p-5 flex flex-col justify-between">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-slate-500">
                  Selected Remediation Action Cost
                </div>
                <div
                  data-testid="kpi-action-cost"
                  className="mt-2 text-3xl font-bold text-slate-400 font-mono tabular-nums"
                >
                  —
                </div>
              </div>
              <div className="p-2 rounded-lg bg-slate-100 text-slate-500 shrink-0">
                <DollarSign className="w-4 h-4" aria-hidden="true" />
              </div>
            </div>
            <p className="mt-3 pt-2.5 border-t border-slate-100 text-xs text-slate-500">
              No remediation policy selected
            </p>
          </div>
        </section>

        {/* Backend Unavailable / Empty State Panel */}
        <section className="tm-card p-8 sm:p-10 text-center max-w-2xl mx-auto">
          <div className="mx-auto w-11 h-11 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center mb-4">
            <ServerCrash className="w-5 h-5" aria-hidden="true" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">
            {backendReachable
              ? 'No Analysis Runs Available on Backend'
              : 'Backend Unavailable — No Analysis Data Loaded'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
            {loadError
              ? loadError
              : backendReachable
              ? 'The FastAPI backend is connected, but no event-log analysis runs have been stored yet. Upload a CSV or JSON event log to run Isolation Forest anomaly detection and PSO optimization.'
              : 'TraceMind is configured to display only real backend analysis results. Start the Python FastAPI server and retry connection, or go to Upload & Analyze once the backend is online.'}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
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
              <UploadCloud className="w-3.5 h-3.5" aria-hidden="true" />
              Go to Upload &amp; Analyze
            </button>
          </div>
        </section>
      </motion.div>
    );
  }

  const {
    isolation_forest: iforest,
    pso_optimization: pso,
    agent_recommendation: agent,
  } = run;

  const topAnomalies = [...run.events]
    .filter((e) => e.is_anomaly)
    .sort((a, b) => b.anomaly_score - a.anomaly_score)
    .slice(0, 6);

  const maxBucketTotal = Math.max(
    1,
    ...iforest.score_distribution.map((b) => b.normal_count + b.anomaly_count)
  );

  // Build SVG coordinates for PSO Convergence Curve
  const chartW = 560;
  const chartH = 195;
  const padL = 42;
  const padR = 18;
  const padT = 20;
  const padB = 30;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;

  const history = pso.convergence_history;
  const allFitnessVals = history.flatMap((h) => [
    h.global_best_fitness,
    h.swarm_mean_fitness,
  ]);
  const minFit =
    allFitnessVals.length > 0 ? Math.floor(Math.min(...allFitnessVals, 50) - 2) : 0;
  const maxFit =
    allFitnessVals.length > 0 ? Math.ceil(Math.max(...allFitnessVals, 95) + 2) : 100;
  const fitRange = Math.max(1, maxFit - minFit);

  const toX = (idx: number) =>
    padL + (idx / Math.max(1, history.length - 1)) * plotW;
  const toY = (val: number) =>
    padT + plotH - ((val - minFit) / fitRange) * plotH;

  const bestPoints = history
    .map((pt, i) => `${toX(i).toFixed(1)},${toY(pt.global_best_fitness).toFixed(1)}`)
    .join(' ');
  const meanPoints = history
    .map((pt, i) => `${toX(i).toFixed(1)},${toY(pt.swarm_mean_fitness).toFixed(1)}`)
    .join(' ');
  const areaPoints =
    history.length > 0
      ? `${toX(0).toFixed(1)},${(padT + plotH).toFixed(1)} ${bestPoints} ${toX(
          history.length - 1
        ).toFixed(1)},${(padT + plotH).toFixed(1)}`
      : '';

  const activePoint =
    hoveredIterIndex !== null && history[hoveredIterIndex]
      ? history[hoveredIterIndex]
      : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-8"
    >
      {/* Top Header & Context */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200/90 pb-5">
        <div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 mb-1.5">
            <span className="whitespace-nowrap">
              Run ID:{' '}
              <strong className="font-mono font-semibold text-slate-700">
                {run.run_id}
              </strong>
            </span>
            <span aria-hidden="true">·</span>
            <span className="whitespace-nowrap">
              Dataset:{' '}
              <strong className="font-mono font-medium text-slate-700">
                {run.dataset_name}
              </strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>Source: Live FastAPI Backend</span>
          </div>
          <h1 className="text-2xl sm:text-[26px] font-bold tracking-tight text-slate-900">
            Telemetry Anomaly &amp; Optimization Overview
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => onNavigate('investigate')}
            className="tm-btn-secondary px-3.5 py-2 text-xs whitespace-nowrap shrink-0"
          >
            Inspect All Events ({run.events.length})
          </button>
          <button
            type="button"
            onClick={() => onNavigate('investigate')}
            className="px-3.5 py-2 text-xs font-semibold text-slate-900 bg-slate-200/80 border border-slate-300/80 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            View PSO &amp; Agent Runbook
          </button>
        </div>
      </div>

      {/* 4-Column Primary KPI Strip */}
      <section
        aria-label="Key Analysis Metrics"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <div className="tm-card-interactive p-5 flex flex-col justify-between">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-slate-500">
                Events Analyzed (Isolation Forest)
              </div>
              <div className="mt-2 flex items-baseline gap-2.5">
                <span
                  data-testid="kpi-total-events"
                  className="text-3xl font-bold tracking-tight text-slate-900 font-mono tabular-nums"
                >
                  <AnimatedValue value={iforest.total_events} />
                </span>
                <span className="text-xs text-slate-500 font-mono tabular-nums">
                  {iforest.n_estimators} trees · c={iforest.contamination}
                </span>
              </div>
            </div>
            <div className="p-2 rounded-lg bg-slate-100 text-slate-700 shrink-0">
              <Activity className="w-4 h-4" aria-hidden="true" />
            </div>
          </div>
          <p className="mt-3 pt-2.5 border-t border-slate-100 text-xs text-slate-600">
            Mean anomaly score{' '}
            <span className="font-mono font-semibold text-slate-800">
              {iforest.mean_anomaly_score}
            </span>{' '}
            (max{' '}
            <span className="font-mono font-semibold text-slate-800">
              {iforest.max_anomaly_score}
            </span>
            )
          </p>
        </div>

        <div className="tm-card-interactive p-5 flex flex-col justify-between">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-slate-500">
                Detected Anomalies
              </div>
              <div className="mt-2 flex items-baseline gap-2.5">
                <span
                  data-testid="kpi-anomaly-count"
                  className="text-3xl font-bold tracking-tight text-red-600 font-mono tabular-nums"
                >
                  <AnimatedValue value={iforest.anomalous_events_count} />
                </span>
                <span className="text-xs font-semibold text-red-700 font-mono tabular-nums">
                  {iforest.anomaly_rate_pct}% of window
                </span>
              </div>
            </div>
            <div className="p-2 rounded-lg bg-red-50 text-red-600 shrink-0">
              <AlertTriangle className="w-4 h-4" aria-hidden="true" />
            </div>
          </div>
          <p className="mt-3 pt-2.5 border-t border-slate-100 text-xs text-slate-600">
            Threshold score{' '}
            <span className="font-mono font-semibold text-slate-800">
              &ge; {iforest.threshold_score}
            </span>{' '}
            ({iforest.normal_events_count} nominal records)
          </p>
        </div>

        <div className="tm-card-interactive p-5 flex flex-col justify-between">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-slate-500">
                PSO Optimal Fitness Score
              </div>
              <div className="mt-2 flex items-baseline gap-2.5">
                <span
                  data-testid="kpi-pso-fitness"
                  className="text-3xl font-bold tracking-tight text-slate-900 font-mono tabular-nums"
                >
                  <AnimatedValue value={pso.best_fitness_score} decimals={1} />
                  <span className="text-base font-normal text-slate-400">/100</span>
                </span>
                <span className="text-xs text-emerald-700 font-semibold font-mono tabular-nums">
                  Converged iter #{pso.converged_at_iteration}
                </span>
              </div>
            </div>
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600 shrink-0">
              <Cpu className="w-4 h-4" aria-hidden="true" />
            </div>
          </div>
          <p className="mt-3 pt-2.5 border-t border-slate-100 text-xs text-slate-600">
            Swarm:{' '}
            <span className="font-mono font-semibold text-slate-800">
              {pso.swarm_size}
            </span>{' '}
            particles ·{' '}
            <span className="font-mono font-semibold text-slate-800">
              {pso.max_iterations}
            </span>{' '}
            max iterations
          </p>
        </div>

        <div className="tm-card-interactive p-5 flex flex-col justify-between">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-slate-500">
                Selected Remediation Action Cost
              </div>
              <div className="mt-2 flex items-baseline gap-2.5">
                <span
                  data-testid="kpi-action-cost"
                  className="text-3xl font-bold tracking-tight text-slate-900 font-mono tabular-nums"
                >
                  <AnimatedValue value={pso.optimized_cost_usd} prefix="$" />
                </span>
                <span className="text-xs text-emerald-700 font-semibold font-mono tabular-nums">
                  -{pso.estimated_savings_pct}% vs baseline
                </span>
              </div>
            </div>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700 shrink-0">
              <DollarSign className="w-4 h-4" aria-hidden="true" />
            </div>
          </div>
          <p
            className="mt-3 pt-2.5 border-t border-slate-100 text-xs text-slate-600 truncate"
            title={pso.selected_action?.action_code}
          >
            Action:{' '}
            <span className="font-mono font-semibold text-slate-800">
              {pso.selected_action?.action_id || '—'}
            </span>{' '}
            ({pso.selected_action?.mitigation_efficacy_pct ?? 0}% efficacy)
          </p>
        </div>
      </section>

      {/* Two-Column Diagnostic Split */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Left Card: Isolation Forest Score Distribution */}
        <div className="tm-card p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  01. Isolation Forest Score Distribution
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Decision score histogram across {iforest.total_events} events (anomaly cutoff &ge;{' '}
                  <span className="font-mono font-semibold text-slate-700">
                    {iforest.threshold_score}
                  </span>
                  )
                </p>
              </div>
              <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                n_estimators={iforest.n_estimators}
              </span>
            </div>

            <div className="space-y-2.5 my-5">
              {iforest.score_distribution.map((bucket) => {
                const total = bucket.normal_count + bucket.anomaly_count;
                const normWidthPct = (bucket.normal_count / maxBucketTotal) * 100;
                const anomWidthPct = (bucket.anomaly_count / maxBucketTotal) * 100;
                const isHovered = hoveredBucketLabel === bucket.bucket_label;
                return (
                  <div
                    key={bucket.bucket_label}
                    onMouseEnter={() => setHoveredBucketLabel(bucket.bucket_label)}
                    onMouseLeave={() => setHoveredBucketLabel(null)}
                    className={`grid grid-cols-12 items-center gap-3 text-xs py-1 px-1.5 rounded-md transition-colors ${
                      isHovered ? 'bg-slate-50' : ''
                    }`}
                  >
                    <div className="col-span-3 font-mono text-slate-600 tabular-nums">
                      {bucket.bucket_label}
                    </div>
                    <div className="col-span-7 h-5 bg-slate-100 rounded-md overflow-hidden flex border border-slate-200/60">
                      {bucket.normal_count > 0 && (
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${normWidthPct}%` }}
                          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                          className="bg-slate-500 h-full"
                          title={`Normal events: ${bucket.normal_count}`}
                        />
                      )}
                      {bucket.anomaly_count > 0 && (
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${anomWidthPct}%` }}
                          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                          className="bg-red-600 h-full"
                          title={`Anomalous events: ${bucket.anomaly_count}`}
                        />
                      )}
                    </div>
                    <div className="col-span-2 text-right font-mono tabular-nums text-slate-700">
                      {total}{' '}
                      {bucket.anomaly_count > 0 && (
                        <span className="text-red-600 font-semibold">
                          ({bucket.anomaly_count}!)
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between text-xs text-slate-600 pt-2.5 border-t border-slate-100">
              <div className="flex items-center gap-6">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-2.5 h-2.5 bg-slate-500 rounded-xs" />
                  Normal Telemetry ({iforest.normal_events_count})
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-2.5 h-2.5 bg-red-600 rounded-xs" />
                  Flagged Anomalies ({iforest.anomalous_events_count})
                </span>
              </div>
              {hoveredBucketLabel && (
                <span className="font-mono text-[11px] text-slate-500">
                  Bucket {hoveredBucketLabel}
                </span>
              )}
            </div>
          </div>

          <div className="mt-6 pt-5 border-t border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-800">
                Feature Subspace Contribution &amp; Mean Shift (Anomalous vs Nominal)
              </h3>
              <span className="text-[11px] text-slate-500 font-mono">Weight %</span>
            </div>
            <div className="space-y-2.5">
              {iforest.feature_importances.map((fi) => (
                <div
                  key={fi.feature}
                  className="py-1.5 border-b border-slate-100 last:border-b-0 space-y-1"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-semibold text-slate-800">
                      {fi.feature}
                    </span>
                    <div className="flex items-center gap-3 font-mono tabular-nums">
                      <span className="text-slate-500">
                        Nominal: {fi.mean_normal_value} {fi.unit}
                      </span>
                      <span className="text-red-700 font-medium">
                        Anomaly: {fi.mean_anomalous_value} {fi.unit}
                      </span>
                      <span className="text-slate-900 font-bold w-10 text-right">
                        {fi.importance_pct}%
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${fi.importance_pct}%` }}
                      className="h-full bg-blue-600/80 rounded-full"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Card: PSO Convergence & Selected Action */}
        <div className="tm-card p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  02. Particle Swarm Optimization (PSO) Convergence
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Global best vs. swarm mean fitness trajectory over {pso.max_iterations} iterations
                </p>
              </div>
              <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded whitespace-nowrap">
                w={pso.inertia_weight} · c1={pso.cognitive_coeff} · c2={pso.social_coeff}
              </span>
            </div>

            <div className="my-3 bg-slate-50/90 border border-slate-200/90 rounded-xl p-3.5 relative">
              {activePoint && (
                <div className="absolute top-3 right-4 z-10 bg-slate-900 text-white text-[11px] font-mono px-2.5 py-1.5 rounded-md shadow-md pointer-events-none">
                  Iter #{activePoint.iteration} · Best: {activePoint.global_best_fitness} · Mean:{' '}
                  {activePoint.swarm_mean_fitness}
                </div>
              )}

              <svg
                viewBox={`0 0 ${chartW} ${chartH}`}
                className="w-full h-48 overflow-visible"
                role="img"
                aria-label="Particle Swarm Optimization Fitness Convergence Chart"
                onMouseLeave={() => setHoveredIterIndex(null)}
              >
                <defs>
                  <linearGradient id="psoAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563eb" stopOpacity="0.16" />
                    <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {[0, 0.5, 1].map((frac) => {
                  const val = minFit + frac * fitRange;
                  const y = toY(val);
                  return (
                    <g key={frac}>
                      <line
                        x1={padL}
                        y1={y}
                        x2={chartW - padR}
                        y2={y}
                        stroke="#e2e8f0"
                        strokeDasharray="3 3"
                      />
                      <text
                        x={padL - 8}
                        y={y + 4}
                        textAnchor="end"
                        className="fill-slate-500 text-[10px] font-mono"
                      >
                        {val.toFixed(0)}
                      </text>
                    </g>
                  );
                })}

                {areaPoints && <polygon points={areaPoints} fill="url(#psoAreaGrad)" />}

                {pso.converged_at_iteration <= history.length && history.length > 0 && (
                  <g>
                    <line
                      x1={toX(pso.converged_at_iteration - 1)}
                      y1={padT}
                      x2={toX(pso.converged_at_iteration - 1)}
                      y2={chartH - padB}
                      stroke="#15803d"
                      strokeWidth="1.3"
                      strokeDasharray="4 3"
                    />
                    <text
                      x={toX(pso.converged_at_iteration - 1) + 5}
                      y={padT + 10}
                      className="fill-emerald-700 text-[10px] font-mono font-semibold"
                    >
                      Converged (#{pso.converged_at_iteration})
                    </text>
                  </g>
                )}

                {meanPoints && (
                  <polyline
                    fill="none"
                    stroke="#94a3b8"
                    strokeWidth="1.75"
                    strokeDasharray="4 2"
                    points={meanPoints}
                  />
                )}

                {bestPoints && (
                  <polyline
                    fill="none"
                    stroke="#2563eb"
                    strokeWidth="2.5"
                    points={bestPoints}
                  />
                )}

                {history.map((pt, i) => {
                  const cx = toX(i);
                  const cy = toY(pt.global_best_fitness);
                  const isHovered = hoveredIterIndex === i;
                  const sliceW = plotW / Math.max(1, history.length);
                  return (
                    <g key={pt.iteration}>
                      {isHovered && (
                        <>
                          <line
                            x1={cx}
                            y1={padT}
                            x2={cx}
                            y2={chartH - padB}
                            stroke="#64748b"
                            strokeWidth="1"
                            strokeDasharray="2 2"
                          />
                          <circle
                            cx={cx}
                            cy={cy}
                            r="4"
                            fill="#2563eb"
                            stroke="#ffffff"
                            strokeWidth="1.5"
                          />
                        </>
                      )}
                      <rect
                        x={cx - sliceW / 2}
                        y={padT}
                        width={sliceW}
                        height={plotH}
                        fill="transparent"
                        className="cursor-crosshair"
                        onMouseEnter={() => setHoveredIterIndex(i)}
                      />
                    </g>
                  );
                })}

                <text
                  x={padL}
                  y={chartH - 7}
                  className="fill-slate-500 text-[10px] font-mono"
                >
                  Iter 1
                </text>
                <text
                  x={chartW - padR}
                  y={chartH - 7}
                  textAnchor="end"
                  className="fill-slate-500 text-[10px] font-mono"
                >
                  Iter {history.length}
                </text>
              </svg>

              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600 px-2 pt-1.5 border-t border-slate-200/70">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5 whitespace-nowrap font-medium text-slate-700">
                    <span className="inline-block w-3 h-0.5 bg-blue-600" />
                    Global Best ({pso.best_fitness_score})
                  </span>
                  <span className="flex items-center gap-1.5 whitespace-nowrap">
                    <span className="inline-block w-3 h-0.5 bg-slate-400" />
                    Swarm Mean
                  </span>
                </div>
                <span className="font-mono text-slate-500 whitespace-nowrap">
                  Objective: Mitigation &amp; SLA Safety
                </span>
              </div>
            </div>
          </div>

          {pso.selected_action && (
            <div className="mt-4 pt-4 border-t border-slate-200">
              <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-200/70">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-bold text-blue-950 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-600" aria-hidden="true" />
                    PSO Selected Optimal Action ({pso.selected_action.action_id})
                  </span>
                  <span className="font-mono text-emerald-700 font-bold">
                    Fitness: {pso.selected_action.composite_fitness} / 100
                  </span>
                </div>
                <div className="text-sm font-bold text-slate-900">
                  {pso.selected_action.title}
                </div>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {pso.selected_action.description}
                </p>
                <div className="mt-3 pt-2.5 border-t border-blue-200/60 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-700 font-mono tabular-nums">
                  <span>Target: {pso.selected_action.target_subsystem}</span>
                  <span aria-hidden="true">·</span>
                  <span className="text-emerald-800 font-semibold">
                    Efficacy: {pso.selected_action.mitigation_efficacy_pct}%
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>Cost: ${pso.selected_action.estimated_cost_usd}</span>
                  <span aria-hidden="true">·</span>
                  <span>SLA Risk: {pso.selected_action.sla_risk_score}/100</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Intelligent Agent Decision Synthesis */}
      <section
        aria-label="Intelligent Agent Recommendation and Explanation"
        className="tm-card p-6"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1 font-semibold text-blue-700">
                <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                Intelligent Agent Synthesis
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">{agent.agent_version}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-slate-900 font-semibold">
                Evidence coverage: {agent.evidence_coverage_pct ?? agent.confidence_score_pct}%
              </span>
            </div>
            <h2 className="text-lg font-bold text-slate-900 mt-1">
              {agent.summary_headline}
            </h2>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('investigate')}
            className="tm-btn-primary px-4 py-2 text-xs whitespace-nowrap shrink-0"
          >
            Open Execution Runbook ({agent.execution_steps.length} Steps)
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-5">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
            <h3 className="text-xs font-bold text-slate-900 mb-1.5">
              Root-Cause Telemetry Diagnosis
            </h3>
            <p className="text-sm text-slate-700 leading-relaxed">
              {agent.root_cause_analysis}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
            <h3 className="text-xs font-bold text-slate-900 mb-1.5">
              Optimization Rationale &amp; Policy Justification
            </h3>
            <p className="text-sm text-slate-700 leading-relaxed">
              {agent.why_action_selected}
            </p>
          </div>
        </div>
      </section>

      {/* High-Priority Flagged Anomalies Preview Table */}
      <section
        aria-label="Top Anomalous Events Preview"
        className="tm-card overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              03. Highest-Scoring Anomalous Events
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Click any anomalous event record to inspect its Isolation Forest path depth and feature Z-scores
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('investigate')}
            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 cursor-pointer whitespace-nowrap shrink-0"
          >
            Explore All {iforest.anomalous_events_count} Anomalies &rarr;
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/90 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4">Event ID</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Service</th>
                <th className="py-3 px-4">Primary Driver</th>
                <th className="py-3 px-4 text-right">Latency (ms)</th>
                <th className="py-3 px-4 text-right">Error Rate</th>
                <th className="py-3 px-4 text-right">CPU (%)</th>
                <th className="py-3 px-4 text-right">IForest Score</th>
                <th className="py-3 px-4">Severity</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80 text-xs">
              {topAnomalies.map((ev) => (
                <tr
                  key={ev.event_id}
                  onClick={() => onInspectEvent(ev)}
                  className="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                >
                  <td className="py-3 px-4 font-mono font-semibold text-slate-900 whitespace-nowrap">
                    {ev.event_id}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-500 tabular-nums whitespace-nowrap">
                    {ev.timestamp?.replace('T', ' ').replace('Z', '') || '—'}
                  </td>
                  <td className="py-3 px-4 font-semibold text-slate-800 whitespace-nowrap">
                    {ev.service}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-700 whitespace-nowrap">
                    {ev.primary_driver}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-900">
                    {ev.latency_ms ?? '—'}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-red-700 font-semibold">
                    {ev.error_rate == null ? '—' : `${(ev.error_rate * 100).toFixed(1)}%`}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-900">
                    {ev.cpu_pct == null ? '—' : `${ev.cpu_pct}%`}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-red-600">
                    <div className="inline-flex items-center justify-end gap-2">
                      <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden hidden sm:block">
                        <div
                          style={{
                            width: `${Math.min(100, ev.anomaly_score * 100)}%`,
                          }}
                          className="h-full bg-red-600 rounded-full"
                        />
                      </div>
                      <span>{ev.anomaly_score.toFixed(4)}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 font-semibold whitespace-nowrap">
                    {ev.severity === 'critical' ? (
                      <span className="text-red-700">Critical</span>
                    ) : ev.severity === 'high' ? (
                      <span className="text-amber-700">High</span>
                    ) : (
                      <span className="text-blue-700">Medium</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onInspectEvent(ev);
                      }}
                      className="text-blue-600 group-hover:text-blue-800 font-semibold cursor-pointer"
                    >
                      Inspect &rarr;
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </motion.div>
  );
};

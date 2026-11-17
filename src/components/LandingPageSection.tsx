import React, { useEffect, useRef, useState } from 'react';
import {
  Atom,
  BellRing,
  Bot,
  BrainCircuit,
  Check,
  Cpu,
  Crosshair,
  Database,
  DatabaseZap,
  FileCode2,
  Gauge,
  ListChecks,
  Lock,
  Network,
  Radar,
  RefreshCw,
  Route,
  ScanSearch,
  Server,
  ShieldCheck,
  Shuffle,
  Siren,
  Terminal,
  Timer,
  Trees,
  UploadCloud,
  Zap,
} from 'lucide-react';
import { NavTabId } from './Header';

interface LandingPageSectionProps {
  onNavigate: (tab: NavTabId) => void;
  backendReachable?: boolean;
  loadError?: string | null;
  onRetry?: () => void;
}

type ScenarioKey = 'a' | 'b' | 'c';
type StepKey = '1' | '2' | '3';

interface MetricItem {
  label: string;
  value: string;
  pct: number;
  color: string;
  note: string;
}

interface RunbookItem {
  id: string;
  title: string;
  detail: string;
  score: string;
  cost: string;
}

interface ScenarioData {
  incident: string;
  score: number;
  severity: string;
  color: string;
  hypothesis: string;
  confidence: string;
  evidence: string;
  spent: string;
  metrics: MetricItem[];
  runbook: RunbookItem[];
}

const CIRC = 326.7;

const SCENARIOS: Record<ScenarioKey, ScenarioData> = {
  a: {
    incident: 'RUN-4819 · auth-service',
    score: 0.74,
    severity: 'HIGH ANOMALY',
    color: '#F59E0B',
    hypothesis:
      'Downstream identity provider handshake latency is inflating latency_ms and queueing requests on the auth path.',
    confidence: '0.84',
    evidence: '964',
    spent: '$24.00',
    metrics: [
      { label: 'latency_ms (p99)', value: '1,940 ms', pct: 82, color: '#F59E0B', note: 'baseline nominal: 210 ms' },
      { label: 'error_rate', value: '2.1 %', pct: 34, color: '#22D3EE', note: 'within warning boundary' },
      { label: 'cpu_pct', value: '61.4 %', pct: 61, color: '#22D3EE', note: 'nominal utilization' },
      { label: 'memory_mb', value: '1,420 MB', pct: 58, color: '#10B981', note: 'stable memory footprint' },
    ],
    runbook: [
      {
        id: 'ACT-LATENCY',
        title: 'Inspect unusual latency patterns',
        detail: 'Read-only latency distribution and outlier investigation across upstream proxies.',
        score: '91.7%',
        cost: '$24',
      },
      {
        id: 'ACT-TIMELINE',
        title: 'Inspect correlated time window',
        detail: 'Read-only timeline review around the anomalous event windows in auth-service.',
        score: '88.3%',
        cost: '$18',
      },
      {
        id: 'ACT-SERVICE',
        title: 'Inspect anomalous service cohort',
        detail: 'Read-only grouping of anomalous records by service, endpoint, and event type.',
        score: '84.0%',
        cost: '$22',
      },
    ],
  },
  b: {
    incident: 'RUN-4821 · payment-gateway',
    score: 0.87,
    severity: 'CRITICAL ANOMALY',
    color: '#F43F5E',
    hypothesis:
      'Repeated 504 and 500 error cascades detected in payment-gateway correlating with latency degradation.',
    confidence: '0.94',
    evidence: '1,842',
    spent: '$20.00',
    metrics: [
      { label: 'status_code (5xx ratio)', value: '6.4 %', pct: 78, color: '#F43F5E', note: 'HTTP 500/504 status spikes' },
      { label: 'error_rate', value: '0.064', pct: 64, color: '#F43F5E', note: 'baseline nominal: 0.002' },
      { label: 'latency_ms', value: '842 ms', pct: 58, color: '#F59E0B', note: 'baseline nominal: 96 ms' },
      { label: 'cpu_pct', value: '47.1 %', pct: 47, color: '#10B981', note: 'non-CPU bound condition' },
    ],
    runbook: [
      {
        id: 'ACT-ERROR',
        title: 'Examine repeated error patterns',
        detail: 'Read-only aggregation of HTTP status and error-rate patterns across payment endpoints.',
        score: '94.2%',
        cost: '$20',
      },
      {
        id: 'ACT-SERVICE',
        title: 'Inspect anomalous service cohort',
        detail: 'Read-only grouping of anomalous records by service, endpoint, and event type.',
        score: '90.6%',
        cost: '$22',
      },
      {
        id: 'ACT-TIMELINE',
        title: 'Inspect correlated time window',
        detail: 'Read-only timeline review around the anomalous event windows.',
        score: '86.1%',
        cost: '$18',
      },
    ],
  },
  c: {
    incident: 'RUN-4825 · worker-node-7',
    score: 0.91,
    severity: 'CRITICAL ANOMALY',
    color: '#F43F5E',
    hypothesis: 'Severe CPU utilization and memory footprint deviation approaching host capacity limits.',
    confidence: '0.92',
    evidence: '2,317',
    spent: '$28.00',
    metrics: [
      { label: 'cpu_pct', value: '94.8 %', pct: 95, color: '#F43F5E', note: 'sustained saturation above 90%' },
      { label: 'memory_mb', value: '7,850 MB', pct: 91, color: '#F43F5E', note: 'approaching 8GB node boundary' },
      { label: 'latency_ms', value: '1,280 ms', pct: 68, color: '#F59E0B', note: 'queueing delay from worker backpressure' },
      { label: 'payload_bytes', value: '480 KB', pct: 42, color: '#10B981', note: 'nominal message sizes' },
    ],
    runbook: [
      {
        id: 'ACT-RESOURCE',
        title: 'Analyze CPU and memory deviations',
        detail: 'Read-only comparison of CPU and memory telemetry against nominal baseline records.',
        score: '95.8%',
        cost: '$28',
      },
      {
        id: 'ACT-TIMELINE',
        title: 'Inspect correlated time window',
        detail: 'Read-only timeline review around the resource exhaustion inflection point.',
        score: '92.4%',
        cost: '$18',
      },
      {
        id: 'ACT-SERVICE',
        title: 'Inspect anomalous service cohort',
        detail: 'Read-only grouping of anomalous records by worker process and task type.',
        score: '87.9%',
        cost: '$22',
      },
    ],
  },
};

const STEPS: Record<
  StepKey,
  {
    kicker: string;
    title: string;
    text: string;
    points: string[];
    codeTitle: string;
    code: string;
  }
> = {
  '1': {
    kicker: 'STEP 01 — INGESTION & VALIDATION',
    title: 'Upload Telemetry & Strict Schema Check',
    text: 'Submit UTF-8 CSV or JSON event logs up to 25 MB. The FastAPI ingestion pipeline enforces required fields (event_id, timestamp, service, latency_ms, error_rate, cpu_pct, memory_mb, payload_bytes, status_code). Invalid records immediately fail with 422—no corrupted rows are silently discarded.',
    points: [
      'CSV (with header) or JSON array format supported',
      'Strict validation: latency ≥ 0, error_rate 0..1, cpu 0..100',
      'FastAPI multipart or application/json payload handling',
    ],
    codeTitle: 'POST /api/analyze',
    code: `POST /api/analyze
Content-Type: multipart/form-data

file: telemetry_events.csv (24.8 MB)
dataset_name: "prod-auth-cluster"
format: "CSV"

→ 200 OK
→ { "run_id": "RUN-4821",
    "total_events": 142850,
    "anomaly_rate_pct": 3.82 }`,
  },
  '2': {
    kicker: 'STEP 02 — ISOLATION FOREST DETECTION',
    title: 'Continuous Telemetry Anomaly Scoring',
    text: 'Scikit-Learn Isolation Forest scores continuous metrics jointly: latency_ms, error_rate, cpu_pct, memory_mb, payload_bytes, and a derived binary HTTP error indicator. The backend normalizes -decision_function to an anomaly_score in [0, 1] for deterministic thresholding.',
    points: [
      'Continuous telemetry standardized with StandardScaler',
      'HTTP status codes treated as categorical error flags',
      'Calibrated anomaly score in [0..1] with feature importances',
    ],
    codeTitle: 'AnalysisOrchestrator — Model Output',
    code: `IsolationForest(
  n_estimators=100,
  contamination=0.05,
  random_state=42
).fit(features)

→ normalized_score: 0.87  [ANOMALY]
→ top_features: [error_rate, latency_ms]
→ evaluated_events: 142,850`,
  },
  '3': {
    kicker: 'STEP 03 — BINARY PSO & ADVISORY AGENT',
    title: 'Swarm Action Selection & Atomic SQLite Persistence',
    text: 'Binary PSO searches the 5 read-only action candidates (ACT-SERVICE, ACT-TIMELINE, ACT-RESOURCE, ACT-ERROR, ACT-LATENCY) under a $50 notional budget cap. The deterministic agent generates hypotheses and runbooks, and the entire run is persisted atomically in SQLite.',
    points: [
      'Deterministic Fitness: 0.60·Benefit − 0.18·Cost − 0.15·Risk − 0.07·Latency',
      '100% read-only catalog: zero external mutation risk',
      'Atomically saved to data/tracemind.db for replay & audit',
    ],
    codeTitle: 'BinaryPSO & SQLite Repository',
    code: `BinaryPSO(particles=30, budget=50.0).optimize()

→ selected_action: "ACT-ERROR"
→ title: "Examine repeated error patterns"
→ fitness_score: 0.942 · cost: $20.00
→ database: committed to tracemind.db`,
  },
};

export const LandingPageSection: React.FC<LandingPageSectionProps> = ({
  onNavigate,
  backendReachable = true,
  loadError,
  onRetry,
}) => {
  const [selectedScenario, setSelectedScenario] = useState<ScenarioKey>('b');
  const [selectedStep, setSelectedStep] = useState<StepKey>('1');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Canvas waveform animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let t = 0;
    let animId: number;

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.min(1600, Math.max(1, Math.round(r.width * dpr)));
      canvas.height = Math.min(600, Math.max(1, Math.round(r.height * dpr)));
    };

    const series = (base: number, amp: number, freq: number, noise: number, tt: number) => {
      const pts: number[] = [];
      for (let x = 0; x <= 100; x++) {
        const spike = x > 62 && x < 88 ? Math.sin(((x - 62) / 26) * Math.PI) * amp * 1.9 : 0;
        const y =
          base +
          Math.sin(x * freq + tt) * amp * 0.35 +
          Math.sin(x * 0.31 + tt * 1.7) * amp * 0.22 +
          spike +
          (Math.random() - 0.5) * noise;
        pts.push(y);
      }
      return pts;
    };

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // grid
      ctx.strokeStyle = 'rgba(51,65,85,.35)';
      ctx.lineWidth = 1;
      for (let gy = 1; gy < 4; gy++) {
        ctx.beginPath();
        ctx.moveTo(0, (h * gy) / 4);
        ctx.lineTo(w, (h * gy) / 4);
        ctx.stroke();
      }

      const plot = (pts: number[], color: string, fill?: string) => {
        ctx.beginPath();
        pts.forEach((y, i) => {
          const px = (i / 100) * w;
          const py = h - (y / 100) * h;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(1.5, h * 0.018);
        ctx.stroke();
        if (fill) {
          ctx.lineTo(w, h);
          ctx.lineTo(0, h);
          ctx.closePath();
          ctx.fillStyle = fill;
          ctx.fill();
        }
      };

      plot(series(28, 14, 0.16, 3, t), '#22D3EE', 'rgba(34,211,238,.08)');
      plot(series(14, 8, 0.11, 2, t * 0.8), '#F43F5E', 'rgba(244,63,94,.07)');
      t += 0.045;

      animId = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener('resize', resize);
    animId = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animId);
    };
  }, []);

  const curScenario = SCENARIOS[selectedScenario];
  const curStep = STEPS[selectedStep];

  return (
    <div className="w-full text-slate-100">
      {/* ══════════════ FULL-BLEED HERO SECTION ══════════════ */}
      <section className="relative overflow-hidden border-b border-slate-800/60 bg-[#060913] pt-10 pb-16 sm:pt-14 sm:pb-20 px-4 sm:px-6 lg:px-8">
        <div
          className="absolute inset-0 pointer-events-none opacity-40"
          style={{
            backgroundImage:
              'linear-gradient(rgba(34,211,238,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,.06) 1px, transparent 1px)',
            backgroundSize: '44px 44px',
            maskImage: 'radial-gradient(ellipse 90% 70% at 50% 0%, #000 60%, transparent 100%)',
            WebkitMaskImage: 'radial-gradient(ellipse 90% 70% at 50% 0%, #000 60%, transparent 100%)',
          }}
        />
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[720px] h-[360px] rounded-full bg-cyan-500/10 blur-[120px] pointer-events-none" />

        <div className="relative z-10 max-w-4xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-700/80 bg-slate-900/80 font-mono text-xs text-slate-300">
            <span
              className={`w-2 h-2 rounded-full ${backendReachable ? 'bg-emerald-400 shadow-[0_0_10px_#34d399]' : 'bg-rose-400'}`}
            />
            Isolation Forest <span className="text-slate-600">×</span> Binary PSO{' '}
            <span className="text-slate-600">×</span> Deterministic Agent
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.08]">
            Stop Hunting Needles in Log Stacks.
            <br />
            Start <span className="text-cyan-400">Intelligent Incident Triage.</span>
          </h1>

          <p className="max-w-2xl mx-auto text-base sm:text-lg text-slate-400 leading-relaxed">
            TraceMind turns millions of noisy system logs into deterministic, evidence-bound incident investigations in
            seconds. Unsupervised <span className="text-slate-200 font-medium">Isolation Forest</span> isolates anomalies,{' '}
            <span className="text-slate-200 font-medium">Binary PSO</span> ranks read-only investigation paths, and an advisory
            agent delivers a proof-backed runbook.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => onNavigate('analyze')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold shadow-[0_0_24px_rgba(6,182,212,0.6)] transition-all cursor-pointer"
            >
              <UploadCloud className="w-5 h-5" /> Analyze Logs Now
            </button>
            <a
              href="#simulator"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl border border-slate-700 bg-slate-900/60 hover:border-cyan-500/50 text-white font-semibold transition-all cursor-pointer"
            >
              <Zap className="w-5 h-5 text-cyan-400" /> Live Incident Simulator
            </a>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl border border-slate-700 hover:border-slate-500 text-slate-300 font-medium transition-all cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" /> Check Backend
              </button>
            )}
          </div>

          {loadError && (
            <p className="text-xs text-rose-300 bg-rose-950/40 border border-rose-900/60 rounded-lg p-2 max-w-md mx-auto">
              {loadError}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 font-mono text-xs text-slate-400 pt-2">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" /> Zero Destructive Actions (Read-Only)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Database className="w-4 h-4 text-cyan-400" /> Atomic SQLite Persistence
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Timer className="w-4 h-4 text-indigo-400" /> Sub-Second Ingestion &amp; Scoring
            </span>
          </div>

          {/* ── Mockup Card in Hero ── */}
          <div className="pt-8 text-left">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/90 shadow-[0_0_35px_-8px_rgba(6,182,212,0.35)] overflow-hidden">
              <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-slate-800/80 bg-slate-900/60">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-rose-500/80" />
                  <span className="w-3 h-3 rounded-full bg-amber-500/80" />
                  <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
                  <span className="ml-3 font-mono text-xs text-slate-400">tracemind — telemetry pipeline · RUN-4821</span>
                </div>
                <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> LIVE STREAMING
                </span>
              </div>

              <div className="grid md:grid-cols-5 gap-0">
                {/* Gauge Left */}
                <div className="md:col-span-2 p-5 sm:p-6 border-b md:border-b-0 md:border-r border-slate-800/70 flex flex-col items-center justify-center">
                  <p className="font-mono text-[11px] tracking-widest text-slate-500 uppercase self-start">
                    Normalized Anomaly Score
                  </p>
                  <div className="relative mt-2 w-[160px] h-[160px]">
                    <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                      <circle cx="60" cy="60" r="52" fill="none" stroke="#1E293B" strokeWidth="10" />
                      <circle
                        cx="60"
                        cy="60"
                        r="52"
                        fill="none"
                        stroke="#F43F5E"
                        strokeWidth="10"
                        strokeLinecap="round"
                        strokeDasharray={CIRC}
                        strokeDashoffset="42.5"
                        style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="font-mono text-4xl font-bold text-white">0.87</span>
                      <span className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono text-[10px] font-semibold bg-rose-950/60 text-rose-400 border border-rose-800/50">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" /> CRITICAL
                      </span>
                    </div>
                  </div>
                  <p className="font-mono text-xs text-slate-500 text-center mt-2">
                    Isolation Forest · Continuous Telemetry
                    <br />
                    normalized -decision_function [0..1]
                  </p>
                </div>

                {/* Waveform & PSO Right */}
                <div className="md:col-span-3 p-5 sm:p-6 flex flex-col gap-4">
                  <div>
                    <div className="flex items-center justify-between">
                      <p className="font-mono text-[11px] tracking-widest text-slate-500 uppercase">
                        Continuous Telemetry — payment-gateway
                      </p>
                      <div className="flex gap-4 font-mono text-[11px]">
                        <span className="text-cyan-400">— latency 842ms</span>
                        <span className="text-rose-400">— error_rate 6.4%</span>
                      </div>
                    </div>
                    <div className="relative mt-2 h-[95px] rounded-lg bg-black/40 border border-slate-800/80 overflow-hidden">
                      <canvas ref={canvasRef} className="w-full h-full block" />
                    </div>
                  </div>

                  <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/20 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/40 shrink-0">
                          <Crosshair className="w-4 h-4 text-indigo-300" />
                        </span>
                        <div>
                          <p className="font-mono text-[10px] tracking-widest text-indigo-300 uppercase">
                            PSO Selected Action · ACT-ERROR
                          </p>
                          <p className="mt-0.5 font-semibold text-white text-sm">Examine repeated error patterns</p>
                          <p className="font-mono text-xs text-slate-400 mt-1">
                            Read-only aggregation of HTTP status and error-rate patterns.
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-mono text-base font-bold text-emerald-400">Fitness 94.2%</p>
                        <p className="font-mono text-[11px] text-slate-400">
                          Cost: <span className="text-emerald-400 font-semibold">$20</span> · Risk: 7
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 font-mono text-center">
                    <div className="rounded-lg bg-slate-900/60 border border-slate-800 py-2">
                      <p className="text-sm font-bold text-white">25 MB</p>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider">upload limit</p>
                    </div>
                    <div className="rounded-lg bg-slate-900/60 border border-slate-800 py-2">
                      <p className="text-sm font-bold text-white">&lt; $50</p>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider">PSO budget cap</p>
                    </div>
                    <div className="rounded-lg bg-slate-900/60 border border-slate-800 py-2">
                      <p className="text-sm font-bold text-emerald-400">0</p>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider">mutations (read-only)</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════ BODY SECTIONS CONTAINER ══════════════ */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-16">

      {/* ══════════════ PROBLEM vs SOLUTION ══════════════ */}
      <section className="grid lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-slate-800 bg-[#0B0F19] p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-rose-500/10 border border-rose-500/30">
              <Siren className="w-5 h-5 text-rose-400" />
            </span>
            <h3 className="text-lg font-semibold text-white">The Old Way</h3>
            <span className="ml-auto font-mono text-[11px] text-rose-400 border border-rose-500/30 bg-rose-500/10 rounded px-2 py-0.5">
              MTTR: Hours
            </span>
          </div>
          <ul className="mt-6 space-y-4 text-sm text-slate-300">
            <li className="flex gap-3">
              <BellRing className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <p>
                <span className="font-semibold text-white">Alert fatigue.</span> Static thresholds fire on every traffic
                spike, drowning real incidents in hundreds of lookalike notifications.
              </p>
            </li>
            <li className="flex gap-3">
              <Shuffle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <p>
                <span className="font-semibold text-white">Chaotic triage.</span> Engineers grep millions of lines across five
                dashboards, reconstructing timelines from memory under stress.
              </p>
            </li>
            <li className="flex gap-3">
              <Terminal className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <p>
                <span className="font-semibold text-white">Ad-hoc mutation scripts.</span> Unplanned restart or kill commands run
                against production with unverified consequences.
              </p>
            </li>
          </ul>
        </div>

        <div className="rounded-2xl border border-cyan-500/30 bg-[#0B0F19] p-6 sm:p-8 shadow-[0_0_35px_-12px_rgba(6,182,212,0.4)]">
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/40">
              <Radar className="w-5 h-5 text-cyan-400" />
            </span>
            <h3 className="text-lg font-semibold text-white">The TraceMind Way</h3>
            <span className="ml-auto font-mono text-[11px] text-emerald-400 border border-emerald-500/30 bg-emerald-500/10 rounded px-2 py-0.5">
              MTTR: Seconds
            </span>
          </div>
          <ul className="mt-6 space-y-4 text-sm text-slate-300">
            <li className="flex gap-3">
              <Trees className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
              <p>
                <span className="font-semibold text-white">Unsupervised Isolation Forest.</span> Joint continuous scoring over
                latency, error rate, CPU, memory, and payload — zero manual threshold drift.
              </p>
            </li>
            <li className="flex gap-3">
              <Route className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
              <p>
                <span className="font-semibold text-white">Binary PSO Action Optimizer.</span> Multi-objective swarm search
                balancing Benefit, Cost, Risk, and Latency under a defined $50 analysis budget.
              </p>
            </li>
            <li className="flex gap-3">
              <ShieldCheck className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
              <p>
                <span className="font-semibold text-white">Read-only, proof-backed runbooks.</span> All recommendations are
                bound to observed telemetry and catalog actions. Never mutates production.
              </p>
            </li>
          </ul>
        </div>
      </section>

      {/* ══════════════ CORE PILLARS ══════════════ */}
      <section className="space-y-6">
        <div>
          <p className="font-mono text-xs tracking-widest text-cyan-400 uppercase">System Capabilities</p>
          <h2 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-white">
            The Four Core Pillars of TraceMind
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 gap-6">
          <article className="rounded-2xl border border-slate-800 bg-[#0B0F19] p-6 hover:border-cyan-500/40 transition">
            <span className="flex items-center justify-center w-11 h-11 rounded-xl bg-cyan-500/10 border border-cyan-500/40">
              <Trees className="w-5 h-5 text-cyan-400" />
            </span>
            <h3 className="mt-4 text-lg font-semibold text-white">1. Isolation Forest Telemetry Engine</h3>
            <p className="mt-2 text-sm text-slate-400 leading-relaxed">
              Standardized continuous telemetry analysis across latency_ms, error_rate, cpu_pct, memory_mb, and
              payload_bytes, with a derived binary HTTP-error indicator. Normalized score in [0..1] ensures clear
              severity classification.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 font-mono text-[10px] text-slate-400">
              <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800">Scikit-Learn</span>
              <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800">StandardScaler</span>
              <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800">Unsupervised</span>
            </div>
          </article>

          <article className="rounded-2xl border border-slate-800 bg-[#0B0F19] p-6 hover:border-indigo-500/40 transition">
            <span className="flex items-center justify-center w-11 h-11 rounded-xl bg-indigo-500/10 border border-indigo-500/40">
              <Network className="w-5 h-5 text-indigo-300" />
            </span>
            <h3 className="mt-4 text-lg font-semibold text-white">2. Binary PSO Action Optimizer</h3>
            <p className="mt-2 text-sm text-slate-400 leading-relaxed">
              Particle Swarm Optimization searches the 5 read-only action candidates. Positions are budget-limited to 2
              actions and a $50 notional cap. Fitness maximizes expected benefit while penalizing normalized cost, risk,
              and latency.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 font-mono text-[10px] text-slate-400">
              <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800">0.60·Benefit − 0.18·Cost</span>
              <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800">−0.15·Risk − 0.07·Latency</span>
              <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800">Max 2 Actions</span>
            </div>
          </article>

          <article className="rounded-2xl border border-slate-800 bg-[#0B0F19] p-6 hover:border-emerald-500/40 transition">
            <span className="flex items-center justify-center w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/40">
              <Bot className="w-5 h-5 text-emerald-400" />
            </span>
            <h3 className="mt-4 text-lg font-semibold text-white">3. Deterministic Evidence-Bound Agent</h3>
            <p className="mt-2 text-sm text-slate-400 leading-relaxed">
              Advisory and evidence-bound. Distinguishes model findings from possible root-cause hypotheses. Only
              recommends actions from the declared read-only investigation catalog: service cohort, time window, resource
              deviation, error pattern, or latency pattern.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 font-mono text-[10px] text-slate-400">
              <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800">Zero Hallucinations</span>
              <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800">5 Read-Only Actions</span>
              <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800">Safety Guardrails</span>
            </div>
          </article>

          <article className="rounded-2xl border border-slate-800 bg-[#0B0F19] p-6 hover:border-amber-500/40 transition">
            <span className="flex items-center justify-center w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/40">
              <Database className="w-5 h-5 text-amber-400" />
            </span>
            <h3 className="mt-4 text-lg font-semibold text-white">4. Atomic SQLite Persistence &amp; Audit</h3>
            <p className="mt-2 text-sm text-slate-400 leading-relaxed">
              Persists completed runs atomically to SQLite via SQLAlchemy repository isolation. Enables full historical
              comparison, event-level forensics, CSV/JSON export, and cascade deletion of runs and dependent evaluated events.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 font-mono text-[10px] text-slate-400">
              <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800">SQLite + SQLAlchemy</span>
              <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800">GET /api/history</span>
              <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800">Atomic Cascade Delete</span>
            </div>
          </article>
        </div>
      </section>

      {/* ══════════════ LIVE SIMULATOR ══════════════ */}
      <section id="simulator" className="rounded-2xl border border-slate-800 bg-[#0B0F19] p-6 sm:p-8 space-y-6">
        <div>
          <p className="font-mono text-xs tracking-widest text-cyan-400 uppercase">Interactive Simulator</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-white">Pick an incident. Watch TraceMind think.</h2>
          <p className="mt-2 text-sm text-slate-400">
            Simulating the exact response payload of <code className="text-cyan-400 font-mono">POST /api/analyze</code>. Switch
            scenarios to observe score and PSO action convergence.
          </p>
        </div>

        {/* Scenario buttons */}
        <div className="grid md:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => setSelectedScenario('a')}
            className={`rounded-xl p-4 text-left border transition cursor-pointer ${
              selectedScenario === 'a'
                ? 'border-cyan-500/80 bg-cyan-950/20 shadow-[0_0_20px_rgba(6,182,212,0.3)]'
                : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] text-slate-500">SCENARIO A</span>
              <span className="font-mono text-[10px] font-semibold text-amber-400 border border-amber-500/40 bg-amber-500/10 rounded px-1.5 py-0.5">
                0.74 HIGH
              </span>
            </div>
            <p className="mt-2 font-semibold text-white text-sm flex items-center gap-2">
              <Gauge className="w-4 h-4 text-amber-400" /> Latency Spike
            </p>
            <p className="mt-1 text-xs text-slate-400 font-mono">auth-service · latency_ms</p>
          </button>

          <button
            type="button"
            onClick={() => setSelectedScenario('b')}
            className={`rounded-xl p-4 text-left border transition cursor-pointer ${
              selectedScenario === 'b'
                ? 'border-cyan-500/80 bg-cyan-950/20 shadow-[0_0_20px_rgba(6,182,212,0.3)]'
                : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] text-slate-500">SCENARIO B</span>
              <span className="font-mono text-[10px] font-semibold text-rose-400 border border-rose-500/40 bg-rose-500/10 rounded px-1.5 py-0.5">
                0.87 CRITICAL
              </span>
            </div>
            <p className="mt-2 font-semibold text-white text-sm flex items-center gap-2">
              <DatabaseZap className="w-4 h-4 text-rose-400" /> 5xx Error Surge
            </p>
            <p className="mt-1 text-xs text-slate-400 font-mono">payment-gateway · status 504</p>
          </button>

          <button
            type="button"
            onClick={() => setSelectedScenario('c')}
            className={`rounded-xl p-4 text-left border transition cursor-pointer ${
              selectedScenario === 'c'
                ? 'border-cyan-500/80 bg-cyan-950/20 shadow-[0_0_20px_rgba(6,182,212,0.3)]'
                : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] text-slate-500">SCENARIO C</span>
              <span className="font-mono text-[10px] font-semibold text-rose-400 border border-rose-500/40 bg-rose-500/10 rounded px-1.5 py-0.5">
                0.91 CRITICAL
              </span>
            </div>
            <p className="mt-2 font-semibold text-white text-sm flex items-center gap-2">
              <Cpu className="w-4 h-4 text-rose-400" /> CPU &amp; Memory Deviation
            </p>
            <p className="mt-1 text-xs text-slate-400 font-mono">worker-node-7 · cpu_pct &amp; memory</p>
          </button>
        </div>

        {/* Panel Detail */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/80 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800 bg-slate-900/60 font-mono text-xs text-slate-400">
            <span>{curScenario.incident}</span>
            <span className="text-emerald-400 inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> READ-ONLY INVESTIGATION
            </span>
          </div>

          <div className="grid lg:grid-cols-5 gap-0">
            {/* Score & Metrics */}
            <div className="lg:col-span-2 p-5 border-b lg:border-b-0 lg:border-r border-slate-800 space-y-5">
              <div className="flex items-center gap-4">
                <div className="relative w-20 h-20 shrink-0">
                  <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                    <circle cx="60" cy="60" r="52" fill="none" stroke="#1E293B" strokeWidth="11" />
                    <circle
                      cx="60"
                      cy="60"
                      r="52"
                      fill="none"
                      stroke={curScenario.color}
                      strokeWidth="11"
                      strokeLinecap="round"
                      strokeDasharray={CIRC}
                      strokeDashoffset={(CIRC * (1 - curScenario.score)).toFixed(1)}
                      style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="font-mono text-xl font-bold text-white">{curScenario.score.toFixed(2)}</span>
                    <span
                      className={`font-mono text-[9px] font-semibold ${
                        curScenario.score >= 0.85 ? 'text-rose-400' : 'text-amber-400'
                      }`}
                    >
                      {curScenario.severity.split(' ')[0]}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="font-mono text-[10px] tracking-widest text-slate-500 uppercase">Root-cause hypothesis</p>
                  <p className="mt-1 text-xs font-medium text-slate-100 leading-snug">{curScenario.hypothesis}</p>
                  <p className="mt-1.5 font-mono text-[10px] text-slate-500">
                    confidence <span className="text-cyan-400 font-semibold">{curScenario.confidence}</span> · anomalous{' '}
                    <span className="text-cyan-400 font-semibold">{curScenario.evidence}</span>
                  </p>
                </div>
              </div>

              <div className="space-y-3 pt-2 border-t border-slate-900">
                {curScenario.metrics.map((m) => (
                  <div key={m.label}>
                    <div className="flex items-baseline justify-between font-mono text-xs">
                      <span className="text-slate-400 uppercase tracking-wider text-[11px]">{m.label}</span>
                      <span className="font-semibold text-white">{m.value}</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${m.pct}%`, backgroundColor: m.color }}
                      />
                    </div>
                    <p className="mt-0.5 font-mono text-[10px] text-slate-500">{m.note}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Runbook Right */}
            <div className="lg:col-span-3 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="font-mono text-[11px] tracking-widest text-slate-500 uppercase flex items-center gap-1.5">
                  <ListChecks className="w-4 h-4 text-cyan-400" /> PSO Selected Action &amp; Runbook
                </p>
                <span className="font-mono text-xs text-slate-400">
                  budget <span className="text-slate-200">$50.00</span> · spent{' '}
                  <span className="text-emerald-400">{curScenario.spent}</span>
                </span>
              </div>

              <ol className="space-y-2.5">
                {curScenario.runbook.map((r, i) => (
                  <li key={r.id} className="flex gap-3 rounded-xl border border-slate-800/80 bg-slate-900/40 p-3.5">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-500/20 border border-indigo-500/40 font-mono text-xs font-bold text-indigo-300 shrink-0">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-1">
                        <p className="font-semibold text-white text-xs">
                          {r.title} <span className="font-mono text-[10px] text-slate-500">({r.id})</span>
                        </p>
                        <span className="font-mono text-[11px] text-slate-400">
                          Fitness <span className="text-emerald-400 font-semibold">{r.score}</span> · Cost{' '}
                          <span className="text-emerald-400 font-semibold">{r.cost}</span>
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-400 leading-relaxed">{r.detail}</p>
                    </div>
                  </li>
                ))}
              </ol>

              <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 px-3.5 py-2.5 flex items-start gap-2.5 text-xs text-slate-300">
                <Lock className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <p>
                  <strong className="text-emerald-400">Safety Policy:</strong> TraceMind executes zero state mutations
                  against infrastructure (<code className="text-cyan-400">POST /actions/simulate</code> unsupported). All actions
                  are 100% read-only inspections.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════ HOW IT WORKS (3 Steps) ══════════════ */}
      <section className="space-y-6">
        <div>
          <p className="font-mono text-xs tracking-widest text-cyan-400 uppercase">Pipeline Workflow</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-white">From raw telemetry to an optimal plan in 3 steps</h2>
        </div>

        <div className="grid lg:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => setSelectedStep('1')}
            className={`rounded-xl p-4 text-left border transition cursor-pointer ${
              selectedStep === '1'
                ? 'border-cyan-500/80 bg-cyan-950/20 shadow-[0_0_20px_rgba(6,182,212,0.3)]'
                : 'border-slate-800 bg-[#0B0F19] hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/40">
                <UploadCloud className="w-4 h-4 text-cyan-400" />
              </span>
              <span className="font-mono text-xs text-slate-500">STEP 01</span>
            </div>
            <p className="mt-3 font-semibold text-white text-sm">Upload &amp; Validate</p>
            <p className="mt-1 text-xs text-slate-400">CSV or JSON payload. Strict validation over 9 required schema fields.</p>
          </button>

          <button
            type="button"
            onClick={() => setSelectedStep('2')}
            className={`rounded-xl p-4 text-left border transition cursor-pointer ${
              selectedStep === '2'
                ? 'border-cyan-500/80 bg-cyan-950/20 shadow-[0_0_20px_rgba(6,182,212,0.3)]'
                : 'border-slate-800 bg-[#0B0F19] hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/30">
                <ScanSearch className="w-4 h-4 text-rose-400" />
              </span>
              <span className="font-mono text-xs text-slate-500">STEP 02</span>
            </div>
            <p className="mt-3 font-semibold text-white text-sm">Isolation Forest Scoring</p>
            <p className="mt-1 text-xs text-slate-400">Standardized continuous telemetry scoring with normalized anomaly scores.</p>
          </button>

          <button
            type="button"
            onClick={() => setSelectedStep('3')}
            className={`rounded-xl p-4 text-left border transition cursor-pointer ${
              selectedStep === '3'
                ? 'border-cyan-500/80 bg-cyan-950/20 shadow-[0_0_20px_rgba(6,182,212,0.3)]'
                : 'border-slate-800 bg-[#0B0F19] hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/40">
                <Route className="w-4 h-4 text-indigo-300" />
              </span>
              <span className="font-mono text-xs text-slate-500">STEP 03</span>
            </div>
            <p className="mt-3 font-semibold text-white text-sm">PSO Optimization &amp; Storage</p>
            <p className="mt-1 text-xs text-slate-400">Binary PSO selects optimal read-only action; run is saved to SQLite.</p>
          </button>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#0B0F19] p-6 sm:p-8">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <p className="font-mono text-xs text-cyan-400">{curStep.kicker}</p>
              <h3 className="mt-2 text-2xl font-bold text-white">{curStep.title}</h3>
              <p className="mt-3 text-slate-400 leading-relaxed text-sm">{curStep.text}</p>
              <ul className="mt-5 space-y-2 text-sm text-slate-300">
                {curStep.points.map((p) => (
                  <li key={p} className="flex gap-2.5">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl bg-black/60 border border-slate-800 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800">
                <span className="font-mono text-xs text-slate-400">{curStep.codeTitle}</span>
                <span className="font-mono text-[10px] text-emerald-400 border border-emerald-500/30 bg-emerald-500/10 rounded px-1.5 py-0.5">
                  200 OK
                </span>
              </div>
              <pre className="p-4 overflow-x-auto font-mono text-xs leading-relaxed text-slate-300">
                {curStep.code}
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════ ARCHITECTURE / TECH STACK ══════════════ */}
      <section className="rounded-2xl border border-slate-800 bg-[#0B0F19] p-6 sm:p-8 space-y-6">
        <div>
          <p className="font-mono text-xs tracking-widest text-cyan-400 uppercase">Architecture Transparency</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-white">Full-Stack Data Flow &amp; Persistence</h2>
          <p className="mt-2 text-sm text-slate-400">
            Clean architectural separation: React/Vite UI, FastAPI asynchronous routes, AnalysisOrchestrator pipeline, and
            atomic SQLite repository.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
          <div className="flex-1 rounded-xl bg-slate-900/60 border border-slate-800 p-4 text-center">
            <Atom className="w-6 h-6 text-cyan-400 mx-auto" />
            <p className="mt-2 font-mono text-xs font-semibold text-white">React 18 / Vite</p>
            <p className="font-mono text-[10px] text-slate-500 mt-0.5">/api Proxy · UI Layer</p>
          </div>
          <div className="hidden lg:flex items-center justify-center text-cyan-400 font-mono text-sm px-1">→</div>
          <div className="flex-1 rounded-xl bg-slate-900/60 border border-cyan-500/30 p-4 text-center">
            <Server className="w-6 h-6 text-cyan-400 mx-auto" />
            <p className="mt-2 font-mono text-xs font-semibold text-white">FastAPI Routes</p>
            <p className="font-mono text-[10px] text-slate-500 mt-0.5">Ingestion &amp; Validation</p>
          </div>
          <div className="hidden lg:flex items-center justify-center text-indigo-400 font-mono text-sm px-1">→</div>
          <div className="flex-1 rounded-xl bg-slate-900/60 border border-indigo-500/30 p-4 text-center">
            <BrainCircuit className="w-6 h-6 text-indigo-300 mx-auto" />
            <p className="mt-2 font-mono text-xs font-semibold text-white">Orchestrator</p>
            <p className="font-mono text-[10px] text-slate-500 mt-0.5">Isolation Forest + PSO</p>
          </div>
          <div className="hidden lg:flex items-center justify-center text-emerald-400 font-mono text-sm px-1">→</div>
          <div className="flex-1 rounded-xl bg-slate-900/60 border border-emerald-500/30 p-4 text-center">
            <Database className="w-6 h-6 text-emerald-400 mx-auto" />
            <p className="mt-2 font-mono text-xs font-semibold text-white">SQLAlchemy Repo</p>
            <p className="font-mono text-[10px] text-slate-500 mt-0.5">Atomic SQLite Storage</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 font-mono text-xs text-slate-200">
            <Atom className="w-3.5 h-3.5 text-cyan-400" /> React 18
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 font-mono text-xs text-slate-200">
            <Zap className="w-3.5 h-3.5 text-amber-400" /> Vite
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 font-mono text-xs text-slate-200">
            <Server className="w-3.5 h-3.5 text-emerald-400" /> FastAPI
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 font-mono text-xs text-slate-200">
            <FileCode2 className="w-3.5 h-3.5 text-cyan-400" /> Python 3.11+
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 font-mono text-xs text-slate-200">
            <BrainCircuit className="w-3.5 h-3.5 text-indigo-300" /> Scikit-Learn
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 font-mono text-xs text-slate-200">
            <Database className="w-3.5 h-3.5 text-amber-400" /> SQLite 3
          </span>
        </div>
      </section>
      </div>
    </div>
  );
};

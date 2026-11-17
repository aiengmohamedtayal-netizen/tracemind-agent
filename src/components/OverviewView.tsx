import React, { lazy, Suspense } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Activity, ArrowUpRight, Database, Fingerprint, ScanSearch, UploadCloud, Waves } from 'lucide-react';
import { AnalysisRun, EvaluatedEventRecord } from '../types/tracemind';
import { NavTabId } from './Header';

const LandingPageSection = lazy(() =>
  import('./LandingPageSection').then((m) => ({ default: m.LandingPageSection }))
);

interface OverviewViewProps {
  run: AnalysisRun | null;
  isLoading: boolean;
  backendReachable: boolean;
  loadError: string | null;
  onRetry: () => void;
  onNavigate: (tab: NavTabId) => void;
  onInspectEvent: (event: EvaluatedEventRecord) => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({run,isLoading,backendReachable,loadError,onRetry,onNavigate,onInspectEvent}) => {
  const reduceMotion = useReducedMotion();
  const enter = reduceMotion ? {} : { initial:{opacity:0,y:16}, animate:{opacity:1,y:0}, transition:{duration:.55,ease:[.22,1,.36,1] as const} };
  if (isLoading && !run) return <div className="min-h-[55vh] animate-pulse rounded-3xl bg-slate-900" aria-busy="true" aria-label="Loading analysis overview" />;

  if (!run) {
    return (
      <Suspense fallback={<div className="min-h-[55vh] animate-pulse rounded-3xl bg-slate-900" aria-busy="true" aria-label="Loading landing overview" />}>
        <LandingPageSection
          onNavigate={onNavigate}
          backendReachable={backendReachable}
          loadError={loadError}
          onRetry={onRetry}
        />
      </Suspense>
    );
  }

  const anomalies=run.events.filter(e=>e.is_anomaly).sort((a,b)=>b.anomaly_score-a.anomaly_score);
  const action=run.pso_optimization.selected_action;
  const distribution=run.isolation_forest.score_distribution;
  const peak=Math.max(1,...distribution.map(b=>b.normal_count+b.anomaly_count));
  const affected=run.agent_recommendation.affected_services;
  const driver=anomalies[0]?.primary_driver??'No anomalous events';
  return (
    <div className="space-y-12">
      <section className="tm-overview-shell overflow-hidden rounded-[2rem]" aria-labelledby="overview-title">
        <div className="tm-overview-grid relative px-5 py-7 sm:px-8 sm:py-9 lg:px-12 lg:py-11">
          <motion.div {...enter} className="relative z-10">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[.04]">
                  <Fingerprint className="h-4 w-4 text-emerald-300" />
                </span>
                <span>
                  <span className="block text-slate-200">Analysis session</span>
                  <span className="mt-1 block font-mono text-[10px] text-slate-500">
                    {run.run_id.slice(0, 22)} · {new Date(run.created_at).toLocaleString()}
                  </span>
                </span>
              </div>
              <button type="button" onClick={() => onNavigate('analyze')} className="tm-overview-cta !py-2.5">
                <UploadCloud className="h-4 w-4" />New analysis
              </button>
            </div>
            <div className="mt-10 grid items-end gap-9 xl:grid-cols-[1.1fr_.9fr]">
              <div>
                <p className="flex items-center gap-2 text-xs text-emerald-300">
                  <Activity className="h-4 w-4" />Signal summary / {run.file_format}
                </p>
                <h1 id="overview-title" className="mt-4 max-w-3xl break-words text-4xl font-semibold leading-[1.05] tracking-[-.05em] text-white sm:text-5xl">
                  {run.dataset_name}
                </h1>
                <p className="mt-4 max-w-xl text-sm leading-6 text-slate-400">
                  {run.agent_recommendation.summary_headline}
                </p>
              </div>
              <ScoreChart distribution={distribution} peak={peak} reduceMotion={Boolean(reduceMotion)} />
            </div>
            <div className="mt-9 grid grid-cols-2 border-y border-white/10 lg:grid-cols-4">
              <Metric label="Total rows checked" value={run.isolation_forest.total_events} note="Valid log rows read from your file" icon={<Waves />} />
              <Metric label="Unusual rows (anomalies)" value={run.isolation_forest.anomalous_events_count} note={`${run.isolation_forest.anomaly_rate_pct}% stood out from normal behavior`} icon={<ScanSearch />} alert={anomalies.length > 0} />
              <Metric label="Affected services" value={affected.length} note={affected.slice(0, 2).join(', ') || 'No service flagged'} icon={<Database />} />
              <Metric label="Processing time" value={`${run.duration_ms}ms`} note="Time taken to analyze and save" icon={<Activity />} />
            </div>
            <div className="grid gap-8 py-8 lg:grid-cols-[1fr_.8fr]">
              <section aria-labelledby="next-step-title">
                <p className="text-xs text-slate-400">Recommended next step (read-only check picked by PSO)</p>
                <h2 id="next-step-title" className="mt-3 max-w-xl text-2xl font-medium tracking-tight text-white">{action.title}</h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">{run.agent_recommendation.why_action_selected}</p>
                <div className="mt-5 flex flex-wrap gap-x-7 gap-y-3 text-xs">
                  <span title="The main metric that differed most in flagged rows"><span className="text-slate-500">Top unusual metric</span><strong className="ml-2 font-mono text-emerald-300">{driver}</strong></span>
                  <span title="TraceMind never modifies your servers or runs live commands"><span className="text-slate-500">Safety</span><strong className="ml-2 text-slate-200">Read-only (safe)</strong></span>
                  <span title="How complete the inputs to the Agent were (not a certainty percentage)"><span className="text-slate-500">Evidence completeness</span><strong className="ml-2 text-slate-200">{run.agent_recommendation.evidence_coverage_pct ?? run.agent_recommendation.confidence_score_pct}%</strong></span>
                </div>
                <button type="button" onClick={() => onNavigate('investigate')} className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-emerald-300 transition-colors hover:text-emerald-200">
                  Explore events &amp; full recommendation<ArrowUpRight className="h-4 w-4" />
                </button>
              </section>
              <section aria-labelledby="priority-events-title" className="border-t border-white/10 pt-5 lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0">
                <div className="flex items-center justify-between">
                  <h2 id="priority-events-title" className="text-sm font-medium text-slate-200">Most unusual rows</h2>
                  <span className="font-mono text-xs text-slate-500">TOP 03</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">Click any row to see which numbers made it stand out (0 = normal, 1 = most unusual).</p>
                {anomalies.length === 0 ? (
                  <p className="mt-5 text-sm text-slate-400">No unusual rows were found in this file — everything looks consistent.</p>
                ) : (
                  <ul className="mt-3 divide-y divide-white/[.07]">
                    {anomalies.slice(0, 3).map((event, index) => (
                      <li key={event.event_id}>
                        <button type="button" onClick={() => onInspectEvent(event)} className="group flex w-full items-center gap-3 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-300">
                          <span className="font-mono text-[10px] text-slate-600">0{index + 1}</span>
                          <span className="min-w-0 flex-1">
                            <strong className="block truncate font-mono text-xs text-slate-200">
                              {event.event_id}<span className="ml-2 font-sans font-normal text-slate-500">{event.service}</span>
                            </strong>
                            <span className="mt-1 block text-[10px] text-slate-500">{event.primary_driver}</span>
                          </span>
                          <span className="font-mono text-xs text-rose-300">{event.anomaly_score.toFixed(3)}</span>
                          <ArrowUpRight className="h-3.5 w-3.5 text-slate-600 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-emerald-300" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
            <div className="flex items-center justify-between border-t border-white/10 pt-4 text-[10px] text-slate-500">
              <span>TraceMind — Read-only analysis leads (never modifies your servers)</span>
              <span className="font-mono">{run.pso_optimization.algorithm} · {run.agent_recommendation.agent_version}</span>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
};


function ScoreChart({distribution,peak,reduceMotion}:{distribution:AnalysisRun['isolation_forest']['score_distribution'];peak:number;reduceMotion:boolean}) {
  const width=560,height=170,pad=12; const points=distribution.map((bin,i)=>({x:pad+i*(width-pad*2)/Math.max(1,distribution.length-1),y:height-pad-((bin.normal_count+bin.anomaly_count)/peak)*(height-pad*2),anomaly:bin.anomaly_count}));
  const line=points.map((p,i)=>`${i?'L':'M'} ${p.x} ${p.y}`).join(' '); const area=`${line} L ${points.at(-1)?.x??width} ${height} L ${points[0]?.x??0} ${height} Z`;
  return <div className="border-l border-white/10 pl-5" aria-label="Actual anomaly score distribution"><div className="mb-3 flex items-center justify-between"><div><p className="text-xs text-slate-200">How unusual the log rows look</p><p className="mt-1 text-[10px] text-slate-500">Left = normal rows · Right = unusual rows (red dots = flagged anomalies)</p></div><span className="inline-flex items-center gap-1.5 text-[10px] text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300"/>LIVE DATA</span></div><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Distribution of normal and anomalous events" className="w-full overflow-visible"><defs><linearGradient id="overviewFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#34d399" stopOpacity=".32"/><stop offset="100%" stopColor="#34d399" stopOpacity="0"/></linearGradient></defs>{[.25,.5,.75].map(v=><line key={v} x1="0" x2={width} y1={height*v} y2={height*v} stroke="white" strokeOpacity=".08" strokeDasharray="3 7"/>)}<path d={area} fill="url(#overviewFill)"/><motion.path d={line} fill="none" stroke="#6ee7b7" strokeWidth="2.5" strokeLinecap="round" initial={reduceMotion?false:{pathLength:0,opacity:.4}} animate={{pathLength:1,opacity:1}} transition={{duration:1.15,ease:'easeOut'}}/>{points.filter(p=>p.anomaly>0).map((p,i)=><circle key={`${p.x}-${i}`} cx={p.x} cy={p.y} r="4" fill="#fb7185" stroke="#151d2c" strokeWidth="2"/>)}<text x="0" y={height} fill="#64748b" fontSize="9">Normal (0.0)</text><text x={width} y={height} textAnchor="end" fill="#64748b" fontSize="9">Most unusual (1.0)</text></svg></div>;
}

function Metric({label,value,note,icon,alert=false}:{label:string;value:number|string;note:string;icon:React.ReactNode;alert?:boolean}) { return <div className="min-w-0 border-r border-white/[.07] py-5 pr-4 first:border-0 first:pr-0 sm:px-4"><div className="flex items-center gap-2 text-slate-500"><span className="tm-overview-metric-icon text-emerald-300">{icon}</span><span className="truncate text-[10px] sm:text-xs">{label}</span></div><p className={`mt-3 font-mono text-2xl tracking-tight sm:text-3xl ${alert?'text-rose-300':'text-white'}`}>{value}</p><p className="mt-1 truncate text-[10px] text-slate-600">{note}</p></div>; }

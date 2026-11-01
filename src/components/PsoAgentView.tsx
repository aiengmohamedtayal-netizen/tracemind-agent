import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertCircle,
  ClipboardCheck,
  Cpu,
  Database,
  Play,
  RefreshCw,
  ServerCrash,
  ShieldCheck,
  Sparkles,
  Upload,
} from 'lucide-react';
import { AnalysisRun } from '../types/tracemind';
import { NavTabId } from './Header';

interface PsoAgentViewProps {
  run: AnalysisRun | null;
  isLoading: boolean;
  backendReachable: boolean;
  onNavigate: (tab: NavTabId) => void;
  onRetry: () => void;
}

export const PsoAgentView: React.FC<PsoAgentViewProps> = ({
  run,
  isLoading,
  backendReachable,
  onNavigate,
  onRetry,
}) => {
  const [completedSteps, setCompletedSteps] = useState<Record<number, boolean>>({});

  const toggleStep = (stepNumber: number) => {
    setCompletedSteps((prev) => ({
      ...prev,
      [stepNumber]: !prev[stepNumber],
    }));
  };

  if (isLoading) {
    return (
      <div className="space-y-6" aria-busy="true">
        <div className="h-14 bg-slate-200/70 rounded-xl animate-pulse" />
        <div className="h-64 tm-card p-6 animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 h-80 tm-card p-6 animate-pulse" />
          <div className="lg:col-span-6 h-80 tm-card p-6 animate-pulse" />
        </div>
      </div>
    );
  }

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
            <div className="text-xs font-semibold text-blue-600 mb-1.5">
              Particle Swarm Optimization &amp; Intelligent Agent
            </div>
            <h1 className="text-2xl sm:text-[26px] font-bold tracking-tight text-slate-900">
              PSO Action Optimization &amp; Intelligent Agent Decision Support
            </h1>
          </div>
        </div>

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
              ? 'Backend Unavailable — No PSO or Agent Results Loaded'
              : 'No PSO Optimization or Agent Recommendations Available'}
          </h2>
          <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
            {!backendReachable
              ? 'The frontend does not fabricate PSO candidate fitness scores or Intelligent Agent recommendations. Connect to the FastAPI backend or upload an event log once the server is available.'
              : 'Upload and analyze an event log via POST /analyze to inspect real Particle Swarm Optimization candidate rankings, convergence telemetry, and Intelligent Agent execution runbooks.'}
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
              onClick={() => onNavigate('upload')}
              className="tm-btn-primary px-4 py-2 text-xs"
            >
              <Upload className="w-3.5 h-3.5" aria-hidden="true" />
              Upload Event Log
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  const { pso_optimization: pso, agent_recommendation: agent } = run;
  const verifiedCount = Object.values(completedSteps).filter(Boolean).length;
  const totalSteps = agent.execution_steps.length;
  const progressPct = totalSteps > 0 ? Math.round((verifiedCount / totalSteps) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-8"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200/90 pb-5">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mb-1.5">
            <span>
              Run ID: <strong className="font-mono text-slate-700">{run.run_id}</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Swarm Size: <strong className="font-mono text-slate-700">{pso.swarm_size} Particles</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Converged Iteration: <strong className="font-mono text-emerald-700">#{pso.converged_at_iteration}</strong>
            </span>
          </div>
          <h1 className="text-2xl sm:text-[26px] font-bold tracking-tight text-slate-900">
            PSO Action Optimization &amp; Intelligent Agent Decision Support
          </h1>
        </div>

        <div className="flex flex-col items-start md:items-end gap-1.5">
          <button
            type="button"
            disabled
            title="Disabled: requires backend endpoint POST /api/actions/simulate"
            className="tm-btn-secondary px-4 py-2 text-xs whitespace-nowrap shrink-0 opacity-60 cursor-not-allowed"
          >
            <Play className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
            Simulate Selected Action ({pso.selected_action.action_id})
          </button>
          <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
            <AlertCircle className="w-3 h-3 text-amber-600 shrink-0" aria-hidden="true" />
            Action simulation disabled: backend endpoint <code className="font-mono text-slate-700">POST /api/actions/simulate</code> is not yet implemented.
          </span>
        </div>
      </div>

      {/* PSO Objective Function & Candidate Action Matrix */}
      <section className="tm-card overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-blue-600" aria-hidden="true" />
              <h2 className="text-base font-bold text-slate-900">
                01. Particle Swarm Optimization (PSO) Candidate Action Matrix
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Multi-objective fitness evaluation across candidate remediation actions (Weights: Mitigation{' '}
              <strong className="font-mono text-slate-700">
                {Math.round(pso.optimal_weights.mitigation_weight * 100)}%
              </strong>{' '}
              · SLA Safety{' '}
              <strong className="font-mono text-slate-700">
                {Math.round(pso.optimal_weights.sla_safety_weight * 100)}%
              </strong>{' '}
              · Cost{' '}
              <strong className="font-mono text-slate-700">
                {Math.round(pso.optimal_weights.cost_weight * 100)}%
              </strong>{' '}
              · Speed{' '}
              <strong className="font-mono text-slate-700">
                {Math.round(pso.optimal_weights.speed_weight * 100)}%
              </strong>)
            </p>
          </div>
          <div className="text-xs font-mono text-slate-700 bg-slate-100 px-3 py-1.5 rounded-lg tabular-nums shrink-0">
            Baseline Cost: ${pso.baseline_cost_usd} &rarr; Optimized:{' '}
            <strong className="text-emerald-700">${pso.optimized_cost_usd} (-{pso.estimated_savings_pct}%)</strong>
          </div>
        </div>

        {pso.candidate_actions.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No candidate remediation actions returned by the backend PSO solver for this run.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/90 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Rank / ID</th>
                  <th className="py-3 px-4">Candidate Remediation Action</th>
                  <th className="py-3 px-4">Target Subsystem</th>
                  <th className="py-3 px-4 text-right">Mitigation Efficacy</th>
                  <th className="py-3 px-4 text-right">Est. Cost (USD)</th>
                  <th className="py-3 px-4 text-right">SLA Risk Score</th>
                  <th className="py-3 px-4 text-right">Exec Latency</th>
                  <th className="py-3 px-4 text-right">PSO Fitness</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80 text-xs">
                {pso.candidate_actions.map((act, idx) => (
                  <tr
                    key={act.action_id}
                    className={
                      act.is_selected
                        ? 'bg-blue-50/75 font-medium'
                        : 'hover:bg-slate-50/80 transition-colors'
                    }
                  >
                    <td className="py-3.5 px-4 font-mono text-slate-900 whitespace-nowrap">
                      <span className={act.is_selected ? 'font-bold text-blue-700' : 'text-slate-600'}>
                        #{idx + 1}
                      </span>{' '}
                      · <span className="font-semibold">{act.action_id}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{act.title}</div>
                      <div className="text-slate-500 font-mono text-[11px] mt-0.5">
                        {act.action_code}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-700 whitespace-nowrap">
                      {act.target_subsystem}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-emerald-700 font-bold whitespace-nowrap">
                      {act.mitigation_efficacy_pct}%
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-900 whitespace-nowrap">
                      ${act.estimated_cost_usd}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                      <span
                        className={
                          act.sla_risk_score <= 18
                            ? 'text-slate-800'
                            : 'text-amber-700 font-semibold'
                        }
                      >
                        {act.sla_risk_score}/100
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                      {act.execution_latency_sec}s
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums font-bold text-slate-900 whitespace-nowrap">
                      <div className="inline-flex items-center justify-end gap-2">
                        <div className="w-12 h-1.5 bg-slate-200/80 rounded-full overflow-hidden hidden sm:block">
                          <div
                            style={{ width: `${Math.min(100, act.composite_fitness)}%` }}
                            className={`h-full rounded-full ${
                              act.is_selected ? 'bg-blue-600' : 'bg-slate-500'
                            }`}
                          />
                        </div>
                        <span>{act.composite_fitness.toFixed(2)}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {act.is_selected ? (
                        <span className="text-blue-700 font-bold">
                          PSO Optimal Selection
                        </span>
                      ) : (
                        <span className="text-slate-500">Sub-optimal</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Two-Column Split: Intelligent Agent Explanation & Remediation Runbook */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 6 Cols: Agent Reasoning & Guardrail Verification */}
        <section className="lg:col-span-6 tm-card p-6 space-y-5">
          <div className="border-b border-slate-200 pb-4">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1 font-semibold text-blue-600">
                <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                Intelligent Agent Reasoning
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono font-semibold text-slate-700">
                Confidence {agent.confidence_score_pct}%
              </span>
            </div>
            <h2 className="text-base font-bold text-slate-900 mt-1">
              02. Root-Cause Diagnosis &amp; Policy Justification
            </h2>
          </div>

          <div className="space-y-4 text-sm text-slate-700 leading-relaxed">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
              <h3 className="text-xs font-bold text-slate-900 mb-1">
                Telemetry Root-Cause Analysis
              </h3>
              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                {agent.root_cause_analysis}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
              <h3 className="text-xs font-bold text-slate-900 mb-1">
                Why PSO Selected {pso.selected_action.action_id} ({pso.selected_action.action_code})
              </h3>
              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                {agent.why_action_selected}
              </p>
            </div>

            <div>
              <h3 className="text-xs font-bold text-slate-900 mb-1">
                Operational Risk Assessment
              </h3>
              <p className="text-xs text-slate-600">{agent.risk_assessment}</p>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200">
            <h3 className="text-xs font-bold text-slate-900 mb-3 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" aria-hidden="true" />
              Safety Guardrail Verification Checks
            </h3>
            {agent.guardrails_checked.length === 0 ? (
              <div className="text-xs text-slate-500">
                No guardrail checks returned by backend for this run.
              </div>
            ) : (
              <div className="space-y-2.5">
                {agent.guardrails_checked.map((g) => (
                  <div
                    key={g.rule}
                    className="p-3.5 bg-slate-50/90 border border-slate-200/90 rounded-xl text-xs flex items-start justify-between gap-4"
                  >
                    <div>
                      <div className="font-bold text-slate-900">{g.rule}</div>
                      <div className="text-slate-600 mt-0.5">{g.detail}</div>
                    </div>
                    <span
                      className={`font-mono font-bold shrink-0 ${
                        g.passed ? 'text-emerald-700' : 'text-red-700'
                      }`}
                    >
                      {g.passed ? 'PASSED' : 'BLOCKED'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Right 6 Cols: Step-by-Step Execution Runbook */}
        <section className="lg:col-span-6 tm-card p-6 space-y-5">
          <div className="border-b border-slate-200 pb-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs text-slate-500 font-mono">
                  Target Services:{' '}
                  {agent.affected_services.length > 0
                    ? agent.affected_services.join(', ')
                    : 'None specified'}
                </div>
                <h2 className="text-base font-bold text-slate-900 mt-1 flex items-center gap-1.5">
                  <ClipboardCheck className="w-4 h-4 text-blue-600" aria-hidden="true" />
                  03. Recommended Remediation Execution Runbook
                </h2>
              </div>
              <span className="text-xs font-mono font-bold text-slate-700">
                {verifiedCount}/{totalSteps} Verified ({progressPct}%)
              </span>
            </div>

            <div className="mt-3 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                style={{ width: `${progressPct}%` }}
                className="h-full bg-emerald-600 transition-all duration-200 rounded-full"
              />
            </div>
          </div>

          {agent.execution_steps.length === 0 ? (
            <div className="text-xs text-slate-500 py-6 text-center">
              No execution steps returned by backend for this run.
            </div>
          ) : (
            <div className="space-y-3">
              {agent.execution_steps.map((step) => {
                const isChecked = !!completedSteps[step.step_number];
                return (
                  <div
                    key={step.step_number}
                    className={`p-4 rounded-xl border transition-all ${
                      isChecked
                        ? 'bg-emerald-50/50 border-emerald-200'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleStep(step.step_number)}
                          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600 cursor-pointer"
                        />
                        <div>
                          <div className="text-xs font-bold text-slate-900">
                            Step {step.step_number}: {step.command_or_action}
                          </div>
                          <div className="text-xs text-slate-600 mt-1">
                            Verification: {step.verification_check}
                          </div>
                        </div>
                      </label>
                      <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded shrink-0">
                        ~{step.estimated_duration}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </motion.div>
  );
};

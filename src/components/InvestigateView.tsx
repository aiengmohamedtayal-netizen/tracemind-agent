import React, { lazy, Suspense, useId, useState } from 'react';
import { BarChart3, BrainCircuit, ListFilter } from 'lucide-react';
import { AnalysisRun, EvaluatedEventRecord } from '../types/tracemind';
import { NavTabId } from './Header';
import { AnomaliesTableView } from './AnomaliesTableView';
import { PsoAgentView } from './PsoAgentView';

const DashboardView = lazy(() =>
  import('./DashboardView').then((m) => ({ default: m.DashboardView }))
);

type InvestigationSection = 'events' | 'recommendation' | 'evidence';

interface InvestigateViewProps {
  run: AnalysisRun | null;
  isLoading: boolean;
  backendReachable: boolean;
  loadError: string | null;
  selectedEvent: EvaluatedEventRecord | null;
  onSelectEvent: (event: EvaluatedEventRecord | null) => void;
  onInspectEvent: (event: EvaluatedEventRecord) => void;
  onNavigate: (tab: NavTabId) => void;
  onRetry: () => void;
}

export const InvestigateView: React.FC<InvestigateViewProps> = (props) => {
  const [section, setSection] = useState<InvestigationSection>('events');
  const tabId = useId();
  const tabs: { id: InvestigationSection; label: string; description: string; icon: React.ElementType }[] = [
    { id: 'events', label: 'Events', description: 'Search, filter, export, and inspect event-level evidence.', icon: ListFilter },
    { id: 'recommendation', label: 'Recommendation', description: 'Review the selected read-only action, PSO candidates, and agent guardrails.', icon: BrainCircuit },
    { id: 'evidence', label: 'Model evidence', description: 'Open score distributions, feature importance, and optimization convergence.', icon: BarChart3 },
  ];

  return (
    <section className="space-y-6" aria-labelledby="investigate-title">
      <div className="border-b border-slate-800/80 pb-5">
        <p className="text-xs font-semibold text-cyan-400 font-mono tracking-wide uppercase">Investigation workspace</p>
        <h1 id="investigate-title" className="mt-1 text-2xl font-bold tracking-tight text-white">Inspect the evidence behind this analysis</h1>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-400">Start with event-level records, then open the recommendation and technical model evidence when needed.</p>
      </div>
      <div role="tablist" aria-label="Investigation sections" className="flex flex-wrap gap-2 border-b border-slate-800/80 pb-3">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const selected = section === tab.id;
          return (
            <button
              key={tab.id}
              id={`${tabId}-${tab.id}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`${tabId}-panel`}
              onClick={() => setSection(tab.id)}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                selected
                  ? 'bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 shadow-sm shadow-cyan-500/10'
                  : 'bg-slate-900/60 border border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" aria-hidden="true" /> {tab.label}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-slate-400">{tabs.find((tab) => tab.id === section)?.description}</p>
      <div id={`${tabId}-panel`} role="tabpanel" aria-labelledby={`${tabId}-${section}`}>
        {section === 'events' && <AnomaliesTableView {...props} />}
        {section === 'recommendation' && <PsoAgentView {...props} />}
        {section === 'evidence' && (
          <Suspense fallback={<div className="min-h-[40vh] animate-pulse rounded-2xl bg-slate-900/60" aria-busy="true" aria-label="Loading model evidence" />}>
            <DashboardView {...props} />
          </Suspense>
        )}
      </div>
    </section>
  );
};

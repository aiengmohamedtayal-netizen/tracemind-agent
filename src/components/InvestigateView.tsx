import React, { useId, useState } from 'react';
import { BarChart3, BrainCircuit, ListFilter } from 'lucide-react';
import { AnalysisRun, EvaluatedEventRecord } from '../types/tracemind';
import { NavTabId } from './Header';
import { AnomaliesTableView } from './AnomaliesTableView';
import { DashboardView } from './DashboardView';
import { PsoAgentView } from './PsoAgentView';

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
      <div className="border-b border-slate-200 pb-5">
        <p className="text-xs font-semibold text-blue-700">Investigation workspace</p>
        <h1 id="investigate-title" className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Inspect the evidence behind this analysis</h1>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-600">Start with event-level records, then open the recommendation and technical model evidence when needed.</p>
      </div>
      <div role="tablist" aria-label="Investigation sections" className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const selected = section === tab.id;
          return (
            <button key={tab.id} id={`${tabId}-${tab.id}`} role="tab" type="button" aria-selected={selected} aria-controls={`${tabId}-panel`} onClick={() => setSection(tab.id)} className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-blue-600 ${selected ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
              <Icon className="w-4 h-4" aria-hidden="true" /> {tab.label}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-slate-500">{tabs.find((tab) => tab.id === section)?.description}</p>
      <div id={`${tabId}-panel`} role="tabpanel" aria-labelledby={`${tabId}-${section}`}>
        {section === 'events' && <AnomaliesTableView {...props} />}
        {section === 'recommendation' && <PsoAgentView {...props} />}
        {section === 'evidence' && <DashboardView {...props} />}
      </div>
    </section>
  );
};

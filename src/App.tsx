/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AnalysisConfig,
  AnalysisRun,
  EvaluatedEventRecord,
  LogFileFormat,
} from './types/tracemind';
import { BackendHealthStatus, traceMindApi } from './services/api';
import { Header, NavTabId } from './components/Header';
import { DataSourceBanner } from './components/DataSourceBanner';
import { UploadAnalyzeView } from './components/UploadAnalyzeView';
import { InvestigateView } from './components/InvestigateView';
import { OverviewView } from './components/OverviewView';
import { HistoryReportsView } from './components/HistoryReportsView';
import { ApiContractModal } from './components/ApiContractModal';
import { AuthGate, AuthUser } from './components/AuthGate';
import { authenticate, endSession, restoreSession } from './services/api';

export default function App() {
  const [user,setUser]=useState<AuthUser|null>(null);
  const [sessionReady,setSessionReady]=useState(false);
  const [sessionError,setSessionError]=useState<string|null>(null);
  const [activeTab, setActiveTab] = useState<NavTabId>('overview');
  const [runs, setRuns] = useState<AnalysisRun[]>([]);
  const [activeRunId, setActiveRunId] = useState<string>('');
  const [selectedEvent, setSelectedEvent] = useState<EvaluatedEventRecord | null>(null);

  const [isLoadingRuns, setIsLoadingRuns] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [healthStatus, setHealthStatus] = useState<BackendHealthStatus | null>(null);
  const [isCheckingHealth, setIsCheckingHealth] = useState<boolean>(false);
  const [isApiModalOpen, setIsApiModalOpen] = useState<boolean>(false);

  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(()=>{
    restoreSession()
      .then(({ user: restoredUser, error }) => {
        setUser(restoredUser);
        setSessionError(error);
      })
      .finally(()=>setSessionReady(true));
  },[]);

  useEffect(()=>{
    const expire=()=>{setRuns([]);setActiveRunId('');setUser(null);};
    window.addEventListener('tracemind:session-expired',expire);
    return ()=>window.removeEventListener('tracemind:session-expired',expire);
  },[]);

  const handleAuthenticate = async (email:string,password:string,mode:'login'|'register') => {
    const authenticated=await authenticate(email,password,mode);
    setSessionError(null);
    setUser(authenticated as AuthUser);
  };

  const probeHealth = useCallback(async () => {
    setIsCheckingHealth(true);
    try {
      const status = await traceMindApi.checkBackendHealth();
      setHealthStatus(status);
      return status;
    } finally {
      setIsCheckingHealth(false);
    }
  }, []);

  const loadWorkspaceData = useCallback(async () => {
    if (!user) return;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoadingRuns(true);
    setLoadError(null);
    setIsCheckingHealth(true);

    try {
      const status = await traceMindApi.checkBackendHealth(controller.signal);
      if (controller.signal.aborted) return;
      setHealthStatus(status);
      setIsCheckingHealth(false);

      if (!status.reachable) {
        setRuns([]);
        setActiveRunId('');
        setLoadError(status.message);
        return;
      }

      const fetchedRuns = await traceMindApi.fetchAnalysisHistory(controller.signal);
      if (controller.signal.aborted) return;

      setRuns(fetchedRuns);
      if (fetchedRuns.length > 0) {
        setActiveRunId((prev) =>
          prev && fetchedRuns.some((r) => r.run_id === prev)
            ? prev
            : fetchedRuns[0].run_id
        );
      } else {
        setActiveRunId('');
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      setIsCheckingHealth(false);
      setRuns([]);
      setActiveRunId('');
      setLoadError(
        err instanceof Error
          ? err.message
          : 'Failed to load analysis history from backend API.'
      );
    } finally {
      if (!controller.signal.aborted) {
        setIsLoadingRuns(false);
      }
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    loadWorkspaceData();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [loadWorkspaceData, user]);

  const activeRun = runs.find((r) => r.run_id === activeRunId) || runs[0] || null;
  const backendReachable = Boolean(healthStatus?.reachable);

  const handleRunAnalysis = async (params: {
    datasetName: string;
    rawContent: string;
    file?: File | null;
    formatHint?: LogFileFormat;
    config: AnalysisConfig;
  }): Promise<AnalysisRun> => {
    const newRun = await traceMindApi.submitEventLogAnalysis(params);
    setRuns((prev) => [newRun, ...prev.filter((r) => r.run_id !== newRun.run_id)]);
    setActiveRunId(newRun.run_id);
    setSelectedEvent(null);
    setLoadError(null);
    await probeHealth();
    return newRun;
  };

  const handleInspectEvent = (event: EvaluatedEventRecord) => {
    setSelectedEvent(event);
    setActiveTab('investigate');
  };

  const handleDeleteRun = async (runId: string) => {
    await traceMindApi.deleteAnalysisRunById(runId);
    setRuns((prev) => {
      const updated = prev.filter((r) => r.run_id !== runId);
      if (activeRunId === runId) {
        setActiveRunId(updated[0]?.run_id || '');
      }
      return updated;
    });
  };

  if (!sessionReady) return <div className="min-h-screen grid place-items-center bg-[#060913] text-slate-300 font-mono text-sm">Checking your session…</div>;
  if (!user) return <AuthGate onAuthenticated={handleAuthenticate} initialError={sessionError}/>;

  return (
    <div className="min-h-screen flex flex-col bg-[#060913] text-slate-100">
      <Header
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        anomalyCount={activeRun?.isolation_forest.anomalous_events_count || 0}
      />

      <DataSourceBanner
        activeRun={activeRun}
        allRuns={runs}
        onSelectRun={(runId) => {
          setActiveRunId(runId);
          setSelectedEvent(null);
        }}
        healthStatus={healthStatus}
        isCheckingHealth={isCheckingHealth}
        onRefreshHealth={loadWorkspaceData}
        onOpenApiModal={() => setIsApiModalOpen(true)}
        userEmail={user.email}
        onSignOut={async () => {
          await endSession();
          setRuns([]);
          setUser(null);
        }}
      />

      <main className={`flex-1 w-full ${activeTab === 'overview' ? '' : 'max-w-[1440px] mx-auto px-4 sm:px-6 py-6 sm:py-8'}`}>
        {activeTab === 'overview' && (
          <OverviewView
            run={activeRun}
            isLoading={isLoadingRuns}
            backendReachable={backendReachable}
            loadError={loadError}
            onRetry={loadWorkspaceData}
            onNavigate={setActiveTab}
            onInspectEvent={handleInspectEvent}
          />
        )}

        {activeTab === 'analyze' && (
          <UploadAnalyzeView
            onRunAnalysis={handleRunAnalysis}
            onAnalysisCompleted={() => setActiveTab('overview')}
          />
        )}

        {activeTab === 'investigate' && (
          <InvestigateView
            run={activeRun}
            isLoading={isLoadingRuns}
            backendReachable={backendReachable}
            selectedEvent={selectedEvent}
            onSelectEvent={setSelectedEvent}
            onInspectEvent={handleInspectEvent}
            onRetry={loadWorkspaceData}
            onNavigate={setActiveTab}
            loadError={loadError}
          />
        )}

        {activeTab === 'history' && (
          <HistoryReportsView
            runs={runs}
            activeRunId={activeRun?.run_id || ''}
            isLoading={isLoadingRuns}
            backendReachable={backendReachable}
            errorMessage={loadError}
            onSelectRun={(runId) => {
              setActiveRunId(runId);
              setSelectedEvent(null);
              setActiveTab('overview');
            }}
            onDeleteRun={handleDeleteRun}
            onRefreshHistory={loadWorkspaceData}
            onNavigate={setActiveTab}
          />
        )}
      </main>

      <footer className="border-t border-slate-800/60 bg-[#0B0F19]/80 px-4 sm:px-6 py-5 mt-16 text-slate-400">
        <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <div>
            TraceMind — Event-Log Anomaly Detection (Isolation Forest), PSO Action Optimization &amp; Intelligent Agent Decision Support
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setIsApiModalOpen(true)}
              className="hover:text-cyan-400 underline underline-offset-2 cursor-pointer font-medium text-slate-300 transition-colors"
            >
              API Contracts &amp; Backend Integration Status
            </button>
          </div>
        </div>
      </footer>

      <ApiContractModal
        isOpen={isApiModalOpen}
        onClose={() => setIsApiModalOpen(false)}
        healthStatus={healthStatus}
        isCheckingHealth={isCheckingHealth}
        onProbeHealth={() => {
          loadWorkspaceData();
        }}
      />
    </div>
  );
}

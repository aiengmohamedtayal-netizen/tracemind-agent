import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  CheckCircle2,
  Play,
  Sliders,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import {
  AnalysisConfig,
  AnalysisRun,
  LogFileFormat,
  PipelineStage,
} from '../types/tracemind';
import {
  DEFAULT_ANALYSIS_CONFIG,
  parseEventLogContent,
  validateUploadFile,
} from '../utils/analysisEngine';

interface UploadAnalyzeViewProps {
  onRunAnalysis: (params: {
    datasetName: string;
    rawContent: string;
    file?: File | null;
    formatHint?: LogFileFormat;
    config: AnalysisConfig;
  }) => Promise<AnalysisRun>;
  onAnalysisCompleted: (run: AnalysisRun) => void;
}

const PIPELINE_STEPS: { id: PipelineStage; label: string; detail: string }[] = [
  {
    id: 'validating',
    label: '1. Client Pre-Flight & Schema Validation',
    detail:
      'Verifying supported log syntax, file size, and the available event fields before transmission.',
  },
  {
    id: 'submitting',
    label: '2. FastAPI Backend Pipeline Execution (POST /analyze)',
    detail:
      'Transmitting payload to backend for server-side Isolation Forest scoring, PSO action optimization, and Intelligent Agent synthesis.',
  },
  {
    id: 'completed',
    label: '3. Backend Response Validation & Workspace Sync',
    detail:
      'Validating returned AnalysisRun schema and populating dashboard views with real backend results.',
  },
];

export const UploadAnalyzeView: React.FC<UploadAnalyzeViewProps> = ({
  onRunAnalysis,
  onAnalysisCompleted,
}) => {
  const [datasetName, setDatasetName] = useState<string>('');
  const [rawContent, setRawContent] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [formatHint, setFormatHint] = useState<LogFileFormat | undefined>(undefined);
  const [config, setConfig] = useState<AnalysisConfig>(DEFAULT_ANALYSIS_CONFIG);
  const [isDraggingFile, setIsDraggingFile] = useState<boolean>(false);

  const [pipelineStage, setPipelineStage] = useState<PipelineStage>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [validationPreview, setValidationPreview] = useState<{
    recordCount: number;
    format: LogFileFormat;
    services: string[];
  } | null>(null);

  const handleLoadSampleData = () => {
    const sample = `event_id,timestamp,service,event_type,source_ip,latency_ms,error_rate,cpu_pct,memory_mb,payload_bytes,status_code
evt-01,2026-11-16T12:00:00Z,auth,LOGIN,192.168.1.10,32,0.01,22,512,256,200
evt-02,2026-11-16T12:01:00Z,catalog,SEARCH,192.168.1.11,45,0.02,30,620,512,200
evt-03,2026-11-16T12:02:00Z,orders,CREATE,192.168.1.12,55,0.01,35,740,1024,201
evt-04,2026-11-16T12:03:00Z,auth,LOGIN,192.168.1.10,30,0.01,24,510,250,200
evt-05,2026-11-16T12:04:00Z,payments,CHARGE,10.0.0.50,2850,0.85,96,4096,51200,503
evt-06,2026-11-16T12:05:00Z,catalog,GET_ITEM,192.168.1.14,40,0.01,28,600,480,200
evt-07,2026-11-16T12:06:00Z,orders,CHECKOUT,192.168.1.15,62,0.02,38,780,1200,200
evt-08,2026-11-16T12:07:00Z,auth,REFRESH,192.168.1.16,28,0.01,20,490,180,200
evt-09,2026-11-16T12:08:00Z,payments,CHARGE,10.0.0.50,3100,0.92,99,4096,62000,500
evt-10,2026-11-16T12:09:00Z,catalog,SEARCH,192.168.1.17,48,0.01,31,630,520,200`;
    handleContentChange(sample, 'CSV', 'sample-telemetry.csv', null);
  };

  const handleContentChange = (
    newText: string,
    hint?: LogFileFormat,
    name?: string,
    fileObj?: File | null
  ) => {
    setRawContent(newText);
    if (hint !== undefined) setFormatHint(hint);
    if (name !== undefined) setDatasetName(name);
    if (fileObj !== undefined) setSelectedFile(fileObj);
    setErrorMessage(null);

    if (!newText.trim()) {
      setValidationPreview(null);
      return;
    }

    try {
      const { records, detectedFormat } = parseEventLogContent(newText, hint);
      setValidationPreview({
        recordCount: records.length,
        format: detectedFormat,
        services: Array.from(new Set(records.map((r) => r.service))),
      });
    } catch {
      setValidationPreview(null);
    }
  };

  const loadSelectedFile = (file: File) => {
    const fileValidation = validateUploadFile(file);
    if (!fileValidation.valid) {
      setErrorMessage(fileValidation.error || 'Unsupported file.');
      setSelectedFile(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = String(event.target?.result || '');
      handleContentChange(
        text,
        fileValidation.detectedFormat,
        file.name,
        file
      );
    };
    reader.onerror = () => {
      setErrorMessage('Failed to read the selected file from disk.');
    };
    reader.readAsText(file);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    loadSelectedFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    loadSelectedFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pipelineStage === 'validating' || pipelineStage === 'submitting') {
      return; // Prevent duplicate submissions
    }

    setErrorMessage(null);
    setPipelineStage('validating');

    let contentToAnalyze = rawContent.trim();
    let effectiveDatasetName = datasetName.trim() || selectedFile?.name || '';
    let currentFormatHint = formatHint;

    if (!contentToAnalyze) {
      contentToAnalyze = `event_id,timestamp,service,event_type,source_ip,latency_ms,error_rate,cpu_pct,memory_mb,payload_bytes,status_code
evt-01,2026-11-16T12:00:00Z,auth,LOGIN,192.168.1.10,32,0.01,22,512,256,200
evt-02,2026-11-16T12:01:00Z,catalog,SEARCH,192.168.1.11,45,0.02,30,620,512,200
evt-03,2026-11-16T12:02:00Z,orders,CREATE,192.168.1.12,55,0.01,35,740,1024,201
evt-04,2026-11-16T12:03:00Z,auth,LOGIN,192.168.1.10,30,0.01,24,510,250,200
evt-05,2026-11-16T12:04:00Z,payments,CHARGE,10.0.0.50,2850,0.85,96,4096,51200,503
evt-06,2026-11-16T12:05:00Z,catalog,GET_ITEM,192.168.1.14,40,0.01,28,600,480,200
evt-07,2026-11-16T12:06:00Z,orders,CHECKOUT,192.168.1.15,62,0.02,38,780,1200,200
evt-08,2026-11-16T12:07:00Z,auth,REFRESH,192.168.1.16,28,0.01,20,490,180,200
evt-09,2026-11-16T12:08:00Z,payments,CHARGE,10.0.0.50,3100,0.92,99,4096,62000,500
evt-10,2026-11-16T12:09:00Z,catalog,SEARCH,192.168.1.17,48,0.01,31,630,520,200`;
      effectiveDatasetName = 'sample-telemetry.csv';
      currentFormatHint = 'CSV';
      handleContentChange(contentToAnalyze, 'CSV', 'sample-telemetry.csv', null);
    } else if (!effectiveDatasetName) {
      effectiveDatasetName = 'telemetry-analysis.csv';
    }

    try {
      parseEventLogContent(contentToAnalyze, currentFormatHint);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Invalid event log payload.'
      );
      setPipelineStage('failed');
      return;
    }

    try {
      setPipelineStage('submitting');
      const resultRun = await onRunAnalysis({
        datasetName: effectiveDatasetName,
        rawContent: contentToAnalyze,
        file: selectedFile,
        formatHint: currentFormatHint,
        config,
      });

      setPipelineStage('completed');
      onAnalysisCompleted(resultRun);
    } catch (err) {
      setPipelineStage('failed');
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Backend analysis request failed. Verify the FastAPI server is running.'
      );
    }
  };

  const isProcessing =
    pipelineStage === 'validating' || pipelineStage === 'submitting';

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-8"
    >
      <div className="border-b border-slate-800/80 pb-5">
        <div className="text-xs font-semibold text-cyan-400 font-mono tracking-wide uppercase mb-1">
          Data Ingestion &amp; Model Configuration
        </div>
        <h1 className="text-2xl sm:text-[26px] font-bold tracking-tight text-white">
          Event-Log Ingestion &amp; Analysis Pipeline
        </h1>
        <p className="text-sm text-slate-400 mt-1 max-w-3xl">
          Upload a telemetry CSV, JSON/JSONL record file, or plain-text log (.log, .txt, .syslog) for server-side anomaly analysis.
        </p>
      </div>

      {errorMessage && (
        <div
          role="alert"
          data-testid="upload-error-banner"
          className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800 flex items-start justify-between gap-4 shadow-2xs"
        >
          <div>
            <div className="font-bold text-red-900">
              Pipeline Validation / Backend Request Error
            </div>
            <p className="mt-1 text-xs text-red-800">{errorMessage}</p>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-xs font-semibold text-red-700 hover:text-red-900 underline cursor-pointer shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start"
      >
        {/* Left 7 Columns: File Upload & Raw Log Editor */}
        <div className="lg:col-span-7 space-y-6">
          <div className="tm-card p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  01. Event-Log Payload (CSV / JSON / JSONL / TXT / LOG)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">Telemetry CSVs use their supplied metrics; raw logs are analyzed from features measured in the log text.</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleLoadSampleData}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                >
                  <UploadCloud className="w-3.5 h-3.5" aria-hidden="true" />
                  Load Sample Data
                </button>
                {(rawContent || datasetName || selectedFile) && (
                  <button
                    type="button"
                    onClick={() =>
                      handleContentChange('', undefined, '', null)
                    }
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-red-600 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    Clear Input
                  </button>
                )}
              </div>
            </div>

            {/* Dataset Name & Drag-and-Drop File Zone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="dataset-name-input"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Dataset / Log Stream Identifier
                </label>
                <input
                  id="dataset-name-input"
                  type="text"
                  value={datasetName}
                  onChange={(e) => setDatasetName(e.target.value)}
                  placeholder="e.g., prod-gateway-telemetry.csv"
                  className="tm-input w-full px-3 py-2 text-sm font-mono text-slate-900"
                />
              </div>

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDraggingFile(true);
                }}
                onDragLeave={() => setIsDraggingFile(false)}
                onDrop={handleDrop}
                className={`rounded-lg border border-dashed p-2.5 transition-colors ${
                  isDraggingFile
                    ? 'border-blue-500 bg-blue-50/60'
                    : 'border-slate-300 bg-slate-50/60 hover:border-slate-400'
                }`}
              >
                <label
                  htmlFor="event-log-file-input"
                  className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1 cursor-pointer"
                >
                  <UploadCloud
                    className="w-3.5 h-3.5 text-blue-600"
                    aria-hidden="true"
                  />
                  Upload a Log File (.csv, .json, .jsonl, .log, .txt)
                </label>
                <input
                  id="event-log-file-input"
                  type="file"
                  accept=".csv,.json,.jsonl,.ndjson,.log,.txt,.out,.syslog,.trace,text/csv,application/json,text/plain"
                  onChange={handleFileUpload}
                  className="w-full text-xs text-slate-600 file:mr-2.5 file:py-1 file:px-2.5 file:rounded-md file:border file:border-slate-300 file:text-xs file:font-semibold file:bg-white file:text-slate-800 hover:file:bg-slate-100 cursor-pointer"
                />
              </div>
            </div>

            {/* Raw Event-Log Editor */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                <label
                  htmlFor="raw-log-textarea"
                  className="text-xs font-semibold text-slate-700"
                >
                  Raw Event-Log Stream Content
                </label>
                {validationPreview ? (
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-mono font-medium">
                    <CheckCircle2
                      className="w-3.5 h-3.5 text-emerald-600"
                      aria-hidden="true"
                    />
                    Validated: {validationPreview.recordCount}{' '}
                    {validationPreview.format} records (
                    {validationPreview.services.length} services)
                  </span>
                ) : (
                  <span className="text-xs text-slate-500 font-mono">
                    Upload a CSV, JSON, JSONL, or text log, or paste log content
                  </span>
                )}
              </div>
              <textarea
                id="raw-log-textarea"
                rows={14}
                value={rawContent}
                onChange={(e) => handleContentChange(e.target.value)}
                placeholder="Upload a log file above or paste structured CSV, JSON/JSONL, or raw text log lines..."
                className="w-full p-3.5 text-xs font-mono bg-slate-950 text-slate-100 rounded-xl border border-slate-800 leading-relaxed focus:outline-2 focus:outline-blue-600 shadow-inner"
              />
            </div>
          </div>
        </div>

        {/* Right 5 Columns: Model Hyperparameters & Execution Status */}
        <div className="lg:col-span-5 space-y-6">
          <details className="tm-card p-6 group" aria-label="Advanced model settings">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-3 [&::-webkit-details-marker]:hidden">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Advanced model settings
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Optional Isolation Forest and PSO controls. Defaults are ready for a standard analysis.
                </p>
              </div>
              <div className="p-2 rounded-lg bg-slate-100 text-slate-600">
                <Sliders className="w-4 h-4" aria-hidden="true" />
              </div>
            </summary>

            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-100 pt-5">
              <div>
                <label
                  htmlFor="contamination-input"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  IForest Contamination (0.02–0.40)
                </label>
                <input
                  id="contamination-input"
                  type="number"
                  step="0.01"
                  min="0.02"
                  max="0.40"
                  value={config.contamination}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      contamination: Number(e.target.value) || 0.12,
                    })
                  }
                  className="tm-input w-full px-3 py-2 text-sm font-mono"
                />
              </div>

              <div>
                <label
                  htmlFor="estimators-input"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Isolation Trees (n_estimators)
                </label>
                <input
                  id="estimators-input"
                  type="number"
                  step="1"
                  min="25"
                  max="500"
                  value={config.n_estimators}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      n_estimators: Number(e.target.value) || 100,
                    })
                  }
                  className="tm-input w-full px-3 py-2 text-sm font-mono"
                />
              </div>

              <div>
                <label
                  htmlFor="swarm-size-input"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  PSO Swarm Size (Particles)
                </label>
                <input
                  id="swarm-size-input"
                  type="number"
                  step="5"
                  min="10"
                  max="100"
                  value={config.swarm_size}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      swarm_size: Number(e.target.value) || 30,
                    })
                  }
                  className="tm-input w-full px-3 py-2 text-sm font-mono"
                />
              </div>

              <div>
                <label
                  htmlFor="max-iter-input"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  PSO Max Iterations
                </label>
                <input
                  id="max-iter-input"
                  type="number"
                  step="5"
                  min="10"
                  max="60"
                  value={config.max_iterations}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      max_iterations: Number(e.target.value) || 25,
                    })
                  }
                  className="tm-input w-full px-3 py-2 text-sm font-mono"
                />
              </div>

              <div>
                <label
                  htmlFor="inertia-input"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Inertia Weight (w)
                </label>
                <input
                  id="inertia-input"
                  type="number"
                  step="any"
                  min="0.2"
                  max="1.2"
                  value={config.inertia_weight}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      inertia_weight: Number(e.target.value) || 0.72,
                    })
                  }
                  className="tm-input w-full px-3 py-2 text-sm font-mono"
                />
              </div>

              <div>
                <label
                  htmlFor="cognitive-input"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Cognitive / Social (c1, c2)
                </label>
                <input
                  id="cognitive-input"
                  type="number"
                  step="any"
                  min="0.5"
                  max="2.5"
                  value={config.cognitive_coeff}
                  onChange={(e) => {
                    const val = Number(e.target.value) || 1.49;
                    setConfig({
                      ...config,
                      cognitive_coeff: val,
                      social_coeff: val,
                    });
                  }}
                  className="tm-input w-full px-3 py-2 text-sm font-mono"
                />
              </div>
            </div>

          </details>

          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs font-medium">
              ⚠️ {errorMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={isProcessing}
            className="tm-btn-primary w-full py-2.5 px-4 text-sm disabled:opacity-60"
          >
            <Play className="w-4 h-4 fill-current" aria-hidden="true" />
            {isProcessing
              ? 'Submitting to FastAPI Backend...'
              : 'Run TraceMind Analysis Pipeline'}
          </button>

          {/* Pipeline Stage Tracker */}
          <div className="tm-card p-6">
            <h3 className="text-sm font-bold text-slate-900 mb-3.5">
              03. Pipeline Execution Status
            </h3>
            <div className="space-y-3">
              {PIPELINE_STEPS.map((step) => {
                const isActive = pipelineStage === step.id;
                const isDone = pipelineStage === 'completed';

                return (
                  <div
                    key={step.id}
                    className={`p-3.5 rounded-xl border text-xs transition-all ${
                      isActive
                        ? 'bg-blue-50/90 border-blue-300 text-blue-950 shadow-2xs'
                        : isDone
                        ? 'bg-emerald-50/60 border-emerald-200 text-slate-800'
                        : 'bg-slate-50/80 border-slate-200/90 text-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span>{step.label}</span>
                      <span
                        className={`font-mono ${
                          isActive
                            ? 'text-blue-700'
                            : isDone
                            ? 'text-emerald-700'
                            : 'text-slate-500'
                        }`}
                      >
                        {isActive ? 'ACTIVE' : isDone ? 'CONFIRMED' : 'STANDBY'}
                      </span>
                    </div>
                    <p className="mt-1 text-slate-600 leading-relaxed">
                      {step.detail}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </form>
    </motion.div>
  );
};

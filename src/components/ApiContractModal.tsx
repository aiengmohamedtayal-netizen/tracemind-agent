import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { RefreshCw, Server, X } from 'lucide-react';
import { API_CONFIG, DOCUMENTED_BACKEND_ENDPOINTS } from '../config/api';
import { BackendHealthStatus } from '../services/api';

interface ApiContractModalProps {
  isOpen: boolean;
  onClose: () => void;
  healthStatus: BackendHealthStatus | null;
  isCheckingHealth: boolean;
  onProbeHealth: () => void;
}

export const ApiContractModal: React.FC<ApiContractModalProps> = ({
  isOpen,
  onClose,
  healthStatus,
  isCheckingHealth,
  onProbeHealth,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="api-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="bg-white border border-slate-200 rounded-xl max-w-3xl w-full max-h-[88vh] overflow-y-auto p-6 space-y-6 shadow-xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 mb-1">
                  <Server className="w-3.5 h-3.5" aria-hidden="true" />
                  Service Architecture &amp; Endpoint Contracts
                </div>
                <h2 id="api-modal-title" className="text-lg font-bold text-slate-900">
                  Backend API Integration &amp; Connection Status
                </h2>
                <p className="text-xs text-slate-600 mt-1">
                  TraceMind communicates exclusively with the configured Python FastAPI backend (
                  <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                    VITE_API_BASE_URL
                  </code>
                  ). Mock datasets and local fallback engines are disabled.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close API Contract Modal"
                className="tm-btn-secondary px-2.5 py-1.5 text-xs"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
                Close
              </button>
            </div>

            {/* Live Health Status & Environment Configuration */}
            <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="text-xs space-y-1">
                  <div className="font-bold text-slate-900">
                    FastAPI Health Probe (GET {API_CONFIG.baseUrl}/health)
                  </div>
                  <div className="text-slate-600 font-mono">
                    {isCheckingHealth
                      ? 'Checking backend connection...'
                      : healthStatus
                      ? healthStatus.message
                      : 'Not checked yet'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onProbeHealth}
                  disabled={isCheckingHealth}
                  className="tm-btn-secondary px-3 py-1.5 text-xs disabled:opacity-50"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 text-slate-500 ${
                      isCheckingHealth ? 'animate-spin' : ''
                    }`}
                    aria-hidden="true"
                  />
                  Re-Probe GET /health
                </button>
              </div>

              <div className="pt-3 border-t border-slate-200 text-xs flex flex-wrap items-center justify-between gap-2">
                <span className="text-slate-600">
                  Configured Base URL:{' '}
                  <strong className="font-mono text-slate-900">{API_CONFIG.baseUrl}</strong>
                </span>
                <span className="font-mono text-slate-500">
                  {API_CONFIG.hasExplicitEnvConfig
                    ? 'VITE_API_BASE_URL explicitly configured'
                    : 'Using default /api proxy path (set VITE_API_BASE_URL in .env to override)'}
                </span>
              </div>
            </div>

            {/* Documented Endpoints Table */}
            <div>
              <h3 className="text-xs font-bold text-slate-900 mb-2.5">
                Backend API Endpoints &amp; Integration Status (
                <code className="font-mono">src/services/api/*</code>)
              </h3>
              <div className="space-y-3">
                {DOCUMENTED_BACKEND_ENDPOINTS.map((ep) => (
                  <div
                    key={`${ep.method}-${ep.path}`}
                    className="border border-slate-200 rounded-xl p-4 text-xs space-y-1.5 hover:border-slate-300 transition-colors"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 font-mono">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-blue-700">{ep.method}</span>
                        <span className="font-bold text-slate-900">{ep.path}</span>
                      </div>
                      <span
                        className={
                          ep.integrationStatus === 'integrated'
                            ? 'text-emerald-700 font-semibold'
                            : 'text-amber-700 font-semibold'
                        }
                      >
                        {ep.integrationStatus === 'integrated'
                          ? 'Integrated'
                          : 'Awaiting Backend Confirmation'}
                      </span>
                    </div>
                    <p className="text-slate-600">{ep.description}</p>
                    {ep.requestSchema && (
                      <div className="text-[11px] font-mono text-slate-500 bg-slate-50 p-2 rounded border border-slate-100">
                        Request: {ep.requestSchema}
                      </div>
                    )}
                    <div className="text-[11px] font-mono text-slate-500 bg-slate-50 p-2 rounded border border-slate-100">
                      Response: {ep.responseSchema}
                    </div>
                    {ep.notes && (
                      <div className="text-[11px] text-amber-800 pt-0.5">
                        Note: {ep.notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

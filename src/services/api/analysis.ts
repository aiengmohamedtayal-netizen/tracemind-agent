import { API_CONFIG } from '../../config/api';
import { AnalysisConfig, AnalysisRun, LogFileFormat } from '../../types/tracemind';
import {
  DEFAULT_ANALYSIS_CONFIG,
  parseEventLogContent,
  validateAnalysisRunResponse,
  validateUploadFile,
} from '../../utils/analysisEngine';
import { apiRequest } from './client';

export interface SubmitAnalysisParams {
  datasetName: string;
  rawContent: string;
  file?: File | null;
  formatHint?: LogFileFormat;
  config?: AnalysisConfig;
  signal?: AbortSignal;
}

/**
 * Submits telemetry or generic text logs to the backend POST /analyze endpoint.
 * Never fabricates or simulates analysis results if the backend is unavailable.
 */
export async function submitEventLogAnalysis(
  params: SubmitAnalysisParams
): Promise<AnalysisRun> {
  if (params.file) {
    const fileCheck = validateUploadFile(params.file);
    if (!fileCheck.valid) {
      throw new Error(fileCheck.error || 'Invalid upload file.');
    }
  }

  // Validate structure and preview the detected format before sending.
  const { detectedFormat } = parseEventLogContent(
    params.rawContent,
    params.formatHint
  );

  const config = params.config || DEFAULT_ANALYSIS_CONFIG;

  let requestBody: FormData | Record<string, unknown>;
  if (params.file && typeof FormData !== 'undefined') {
    const formData = new FormData();
    formData.append('file', params.file);
    formData.append('dataset_name', params.datasetName.trim());
    formData.append('format', detectedFormat);
    formData.append('contamination', String(config.contamination));
    formData.append('n_estimators', String(config.n_estimators));
    formData.append('swarm_size', String(config.swarm_size));
    formData.append('max_iterations', String(config.max_iterations));
    formData.append('inertia_weight', String(config.inertia_weight));
    formData.append('cognitive_coeff', String(config.cognitive_coeff));
    formData.append('social_coeff', String(config.social_coeff));
    requestBody = formData;
  } else {
    requestBody = {
      dataset_name: params.datasetName.trim(),
      format: detectedFormat,
      content: params.rawContent,
      config,
    };
  }

  const rawResponse = await apiRequest<unknown>(API_CONFIG.endpoints.analyze, {
    method: 'POST',
    body: requestBody,
    signal: params.signal,
    // Large but valid log files (100k+ rows) need time for scoring, persistence,
    // and the complete evaluated result payload.
    timeoutMs: 180000,
  });

  return validateAnalysisRunResponse(rawResponse);
}

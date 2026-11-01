export type DataSourceMode = 'live_api';

export type ApiConnectionState =
  | 'connected'
  | 'checking'
  | 'unavailable'
  | 'config_missing';

export type SeverityLevel = 'critical' | 'high' | 'medium' | 'normal';

export type PipelineStage =
  | 'idle'
  | 'validating'
  | 'submitting'
  | 'completed'
  | 'failed';

export interface RawEventLogRecord {
  event_id: string;
  timestamp: string;
  service: string;
  event_type: string;
  source_ip: string;
  latency_ms: number;
  error_rate: number;
  cpu_pct: number;
  memory_mb: number;
  payload_bytes: number;
  status_code: number;
  message?: string;
}

export interface FeatureContribution {
  feature: string;
  value: number;
  z_score: number;
  weight: number;
}

export interface EvaluatedEventRecord extends RawEventLogRecord {
  anomaly_score: number;
  isolation_depth: number;
  is_anomaly: boolean;
  severity: SeverityLevel;
  primary_driver: string;
  feature_contributions: FeatureContribution[];
}

export interface IsolationForestSummary {
  algorithm: 'IsolationForest';
  n_estimators: number;
  contamination: number;
  sample_size: number;
  threshold_score: number;
  total_events: number;
  anomalous_events_count: number;
  normal_events_count: number;
  anomaly_rate_pct: number;
  mean_anomaly_score: number;
  max_anomaly_score: number;
  score_distribution: {
    bucket_label: string;
    min_score: number;
    max_score: number;
    normal_count: number;
    anomaly_count: number;
  }[];
  feature_importances: {
    feature: string;
    importance_pct: number;
    mean_anomalous_value: number;
    mean_normal_value: number;
    unit: string;
  }[];
}

export interface PSOCandidateAction {
  action_id: string;
  action_code: string;
  title: string;
  target_subsystem: string;
  description: string;
  estimated_cost_usd: number;
  mitigation_efficacy_pct: number;
  sla_risk_score: number;
  execution_latency_sec: number;
  composite_fitness: number;
  is_selected: boolean;
}

export interface PSOIterationPoint {
  iteration: number;
  global_best_fitness: number;
  swarm_mean_fitness: number;
  swarm_diversity: number;
}

export interface PSOOptimizationResult {
  algorithm: 'ParticleSwarmOptimization';
  swarm_size: number;
  max_iterations: number;
  inertia_weight: number;
  cognitive_coeff: number;
  social_coeff: number;
  converged_at_iteration: number;
  best_fitness_score: number;
  baseline_cost_usd: number;
  optimized_cost_usd: number;
  estimated_savings_pct: number;
  selected_action: PSOCandidateAction;
  candidate_actions: PSOCandidateAction[];
  convergence_history: PSOIterationPoint[];
  optimal_weights: {
    mitigation_weight: number;
    cost_weight: number;
    sla_safety_weight: number;
    speed_weight: number;
  };
}

export interface AgentRecommendation {
  agent_version: string;
  summary_headline: string;
  root_cause_analysis: string;
  why_action_selected: string;
  confidence_score_pct: number;
  risk_assessment: string;
  affected_services: string[];
  execution_steps: {
    step_number: number;
    command_or_action: string;
    verification_check: string;
    estimated_duration: string;
  }[];
  guardrails_checked: {
    rule: string;
    passed: boolean;
    detail: string;
  }[];
}

export interface AnalysisRun {
  run_id: string;
  created_at: string;
  dataset_name: string;
  file_format: 'CSV' | 'JSON';
  data_source: DataSourceMode;
  status: 'completed' | 'failed' | 'processing';
  duration_ms: number;
  isolation_forest: IsolationForestSummary;
  pso_optimization: PSOOptimizationResult;
  agent_recommendation: AgentRecommendation;
  events: EvaluatedEventRecord[];
}

export interface AnalysisConfig {
  contamination: number;
  n_estimators: number;
  swarm_size: number;
  max_iterations: number;
  inertia_weight: number;
  cognitive_coeff: number;
  social_coeff: number;
}

export interface BackendEndpointSpec {
  method: 'GET' | 'POST' | 'DELETE';
  path: string;
  description: string;
  integrationStatus: 'integrated' | 'awaiting_backend_confirmation';
  requestSchema?: string;
  responseSchema: string;
  notes?: string;
}

export type DataSourceMode = 'live_api';
export type LogFileFormat = 'CSV' | 'JSON' | 'JSONL' | 'LOG';

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
  timestamp: string | null;
  service: string;
  event_type: string;
  source_ip: string;
  latency_ms: number | null;
  error_rate: number | null;
  cpu_pct: number | null;
  memory_mb: number | null;
  payload_bytes: number | null;
  status_code: number | null;
  message?: string;
  log_features?: Record<string, number | null>;
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
  ml_severity?: 'critical' | 'medium' | 'normal';
  ml_severity_confidence?: number;
  ml_severity_explanation?: string;
}

export interface IsolationForestSummary {
  algorithm: 'IsolationForest';
  n_estimators: number;
  contamination: number;
  sample_size: number;
  threshold_score: number | null;
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
  converged_at_iteration: number | null;
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
  /** Kept for legacy API consumers; v2 uses evidence_coverage_pct, not a confidence claim. */
  evidence_coverage_pct?: number;
  decision_trace?: AgentDecisionTrace;
}

export type AgentBeliefStatus = 'supported' | 'uncertain' | 'contradicted';

export interface AgentEvidenceItem {
  evidence_id: string;
  source: 'dataset_metadata' | 'isolation_forest' | 'evaluated_event' | 'pso_optimization';
  statement: string;
  references: string[];
  observed_values: Record<string, unknown>;
}

export interface AgentBelief {
  belief_id: string;
  statement: string;
  status: AgentBeliefStatus;
  supporting_evidence_ids: string[];
  explanation: string;
}

export interface InvestigationGoal {
  goal_id: string;
  objective: string;
  source_belief_ids: string[];
  supporting_evidence_ids: string[];
}

export interface CandidateInvestigationPlan {
  plan_id: string;
  objective: string;
  action_id: string;
  action_title: string;
  candidate_action: PSOCandidateAction;
  goal_ids: string[];
  supporting_evidence_ids: string[];
  estimated_cost_usd: number | null;
  sla_risk_score: number | null;
  is_pso_selected: boolean;
  selection_rationale: string;
  rejection_reason: string | null;
  advisory_only: boolean;
}

export interface SelectedInvestigationIntention {
  status: 'selected' | 'no_recommendation';
  plan_id: string | null;
  action_id: string | null;
  selection_reason: string;
  supporting_evidence_ids: string[];
  constraints_considered: string[];
  uncertainty_and_limitations: string[];
  advisory_only: boolean;
}

export interface AgentDecisionTrace {
  trace_version: string;
  evidence_considered: AgentEvidenceItem[];
  beliefs: AgentBelief[];
  goals: InvestigationGoal[];
  candidate_plans: CandidateInvestigationPlan[];
  selected_intention: SelectedInvestigationIntention;
  missing_evidence: string[];
  limitations: string[];
}

export interface SeverityClassificationSummary {
  model: string;
  model_version?: string;
  algorithm?: string;
  classes?: string[];
  label_rules_version?: string;
  labels_note?: string;
  total_events: number;
  counts: {
    critical?: number;
    medium?: number;
    normal?: number;
    [key: string]: number | undefined;
  };
  mean_confidence?: number;
}

export interface AnalysisRun {
  run_id: string;
  created_at: string;
  dataset_name: string;
  file_format: 'CSV' | 'JSON' | 'JSONL' | 'LOG' | 'TEXT';
  data_source: DataSourceMode;
  status: 'completed' | 'failed' | 'processing';
  duration_ms: number;
  isolation_forest: IsolationForestSummary;
  severity_classification?: SeverityClassificationSummary;
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

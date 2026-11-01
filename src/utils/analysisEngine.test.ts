import test from 'node:test';
import assert from 'node:assert/strict';
import {
  exportEventsToCsv,
  filterAndSortEvents,
  parseEventLogContent,
  validateAnalysisRunResponse,
} from './analysisEngine';
import { EvaluatedEventRecord } from '../types/tracemind';

const VALID_CSV = `event_id,timestamp,service,event_type,source_ip,latency_ms,error_rate,cpu_pct,memory_mb,payload_bytes,status_code
EVT-1001,2026-11-01T08:00:00Z,auth-service,TOKEN_VERIFY,10.0.1.12,42,0.002,34,920,1024,200
EVT-1002,2026-11-01T08:00:15Z,payment-gateway,CHARGE_AUTH,10.0.2.51,1480,0.420,94,3400,16384,503`;

test('parseEventLogContent validates and parses CSV event logs accurately', () => {
  const { records, detectedFormat } = parseEventLogContent(VALID_CSV);
  assert.equal(detectedFormat, 'CSV');
  assert.equal(records.length, 2);
  assert.equal(records[1].event_id, 'EVT-1002');
  assert.equal(records[1].latency_ms, 1480);
  assert.equal(records[1].status_code, 503);
});

test('parseEventLogContent validates and parses JSON event logs accurately', () => {
  const jsonPayload = JSON.stringify([
    {
      event_id: 'EVT-2001',
      service: 'search-index',
      latency_ms: 35,
      error_rate: 0.001,
      cpu_pct: 28,
    },
    {
      event_id: 'EVT-2002',
      service: 'search-index',
      latency_ms: 1950,
      error_rate: 0.65,
      cpu_pct: 97,
    },
  ]);
  const { records, detectedFormat } = parseEventLogContent(jsonPayload);
  assert.equal(detectedFormat, 'JSON');
  assert.equal(records.length, 2);
  assert.equal(records[1].event_id, 'EVT-2002');
  assert.equal(records[1].latency_ms, 1950);
});

test('parseEventLogContent rejects empty or malformed input', () => {
  assert.throws(() => parseEventLogContent('   '), /cannot be empty/i);
  assert.throws(
    () => parseEventLogContent('invalid_col_1,invalid_col_2\n1,2'),
    /missing required telemetry columns/i
  );
  assert.throws(() => parseEventLogContent('{bad json'), /Invalid JSON syntax/i);
});

test('validateAnalysisRunResponse rejects incomplete payloads and normalizes partial arrays', () => {
  assert.throws(() => validateAnalysisRunResponse(null), /expected an AnalysisRun/i);
  assert.throws(() => validateAnalysisRunResponse({ run_id: '' }), /missing required "run_id"/i);

  const normalized = validateAnalysisRunResponse({
    run_id: 'RUN-01',
    created_at: '2026-11-01T10:00:00Z',
    dataset_name: 'backend-test.csv',
    file_format: 'CSV',
    status: 'completed',
    duration_ms: 120,
    isolation_forest: {
      algorithm: 'IsolationForest',
      n_estimators: 100,
      contamination: 0.1,
      sample_size: 256,
      threshold_score: 0.65,
      total_events: 2,
      anomalous_events_count: 1,
      normal_events_count: 1,
      anomaly_rate_pct: 50,
      mean_anomaly_score: 0.55,
      max_anomaly_score: 0.85,
    },
    pso_optimization: {
      algorithm: 'ParticleSwarmOptimization',
      swarm_size: 30,
      max_iterations: 25,
      inertia_weight: 0.72,
      cognitive_coeff: 1.49,
      social_coeff: 1.49,
      converged_at_iteration: 14,
      best_fitness_score: 88.4,
      baseline_cost_usd: 200,
      optimized_cost_usd: 90,
      estimated_savings_pct: 55,
      selected_action: {
        action_id: 'ACT-1',
        action_code: 'SCALE',
        title: 'Scale',
        target_subsystem: 'api',
        description: 'Scale out',
        estimated_cost_usd: 90,
        mitigation_efficacy_pct: 92,
        sla_risk_score: 10,
        execution_latency_sec: 12,
        composite_fitness: 88.4,
        is_selected: true,
      },
      optimal_weights: {
        mitigation_weight: 0.5,
        cost_weight: 0.2,
        sla_safety_weight: 0.2,
        speed_weight: 0.1,
      },
    },
    agent_recommendation: {
      agent_version: '1.0',
      summary_headline: 'Scale API',
      root_cause_analysis: 'Spike',
      why_action_selected: 'Optimal fitness',
      confidence_score_pct: 91,
      risk_assessment: 'Low',
    },
  });

  assert.equal(normalized.data_source, 'live_api');
  assert.deepEqual(normalized.events, []);
  assert.deepEqual(normalized.isolation_forest.score_distribution, []);
  assert.deepEqual(normalized.pso_optimization.candidate_actions, []);
});

test('filterAndSortEvents filters and sorts backend event records without mutating scores', () => {
  const backendEvents: EvaluatedEventRecord[] = [
    {
      event_id: 'EVT-1',
      timestamp: '2026-11-01T08:00:00Z',
      service: 'auth',
      event_type: 'LOGIN',
      source_ip: '10.0.0.1',
      latency_ms: 40,
      error_rate: 0.01,
      cpu_pct: 30,
      memory_mb: 512,
      payload_bytes: 256,
      status_code: 200,
      anomaly_score: 0.31,
      isolation_depth: 9.8,
      is_anomaly: false,
      severity: 'normal',
      primary_driver: 'latency_ms',
      feature_contributions: [],
    },
    {
      event_id: 'EVT-2',
      timestamp: '2026-11-01T08:01:00Z',
      service: 'payments',
      event_type: 'CHARGE',
      source_ip: '10.0.0.9',
      latency_ms: 1650,
      error_rate: 0.45,
      cpu_pct: 95,
      memory_mb: 2048,
      payload_bytes: 8192,
      status_code: 503,
      anomaly_score: 0.89,
      isolation_depth: 3.4,
      is_anomaly: true,
      severity: 'critical',
      primary_driver: 'latency_ms',
      feature_contributions: [],
    },
  ];

  const onlyAnomalies = filterAndSortEvents(backendEvents, {
    searchQuery: '',
    onlyAnomalies: true,
    severityFilter: 'all',
    serviceFilter: 'all',
    sortBy: 'anomaly_score',
    sortDirection: 'desc',
  });

  assert.equal(onlyAnomalies.length, 1);
  assert.equal(onlyAnomalies[0].event_id, 'EVT-2');

  const csv = exportEventsToCsv(onlyAnomalies);
  assert.ok(csv.includes('EVT-2'));
});

import { get, post, put, del } from './client';
import type {
  AnomalyDetectionRule,
  AnomalyEvent,
  RemediationMode,
  RemediationResult,
  RootCauseAnalysisResult,
} from '@/types';

export interface CreateRulePayload {
  name: string;
  metricType: string;
  conditionOperator: string;
  threshold: number;
  timeWindowSeconds: number;
  aggregationFunction: string;
  severity: string;
  enabled: boolean;
}

export async function getAnomalies(status?: string): Promise<AnomalyEvent[]> {
  return get<AnomalyEvent[]>('/v1/dashboard/anomalies', status ? { status } : undefined);
}

export async function getAnomaly(id: string): Promise<AnomalyEvent> {
  return get<AnomalyEvent>(`/v1/dashboard/anomalies/${id}`);
}

export async function analyzeAnomaly(id: string): Promise<RootCauseAnalysisResult> {
  return post<RootCauseAnalysisResult>(`/v1/dashboard/anomalies/${id}/analyze`);
}

export async function remediateAnomaly(
  id: string,
  mode: RemediationMode = 'ADVISE',
  actionCode?: string,
): Promise<RemediationResult> {
  return post<RemediationResult>(`/v1/dashboard/anomalies/${id}/remediate`, { mode, actionCode });
}

export async function getAnomalyRules(): Promise<AnomalyDetectionRule[]> {
  return get<AnomalyDetectionRule[]>('/v1/dashboard/anomaly-rules');
}

export async function createAnomalyRule(payload: CreateRulePayload): Promise<AnomalyDetectionRule> {
  return post<AnomalyDetectionRule>('/v1/dashboard/anomaly-rules', payload);
}

export async function updateAnomalyRule(
  id: string,
  payload: CreateRulePayload,
): Promise<AnomalyDetectionRule> {
  return put<AnomalyDetectionRule>(`/v1/dashboard/anomaly-rules/${id}`, payload);
}

export async function deleteAnomalyRule(id: string): Promise<void> {
  return del<void>(`/v1/dashboard/anomaly-rules/${id}`);
}

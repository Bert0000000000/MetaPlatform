import { createApiClient, apiPath } from '@mate/shared/api';

const client = createApiClient({ baseURL: apiPath('dashboard', '') });
const data = <T>(resp: { data: T }): T => resp.data;
async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  return data(await client.get<T>(url, params ? { params } : undefined));
}
async function post<T>(url: string, body?: unknown): Promise<T> {
  return data(await client.post<T>(url, body));
}
async function put<T>(url: string, body?: unknown): Promise<T> {
  return data(await client.put<T>(url, body));
}
async function del<T>(url: string): Promise<T> {
  return data(await client.delete<T>(url));
}


import type {
  AnomalyDetectionRule,
  AnomalyEvent,
  RemediationMode,
  RemediationResult,
  RootCauseAnalysisResult,
} from './types';

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
  return get<AnomalyEvent[]>('/anomalies', status ? { status } : undefined);
}

export async function getAnomaly(id: string): Promise<AnomalyEvent> {
  return get<AnomalyEvent>(`/anomalies/${id}`);
}

export async function analyzeAnomaly(id: string): Promise<RootCauseAnalysisResult> {
  return post<RootCauseAnalysisResult>(`/anomalies/${id}/analyze`);
}

export async function remediateAnomaly(
  id: string,
  mode: RemediationMode = 'ADVISE',
  actionCode?: string,
): Promise<RemediationResult> {
  return post<RemediationResult>(`/anomalies/${id}/remediate`, { mode, actionCode });
}

export async function getAnomalyRules(): Promise<AnomalyDetectionRule[]> {
  return get<AnomalyDetectionRule[]>('/anomaly-rules');
}

export async function createAnomalyRule(payload: CreateRulePayload): Promise<AnomalyDetectionRule> {
  return post<AnomalyDetectionRule>('/anomaly-rules', payload);
}

export async function updateAnomalyRule(
  id: string,
  payload: CreateRulePayload,
): Promise<AnomalyDetectionRule> {
  return put<AnomalyDetectionRule>(`/anomaly-rules/${id}`, payload);
}

export async function deleteAnomalyRule(id: string): Promise<void> {
  return del<void>(`/anomaly-rules/${id}`);
}

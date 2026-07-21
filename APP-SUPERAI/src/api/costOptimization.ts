import { apiClient } from './client';

const BASE = '/v1/llmgw';

export interface RoutingRequest {
  promptTokens: number;
  completionTokens: number;
  requiredCapabilities?: string[];
  preferredProvider?: string;
  strategy?: 'cheapest' | 'balanced' | 'best_quality';
  maxLatencyMs?: number;
}

export interface CandidateModel {
  modelId: string;
  provider: string;
  modelCode: string;
  displayName: string;
  type: string;
  inputPrice: number;
  outputPrice: number;
  contextLength: number;
  capabilities: string[];
  estimatedCost: number;
  estimatedLatencyMs: number;
  score: number;
  reason: string;
}

export interface RoutingRecommendation {
  tenantId: string;
  recommendedModelId: string;
  recommendedDisplayName: string;
  estimatedCost: number;
  potentialSavings: number;
  savingsRate: number;
  candidates: CandidateModel[];
  strategy: string;
}

export async function recommendModel(req: RoutingRequest): Promise<RoutingRecommendation> {
  const resp = await apiClient.post(`${BASE}/routing/recommend`, req);
  return resp.data.data;
}

export interface RoutingRule {
  ruleId: string;
  name: string;
  description: string;
  requiredCapabilities: string[];
  preferredProvider?: string;
  strategy: string;
  priority: number;
  fallbackModelId?: string;
  enabled: boolean;
}

export async function listRoutingRules(): Promise<RoutingRule[]> {
  const resp = await apiClient.get(`${BASE}/routing/rules`);
  return resp.data.data.items;
}

export async function createRoutingRule(rule: Omit<RoutingRule, 'ruleId'>): Promise<RoutingRule> {
  const resp = await apiClient.post(`${BASE}/routing/rules`, rule);
  return resp.data.data;
}

export async function updateRoutingRule(
  ruleId: string,
  updates: Partial<RoutingRule>,
): Promise<RoutingRule> {
  const resp = await apiClient.put(`${BASE}/routing/rules/${ruleId}`, updates);
  return resp.data.data;
}

export async function deleteRoutingRule(ruleId: string): Promise<void> {
  await apiClient.delete(`${BASE}/routing/rules/${ruleId}`);
}

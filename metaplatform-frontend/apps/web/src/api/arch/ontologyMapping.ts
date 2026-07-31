import { createApiClient, apiPath } from '@mate/shared/api';

const client = createApiClient({ baseURL: apiPath('arch', '') });
const data = <T>(resp: { data: T }): T => resp.data;
async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> { return data(await client.get<T>(url, params ? { params } : undefined)); }
async function post<T>(url: string, body?: unknown): Promise<T> { return data(await client.post<T>(url, body)); }
async function put<T>(url: string, body?: unknown): Promise<T> { return data(await client.put<T>(url, body)); }
async function del<T>(url: string): Promise<T> { return data(await client.delete<T>(url)); }

import type {
  ConceptMappingRule,
  CreateMappingRuleRequest,
  UpdateMappingRuleRequest,
  SyncResult,
  OntologyChangeEvent,
  ImpactAnalysisResult,
  OntologyMapping,
} from './types';

export async function listMappingRules(assetType?: string): Promise<ConceptMappingRule[]> {
  return get<ConceptMappingRule[]>('/ontology-mappings/rules', assetType ? { assetType } : undefined);
}

export async function createMappingRule(req: CreateMappingRuleRequest): Promise<ConceptMappingRule> {
  return post<ConceptMappingRule>('/ontology-mappings/rules', req);
}

export async function updateMappingRule(id: string, req: UpdateMappingRuleRequest): Promise<ConceptMappingRule> {
  return put<ConceptMappingRule>(`/ontology-mappings/rules/${id}`, req);
}

export async function deleteMappingRule(id: string): Promise<void> {
  await del<void>(`/ontology-mappings/rules/${id}`);
}

export async function syncToOntology(assetType?: string): Promise<SyncResult> {
  const query = assetType ? `?assetType=${encodeURIComponent(assetType)}` : '';
  return post<SyncResult>(`/ontology-mappings/sync-to-ontology${query}`);
}

export async function syncFromOntology(assetType?: string): Promise<SyncResult> {
  const query = assetType ? `?assetType=${encodeURIComponent(assetType)}` : '';
  return post<SyncResult>(`/ontology-mappings/sync-from-ontology${query}`);
}

export async function listPendingChanges(conceptId?: string): Promise<OntologyChangeEvent[]> {
  return get<OntologyChangeEvent[]>('/ontology-mappings/changes', conceptId ? { conceptId } : undefined);
}

export async function resolveChange(id: string): Promise<OntologyChangeEvent> {
  return post<OntologyChangeEvent>(`/ontology-mappings/changes/${id}/resolve`);
}

/**
 * 拉取能力-本体概念映射列表（V11-09 历史接口，能力地图使用）。
 * 后端实际路径为 /api/v1/arch/capability-mappings。
 */
export async function getOntologyMappings(): Promise<OntologyMapping[]> {
  return get<OntologyMapping[]>('/capability-mappings');
}

/**
 * 发起影响分析：给定 capabilityId，返回受影响的能力/应用/流程及风险等级。
 */
export async function analyzeImpact(capabilityId: string): Promise<ImpactAnalysisResult> {
  return post<ImpactAnalysisResult>('/impact-analysis', { capabilityId });
}

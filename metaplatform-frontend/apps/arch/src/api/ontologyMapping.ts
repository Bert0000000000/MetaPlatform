import { get, post, put, del } from './client';
import type {
  ConceptMappingRule,
  CreateMappingRuleRequest,
  UpdateMappingRuleRequest,
  SyncResult,
  OntologyChangeEvent,
  ImpactAnalysisResult,
  OntologyMapping,
} from '@/types';

export async function listMappingRules(assetType?: string): Promise<ConceptMappingRule[]> {
  return get<ConceptMappingRule[]>('/v1/ea/ontology-mappings/rules', assetType ? { assetType } : undefined);
}

export async function createMappingRule(req: CreateMappingRuleRequest): Promise<ConceptMappingRule> {
  return post<ConceptMappingRule>('/v1/ea/ontology-mappings/rules', req);
}

export async function updateMappingRule(id: string, req: UpdateMappingRuleRequest): Promise<ConceptMappingRule> {
  return put<ConceptMappingRule>(`/v1/ea/ontology-mappings/rules/${id}`, req);
}

export async function deleteMappingRule(id: string): Promise<void> {
  await del<void>(`/v1/ea/ontology-mappings/rules/${id}`);
}

export async function syncToOntology(assetType?: string): Promise<SyncResult> {
  const query = assetType ? `?assetType=${encodeURIComponent(assetType)}` : '';
  return post<SyncResult>(`/v1/ea/ontology-mappings/sync-to-ontology${query}`);
}

export async function syncFromOntology(assetType?: string): Promise<SyncResult> {
  const query = assetType ? `?assetType=${encodeURIComponent(assetType)}` : '';
  return post<SyncResult>(`/v1/ea/ontology-mappings/sync-from-ontology${query}`);
}

export async function listPendingChanges(conceptId?: string): Promise<OntologyChangeEvent[]> {
  return get<OntologyChangeEvent[]>('/v1/ea/ontology-mappings/changes', conceptId ? { conceptId } : undefined);
}

export async function resolveChange(id: string): Promise<OntologyChangeEvent> {
  return post<OntologyChangeEvent>(`/v1/ea/ontology-mappings/changes/${id}/resolve`);
}

/**
 * 拉取能力-本体概念映射列表（V11-09 历史接口，能力地图使用）。
 * 后端实际路径为 /api/v1/ea/capability-mappings。
 */
export async function getOntologyMappings(): Promise<OntologyMapping[]> {
  return get<OntologyMapping[]>('/v1/ea/capability-mappings');
}

/**
 * 发起影响分析：给定 capabilityId，返回受影响的能力/应用/流程及风险等级。
 */
export async function analyzeImpact(capabilityId: string): Promise<ImpactAnalysisResult> {
  return post<ImpactAnalysisResult>('/v1/ea/impact-analysis', { capabilityId });
}

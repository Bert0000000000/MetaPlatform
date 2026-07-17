import { get, post } from './client';
import type { OntologyMapping, ImpactAnalysisResult } from '@/types';

const MOCK_MAPPINGS: OntologyMapping[] = [
  { capabilityId: 'c2', capabilityName: '报销管理', conceptId: 'con-1', conceptName: '报销单', mappingType: 'direct', confidence: 95 },
  { capabilityId: 'c3', capabilityName: '预算管理', conceptId: 'con-2', conceptName: '预算', mappingType: 'direct', confidence: 90 },
  { capabilityId: 'c5', capabilityName: '招聘管理', conceptId: 'con-3', conceptName: '候选人', mappingType: 'partial', confidence: 70 },
  { capabilityId: 'c1', capabilityName: '财务管理', conceptId: 'con-4', conceptName: '财务', mappingType: 'direct', confidence: 98 },
  { capabilityId: 'c6', capabilityName: '供应链管理', conceptId: 'con-5', conceptName: '供应商', mappingType: 'planned', confidence: 30 },
];

export async function getOntologyMappings(): Promise<OntologyMapping[]> {
  try {
    return await get<OntologyMapping[]>('/v1/ea/ontology-mappings');
  } catch {
    return MOCK_MAPPINGS;
  }
}

export async function analyzeImpact(capabilityId: string): Promise<ImpactAnalysisResult> {
  try {
    return await post<ImpactAnalysisResult>('/v1/ea/impact-analysis', { capabilityId });
  } catch {
    return {
      affectedCapabilities: [capabilityId, 'c2', 'c3'],
      affectedApplications: ['a1', 'a2'],
      affectedProcesses: ['bp1'],
      riskLevel: 'medium',
    };
  }
}

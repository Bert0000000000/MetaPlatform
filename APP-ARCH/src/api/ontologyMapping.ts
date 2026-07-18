import { get, post } from './client';
import type { OntologyMapping, ImpactAnalysisResult } from '@/types';

export async function getOntologyMappings(): Promise<OntologyMapping[]> {
  return get<OntologyMapping[]>('/v1/ea/ontology-mappings');
}

export async function analyzeImpact(capabilityId: string): Promise<ImpactAnalysisResult> {
  return post<ImpactAnalysisResult>('/v1/ea/impact-analysis', { capabilityId });
}

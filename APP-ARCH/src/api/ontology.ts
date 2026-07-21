import { get } from './client';
import type { OntologyConcept } from '@/types';

export async function searchOntologyConcepts(keyword?: string): Promise<OntologyConcept[]> {
  return get<OntologyConcept[]>('/v1/ont/concepts/search', keyword ? { keyword } : undefined);
}

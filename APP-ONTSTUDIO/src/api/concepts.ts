import { get, post, put, del } from './client';
import type {
  Concept,
  ConceptCreateRequest,
  ConceptHierarchyResponse,
  PageResponse,
} from '@/types';

const BASE = '/v1/ont/concepts';

export async function listConcepts(): Promise<PageResponse<Concept>> {
  return get<PageResponse<Concept>>(BASE);
}

export async function getConcept(conceptId: string): Promise<Concept> {
  return get<Concept>(`${BASE}/${conceptId}`);
}

export async function createConcept(request: ConceptCreateRequest): Promise<Concept> {
  return post<Concept>(BASE, request);
}

export async function updateConcept(conceptId: string, request: ConceptCreateRequest): Promise<Concept> {
  return put<Concept>(`${BASE}/${conceptId}`, request);
}

export async function deleteConcept(conceptId: string): Promise<void> {
  return del<void>(`${BASE}/${conceptId}`);
}

export async function getConceptHierarchy(rootConceptId?: string, maxDepth?: number): Promise<ConceptHierarchyResponse> {
  return get<ConceptHierarchyResponse>(`${BASE}/hierarchy`, { rootConceptId, maxDepth });
}

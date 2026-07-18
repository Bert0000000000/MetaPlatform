import { get, post, put, del } from './client';
import type { PageResponse } from '@/types';

export interface RelationType {
  relationTypeId: string;
  tenantId: string;
  code: string;
  name: string;
  sourceConcept: string;
  targetConcept: string;
  cardinality: '1-1' | '1-N' | 'N-1' | 'N-N';
  description?: string;
  properties?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface RelationInstance {
  relationInstanceId: string;
  relationTypeId: string;
  sourceEntityId: string;
  targetEntityId: string;
  attributes?: Record<string, unknown>;
  createdAt?: string;
}

const TYPES_BASE = '/v1/ont/relations/types';
const INSTANCES_BASE = '/v1/ont/relations/instances';

export async function listRelationTypes(): Promise<PageResponse<RelationType>> {
  return get<PageResponse<RelationType>>(TYPES_BASE);
}

export async function createRelationType(req: Omit<RelationType, 'relationTypeId' | 'tenantId' | 'createdAt' | 'updatedAt'>): Promise<RelationType> {
  return post<RelationType>(TYPES_BASE, req);
}

export async function updateRelationType(id: string, req: Omit<RelationType, 'relationTypeId' | 'tenantId' | 'createdAt' | 'updatedAt'>): Promise<RelationType> {
  return put<RelationType>(`${TYPES_BASE}/${id}`, req);
}

export async function deleteRelationType(id: string): Promise<void> {
  await del<void>(`${TYPES_BASE}/${id}`);
}

export async function listRelationInstances(): Promise<RelationInstance[]> {
  return get<RelationInstance[]>(INSTANCES_BASE);
}

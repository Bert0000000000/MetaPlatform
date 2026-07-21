import { get, post, put, del } from './client';
import type { PageResponse } from '@/types';

export interface RelationType {
  relationTypeId: string;
  tenantId: string;
  code: string;
  name: string;
  description?: string;
  sourceConceptId: string;
  sourceConceptName?: string;
  targetConceptId: string;
  targetConceptName?: string;
  direction?: string;
  cardinality: '1-1' | '1-N' | 'N-1' | 'N-N' | string;
  minCardinality?: number;
  maxCardinality?: number;
  symmetric?: boolean;
  transitive?: boolean;
  attributeIds?: string[];
  instanceCount?: number;
  properties?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface RelationInstance {
  relationInstanceId: string;
  tenantId?: string;
  relationTypeId: string;
  relationTypeCode?: string;
  sourceEntityId: string;
  sourceEntityName?: string;
  targetEntityId: string;
  targetEntityName?: string;
  attributes?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
}

const TYPES_BASE = '/v1/ont/relations/types';
const INSTANCES_BASE = '/v1/ont/relations/instances';

export async function listRelationTypes(params?: {
  keyword?: string;
  sourceConceptId?: string;
  targetConceptId?: string;
  direction?: string;
}): Promise<PageResponse<RelationType>> {
  return get<PageResponse<RelationType>>(TYPES_BASE, params as Record<string, unknown> | undefined);
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

export async function listRelationInstances(params?: {
  relationTypeId?: string;
  sourceEntityId?: string;
  targetEntityId?: string;
}): Promise<PageResponse<RelationInstance>> {
  return get<PageResponse<RelationInstance>>(INSTANCES_BASE, params as Record<string, unknown> | undefined);
}

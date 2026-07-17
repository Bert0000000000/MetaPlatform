import { get, post, put, del } from './client';
import type { Entity, EntityCreateRequest, PageResponse } from '@/types';

const BASE = '/v1/ont/entities';

export async function listEntities(params?: {
  keyword?: string;
  conceptId?: string;
  includeAttributes?: boolean;
}): Promise<PageResponse<Entity>> {
  return get<PageResponse<Entity>>(BASE, params);
}

export async function getEntity(entityId: string): Promise<Entity> {
  return get<Entity>(`${BASE}/${entityId}`);
}

export async function createEntity(request: EntityCreateRequest): Promise<Entity> {
  return post<Entity>(BASE, request);
}

export async function updateEntity(entityId: string, request: EntityCreateRequest): Promise<Entity> {
  return put<Entity>(`${BASE}/${entityId}`, request);
}

export async function deleteEntity(entityId: string): Promise<void> {
  return del<void>(`${BASE}/${entityId}`);
}

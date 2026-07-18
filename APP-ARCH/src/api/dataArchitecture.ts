import { get, post, put, del } from './client';
import type { DataDomain, DataEntity, DataFlow } from '@/types';

export async function listDomains(): Promise<DataDomain[]> {
  return get<DataDomain[]>('/v1/ea/data/domains');
}

export async function createDomain(req: Partial<DataDomain>): Promise<DataDomain> {
  return post<DataDomain>('/v1/ea/data/domains', req);
}

export async function deleteDomain(id: string): Promise<void> {
  await del<void>(`/v1/ea/data/domains/${id}`);
}

export async function listEntities(domainId?: string): Promise<DataEntity[]> {
  return get<DataEntity[]>('/v1/ea/data/entities', { domainId });
}

export async function createEntity(req: Partial<DataEntity>): Promise<DataEntity> {
  return post<DataEntity>('/v1/ea/data/entities', req);
}

export async function updateEntity(id: string, req: Partial<DataEntity>): Promise<DataEntity> {
  return put<DataEntity>(`/v1/ea/data/entities/${id}`, req);
}

export async function deleteEntity(id: string): Promise<void> {
  await del<void>(`/v1/ea/data/entities/${id}`);
}

export async function listFlows(): Promise<DataFlow[]> {
  return get<DataFlow[]>('/v1/ea/data/flows');
}

export async function createFlow(req: Partial<DataFlow>): Promise<DataFlow> {
  return post<DataFlow>('/v1/ea/data/flows', req);
}

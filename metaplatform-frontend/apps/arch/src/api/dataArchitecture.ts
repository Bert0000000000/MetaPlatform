import { get, post, put, del } from './client';
import type { DataDomain, DataEntity, DataFlow, DataStandard, DataAsset, DataAssetCatalog } from '@/types';

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
  return get<DataEntity[]>('/v1/ea/data-entities', { domainId });
}

export async function getEntity(id: string): Promise<DataEntity> {
  return get<DataEntity>(`/v1/ea/data-entities/${id}`);
}

export async function createEntity(req: Partial<DataEntity>): Promise<DataEntity> {
  return post<DataEntity>('/v1/ea/data-entities', req);
}

export async function updateEntity(id: string, req: Partial<DataEntity>): Promise<DataEntity> {
  return put<DataEntity>(`/v1/ea/data-entities/${id}`, req);
}

export async function deleteEntity(id: string): Promise<void> {
  await del<void>(`/v1/ea/data-entities/${id}`);
}

export async function listFlows(): Promise<DataFlow[]> {
  return get<DataFlow[]>('/v1/ea/data-flows');
}

export async function createFlow(req: Partial<DataFlow>): Promise<DataFlow> {
  return post<DataFlow>('/v1/ea/data-flows', req);
}

export async function updateFlow(id: string, req: Partial<DataFlow>): Promise<DataFlow> {
  return put<DataFlow>(`/v1/ea/data-flows/${id}`, req);
}

export async function deleteFlow(id: string): Promise<void> {
  await del<void>(`/v1/ea/data-flows/${id}`);
}

export async function listStandards(): Promise<DataStandard[]> {
  return get<DataStandard[]>('/v1/ea/data-standards');
}

export async function createStandard(req: Partial<DataStandard>): Promise<DataStandard> {
  return post<DataStandard>('/v1/ea/data-standards', req);
}

export async function updateStandard(id: string, req: Partial<DataStandard>): Promise<DataStandard> {
  return put<DataStandard>(`/v1/ea/data-standards/${id}`, req);
}

export async function deleteStandard(id: string): Promise<void> {
  await del<void>(`/v1/ea/data-standards/${id}`);
}

export async function listAssets(params?: { keyword?: string; assetType?: string; classification?: string }): Promise<DataAsset[]> {
  return get<DataAsset[]>('/v1/ea/data-assets', params);
}

export async function getAssetCatalog(groupBy?: string): Promise<DataAssetCatalog> {
  return get<DataAssetCatalog>('/v1/ea/data-assets/catalog', { groupBy });
}

export async function createAsset(req: Partial<DataAsset>): Promise<DataAsset> {
  return post<DataAsset>('/v1/ea/data-assets', req);
}

export async function updateAsset(id: string, req: Partial<DataAsset>): Promise<DataAsset> {
  return put<DataAsset>(`/v1/ea/data-assets/${id}`, req);
}

export async function deleteAsset(id: string): Promise<void> {
  await del<void>(`/v1/ea/data-assets/${id}`);
}

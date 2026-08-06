import { createApiClient, apiPath } from '@mate/shared/api';

const client = createApiClient({ baseURL: apiPath('arch', '') });
const data = <T>(resp: { data: T }): T => resp.data;
async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> { return data(await client.get<T>(url, params ? { params } : undefined)); }
async function post<T>(url: string, body?: unknown): Promise<T> { return data(await client.post<T>(url, body)); }
async function put<T>(url: string, body?: unknown): Promise<T> { return data(await client.put<T>(url, body)); }
async function del<T>(url: string): Promise<T> { return data(await client.delete<T>(url)); }

/** Backend list endpoints return {items:[...], total}; unwrap to a bare array. */
async function list<T>(url: string, params?: Record<string, unknown>): Promise<T[]> {
  const res = await get<{ items?: T[] }>(url, params);
  return (res?.items ?? []) as T[];
}

import type { DataDomain, DataEntity, DataFlow, DataStandard, DataAsset, DataAssetCatalog } from './types';

export async function listDomains(): Promise<DataDomain[]> {
  return list<DataDomain>('/data/domains');
}

export async function createDomain(req: Partial<DataDomain>): Promise<DataDomain> {
  return post<DataDomain>('/data/domains', req);
}

export async function deleteDomain(id: string): Promise<void> {
  await del<void>(`/data/domains/${id}`);
}

export async function listEntities(domainId?: string): Promise<DataEntity[]> {
  return list<DataEntity>('/data-entities', domainId ? { domainId } : undefined);
}

export async function getEntity(id: string): Promise<DataEntity> {
  return get<DataEntity>(`/data-entities/${id}`);
}

export async function createEntity(req: Partial<DataEntity>): Promise<DataEntity> {
  return post<DataEntity>('/data-entities', req);
}

export async function updateEntity(id: string, req: Partial<DataEntity>): Promise<DataEntity> {
  return put<DataEntity>(`/data-entities/${id}`, req);
}

export async function deleteEntity(id: string): Promise<void> {
  await del<void>(`/data-entities/${id}`);
}

export async function listFlows(): Promise<DataFlow[]> {
  return list<DataFlow>('/data-flows');
}

export async function createFlow(req: Partial<DataFlow>): Promise<DataFlow> {
  return post<DataFlow>('/data-flows', req);
}

export async function updateFlow(id: string, req: Partial<DataFlow>): Promise<DataFlow> {
  return put<DataFlow>(`/data-flows/${id}`, req);
}

export async function deleteFlow(id: string): Promise<void> {
  await del<void>(`/data-flows/${id}`);
}

export async function listStandards(): Promise<DataStandard[]> {
  return list<DataStandard>('/data-standards');
}

export async function createStandard(req: Partial<DataStandard>): Promise<DataStandard> {
  return post<DataStandard>('/data-standards', req);
}

export async function updateStandard(id: string, req: Partial<DataStandard>): Promise<DataStandard> {
  return put<DataStandard>(`/data-standards/${id}`, req);
}

export async function deleteStandard(id: string): Promise<void> {
  await del<void>(`/data-standards/${id}`);
}

export async function listAssets(params?: { keyword?: string; assetType?: string; classification?: string }): Promise<DataAsset[]> {
  return list<DataAsset>('/data-assets', params);
}

export async function getAssetCatalog(groupBy?: string): Promise<DataAssetCatalog> {
  // 后端返回 {items:[...]}，按 groupBy 分组组装成前端 catalog 结构
  const res = await get<{ items?: DataAsset[] }>('/data-assets/catalog', { groupBy });
  const assets = res?.items ?? [];
  const keyOf = (a: DataAsset): string => {
    if (groupBy === 'domain') return a.domain || '其他';
    if (groupBy === 'layer') return a.layer || '其他';
    if (groupBy === 'owner') return a.owner || '其他';
    return a.domain || '其他';
  };
  const groupsMap = new Map<string, DataAsset[]>();
  for (const a of assets) {
    const k = keyOf(a);
    groupsMap.set(k, [...(groupsMap.get(k) ?? []), a]);
  }
  const groups = [...groupsMap.entries()].map(([key, list]) => ({
    key,
    label: key,
    assets: list,
  }));
  return { groupBy: groupBy ?? 'domain', groups };
}

export async function createAsset(req: Partial<DataAsset>): Promise<DataAsset> {
  return post<DataAsset>('/data-assets', req);
}

export async function updateAsset(id: string, req: Partial<DataAsset>): Promise<DataAsset> {
  return put<DataAsset>(`/data-assets/${id}`, req);
}

export async function deleteAsset(id: string): Promise<void> {
  await del<void>(`/data-assets/${id}`);
}

import { createApiClient, apiPath } from '@mate/shared/api';

const client = createApiClient({ baseURL: apiPath('apphub', '') });
const data = <T>(resp: { data: T }): T => resp.data;
async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  return data(await client.get<T>(url, params ? { params } : undefined));
}
async function post<T>(url: string, body?: unknown): Promise<T> {
  return data(await client.post<T>(url, body));
}
async function put<T>(url: string, body?: unknown): Promise<T> {
  return data(await client.put<T>(url, body));
}
async function del<T>(url: string): Promise<T> {
  return data(await client.delete<T>(url));
}


import type { ModuleItem, ModuleCreateRequest, ModuleUpdateRequest, PageResponse } from './types';

interface ModuleRaw {
  id: string; code: string; app_code: string; app_id?: string; name: string;
  type?: ModuleItem['type']; description?: string; created_at?: string; updated_at?: string;
}
const mapModule = (m: ModuleRaw): ModuleItem => ({ moduleId: m.id, code: m.code, appCode: m.app_code,
  appId: m.app_id || '', name: m.name, type: m.type, description: m.description,
  createdAt: m.created_at || '', updatedAt: m.updated_at || '' });

export async function listModules(appId?: string): Promise<PageResponse<ModuleItem>> {
  const result = await get<{ items: ModuleRaw[]; total: number }>('/modules', appId ? { app_code: appId } : undefined);
  return { items: result.items.map(mapModule), total: result.total, page: 1, pageSize: result.items.length, totalPages: 1 };
}

export async function getModule(moduleId: string): Promise<ModuleItem> {
  return mapModule(await get<ModuleRaw>(`/modules/${moduleId}`));
}

export async function createModule(request: ModuleCreateRequest): Promise<ModuleItem> {
  return post<ModuleItem>('/modules', request);
}

export async function updateModule(moduleId: string, request: ModuleUpdateRequest): Promise<ModuleItem> {
  return put<ModuleItem>(`/modules/${moduleId}`, request);
}

export async function deleteModule(moduleId: string): Promise<void> {
  return del<void>(`/modules/${moduleId}`);
}

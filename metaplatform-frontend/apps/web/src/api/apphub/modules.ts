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

export async function listModules(appId?: string): Promise<PageResponse<ModuleItem>> {
  return get<PageResponse<ModuleItem>>('/modules', appId ? { app_code: appId } : undefined);
}

export async function getModule(moduleId: string): Promise<ModuleItem> {
  return get<ModuleItem>(`/modules/${moduleId}`);
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

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


import type { AppItem, AppCreateRequest, AppUpdateRequest, PageResponse } from './types';

export async function listApps(params?: {
  keyword?: string;
  group?: string;
  status?: string;
}): Promise<PageResponse<AppItem>> {
  return get<PageResponse<AppItem>>('/apps', params as Record<string, unknown> | undefined);
}

export async function getApp(appId: string): Promise<AppItem> {
  return get<AppItem>(`/apps/${appId}`);
}

export async function createApp(request: AppCreateRequest): Promise<AppItem> {
  return post<AppItem>('/apps', request);
}

export async function updateApp(appId: string, request: AppUpdateRequest): Promise<AppItem> {
  return put<AppItem>(`/apps/${appId}`, request);
}

export async function deleteApp(appId: string): Promise<void> {
  return del<void>(`/apps/${appId}`);
}

export async function listGroups(): Promise<string[]> {
  return get<string[]>('/apps/groups');
}

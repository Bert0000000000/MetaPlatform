import { createApiClient, apiPath } from '@mate/shared/api';

const client = createApiClient({ baseURL: apiPath('apphub', '/v1') });
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
  return get<PageResponse<AppItem>>('/v1/apphub/apps', params as Record<string, unknown> | undefined);
}

export async function getApp(appId: string): Promise<AppItem> {
  return get<AppItem>(`/v1/apphub/apps/${appId}`);
}

export async function createApp(request: AppCreateRequest): Promise<AppItem> {
  return post<AppItem>('/v1/apphub/apps', request);
}

export async function updateApp(appId: string, request: AppUpdateRequest): Promise<AppItem> {
  return put<AppItem>(`/v1/apphub/apps/${appId}`, request);
}

export async function deleteApp(appId: string): Promise<void> {
  return del<void>(`/v1/apphub/apps/${appId}`);
}

export async function listGroups(): Promise<string[]> {
  return get<string[]>('/v1/apphub/apps/groups');
}

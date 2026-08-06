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

/** Raw shape returned by the backend mate-app-hub /api/v1/apphub/apps endpoint. */
interface ApphubAppRaw {
  id: string;
  name: string;
  code: string;
  description?: string;
  category?: string;
  version?: string;
  owner?: string;
  tags?: string[];
}

/** Map backend snake_case app record to the frontend AppItem shape. */
function mapApp(raw: ApphubAppRaw): AppItem {
  return {
    appId: raw.id,
    name: raw.name,
    code: raw.code,
    description: raw.description,
    group: raw.category,
    status: 'PUBLISHED',
    moduleCount: raw.tags?.length ?? 0,
    createdAt: raw.version ?? '',
    updatedAt: raw.version ?? '',
  };
}

export async function listApps(params?: {
  keyword?: string;
  group?: string;
  status?: string;
}): Promise<PageResponse<AppItem>> {
  const res = await get<{ items: ApphubAppRaw[]; total: number }>('/apps', params as Record<string, unknown> | undefined);
  return {
    items: (res.items ?? []).map(mapApp),
    total: res.total ?? (res.items ?? []).length,
    page: 1,
    pageSize: (res.items ?? []).length || 1,
    totalPages: 1,
  };
}

export async function getApp(appId: string): Promise<AppItem> {
  const raw = await get<ApphubAppRaw>(`/apps/${appId}`);
  return mapApp(raw);
}

export async function createApp(request: AppCreateRequest): Promise<AppItem> {
  const raw = await post<ApphubAppRaw>('/apps', request);
  return mapApp(raw);
}

export async function updateApp(appId: string, request: AppUpdateRequest): Promise<AppItem> {
  const raw = await put<ApphubAppRaw>(`/apps/${appId}`, request);
  return mapApp(raw);
}

export async function deleteApp(appId: string): Promise<void> {
  await del<void>(`/apps/${appId}`);
}

export async function listGroups(): Promise<string[]> {
  const res = await get<{ items: Array<{ name?: string; code?: string }> }>('/apps/groups');
  const items = res?.items ?? [];
  return items.map((g) => g.code ?? g.name ?? '');
}

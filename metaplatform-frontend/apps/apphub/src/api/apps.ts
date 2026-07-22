import { get, post, put, del } from './client';
import type { AppItem, AppCreateRequest, AppUpdateRequest, PageResponse } from '@/types';

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

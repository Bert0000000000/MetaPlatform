import { createApiClient, apiPath } from '@mate/shared/api';

const client = createApiClient({ baseURL: apiPath('ea', '/v1') });
const data = <T>(resp: { data: T }): T => resp.data;
async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> { return data(await client.get<T>(url, params ? { params } : undefined)); }
async function post<T>(url: string, body?: unknown): Promise<T> { return data(await client.post<T>(url, body)); }
async function put<T>(url: string, body?: unknown): Promise<T> { return data(await client.put<T>(url, body)); }
async function del<T>(url: string): Promise<T> { return data(await client.delete<T>(url)); }

import type { ArchApplication, ArchAppCreateRequest, PageResponse } from './types';

export async function listApplications(params?: { keyword?: string }): Promise<PageResponse<ArchApplication>> {
  return get<PageResponse<ArchApplication>>('/v1/ea/applications', params as Record<string, unknown> | undefined);
}

export async function createApplication(req: ArchAppCreateRequest): Promise<ArchApplication> {
  return post<ArchApplication>('/v1/ea/applications', req);
}

export async function updateApplication(id: string, req: ArchAppCreateRequest): Promise<ArchApplication> {
  return put<ArchApplication>(`/v1/ea/applications/${id}`, req);
}

export async function deleteApplication(id: string): Promise<void> {
  await del<void>(`/v1/ea/applications/${id}`);
}

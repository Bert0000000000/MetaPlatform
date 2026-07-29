import { createApiClient, apiPath } from '@mate/shared/api';

const client = createApiClient({ baseURL: apiPath('ea', '/v1') });
const data = <T>(resp: { data: T }): T => resp.data;
async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> { return data(await client.get<T>(url, params ? { params } : undefined)); }
async function post<T>(url: string, body?: unknown): Promise<T> { return data(await client.post<T>(url, body)); }
async function put<T>(url: string, body?: unknown): Promise<T> { return data(await client.put<T>(url, body)); }
async function del<T>(url: string): Promise<T> { return data(await client.delete<T>(url)); }

import type { Capability, CapabilityCreateRequest, PageResponse } from './types';

export async function listCapabilities(params?: { keyword?: string }): Promise<PageResponse<Capability>> {
  return get<PageResponse<Capability>>('/v1/ea/capabilities', params as Record<string, unknown> | undefined);
}

export async function getCapabilityTree(): Promise<Capability[]> {
  return get<Capability[]>('/v1/ea/capabilities/tree');
}

export async function createCapability(req: CapabilityCreateRequest): Promise<Capability> {
  return post<Capability>('/v1/ea/capabilities', req);
}

export async function updateCapability(id: string, req: CapabilityCreateRequest): Promise<Capability> {
  return put<Capability>(`/v1/ea/capabilities/${id}`, req);
}

export async function deleteCapability(id: string): Promise<void> {
  await del<void>(`/v1/ea/capabilities/${id}`);
}

export async function moveCapability(id: string, newParentId?: string): Promise<void> {
  await put<void>(`/v1/ea/capabilities/${id}/move`, { newParentId });
}

import { createApiClient, apiPath } from '@mate/shared/api';

const client = createApiClient({ baseURL: apiPath('arch', '') });
const data = <T>(resp: { data: T }): T => resp.data;
async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> { return data(await client.get<T>(url, params ? { params } : undefined)); }
async function post<T>(url: string, body?: unknown): Promise<T> { return data(await client.post<T>(url, body)); }
async function put<T>(url: string, body?: unknown): Promise<T> { return data(await client.put<T>(url, body)); }
async function del<T>(url: string): Promise<T> { return data(await client.delete<T>(url)); }

import type { Capability, CapabilityCreateRequest, PageResponse } from './types';

export async function listCapabilities(params?: { keyword?: string }): Promise<PageResponse<Capability>> {
  return get<PageResponse<Capability>>('/capabilities', params as Record<string, unknown> | undefined);
}

export async function getCapabilityTree(): Promise<Capability[]> {
  // ARCH returns the tree as a named payload: { tree: Capability[] }.
  // Normalize it here so every page consumes the same canonical shape and
  // never falls back to demo capabilities merely because of the envelope.
  const payload = await get<Capability[] | { tree?: Capability[] }>('/capabilities/tree');
  return Array.isArray(payload) ? payload : (payload.tree ?? []);
}

export async function createCapability(req: CapabilityCreateRequest): Promise<Capability> {
  return post<Capability>('/capabilities', req);
}

export async function updateCapability(id: string, req: CapabilityCreateRequest): Promise<Capability> {
  return put<Capability>(`/capabilities/${id}`, req);
}

export async function deleteCapability(id: string): Promise<void> {
  await del<void>(`/capabilities/${id}`);
}

export async function moveCapability(id: string, newParentId?: string): Promise<void> {
  await put<void>(`/capabilities/${id}/move`, { newParentId });
}

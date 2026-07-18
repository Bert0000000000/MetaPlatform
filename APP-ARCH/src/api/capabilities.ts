import { get, post, put, del } from './client';
import type { Capability, CapabilityCreateRequest, PageResponse } from '@/types';

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

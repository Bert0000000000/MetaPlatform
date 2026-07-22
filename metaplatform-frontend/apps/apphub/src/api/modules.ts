import { get, post, put, del } from './client';
import type { ModuleItem, ModuleCreateRequest, ModuleUpdateRequest, PageResponse } from '@/types';

export async function listModules(appId?: string): Promise<PageResponse<ModuleItem>> {
  return get<PageResponse<ModuleItem>>('/v1/apphub/modules', appId ? { appId } : undefined);
}

export async function getModule(moduleId: string): Promise<ModuleItem> {
  return get<ModuleItem>(`/v1/apphub/modules/${moduleId}`);
}

export async function createModule(request: ModuleCreateRequest): Promise<ModuleItem> {
  return post<ModuleItem>('/v1/apphub/modules', request);
}

export async function updateModule(moduleId: string, request: ModuleUpdateRequest): Promise<ModuleItem> {
  return put<ModuleItem>(`/v1/apphub/modules/${moduleId}`, request);
}

export async function deleteModule(moduleId: string): Promise<void> {
  return del<void>(`/v1/apphub/modules/${moduleId}`);
}

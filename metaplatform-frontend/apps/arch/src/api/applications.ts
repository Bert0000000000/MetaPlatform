import { get, post, put, del } from './client';
import type { ArchApplication, ArchAppCreateRequest, PageResponse } from '@/types';

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

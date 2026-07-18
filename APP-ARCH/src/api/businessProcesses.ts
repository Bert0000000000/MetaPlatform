import { get, post, put, del } from './client';
import type { BusinessProcess, PageResponse } from '@/types';

export async function listProcesses(): Promise<PageResponse<BusinessProcess>> {
  return get<PageResponse<BusinessProcess>>('/v1/ea/processes');
}

export async function createProcess(req: Partial<BusinessProcess>): Promise<BusinessProcess> {
  return post<BusinessProcess>('/v1/ea/processes', req);
}

export async function updateProcess(id: string, req: Partial<BusinessProcess>): Promise<BusinessProcess> {
  return put<BusinessProcess>(`/v1/ea/processes/${id}`, req);
}

export async function deleteProcess(id: string): Promise<void> {
  await del<void>(`/v1/ea/processes/${id}`);
}

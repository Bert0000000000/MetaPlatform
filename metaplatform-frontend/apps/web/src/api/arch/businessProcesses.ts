import { createApiClient, apiPath } from '@mate/shared/api';

const client = createApiClient({ baseURL: apiPath('ea', '/v1') });
const data = <T>(resp: { data: T }): T => resp.data;
async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> { return data(await client.get<T>(url, params ? { params } : undefined)); }
async function post<T>(url: string, body?: unknown): Promise<T> { return data(await client.post<T>(url, body)); }
async function put<T>(url: string, body?: unknown): Promise<T> { return data(await client.put<T>(url, body)); }
async function del<T>(url: string): Promise<T> { return data(await client.delete<T>(url)); }

import type { BusinessProcess, BusinessProcessCreateRequest, BusinessProcessUpdateRequest, LinkProcessRoleRequest } from './types';

export async function listProcesses(): Promise<BusinessProcess[]> {
  return get<BusinessProcess[]>('/v1/ea/business-processes');
}

export async function createProcess(req: BusinessProcessCreateRequest): Promise<BusinessProcess> {
  return post<BusinessProcess>('/v1/ea/business-processes', req);
}

export async function updateProcess(id: string, req: BusinessProcessUpdateRequest): Promise<BusinessProcess> {
  return put<BusinessProcess>(`/v1/ea/business-processes/${id}`, req);
}

export async function deleteProcess(id: string): Promise<void> {
  await del<void>(`/v1/ea/business-processes/${id}`);
}

export async function linkProcessRoles(id: string, req: LinkProcessRoleRequest): Promise<void> {
  await post<void>(`/v1/ea/business-processes/${id}/roles`, req);
}

export async function getProcessRoleIds(id: string): Promise<string[]> {
  return get<string[]>(`/v1/ea/business-processes/${id}/roles`);
}

export async function listProcessVersions(id: string): Promise<unknown[]> {
  return get<unknown[]>(`/v1/ea/business-processes/${id}/versions`);
}

export async function getProcessFlowchart(id: string): Promise<Record<string, unknown>> {
  return get<Record<string, unknown>>(`/v1/ea/business-processes/${id}/flowchart`);
}

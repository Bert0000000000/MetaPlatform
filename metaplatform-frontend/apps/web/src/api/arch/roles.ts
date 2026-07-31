import { createApiClient, apiPath } from '@mate/shared/api';

const client = createApiClient({ baseURL: apiPath('arch', '') });
const data = <T>(resp: { data: T }): T => resp.data;
async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> { return data(await client.get<T>(url, params ? { params } : undefined)); }
async function post<T>(url: string, body?: unknown): Promise<T> { return data(await client.post<T>(url, body)); }
async function put<T>(url: string, body?: unknown): Promise<T> { return data(await client.put<T>(url, body)); }
async function del<T>(url: string): Promise<T> { return data(await client.delete<T>(url)); }

import type { OrgUnit, ArchRole, CreateRoleRequest, UpdateRoleRequest, PageResponse } from './types';

export async function getOrgTree(): Promise<OrgUnit[]> {
  return get<OrgUnit[]>('/orgs/tree');
}

export async function createOrgUnit(req: Partial<OrgUnit>): Promise<OrgUnit> {
  return post<OrgUnit>('/orgs', req);
}

export async function updateOrgUnit(id: string, req: Partial<OrgUnit>): Promise<OrgUnit> {
  return put<OrgUnit>(`/orgs/${id}`, req);
}

export async function deleteOrgUnit(id: string): Promise<void> {
  await del<void>(`/orgs/${id}`);
}

export async function listRoles(params?: { orgUnitId?: string; domain?: string; keyword?: string; page?: number; size?: number }): Promise<PageResponse<ArchRole>> {
  return get<PageResponse<ArchRole>>('/roles', params as Record<string, unknown> | undefined);
}

export async function createRole(req: CreateRoleRequest): Promise<ArchRole> {
  return post<ArchRole>('/roles', req);
}

export async function updateRole(id: string, req: UpdateRoleRequest): Promise<ArchRole> {
  return put<ArchRole>(`/roles/${id}`, req);
}

export async function deleteRole(id: string): Promise<void> {
  await del<void>(`/roles/${id}`);
}

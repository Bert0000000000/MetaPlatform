import { get, post, put, del } from './client';
import type { OrgUnit, ArchRole, CreateRoleRequest, UpdateRoleRequest, PageResponse } from '@/types';

export async function getOrgTree(): Promise<OrgUnit[]> {
  return get<OrgUnit[]>('/v1/ea/orgs/tree');
}

export async function createOrgUnit(req: Partial<OrgUnit>): Promise<OrgUnit> {
  return post<OrgUnit>('/v1/ea/orgs', req);
}

export async function updateOrgUnit(id: string, req: Partial<OrgUnit>): Promise<OrgUnit> {
  return put<OrgUnit>(`/v1/ea/orgs/${id}`, req);
}

export async function deleteOrgUnit(id: string): Promise<void> {
  await del<void>(`/v1/ea/orgs/${id}`);
}

export async function listRoles(params?: { orgUnitId?: string; domain?: string; keyword?: string; page?: number; size?: number }): Promise<PageResponse<ArchRole>> {
  return get<PageResponse<ArchRole>>('/v1/ea/roles', params as Record<string, unknown> | undefined);
}

export async function createRole(req: CreateRoleRequest): Promise<ArchRole> {
  return post<ArchRole>('/v1/ea/roles', req);
}

export async function updateRole(id: string, req: UpdateRoleRequest): Promise<ArchRole> {
  return put<ArchRole>(`/v1/ea/roles/${id}`, req);
}

export async function deleteRole(id: string): Promise<void> {
  await del<void>(`/v1/ea/roles/${id}`);
}

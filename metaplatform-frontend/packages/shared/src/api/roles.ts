/**
 * IAM 角色管理 API
 * 后端：com.metaplatform.iam.controller.RoleController
 * 路径：/api/v1/iam/roles
 */

import { apiClient } from './client';
import { apiPath } from '../config/apiConfig';
import type { PageResponse } from './types';

export type RoleType = 'SYSTEM' | 'CUSTOM' | 'BUILTIN' | 'EXTERNAL';
export type DataScope = 'SELF' | 'DEPARTMENT' | 'DEPARTMENT_TREE' | 'ALL' | 'CUSTOM';

export interface RoleResponse {
  roleId: string;
  roleCode: string;
  roleName: string;
  roleType: RoleType;
  description?: string;
  dataScope?: DataScope;
  enabled: boolean;
  version?: number;
  permissionCount?: number;
  memberCount?: number;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface CreateRoleRequest {
  roleCode: string;
  roleName: string;
  roleType?: RoleType;
  description?: string;
  dataScope?: DataScope;
  enabled?: boolean;
}

export interface UpdateRoleRequest {
  roleName?: string;
  description?: string;
  dataScope?: DataScope;
  enabled?: boolean;
  version?: number;
}

export interface AssignPermissionsRequest {
  permissionIds: string[];
}

export interface ListRoleParams {
  tenantId?: string;
  keyword?: string;
  page?: number;
  size?: number;
}

export async function listRoles(params: ListRoleParams = {}): Promise<PageResponse<RoleResponse>> {
  const url = apiPath('iam', '/roles');
  const resp = await apiClient.get<PageResponse<RoleResponse>>(url, { params });
  return resp.data;
}

export async function getRole(roleId: string): Promise<RoleResponse> {
  const url = apiPath('iam', '/roles/' + roleId);
  const resp = await apiClient.get<RoleResponse>(url);
  return resp.data;
}

export async function createRole(payload: CreateRoleRequest): Promise<RoleResponse> {
  const url = apiPath('iam', '/roles');
  const resp = await apiClient.post<RoleResponse>(url, payload);
  return resp.data;
}

export async function updateRole(roleId: string, payload: UpdateRoleRequest): Promise<RoleResponse> {
  const url = apiPath('iam', '/roles/' + roleId);
  const resp = await apiClient.put<RoleResponse>(url, payload);
  return resp.data;
}

export async function deleteRole(roleId: string): Promise<void> {
  const url = apiPath('iam', '/roles/' + roleId);
  await apiClient.delete(url);
}

export async function assignRolePermissions(roleId: string, permissionIds: string[]): Promise<void> {
  const url = apiPath('iam', '/roles/' + roleId + '/permissions');
  await apiClient.put(url, { permissionIds });
}

/**
 * IAM 角色管理 API
 * 后端：com.metaplatform.iam.controller.RoleController
 * 路径：/api/v1/iam/roles
 */

import { apiClient } from './client';
import { apiPath } from '../config/apiConfig';
import type { PageResponse } from './types';

// Mate Platform IAM admin uses additional role codes:
// PLATFORM_SUPER_ADMIN, PLATFORM_ADMIN, PLATFORM_ADMIN_VIEWER.
export type RoleType = 'SYSTEM' | 'CUSTOM' | 'BUILTIN' | 'EXTERNAL' | 'PLATFORM_SUPER_ADMIN' | 'PLATFORM_ADMIN' | 'PLATFORM_ADMIN_VIEWER' | string;
export type DataScope = 'SELF' | 'DEPARTMENT' | 'DEPARTMENT_TREE' | 'ALL' | 'CUSTOM';

// Mate Platform IAM admin returns: id:number, code, name, is_builtin, role_type
// (e.g. PLATFORM_ADMIN), data_scope, user_count, permission_count. After
// normalizer, both snake_case and camelCase aliases are available.
export interface RoleResponse {
  id: number;
  roleId?: number;
  code: string;
  roleCode?: string;
  name: string;
  roleName?: string;
  roleType: RoleType;
  description?: string | null;
  dataScope?: DataScope;
  data_scope?: DataScope;
  isBuiltin?: boolean;
  is_builtin?: boolean;
  isSystem?: boolean;
  is_system?: boolean;
  isEnabled?: boolean;
  enabled?: boolean;
  userCount?: number;
  user_count?: number;
  permissionCount?: number;
  permission_count?: number;
  version?: number;
  enabled: boolean;
  version?: number;
  permissionCount?: number;
  memberCount?: number;
  /** 角色策略 JSON 字符串（菜单权限/API 权限/数据范围/脱敏规则） */
  policy?: string;
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
  /** 角色策略 JSON 字符串 */
  policy?: string;
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

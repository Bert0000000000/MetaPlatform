/**
 * IAM 权限管理 API
 * 后端：com.metaplatform.iam.controller.PermissionController
 * 路径：/api/v1/iam/permissions
 */

import { apiClient } from './client';
import { apiPath } from '../config/apiConfig';
import type { PageResponse } from './types';

export type PermissionEffect = 'ALLOW' | 'DENY';

// Mate Platform IAM admin catalog returns: id:number, code, name,
// resource_type, actions[], description (effect is on the role-binding,
// not on the catalog row). After normalizer, both naming styles exist.
export interface PermissionResponse {
  id: number;
  permissionId?: number;
  code: string;
  permissionCode?: string;
  name: string;
  permissionName?: string;
  resourceType: string;
  resource_type?: string;
  resourceId?: string | null;
  resource_id?: string | null;
  actions: string[];
  effect?: PermissionEffect;
  description?: string | null;
  version?: number;
  roleCount?: number;
  role_count?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreatePermissionRequest {
  permissionCode: string;
  permissionName: string;
  resourceType: string;
  resourceId?: string;
  actions: string[];
  effect?: PermissionEffect;
  description?: string;
}

export interface UpdatePermissionRequest {
  permissionName?: string;
  actions?: string[];
  effect?: PermissionEffect;
  description?: string;
}

export interface ListPermissionParams {
  tenantId?: string;
  resourceType?: string;
  keyword?: string;
  page?: number;
  size?: number;
}

export async function listPermissions(params: ListPermissionParams = {}): Promise<PageResponse<PermissionResponse>> {
  // The /api/v1/admin/permissions/catalog handler returns a flat JSON array
  // under data. Normalise that into the PageResponse shape so callers
  // (AdminOperationsPage etc.) can read .items / .total directly.
  const url = apiPath('iam', '/permissions/catalog');
  const resp = await apiClient.get<PermissionResponse[] | PageResponse<PermissionResponse>>(url, { params });
  const data = resp.data;
  if (Array.isArray(data)) {
    return {
      items: data as PermissionResponse[],
      total: data.length,
      page: Number(params.page ?? 1),
      pageSize: data.length,
    };
  }
  return data as PageResponse<PermissionResponse>;
}

export async function getPermission(permissionId: string): Promise<PermissionResponse> {
  const url = apiPath('iam', '/permissions/' + permissionId);
  const resp = await apiClient.get<PermissionResponse>(url);
  return resp.data;
}

export async function createPermission(payload: CreatePermissionRequest): Promise<PermissionResponse> {
  // Backend expects snake_case: code, name, resource_type, resource_id?, actions[], effect?, description?
  const url = apiPath('iam', '/permissions');
  const resp = await apiClient.post<PermissionResponse>(url, {
    code: payload.permissionCode,
    name: payload.permissionName,
    resource_type: payload.resourceType,
    resource_id: payload.resourceId,
    actions: payload.actions,
    effect: payload.effect,
    description: payload.description,
  });
  return resp.data;
}

export async function updatePermission(permissionId: string, payload: UpdatePermissionRequest): Promise<PermissionResponse> {
  const url = apiPath('iam', '/permissions/' + permissionId);
  // Backend expects snake_case; map optional fields.
  const body: Record<string, unknown> = {};
  if (payload.permissionName !== undefined) body.name = payload.permissionName;
  if (payload.actions !== undefined) body.actions = payload.actions;
  if (payload.effect !== undefined) body.effect = payload.effect;
  if (payload.description !== undefined) body.description = payload.description;
  const resp = await apiClient.put<PermissionResponse>(url, body);
  return resp.data;
}

export async function deletePermission(permissionId: string): Promise<void> {
  const url = apiPath('iam', '/permissions/' + permissionId);
  await apiClient.delete(url);
}

import { apiClient } from "../client";
import { ADMIN_BASE, unwrap } from "./base";
import type {
  AdminRole,
  AdminRoleDetail,
  AdminPermission,
  PermissionMatrixResponse,
  ApiEnvelope,
  PageResult,
} from "@/types";

export interface ListRolesParams {
  keyword?: string;
  page?: number;
  pageSize?: number;
}

export interface CreateRolePayload {
  code: string;
  name: string;
  description?: string;
  dataScope?: string;
  permissionIds?: number[];
}

export interface UpdateRolePayload {
  name?: string;
  description?: string;
  dataScope?: string;
  permissionIds?: number[];
}

export async function listRoles(p?: ListRolesParams): Promise<PageResult<AdminRole>> {
  const params: Record<string, unknown> = {};
  if (p?.keyword) params.keyword = p.keyword;
  if (p?.page) params.page = p.page;
  if (p?.pageSize) params.pageSize = p.pageSize;
  const { data } = await apiClient.get(ADMIN_BASE + "/permissions/roles", { params });
  return unwrap<PageResult<AdminRole>>(data as ApiEnvelope<PageResult<AdminRole>>);
}

export async function getRoleDetail(id: number): Promise<AdminRoleDetail> {
  const { data } = await apiClient.get(ADMIN_BASE + "/permissions/roles/" + id);
  return unwrap<AdminRoleDetail>(data as ApiEnvelope<AdminRoleDetail>);
}

export async function createRole(payload: CreateRolePayload): Promise<AdminRole> {
  const { data } = await apiClient.post(ADMIN_BASE + "/permissions/roles", payload);
  return unwrap<AdminRole>(data as ApiEnvelope<AdminRole>);
}

export async function updateRole(id: number, payload: UpdateRolePayload): Promise<AdminRole> {
  const { data } = await apiClient.put(ADMIN_BASE + "/permissions/roles/" + id, payload);
  return unwrap<AdminRole>(data as ApiEnvelope<AdminRole>);
}

export async function deleteRole(id: number): Promise<{ deleted: number }> {
  const { data } = await apiClient.delete(ADMIN_BASE + "/permissions/roles/" + id);
  return unwrap<{ deleted: number }>(data as ApiEnvelope<{ deleted: number }>);
}

export async function listPermissionCatalog(resourceType?: string): Promise<AdminPermission[]> {
  const params = resourceType ? { resourceType } : undefined;
  const { data } = await apiClient.get(ADMIN_BASE + "/permissions/catalog", { params });
  return unwrap<AdminPermission[]>(data as ApiEnvelope<AdminPermission[]>);
}

export async function getPermissionMatrix(): Promise<PermissionMatrixResponse> {
  const { data } = await apiClient.get(ADMIN_BASE + "/permissions/matrix");
  return unwrap<PermissionMatrixResponse>(data as ApiEnvelope<PermissionMatrixResponse>);
}

export interface AssignPayload {
  type: "user" | "role";
  targetId: number;
  permissionIds?: number[];
  roleIds?: number[];
}

export async function assignPermissions(payload: AssignPayload): Promise<{ type: string; targetId: number }> {
  const { data } = await apiClient.post(ADMIN_BASE + "/permissions/assign", {
    type: payload.type,
    target_id: payload.targetId,
    permission_ids: payload.permissionIds ?? [],
    role_ids: payload.roleIds,
  });
  return unwrap<{ type: string; targetId: number }>(data as ApiEnvelope<{ type: string; targetId: number }>);
}

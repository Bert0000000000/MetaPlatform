import { apiClient } from "../client";
import { ADMIN_BASE, unwrap } from "./base";
import type {
  AdminOrg,
  AdminOrgTreeNode,
  AdminPosition,
  ApiEnvelope,
  OrgType,
  PageResult,
} from "@/types";

export async function getOrgTree(): Promise<AdminOrgTreeNode[]> {
  const { data } = await apiClient.get(ADMIN_BASE + "/orgs/tree");
  return unwrap<AdminOrgTreeNode[]>(data as ApiEnvelope<AdminOrgTreeNode[]>);
}

export interface ListOrgsParams {
  keyword?: string;
  parentId?: number;
  page?: number;
  pageSize?: number;
}

export async function listOrgs(p?: ListOrgsParams): Promise<PageResult<AdminOrg>> {
  const params: Record<string, unknown> = {};
  if (p?.keyword) params.keyword = p.keyword;
  if (p?.parentId !== undefined) params.parentId = p.parentId;
  if (p?.page) params.page = p.page;
  if (p?.pageSize) params.pageSize = p.pageSize;
  const { data } = await apiClient.get(ADMIN_BASE + "/orgs", { params });
  return unwrap<PageResult<AdminOrg>>(data as ApiEnvelope<PageResult<AdminOrg>>);
}

export interface CreateOrgPayload {
  parentId?: number | null;
  code: string;
  name: string;
  type?: OrgType;
  leaderId?: number;
  sortOrder?: number;
  description?: string;
}

export async function createOrg(payload: CreateOrgPayload): Promise<{ id: number; code: string; name: string }> {
  // Mate Platform 后端 OrgCreate/OrgUpdate 是 snake_case (parent_id / leader_id / sort_order)
  // 前端 CreateOrgPayload 是 camelCase，这里做一次显式映射
  const { data } = await apiClient.post(ADMIN_BASE + "/orgs", {
    parent_id: payload.parentId ?? null,
    code: payload.code,
    name: payload.name,
    type: payload.type,
    leader_id: payload.leaderId ?? null,
    sort_order: payload.sortOrder,
    description: payload.description,
  });
  return unwrap<{ id: number; code: string; name: string }>(data as ApiEnvelope<{ id: number; code: string; name: string }>);
}

export interface UpdateOrgPayload {
  parentId?: number | null;
  name?: string;
  type?: OrgType;
  leaderId?: number;
  sortOrder?: number;
  description?: string;
}

export async function updateOrg(id: number, payload: UpdateOrgPayload): Promise<{ id: number; name: string }> {
  // 后端 OrgUpdate 同样是 snake_case，这里做一次显式映射
  const body: Record<string, unknown> = {};
  if (payload.parentId !== undefined) body.parent_id = payload.parentId;
  if (payload.name !== undefined) body.name = payload.name;
  if (payload.type !== undefined) body.type = payload.type;
  if (payload.leaderId !== undefined) body.leader_id = payload.leaderId;
  if (payload.sortOrder !== undefined) body.sort_order = payload.sortOrder;
  if (payload.description !== undefined) body.description = payload.description;
  const { data } = await apiClient.put(ADMIN_BASE + "/orgs/" + id, body);
  return unwrap<{ id: number; name: string }>(data as ApiEnvelope<{ id: number; name: string }>);
}

export async function deleteOrg(id: number): Promise<{ deleted: number }> {
  const { data } = await apiClient.delete(ADMIN_BASE + "/orgs/" + id);
  return unwrap<{ deleted: number }>(data as ApiEnvelope<{ deleted: number }>);
}

export interface ListPositionsParams {
  orgId?: number;
  keyword?: string;
  page?: number;
  pageSize?: number;
}

export async function listPositions(p?: ListPositionsParams): Promise<PageResult<AdminPosition>> {
  const params: Record<string, unknown> = {};
  // 后端 /orgs/positions 查询参数 orgId 实际期望 snake_case org_id
  if (p?.orgId) params.org_id = p.orgId;
  if (p?.keyword) params.keyword = p.keyword;
  if (p?.page) params.page = p.page;
  if (p?.pageSize) params.pageSize = p.pageSize;
  const { data } = await apiClient.get(ADMIN_BASE + "/orgs/positions", { params });
  return unwrap<PageResult<AdminPosition>>(data as ApiEnvelope<PageResult<AdminPosition>>);
}

export interface CreatePositionPayload {
  orgId: number;
  code: string;
  name: string;
  level?: string;
  description?: string;
}

export async function createPosition(payload: CreatePositionPayload): Promise<{ id: number; name: string }> {
  // Mate Platform 后端 PositionCreate 要求 snake_case，前端 CreatePositionPayload 是 camelCase；
  // 这里把字段做一次显式映射，否则接口返回 422
  const { data } = await apiClient.post(ADMIN_BASE + "/orgs/positions", {
    org_id: payload.orgId,
    code: payload.code,
    name: payload.name,
    level: payload.level,
    description: payload.description,
  });
  return unwrap<{ id: number; name: string }>(data as ApiEnvelope<{ id: number; name: string }>);
}

export interface UpdatePositionPayload {
  name?: string;
  level?: string;
  description?: string;
}

export async function updatePosition(id: number, payload: UpdatePositionPayload): Promise<{ id: number; name: string }> {
  const { data } = await apiClient.put(ADMIN_BASE + "/orgs/positions/" + id, payload);
  return unwrap<{ id: number; name: string }>(data as ApiEnvelope<{ id: number; name: string }>);
}

export async function deletePosition(id: number): Promise<{ deleted: number }> {
  const { data } = await apiClient.delete(ADMIN_BASE + "/orgs/positions/" + id);
  return unwrap<{ deleted: number }>(data as ApiEnvelope<{ deleted: number }>);
}

export interface TransferPayload {
  userId: number;
  targetOrgId: number;
  targetPositionId?: number;
  reportsTo?: number;
  reason?: string;
}

export async function transferEmployee(payload: TransferPayload): Promise<{ userId: number; targetOrgId: number; positionId: number }> {
  // Mate Platform 后端 orgs/transfer 接口要求 snake_case，与前端 TransferPayload 的 camelCase 不一致，
  // 直接 POST 会 422。这里把字段名做一次映射。
  const { data } = await apiClient.post(ADMIN_BASE + "/orgs/transfer", {
    user_id: payload.userId,
    target_org_id: payload.targetOrgId,
    target_position_id: payload.targetPositionId,
    reports_to: payload.reportsTo,
    reason: payload.reason,
  });
  return unwrap<{ userId: number; targetOrgId: number; positionId: number }>(
    data as ApiEnvelope<{ userId: number; targetOrgId: number; positionId: number }>,
  );
}

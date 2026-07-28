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
  const { data } = await apiClient.post(ADMIN_BASE + "/orgs", payload);
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
  const { data } = await apiClient.put(ADMIN_BASE + "/orgs/" + id, payload);
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
  if (p?.orgId) params.orgId = p.orgId;
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
  const { data } = await apiClient.post(ADMIN_BASE + "/orgs/positions", payload);
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
  const { data } = await apiClient.post(ADMIN_BASE + "/orgs/transfer", payload);
  return unwrap<{ userId: number; targetOrgId: number; positionId: number }>(
    data as ApiEnvelope<{ userId: number; targetOrgId: number; positionId: number }>,
  );
}

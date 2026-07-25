/**
 * IAM 部门管理 API
 * 后端：com.metaplatform.iam.controller.DepartmentController
 *       com.metaplatform.iam.controller.UserDepartmentController
 * 路径：/api/v1/iam/departments, /api/v1/iam/users/{userId}/departments
 */

import { apiClient } from './client';
import { apiPath } from '../config/apiConfig';
import type { PageResponse } from './types';

export interface DepartmentLeader {
  userId: string;
  realName?: string;
  username?: string;
  avatarUrl?: string;
}

export interface DepartmentResponse {
  deptId: string;
  deptCode: string;
  deptName: string;
  parentId?: string | null;
  parentName?: string | null;
  parentPath?: string | null;
  fullPath: string;
  level: number;
  sortOrder: number;
  leader?: DepartmentLeader | null;
  memberCount?: number;
  childCount?: number;
  description?: string;
  version?: number;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
  children?: DepartmentResponse[];
}

export interface CreateDepartmentRequest {
  deptCode: string;
  deptName: string;
  parentId?: string;
  sortOrder?: number;
  leaderId?: string;
  description?: string;
}

export interface UpdateDepartmentRequest {
  deptName?: string;
  parentId?: string;
  sortOrder?: number;
  leaderId?: string;
  description?: string;
}

export interface ListDepartmentParams {
  tenantId?: string;
  parentId?: string;
  keyword?: string;
  page?: number;
  size?: number;
}

export async function listDepartments(params: ListDepartmentParams = {}): Promise<PageResponse<DepartmentResponse>> {
  const url = apiPath('iam', '/departments');
  const resp = await apiClient.get<PageResponse<DepartmentResponse>>(url, { params });
  return resp.data;
}

export async function getDepartmentTree(tenantId?: string, rootId?: string): Promise<DepartmentResponse[]> {
  const url = apiPath('iam', '/departments/tree');
  const resp = await apiClient.get<DepartmentResponse[]>(url, { params: { tenantId, rootId } });
  return resp.data;
}

export async function getDepartment(deptId: string): Promise<DepartmentResponse> {
  const url = apiPath('iam', '/departments/' + deptId);
  const resp = await apiClient.get<DepartmentResponse>(url);
  return resp.data;
}

export async function createDepartment(payload: CreateDepartmentRequest): Promise<DepartmentResponse> {
  const url = apiPath('iam', '/departments');
  const resp = await apiClient.post<DepartmentResponse>(url, payload);
  return resp.data;
}

export async function updateDepartment(deptId: string, payload: UpdateDepartmentRequest): Promise<DepartmentResponse> {
  const url = apiPath('iam', '/departments/' + deptId);
  const resp = await apiClient.put<DepartmentResponse>(url, payload);
  return resp.data;
}

export async function deleteDepartment(deptId: string): Promise<void> {
  const url = apiPath('iam', '/departments/' + deptId);
  await apiClient.delete(url);
}

export async function getUserDepartments(userId: string): Promise<DepartmentResponse[]> {
  const url = apiPath('iam', '/users/' + userId + '/departments');
  const resp = await apiClient.get<DepartmentResponse[]>(url);
  return resp.data;
}

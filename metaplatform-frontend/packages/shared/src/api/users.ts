/**
 * IAM 用户管理 API
 * 对应后端：com.metaplatform.iam.controller.UserController
 *         路径前缀：/api/v1/iam/users
 */

import { apiClient } from './client';
import { apiPath } from '../config/apiConfig';
import type { PageResponse } from './types';

// === DTO 类型对齐 ===

export type UserStatus = 'ENABLED' | 'DISABLED' | 'LOCKED' | 'PENDING';

export interface UserResponse {
  id: string;
  tenantId: string;
  username: string;
  email: string;
  realName?: string;
  phone?: string;
  avatarUrl?: string;
  status: UserStatus;
  requirePasswordReset?: boolean;
  lastLoginAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateUserRequest {
  username: string;
  password: string;
  email: string;
  realName?: string;
  phone?: string;
  status?: UserStatus;
}

export interface UpdateUserRequest {
  email?: string;
  realName?: string;
  phone?: string;
  avatarUrl?: string;
  status?: UserStatus;
  requirePasswordReset?: boolean;
}

export interface UserStatusUpdateRequest {
  status: UserStatus;
}

export interface ListUserParams {
  tenantId?: string;
  keyword?: string;
  status?: UserStatus;
  departmentId?: string;
  page?: number;
  size?: number;
}

// === API 方法 ===

export async function listUsers(params: ListUserParams = {}): Promise<PageResponse<UserResponse>> {
  const url = apiPath('iam', '/users');
  const resp = await apiClient.get<PageResponse<UserResponse>>(url, { params });
  return resp.data;
}

export async function getUser(userId: string): Promise<UserResponse> {
  const url = apiPath('iam', '/users/' + userId);
  const resp = await apiClient.get<UserResponse>(url);
  return resp.data;
}

export async function createUser(payload: CreateUserRequest): Promise<UserResponse> {
  const url = apiPath('iam', '/users');
  const resp = await apiClient.post<UserResponse>(url, payload);
  return resp.data;
}

export async function updateUser(userId: string, payload: UpdateUserRequest): Promise<UserResponse> {
  const url = apiPath('iam', '/users/' + userId);
  const resp = await apiClient.put<UserResponse>(url, payload);
  return resp.data;
}

export async function deleteUser(userId: string): Promise<void> {
  const url = apiPath('iam', '/users/' + userId);
  await apiClient.delete(url);
}

export async function updateUserStatus(userId: string, status: UserStatus): Promise<UserResponse> {
  const url = apiPath('iam', '/users/' + userId + '/status');
  const resp = await apiClient.patch<UserResponse>(url, { status });
  return resp.data;
}

export async function resetUserPassword(userId: string, newPassword: string): Promise<void> {
  const url = apiPath('iam', '/users/' + userId + '/password/reset');
  await apiClient.post(url, { newPassword });
}

export async function changePassword(oldPassword: string, newPassword: string): Promise<void> {
  const url = apiPath('iam', '/users/me/password');
  await apiClient.post(url, { oldPassword, newPassword });
}

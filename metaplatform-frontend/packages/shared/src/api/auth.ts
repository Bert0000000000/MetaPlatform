/**
 * IAM 认证 API
 * 对应后端：com.metaplatform.iam.controller.AuthController
 *         路径前缀：/api/v1/iam/auth
 */

import { apiClient } from './client';
import { apiPath } from '../config/apiConfig';

// === 后端 DTO 类型对齐 ===

export interface LoginRequest {
  username: string;
  password: string;
  tenantId?: string;
}

export interface AuthUserInfo {
  id: string;
  username: string;
  email?: string;
  realName?: string;
  status?: string;
}

export interface AuthResponse {
  loginResult?: string;
  userId?: string;
  username?: string;
  realName?: string;
  accessToken: string;
  refreshToken?: string;
  tokenType?: string;
  expiresIn?: number;
  refreshExpiresIn?: number;
  requirePasswordReset?: boolean;
  mfaRequired?: boolean;
  loginAt?: string;
  loginIp?: string;
  user?: AuthUserInfo;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

// === API 方法 ===

export async function login(payload: LoginRequest): Promise<AuthResponse> {
  const url = apiPath('iam', '/auth/login');
  const resp = await apiClient.post<AuthResponse>(url, payload);
  return resp.data;
}

export async function logout(): Promise<void> {
  const url = apiPath('iam', '/auth/logout');
  await apiClient.post(url);
}

export async function refresh(refreshToken: string): Promise<AuthResponse> {
  const url = apiPath('iam', '/auth/refresh');
  const resp = await apiClient.post<AuthResponse>(url, { refreshToken });
  return resp.data;
}

export async function register(payload: {
  username: string;
  password: string;
  email: string;
  realName?: string;
  phone?: string;
  tenantId?: string;
}): Promise<AuthResponse> {
  const url = apiPath('iam', '/auth/register');
  const resp = await apiClient.post<AuthResponse>(url, payload);
  return resp.data;
}

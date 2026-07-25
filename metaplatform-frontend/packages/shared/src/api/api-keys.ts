/**
 * IAM API Key 管理
 * 后端：com.metaplatform.iam.controller.ApiKeyController
 * 路径：/api/v1/iam/api-keys
 */

import { apiClient } from './client';
import { apiPath } from '../config/apiConfig';
import type { PageResponse } from './types';

export interface ApiKeyResponse {
  apiKeyId: string;
  name: string;
  prefix?: string;
  scopes?: string[];
  status: 'ACTIVE' | 'DISABLED' | 'REVOKED';
  expiresAt?: string;
  lastUsedAt?: string;
  createdAt: string;
  createdBy?: string;
}

export interface CreateApiKeyRequest {
  name: string;
  scopes?: string[];
  expiresAt?: string;
}

export interface ListApiKeyParams {
  tenantId?: string;
  status?: 'ACTIVE' | 'DISABLED' | 'REVOKED';
  page?: number;
  size?: number;
}

export async function listApiKeys(params: ListApiKeyParams = {}): Promise<PageResponse<ApiKeyResponse>> {
  const url = apiPath('iam', '/api-keys');
  const resp = await apiClient.get<PageResponse<ApiKeyResponse>>(url, { params });
  return resp.data;
}

export async function createApiKey(payload: CreateApiKeyRequest): Promise<ApiKeyResponse> {
  const url = apiPath('iam', '/api-keys');
  const resp = await apiClient.post<ApiKeyResponse>(url, payload);
  return resp.data;
}

export async function revokeApiKey(apiKeyId: string): Promise<void> {
  const url = apiPath('iam', '/api-keys/' + apiKeyId + '/revoke');
  await apiClient.post(url);
}

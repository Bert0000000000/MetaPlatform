/**
 * IAM SSO 提供方管理
 * 后端：com.metaplatform.iam.sso.controller.SsoController
 * 路径：/api/v1/iam/sso-providers
 */

import { apiClient } from './client';
import { apiPath } from '../config/apiConfig';
import type { PageResponse } from './types';

export interface SsoProvider {
  providerId: string;
  name: string;
  type: 'OIDC' | 'SAML' | 'LDAP' | 'OAUTH2';
  clientId: string;
  issuer?: string;
  enabled: boolean;
  autoProvision?: boolean;
  defaultRole?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ListSsoProviderParams {
  tenantId?: string;
  keyword?: string;
  page?: number;
  size?: number;
}

export async function listSsoProviders(params: ListSsoProviderParams = {}): Promise<PageResponse<SsoProvider>> {
  const url = apiPath('iam', '/sso-providers');
  const resp = await apiClient.get<PageResponse<SsoProvider>>(url, { params });
  return resp.data;
}

export async function createSsoProvider(payload: Partial<SsoProvider> & { clientSecret: string }): Promise<SsoProvider> {
  const url = apiPath('iam', '/sso-providers');
  const resp = await apiClient.post<SsoProvider>(url, payload);
  return resp.data;
}

export async function updateSsoProvider(providerId: string, payload: Partial<SsoProvider>): Promise<SsoProvider> {
  const url = apiPath('iam', '/sso-providers/' + providerId);
  const resp = await apiClient.put<SsoProvider>(url, payload);
  return resp.data;
}

export async function deleteSsoProvider(providerId: string): Promise<void> {
  const url = apiPath('iam', '/sso-providers/' + providerId);
  await apiClient.delete(url);
}

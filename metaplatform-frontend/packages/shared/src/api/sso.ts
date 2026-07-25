/**
 * IAM SSO 提供方管理
 * 后端：com.metaplatform.iam.controller.SsoProviderController
 *       com.metaplatform.iam.entity.sso.SsoProviderEntity
 * 路径：/api/v1/iam/sso-providers
 *
 * 字段映射：
 *   请求：type     -> providerType
 *         issuer   -> issuerUrl
 *   响应：providerType -> type
 *         issuerUrl    -> issuer
 */

import { apiClient } from './client';
import { apiPath } from '../config/apiConfig';
import type { PageResponse } from './types';

export interface SsoProvider {
  providerId: string;
  name: string;
  type: 'OIDC' | 'SAML' | 'LDAP' | 'OAUTH2' | 'CUSTOM';
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

function fromApi(r: any): SsoProvider {
  return {
    providerId: r.id ?? r.providerId,
    name: r.name,
    type: r.providerType ?? r.type,
    clientId: r.clientId,
    issuer: r.issuerUrl ?? r.issuer,
    enabled: r.enabled,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export async function listSsoProviders(params: ListSsoProviderParams = {}): Promise<PageResponse<SsoProvider>> {
  const url = apiPath("iam", "/sso-providers");
  const resp = await apiClient.get<PageResponse<any>>(url, { params });
  return { ...resp.data, items: resp.data.items.map(fromApi) };
}

export async function createSsoProvider(payload: Partial<SsoProvider> & { clientSecret: string }): Promise<SsoProvider> {
  const url = apiPath("iam", "/sso-providers");
  const body: Record<string, unknown> = { ...payload };
  if (body.type && !body.providerType) { body.providerType = body.type; delete body.type; }
  if (body.issuer && !body.issuerUrl) { body.issuerUrl = body.issuer; delete body.issuer; }
  const resp = await apiClient.post<any>(url, body);
  return fromApi(resp.data);
}

export async function updateSsoProvider(providerId: string, payload: Partial<SsoProvider>): Promise<SsoProvider> {
  const url = apiPath('iam', '/sso-providers/' + providerId);
  const body: Record<string, unknown> = { ...payload };
  if (body.type && !body.providerType) { body.providerType = body.type; delete body.type; }
  if (body.issuer && !body.issuerUrl) { body.issuerUrl = body.issuer; delete body.issuer; }
  const resp = await apiClient.put<any>(url, body);
  return fromApi(resp.data);
}

export async function deleteSsoProvider(providerId: string): Promise<void> {
  const url = apiPath('iam', '/sso-providers/' + providerId);
  await apiClient.delete(url);
}
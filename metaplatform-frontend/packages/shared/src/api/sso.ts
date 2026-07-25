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
  /** OAuth/OIDC 授权端点（企业微信/微信/飞书等三方一般要单独填） */
  authorizationEndpoint?: string;
  /** OAuth/OIDC Token 端点 */
  tokenEndpoint?: string;
  /** OAuth/OIDC UserInfo 端点 */
  userInfoEndpoint?: string;
  /** OAuth/OIDC scopes，空格分隔 */
  scopes?: string;
  /** 厂商特定扩展配置（JSON 对象）：
   *   - 企业微信：{ corpId, agentId, contactSyncSecret?, corpSecret? }
   *   - 微信：    { appId, appSecret, originalId? }
   *   - 飞书：    { appId, appSecret, appType: 'ISV_APP'|'CORP_APP' }
   *   - LDAP：   { host, port, baseDn, userDnPattern, ssl }
   */
  config?: Record<string, unknown>;
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
    authorizationEndpoint: r.authorizationEndpoint,
    tokenEndpoint: r.tokenEndpoint,
    userInfoEndpoint: r.userInfoEndpoint,
    scopes: r.scopes,
    config: r.config ?? undefined,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

/** 将前端字段映射回后端字段（type -> providerType, issuer -> issuerUrl） */
function toApi(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...body };
  if (out.type && !out.providerType) {
    out.providerType = out.type;
    delete out.type;
  }
  if (out.issuer && !out.issuerUrl) {
    out.issuerUrl = out.issuer;
    delete out.issuer;
  }
  return out;
}

export async function listSsoProviders(params: ListSsoProviderParams = {}): Promise<PageResponse<SsoProvider>> {
  const url = apiPath('iam', '/sso-providers');
  const resp = await apiClient.get<PageResponse<any>>(url, { params });
  return { ...resp.data, items: resp.data.items.map(fromApi) };
}

/** 公开接口：只查询启用的 SSO 提供方（用于登录页展示） */
export async function listEnabledSsoProviders(): Promise<SsoProvider[]> {
  const url = apiPath('iam', '/sso-providers');
  try {
    const resp = await apiClient.get<PageResponse<any>>(url, { params: { page: 1, size: 100 } });
    return (resp.data.items || []).map(fromApi).filter((p) => p.enabled);
  } catch {
    return [];
  }
}

export async function createSsoProvider(
  payload: Partial<SsoProvider> & { clientSecret: string },
): Promise<SsoProvider> {
  const url = apiPath('iam', '/sso-providers');
  const resp = await apiClient.post<any>(url, toApi(payload as Record<string, unknown>));
  return fromApi(resp.data);
}

export async function updateSsoProvider(
  providerId: string,
  payload: Partial<SsoProvider>,
): Promise<SsoProvider> {
  const url = apiPath('iam', '/sso-providers/' + providerId);
  const resp = await apiClient.put<any>(url, toApi(payload as Record<string, unknown>));
  return fromApi(resp.data);
}

export async function deleteSsoProvider(providerId: string): Promise<void> {
  const url = apiPath('iam', '/sso-providers/' + providerId);
  await apiClient.delete(url);
}

/** 后端返回 OAuth/OIDC authorize 跳转 URL（含 state 校验） */
export interface SsoAuthorizeInfo {
  providerId: string;
  authorizeUrl: string;
  state: string;
}

export async function getSsoAuthorizeUrl(providerId: string, redirectUri?: string): Promise<SsoAuthorizeInfo> {
  const url = apiPath('iam', '/sso-providers/' + providerId + '/authorize');
  const resp = await apiClient.get<any>(url, { params: redirectUri ? { redirect_uri: redirectUri } : undefined });
  return {
    providerId: resp.data.providerId,
    authorizeUrl: resp.data.authorizeUrl,
    state: resp.data.state,
  };
}


/**
 * SSO 回调：前端拿着三方回调的 code/state 换取本平台 JWT
 * 后端：POST /api/v1/iam/sso-providers/{id}/callback
 */
export interface SsoAuthResult {
  loginResult?: string;
  userId?: string;
  username?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenType?: string;
  expiresIn?: number;
  mfaRequired?: boolean;
}

export async function ssoCallback(
  providerId: string,
  payload: { code: string; state?: string },
): Promise<SsoAuthResult> {
  const url = apiPath('iam', '/sso-providers/' + providerId + '/callback');
  const resp = await apiClient.post<any>(url, payload);
  return resp.data;
}

/** 重新导出厂商预设匹配函数（来自 sso-presets） */
export { matchPreset } from './sso-presets';

import { createApiClient, apiPath } from '@mate/shared/api';

const client = createApiClient({ baseURL: apiPath('dashboard', '/v1') });
const data = <T>(resp: { data: T }): T => resp.data;
async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  return data(await client.get<T>(url, params ? { params } : undefined));
}
async function post<T>(url: string, body?: unknown): Promise<T> {
  return data(await client.post<T>(url, body));
}
async function put<T>(url: string, body?: unknown): Promise<T> {
  return data(await client.put<T>(url, body));
}
async function del<T>(url: string): Promise<T> {
  return data(await client.delete<T>(url));
}



import type { UserProfile, UserPermissions } from './types';

/**
 * 当前登录用户信息：GET /v1/dashboard/profile
 * 返回包含邮箱、姓名、租户、角色、部门、权限摘要。
 */
export async function getCurrentUser(): Promise<UserProfile> {
  return get<UserProfile>('/v1/dashboard/profile');
}

/**
 * 当前登录用户权限聚合：GET /v1/dashboard/profile/permissions
 * 对齐 SPEC-TECH-IAM 3.5.8，供个人中心「权限查看」按模块分组展示。
 */
export async function getCurrentUserPermissions(): Promise<UserPermissions> {
  return get<UserPermissions>('/v1/dashboard/profile/permissions');
}

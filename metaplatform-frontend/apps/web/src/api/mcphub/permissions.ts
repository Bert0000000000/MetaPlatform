import { createApiClient, apiPath } from '@mate/shared/api';

const client = createApiClient({ baseURL: apiPath('mcp', '') });
const data = <T>(resp: { data: T }): T => resp.data;
async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> { return data(await client.get<T>(url, params ? { params } : undefined)); }
async function post<T>(url: string, body?: unknown): Promise<T> { return data(await client.post<T>(url, body)); }
async function put<T>(url: string, body?: unknown): Promise<T> { return data(await client.put<T>(url, body)); }
async function del<T>(url: string): Promise<T> { return data(await client.delete<T>(url)); }

import type { PermissionRule, PermissionRuleCreateRequest, PageResponse } from './types';

export async function listRules(): Promise<PageResponse<PermissionRule>> {
  return get<PageResponse<PermissionRule>>('/permissions');
}
export async function createRule(req: PermissionRuleCreateRequest): Promise<PermissionRule> {
  return post<PermissionRule>('/permissions', req);
}
export async function updateRule(
  id: string,
  req: PermissionRuleCreateRequest,
): Promise<PermissionRule> {
  return put<PermissionRule>(`/permissions/${id}`, req);
}
export async function deleteRule(id: string): Promise<void> {
  await del(`/permissions/${id}`);
}

import { get, post, put, del } from './client';
import type { PermissionRule, PermissionRuleCreateRequest, PageResponse } from '@/types';

export async function listRules(): Promise<PageResponse<PermissionRule>> {
  return get<PageResponse<PermissionRule>>('/v1/mcp/permissions');
}

export async function createRule(req: PermissionRuleCreateRequest): Promise<PermissionRule> {
  return post<PermissionRule>('/v1/mcp/permissions', req);
}

export async function updateRule(
  id: string,
  req: PermissionRuleCreateRequest,
): Promise<PermissionRule> {
  return put<PermissionRule>(`/v1/mcp/permissions/${id}`, req);
}

export async function deleteRule(id: string): Promise<void> {
  await del(`/v1/mcp/permissions/${id}`);
}

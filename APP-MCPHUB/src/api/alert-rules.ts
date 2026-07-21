import { get, post, put, del, patch } from './client';
import type { AlertRule, AlertRuleCreateRequest, PageResponse } from '@/types';

export async function listAlertRules(params?: {
  enabled?: boolean;
  page?: number;
  size?: number;
}): Promise<PageResponse<AlertRule>> {
  return get<PageResponse<AlertRule>>('/v1/mcp/alert-rules', params as Record<string, unknown>);
}

export async function getAlertRule(id: string): Promise<AlertRule> {
  return get<AlertRule>(`/v1/mcp/alert-rules/${id}`);
}

export async function createAlertRule(req: AlertRuleCreateRequest): Promise<AlertRule> {
  return post<AlertRule>('/v1/mcp/alert-rules', req as Record<string, unknown>);
}

export async function updateAlertRule(id: string, req: AlertRuleCreateRequest): Promise<AlertRule> {
  return put<AlertRule>(`/v1/mcp/alert-rules/${id}`, req as Record<string, unknown>);
}

export async function deleteAlertRule(id: string): Promise<void> {
  await del(`/v1/mcp/alert-rules/${id}`);
}

export async function toggleAlertRule(id: string, enabled: boolean): Promise<AlertRule> {
  return patch<AlertRule>(`/v1/mcp/alert-rules/${id}/enabled?enabled=${enabled}`);
}

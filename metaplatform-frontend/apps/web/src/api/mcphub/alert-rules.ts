import { createApiClient, apiPath } from '@mate/shared/api';

const client = createApiClient({ baseURL: apiPath('mcp', '') });
const data = <T>(resp: { data: T }): T => resp.data;
async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> { return data(await client.get<T>(url, params ? { params } : undefined)); }
async function post<T>(url: string, body?: unknown): Promise<T> { return data(await client.post<T>(url, body)); }
async function put<T>(url: string, body?: unknown): Promise<T> { return data(await client.put<T>(url, body)); }
async function del<T>(url: string): Promise<T> { return data(await client.delete<T>(url)); }
async function patch<T>(url: string, body?: unknown): Promise<T> { return data(await client.patch<T>(url, body)); }

import type { AlertRule, AlertRuleCreateRequest, PageResponse } from './types';

export async function listAlertRules(params?: {
  enabled?: boolean;
  page?: number;
  size?: number;
}): Promise<PageResponse<AlertRule>> {
  return get<PageResponse<AlertRule>>('/alert-rules', params as Record<string, unknown>);
}
export async function getAlertRule(id: string): Promise<AlertRule> {
  return get<AlertRule>(`/alert-rules/${id}`);
}
export async function createAlertRule(req: AlertRuleCreateRequest): Promise<AlertRule> {
  return post<AlertRule>('/alert-rules', req);
}
export async function updateAlertRule(id: string, req: AlertRuleCreateRequest): Promise<AlertRule> {
  return put<AlertRule>(`/alert-rules/${id}`, req);
}
export async function deleteAlertRule(id: string): Promise<void> {
  await del(`/alert-rules/${id}`);
}
export async function toggleAlertRule(id: string, enabled: boolean): Promise<AlertRule> {
  return patch<AlertRule>(`/alert-rules/${id}/enabled?enabled=${enabled}`);
}

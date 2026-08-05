import { createApiClient, apiPath } from '@mate/shared/api';

const client = createApiClient({ baseURL: apiPath('mcp', '') });
const data = <T>(resp: { data: T }): T => resp.data;
async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> { return data(await client.get<T>(url, params ? { params } : undefined)); }
async function post<T>(url: string, body?: unknown): Promise<T> { return data(await client.post<T>(url, body)); }
async function put<T>(url: string, body?: unknown): Promise<T> { return data(await client.put<T>(url, body)); }
async function del<T>(url: string): Promise<T> { return data(await client.delete<T>(url)); }

import type { McpDebugSession, McpDebugExecuteRequest, McpDebugCompareResult, PageResponse } from './types';

export async function executeDebug(req: McpDebugExecuteRequest): Promise<McpDebugSession> {
  return post<McpDebugSession>('/debug/execute', req);
}
export async function listDebugHistory(params?: {
  page?: number;
  size?: number;
}): Promise<PageResponse<McpDebugSession>> {
  return get<PageResponse<McpDebugSession>>('/debug/history', params);
}
export async function getDebugSession(id: string): Promise<McpDebugSession> {
  return get<McpDebugSession>(`/debug/sessions/${id}`);
}
export async function replayDebugSession(id: string): Promise<McpDebugSession> {
  return post<McpDebugSession>(`/debug/sessions/${id}/replay`);
}
export async function compareDebugSessions(leftId: string, rightId: string): Promise<McpDebugCompareResult> {
  return post<McpDebugCompareResult>('/debug/compare', { leftId, rightId });
}

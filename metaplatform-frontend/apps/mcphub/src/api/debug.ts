import { get, post } from './client';
import type { McpDebugSession, McpDebugExecuteRequest, McpDebugCompareResult, PageResponse } from '@/types';

export async function executeDebug(req: McpDebugExecuteRequest): Promise<McpDebugSession> {
  return post<McpDebugSession>('/v1/mcp/debug/execute', req);
}

export async function listDebugHistory(params?: {
  page?: number;
  size?: number;
}): Promise<PageResponse<McpDebugSession>> {
  return get<PageResponse<McpDebugSession>>('/v1/mcp/debug/history', params);
}

export async function getDebugSession(id: string): Promise<McpDebugSession> {
  return get<McpDebugSession>(`/v1/mcp/debug/sessions/${id}`);
}

export async function replayDebugSession(id: string): Promise<McpDebugSession> {
  return post<McpDebugSession>(`/v1/mcp/debug/sessions/${id}/replay`);
}

export async function compareDebugSessions(leftId: string, rightId: string): Promise<McpDebugCompareResult> {
  return post<McpDebugCompareResult>('/v1/mcp/debug/compare', { leftId, rightId });
}

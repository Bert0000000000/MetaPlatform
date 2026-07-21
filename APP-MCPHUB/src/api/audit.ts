import { get, download } from './client';
import type {
  AuditLog,
  AuditLogDetail,
  AuditLogStatistics,
  TrendPoint,
  AnalyticsItem,
  PageResponse,
} from '@/types';

export interface AuditQueryParams {
  toolId?: string;
  serverId?: string;
  clientId?: string;
  status?: string;
  startTime?: string;
  endTime?: string;
  page?: number;
  size?: number;
}

interface BackendAuditLog {
  id?: string;
  toolId?: string;
  toolCode?: string;
  serverId?: string;
  clientId?: string;
  userId?: string;
  invocationType?: string;
  status?: string;
  durationMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  errorMessage?: string;
  traceId?: string;
  calledAt?: string;
  requestParams?: Record<string, unknown>;
  response?: unknown;
  stackTrace?: string;
}

function toAuditLog(data: BackendAuditLog): AuditLog {
  const inputTokens = data.inputTokens || 0;
  const outputTokens = data.outputTokens || 0;
  return {
    id: data.id || '',
    timestamp: data.calledAt || '',
    toolId: data.toolId || '',
    toolName: data.toolCode || data.toolId || '',
    serverId: data.serverId,
    clientId: data.clientId,
    userId: data.userId,
    method: data.invocationType || '',
    status: (data.status?.toLowerCase() as AuditLog['status']) || 'error',
    duration: data.durationMs || 0,
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    errorMessage: data.errorMessage,
    traceId: data.traceId,
  };
}

function toAuditLogDetail(data: BackendAuditLog): AuditLogDetail {
  return {
    ...toAuditLog(data),
    requestParams: data.requestParams,
    response: data.response,
    stackTrace: data.stackTrace,
  };
}

export async function listAuditLogs(params?: AuditQueryParams): Promise<PageResponse<AuditLog>> {
  const data = await get<PageResponse<BackendAuditLog>>(
    '/v1/mcp/audit/logs',
    params as Record<string, unknown>,
  );
  return {
    ...data,
    items: data.items.map(toAuditLog),
  };
}

export async function getAuditLogDetail(id: string): Promise<AuditLogDetail> {
  const data = await get<BackendAuditLog>(`/v1/mcp/audit/logs/${id}`);
  return toAuditLogDetail(data);
}

export async function getAuditStatistics(params?: {
  startTime?: string;
  endTime?: string;
}): Promise<AuditLogStatistics> {
  return get<AuditLogStatistics>('/v1/mcp/audit/statistics', params as Record<string, unknown>);
}

export async function getAuditTrends(
  params?: AuditQueryParams & { granularity?: string },
): Promise<TrendPoint[]> {
  return get<TrendPoint[]>('/v1/mcp/audit/trends', params as Record<string, unknown>);
}

export async function getAuditAnalytics(
  params?: AuditQueryParams & { dimension?: string },
): Promise<AnalyticsItem[]> {
  return get<AnalyticsItem[]>('/v1/mcp/audit/analytics', params as Record<string, unknown>);
}

export async function getAuditTrace(id: string): Promise<AuditLogDetail[]> {
  const data = await get<BackendAuditLog[]>(`/v1/mcp/audit/${id}/trace`);
  return data.map(toAuditLogDetail);
}

export async function exportAuditLogs(params?: AuditQueryParams & { format?: string }): Promise<Blob> {
  return download('/v1/mcp/audit/export', params as Record<string, unknown>);
}

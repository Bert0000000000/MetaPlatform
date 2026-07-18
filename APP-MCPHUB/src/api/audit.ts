import { get } from './client';
import type { AuditLog, AuditLogDetail, PageResponse } from '@/types';

export async function listAuditLogs(params?: {
  keyword?: string;
  status?: string;
  toolId?: string;
}): Promise<PageResponse<AuditLog>> {
  return get<PageResponse<AuditLog>>('/v1/mcp/audit/logs', params);
}

export async function getAuditLogDetail(id: string): Promise<AuditLogDetail> {
  return get<AuditLogDetail>(`/v1/mcp/audit/logs/${id}`);
}

export async function getTokenUsageByDay(): Promise<Array<{ date: string; tokens: number }>> {
  return get<Array<{ date: string; tokens: number }>>('/v1/mcp/audit/tokens/usage-by-day');
}

export async function getErrorTrend(): Promise<Array<{ date: string; errors: number }>> {
  return get<Array<{ date: string; errors: number }>>('/v1/mcp/audit/errors/trend');
}

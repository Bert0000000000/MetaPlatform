import { get } from './client';
import type { AuditLog, AuditLogDetail, PageResponse } from '@/types';

const STORAGE_KEY = 'mcphub_audit';

const MOCK_LOGS: AuditLog[] = Array.from({ length: 50 }).map((_, i) => ({
  id: `audit-${i + 1}`,
  timestamp: new Date(Date.now() - i * 3600 * 1000).toISOString(),
  toolId: `tool-${(i % 10) + 1}`,
  toolName: ['query_database', 'send_email', 'read_file', 'search_knowledge', 'call_api'][
    i % 5
  ]!,
  serverId: `server-${(i % 3) + 1}`,
  clientId: `client-${(i % 4) + 1}`,
  userId: `user-${i % 5}`,
  method: 'tools/call',
  status: i % 13 === 0 ? 'error' : i % 17 === 0 ? 'timeout' : 'success',
  duration: 100 + Math.floor(Math.random() * 2000),
  inputTokens: 50 + Math.floor(Math.random() * 500),
  outputTokens: 80 + Math.floor(Math.random() * 800),
  totalTokens: 130 + Math.floor(Math.random() * 1300),
  errorCode: i % 13 === 0 ? 'MCP_INTERNAL_ERROR' : undefined,
  errorMessage: i % 13 === 0 ? 'Tool execution failed: timeout' : undefined,
  traceId: `trace-${(i + 1).toString().padStart(6, '0')}`,
}));

function load(): AuditLog[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(MOCK_LOGS));
    return MOCK_LOGS;
  }
  try {
    return JSON.parse(raw) as AuditLog[];
  } catch {
    return MOCK_LOGS;
  }
}

export async function listAuditLogs(params?: {
  keyword?: string;
  status?: string;
  toolId?: string;
}): Promise<PageResponse<AuditLog>> {
  try {
    return await get<PageResponse<AuditLog>>('/v1/mcp/audit/logs', params);
  } catch {
    let items = load();
    if (params?.keyword) {
      const k = params.keyword.toLowerCase();
      items = items.filter(
        (i) =>
          i.toolName.toLowerCase().includes(k) ||
          i.userId?.toLowerCase().includes(k) ||
          i.traceId?.toLowerCase().includes(k),
      );
    }
    if (params?.status) items = items.filter((i) => i.status === params.status);
    if (params?.toolId) items = items.filter((i) => i.toolId === params.toolId);
    return {
      items,
      total: items.length,
      page: 1,
      pageSize: items.length,
      totalPages: items.length === 0 ? 0 : 1,
    };
  }
}

export async function getAuditLogDetail(id: string): Promise<AuditLogDetail> {
  try {
    return await get<AuditLogDetail>(`/v1/mcp/audit/logs/${id}`);
  } catch {
    const log = load().find((l) => l.id === id);
    if (!log) throw new Error('日志不存在');
    return {
      ...log,
      requestParams: { query: 'SELECT * FROM employees WHERE status = \'active\'', limit: 50 },
      response: { rows: 47, status: 'ok' },
      stackTrace: log.status === 'error' ? 'TimeoutException: ...' : undefined,
    };
  }
}

export async function getTokenUsageByDay(): Promise<Array<{ date: string; tokens: number }>> {
  const arr: Array<{ date: string; tokens: number }> = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 3600 * 1000);
    arr.push({
      date: `${d.getMonth() + 1}/${d.getDate()}`,
      tokens: 5000 + Math.floor(Math.random() * 15000),
    });
  }
  return arr;
}

export async function getErrorTrend(): Promise<Array<{ date: string; errors: number }>> {
  const arr: Array<{ date: string; errors: number }> = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 3600 * 1000);
    arr.push({
      date: `${d.getMonth() + 1}/${d.getDate()}`,
      errors: Math.floor(Math.random() * 30),
    });
  }
  return arr;
}

import { createApiClient, apiPath } from '@mate/shared/api';

const client = createApiClient({ baseURL: apiPath('mcp', '/v1') });
const data = <T>(resp: { data: T }): T => resp.data;
async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> { return data(await client.get<T>(url, params ? { params } : undefined)); }
async function post<T>(url: string, body?: unknown): Promise<T> { return data(await client.post<T>(url, body)); }
async function put<T>(url: string, body?: unknown): Promise<T> { return data(await client.put<T>(url, body)); }
async function del<T>(url: string): Promise<T> { return data(await client.delete<T>(url)); }

import type {
  CollaborationAudit,
  CollaborationAuditCreateRequest,
  PageResponse,
} from './types';
export async function listCollaborations(params?: {
  callerId?: string;
  calleeId?: string;
  protocolType?: string;
  status?: string;
  startTime?: string;
  endTime?: string;
  traceId?: string;
  page?: number;
  size?: number;
}): Promise<PageResponse<CollaborationAudit>> {
  return get<PageResponse<CollaborationAudit>>('/v1/mcp/collaborations/logs', params);
}
export async function getCollaboration(id: string): Promise<CollaborationAudit> {
  return get<CollaborationAudit>(`/v1/mcp/collaborations/logs/${id}`);
}
export async function createCollaboration(
  req: CollaborationAuditCreateRequest,
): Promise<CollaborationAudit> {
  return post<CollaborationAudit>('/v1/mcp/collaborations', req);
}

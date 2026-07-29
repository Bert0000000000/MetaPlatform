import { createApiClient, apiPath } from '@mate/shared/api';

const client = createApiClient({ baseURL: apiPath('mcp', '/v1') });
const data = <T>(resp: { data: T }): T => resp.data;
async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> { return data(await client.get<T>(url, params ? { params } : undefined)); }
async function post<T>(url: string, body?: unknown): Promise<T> { return data(await client.post<T>(url, body)); }
async function put<T>(url: string, body?: unknown): Promise<T> { return data(await client.put<T>(url, body)); }
async function del<T>(url: string): Promise<T> { return data(await client.delete<T>(url)); }

import type { AgentTrust, AgentTrustCreateRequest, PageResponse } from './types';

export async function listTrusts(params?: {
  agentId?: string;
  trustLevel?: string;
  keyword?: string;
  page?: number;
  size?: number;
}): Promise<PageResponse<AgentTrust>> {
  return get<PageResponse<AgentTrust>>('/v1/mcp/trusts', params);
}
export async function getTrust(id: string): Promise<AgentTrust> {
  return get<AgentTrust>(`/v1/mcp/trusts/${id}`);
}
export async function createTrust(req: AgentTrustCreateRequest): Promise<AgentTrust> {
  return post<AgentTrust>('/v1/mcp/trusts', req);
}
export async function updateTrust(
  id: string,
  req: Partial<AgentTrustCreateRequest>,
): Promise<AgentTrust> {
  return put<AgentTrust>(`/v1/mcp/trusts/${id}`, req);
}
export async function deleteTrust(id: string): Promise<void> {
  await del(`/v1/mcp/trusts/${id}`);
}

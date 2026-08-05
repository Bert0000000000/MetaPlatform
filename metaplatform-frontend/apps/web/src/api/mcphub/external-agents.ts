import { createApiClient, apiPath } from '@mate/shared/api';

const client = createApiClient({ baseURL: apiPath('mcp', '') });
const data = <T>(resp: { data: T }): T => resp.data;
async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> { return data(await client.get<T>(url, params ? { params } : undefined)); }
async function post<T>(url: string, body?: unknown): Promise<T> { return data(await client.post<T>(url, body)); }
async function put<T>(url: string, body?: unknown): Promise<T> { return data(await client.put<T>(url, body)); }
async function del<T>(url: string): Promise<T> { return data(await client.delete<T>(url)); }

import type {
  ExternalAgent,
  ExternalAgentCreateRequest,
  ExternalAgentTestResult,
  PageResponse,
} from './types';
export async function listExternalAgents(params?: {
  status?: string;
  trustLevel?: string;
  protocolType?: string;
  keyword?: string;
  page?: number;
  size?: number;
}): Promise<PageResponse<ExternalAgent>> {
  return get<PageResponse<ExternalAgent>>('/external-agents', params);
}
export async function getExternalAgent(id: string): Promise<ExternalAgent> {
  return get<ExternalAgent>(`/external-agents/${id}`);
}
export async function createExternalAgent(req: ExternalAgentCreateRequest): Promise<ExternalAgent> {
  return post<ExternalAgent>('/external-agents', req);
}
export async function updateExternalAgent(
  id: string,
  req: ExternalAgentCreateRequest,
): Promise<ExternalAgent> {
  return put<ExternalAgent>(`/external-agents/${id}`, req);
}
export async function deleteExternalAgent(id: string): Promise<void> {
  await del(`/external-agents/${id}`);
}
export async function testExternalAgentConnection(id: string): Promise<ExternalAgentTestResult> {
  return post<ExternalAgentTestResult>(`/external-agents/${id}/test-connection`);
}

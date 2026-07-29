import { createApiClient, apiPath } from '@mate/shared/api';

const client = createApiClient({ baseURL: apiPath('mcp', '/v1') });
const data = <T>(resp: { data: T }): T => resp.data;
async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> { return data(await client.get<T>(url, params ? { params } : undefined)); }
async function post<T>(url: string, body?: unknown): Promise<T> { return data(await client.post<T>(url, body)); }
async function put<T>(url: string, body?: unknown): Promise<T> { return data(await client.put<T>(url, body)); }
async function del<T>(url: string): Promise<T> { return data(await client.delete<T>(url)); }

import type { McpServer, McpServerCreateRequest, McpServerStatus, PageResponse } from './types';

export async function listServers(params?: { keyword?: string }): Promise<PageResponse<McpServer>> {
  return get<PageResponse<McpServer>>('/v1/mcp/servers', params);
}
export async function getServer(id: string): Promise<McpServer> {
  return get<McpServer>(`/v1/mcp/servers/${id}`);
}
export async function createServer(req: McpServerCreateRequest): Promise<McpServer> {
  return post<McpServer>('/v1/mcp/servers', req);
}
export async function updateServer(id: string, req: McpServerCreateRequest): Promise<McpServer> {
  return put<McpServer>(`/v1/mcp/servers/${id}`, req);
}
export async function deleteServer(id: string): Promise<void> {
  await del(`/v1/mcp/servers/${id}`);
}
export async function startServer(id: string): Promise<McpServer> {
  return post<McpServer>(`/v1/mcp/servers/${id}/start`);
}
export async function stopServer(id: string): Promise<McpServer> {
  return post<McpServer>(`/v1/mcp/servers/${id}/stop`);
}
export async function restartServer(id: string): Promise<McpServer> {
  return post<McpServer>(`/v1/mcp/servers/${id}/restart`);
}
export async function getServerStatus(id: string): Promise<McpServerStatus> {
  return get<McpServerStatus>(`/v1/mcp/servers/${id}/status`);
}

import { get, post, put, del } from './client';
import type { McpServer, McpServerCreateRequest, PageResponse } from '@/types';

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

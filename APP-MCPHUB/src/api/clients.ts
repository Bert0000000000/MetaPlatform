import { get, post, put, del } from './client';
import type { McpClient, McpClientCreateRequest, PageResponse } from '@/types';

export async function listClients(): Promise<PageResponse<McpClient>> {
  return get<PageResponse<McpClient>>('/v1/mcp/clients');
}

export async function getClient(id: string): Promise<McpClient> {
  return get<McpClient>(`/v1/mcp/clients/${id}`);
}

export async function createClient(req: McpClientCreateRequest): Promise<McpClient> {
  return post<McpClient>('/v1/mcp/clients', req);
}

export async function updateClient(id: string, req: McpClientCreateRequest): Promise<McpClient> {
  return put<McpClient>(`/v1/mcp/clients/${id}`, req);
}

export async function deleteClient(id: string): Promise<void> {
  await del(`/v1/mcp/clients/${id}`);
}

export async function syncClient(id: string): Promise<McpClient> {
  return post<McpClient>(`/v1/mcp/clients/${id}/sync`);
}

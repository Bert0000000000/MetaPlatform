import { get, post, put, del } from './client';
import type { McpClient, McpClientCreateRequest, McpDiscoveredTool, PageResponse } from '@/types';

function normalizeRequest(req: McpClientCreateRequest): Record<string, unknown> {
  return {
    name: req.name,
    serverUrl: req.endpoint,
    baseUrl: req.baseUrl || req.endpoint,
    clientType: req.clientType,
    transportType: req.transportType || 'HTTP',
    authType: req.authType === 'none' ? undefined : req.authType,
    authToken: req.authToken || req.apiKey,
    timeoutMs: req.timeoutMs,
    headers: req.headers,
    serverIds: req.serverIds,
    config: req.config,
  };
}

function normalizeResponse(data: McpClient): McpClient {
  return {
    ...data,
    endpoint: data.baseUrl || data.serverUrl || data.endpoint || '',
    apiKey: data.authToken || data.apiKey,
    lastSyncAt: data.lastConnectedAt || data.lastSyncAt,
  };
}

export async function listClients(): Promise<PageResponse<McpClient>> {
  const res = await get<PageResponse<McpClient>>('/v1/mcp/clients');
  return { ...res, items: res.items.map(normalizeResponse) };
}

export async function getClient(id: string): Promise<McpClient> {
  return normalizeResponse(await get<McpClient>(`/v1/mcp/clients/${id}`));
}

export async function createClient(req: McpClientCreateRequest): Promise<McpClient> {
  return normalizeResponse(await post<McpClient>('/v1/mcp/clients', normalizeRequest(req)));
}

export async function updateClient(id: string, req: McpClientCreateRequest): Promise<McpClient> {
  return normalizeResponse(await put<McpClient>(`/v1/mcp/clients/${id}`, normalizeRequest(req)));
}

export async function deleteClient(id: string): Promise<void> {
  await del(`/v1/mcp/clients/${id}`);
}

export async function testConnection(id: string): Promise<McpClient> {
  return normalizeResponse(await post<McpClient>(`/v1/mcp/clients/${id}/test-connection`));
}

export async function discoverClientTools(id: string): Promise<McpDiscoveredTool[]> {
  return post<McpDiscoveredTool[]>(`/v1/mcp/clients/${id}/discover`);
}

export async function listClientTools(id: string): Promise<McpDiscoveredTool[]> {
  return get<McpDiscoveredTool[]>(`/v1/mcp/clients/${id}/tools`);
}

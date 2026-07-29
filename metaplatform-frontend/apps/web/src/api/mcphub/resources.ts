import { createApiClient, apiPath } from '@mate/shared/api';

const client = createApiClient({ baseURL: apiPath('mcp', '/v1') });
const data = <T>(resp: { data: T }): T => resp.data;
async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> { return data(await client.get<T>(url, params ? { params } : undefined)); }
async function post<T>(url: string, body?: unknown): Promise<T> { return data(await client.post<T>(url, body)); }
async function put<T>(url: string, body?: unknown): Promise<T> { return data(await client.put<T>(url, body)); }
async function del<T>(url: string): Promise<T> { return data(await client.delete<T>(url)); }

import type { McpResource, McpResourceCreateRequest, PageResponse } from './types';

export async function listResources(params?: { keyword?: string }): Promise<PageResponse<McpResource>> {
  return get<PageResponse<McpResource>>('/v1/mcp/resources', params);
}
export async function getResource(id: string): Promise<McpResource> {
  return get<McpResource>(`/v1/mcp/resources/${id}`);
}
export async function createResource(req: McpResourceCreateRequest): Promise<McpResource> {
  return post<McpResource>('/v1/mcp/resources', req);
}
export async function updateResource(
  id: string,
  req: McpResourceCreateRequest,
): Promise<McpResource> {
  return put<McpResource>(`/v1/mcp/resources/${id}`, req);
}
export async function deleteResource(id: string): Promise<void> {
  await del(`/v1/mcp/resources/${id}`);
}

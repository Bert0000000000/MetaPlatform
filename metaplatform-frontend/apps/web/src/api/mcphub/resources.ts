import { createApiClient, apiPath } from '@mate/shared/api';

const client = createApiClient({ baseURL: apiPath('mcp', '') });
const data = <T>(resp: { data: T }): T => resp.data;
async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> { return data(await client.get<T>(url, params ? { params } : undefined)); }
async function post<T>(url: string, body?: unknown): Promise<T> { return data(await client.post<T>(url, body)); }
async function put<T>(url: string, body?: unknown): Promise<T> { return data(await client.put<T>(url, body)); }
async function del<T>(url: string): Promise<T> { return data(await client.delete<T>(url)); }

import type { McpResource, McpResourceCreateRequest, PageResponse } from './types';

/** Registered-resource listing supplies name/URI, not a persisted resource CRUD identity. */
export type RegisteredMcpResource = Pick<McpResource, 'name' | 'uri'>
  & Partial<Omit<McpResource, 'name' | 'uri'>>;

// mcpGetMcpResources is implemented; detail and writes are not connected in the current service.
export const RESOURCE_MANAGEMENT_AVAILABLE = false;

/** 后端 /resources 返回 {resources:[...]}，包装成前端 PageResponse 结构 */
function toPage(raw: { resources?: RegisteredMcpResource[]; items?: RegisteredMcpResource[] } | null): PageResponse<RegisteredMcpResource> {
  const items = raw?.items ?? raw?.resources;
  if (!Array.isArray(items)) throw new Error('资源注册信息响应缺少资源列表。');
  return { items, total: items.length, page: 1, size: items.length || 1, totalPages: 1 };
}

export async function listResources(params?: { keyword?: string }): Promise<PageResponse<RegisteredMcpResource>> {
  return toPage(await get<{ resources?: RegisteredMcpResource[]; items?: RegisteredMcpResource[] }>('/resources', params));
}
export async function getResource(id: string): Promise<McpResource> {
  return get<McpResource>(`/resources/${id}`);
}
export async function createResource(req: McpResourceCreateRequest): Promise<McpResource> {
  return post<McpResource>('/resources', req);
}
export async function updateResource(
  id: string,
  req: McpResourceCreateRequest,
): Promise<McpResource> {
  return put<McpResource>(`/resources/${id}`, req);
}
export async function deleteResource(id: string): Promise<void> {
  await del(`/resources/${id}`);
}

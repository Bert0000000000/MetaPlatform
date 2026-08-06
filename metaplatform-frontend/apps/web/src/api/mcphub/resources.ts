import { createApiClient, apiPath } from '@mate/shared/api';

const client = createApiClient({ baseURL: apiPath('mcp', '') });
const data = <T>(resp: { data: T }): T => resp.data;
async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> { return data(await client.get<T>(url, params ? { params } : undefined)); }
async function post<T>(url: string, body?: unknown): Promise<T> { return data(await client.post<T>(url, body)); }
async function put<T>(url: string, body?: unknown): Promise<T> { return data(await client.put<T>(url, body)); }
async function del<T>(url: string): Promise<T> { return data(await client.delete<T>(url)); }

import type { McpResource, McpResourceCreateRequest, PageResponse } from './types';

/** 后端 /resources 返回 {resources:[...]}，包装成前端 PageResponse 结构 */
function toPage(raw: { resources?: McpResource[]; items?: McpResource[] } | null): PageResponse<McpResource> {
  const items = raw?.items ?? raw?.resources ?? [];
  return { items, total: items.length, page: 1, pageSize: items.length || 1, totalPages: 1 };
}

export async function listResources(params?: { keyword?: string }): Promise<PageResponse<McpResource>> {
  return toPage(await get<{ resources?: McpResource[]; items?: McpResource[] }>('/resources', params));
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

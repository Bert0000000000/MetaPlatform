import { get, post, put, del } from './client';
import type { McpResource, McpResourceCreateRequest, PageResponse } from '@/types';

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

import { get, post, put, del } from './client';
import type { McpTool, McpToolCreateRequest, PageResponse } from '@/types';

export async function listTools(params?: {
  keyword?: string;
  category?: string;
}): Promise<PageResponse<McpTool>> {
  return get<PageResponse<McpTool>>('/v1/mcp/tools', params);
}

export async function getTool(id: string): Promise<McpTool> {
  return get<McpTool>(`/v1/mcp/tools/${id}`);
}

export async function createTool(req: McpToolCreateRequest): Promise<McpTool> {
  return post<McpTool>('/v1/mcp/tools', req);
}

export async function updateTool(id: string, req: McpToolCreateRequest): Promise<McpTool> {
  return put<McpTool>(`/v1/mcp/tools/${id}`, req);
}

export async function deleteTool(id: string): Promise<void> {
  await del(`/v1/mcp/tools/${id}`);
}

export async function listCategories(): Promise<string[]> {
  return get<string[]>('/v1/mcp/tools/categories');
}

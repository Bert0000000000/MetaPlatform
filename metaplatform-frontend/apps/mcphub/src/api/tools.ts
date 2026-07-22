import { get, post, put, del } from './client';
import type {
  McpTool,
  McpToolCategory,
  McpToolCategoryCreateRequest,
  McpToolCreateRequest,
  McpToolVersion,
  McpToolVersionCompareResult,
  PageResponse,
  ToolParam,
} from '@/types';

interface BackendTool {
  id: string;
  name: string;
  code: string;
  category: string;
  version: string;
  description: string;
  inputSchema: string;
  outputSchema: string;
  toolType: string;
  endpoint: string;
  beanClass: string;
  enabled: boolean;
  serverId?: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

interface BackendVersion {
  id: string;
  toolId: string;
  version: string;
  schema: string;
  description: string;
  changeLog: string;
  isCurrent: boolean;
  createdAt: string;
  createdBy: string;
}

function parseSchema(schema: string | unknown): ToolParam[] {
  if (typeof schema !== 'string' || !schema) return [];
  try {
    const parsed = JSON.parse(schema);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function stringifySchema(schema: ToolParam[]): string {
  return JSON.stringify(schema ?? []);
}

function fromBackendTool(data: BackendTool): McpTool {
  return {
    id: data.id,
    name: data.name,
    code: data.code,
    category: data.category,
    version: data.version,
    description: data.description,
    inputSchema: parseSchema(data.inputSchema),
    outputType: 'json',
    enabled: data.enabled,
    serverId: data.serverId,
    tags: data.tags ?? [],
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

function fromBackendVersion(data: BackendVersion): McpToolVersion {
  return {
    id: data.id,
    toolId: data.toolId,
    version: data.version,
    schema: parseSchema(data.schema),
    description: data.description,
    changeLog: data.changeLog,
    isCurrent: data.isCurrent,
    createdAt: data.createdAt,
    createdBy: data.createdBy,
  };
}

function toBackendRequest(req: McpToolCreateRequest): Record<string, unknown> {
  return {
    name: req.name,
    code: req.code,
    category: req.category,
    description: req.description,
    inputSchema: stringifySchema(req.inputSchema),
    outputSchema: '{}',
    outputType: req.outputType,
    enabled: req.enabled,
    tags: req.tags ?? [],
    changeLog: req.changeLog,
  };
}

export async function listTools(params?: {
  keyword?: string;
  category?: string;
}): Promise<PageResponse<McpTool>> {
  const data = await get<PageResponse<BackendTool>>('/v1/mcp/tools', params);
  return {
    ...data,
    items: data.items.map(fromBackendTool),
  };
}

export async function getTool(id: string): Promise<McpTool> {
  const data = await get<BackendTool>(`/v1/mcp/tools/${id}`);
  return fromBackendTool(data);
}

export async function createTool(req: McpToolCreateRequest): Promise<McpTool> {
  const data = await post<BackendTool>('/v1/mcp/tools', toBackendRequest(req));
  return fromBackendTool(data);
}

export async function updateTool(id: string, req: McpToolCreateRequest): Promise<McpTool> {
  const data = await put<BackendTool>(`/v1/mcp/tools/${id}`, toBackendRequest(req));
  return fromBackendTool(data);
}

export async function deleteTool(id: string): Promise<void> {
  await del(`/v1/mcp/tools/${id}`);
}

export async function listCategories(): Promise<McpToolCategory[]> {
  return get<McpToolCategory[]>('/v1/mcp/tool-categories');
}

export async function createCategory(req: McpToolCategoryCreateRequest): Promise<McpToolCategory> {
  return post<McpToolCategory>('/v1/mcp/tool-categories', req);
}

export async function updateCategory(id: string, req: McpToolCategoryCreateRequest): Promise<McpToolCategory> {
  return put<McpToolCategory>(`/v1/mcp/tool-categories/${id}`, req);
}

export async function deleteCategory(id: string): Promise<void> {
  await del(`/v1/mcp/tool-categories/${id}`);
}

export async function listToolVersions(toolId: string): Promise<McpToolVersion[]> {
  const data = await get<BackendVersion[]>(`/v1/mcp/tools/${toolId}/versions`);
  return data.map(fromBackendVersion);
}

export async function getToolVersion(toolId: string, versionId: string): Promise<McpToolVersion> {
  const data = await get<BackendVersion>(`/v1/mcp/tools/${toolId}/versions/${versionId}`);
  return fromBackendVersion(data);
}

export async function rollbackToolVersion(toolId: string, versionId: string): Promise<McpToolVersion> {
  const data = await post<BackendVersion>(`/v1/mcp/tools/${toolId}/versions/${versionId}/rollback`);
  return fromBackendVersion(data);
}

export async function setCurrentToolVersion(toolId: string, versionId: string): Promise<McpToolVersion> {
  const data = await post<BackendVersion>(`/v1/mcp/tools/${toolId}/versions/${versionId}/set-current`);
  return fromBackendVersion(data);
}

export async function compareToolVersions(
  toolId: string,
  leftVersionId: string,
  rightVersionId: string,
): Promise<McpToolVersionCompareResult> {
  const data = await get<{
    left: BackendVersion;
    right: BackendVersion;
    differences: string[];
  }>(`/v1/mcp/tools/${toolId}/versions/compare`, { leftVersionId, rightVersionId });
  return {
    left: fromBackendVersion(data.left),
    right: fromBackendVersion(data.right),
    differences: data.differences,
  };
}

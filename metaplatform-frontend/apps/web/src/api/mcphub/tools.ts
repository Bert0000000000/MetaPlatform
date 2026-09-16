import { createApiClient, apiPath } from '@mate/shared/api';

const client = createApiClient({ baseURL: apiPath('mcp', '') });
const data = <T>(resp: { data: T }): T => resp.data;
async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> { return data(await client.get<T>(url, params ? { params } : undefined)); }
async function post<T>(url: string, body?: unknown): Promise<T> { return data(await client.post<T>(url, body)); }
async function put<T>(url: string, body?: unknown): Promise<T> { return data(await client.put<T>(url, body)); }
async function del<T>(url: string): Promise<T> { return data(await client.delete<T>(url)); }

import type {
  McpTool,
  McpToolCategory,
  McpToolCategoryCreateRequest,
  McpToolCreateRequest,
  McpToolVersion,
  McpToolVersionCompareResult,
  PageResponse,
  ToolParam,
} from './types';
/**
 * GET /tools 返回的是 MCP 注册表形态（name 即标识，inputSchema 是 JSON Schema 对象），
 * 只有 GET /tools/{name} 才补出 id/code/version 这些 CRUD 字段。这里统一补齐，
 * 让列表页不必区分两个端点的形状。
 */
interface BackendTool {
  id?: string;
  name: string;
  code?: string;
  category?: string;
  version?: string;
  description?: string;
  inputSchema?: string | Record<string, unknown>;
  outputSchema?: string;
  toolType?: string;
  endpoint?: string;
  beanClass?: string;
  enabled?: boolean;
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
/** JSON Schema 对象（注册表形态）→ 前端 ToolParam[]。 */
function paramsFromJsonSchema(schema: unknown): ToolParam[] {
  if (!schema || typeof schema !== 'object') return [];
  const { properties, required } = schema as {
    properties?: Record<string, { type?: string; description?: string } | undefined>;
    required?: unknown;
  };
  if (!properties || typeof properties !== 'object') return [];
  const req = new Set(Array.isArray(required) ? (required as string[]) : []);
  return Object.entries(properties).map(([name, def]) => ({
    name,
    type: (def?.type ?? 'string') as ToolParam['type'],
    required: req.has(name),
    description: def?.description ?? '',
  }));
}

function parseSchema(schema: string | unknown): ToolParam[] {
  if (typeof schema === 'string') {
    if (!schema) return [];
    try {
      const parsed = JSON.parse(schema);
      return Array.isArray(parsed) ? parsed : paramsFromJsonSchema(parsed);
    } catch {
      return [];
    }
  }
  return paramsFromJsonSchema(schema);
}
function stringifySchema(schema: ToolParam[]): string {
  return JSON.stringify(schema ?? []);
}
function fromBackendTool(data: BackendTool): McpTool {
  return {
    id: data.id ?? data.name,
    name: data.name,
    code: data.code ?? data.name,
    category: data.category ?? '',
    version: data.version ?? '1',
    description: data.description ?? '',
    inputSchema: parseSchema(data.inputSchema),
    outputType: 'json',
    enabled: data.enabled ?? true,
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
  // 后端 /tools 返回 {tools:[...]}，包装成前端 PageResponse 结构
  const raw = await get<{ tools?: BackendTool[]; items?: BackendTool[] }>('/tools', params);
  const items = (raw?.items ?? raw?.tools ?? []).map(fromBackendTool);
  return { items, total: items.length, page: 1, size: items.length || 1, totalPages: 1 };
}
export async function getTool(id: string): Promise<McpTool> {
  const data = await get<BackendTool>(`/tools/${id}`);
  return fromBackendTool(data);
}
export async function createTool(req: McpToolCreateRequest): Promise<McpTool> {
  const data = await post<BackendTool>('/tools', toBackendRequest(req));
  return fromBackendTool(data);
}
export async function updateTool(id: string, req: McpToolCreateRequest): Promise<McpTool> {
  const data = await put<BackendTool>(`/tools/${id}`, toBackendRequest(req));
  return fromBackendTool(data);
}
export async function deleteTool(id: string): Promise<void> {
  await del(`/tools/${id}`);
}
export async function listCategories(): Promise<McpToolCategory[]> {
  return get<McpToolCategory[]>('/tool-categories');
}
export async function createCategory(req: McpToolCategoryCreateRequest): Promise<McpToolCategory> {
  return post<McpToolCategory>('/tool-categories', req);
}
export async function updateCategory(id: string, req: McpToolCategoryCreateRequest): Promise<McpToolCategory> {
  return put<McpToolCategory>(`/tool-categories/${id}`, req);
}
export async function deleteCategory(id: string): Promise<void> {
  await del(`/tool-categories/${id}`);
}
export async function listToolVersions(toolId: string): Promise<McpToolVersion[]> {
  const data = await get<BackendVersion[]>(`/tools/${toolId}/versions`);
  return data.map(fromBackendVersion);
}
export async function getToolVersion(toolId: string, versionId: string): Promise<McpToolVersion> {
  const data = await get<BackendVersion>(`/tools/${toolId}/versions/${versionId}`);
  return fromBackendVersion(data);
}
export async function rollbackToolVersion(toolId: string, versionId: string): Promise<McpToolVersion> {
  const data = await post<BackendVersion>(`/tools/${toolId}/versions/${versionId}/rollback`);
  return fromBackendVersion(data);
}
export async function setCurrentToolVersion(toolId: string, versionId: string): Promise<McpToolVersion> {
  const data = await post<BackendVersion>(`/tools/${toolId}/versions/${versionId}/set-current`);
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
  }>(`/tools/${toolId}/versions/compare`, { leftVersionId, rightVersionId });
  return {
    left: fromBackendVersion(data.left),
    right: fromBackendVersion(data.right),
    differences: data.differences,
  };
}

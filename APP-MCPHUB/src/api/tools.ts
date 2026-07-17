import { get, post, put, del } from './client';
import type { McpTool, McpToolCreateRequest, PageResponse } from '@/types';

const STORAGE_KEY = 'mcphub_tools';

function load(): McpTool[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as McpTool[];
  } catch {
    return [];
  }
}

function save(items: McpTool[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function now(): string {
  return new Date().toISOString();
}

function generateId(): string {
  return `tool_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export async function listTools(params?: {
  keyword?: string;
  category?: string;
}): Promise<PageResponse<McpTool>> {
  try {
    return await get<PageResponse<McpTool>>('/v1/mcp/tools', params);
  } catch {
    const items = load();
    const k = params?.keyword?.toLowerCase() ?? '';
    const filtered = items.filter((t) => {
      const matchK = !k || t.name.toLowerCase().includes(k) || t.code.toLowerCase().includes(k);
      const matchC = !params?.category || t.category === params.category;
      return matchK && matchC;
    });
    return {
      items: filtered,
      total: filtered.length,
      page: 1,
      pageSize: filtered.length,
      totalPages: filtered.length === 0 ? 0 : 1,
    };
  }
}

export async function getTool(id: string): Promise<McpTool> {
  try {
    return await get<McpTool>(`/v1/mcp/tools/${id}`);
  } catch {
    const tool = load().find((t) => t.id === id);
    if (!tool) throw new Error('工具不存在');
    return tool;
  }
}

export async function createTool(req: McpToolCreateRequest): Promise<McpTool> {
  try {
    return await post<McpTool>('/v1/mcp/tools', req);
  } catch {
    const items = load();
    if (items.some((t) => t.code === req.code)) throw new Error('工具编码已存在');
    const created: McpTool = {
      id: generateId(),
      ...req,
      version: '1.0.0',
      createdAt: now(),
      updatedAt: now(),
    };
    save([...items, created]);
    return created;
  }
}

export async function updateTool(id: string, req: McpToolCreateRequest): Promise<McpTool> {
  try {
    return await put<McpTool>(`/v1/mcp/tools/${id}`, req);
  } catch {
    const items = load();
    const idx = items.findIndex((t) => t.id === id);
    if (idx === -1) throw new Error('工具不存在');
    const updated: McpTool = { ...items[idx], ...req, updatedAt: now() };
    items[idx] = updated;
    save(items);
    return updated;
  }
}

export async function deleteTool(id: string): Promise<void> {
  try {
    await del(`/v1/mcp/tools/${id}`);
  } catch {
    const items = load().filter((t) => t.id !== id);
    save(items);
  }
}

export async function listCategories(): Promise<string[]> {
  const set = new Set<string>();
  load().forEach((t) => set.add(t.category));
  return Array.from(set);
}

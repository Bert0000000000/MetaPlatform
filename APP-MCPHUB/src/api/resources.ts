import { get, post, put, del } from './client';
import type { McpResource, McpResourceCreateRequest, PageResponse } from '@/types';

const STORAGE_KEY = 'mcphub_resources';

function load(): McpResource[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as McpResource[];
  } catch {
    return [];
  }
}

function save(items: McpResource[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function now(): string {
  return new Date().toISOString();
}

function generateId(): string {
  return `res_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export async function listResources(params?: { keyword?: string }): Promise<PageResponse<McpResource>> {
  try {
    return await get<PageResponse<McpResource>>('/v1/mcp/resources', params);
  } catch {
    const items = load();
    const k = params?.keyword?.toLowerCase() ?? '';
    const filtered = items.filter(
      (r) => !k || r.name.toLowerCase().includes(k) || r.uri.toLowerCase().includes(k),
    );
    return {
      items: filtered,
      total: filtered.length,
      page: 1,
      pageSize: filtered.length,
      totalPages: filtered.length === 0 ? 0 : 1,
    };
  }
}

export async function getResource(id: string): Promise<McpResource> {
  try {
    return await get<McpResource>(`/v1/mcp/resources/${id}`);
  } catch {
    const item = load().find((r) => r.id === id);
    if (!item) throw new Error('资源不存在');
    return item;
  }
}

export async function createResource(req: McpResourceCreateRequest): Promise<McpResource> {
  try {
    return await post<McpResource>('/v1/mcp/resources', req);
  } catch {
    const items = load();
    const created: McpResource = {
      id: generateId(),
      ...req,
      createdAt: now(),
      updatedAt: now(),
    };
    save([...items, created]);
    return created;
  }
}

export async function updateResource(
  id: string,
  req: McpResourceCreateRequest,
): Promise<McpResource> {
  try {
    return await put<McpResource>(`/v1/mcp/resources/${id}`, req);
  } catch {
    const items = load();
    const idx = items.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error('资源不存在');
    const updated: McpResource = { ...items[idx], ...req, updatedAt: now() };
    items[idx] = updated;
    save(items);
    return updated;
  }
}

export async function deleteResource(id: string): Promise<void> {
  try {
    await del(`/v1/mcp/resources/${id}`);
  } catch {
    save(load().filter((r) => r.id !== id));
  }
}

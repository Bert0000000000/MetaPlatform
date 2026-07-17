import { get, post, put, del } from './client';
import type { McpServer, McpServerCreateRequest, PageResponse } from '@/types';

const STORAGE_KEY = 'mcphub_servers';

function load(): McpServer[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as McpServer[];
  } catch {
    return [];
  }
}

function save(items: McpServer[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function now(): string {
  return new Date().toISOString();
}

function generateId(): string {
  return `server_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export async function listServers(params?: { keyword?: string }): Promise<PageResponse<McpServer>> {
  try {
    return await get<PageResponse<McpServer>>('/v1/mcp/servers', params);
  } catch {
    const items = load();
    const k = params?.keyword?.toLowerCase() ?? '';
    const filtered = items.filter(
      (s) => !k || s.name.toLowerCase().includes(k) || s.code.toLowerCase().includes(k),
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

export async function getServer(id: string): Promise<McpServer> {
  try {
    return await get<McpServer>(`/v1/mcp/servers/${id}`);
  } catch {
    const item = load().find((s) => s.id === id);
    if (!item) throw new Error('Server 不存在');
    return item;
  }
}

export async function createServer(req: McpServerCreateRequest): Promise<McpServer> {
  try {
    return await post<McpServer>('/v1/mcp/servers', req);
  } catch {
    const items = load();
    if (items.some((s) => s.code === req.code)) throw new Error('Server 编码已存在');
    const created: McpServer = {
      id: generateId(),
      ...req,
      status: 'offline',
      createdAt: now(),
      updatedAt: now(),
    };
    save([...items, created]);
    return created;
  }
}

export async function updateServer(id: string, req: McpServerCreateRequest): Promise<McpServer> {
  try {
    return await put<McpServer>(`/v1/mcp/servers/${id}`, req);
  } catch {
    const items = load();
    const idx = items.findIndex((s) => s.id === id);
    if (idx === -1) throw new Error('Server 不存在');
    const updated: McpServer = { ...items[idx], ...req, updatedAt: now() };
    items[idx] = updated;
    save(items);
    return updated;
  }
}

export async function deleteServer(id: string): Promise<void> {
  try {
    await del(`/v1/mcp/servers/${id}`);
  } catch {
    save(load().filter((s) => s.id !== id));
  }
}

export async function startServer(id: string): Promise<McpServer> {
  const items = load();
  const idx = items.findIndex((s) => s.id === id);
  if (idx === -1) throw new Error('Server 不存在');
  const updated: McpServer = { ...items[idx], status: 'online', updatedAt: now() };
  items[idx] = updated;
  save(items);
  return updated;
}

export async function stopServer(id: string): Promise<McpServer> {
  const items = load();
  const idx = items.findIndex((s) => s.id === id);
  if (idx === -1) throw new Error('Server 不存在');
  const updated: McpServer = { ...items[idx], status: 'offline', updatedAt: now() };
  items[idx] = updated;
  save(items);
  return updated;
}

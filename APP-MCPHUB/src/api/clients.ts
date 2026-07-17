import { get, post, put, del } from './client';
import type { McpClient, McpClientCreateRequest, PageResponse } from '@/types';

const STORAGE_KEY = 'mcphub_clients';

function load(): McpClient[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as McpClient[];
  } catch {
    return [];
  }
}

function save(items: McpClient[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function now(): string {
  return new Date().toISOString();
}

function generateId(): string {
  return `client_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export async function listClients(): Promise<PageResponse<McpClient>> {
  try {
    return await get<PageResponse<McpClient>>('/v1/mcp/clients');
  } catch {
    const items = load();
    return {
      items,
      total: items.length,
      page: 1,
      pageSize: items.length,
      totalPages: items.length === 0 ? 0 : 1,
    };
  }
}

export async function getClient(id: string): Promise<McpClient> {
  try {
    return await get<McpClient>(`/v1/mcp/clients/${id}`);
  } catch {
    const item = load().find((c) => c.id === id);
    if (!item) throw new Error('Client 不存在');
    return item;
  }
}

export async function createClient(req: McpClientCreateRequest): Promise<McpClient> {
  try {
    return await post<McpClient>('/v1/mcp/clients', req);
  } catch {
    const items = load();
    const created: McpClient = {
      id: generateId(),
      ...req,
      status: 'disconnected',
      discoveredTools: 0,
      createdAt: now(),
    };
    save([...items, created]);
    return created;
  }
}

export async function updateClient(id: string, req: McpClientCreateRequest): Promise<McpClient> {
  try {
    return await put<McpClient>(`/v1/mcp/clients/${id}`, req);
  } catch {
    const items = load();
    const idx = items.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error('Client 不存在');
    const updated: McpClient = { ...items[idx], ...req };
    items[idx] = updated;
    save(items);
    return updated;
  }
}

export async function deleteClient(id: string): Promise<void> {
  try {
    await del(`/v1/mcp/clients/${id}`);
  } catch {
    save(load().filter((c) => c.id !== id));
  }
}

export async function syncClient(id: string): Promise<McpClient> {
  const items = load();
  const idx = items.findIndex((c) => c.id === id);
  if (idx === -1) throw new Error('Client 不存在');
  const updated: McpClient = {
    ...items[idx],
    status: 'connected',
    discoveredTools: Math.floor(Math.random() * 30) + 1,
    lastSyncAt: now(),
  };
  items[idx] = updated;
  save(items);
  return updated;
}

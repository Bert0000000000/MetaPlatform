import { get, post, put, del } from './client';
import type { ApiKey, Integration, IntegrationCreateRequest } from '@/types';

const KEY_STORAGE = 'mcphub_api_keys';
const INT_STORAGE = 'mcphub_integrations';

function loadKeys(): ApiKey[] {
  const raw = localStorage.getItem(KEY_STORAGE);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as ApiKey[];
  } catch {
    return [];
  }
}

function saveKeys(items: ApiKey[]): void {
  localStorage.setItem(KEY_STORAGE, JSON.stringify(items));
}

function loadIntegrations(): Integration[] {
  const raw = localStorage.getItem(INT_STORAGE);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Integration[];
  } catch {
    return [];
  }
}

function saveIntegrations(items: Integration[]): void {
  localStorage.setItem(INT_STORAGE, JSON.stringify(items));
}

function now(): string {
  return new Date().toISOString();
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function randomKey(): string {
  return Array.from({ length: 32 })
    .map(() => Math.random().toString(36).charAt(2))
    .join('');
}

export async function listApiKeys(): Promise<ApiKey[]> {
  try {
    return await get<ApiKey[]>('/v1/mcp/api-keys');
  } catch {
    return loadKeys();
  }
}

export async function createApiKey(name: string, scopes: string[]): Promise<ApiKey> {
  try {
    return await post<ApiKey>('/v1/mcp/api-keys', { name, scopes });
  } catch {
    const key = randomKey();
    const created: ApiKey = {
      id: generateId('key'),
      name,
      key: `mcp_${key}`,
      prefix: `mcp_${key.slice(0, 8)}`,
      scopes,
      createdAt: now(),
      enabled: true,
    };
    saveKeys([...loadKeys(), created]);
    return created;
  }
}

export async function deleteApiKey(id: string): Promise<void> {
  try {
    await del(`/v1/mcp/api-keys/${id}`);
  } catch {
    saveKeys(loadKeys().filter((k) => k.id !== id));
  }
}

export async function listIntegrations(): Promise<Integration[]> {
  try {
    return await get<Integration[]>('/v1/mcp/integrations');
  } catch {
    return loadIntegrations();
  }
}

export async function createIntegration(req: IntegrationCreateRequest): Promise<Integration> {
  try {
    return await post<Integration>('/v1/mcp/integrations', req);
  } catch {
    const created: Integration = {
      id: generateId('int'),
      ...req,
      createdAt: now(),
    };
    saveIntegrations([...loadIntegrations(), created]);
    return created;
  }
}

export async function updateIntegration(
  id: string,
  req: IntegrationCreateRequest,
): Promise<Integration> {
  try {
    return await put<Integration>(`/v1/mcp/integrations/${id}`, req);
  } catch {
    const items = loadIntegrations();
    const idx = items.findIndex((i) => i.id === id);
    if (idx === -1) throw new Error('集成不存在');
    const updated: Integration = { ...items[idx], ...req };
    items[idx] = updated;
    saveIntegrations(items);
    return updated;
  }
}

export async function deleteIntegration(id: string): Promise<void> {
  try {
    await del(`/v1/mcp/integrations/${id}`);
  } catch {
    saveIntegrations(loadIntegrations().filter((i) => i.id !== id));
  }
}

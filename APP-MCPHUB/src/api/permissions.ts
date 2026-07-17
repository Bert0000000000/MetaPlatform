import { get, post, put, del } from './client';
import type { PermissionRule, PermissionRuleCreateRequest, PageResponse } from '@/types';

const STORAGE_KEY = 'mcphub_permissions';

function load(): PermissionRule[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as PermissionRule[];
  } catch {
    return [];
  }
}

function save(items: PermissionRule[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function now(): string {
  return new Date().toISOString();
}

function generateId(): string {
  return `perm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export async function listRules(): Promise<PageResponse<PermissionRule>> {
  try {
    return await get<PageResponse<PermissionRule>>('/v1/mcp/permissions');
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

export async function createRule(req: PermissionRuleCreateRequest): Promise<PermissionRule> {
  try {
    return await post<PermissionRule>('/v1/mcp/permissions', req);
  } catch {
    const items = load();
    const created: PermissionRule = {
      id: generateId(),
      ...req,
      createdAt: now(),
      updatedAt: now(),
    };
    save([...items, created]);
    return created;
  }
}

export async function updateRule(
  id: string,
  req: PermissionRuleCreateRequest,
): Promise<PermissionRule> {
  try {
    return await put<PermissionRule>(`/v1/mcp/permissions/${id}`, req);
  } catch {
    const items = load();
    const idx = items.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error('规则不存在');
    const updated: PermissionRule = { ...items[idx], ...req, updatedAt: now() };
    items[idx] = updated;
    save(items);
    return updated;
  }
}

export async function deleteRule(id: string): Promise<void> {
  try {
    await del(`/v1/mcp/permissions/${id}`);
  } catch {
    save(load().filter((r) => r.id !== id));
  }
}

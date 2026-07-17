import { get, post, put, del } from './client';
import type { PageResponse } from '@/types';

export interface ActionStep {
  id: string;
  type: 'input' | 'output' | 'transform' | 'condition' | 'loop' | 'sub-action';
  name: string;
  config: Record<string, unknown>;
  next?: string[];
}

export interface ActionDefinition {
  actionId: string;
  code: string;
  name: string;
  description?: string;
  category: string;
  inputSchema: Array<{ name: string; type: string; required: boolean; description?: string }>;
  outputSchema: Array<{ name: string; type: string; description?: string }>;
  steps: ActionStep[];
  enabled: boolean;
  version: string;
  createdAt: string;
}

const STORAGE_KEY = 'ontstudio_actions';

function load(): ActionDefinition[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as ActionDefinition[];
  } catch {
    return [];
  }
}

function save(items: ActionDefinition[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function now(): string {
  return new Date().toISOString();
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export async function listActions(): Promise<PageResponse<ActionDefinition>> {
  try {
    return await get<PageResponse<ActionDefinition>>('/v1/actions');
  } catch {
    const items = load();
    return {
      items,
      total: items.length,
      page: 1,
      pageSize: items.length,
      totalPages: 1,
    };
  }
}

export async function createAction(req: Omit<ActionDefinition, 'actionId' | 'createdAt' | 'version'>): Promise<ActionDefinition> {
  try {
    return await post<ActionDefinition>('/v1/actions', req);
  } catch {
    const items = load();
    if (items.some((a) => a.code === req.code)) throw new Error('Action 编码已存在');
    const created: ActionDefinition = {
      actionId: generateId('act'),
      ...req,
      version: '1.0.0',
      createdAt: now(),
    };
    save([...items, created]);
    return created;
  }
}

export async function updateAction(id: string, req: Partial<ActionDefinition>): Promise<ActionDefinition> {
  try {
    return await put<ActionDefinition>(`/v1/actions/${id}`, req);
  } catch {
    const items = load();
    const idx = items.findIndex((a) => a.actionId === id);
    if (idx === -1) throw new Error('Action 不存在');
    items[idx] = { ...items[idx]!, ...req };
    save(items);
    return items[idx]!;
  }
}

export async function deleteAction(id: string): Promise<void> {
  try {
    await del(`/v1/actions/${id}`);
  } catch {
    save(load().filter((a) => a.actionId !== id));
  }
}

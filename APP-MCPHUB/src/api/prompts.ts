import { get, post, put, del } from './client';
import type { PromptTemplate, PromptTemplateCreateRequest, PageResponse } from '@/types';

const STORAGE_KEY = 'mcphub_prompts';

function load(): PromptTemplate[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as PromptTemplate[];
  } catch {
    return [];
  }
}

function save(items: PromptTemplate[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function now(): string {
  return new Date().toISOString();
}

function generateId(): string {
  return `prompt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export async function listPrompts(params?: { keyword?: string }): Promise<PageResponse<PromptTemplate>> {
  try {
    return await get<PageResponse<PromptTemplate>>('/v1/mcp/prompts', params);
  } catch {
    const items = load();
    const k = params?.keyword?.toLowerCase() ?? '';
    const filtered = items.filter(
      (p) => !k || p.name.toLowerCase().includes(k) || p.category.toLowerCase().includes(k),
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

export async function getPrompt(id: string): Promise<PromptTemplate> {
  try {
    return await get<PromptTemplate>(`/v1/mcp/prompts/${id}`);
  } catch {
    const item = load().find((p) => p.id === id);
    if (!item) throw new Error('模板不存在');
    return item;
  }
}

export async function createPrompt(req: PromptTemplateCreateRequest): Promise<PromptTemplate> {
  try {
    return await post<PromptTemplate>('/v1/mcp/prompts', req);
  } catch {
    const items = load();
    const created: PromptTemplate = {
      id: generateId(),
      ...req,
      createdAt: now(),
      updatedAt: now(),
    };
    save([...items, created]);
    return created;
  }
}

export async function updatePrompt(
  id: string,
  req: PromptTemplateCreateRequest,
): Promise<PromptTemplate> {
  try {
    return await put<PromptTemplate>(`/v1/mcp/prompts/${id}`, req);
  } catch {
    const items = load();
    const idx = items.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error('模板不存在');
    const updated: PromptTemplate = { ...items[idx], ...req, updatedAt: now() };
    items[idx] = updated;
    save(items);
    return updated;
  }
}

export async function deletePrompt(id: string): Promise<void> {
  try {
    await del(`/v1/mcp/prompts/${id}`);
  } catch {
    save(load().filter((p) => p.id !== id));
  }
}

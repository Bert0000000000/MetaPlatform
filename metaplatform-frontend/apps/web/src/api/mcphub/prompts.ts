import { createApiClient, apiPath } from '@mate/shared/api';

const client = createApiClient({ baseURL: apiPath('mcp', '') });
const data = <T>(resp: { data: T }): T => resp.data;
async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> { return data(await client.get<T>(url, params ? { params } : undefined)); }
async function post<T>(url: string, body?: unknown): Promise<T> { return data(await client.post<T>(url, body)); }
async function put<T>(url: string, body?: unknown): Promise<T> { return data(await client.put<T>(url, body)); }
async function del<T>(url: string): Promise<T> { return data(await client.delete<T>(url)); }

import type { PromptTemplate, PromptTemplateCreateRequest, PromptVariable, PageResponse } from './types';

/** 后端 /prompts 返回 {prompts:[...]} 且字段为 arguments/role，包装成前端结构 */
function normalizePrompt(p: Partial<PromptTemplate> & { arguments?: unknown[] }): PromptTemplate {
  const variables: PromptVariable[] = Array.isArray((p as { variables?: PromptVariable[] }).variables)
    ? (p as { variables: PromptVariable[] }).variables
    : Array.isArray(p.arguments)
      ? (p.arguments as Array<{ name?: string; required?: boolean; description?: string }>).map((a) => ({
          name: a.name ?? '',
          required: a.required ?? false,
          description: a.description,
        }))
      : [];
  return {
    id: p.id ?? p.name ?? '',
    name: p.name ?? '',
    description: p.description,
    role: p.role ?? 'assistant',
    template: p.template ?? '',
    variables,
    category: p.category ?? 'general',
    tags: p.tags,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

/** 后端 /prompts 返回 {prompts:[...]}，包装成前端 PageResponse 结构 */
function toPage(raw: { prompts?: PromptTemplate[]; items?: PromptTemplate[] } | null): PageResponse<PromptTemplate> {
  const items = (raw?.items ?? raw?.prompts ?? []).map(normalizePrompt);
  return { items, total: items.length, page: 1, size: items.length || 1, totalPages: 1 };
}

export async function listPrompts(params?: { keyword?: string }): Promise<PageResponse<PromptTemplate>> {
  return toPage(await get<{ prompts?: PromptTemplate[]; items?: PromptTemplate[] }>('/prompts', params));
}
export async function getPrompt(id: string): Promise<PromptTemplate> {
  return get<PromptTemplate>(`/prompts/${id}`);
}
export async function createPrompt(req: PromptTemplateCreateRequest): Promise<PromptTemplate> {
  return post<PromptTemplate>('/prompts', req);
}
export async function updatePrompt(
  id: string,
  req: PromptTemplateCreateRequest,
): Promise<PromptTemplate> {
  return put<PromptTemplate>(`/prompts/${id}`, req);
}
export async function deletePrompt(id: string): Promise<void> {
  await del(`/prompts/${id}`);
}

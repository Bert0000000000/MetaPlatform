import { createApiClient, apiPath } from '@mate/shared/api';

const client = createApiClient({ baseURL: apiPath('mcp', '') });
const data = <T>(resp: { data: T }): T => resp.data;
async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> { return data(await client.get<T>(url, params ? { params } : undefined)); }
async function post<T>(url: string, body?: unknown): Promise<T> { return data(await client.post<T>(url, body)); }
async function put<T>(url: string, body?: unknown): Promise<T> { return data(await client.put<T>(url, body)); }
async function del<T>(url: string): Promise<T> { return data(await client.delete<T>(url)); }

import type { PromptTemplate, PromptTemplateCreateRequest, PageResponse } from './types';

export async function listPrompts(params?: { keyword?: string }): Promise<PageResponse<PromptTemplate>> {
  return get<PageResponse<PromptTemplate>>('/prompts', params);
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

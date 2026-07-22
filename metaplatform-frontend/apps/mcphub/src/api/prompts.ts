import { get, post, put, del } from './client';
import type { PromptTemplate, PromptTemplateCreateRequest, PageResponse } from '@/types';

export async function listPrompts(params?: { keyword?: string }): Promise<PageResponse<PromptTemplate>> {
  return get<PageResponse<PromptTemplate>>('/v1/mcp/prompts', params);
}

export async function getPrompt(id: string): Promise<PromptTemplate> {
  return get<PromptTemplate>(`/v1/mcp/prompts/${id}`);
}

export async function createPrompt(req: PromptTemplateCreateRequest): Promise<PromptTemplate> {
  return post<PromptTemplate>('/v1/mcp/prompts', req);
}

export async function updatePrompt(
  id: string,
  req: PromptTemplateCreateRequest,
): Promise<PromptTemplate> {
  return put<PromptTemplate>(`/v1/mcp/prompts/${id}`, req);
}

export async function deletePrompt(id: string): Promise<void> {
  await del(`/v1/mcp/prompts/${id}`);
}

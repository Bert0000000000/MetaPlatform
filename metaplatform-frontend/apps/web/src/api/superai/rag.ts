import { createApiClient, apiPath } from '@mate/shared/api';

const client = createApiClient({ baseURL: apiPath('copilot', '') });
const data = <T>(resp: { data: T }): T => resp.data;
async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> { return data(await client.get<T>(url, params ? { params } : undefined)); }
async function post<T>(url: string, body?: unknown): Promise<T> { return data(await client.post<T>(url, body)); }
async function put<T>(url: string, body?: unknown): Promise<T> { return data(await client.put<T>(url, body)); }
async function del<T>(url: string): Promise<T> { return data(await client.delete<T>(url)); }

import type { KnowledgeBase, RagSearchResult } from './types';
export async function listKnowledgeBases(): Promise<KnowledgeBase[]> {
  const page = await get<{ items: KnowledgeBase[]; total: number }>('/knowledge-bases');
  return page?.items ?? [];
}
export async function search(
  query: string,
  knowledgeBaseIds?: string[],
): Promise<RagSearchResult[]> {
  return post<RagSearchResult[]>('/search', { query, knowledgeBaseIds });
}

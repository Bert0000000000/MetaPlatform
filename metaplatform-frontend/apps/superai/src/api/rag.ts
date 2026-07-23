import { get, post } from './client';
import type { KnowledgeBase, RagSearchResult } from '@/types';

export async function listKnowledgeBases(): Promise<KnowledgeBase[]> {
  const page = await get<{ items: KnowledgeBase[]; total: number }>('/v1/copilot/knowledge-bases');
  return page?.items ?? [];
}

export async function search(
  query: string,
  knowledgeBaseIds?: string[],
): Promise<RagSearchResult[]> {
  return post<RagSearchResult[]>('/v1/copilot/search', { query, knowledgeBaseIds });
}

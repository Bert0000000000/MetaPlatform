import { get, post } from './client';
import type { KnowledgeBase, RagSearchResult } from '@/types';

export async function listKnowledgeBases(): Promise<KnowledgeBase[]> {
  const page = await get<{ items: KnowledgeBase[]; total: number }>('/v1/rag/knowledge-bases');
  return page?.items ?? [];
}

export async function search(
  query: string,
  knowledgeBaseIds?: string[],
): Promise<RagSearchResult[]> {
  return post<RagSearchResult[]>('/v1/rag/search', { query, knowledgeBaseIds });
}

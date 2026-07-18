import { get, post } from './client';
import type { KnowledgeBase, RagSearchResult } from '@/types';

export async function listKnowledgeBases(): Promise<KnowledgeBase[]> {
  return get<KnowledgeBase[]>('/v1/rag/knowledge-bases');
}

export async function search(
  query: string,
  knowledgeBaseIds?: string[],
): Promise<RagSearchResult[]> {
  return post<RagSearchResult[]>('/v1/rag/search', { query, knowledgeBaseIds });
}

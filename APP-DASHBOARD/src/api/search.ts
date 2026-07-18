import { get } from './client';
import type { SearchResult } from '@/types';

export async function globalSearch(keyword: string): Promise<SearchResult[]> {
  if (!keyword.trim()) return [];
  return get<SearchResult[]>('/v1/search/global', { keyword });
}

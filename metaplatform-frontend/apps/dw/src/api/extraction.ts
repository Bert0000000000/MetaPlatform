import { post, get, put } from './client';
import type { ExtractionItem, ExtractionResult, ExtractionType, ExtractionStatus } from '@/types';

export async function extractFromDocument(
  documentId: string,
  employeeId: string,
): Promise<ExtractionResult> {
  return post<ExtractionResult>('/v1/ont/extract', { documentId, employeeId });
}

export async function getExtractionResults(documentId: string): Promise<ExtractionResult> {
  return get<ExtractionResult>(`/v1/ont/extract/${documentId}`);
}

export async function reviewExtractionItem(
  itemId: string,
  status: 'approved' | 'rejected',
): Promise<ExtractionItem> {
  return put<ExtractionItem>(`/v1/ont/extract/items/${itemId}`, { status });
}

export async function batchReview(
  itemIds: string[],
  status: 'approved' | 'rejected',
): Promise<ExtractionItem[]> {
  const results: ExtractionItem[] = [];
  for (const id of itemIds) {
    results.push(await reviewExtractionItem(id, status));
  }
  return results;
}

export async function commitToOntology(itemIds: string[]): Promise<ExtractionItem[]> {
  return post<ExtractionItem[]>('/v1/ont/commit', { itemIds });
}

export async function getExtractionsByEmployee(
  employeeId: string,
  typeFilter?: ExtractionType,
  statusFilter?: ExtractionStatus,
): Promise<ExtractionItem[]> {
  const params: Record<string, unknown> = { employeeId };
  if (typeFilter) params.type = typeFilter;
  if (statusFilter) params.status = statusFilter;
  return get<ExtractionItem[]>('/v1/ont/extract', params);
}

import { get, post, put, del } from './client';
import type { ValueStream, PageResponse } from '@/types';

export async function listValueStreams(): Promise<PageResponse<ValueStream>> {
  return get<PageResponse<ValueStream>>('/v1/ea/value-streams');
}

export async function createValueStream(req: Partial<ValueStream>): Promise<ValueStream> {
  return post<ValueStream>('/v1/ea/value-streams', req);
}

export async function updateValueStream(id: string, req: Partial<ValueStream>): Promise<ValueStream> {
  return put<ValueStream>(`/v1/ea/value-streams/${id}`, req);
}

export async function deleteValueStream(id: string): Promise<void> {
  await del<void>(`/v1/ea/value-streams/${id}`);
}

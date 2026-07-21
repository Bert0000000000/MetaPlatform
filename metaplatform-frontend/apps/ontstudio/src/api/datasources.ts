import { get, post, del } from './client';
import type { PageResponse } from '@/types';

export interface DataSource {
  id: string;
  name: string;
  type: 'mysql' | 'postgresql' | 'oracle' | 'api' | 'csv';
  connectionConfig: Record<string, unknown>;
  tables: string[];
  enabled: boolean;
  createdAt: string;
}

const BASE = '/v1/data/datasources';

export async function listDataSources(): Promise<PageResponse<DataSource>> {
  return get<PageResponse<DataSource>>(BASE);
}

export async function createDataSource(req: Omit<DataSource, 'id' | 'createdAt' | 'tables'>): Promise<DataSource> {
  return post<DataSource>(BASE, req);
}

export async function testConnection(req: Omit<DataSource, 'id' | 'createdAt' | 'tables'>): Promise<{ ok: boolean; message: string; tables?: string[] }> {
  return post<{ ok: boolean; message: string; tables?: string[] }>(`${BASE}/test`, req);
}

export async function deleteDataSource(id: string): Promise<void> {
  await del<void>(`${BASE}/${id}`);
}

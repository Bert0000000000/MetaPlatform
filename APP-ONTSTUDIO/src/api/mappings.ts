import { get, post, del } from './client';
import type { PageResponse } from '@/types';

export interface FieldMapping {
  sourceField: string;
  sourceType: string;
  targetAttribute: string;
  targetType: string;
  transform?: string;
}

export interface DataMapping {
  mappingId: string;
  name: string;
  datasourceId: string;
  sourceTable: string;
  conceptId: string;
  fieldMappings: FieldMapping[];
  schedule?: string;
  enabled: boolean;
  createdAt: string;
}

const BASE = '/v1/data/mappings';

export async function listMappings(): Promise<PageResponse<DataMapping>> {
  return get<PageResponse<DataMapping>>(BASE);
}

export async function createMapping(req: Omit<DataMapping, 'mappingId' | 'createdAt'>): Promise<DataMapping> {
  return post<DataMapping>(BASE, req);
}

export async function runMapping(id: string): Promise<{ ok: boolean; rowsAffected: number }> {
  return post<{ ok: boolean; rowsAffected: number }>(`${BASE}/${id}/run`);
}

export async function deleteMapping(id: string): Promise<void> {
  await del<void>(`${BASE}/${id}`);
}

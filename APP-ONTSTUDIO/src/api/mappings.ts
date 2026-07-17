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

const STORAGE_KEY = 'ontstudio_mappings';

function load(): DataMapping[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as DataMapping[];
  } catch {
    return [];
  }
}

function save(items: DataMapping[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function now(): string {
  return new Date().toISOString();
}

function generateId(): string {
  return `map_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export async function listMappings(): Promise<PageResponse<DataMapping>> {
  try {
    return await get<PageResponse<DataMapping>>('/v1/mappings');
  } catch {
    const items = load();
    return {
      items,
      total: items.length,
      page: 1,
      pageSize: items.length,
      totalPages: 1,
    };
  }
}

export async function createMapping(req: Omit<DataMapping, 'mappingId' | 'createdAt'>): Promise<DataMapping> {
  try {
    return await post<DataMapping>('/v1/mappings', req);
  } catch {
    const items = load();
    const created: DataMapping = {
      mappingId: generateId(),
      ...req,
      createdAt: now(),
    };
    save([...items, created]);
    return created;
  }
}

export async function runMapping(_id: string): Promise<{ ok: boolean; rowsAffected: number }> {
  await new Promise((r) => setTimeout(r, 1000));
  return { ok: true, rowsAffected: Math.floor(Math.random() * 1000) };
}

export async function deleteMapping(id: string): Promise<void> {
  try {
    await del(`/v1/mappings/${id}`);
  } catch {
    save(load().filter((m) => m.mappingId !== id));
  }
}

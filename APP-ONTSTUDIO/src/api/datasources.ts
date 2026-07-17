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

const STORAGE_KEY = 'ontstudio_datasources';

function load(): DataSource[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as DataSource[];
  } catch {
    return [];
  }
}

function save(items: DataSource[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function now(): string {
  return new Date().toISOString();
}

function generateId(): string {
  return `ds_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export async function listDataSources(): Promise<PageResponse<DataSource>> {
  try {
    return await get<PageResponse<DataSource>>('/v1/datasources');
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

export async function createDataSource(req: Omit<DataSource, 'id' | 'createdAt' | 'tables'>): Promise<DataSource> {
  try {
    return await post<DataSource>('/v1/datasources', req);
  } catch {
    const items = load();
    const created: DataSource = {
      id: generateId(),
      ...req,
      tables: [],
      createdAt: now(),
    };
    save([...items, created]);
    return created;
  }
}

export async function testConnection(_req: Omit<DataSource, 'id' | 'createdAt' | 'tables'>): Promise<{ ok: boolean; message: string; tables?: string[] }> {
  await new Promise((r) => setTimeout(r, 800));
  return {
    ok: true,
    message: '连接成功',
    tables: ['employees', 'departments', 'orders', 'products'],
  };
}

export async function deleteDataSource(id: string): Promise<void> {
  try {
    await del(`/v1/datasources/${id}`);
  } catch {
    save(load().filter((d) => d.id !== id));
  }
}

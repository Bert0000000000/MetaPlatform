import { get, post, put, del } from './client';
import type { PageResponse } from '@/types';

export interface RelationType {
  relationTypeId: string;
  tenantId: string;
  code: string;
  name: string;
  sourceConcept: string;
  targetConcept: string;
  cardinality: '1-1' | '1-N' | 'N-1' | 'N-N';
  description?: string;
  properties?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface RelationInstance {
  relationInstanceId: string;
  relationTypeId: string;
  sourceEntityId: string;
  targetEntityId: string;
  attributes?: Record<string, unknown>;
  createdAt?: string;
}

const STORAGE_KEY = 'ontstudio_relations';

function load(): RelationType[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as RelationType[];
  } catch {
    return [];
  }
}

function save(items: RelationType[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function now(): string {
  return new Date().toISOString();
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export async function listRelationTypes(): Promise<PageResponse<RelationType>> {
  try {
    return await get<PageResponse<RelationType>>('/v1/ont/relations/types');
  } catch {
    return {
      items: load(),
      total: load().length,
      page: 1,
      pageSize: load().length,
      totalPages: 1,
    };
  }
}

export async function createRelationType(req: Omit<RelationType, 'relationTypeId' | 'tenantId' | 'createdAt' | 'updatedAt'>): Promise<RelationType> {
  try {
    return await post<RelationType>('/v1/ont/relations/types', req);
  } catch {
    const items = load();
    if (items.some((r) => r.code === req.code)) throw new Error('关系类型编码已存在');
    const created: RelationType = {
      relationTypeId: generateId('rel'),
      tenantId: 'default',
      ...req,
      createdAt: now(),
      updatedAt: now(),
    };
    save([...items, created]);
    return created;
  }
}

export async function updateRelationType(id: string, req: Omit<RelationType, 'relationTypeId' | 'tenantId' | 'createdAt' | 'updatedAt'>): Promise<RelationType> {
  try {
    return await put<RelationType>(`/v1/ont/relations/types/${id}`, req);
  } catch {
    const items = load();
    const idx = items.findIndex((r) => r.relationTypeId === id);
    if (idx === -1) throw new Error('关系类型不存在');
    items[idx] = { ...items[idx]!, ...req, updatedAt: now() };
    save(items);
    return items[idx]!;
  }
}

export async function deleteRelationType(id: string): Promise<void> {
  try {
    await del(`/v1/ont/relations/types/${id}`);
  } catch {
    save(load().filter((r) => r.relationTypeId !== id));
  }
}

export async function listRelationInstances(): Promise<RelationInstance[]> {
  const raw = localStorage.getItem('ontstudio_relation_instances');
  if (!raw) return [];
  try {
    return JSON.parse(raw) as RelationInstance[];
  } catch {
    return [];
  }
}

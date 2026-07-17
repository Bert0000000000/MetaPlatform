import { get, post, put, del } from './client';
import type { PageResponse } from '@/types';

export type CollabStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface CollaborationTask {
  collaborationId: string;
  title: string;
  description?: string;
  splitStrategy: 'sequential' | 'parallel' | 'hybrid';
  subtasks: Array<{
    id: string;
    employeeId: string;
    title: string;
    status: CollabStatus;
    progress: number;
    result?: string;
  }>;
  status: CollabStatus;
  createdBy: string;
  createdAt: string;
  completedAt?: string;
  finalReport?: string;
}

const STORAGE_KEY = 'app_dw_collaborations';

function load(): CollaborationTask[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as CollaborationTask[];
  } catch {
    return [];
  }
}

function save(items: CollaborationTask[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function now(): string {
  return new Date().toISOString();
}

function generateId(): string {
  return `collab_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export async function listCollaborations(): Promise<CollaborationTask[]> {
  try {
    return await get<CollaborationTask[]>('/v1/agent/collaborations');
  } catch {
    return load();
  }
}

export async function createCollaboration(req: Omit<CollaborationTask, 'collaborationId' | 'createdAt' | 'status'>): Promise<CollaborationTask> {
  try {
    return await post<CollaborationTask>('/v1/agent/collaborations', req);
  } catch {
    const items = load();
    const created: CollaborationTask = {
      collaborationId: generateId(),
      ...req,
      status: 'pending',
      createdAt: now(),
    };
    save([created, ...items]);
    return created;
  }
}

export async function getCollaboration(id: string): Promise<CollaborationTask> {
  try {
    return await get<CollaborationTask>(`/v1/agent/collaborations/${id}`);
  } catch {
    const c = load().find((x) => x.collaborationId === id);
    if (!c) throw new Error('协作任务不存在');
    return c;
  }
}

export async function updateCollaboration(c: CollaborationTask): Promise<CollaborationTask> {
  try {
    return await put<CollaborationTask>(`/v1/agent/collaborations/${c.collaborationId}`, c);
  } catch {
    const items = load();
    const idx = items.findIndex((x) => x.collaborationId === c.collaborationId);
    if (idx === -1) throw new Error('协作任务不存在');
    items[idx] = c;
    save(items);
    return c;
  }
}

export async function deleteCollaboration(id: string): Promise<void> {
  try {
    await del(`/v1/agent/collaborations/${id}`);
  } catch {
    save(load().filter((c) => c.collaborationId !== id));
  }
}

export async function aggregateResult(id: string): Promise<{ success: boolean; report: string }> {
  await new Promise((r) => setTimeout(r, 800));
  return {
    success: true,
    report: `聚合报告 #${id}\n\n1. 子任务 A: 完成查询 (耗时 3s)\n2. 子任务 B: 完成分析 (耗时 5s)\n3. 子任务 C: 完成汇总 (耗时 2s)\n\n最终结论：建议采纳。`,
  };
}

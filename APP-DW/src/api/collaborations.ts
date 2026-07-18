import { get, post, put, del } from './client';

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

export async function listCollaborations(): Promise<CollaborationTask[]> {
  return get<CollaborationTask[]>('/v1/agent/collaborations');
}

export async function createCollaboration(req: Omit<CollaborationTask, 'collaborationId' | 'createdAt' | 'status'>): Promise<CollaborationTask> {
  return post<CollaborationTask>('/v1/agent/collaborations', req);
}

export async function getCollaboration(id: string): Promise<CollaborationTask> {
  return get<CollaborationTask>(`/v1/agent/collaborations/${id}`);
}

export async function updateCollaboration(c: CollaborationTask): Promise<CollaborationTask> {
  return put<CollaborationTask>(`/v1/agent/collaborations/${c.collaborationId}`, c);
}

export async function deleteCollaboration(id: string): Promise<void> {
  return del<void>(`/v1/agent/collaborations/${id}`);
}

export async function aggregateResult(id: string): Promise<{ success: boolean; report: string }> {
  return post<{ success: boolean; report: string }>(`/v1/agent/collaborations/${id}/aggregate`, {});
}

import { createApiClient, apiPath } from '@mate/shared/api';

const client = createApiClient({ baseURL: '/api' });
const data = <T>(resp: { data: T }): T => resp.data;
async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> { return data(await client.get<T>(url, params ? { params } : undefined)); }
async function post<T>(url: string, body?: unknown): Promise<T> { return data(await client.post<T>(url, body)); }



// V15-04: Digital worker team collaboration API.
// All endpoints live under /v1/dw/collaborations.

export type CollabStatus = 'pending' | 'running' | 'completed' | 'failed';
export type SubTaskStatus = 'pending' | 'running' | 'completed' | 'failed';
export type SplitStrategy = 'sequential' | 'parallel' | 'hybrid';

export interface SubTask {
  id: string;
  employeeId: string;
  title: string;
  description?: string;
  skillTags: string[];
  status: SubTaskStatus;
  progress: number;
  dependsOn: string[];
  estimatedSeconds: number;
  actualSeconds: number;
  result?: string | null;
  errorMessage?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
}

export interface CollaborationTask {
  collaborationId: string;
  tenantId?: string;
  title: string;
  description?: string;
  goal: string;
  splitStrategy: SplitStrategy;
  subtasks: SubTask[];
  status: CollabStatus;
  createdBy?: string | null;
  createdAt: string;
  updatedAt?: string;
  startedAt?: string | null;
  completedAt?: string | null;
  finalReport?: string | null;
}

export interface Contribution {
  employeeId: string;
  subtaskCount: number;
  completedCount: number;
  failedCount: number;
  totalSeconds: number;
}

export interface CollaborationReport {
  collaborationId: string;
  title: string;
  goal: string;
  status: CollabStatus;
  totalDurationSeconds: number;
  totalSubtasks: number;
  completedSubtasks: number;
  failedSubtasks: number;
  sequentialDurationSeconds: number;
  parallelDurationSeconds: number;
  efficiencyImprovementPct: number;
  contributions: Contribution[];
  finalReport: string;
}

export interface CreateCollaborationRequest {
  title?: string;
  goal: string;
  description?: string;
  employeeIds: string[];
  splitStrategy?: SplitStrategy;
}

export async function listCollaborations(params?: {
  status?: CollabStatus;
  page?: number;
  pageSize?: number;
}): Promise<{ items: CollaborationTask[]; total: number; page: number; pageSize: number; totalPages: number }> {
  return get('/dw/collaborations', params as Record<string, unknown> | undefined);
}

export async function createCollaboration(
  req: CreateCollaborationRequest,
): Promise<CollaborationTask> {
  return post<CollaborationTask>('/dw/collaborations', req);
}

export async function getCollaboration(id: string): Promise<CollaborationTask> {
  return get<CollaborationTask>(`/v1/dw/collaborations/${id}`);
}

export async function executeCollaboration(id: string): Promise<CollaborationTask> {
  return post<CollaborationTask>(`/v1/dw/collaborations/${id}/execute`);
}

export async function getCollaborationReport(id: string): Promise<CollaborationReport> {
  return get<CollaborationReport>(`/v1/dw/collaborations/${id}/report`);
}

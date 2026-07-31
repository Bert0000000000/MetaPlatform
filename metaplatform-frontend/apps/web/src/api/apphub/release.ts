import { createApiClient, apiPath } from '@mate/shared/api';

const client = createApiClient({ baseURL: apiPath('apphub', '') });
const data = <T>(resp: { data: T }): T => resp.data;
async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  return data(await client.get<T>(url, params ? { params } : undefined));
}
async function post<T>(url: string, body?: unknown): Promise<T> {
  return data(await client.post<T>(url, body));
}


import type { PageResponse } from './types';

export interface ReleaseRecord {
  releaseId: string;
  appId: string;
  version: string;
  releaseNotes?: string;
  strategy: 'FULL' | 'GRAYSCALE';
  grayPercent: number;
  grayUsers?: string[];
  grayDepts?: string[];
  status: 'PENDING_APPROVAL' | 'PUBLISHED' | 'REJECTED';
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  processInstanceId?: string;
  createdBy?: string;
  createdAt: string;
}

export interface ReleaseLog {
  logId: string;
  releaseId: string;
  action: string;
  operator?: string;
  remark?: string;
  createdAt: string;
}

export interface ReleaseTask {
  id: string;
  name: string;
  assignee?: string;
  status: 'ACTIVE' | 'COMPLETED';
  createTime?: string;
  endTime?: string;
}

export interface CreateReleaseRequest {
  version: string;
  releaseNotes?: string;
  strategy: 'FULL' | 'GRAYSCALE';
  grayPercent: number;
  grayUsers?: string[];
  grayDepts?: string[];
  techLeadId: string;
  opsOwnerId: string;
}

export interface CompleteTaskRequest {
  approved: boolean;
  comment?: string;
}

export async function listReleases(
  appId: string,
  page = 1,
  size = 20,
): Promise<PageResponse<ReleaseRecord>> {
  return get<PageResponse<ReleaseRecord>>(`/apps/${appId}/releases`, { page, size });
}

export async function createRelease(
  appId: string,
  req: CreateReleaseRequest,
): Promise<ReleaseRecord> {
  return post<ReleaseRecord>(`/apps/${appId}/releases`, req);
}

export async function getRelease(releaseId: string): Promise<ReleaseRecord> {
  return get<ReleaseRecord>(`/releases/${releaseId}`);
}

export async function getReleaseLogs(releaseId: string): Promise<ReleaseLog[]> {
  return get<ReleaseLog[]>(`/releases/${releaseId}/logs`);
}

export async function getReleaseTasks(processInstanceId: string): Promise<ReleaseTask[]> {
  return get<ReleaseTask[]>(`/v1/wfe/release-approval/${processInstanceId}/tasks`);
}

export async function completeReleaseTask(
  processInstanceId: string,
  taskId: string,
  req: CompleteTaskRequest,
): Promise<{ taskId: string; action: string; status: string; message: string }> {
  return post<{ taskId: string; action: string; status: string; message: string }>(
    `/v1/wfe/release-approval/${processInstanceId}/tasks/${taskId}/complete`,
    req,
  );
}

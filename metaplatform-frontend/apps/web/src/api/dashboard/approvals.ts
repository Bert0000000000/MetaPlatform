import { createApiClient, apiPath } from '@mate/shared/api';

const client = createApiClient({ baseURL: apiPath('dashboard', '') });
const data = <T>(resp: { data: T }): T => resp.data;
async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  return data(await client.get<T>(url, params ? { params } : undefined));
}
async function post<T>(url: string, body?: unknown): Promise<T> {
  return data(await client.post<T>(url, body));
}
async function put<T>(url: string, body?: unknown): Promise<T> {
  return data(await client.put<T>(url, body));
}
async function del<T>(url: string): Promise<T> {
  return data(await client.delete<T>(url));
}



import type { ApprovalTask, PageResponse } from './types';
import { getUser } from '@mate/shared';

interface TaskResponse {
  id: string;
  name: string;
  assignee: string;
  processInstanceId: string;
  processDefinitionId: string;
  createTime: string;
  endTime?: string;
  status: string;
}

interface WfePageResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

function mapTask(item: TaskResponse): ApprovalTask {
  return {
    taskId: item.id,
    title: item.name,
    applicantId: item.assignee,
    applicant: item.assignee,
    flowName: item.processDefinitionId || item.processInstanceId || '默认流程',
    priority: 'medium',
    status: item.status === 'pending' ? 'pending' : 'completed',
    createdAt: item.createTime,
    completedAt: item.endTime,
  };
}

function emptyPage<T>(): PageResponse<T> {
  return { items: [], total: 0, page: 1, pageSize: 10, totalPages: 0 };
}

function getUserId(): string | undefined {
  return getUser()?.id;
}

export async function getPendingTasks(): Promise<PageResponse<ApprovalTask>> {
  const userId = getUserId();
  if (!userId) return emptyPage();
  const page = await get<WfePageResponse<TaskResponse>>('/todos', { userId, page: 1, size: 20 });
  return { ...page, items: page.items.map(mapTask) };
}

export async function getCompletedTasks(): Promise<PageResponse<ApprovalTask>> {
  const userId = getUserId();
  if (!userId) return emptyPage();
  const page = await get<WfePageResponse<TaskResponse>>('/todos/done', { userId, page: 1, size: 20 });
  return { ...page, items: page.items.map(mapTask) };
}

export async function completeTask(taskId: string, action: 'approve' | 'reject', comment: string): Promise<void> {
  await post(`/todos/${taskId}/action`, { action, comment });
}

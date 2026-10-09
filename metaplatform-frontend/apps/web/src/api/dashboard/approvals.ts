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

function emptyPage<T>(): PageResponse<T> {
  return { items: [], total: 0, page: 1, pageSize: 10, totalPages: 0 };
}

function getUserId(): string | undefined {
  return getUser()?.id;
}

export async function getPendingTasks(): Promise<PageResponse<ApprovalTask>> {
  const userId = getUserId();
  if (!userId) return emptyPage();
  return get<PageResponse<ApprovalTask>>('/todos', { userId, page: 1, size: 20 });
}

export async function getCompletedTasks(): Promise<PageResponse<ApprovalTask>> {
  const userId = getUserId();
  if (!userId) return emptyPage();
  return get<PageResponse<ApprovalTask>>('/todos/done', { userId, page: 1, size: 20 });
}

export async function completeTask(taskId: string, action: 'approve' | 'reject', comment: string): Promise<void> {
  await post(`/todos/${taskId}/action`, { action, comment });
}

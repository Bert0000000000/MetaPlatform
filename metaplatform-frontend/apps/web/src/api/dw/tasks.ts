import { createApiClient, apiPath } from '@mate/shared/api';

const client = createApiClient({ baseURL: '/api' });
const data = <T>(resp: { data: T }): T => resp.data;
async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> { return data(await client.get<T>(url, params ? { params } : undefined)); }


import type { EmployeeTask } from './types';

export async function listTasks(employeeId: string): Promise<EmployeeTask[]> {
  const res = await get<{ items: EmployeeTask[] } | EmployeeTask[]>('/dw/employees/tasks', { employeeId });
  return Array.isArray(res) ? res : (res?.items ?? []);
}

export async function getTaskStats(employeeId: string): Promise<{
  total: number;
  running: number;
  completed: number;
  failed: number;
}> {
  const tasks = await listTasks(employeeId);
  return {
    total: tasks.length,
    running: tasks.filter((t) => t.status === 'running').length,
    completed: tasks.filter((t) => t.status === 'completed').length,
    failed: tasks.filter((t) => t.status === 'failed').length,
  };
}

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



import type { WorkerStatus } from './types';

interface AgentResponse {
  id: string;
  name: string;
  code?: string;
  roleCategory?: string;
  status?: string;
  runningTasks?: number;
  completedToday?: number;
  lastActiveAt?: string;
}

function mapAgent(item: AgentResponse): WorkerStatus {
  return {
    employeeId: item.id,
    name: item.name,
    code: item.code || item.id,
    roleCategory: item.roleCategory || 'OTHER',
    status: (item.status as WorkerStatus['status']) || 'ACTIVE',
    runningTasks: item.runningTasks ?? 0,
    completedToday: item.completedToday ?? 0,
    lastActiveAt: item.lastActiveAt,
  };
}

export async function getEmployeeStatus(): Promise<WorkerStatus[]> {
  const agents = await get<AgentResponse[]>('/workers');
  return Array.isArray(agents) ? agents.map(mapAgent) : [];
}

import { createApiClient, apiPath } from '@mate/shared/api';

const client = createApiClient({ baseURL: apiPath('copilot', '') });
const data = <T>(resp: { data: T }): T => resp.data;
async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> { return data(await client.get<T>(url, params ? { params } : undefined)); }
async function post<T>(url: string, body?: unknown): Promise<T> { return data(await client.post<T>(url, body)); }
async function put<T>(url: string, body?: unknown): Promise<T> { return data(await client.put<T>(url, body)); }
async function del<T>(url: string): Promise<T> { return data(await client.delete<T>(url)); }

export interface ExternalAgent {
  agentId: string;
  name: string;
  capabilities: string[];
  status: string;
  endpoint: string;
}
export async function listExternalAgents(): Promise<ExternalAgent[]> {
  return get<ExternalAgent[]>('/a2a/external');
}
export async function delegateA2A(agentId: string, task: string): Promise<{ success: boolean; output: string }> {
  return post<{ success: boolean; output: string }>('/a2a/delegate', { agentId, task });
}

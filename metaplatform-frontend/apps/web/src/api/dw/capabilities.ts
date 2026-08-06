import { createApiClient, apiPath } from '@mate/shared/api';

const client = createApiClient({ baseURL: '/api/v1' });
const data = <T>(resp: { data: T }): T => resp.data;
async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> { return data(await client.get<T>(url, params ? { params } : undefined)); }
async function post<T>(url: string, body?: unknown): Promise<T> { return data(await client.post<T>(url, body)); }


import type { Employee, EmployeeCapability } from './types';

export interface AgentTool {
  id: string;
  name: string;
  category: string;
}

export interface LlmModel {
  id: string;
  name: string;
  description: string;
}

export interface KnowledgeBase {
  id: string;
  name: string;
  documentCount: number;
}

export async function listTools(): Promise<AgentTool[]> {
  return get<AgentTool[]>('/dw/tools');
}

export async function listModels(): Promise<LlmModel[]> {
  return get<LlmModel[]>('/dw/models');
}

export async function listKnowledgeBases(): Promise<KnowledgeBase[]> {
  return get<KnowledgeBase[]>('/dw/knowledge-bases');
}

export async function updateCapability(
  employeeId: string,
  capability: EmployeeCapability,
): Promise<Employee> {
  return post<Employee>(`/dw/employees/${employeeId}/capability`, capability);
}

export async function testCapability(
  employeeId: string,
  testMessage: string,
): Promise<{ reply: string; tokensUsed: number }> {
  return post<{ reply: string; tokensUsed: number }>(
    `/dw/employees/${employeeId}/test`,
    { message: testMessage },
  );
}

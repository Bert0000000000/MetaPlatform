import { createApiClient, apiPath } from '@mate/shared/api';

const client = createApiClient({ baseURL: '/api/v1' });
const data = <T>(resp: { data: T }): T => resp.data;
async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> { return data(await client.get<T>(url, params ? { params } : undefined)); }
async function post<T>(url: string, body?: unknown): Promise<T> { return data(await client.post<T>(url, body)); }


import type { Employee, EmployeeCapability } from './types';

export interface AgentTool {
  id: string;
  name: string;
  code: string;
  kind?: string;
  enabled?: boolean;
}

export interface LlmModel {
  id: string;
  name: string;
  description: string;
}

export interface KnowledgeBase {
  id: string;
  name: string;
  code: string;
  documentCount?: number;
}

/** 解包标准 `{data:{items:[...]}}` 分页响应为数组。 */
async function listItems<T>(url: string): Promise<T[]> {
  const res = await get<{ items?: T[] }>(url);
  return res?.items ?? [];
}

export function listTools(): Promise<AgentTool[]> {
  return listItems<AgentTool>('/dw/tools');
}

export function listModels(): Promise<LlmModel[]> {
  return listItems<LlmModel>('/dw/models');
}

export function listKnowledgeBases(): Promise<KnowledgeBase[]> {
  return listItems<KnowledgeBase>('/dw/knowledge-bases');
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

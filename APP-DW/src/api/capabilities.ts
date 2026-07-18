import { get, post } from './client';
import type { Employee, EmployeeCapability } from '@/types';

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
  return get<AgentTool[]>('/v1/agent/tools');
}

export async function listModels(): Promise<LlmModel[]> {
  return get<LlmModel[]>('/v1/llmgw/models');
}

export async function listKnowledgeBases(): Promise<KnowledgeBase[]> {
  return get<KnowledgeBase[]>('/v1/rag/knowledge-bases');
}

export async function updateCapability(
  employeeId: string,
  capability: EmployeeCapability,
): Promise<Employee> {
  return post<Employee>(`/v1/agent/employees/${employeeId}/capability`, capability);
}

export async function testCapability(
  employeeId: string,
  testMessage: string,
): Promise<{ reply: string; tokensUsed: number }> {
  return post<{ reply: string; tokensUsed: number }>(
    `/v1/agent/employees/${employeeId}/test`,
    { message: testMessage },
  );
}

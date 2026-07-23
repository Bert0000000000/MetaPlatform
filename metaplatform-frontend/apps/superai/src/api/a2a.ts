import { get, post } from './client';

export interface ExternalAgent {
  agentId: string;
  name: string;
  capabilities: string[];
  status: string;
  endpoint: string;
}

export async function listExternalAgents(): Promise<ExternalAgent[]> {
  return get<ExternalAgent[]>('/v1/copilot/a2a/external');
}

export async function delegateA2A(agentId: string, task: string): Promise<{ success: boolean; output: string }> {
  return post<{ success: boolean; output: string }>('/v1/copilot/a2a/delegate', { agentId, task });
}

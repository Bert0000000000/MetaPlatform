import { get, post } from './client';

export interface ExternalAgent {
  agentId: string;
  name: string;
  description?: string;
  endpoint: string;
  capabilities: string[];
  authType: 'none' | 'apikey' | 'oauth2';
  status: 'online' | 'offline' | 'error';
  rating: number;
  totalDelegations: number;
  createdAt: string;
}

export interface DelegationRequest {
  delegationId: string;
  agentId: string;
  task: string;
  payload: Record<string, unknown>;
  status: 'pending' | 'accepted' | 'running' | 'completed' | 'failed';
  result?: unknown;
  startedAt: string;
  completedAt?: string;
}

export async function listExternalAgents(): Promise<ExternalAgent[]> {
  return get<ExternalAgent[]>('/v1/a2a/agents');
}

export async function discoverAgents(): Promise<ExternalAgent[]> {
  return get<ExternalAgent[]>('/v1/a2a/agents/discover');
}

export async function delegateTask(
  agentId: string,
  task: string,
  payload: Record<string, unknown>,
): Promise<DelegationRequest> {
  return post<DelegationRequest>('/v1/a2a/delegate', { agentId, task, payload });
}

export async function listDelegations(): Promise<DelegationRequest[]> {
  return get<DelegationRequest[]>('/v1/a2a/delegations');
}

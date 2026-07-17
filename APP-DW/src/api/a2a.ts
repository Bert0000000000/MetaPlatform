import { get } from './client';

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

const AGENT_KEY = 'app_dw_a2a_agents';
const DEL_KEY = 'app_dw_a2a_delegations';

function loadAgents(): ExternalAgent[] {
  const raw = localStorage.getItem(AGENT_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as ExternalAgent[];
  } catch {
    return [];
  }
}

function saveAgents(items: ExternalAgent[]): void {
  localStorage.setItem(AGENT_KEY, JSON.stringify(items));
}

function loadDelegations(): DelegationRequest[] {
  const raw = localStorage.getItem(DEL_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as DelegationRequest[];
  } catch {
    return [];
  }
}

function saveDelegations(items: DelegationRequest[]): void {
  localStorage.setItem(DEL_KEY, JSON.stringify(items));
}

function now(): string {
  return new Date().toISOString();
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export async function listExternalAgents(): Promise<ExternalAgent[]> {
  try {
    return await get<ExternalAgent[]>('/v1/a2a/agents');
  } catch {
    return loadAgents();
  }
}

export async function discoverAgents(): Promise<ExternalAgent[]> {
  await new Promise((r) => setTimeout(r, 800));
  const sample: ExternalAgent[] = [
    {
      agentId: 'ext_001',
      name: 'DataCruncher Pro',
      description: '数据处理专家，能执行复杂 SQL 与数据清洗',
      endpoint: 'https://example.com/a2a/datacruncher',
      capabilities: ['sql', 'etl', 'analytics'],
      authType: 'apikey',
      status: 'online',
      rating: 4.8,
      totalDelegations: 152,
      createdAt: now(),
    },
    {
      agentId: 'ext_002',
      name: 'DocSummarizer',
      description: '长文档摘要',
      endpoint: 'https://example.com/a2a/docsummarizer',
      capabilities: ['summarize', 'extract'],
      authType: 'none',
      status: 'online',
      rating: 4.5,
      totalDelegations: 89,
      createdAt: now(),
    },
  ];
  saveAgents(sample);
  return sample;
}

export async function delegateTask(
  agentId: string,
  task: string,
  payload: Record<string, unknown>,
): Promise<DelegationRequest> {
  const delegation: DelegationRequest = {
    delegationId: generateId('del'),
    agentId,
    task,
    payload,
    status: 'pending',
    startedAt: now(),
  };
  const list = loadDelegations();
  saveDelegations([delegation, ...list]);
  await new Promise((r) => setTimeout(r, 800));
  delegation.status = 'completed';
  delegation.result = { result: '任务已完成' };
  delegation.completedAt = now();
  saveDelegations([delegation, ...list.filter((d) => d.delegationId !== delegation.delegationId)]);
  return delegation;
}

export async function listDelegations(): Promise<DelegationRequest[]> {
  return loadDelegations();
}

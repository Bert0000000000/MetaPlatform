import { createApiClient, apiPath } from '@mate/shared/api';

const client = createApiClient({ baseURL: '/api/v1/a2a' });
const data = <T>(resp: { data: T }): T => resp.data;
async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> { return data(await client.get<T>(url, params ? { params } : undefined)); }
async function post<T>(url: string, body?: unknown): Promise<T> { return data(await client.post<T>(url, body)); }


import { getToken } from '@mate/shared';
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
  source?: 'internal' | 'external';
  role?: string;
  code?: string;
}

export type DelegationStatus =
  | 'SUBMITTED'
  | 'WORKING'
  | 'INPUT_REQUIRED'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELED'
  | 'PENDING'
  | 'SENT'
  | 'IN_PROGRESS'
  | 'CANCELLED';

export interface StatusHistoryEntry {
  status: DelegationStatus;
  timestamp: string;
  detail: string;
}

export interface DelegationArtifact {
  name: string;
  type: string;
  content: string;
}

export interface Delegation {
  taskId: string;
  tenantId: string;
  sourceAgentId: string;
  targetAgentId: string;
  taskType: string;
  payload: Record<string, unknown>;
  status: DelegationStatus;
  result?: Record<string, unknown>;
  error?: string;
  traceId?: string;
  callbackUrl?: string;
  statusHistory: StatusHistoryEntry[];
  artifacts: DelegationArtifact[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface PageResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CreateDelegationRequest {
  sourceAgentId: string;
  targetAgentId: string;
  taskType?: string;
  payload?: Record<string, unknown>;
  timeout?: number;
  callbackUrl?: string;
}

function mapCardToExternalAgent(card: Record<string, unknown>): ExternalAgent {
  const endpoints = (card.endpoints as Record<string, string>) || {};
  const endpoint = (card.endpoint as string) ||
    endpoints.jsonrpc || endpoints.default || Object.values(endpoints)[0] || '';
  const authentication = (card.authentication as Record<string, unknown>) || {};
  const metadata = (card.metadata as Record<string, unknown>) || {};
  const rawStatus = (card.status as string) || '';
  const status = rawStatus === 'PUBLISHED' || rawStatus === 'active' || rawStatus === 'registered'
    ? 'online'
    : 'offline';

  return {
    agentId: (card.id as string) || (card.cardId as string) || '',
    name: (card.name as string) || '',
    description: (card.description as string) || '',
    endpoint,
    capabilities: Array.isArray(card.capabilities) ? (card.capabilities as string[]) : [],
    authType: (authentication.type as ExternalAgent['authType']) || 'none',
    status: status as ExternalAgent['status'],
    rating: (metadata.rating as number) || 0,
    totalDelegations: (metadata.totalDelegations as number) || 0,
    createdAt: (card.createdAt as string) || '',
    source: (card.source as ExternalAgent['source']) || 'external',
    role: (card.role as string) || '',
    code: (card.code as string) || '',
  };
}

export async function listExternalAgents(params?: {
  name?: string;
  capability?: string;
}): Promise<ExternalAgent[]> {
  // 后端返回 {items:[...]}，解包成数组
  const res = await get<{ items?: Record<string, unknown>[] }>('/agent-cards/search', {
    status: 'PUBLISHED',
    ...params,
  });
  const cards = res?.items ?? [];
  return cards.map(mapCardToExternalAgent);
}

/** 返回原始 agent-card（含 source/role），供内部数字员工区块使用。 */
export async function searchAgentCards(): Promise<ExternalAgent[]> {
  const res = await get<{ items?: Record<string, unknown>[] }>('/agent-cards/search');
  const cards = res?.items ?? [];
  return cards.map(mapCardToExternalAgent);
}

export async function discoverAgents(): Promise<ExternalAgent[]> {
  return listExternalAgents();
}

export async function createDelegation(body: CreateDelegationRequest): Promise<Delegation> {
  return post<Delegation>('/delegations', {
    taskType: 'a2a-delegation',
    payload: {},
    ...body,
  });
}

export async function getDelegation(taskId: string): Promise<Delegation> {
  return get<Delegation>(`/v1/a2a/delegations/${taskId}`);
}

export async function listDelegations(params?: {
  status?: string;
  page?: number;
  pageSize?: number;
}): Promise<PageResponse<Delegation>> {
  return get<PageResponse<Delegation>>('/delegations', params as Record<string, unknown>);
}

export async function cancelDelegation(taskId: string): Promise<Delegation> {
  return post<Delegation>(`/v1/a2a/delegations/${taskId}/cancel`);
}

export interface DelegationStreamCallbacks {
  onInit?: (status: string) => void;
  onProgress?: (entry: StatusHistoryEntry) => void;
  onCompleted?: (result?: Record<string, unknown>) => void;
  onFailed?: (error?: string) => void;
  onCanceled?: () => void;
  onError?: (err: Error) => void;
}

export function streamDelegation(taskId: string, callbacks: DelegationStreamCallbacks): () => void {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api';
  const url = `${baseUrl}/v1/a2a/delegations/${taskId}/stream`;
  const token = getToken();
  const controller = new AbortController();

  fetch(url, {
    headers: {
      Authorization: token ? `Bearer ${token}` : '',
      'X-Trace-Id': `dw-stream-${taskId}`,
    } as Record<string, string>,
    signal: controller.signal,
  }).then(async (response) => {
    if (!response.body) return;
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let eventName = '';
    let eventData = '';

    const flushEvent = () => {
      if (!eventName) return;
      try {
        const payload = eventData ? (JSON.parse(eventData) as Record<string, unknown>) : {};
        switch (eventName) {
          case 'init':
            callbacks.onInit?.(String(payload.status || ''));
            break;
          case 'progress': {
            const entry: StatusHistoryEntry = {
              status: String(payload.status || '') as DelegationStatus,
              timestamp: String(payload.timestamp || ''),
              detail: String(payload.detail || ''),
            };
            callbacks.onProgress?.(entry);
            break;
          }
          case 'completed':
            callbacks.onCompleted?.(payload.result as Record<string, unknown> | undefined);
            break;
          case 'failed':
            callbacks.onFailed?.(String(payload.error || ''));
            break;
          case 'canceled':
            callbacks.onCanceled?.();
            break;
        }
      } catch {
        // ignore malformed event
      }
      eventName = '';
      eventData = '';
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        flushEvent();
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (line.startsWith('event:')) {
          eventName = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          eventData = line.slice(5).trim();
        } else if (line.trim() === '') {
          flushEvent();
        }
      }
    }
  }).catch((err) => {
    if ((err as Error).name !== 'AbortError') {
      callbacks.onError?.(err as Error);
    }
  });

  return () => controller.abort();
}

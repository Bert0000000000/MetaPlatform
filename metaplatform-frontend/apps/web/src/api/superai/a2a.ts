import { createApiClient } from '@mate/shared/api';

// A2A 协作直连 a2a 中心（/api/v1/a2a），不再走 copilot 的 /a2a/*（该接口 401）。
// 与 orchestrator A2AWorker 使用同一套 W3C 消息协议，委派任务进入同一个 a2a 任务池。
const client = createApiClient({ baseURL: '/api/v1/a2a' });
const data = <T>(resp: { data: T }): T => resp.data;
async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  return data(await client.get<T>(url, params ? { params } : undefined));
}
async function post<T>(url: string, body?: unknown): Promise<T> {
  return data(await client.post<T>(url, body));
}

export interface ExternalAgent {
  agentId: string;
  name: string;
  capabilities: string[];
  status: string;
  endpoint: string;
}

/** 将 a2a 中心的 agent-card 归一化为页面用的 ExternalAgent。 */
function mapCard(card: Record<string, unknown>): ExternalAgent {
  const endpoints = (card.endpoints as Record<string, string>) || {};
  return {
    agentId: (card.id as string) || (card.cardId as string) || '',
    name: (card.name as string) || '',
    capabilities: Array.isArray(card.capabilities) ? (card.capabilities as string[]) : [],
    status: (card.status as string) || 'active',
    endpoint:
      (card.endpoint as string) ||
      endpoints.jsonrpc ||
      endpoints.default ||
      Object.values(endpoints)[0] ||
      '',
  };
}

export async function listExternalAgents(): Promise<ExternalAgent[]> {
  const res = await get<{ items?: Record<string, unknown>[] }>('/agent-cards/search');
  const cards = res?.items ?? [];
  return cards.map(mapCard);
}

/**
 * 通过 W3C A2A 消息把任务委托给目标 Agent（与 orchestrator A2AWorker 同协议）。
 * a2a 中心收到后建一条 delegation task 并返回。
 */
export async function delegateA2A(
  agentId: string,
  task: string,
): Promise<{ success: boolean; output: string }> {
  const envelope = {
    messageId: `ui-${Date.now()}`,
    role: 'user' as const,
    parts: [
      { kind: 'text', text: task },
      { kind: 'data', data: { target_agent_id: agentId } },
    ],
  };
  const taskObj = await post<Record<string, unknown>>('/messages', envelope);
  const id = (taskObj.id as string) || '';
  const state =
    ((taskObj.status as Record<string, unknown> | undefined)?.state as string) || 'submitted';
  return {
    success: true,
    output: `已提交 A2A 委托\n任务 ID：${id}\n状态：${state}\n目标 Agent：${agentId}`,
  };
}

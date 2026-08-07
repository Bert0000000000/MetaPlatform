import { createApiClient, apiPath } from '@mate/shared/api';

const client = createApiClient({ baseURL: apiPath('copilot', '') });
const data = <T>(resp: { data: T }): T => resp.data;
async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> { return data(await client.get<T>(url, params ? { params } : undefined)); }
async function post<T>(url: string, body?: unknown): Promise<T> { return data(await client.post<T>(url, body)); }
async function put<T>(url: string, body?: unknown): Promise<T> { return data(await client.put<T>(url, body)); }
async function del<T>(url: string): Promise<T> { return data(await client.delete<T>(url)); }

import type { ActionItem, ActionMatchResult, ActionResult, ActionParam } from './types';

interface ActionEnvelope { items?: ActionItem[]; total?: number }
interface MatchEnvelope { matched?: Array<{ id?: string; action_id?: string; name?: string; action_name?: string; description?: string; category?: string; input_schema?: ActionParam[]; inputSchema?: ActionParam[]; keywords?: string[] }>; total?: number }
interface ExecuteResponse {
  action_id?: string;
  result_id?: string;
  status?: string;
  output?: Record<string, unknown> | null;
}

function toActionItem(raw: ActionItem | Record<string, unknown>): ActionItem {
  return {
    id: String((raw as Record<string, unknown>).id ?? (raw as Record<string, unknown>).action_id ?? ''),
    name: String((raw as Record<string, unknown>).name ?? ''),
    description: String((raw as Record<string, unknown>).description ?? ''),
    category: String((raw as Record<string, unknown>).category ?? 'general'),
    inputSchema: ((raw as Record<string, unknown>).input_schema ?? (raw as Record<string, unknown>).inputSchema ?? []) as ActionParam[],
    outputType: 'json',
    enabled: (raw as Record<string, unknown>).enabled !== false,
  };
}

export async function listActions(): Promise<ActionItem[]> {
  const resp = await get<ActionEnvelope>('/actions');
  return (resp.items ?? []).map(toActionItem);
}
export async function executeAction(actionId: string, params: Record<string, unknown>): Promise<ActionResult> {
  const resp = await post<ExecuteResponse>('/actions/execute', { actionId, params });
  const output = resp.output ?? {};
  return {
    actionId: resp.action_id ?? actionId,
    actionName: '',
    success: resp.status === 'completed' && !(output as { error?: string }).error,
    output,
    message: (output as { error?: string }).error ?? (resp.status === 'completed' ? '执行完成' : '执行失败'),
    executedAt: new Date().toISOString(),
  };
}
export async function matchAction(query: string): Promise<ActionMatchResult[]> {
  const resp = await post<MatchEnvelope>('/actions/match', { query });
  return (resp.matched ?? []).map((m) => ({
    action: toActionItem(m as unknown as Record<string, unknown>),
    confidence: 100,
    reason: '关键词匹配',
  }));
}

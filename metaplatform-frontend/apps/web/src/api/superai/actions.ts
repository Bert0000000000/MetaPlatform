import { createApiClient, apiPath } from '@mate/shared/api';

const client = createApiClient({ baseURL: apiPath('copilot', '') });
const data = <T>(resp: { data: T }): T => resp.data;
async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> { return data(await client.get<T>(url, params ? { params } : undefined)); }
async function post<T>(url: string, body?: unknown): Promise<T> { return data(await client.post<T>(url, body)); }
async function put<T>(url: string, body?: unknown): Promise<T> { return data(await client.put<T>(url, body)); }
async function del<T>(url: string): Promise<T> { return data(await client.delete<T>(url)); }

import type { ActionItem, ActionMatchResult, ActionResult } from './types';
export async function listActions(): Promise<ActionItem[]> {
  return get<ActionItem[]>('/actions');
}
export async function executeAction(actionId: string, params: Record<string, unknown>): Promise<ActionResult> {
  return post<ActionResult>('/actions/execute', { actionId, params });
}
export async function matchAction(query: string): Promise<ActionMatchResult[]> {
  return post<ActionMatchResult[]>('/actions/match', { query });
}

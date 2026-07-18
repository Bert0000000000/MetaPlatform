import { get, post } from './client';
import type { ActionItem, ActionMatchResult, ActionResult } from '@/types';

export async function listActions(): Promise<ActionItem[]> {
  return get<ActionItem[]>('/v1/actions');
}

export async function executeAction(actionId: string, params: Record<string, unknown>): Promise<ActionResult> {
  return post<ActionResult>('/v1/actions/execute', { actionId, params });
}

export async function matchAction(query: string): Promise<ActionMatchResult[]> {
  return post<ActionMatchResult[]>('/v1/actions/match', { query });
}

import { get, post, put, del } from './client';
import type { PageResponse } from '@/types';

export interface ActionStep {
  id: string;
  type: 'input' | 'output' | 'transform' | 'condition' | 'loop' | 'sub-action';
  name: string;
  config: Record<string, unknown>;
  next?: string[];
}

export interface ActionDefinition {
  actionId: string;
  code: string;
  name: string;
  description?: string;
  category: string;
  inputSchema: Array<{ name: string; type: string; required: boolean; description?: string }>;
  outputSchema: Array<{ name: string; type: string; description?: string }>;
  steps: ActionStep[];
  enabled: boolean;
  version: string;
  createdAt: string;
}

const BASE = '/v1/action/actions';

export async function listActions(): Promise<PageResponse<ActionDefinition>> {
  return get<PageResponse<ActionDefinition>>(BASE);
}

export async function createAction(req: Omit<ActionDefinition, 'actionId' | 'createdAt' | 'version'>): Promise<ActionDefinition> {
  return post<ActionDefinition>(BASE, req);
}

export async function updateAction(id: string, req: Partial<ActionDefinition>): Promise<ActionDefinition> {
  return put<ActionDefinition>(`${BASE}/${id}`, req);
}

export async function deleteAction(id: string): Promise<void> {
  await del<void>(`${BASE}/${id}`);
}

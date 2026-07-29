import { createApiClient, apiPath } from '@mate/shared/api';

const client = createApiClient({ baseURL: apiPath('ea', '/v1') });
const data = <T>(resp: { data: T }): T => resp.data;
async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> { return data(await client.get<T>(url, params ? { params } : undefined)); }
async function post<T>(url: string, body?: unknown): Promise<T> { return data(await client.post<T>(url, body)); }
async function put<T>(url: string, body?: unknown): Promise<T> { return data(await client.put<T>(url, body)); }
async function del<T>(url: string): Promise<T> { return data(await client.delete<T>(url)); }

import type { TechnologyStack } from './types';

export async function listTechnologyStacks(): Promise<TechnologyStack[]> {
  return get<TechnologyStack[]>('/v1/ea/technology-stacks');
}

export async function createTechnologyStack(req: Partial<TechnologyStack>): Promise<TechnologyStack> {
  return post<TechnologyStack>('/v1/ea/technology-stacks', req);
}

export async function updateTechnologyStack(id: string, req: Partial<TechnologyStack>): Promise<TechnologyStack> {
  return put<TechnologyStack>(`/v1/ea/technology-stacks/${id}`, req);
}

export async function deleteTechnologyStack(id: string): Promise<void> {
  await del<void>(`/v1/ea/technology-stacks/${id}`);
}

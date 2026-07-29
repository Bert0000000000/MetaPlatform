import { createApiClient, apiPath } from '@mate/shared/api';

const client = createApiClient({ baseURL: apiPath('ea', '/v1') });
const data = <T>(resp: { data: T }): T => resp.data;
async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> { return data(await client.get<T>(url, params ? { params } : undefined)); }
async function post<T>(url: string, body?: unknown): Promise<T> { return data(await client.post<T>(url, body)); }
async function put<T>(url: string, body?: unknown): Promise<T> { return data(await client.put<T>(url, body)); }
async function del<T>(url: string): Promise<T> { return data(await client.delete<T>(url)); }

import type { TechStack, Infrastructure } from './types';

export async function listTechStacks(): Promise<TechStack[]> {
  return get<TechStack[]>('/v1/ea/tech-stacks');
}

export async function createTechStack(req: Partial<TechStack>): Promise<TechStack> {
  return post<TechStack>('/v1/ea/tech-stacks', req);
}

export async function updateTechStack(id: string, req: Partial<TechStack>): Promise<TechStack> {
  return put<TechStack>(`/v1/ea/tech-stacks/${id}`, req);
}

export async function deleteTechStack(id: string): Promise<void> {
  await del<void>(`/v1/ea/tech-stacks/${id}`);
}

export async function listInfrastructure(): Promise<Infrastructure[]> {
  return get<Infrastructure[]>('/v1/ea/infrastructures');
}

export async function createInfrastructure(req: Partial<Infrastructure>): Promise<Infrastructure> {
  return post<Infrastructure>('/v1/ea/infrastructures', req);
}

export async function updateInfrastructure(id: string, req: Partial<Infrastructure>): Promise<Infrastructure> {
  return put<Infrastructure>(`/v1/ea/infrastructures/${id}`, req);
}

export async function deleteInfrastructure(id: string): Promise<void> {
  await del<void>(`/v1/ea/infrastructures/${id}`);
}

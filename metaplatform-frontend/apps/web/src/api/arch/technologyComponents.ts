import { createApiClient, apiPath } from '@mate/shared/api';

const client = createApiClient({ baseURL: apiPath('ea', '/v1') });
const data = <T>(resp: { data: T }): T => resp.data;
async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> { return data(await client.get<T>(url, params ? { params } : undefined)); }
async function post<T>(url: string, body?: unknown): Promise<T> { return data(await client.post<T>(url, body)); }
async function put<T>(url: string, body?: unknown): Promise<T> { return data(await client.put<T>(url, body)); }
async function del<T>(url: string): Promise<T> { return data(await client.delete<T>(url)); }

import type { TechnologyComponent } from './types';

export async function listTechnologyComponents(type?: string): Promise<TechnologyComponent[]> {
  return get<TechnologyComponent[]>('/v1/ea/technology-components', type ? { type } : undefined);
}

export async function createTechnologyComponent(req: Partial<TechnologyComponent>): Promise<TechnologyComponent> {
  return post<TechnologyComponent>('/v1/ea/technology-components', req);
}

export async function updateTechnologyComponent(id: string, req: Partial<TechnologyComponent>): Promise<TechnologyComponent> {
  return put<TechnologyComponent>(`/v1/ea/technology-components/${id}`, req);
}

export async function deleteTechnologyComponent(id: string): Promise<void> {
  await del<void>(`/v1/ea/technology-components/${id}`);
}

import { createApiClient, apiPath } from '@mate/shared/api';

const client = createApiClient({ baseURL: apiPath('arch', '') });
const data = <T>(resp: { data: T }): T => resp.data;
async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> { return data(await client.get<T>(url, params ? { params } : undefined)); }
async function post<T>(url: string, body?: unknown): Promise<T> { return data(await client.post<T>(url, body)); }
async function put<T>(url: string, body?: unknown): Promise<T> { return data(await client.put<T>(url, body)); }
async function del<T>(url: string): Promise<T> { return data(await client.delete<T>(url)); }

import type { TechnologyRadar } from './types';

export async function listTechnologyRadars(): Promise<TechnologyRadar[]> {
  return get<TechnologyRadar[]>('/technology-radar');
}

export async function createTechnologyRadar(req: Partial<TechnologyRadar>): Promise<TechnologyRadar> {
  return post<TechnologyRadar>('/technology-radar', req);
}

export async function updateTechnologyRadar(id: string, req: Partial<TechnologyRadar>): Promise<TechnologyRadar> {
  return put<TechnologyRadar>(`/technology-radar/${id}`, req);
}

export async function deleteTechnologyRadar(id: string): Promise<void> {
  await del<void>(`/technology-radar/${id}`);
}

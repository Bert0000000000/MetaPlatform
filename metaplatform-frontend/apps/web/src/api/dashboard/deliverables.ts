import { createApiClient, apiPath } from '@mate/shared/api';

const client = createApiClient({ baseURL: apiPath('dashboard', '/v1') });
const data = <T>(resp: { data: T }): T => resp.data;
async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  return data(await client.get<T>(url, params ? { params } : undefined));
}
async function post<T>(url: string, body?: unknown): Promise<T> {
  return data(await client.post<T>(url, body));
}
async function put<T>(url: string, body?: unknown): Promise<T> {
  return data(await client.put<T>(url, body));
}
async function del<T>(url: string): Promise<T> {
  return data(await client.delete<T>(url));
}



import type { Deliverable, DeliverableType, PageResponse } from './types';

export async function listDeliverables(params?: { keyword?: string; type?: DeliverableType }): Promise<PageResponse<Deliverable>> {
  return get<PageResponse<Deliverable>>('/v1/dashboard/deliverables', params as Record<string, unknown> | undefined);
}

export async function searchDeliverables(keyword: string): Promise<Deliverable[]> {
  const res = await listDeliverables({ keyword });
  return res.items;
}

export async function downloadDeliverable(id: string, format: string): Promise<{ downloadUrl: string; message: string }> {
  return post<{ downloadUrl: string; message: string }>(`/v1/dashboard/deliverables/${id}/download`, { format });
}

export async function deleteDeliverable(id: string): Promise<void> {
  await del<void>(`/v1/dashboard/deliverables/${id}`);
}

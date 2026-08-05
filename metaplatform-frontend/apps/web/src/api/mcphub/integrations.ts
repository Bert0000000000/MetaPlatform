import { createApiClient, apiPath } from '@mate/shared/api';

const client = createApiClient({ baseURL: apiPath('mcp', '') });
const data = <T>(resp: { data: T }): T => resp.data;
async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> { return data(await client.get<T>(url, params ? { params } : undefined)); }
async function post<T>(url: string, body?: unknown): Promise<T> { return data(await client.post<T>(url, body)); }
async function put<T>(url: string, body?: unknown): Promise<T> { return data(await client.put<T>(url, body)); }
async function del<T>(url: string): Promise<T> { return data(await client.delete<T>(url)); }

import type { ApiKey, Integration, IntegrationCreateRequest } from './types';

export async function listApiKeys(): Promise<ApiKey[]> {
  return get<ApiKey[]>('/api-keys');
}
export async function createApiKey(name: string, scopes: string[]): Promise<ApiKey> {
  return post<ApiKey>('/api-keys', { name, scopes });
}
export async function deleteApiKey(id: string): Promise<void> {
  await del(`/api-keys/${id}`);
}
export async function listIntegrations(): Promise<Integration[]> {
  return get<Integration[]>('/integrations');
}
export async function createIntegration(req: IntegrationCreateRequest): Promise<Integration> {
  return post<Integration>('/integrations', req);
}
export async function updateIntegration(
  id: string,
  req: IntegrationCreateRequest,
): Promise<Integration> {
  return put<Integration>(`/integrations/${id}`, req);
}
export async function deleteIntegration(id: string): Promise<void> {
  await del(`/integrations/${id}`);
}

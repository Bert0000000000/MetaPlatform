import { get, post, put, del } from './client';
import type { ApiKey, Integration, IntegrationCreateRequest } from '@/types';

export async function listApiKeys(): Promise<ApiKey[]> {
  return get<ApiKey[]>('/v1/mcp/api-keys');
}

export async function createApiKey(name: string, scopes: string[]): Promise<ApiKey> {
  return post<ApiKey>('/v1/mcp/api-keys', { name, scopes });
}

export async function deleteApiKey(id: string): Promise<void> {
  await del(`/v1/mcp/api-keys/${id}`);
}

export async function listIntegrations(): Promise<Integration[]> {
  return get<Integration[]>('/v1/mcp/integrations');
}

export async function createIntegration(req: IntegrationCreateRequest): Promise<Integration> {
  return post<Integration>('/v1/mcp/integrations', req);
}

export async function updateIntegration(
  id: string,
  req: IntegrationCreateRequest,
): Promise<Integration> {
  return put<Integration>(`/v1/mcp/integrations/${id}`, req);
}

export async function deleteIntegration(id: string): Promise<void> {
  await del(`/v1/mcp/integrations/${id}`);
}

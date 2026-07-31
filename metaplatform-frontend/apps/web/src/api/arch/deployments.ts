import { createApiClient, apiPath } from '@mate/shared/api';

const client = createApiClient({ baseURL: apiPath('arch', '') });
const data = <T>(resp: { data: T }): T => resp.data;
async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> { return data(await client.get<T>(url, params ? { params } : undefined)); }
async function post<T>(url: string, body?: unknown): Promise<T> { return data(await client.post<T>(url, body)); }
async function put<T>(url: string, body?: unknown): Promise<T> { return data(await client.put<T>(url, body)); }
async function del<T>(url: string): Promise<T> { return data(await client.delete<T>(url)); }

import type { DeploymentTopology } from './types';

export async function listDeploymentTopologies(environment?: string): Promise<DeploymentTopology[]> {
  return get<DeploymentTopology[]>('/deployments', environment ? { environment } : undefined);
}

export async function createDeploymentTopology(req: Partial<DeploymentTopology>): Promise<DeploymentTopology> {
  return post<DeploymentTopology>('/deployments', req);
}

export async function updateDeploymentTopology(id: string, req: Partial<DeploymentTopology>): Promise<DeploymentTopology> {
  return put<DeploymentTopology>(`/deployments/${id}`, req);
}

export async function deleteDeploymentTopology(id: string): Promise<void> {
  await del<void>(`/deployments/${id}`);
}

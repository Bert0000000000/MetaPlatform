import { get, post, put, del } from './client';
import type { DeploymentTopology } from '@/types';

export async function listDeploymentTopologies(environment?: string): Promise<DeploymentTopology[]> {
  return get<DeploymentTopology[]>('/v1/ea/deployments', environment ? { environment } : undefined);
}

export async function createDeploymentTopology(req: Partial<DeploymentTopology>): Promise<DeploymentTopology> {
  return post<DeploymentTopology>('/v1/ea/deployments', req);
}

export async function updateDeploymentTopology(id: string, req: Partial<DeploymentTopology>): Promise<DeploymentTopology> {
  return put<DeploymentTopology>(`/v1/ea/deployments/${id}`, req);
}

export async function deleteDeploymentTopology(id: string): Promise<void> {
  await del<void>(`/v1/ea/deployments/${id}`);
}

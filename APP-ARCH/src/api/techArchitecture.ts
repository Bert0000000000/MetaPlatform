import { get, post, put, del } from './client';
import type { TechStack, Infrastructure } from '@/types';

export async function listTechStacks(): Promise<TechStack[]> {
  return get<TechStack[]>('/v1/ea/tech/stacks');
}

export async function createTechStack(req: Partial<TechStack>): Promise<TechStack> {
  return post<TechStack>('/v1/ea/tech/stacks', req);
}

export async function updateTechStack(id: string, req: Partial<TechStack>): Promise<TechStack> {
  return put<TechStack>(`/v1/ea/tech/stacks/${id}`, req);
}

export async function deleteTechStack(id: string): Promise<void> {
  await del<void>(`/v1/ea/tech/stacks/${id}`);
}

export async function listInfrastructure(): Promise<Infrastructure[]> {
  return get<Infrastructure[]>('/v1/ea/tech/infra');
}

export async function createInfrastructure(req: Partial<Infrastructure>): Promise<Infrastructure> {
  return post<Infrastructure>('/v1/ea/tech/infra', req);
}

export async function deleteInfrastructure(id: string): Promise<void> {
  await del<void>(`/v1/ea/tech/infra/${id}`);
}

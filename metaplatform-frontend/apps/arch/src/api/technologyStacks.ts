import { get, post, put, del } from './client';
import type { TechnologyStack } from '@/types';

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

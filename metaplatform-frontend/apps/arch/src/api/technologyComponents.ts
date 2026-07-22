import { get, post, put, del } from './client';
import type { TechnologyComponent } from '@/types';

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

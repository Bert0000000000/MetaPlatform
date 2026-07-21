import { get, post, put, del } from './client';
import type { TechnologyRadar } from '@/types';

export async function listTechnologyRadars(): Promise<TechnologyRadar[]> {
  return get<TechnologyRadar[]>('/v1/ea/technology-radar');
}

export async function createTechnologyRadar(req: Partial<TechnologyRadar>): Promise<TechnologyRadar> {
  return post<TechnologyRadar>('/v1/ea/technology-radar', req);
}

export async function updateTechnologyRadar(id: string, req: Partial<TechnologyRadar>): Promise<TechnologyRadar> {
  return put<TechnologyRadar>(`/v1/ea/technology-radar/${id}`, req);
}

export async function deleteTechnologyRadar(id: string): Promise<void> {
  await del<void>(`/v1/ea/technology-radar/${id}`);
}

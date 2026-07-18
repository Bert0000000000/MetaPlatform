import { get, post, put, del } from './client';
import type { Principle, ReviewItem, TechDebt } from '@/types';

export async function listPrinciples(): Promise<Principle[]> {
  return get<Principle[]>('/v1/ea/governance/principles');
}

export async function createPrinciple(req: Partial<Principle>): Promise<Principle> {
  return post<Principle>('/v1/ea/governance/principles', req);
}

export async function updatePrinciple(id: string, req: Partial<Principle>): Promise<Principle> {
  return put<Principle>(`/v1/ea/governance/principles/${id}`, req);
}

export async function deletePrinciple(id: string): Promise<void> {
  await del<void>(`/v1/ea/governance/principles/${id}`);
}

export async function listReviews(): Promise<ReviewItem[]> {
  return get<ReviewItem[]>('/v1/ea/governance/reviews');
}

export async function createReview(req: Partial<ReviewItem>): Promise<ReviewItem> {
  return post<ReviewItem>('/v1/ea/governance/reviews', req);
}

export async function submitReviewAction(id: string, action: 'approve' | 'reject', comment: string): Promise<void> {
  await post<void>(`/v1/ea/governance/reviews/${id}/${action}`, { comment });
}

export async function listTechDebt(): Promise<TechDebt[]> {
  return get<TechDebt[]>('/v1/ea/governance/tech-debt');
}

export async function createTechDebt(req: Partial<TechDebt>): Promise<TechDebt> {
  return post<TechDebt>('/v1/ea/governance/tech-debt', req);
}

export async function updateTechDebt(id: string, req: Partial<TechDebt>): Promise<TechDebt> {
  return put<TechDebt>(`/v1/ea/governance/tech-debt/${id}`, req);
}

export async function deleteTechDebt(id: string): Promise<void> {
  await del<void>(`/v1/ea/governance/tech-debt/${id}`);
}

export async function runComplianceCheck(id: string): Promise<{ score: number; issues: string[] }> {
  return get<{ score: number; issues: string[] }>(`/v1/ea/governance/tech-debt/${id}/compliance`);
}

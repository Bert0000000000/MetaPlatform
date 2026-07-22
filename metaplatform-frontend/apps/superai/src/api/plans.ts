import { get, post } from './client';
import type { Plan, CreatePlanRequest } from '@/types';

const PLANS_BASE = '/v1/agent/plans';

export async function createPlan(req: CreatePlanRequest): Promise<Plan> {
  return post<Plan>(PLANS_BASE, req);
}

export async function getPlan(planId: string): Promise<Plan> {
  return get<Plan>(`${PLANS_BASE}/${planId}`);
}

export async function listPlans(params?: {
  agentId?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ items: Plan[]; total: number; page: number; pageSize: number }> {
  return get(PLANS_BASE, params as Record<string, unknown> | undefined);
}

export async function approveStep(planId: string, stepId: string): Promise<Plan> {
  return post<Plan>(`${PLANS_BASE}/${planId}/steps/${stepId}/approve`);
}

export async function skipStep(planId: string, stepId: string): Promise<Plan> {
  return post<Plan>(`${PLANS_BASE}/${planId}/steps/${stepId}/skip`);
}

export async function executePlan(planId: string): Promise<Plan> {
  return post<Plan>(`${PLANS_BASE}/${planId}/execute`);
}

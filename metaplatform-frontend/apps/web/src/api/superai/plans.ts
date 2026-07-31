import { createApiClient, apiPath } from '@mate/shared/api';

const client = createApiClient({ baseURL: apiPath('copilot', '') });
const data = <T>(resp: { data: T }): T => resp.data;
async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> { return data(await client.get<T>(url, params ? { params } : undefined)); }
async function post<T>(url: string, body?: unknown): Promise<T> { return data(await client.post<T>(url, body)); }
async function put<T>(url: string, body?: unknown): Promise<T> { return data(await client.put<T>(url, body)); }
async function del<T>(url: string): Promise<T> { return data(await client.delete<T>(url)); }

import type { Plan, CreatePlanRequest } from './types';
const PLANS_BASE = '/plans';
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

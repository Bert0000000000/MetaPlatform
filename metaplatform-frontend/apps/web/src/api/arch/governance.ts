import { createApiClient, apiPath } from '@mate/shared/api';

const client = createApiClient({ baseURL: apiPath('arch', '') });
const data = <T>(resp: { data: T }): T => resp.data;
async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> { return data(await client.get<T>(url, params ? { params } : undefined)); }
async function post<T>(url: string, body?: unknown): Promise<T> { return data(await client.post<T>(url, body)); }
async function put<T>(url: string, body?: unknown): Promise<T> { return data(await client.put<T>(url, body)); }
async function del<T>(url: string): Promise<T> { return data(await client.delete<T>(url)); }

import type {
  Principle,
  PrincipleCategory,
  ReviewTemplate,
  ReviewTicket,
  ReviewScoreItem,
  TechDebt,
} from './types';

function safeJsonParse<T>(value: string | undefined | null, defaultValue: T): T {
  if (!value) return defaultValue;
  try {
    return JSON.parse(value) as T;
  } catch {
    return defaultValue;
  }
}

export function normalizePrinciple(raw: Principle): Principle {
  return {
    ...raw,
    standards: safeJsonParse<string[]>(raw.standards as unknown as string, []),
  };
}

export function normalizeReviewTemplate(raw: ReviewTemplate): ReviewTemplate {
  return {
    ...raw,
    dimensions: safeJsonParse<ReviewTemplate['dimensions']>(raw.dimensions as unknown as string, []),
    experts: safeJsonParse<ReviewTemplate['experts']>(raw.experts as unknown as string, []),
  };
}

export function normalizeReviewTicket(raw: ReviewTicket): ReviewTicket {
  return {
    ...raw,
    scores: safeJsonParse<ReviewTicket['scores']>(raw.scores as unknown as string, []),
    comments: safeJsonParse<ReviewTicket['comments']>(raw.comments as unknown as string, []),
  };
}

export function normalizeTechDebt(raw: TechDebt): TechDebt {
  return {
    ...raw,
    repaymentPlan: safeJsonParse<TechDebt['repaymentPlan']>(raw.repaymentPlan as unknown as string, {}),
  };
}

// ---------- 原则分类 ----------
export async function listPrincipleCategories(): Promise<PrincipleCategory[]> {
  return get<PrincipleCategory[]>('/governance/principle-categories');
}

export async function createPrincipleCategory(req: Partial<PrincipleCategory>): Promise<PrincipleCategory> {
  return post<PrincipleCategory>('/governance/principle-categories', req);
}

export async function updatePrincipleCategory(id: string, req: Partial<PrincipleCategory>): Promise<PrincipleCategory> {
  return put<PrincipleCategory>(`/governance/principle-categories/${id}`, req);
}

export async function deletePrincipleCategory(id: string): Promise<void> {
  await del<void>(`/governance/principle-categories/${id}`);
}

// ---------- 架构原则 ----------
export async function listPrinciples(categoryId?: string): Promise<Principle[]> {
  const items = await get<Principle[]>('/governance/principles', categoryId ? { categoryId } : undefined);
  return items.map(normalizePrinciple);
}

export async function createPrinciple(req: Partial<Principle>): Promise<Principle> {
  return normalizePrinciple(await post<Principle>('/governance/principles', req));
}

export async function updatePrinciple(id: string, req: Partial<Principle>): Promise<Principle> {
  return normalizePrinciple(await put<Principle>(`/governance/principles/${id}`, req));
}

export async function deletePrinciple(id: string): Promise<void> {
  await del<void>(`/governance/principles/${id}`);
}

// ---------- 评审模板 ----------
export async function listReviewTemplates(): Promise<ReviewTemplate[]> {
  const items = await get<ReviewTemplate[]>('/governance/review-templates');
  return items.map(normalizeReviewTemplate);
}

export async function createReviewTemplate(req: Partial<ReviewTemplate>): Promise<ReviewTemplate> {
  return normalizeReviewTemplate(await post<ReviewTemplate>('/governance/review-templates', req));
}

export async function updateReviewTemplate(id: string, req: Partial<ReviewTemplate>): Promise<ReviewTemplate> {
  return normalizeReviewTemplate(await put<ReviewTemplate>(`/governance/review-templates/${id}`, req));
}

export async function deleteReviewTemplate(id: string): Promise<void> {
  await del<void>(`/governance/review-templates/${id}`);
}

// ---------- 评审工单 ----------
export async function listReviewTickets(status?: string): Promise<ReviewTicket[]> {
  const items = await get<ReviewTicket[]>('/governance/review-tickets', status ? { status } : undefined);
  return items.map(normalizeReviewTicket);
}

export async function createReviewTicket(req: Partial<ReviewTicket>): Promise<ReviewTicket> {
  return normalizeReviewTicket(await post<ReviewTicket>('/governance/review-tickets', req));
}

export async function updateReviewTicket(id: string, req: Partial<ReviewTicket>): Promise<ReviewTicket> {
  return normalizeReviewTicket(await put<ReviewTicket>(`/governance/review-tickets/${id}`, req));
}

export async function deleteReviewTicket(id: string): Promise<void> {
  await del<void>(`/governance/review-tickets/${id}`);
}

export async function startReviewTicket(id: string, reviewer?: string): Promise<ReviewTicket> {
  const query = reviewer ? `?reviewer=${encodeURIComponent(reviewer)}` : '';
  return normalizeReviewTicket(await post<ReviewTicket>(`/governance/review-tickets/${id}/start${query}`));
}

export async function approveReviewTicket(
  id: string,
  reviewer: string,
  scores: ReviewScoreItem[],
  comment?: string,
  decision?: string
): Promise<ReviewTicket> {
  return normalizeReviewTicket(
    await post<ReviewTicket>(`/governance/review-tickets/${id}/approve`, { reviewer, scores, comment, decision })
  );
}

export async function rejectReviewTicket(
  id: string,
  reviewer: string,
  scores: ReviewScoreItem[],
  comment?: string,
  decision?: string
): Promise<ReviewTicket> {
  return normalizeReviewTicket(
    await post<ReviewTicket>(`/governance/review-tickets/${id}/reject`, { reviewer, scores, comment, decision })
  );
}

export async function addReviewTicketComment(id: string, reviewer: string, comment: string): Promise<ReviewTicket> {
  const query = `?reviewer=${encodeURIComponent(reviewer)}&comment=${encodeURIComponent(comment)}`;
  return normalizeReviewTicket(
    await post<ReviewTicket>(`/governance/review-tickets/${id}/comments${query}`)
  );
}

// ---------- 技术债务 ----------
export async function listTechDebt(level?: string, status?: string): Promise<TechDebt[]> {
  const items = await get<TechDebt[]>('/governance/tech-debts', { level, status });
  return items.map(normalizeTechDebt);
}

export async function createTechDebt(req: Partial<TechDebt>): Promise<TechDebt> {
  return normalizeTechDebt(await post<TechDebt>('/governance/tech-debts', req));
}

export async function updateTechDebt(id: string, req: Partial<TechDebt>): Promise<TechDebt> {
  return normalizeTechDebt(await put<TechDebt>(`/governance/tech-debts/${id}`, req));
}

export async function deleteTechDebt(id: string): Promise<void> {
  await del<void>(`/governance/tech-debts/${id}`);
}

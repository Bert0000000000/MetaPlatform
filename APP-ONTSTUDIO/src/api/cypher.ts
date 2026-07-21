import { get, post, put, del } from './client';

// ============ REQ-062: Cypher 查询执行 ============

export interface CypherExecuteRequest {
  query: string;
  params?: Record<string, unknown>;
  limit?: number;
}

export interface CypherExecuteResponse {
  columns: string[];
  rows: Array<Record<string, unknown>>;
  rowCount: number;
  durationMs: number;
}

// ============ REQ-063: 查询模板 ============

export type CypherTemplateCategory = 'concept' | 'relation' | 'path' | 'aggregate';

export interface CypherTemplate {
  templateId: string;
  tenantId?: string;
  name: string;
  category: CypherTemplateCategory;
  description?: string;
  query: string;
  tags?: string[];
  builtin?: boolean;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
}

export type CypherTemplatePayload = Omit<CypherTemplate, 'templateId' | 'tenantId' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | 'builtin'>;

const BASE = '/v1/ont/cypher';

export async function executeCypher(request: CypherExecuteRequest): Promise<CypherExecuteResponse> {
  return post<CypherExecuteResponse>(`${BASE}/execute`, request);
}

export async function listCypherTemplates(
  category?: CypherTemplateCategory,
  keyword?: string,
): Promise<CypherTemplate[]> {
  const params: Record<string, unknown> = {};
  if (category) params.category = category;
  if (keyword) params.keyword = keyword;
  return get<CypherTemplate[]>(`${BASE}/templates`, params);
}

export async function getCypherTemplate(templateId: string): Promise<CypherTemplate> {
  return get<CypherTemplate>(`${BASE}/templates/${templateId}`);
}

export async function createCypherTemplate(payload: CypherTemplatePayload): Promise<CypherTemplate> {
  return post<CypherTemplate>(`${BASE}/templates`, payload);
}

export async function updateCypherTemplate(
  templateId: string,
  payload: CypherTemplatePayload,
): Promise<CypherTemplate> {
  return put<CypherTemplate>(`${BASE}/templates/${templateId}`, payload);
}

export async function deleteCypherTemplate(templateId: string): Promise<void> {
  await del<void>(`${BASE}/templates/${templateId}`);
}

export async function listCypherCategories(): Promise<string[]> {
  return get<string[]>(`${BASE}/templates/categories`);
}

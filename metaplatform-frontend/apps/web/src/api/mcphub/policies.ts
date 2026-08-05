import { createApiClient, apiPath } from '@mate/shared/api';

const client = createApiClient({ baseURL: apiPath('mcp', '') });
const data = <T>(resp: { data: T }): T => resp.data;
async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> { return data(await client.get<T>(url, params ? { params } : undefined)); }
async function post<T>(url: string, body?: unknown): Promise<T> { return data(await client.post<T>(url, body)); }
async function put<T>(url: string, body?: unknown): Promise<T> { return data(await client.put<T>(url, body)); }
async function del<T>(url: string): Promise<T> { return data(await client.delete<T>(url)); }
async function download(url: string, params?: Record<string, unknown>): Promise<Blob> { return (await client.get(url, { params, responseType: 'blob' })).data as Blob; }

import type {
  Policy,
  PolicyCreateRequest,
  PolicyUpdateRequest,
  PolicyMatrix,
  ConditionSyntax,
  PageResponse,
} from './types';
export async function listPolicies(params?: {
  keyword?: string;
  subjectType?: string;
  subjectId?: string;
  resourceType?: string;
  page?: number;
  size?: number;
}): Promise<PageResponse<Policy>> {
  return get<PageResponse<Policy>>('/iam/policies', params);
}
export async function createPolicy(req: PolicyCreateRequest): Promise<Policy> {
  return post<Policy>('/iam/policies', req);
}
export async function updatePolicy(id: string, req: PolicyCreateRequest): Promise<Policy> {
  return put<Policy>(`/v1/iam/policies/${id}`, req);
}
export async function deletePolicy(id: string): Promise<void> {
  await del(`/v1/iam/policies/${id}`);
}
export async function getPolicyMatrix(type: string, action?: string): Promise<PolicyMatrix> {
  return get<PolicyMatrix>('/iam/policies/matrix', { type, action });
}
export async function exportPolicyMatrix(
  type: string,
  format: 'csv' | 'xlsx',
  action?: string,
): Promise<Blob> {
  return download('/iam/policies/matrix/export', { type, format, action });
}
export async function getConditionSyntax(): Promise<ConditionSyntax> {
  return get<ConditionSyntax>('/iam/policies/condition-syntax');
}

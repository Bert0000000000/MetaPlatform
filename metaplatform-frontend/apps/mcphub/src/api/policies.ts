import { get, post, put, del, download } from './client';
import type {
  Policy,
  PolicyCreateRequest,
  PolicyMatrix,
  ConditionSyntax,
  PageResponse,
} from '@/types';

export async function listPolicies(params?: {
  keyword?: string;
  subjectType?: string;
  subjectId?: string;
  resourceType?: string;
  page?: number;
  size?: number;
}): Promise<PageResponse<Policy>> {
  return get<PageResponse<Policy>>('/v1/iam/policies', params);
}

export async function createPolicy(req: PolicyCreateRequest): Promise<Policy> {
  return post<Policy>('/v1/iam/policies', req);
}

export async function updatePolicy(id: string, req: PolicyCreateRequest): Promise<Policy> {
  return put<Policy>(`/v1/iam/policies/${id}`, req);
}

export async function deletePolicy(id: string): Promise<void> {
  await del(`/v1/iam/policies/${id}`);
}

export async function getPolicyMatrix(type: string, action?: string): Promise<PolicyMatrix> {
  return get<PolicyMatrix>('/v1/iam/policies/matrix', { type, action });
}

export async function exportPolicyMatrix(
  type: string,
  format: 'csv' | 'xlsx',
  action?: string,
): Promise<Blob> {
  return download('/v1/iam/policies/matrix/export', { type, format, action });
}

export async function getConditionSyntax(): Promise<ConditionSyntax> {
  return get<ConditionSyntax>('/v1/iam/policies/condition-syntax');
}

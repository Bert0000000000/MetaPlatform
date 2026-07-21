import { get, post, put, del } from './client';
import type {
  ExternalAgent,
  ExternalAgentCreateRequest,
  ExternalAgentTestResult,
  PageResponse,
} from '@/types';

export async function listExternalAgents(params?: {
  status?: string;
  trustLevel?: string;
  protocolType?: string;
  keyword?: string;
  page?: number;
  size?: number;
}): Promise<PageResponse<ExternalAgent>> {
  return get<PageResponse<ExternalAgent>>('/v1/mcp/external-agents', params);
}

export async function getExternalAgent(id: string): Promise<ExternalAgent> {
  return get<ExternalAgent>(`/v1/mcp/external-agents/${id}`);
}

export async function createExternalAgent(req: ExternalAgentCreateRequest): Promise<ExternalAgent> {
  return post<ExternalAgent>('/v1/mcp/external-agents', req);
}

export async function updateExternalAgent(
  id: string,
  req: ExternalAgentCreateRequest,
): Promise<ExternalAgent> {
  return put<ExternalAgent>(`/v1/mcp/external-agents/${id}`, req);
}

export async function deleteExternalAgent(id: string): Promise<void> {
  await del(`/v1/mcp/external-agents/${id}`);
}

export async function testExternalAgentConnection(id: string): Promise<ExternalAgentTestResult> {
  return post<ExternalAgentTestResult>(`/v1/mcp/external-agents/${id}/test-connection`);
}

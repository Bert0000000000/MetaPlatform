import { get, post } from './client';
import type {
  CollaborationAudit,
  CollaborationAuditCreateRequest,
  PageResponse,
} from '@/types';

export async function listCollaborations(params?: {
  callerId?: string;
  calleeId?: string;
  protocolType?: string;
  status?: string;
  startTime?: string;
  endTime?: string;
  traceId?: string;
  page?: number;
  size?: number;
}): Promise<PageResponse<CollaborationAudit>> {
  return get<PageResponse<CollaborationAudit>>('/v1/mcp/collaborations/logs', params);
}

export async function getCollaboration(id: string): Promise<CollaborationAudit> {
  return get<CollaborationAudit>(`/v1/mcp/collaborations/logs/${id}`);
}

export async function createCollaboration(
  req: CollaborationAuditCreateRequest,
): Promise<CollaborationAudit> {
  return post<CollaborationAudit>('/v1/mcp/collaborations', req);
}

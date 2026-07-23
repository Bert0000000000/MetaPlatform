import { get, post, put } from './client';
import type {
  FeedbackCreateRequest,
  FeedbackRecord,
  LearnedKnowledge,
  LearningStats,
  PageResponse,
} from '@/types';

export async function recordFeedback(request: FeedbackCreateRequest): Promise<FeedbackRecord> {
  return post<FeedbackRecord>('/v1/dw/learning/feedback', request);
}

export async function listFeedback(params?: {
  employeeId?: string;
  taskId?: string;
}): Promise<PageResponse<FeedbackRecord>> {
  return get<PageResponse<FeedbackRecord>>('/v1/dw/learning/feedback', params as Record<string, unknown> | undefined);
}

export async function updateFeedbackTags(feedbackId: string, tags: string[]): Promise<FeedbackRecord> {
  return put<FeedbackRecord>(`/v1/dw/learning/feedback/${feedbackId}/tags`, { tags });
}

export async function extractKnowledge(employeeId: string): Promise<{
  knowledge: LearnedKnowledge[];
}> {
  return post<{ knowledge: LearnedKnowledge[] }>('/v1/dw/learning/extract', { employee_id: employeeId });
}

export async function listKnowledge(
  employeeId: string,
  syncedOnly = false,
): Promise<{ items: LearnedKnowledge[] }> {
  return get<{ items: LearnedKnowledge[] }>(
    `/v1/dw/learning/employees/${employeeId}/knowledge`,
    { syncedOnly },
  );
}

export async function syncToKnowledgeBase(employeeId: string): Promise<{
  employeeId: string;
  syncedCount: number;
  documentIds: string[];
}> {
  return post<{
    employeeId: string;
    syncedCount: number;
    documentIds: string[];
  }>(`/v1/dw/learning/employees/${employeeId}/sync-to-kb`);
}

export async function getLearningStats(employeeId: string): Promise<LearningStats> {
  return get<LearningStats>(`/v1/dw/learning/employees/${employeeId}/stats`);
}

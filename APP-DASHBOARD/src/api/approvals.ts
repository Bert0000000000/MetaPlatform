import { get, post } from './client';
import type { ApprovalTask, PageResponse } from '@/types';

export async function getPendingTasks(): Promise<PageResponse<ApprovalTask>> {
  return get<PageResponse<ApprovalTask>>('/v1/wfe/tasks/pending');
}

export async function getCompletedTasks(): Promise<PageResponse<ApprovalTask>> {
  return get<PageResponse<ApprovalTask>>('/v1/wfe/tasks/completed');
}

export async function completeTask(taskId: string, action: 'approve' | 'reject', comment: string): Promise<void> {
  await post(`/v1/wfe/tasks/${taskId}/${action}`, { comment });
}

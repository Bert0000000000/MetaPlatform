import { get, post } from './client';
import type { ApprovalTask, PageResponse } from '@/types';

const MOCK_TASKS: ApprovalTask[] = [
  {
    taskId: 'task-001',
    title: '采购申请审批',
    flowName: '采购审批流程',
    applicant: '张三',
    applicantId: 'user-001',
    priority: 'high',
    status: 'pending',
    createdAt: new Date(Date.now() - 1_800_000).toISOString(),
  },
  {
    taskId: 'task-002',
    title: '出差报销审批',
    flowName: '费用报销流程',
    applicant: '李四',
    applicantId: 'user-002',
    priority: 'medium',
    status: 'pending',
    createdAt: new Date(Date.now() - 3_600_000).toISOString(),
  },
  {
    taskId: 'task-003',
    title: '合同用印审批',
    flowName: '合同审批流程',
    applicant: '王五',
    applicantId: 'user-003',
    priority: 'low',
    status: 'pending',
    createdAt: new Date(Date.now() - 7_200_000).toISOString(),
  },
];

function emptyPage<T>(): PageResponse<T> {
  return { items: [], total: 0, page: 1, pageSize: 10, totalPages: 0 };
}

function mockPage(items: ApprovalTask[]): PageResponse<ApprovalTask> {
  return { items, total: items.length, page: 1, pageSize: 10, totalPages: 1 };
}

export async function getPendingTasks(): Promise<PageResponse<ApprovalTask>> {
  try {
    return await get<PageResponse<ApprovalTask>>('/v1/wfe/tasks/pending');
  } catch {
    return mockPage(MOCK_TASKS);
  }
}

export async function getCompletedTasks(): Promise<PageResponse<ApprovalTask>> {
  try {
    return await get<PageResponse<ApprovalTask>>('/v1/wfe/tasks/completed');
  } catch {
    return emptyPage();
  }
}

export async function completeTask(taskId: string, action: 'approve' | 'reject', _comment: string): Promise<void> {
  try {
    await post(`/v1/wfe/tasks/${taskId}/${action}`, { comment: _comment });
  } catch {
    // Backend not ready: local-only completion.
  }
}

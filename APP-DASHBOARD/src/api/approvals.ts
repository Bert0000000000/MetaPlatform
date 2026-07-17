import { get, post } from './client';
import type { ApprovalTask, PageResponse } from '@/types';

const STORAGE_KEY = 'mate_dash_approvals';

const MOCK_PENDING: ApprovalTask[] = [
  {
    taskId: 't1',
    title: '采购审批 - 服务器采购申请',
    applicant: '张三',
    applicantId: 'u1',
    flowName: '采购审批流',
    status: 'pending',
    priority: 'high',
    createdAt: '2026-07-17T09:00:00Z',
    submittedAt: '2026-07-17T09:05:00Z',
  },
  {
    taskId: 't2',
    title: '请假申请 - 年假3天',
    applicant: '李四',
    applicantId: 'u2',
    flowName: '请假审批流',
    status: 'pending',
    priority: 'medium',
    createdAt: '2026-07-17T10:00:00Z',
    submittedAt: '2026-07-17T10:02:00Z',
  },
  {
    taskId: 't3',
    title: '报销审批 - 差旅费报销',
    applicant: '王五',
    applicantId: 'u3',
    flowName: '报销审批流',
    status: 'pending',
    priority: 'low',
    createdAt: '2026-07-16T14:00:00Z',
    submittedAt: '2026-07-16T14:10:00Z',
  },
];

const MOCK_COMPLETED: ApprovalTask[] = [
  {
    taskId: 't4',
    title: '合同审批 - 供应商合作协议',
    applicant: '赵六',
    applicantId: 'u4',
    flowName: '合同审批流',
    status: 'completed',
    priority: 'high',
    createdAt: '2026-07-15T09:00:00Z',
    completedAt: '2026-07-15T11:00:00Z',
    comment: '已审核通过',
  },
  {
    taskId: 't5',
    title: '预算审批 - Q3部门预算',
    applicant: '钱七',
    applicantId: 'u5',
    flowName: '预算审批流',
    status: 'rejected',
    priority: 'high',
    createdAt: '2026-07-14T09:00:00Z',
    completedAt: '2026-07-14T15:00:00Z',
    comment: '预算超限，请调整后重新提交',
  },
];

function loadFromStorage(): ApprovalTask[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as ApprovalTask[];
  } catch {
    return [];
  }
}

function saveToStorage(items: ApprovalTask[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export async function getPendingTasks(): Promise<PageResponse<ApprovalTask>> {
  try {
    return await get<PageResponse<ApprovalTask>>('/v1/wfe/tasks/pending');
  } catch {
    const stored = loadFromStorage().filter((t) => t.status === 'pending');
    const items = [...MOCK_PENDING, ...stored];
    return { items, total: items.length, page: 1, pageSize: items.length, totalPages: 1 };
  }
}

export async function getCompletedTasks(): Promise<PageResponse<ApprovalTask>> {
  try {
    return await get<PageResponse<ApprovalTask>>('/v1/wfe/tasks/completed');
  } catch {
    const stored = loadFromStorage().filter((t) => t.status !== 'pending');
    const items = [...MOCK_COMPLETED, ...stored];
    return { items, total: items.length, page: 1, pageSize: items.length, totalPages: 1 };
  }
}

export async function completeTask(taskId: string, action: 'approve' | 'reject', comment: string): Promise<void> {
  try {
    await post(`/v1/wfe/tasks/${taskId}/${action}`, { comment });
  } catch {
    const items = loadFromStorage();
    const mock = [...MOCK_PENDING, ...MOCK_COMPLETED];
    const task = mock.find((t) => t.taskId === taskId) || items.find((t) => t.taskId === taskId);
    if (task) {
      task.status = action === 'approve' ? 'completed' : 'rejected';
      task.completedAt = new Date().toISOString();
      task.comment = comment;
      saveToStorage([...items.filter((t) => t.taskId !== taskId), task]);
    }
  }
}

import { get } from './client';
import type { EmployeeTask } from '@/types';

const STORAGE_KEY = 'app_dw_tasks';

const MOCK_TASKS: EmployeeTask[] = [
  {
    id: 'task-1',
    employeeId: '_mock_',
    title: '月度报销数据汇总',
    description: '收集本月所有报销单并生成统计报告',
    status: 'completed',
    priority: 'high',
    createdAt: '2026-07-01T09:00:00Z',
    startedAt: '2026-07-01T09:00:00Z',
    completedAt: '2026-07-01T09:15:00Z',
    result: '本月共处理报销单 45 份，总金额 128,500 元',
    progress: 100,
  },
  {
    id: 'task-2',
    employeeId: '_mock_',
    title: '合同到期提醒',
    description: '检查即将到期的合同并发送续签提醒',
    status: 'running',
    priority: 'medium',
    createdAt: '2026-07-15T10:00:00Z',
    startedAt: '2026-07-15T10:00:00Z',
    progress: 60,
  },
  {
    id: 'task-3',
    employeeId: '_mock_',
    title: '客户满意度调查',
    description: '向 A 级客户发送满意度问卷并收集反馈',
    status: 'pending',
    priority: 'low',
    createdAt: '2026-07-16T14:00:00Z',
    progress: 0,
  },
];

function loadTasks(): EmployeeTask[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as EmployeeTask[];
  } catch {
    return [];
  }
}

function saveTasks(items: EmployeeTask[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export async function listTasks(employeeId: string): Promise<EmployeeTask[]> {
  try {
    return await get<EmployeeTask[]>('/v1/agent/employees/tasks', { employeeId });
  } catch {
    const stored = loadTasks().filter((t) => t.employeeId === employeeId);
    if (stored.length > 0) return stored;
    return MOCK_TASKS.map((t) => ({ ...t, employeeId, id: `${t.id}-${employeeId}` }));
  }
}

export async function getTaskStats(employeeId: string): Promise<{
  total: number;
  running: number;
  completed: number;
  failed: number;
}> {
  const tasks = await listTasks(employeeId);
  return {
    total: tasks.length,
    running: tasks.filter((t) => t.status === 'running').length,
    completed: tasks.filter((t) => t.status === 'completed').length,
    failed: tasks.filter((t) => t.status === 'failed').length,
  };
}

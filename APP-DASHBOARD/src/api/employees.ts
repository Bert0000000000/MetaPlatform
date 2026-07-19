import { get } from './client';
import type { WorkerStatus } from '@/types';

const MOCK_WORKERS: WorkerStatus[] = [
  {
    employeeId: 'emp-001',
    name: '销售助手',
    code: 'sales-assistant',
    roleCategory: 'SALES',
    status: 'ACTIVE',
    runningTasks: 3,
    completedToday: 12,
    lastActiveAt: new Date().toISOString(),
  },
  {
    employeeId: 'emp-002',
    name: '客服机器人',
    code: 'customer-service',
    roleCategory: 'SERVICE',
    status: 'ACTIVE',
    runningTasks: 1,
    completedToday: 28,
    lastActiveAt: new Date().toISOString(),
  },
  {
    employeeId: 'emp-003',
    name: '数据分析师',
    code: 'data-analyst',
    roleCategory: 'ANALYSIS',
    status: 'INACTIVE',
    runningTasks: 0,
    completedToday: 5,
  },
];

export async function getEmployeeStatus(): Promise<WorkerStatus[]> {
  try {
    return await get<WorkerStatus[]>('/v1/agent/employees/status');
  } catch {
    // Backend not ready; return mock data so the dashboard renders.
    return MOCK_WORKERS;
  }
}

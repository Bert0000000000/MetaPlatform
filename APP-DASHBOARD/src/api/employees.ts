import { get } from './client';
import type { WorkerStatus } from '@/types';

const MOCK_WORKERS: WorkerStatus[] = [
  {
    employeeId: 'w1',
    name: '财务助手',
    code: 'finance-bot',
    roleCategory: 'FINANCE',
    status: 'ACTIVE',
    runningTasks: 3,
    completedToday: 12,
    lastActiveAt: '2026-07-17T11:30:00Z',
  },
  {
    employeeId: 'w2',
    name: 'HR 助手',
    code: 'hr-bot',
    roleCategory: 'HR',
    status: 'ACTIVE',
    runningTasks: 1,
    completedToday: 8,
    lastActiveAt: '2026-07-17T11:25:00Z',
  },
  {
    employeeId: 'w3',
    name: '法务助手',
    code: 'legal-bot',
    roleCategory: 'LEGAL',
    status: 'INACTIVE',
    runningTasks: 0,
    completedToday: 5,
    lastActiveAt: '2026-07-16T18:00:00Z',
  },
];

export async function getEmployeeStatus(): Promise<WorkerStatus[]> {
  try {
    return await get<WorkerStatus[]>('/v1/agent/employees/status');
  } catch {
    return MOCK_WORKERS;
  }
}

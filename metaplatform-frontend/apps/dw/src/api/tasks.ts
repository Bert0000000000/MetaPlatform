import { get } from './client';
import type { EmployeeTask } from '@/types';

export async function listTasks(employeeId: string): Promise<EmployeeTask[]> {
  return get<EmployeeTask[]>('/v1/dw/employees/tasks', { employeeId });
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

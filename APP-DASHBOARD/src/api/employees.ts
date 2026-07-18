import { get } from './client';
import type { WorkerStatus } from '@/types';

export async function getEmployeeStatus(): Promise<WorkerStatus[]> {
  return get<WorkerStatus[]>('/v1/agent/employees/status');
}

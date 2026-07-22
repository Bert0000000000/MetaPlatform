import { get } from './client';
import type { WorkerStatus } from '@/types';

interface AgentResponse {
  id: string;
  name: string;
  code?: string;
  roleCategory?: string;
  status?: string;
  runningTasks?: number;
  completedToday?: number;
  lastActiveAt?: string;
}

function mapAgent(item: AgentResponse): WorkerStatus {
  return {
    employeeId: item.id,
    name: item.name,
    code: item.code || item.id,
    roleCategory: item.roleCategory || 'OTHER',
    status: (item.status as WorkerStatus['status']) || 'ACTIVE',
    runningTasks: item.runningTasks ?? 0,
    completedToday: item.completedToday ?? 0,
    lastActiveAt: item.lastActiveAt,
  };
}

export async function getEmployeeStatus(): Promise<WorkerStatus[]> {
  const agents = await get<AgentResponse[]>('/v1/agent/agents');
  return Array.isArray(agents) ? agents.map(mapAgent) : [];
}

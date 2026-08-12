import { createApiClient, apiPath } from '@mate/shared/api';

// A3: scheduling 编排入口已由 copilot 吸收到 orchestrator。
const client = createApiClient({ baseURL: '/api/v1/orchestrator' });
const data = <T>(resp: { data: T }): T => resp.data;
async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> { return data(await client.get<T>(url, params ? { params } : undefined)); }
async function post<T>(url: string, body?: unknown): Promise<T> { return data(await client.post<T>(url, body)); }
async function put<T>(url: string, body?: unknown): Promise<T> { return data(await client.put<T>(url, body)); }
async function del<T>(url: string): Promise<T> { return data(await client.delete<T>(url)); }

export interface ScheduleIntent {
  intentId: string;
  userId: string;
  rawUtterance: string;
  detectedIntent: 'scheduled' | 'immediate';
  confidence: number;
  detectedEmployees: string[];
  scheduleAt?: string;
  matchedAt?: string;
  status: 'pending' | 'planned' | 'running' | 'completed' | 'failed';
}
export interface ExecutionPlan {
  planId: string;
  intentId: string;
  steps: Array<{ id: string; name: string; employeeId?: string; tool?: string; estimatedDuration: number }>;
  totalEstimatedDuration: number;
  parallelGroups?: Array<{ groupId: string; stepIds: string[] }>;
  createdAt: string;
}
export interface SubTaskResult {
  resultId: string;
  planId: string;
  stepId: string;
  status: 'completed' | 'failed' | 'skipped';
  output?: string;
  errorMessage?: string;
  startedAt: string;
  completedAt?: string;
  duration?: number;
}
export interface ScheduleTemplate {
  templateId: string;
  name: string;
  description: string;
  intentPattern: string;
  plan: ExecutionPlan;
  createdBy: string;
  createdAt: string;
}
export interface ScheduleExecution {
  executionId: string;
  intentId: string;
  planId: string;
  status: 'pending' | 'running' | 'completed' | 'partial' | 'failed';
  progress: number;
  results: SubTaskResult[];
  startedAt: string;
  completedAt?: string;
  finalReport?: string;
}
export async function detectIntent(text: string): Promise<ScheduleIntent> {
  return post<ScheduleIntent>('/scheduling/intent/detect', { text });
}
export interface MatchedEmployee {
  employeeId: string;
  name: string;
  role?: string;
  capability?: string;
  confidence: number;
}
export async function matchEmployees(intent: string): Promise<MatchedEmployee[]> {
  return post<MatchedEmployee[]>('/scheduling/employees/match', { intent });
}
export async function generatePlan(intentId: string): Promise<ExecutionPlan> {
  return post<ExecutionPlan>('/scheduling/plan/generate', { intentId });
}
export async function startExecution(planId: string): Promise<ScheduleExecution> {
  return post<ScheduleExecution>('/scheduling/execution/start', { planId });
}
export async function aggregateResults(executionId: string): Promise<string> {
  return get<string>(`/scheduling/execution/${executionId}/report`);
}
export async function listIntentHistory(): Promise<ScheduleIntent[]> {
  return get<ScheduleIntent[]>('/scheduling/intents');
}
export async function listTemplates(): Promise<ScheduleTemplate[]> {
  return get<ScheduleTemplate[]>('/scheduling/templates');
}
export async function createTemplate(req: Omit<ScheduleTemplate, 'templateId' | 'createdAt'>): Promise<ScheduleTemplate> {
  return post<ScheduleTemplate>('/scheduling/templates', req);
}

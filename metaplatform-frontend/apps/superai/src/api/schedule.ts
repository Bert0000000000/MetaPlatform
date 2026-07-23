import { get, post } from './client';

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
  return post<ScheduleIntent>('/v1/copilot/scheduling/intent/detect', { text });
}

export async function matchEmployees(intent: string): Promise<Array<{ employeeId: string; name: string; confidence: number }>> {
  return post<Array<{ employeeId: string; name: string; confidence: number }>>('/v1/copilot/scheduling/employees/match', { intent });
}

export async function generatePlan(intentId: string): Promise<ExecutionPlan> {
  return post<ExecutionPlan>('/v1/copilot/scheduling/plan/generate', { intentId });
}

export async function startExecution(planId: string): Promise<ScheduleExecution> {
  return post<ScheduleExecution>('/v1/copilot/scheduling/execution/start', { planId });
}

export async function aggregateResults(executionId: string): Promise<string> {
  return get<string>(`/v1/copilot/scheduling/execution/${executionId}/report`);
}

export async function listIntentHistory(): Promise<ScheduleIntent[]> {
  return get<ScheduleIntent[]>('/v1/copilot/scheduling/intents');
}

export async function listTemplates(): Promise<ScheduleTemplate[]> {
  return get<ScheduleTemplate[]>('/v1/copilot/scheduling/templates');
}

export async function createTemplate(req: Omit<ScheduleTemplate, 'templateId' | 'createdAt'>): Promise<ScheduleTemplate> {
  return post<ScheduleTemplate>('/v1/copilot/scheduling/templates', req);
}
